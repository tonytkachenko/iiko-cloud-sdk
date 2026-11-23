import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { noopLogger } from "../src/logger.js";
import { IikoNetworkError, IikoServerError, IikoTimeoutError } from "../src/errors.js";
import { createFetch } from "../src/http.js";
import { fakeServer, hang, json, testClient, type FakeServer } from "./helpers.js";

const auth = { getToken: async () => "token", invalidate() {} };

function wrapped(server: FakeServer, overrides: Partial<Parameters<typeof createFetch>[0]> = {}) {
  return createFetch({
    fetch: server.fetch,
    auth,
    timeoutMs: 5000,
    maxRetries: 2,
    logger: noopLogger,
    debug: false,
    ...overrides,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function settle<T>(promise: Promise<T>, ms: number): Promise<T> {
  await vi.advanceTimersByTimeAsync(ms);
  return promise;
}

describe("retries", () => {
  it("retries a 500 on an idempotent request and succeeds", async () => {
    let calls = 0;
    const server = fakeServer(() => (++calls === 1 ? json({}, 500) : json({ ok: true })));

    const response = await settle(wrapped(server)("https://example.test/action"), 1000);

    expect(response.status).toBe(200);
    expect(server.calls).toHaveLength(2);
  });

  it("waits for Retry-After on 429", async () => {
    let calls = 0;
    const server = fakeServer(() =>
      ++calls === 1 ? json({}, 429, { "retry-after": "1" }) : json({ ok: true }),
    );

    const promise = wrapped(server)("https://example.test/action");
    await vi.advanceTimersByTimeAsync(900);
    expect(server.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(200);

    await expect(promise).resolves.toHaveProperty("status", 200);
    expect(server.calls).toHaveLength(2);
  });

  it("gives up after maxRetries and returns the last response", async () => {
    const server = fakeServer(() => json({ errorDescription: "down" }, 503));

    const response = await settle(
      wrapped(server, { maxRetries: 1 })("https://example.test/action"),
      2000,
    );

    expect(response.status).toBe(503);
    expect(server.calls).toHaveLength(2);
  });

  it("retries network errors on an idempotent request", async () => {
    let calls = 0;
    const server = fakeServer(() => {
      if (++calls === 1) throw new TypeError("fetch failed");
      return json({ ok: true });
    });

    const response = await settle(wrapped(server)("https://example.test/action"), 1000);

    expect(response.status).toBe(200);
    expect(server.calls).toHaveLength(2);
  });

  it("never retries a POST, even when it carries a retry header", async () => {
    const server = fakeServer(() => json({ errorDescription: "boom" }, 500));

    const response = await settle(
      wrapped(server)("https://example.test/action", {
        method: "POST",
        headers: { "x-iiko-retry": "true" },
      }),
      2000,
    );

    expect(response.status).toBe(500);
    expect(server.calls).toHaveLength(1);
  });

  it("never retries a POST after a network error", async () => {
    const server = fakeServer(() => {
      throw new TypeError("fetch failed");
    });

    const promise = wrapped(server)("https://example.test/action", { method: "POST" });
    await expect(promise).rejects.toThrow("fetch failed");
    expect(server.calls).toHaveLength(1);
  });

  it("does not retry a failed transport call", async () => {
    const { client, server } = testClient(() => json({ errorDescription: "boom" }, 500), {
      maxRetries: 2,
    });

    const result = await settle(client.transport.organizations.list(), 2000);

    expect(result.error).toBeInstanceOf(IikoServerError);
    expect(server.count("/api/1/organizations")).toBe(1);
  });
});

describe("timeouts and cancellation", () => {
  it("stops a request that exceeds timeoutMs", async () => {
    vi.useRealTimers();
    const { client, server } = testClient((_call, signal) => hang(signal), { timeoutMs: 25 });

    const { error } = await client.transport.organizations.list();

    expect(error).toBeInstanceOf(IikoTimeoutError);
    expect(server.count("/api/1/organizations")).toBe(1);
  });

  it("reports a caller abort as a network error", async () => {
    vi.useRealTimers();
    const { client } = testClient((_call, signal) => hang(signal));
    const controller = new AbortController();

    const promise = client.transport.organizations.list(undefined, { signal: controller.signal });
    controller.abort();

    const { error } = await promise;
    expect(error).toBeInstanceOf(IikoNetworkError);
    expect(error?.code).toBe("ABORTED");
  });
});
