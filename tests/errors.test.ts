import { describe, expect, it } from "vitest";
import {
  IikoAuthError,
  IikoError,
  IikoRateLimitError,
  IikoServerError,
  IikoTimeoutError,
  IikoValidationError,
} from "../src/index.js";
import { fakeIiko, json, makeClient } from "./helpers.js";

const cases: [number, typeof IikoError][] = [
  [400, IikoValidationError],
  [404, IikoValidationError],
  [409, IikoValidationError],
  [422, IikoValidationError],
  [403, IikoAuthError],
  [429, IikoRateLimitError],
  [500, IikoServerError],
  [502, IikoServerError],
  [503, IikoServerError],
  [408, IikoTimeoutError],
];

describe("error mapping", () => {
  it.each(cases)("maps HTTP %i to the right class", async (status, expected) => {
    const iiko = fakeIiko(() => json({ message: "boom" }, status));
    const client = makeClient(iiko.fetch);

    const error = await client.transport.organizations.list().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(expected);
    expect(error).toMatchObject({ status });
  });

  it("reads both iiko and Office error envelopes", async () => {
    const iiko = fakeIiko(() =>
      json(
        { correlationId: "c-1", error: "BAD_INPUT", errorDescription: "Bad organizationId" },
        400,
      ),
    );
    const error = (await makeClient(iiko.fetch)
      .transport.organizations.list()
      .catch((caught: unknown) => caught)) as IikoError;

    expect(error.message).toBe("Bad organizationId");
    expect(error.correlationId).toBe("c-1");
    expect(error.code).toBe("BAD_INPUT");
  });

  it("falls back to `message` when there is no errorDescription", async () => {
    const iiko = fakeIiko(() => json({ message: "Not found", details: null }, 404));
    const error = await makeClient(iiko.fetch)
      .transport.organizations.list()
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ message: "Not found", status: 404 });
  });

  it("keeps status and Retry-After when the body is not JSON", async () => {
    const iiko = fakeIiko(
      () =>
        new Response("<html>Bad gateway</html>", { status: 502, headers: { "retry-after": "2" } }),
    );
    const error = (await makeClient(iiko.fetch, { retries: 0 })
      .transport.organizations.list()
      .catch((caught: unknown) => caught)) as IikoError;

    expect(error).toBeInstanceOf(IikoServerError);
    expect(error.responseBody).toBeUndefined();
    expect(error.message).toContain("502");
    expect(error.retryAfterMs).toBe(2000);
  });

  it("exposes retryAfterMs on a 429", async () => {
    const iiko = fakeIiko(() => json({ message: "slow down" }, 429, { "retry-after": "5" }));
    const error = (await makeClient(iiko.fetch, { retries: 0 })
      .transport.organizations.list()
      .catch((caught: unknown) => caught)) as IikoRateLimitError;

    expect(error).toBeInstanceOf(IikoRateLimitError);
    expect(error.retryAfterMs).toBe(5000);
  });

  it("never puts credentials into errors or logs", async () => {
    const records: string[] = [];
    const logger = {
      debug: (message: string, meta?: unknown) =>
        records.push(`${message} ${JSON.stringify(meta)}`),
      info: (message: string, meta?: unknown) => records.push(`${message} ${JSON.stringify(meta)}`),
      warn: (message: string, meta?: unknown) => records.push(`${message} ${JSON.stringify(meta)}`),
      error: (message: string, meta?: unknown) =>
        records.push(`${message} ${JSON.stringify(meta)}`),
    };
    const request = {
      appId: "test-app",
      clientSecret: "test-secret",
      apiKey: "test-key",
      authToken: "test-hook-token",
      credential: "test-card-credential",
      apiLogin: "test-login",
      certificateNumber: "keep-certificate",
      seoKeywords: "keep-keywords",
    };
    const iiko = fakeIiko(() => json({ errorDescription: "rejected", ...request }, 500));
    const client = makeClient(iiko.fetch, { logger, debug: true });

    const error = (await client.transport.organizations
      .list(request as never)
      .catch((caught: unknown) => caught)) as IikoError;

    const serialized = [
      error.message,
      error.stack,
      JSON.stringify(error),
      JSON.stringify(error.requestBody),
      JSON.stringify(error.responseBody),
      ...records,
    ].join(" ");

    expect(serialized).not.toContain("test-secret");
    expect(serialized).not.toContain("test-key");
    expect(serialized).not.toContain("test-app");
    expect(serialized).not.toContain("test-hook-token");
    expect(serialized).not.toContain("test-card-credential");
    expect(serialized).not.toContain("test-login");
    expect(serialized).toContain("keep-certificate");
    expect(serialized).toContain("keep-keywords");
    expect(serialized).toContain("[redacted]");
  });
});
