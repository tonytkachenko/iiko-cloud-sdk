import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { noopLogger } from "../src/logger.js";
import { IikoNetworkError, IikoServerError, IikoTimeoutError } from "../src/errors.js";
import { createFetch, RETRY_HEADER } from "../src/http.js";
import { fakeServer, hang, json, testClient, type Call } from "./helpers.js";

const organizations = { correlationId: "c", organizations: [] };

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
    const { client, server } = testClient(() =>
      ++calls === 1 ? json({ errorDescription: "boom" }, 500) : json(organizations),
    );

    const result = await settle(client.organizations.list(), 1000);

    expect(result.data?.organizations).toEqual([]);
    expect(server.count("/api/1/organizations")).toBe(2);
  });

  it("waits for Retry-After on 429", async () => {
    let calls = 0;
    const { client, server } = testClient(() =>
      ++calls === 1 ? json({}, 429, { "retry-after": "1" }) : json(organizations),
    );

    const promise = client.organizations.list();
    await vi.advanceTimersByTimeAsync(900);
    expect(server.count("/api/1/organizations")).toBe(1);
    await vi.advanceTimersByTimeAsync(200);

    await expect(promise).resolves.toHaveProperty("data");
    expect(server.count("/api/1/organizations")).toBe(2);
  });

  it("gives up after maxRetries and reports a server error", async () => {
    const { client, server } = testClient(() => json({ errorDescription: "down" }, 503), {
      maxRetries: 1,
    });

    const result = await settle(client.organizations.list(), 2000);

    expect(result.error).toBeInstanceOf(IikoServerError);
    expect(server.count("/api/1/organizations")).toBe(2);
  });

  it("retries network errors", async () => {
    let calls = 0;
    const { client, server } = testClient(() => {
      if (++calls === 1) throw new TypeError("fetch failed");
      return json(organizations);
    });

    const result = await settle(client.organizations.list(), 1000);

    expect(result.data).toBeDefined();
    expect(server.count("/api/1/organizations")).toBe(2);
  });

  it("reports a network error once retries are exhausted", async () => {
    const { client } = testClient(
      () => {
        throw new TypeError("fetch failed");
      },
      { maxRetries: 0 },
    );

    const { error } = await client.organizations.list();

    expect(error).toBeInstanceOf(IikoNetworkError);
    expect(error?.message).toBe("Network request failed");
    expect(error?.cause).toBeInstanceOf(TypeError);
  });

  it("never retries a POST unless it opts in", async () => {
    const { client, server } = testClient(() => json({ errorDescription: "boom" }, 500), {
      maxRetries: 2,
    });

    const result = await settle(client.organizations.getById("org-1"), 2000);

    expect(result.error).toBeInstanceOf(IikoServerError);
    expect(server.count("/api/1/organizations")).toBe(1);
  });

  it("retries a POST that sets the retry header, and strips the header", async () => {
    let calls = 0;
    const server = fakeServer((_call: Call) =>
      ++calls === 1 ? json({}, 500) : json({ ok: true }),
    );
    const wrapped = createFetch({
      fetch: server.fetch,
      auth: { getToken: async () => "token", invalidate() {} },
      timeoutMs: 5000,
      maxRetries: 1,
      logger: noopLogger,
      debug: false,
    });

    const promise = wrapped("https://example.test/api/action", {
      method: "POST",
      headers: { [RETRY_HEADER]: "true" },
    });
    const response = await settle(promise, 1000);

    expect(response.status).toBe(200);
    expect(server.calls).toHaveLength(2);
    expect(server.calls[0]?.headers.get(RETRY_HEADER)).toBeNull();
  });
});

describe("timeouts and cancellation", () => {
  it("stops a request that exceeds timeoutMs", async () => {
    vi.useRealTimers();
    const { client, server } = testClient((_call, signal) => hang(signal), { timeoutMs: 25 });

    const { error } = await client.organizations.list();

    expect(error).toBeInstanceOf(IikoTimeoutError);
    expect(server.count("/api/1/organizations")).toBe(1);
  });

  it("reports a caller abort as a network error", async () => {
    vi.useRealTimers();
    const { client } = testClient((_call, signal) => hang(signal));
    const controller = new AbortController();

    const promise = client.organizations.list(controller.signal);
    controller.abort();

    const { error } = await promise;
    expect(error).toBeInstanceOf(IikoNetworkError);
    expect(error?.code).toBe("ABORTED");
  });
});
