import { afterEach, describe, expect, it, vi } from "vitest";
import { IikoNetworkError, IikoRateLimitError, IikoTimeoutError } from "../src/index.js";
import { fakeIiko, hang, json, makeClient, ORG } from "./helpers.js";

const organizations = { correlationId: "c", organizations: [] };

afterEach(() => {
  vi.useRealTimers();
});

describe("retries", () => {
  it("retries a 429 for reads and writes alike, resending the same body", async () => {
    for (const run of [
      (client: ReturnType<typeof makeClient>) =>
        client.transport.organizations.list({ returnAdditionalInfo: true }),
      (client: ReturnType<typeof makeClient>) =>
        client.transport.deliveries.cancel({ organizationId: ORG, orderId: ORG }),
    ]) {
      const answers = [
        json({ message: "slow down" }, 429),
        json({ message: "slow down" }, 429),
        { ok: true },
      ];
      const iiko = fakeIiko(() => answers.shift()!);
      const client = makeClient(iiko.fetch, { retries: 3, retryBaseMs: 1 });

      await expect(run(client)).resolves.toEqual({ ok: true });
      expect(iiko.api()).toHaveLength(3);
      expect(new Set(iiko.api().map((call) => JSON.stringify(call.body))).size).toBe(1);
    }
  });

  it("gives up after `retries` attempts and surfaces the 429", async () => {
    const iiko = fakeIiko(() => json({ message: "slow down" }, 429, { "retry-after": "0" }));
    const client = makeClient(iiko.fetch, { retries: 2 });

    await expect(client.transport.organizations.list()).rejects.toBeInstanceOf(IikoRateLimitError);
    expect(iiko.api()).toHaveLength(3);
  });

  it("waits Retry-After seconds before resending", async () => {
    vi.useFakeTimers();
    const answers = [json({}, 429, { "retry-after": "2" }), { ok: true }];
    const iiko = fakeIiko(() => answers.shift()!);
    const client = makeClient(iiko.fetch, { retries: 3, retryBaseMs: 100 });

    const result = client.transport.organizations.list();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(iiko.api()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ ok: true });
    expect(iiko.api()).toHaveLength(2);
  });

  it("waits until an HTTP-date Retry-After", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const answers = [
      json({}, 429, { "retry-after": new Date(Date.now() + 2_000).toUTCString() }),
      { ok: true },
    ];
    const iiko = fakeIiko(() => answers.shift()!);
    const client = makeClient(iiko.fetch, { retries: 3, retryBaseMs: 100 });

    const result = client.transport.organizations.list();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(iiko.api()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ ok: true });
  });

  it.each([500, 502, 503, 408])("does not retry HTTP %i", async (status) => {
    const iiko = fakeIiko(() => json({ message: "boom" }, status));
    const client = makeClient(iiko.fetch, { retries: 3, retryBaseMs: 1 });

    await expect(client.transport.organizations.list()).rejects.toMatchObject({ status });
    expect(iiko.api()).toHaveLength(1);
  });

  it("exposes Retry-After on a 5xx without retrying it", async () => {
    const iiko = fakeIiko(() => json({ message: "boom" }, 503, { "retry-after": "5" }));
    const client = makeClient(iiko.fetch, { retries: 3, retryBaseMs: 1 });

    const error = await client.transport.organizations.list().catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 503, retryAfterMs: 5000 });
    expect(iiko.api()).toHaveLength(1);
  });

  it("wraps network failures without retrying", async () => {
    let attempts = 0;
    const iiko = fakeIiko(() => {
      attempts++;
      throw new TypeError("fetch failed");
    });
    const client = makeClient(iiko.fetch, { retries: 3 });

    await expect(client.transport.organizations.list()).rejects.toBeInstanceOf(IikoNetworkError);
    expect(attempts).toBe(1);
  });
});

describe("timeouts and cancellation", () => {
  it("sends the Timeout header, including the per-call override", async () => {
    const iiko = fakeIiko(() => organizations);
    const client = makeClient(iiko.fetch, { timeoutSec: 30 });

    await client.transport.organizations.list();
    await client.transport.organizations.list({}, { timeoutSec: 10 });

    expect(iiko.api()[0]?.headers.get("timeout")).toBe("30");
    expect(iiko.api()[1]?.headers.get("timeout")).toBe("10");
  });

  it("gives up 5 s after the server timeout", async () => {
    vi.useFakeTimers();
    const iiko = fakeIiko((_call, signal) => hang(signal));
    const client = makeClient(iiko.fetch, { timeoutSec: 10 });

    let settled = false;
    const result = client.transport.organizations
      .list()
      .catch((error: unknown) => error)
      .then((value) => {
        settled = true;
        return value;
      });
    await vi.advanceTimersByTimeAsync(14_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(await result).toBeInstanceOf(IikoTimeoutError);
  });

  it("lets the caller abort without wrapping the error", async () => {
    const iiko = fakeIiko((_call, signal) => hang(signal));
    const client = makeClient(iiko.fetch);
    const controller = new AbortController();

    const promise = client.transport.organizations.list({}, { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    await expect(promise).rejects.not.toBeInstanceOf(IikoNetworkError);
  });

  it("stops a 429 backoff as soon as the caller aborts", async () => {
    vi.useFakeTimers();
    const iiko = fakeIiko(() => json({ message: "slow down" }, 429, { "retry-after": "30" }));
    const client = makeClient(iiko.fetch, { retries: 3 });
    const controller = new AbortController();
    let settled = false;
    const result = client.transport.organizations
      .list({}, { signal: controller.signal })
      .catch((error: unknown) => error)
      .then((value) => {
        settled = true;
        return value;
      });

    await vi.advanceTimersByTimeAsync(1);
    expect(iiko.api()).toHaveLength(1);

    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(settled).toBe(true);
    await expect(result).resolves.toMatchObject({ name: "AbortError" });
    expect(iiko.api()).toHaveLength(1);
  });

  it("applies the per-call timeout to the token request", async () => {
    vi.useFakeTimers();
    const iiko = fakeIiko(() => organizations, { token: (_call, signal) => hang(signal) });
    const client = makeClient(iiko.fetch, { timeoutSec: 30 });
    let settled = false;
    const result = client.transport.organizations
      .list({}, { timeoutSec: 1 })
      .catch((error: unknown) => error)
      .then((value) => {
        settled = true;
        return value;
      });

    await vi.advanceTimersByTimeAsync(5_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);

    expect(settled).toBe(true);
    await expect(result).resolves.toBeInstanceOf(IikoTimeoutError);
    expect(iiko.api()).toHaveLength(0);
  });

  it("does not sleep when the signal is already aborted during a 429", async () => {
    const controller = new AbortController();
    const iiko = fakeIiko(() => json({ message: "slow down" }, 429, { "retry-after": "30" }));
    const client = makeClient(iiko.fetch, {
      retries: 3,
      onAttempt: (event) => {
        if (event.status === 429) controller.abort();
      },
    });

    await expect(
      client.transport.organizations.list({}, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(iiko.api()).toHaveLength(1);
  });
});

describe("observability", () => {
  it("sends a User-Agent with the SDK name, overridable", async () => {
    const iiko = fakeIiko(() => organizations);
    await makeClient(iiko.fetch).transport.organizations.list();
    expect(iiko.api()[0]?.headers.get("user-agent")).toMatch(/^iiko-cloud-sdk\//);
    expect(iiko.calls[0]?.headers.get("user-agent")).toMatch(/^iiko-cloud-sdk\//);

    const custom = fakeIiko(() => organizations);
    await makeClient(custom.fetch, { userAgent: "my-bot/2" }).transport.organizations.list();
    expect(custom.api()[0]?.headers.get("user-agent")).toBe("my-bot/2");
  });
});
