import { describe, expect, it } from "vitest";
import {
  IikoAuthError,
  IikoError,
  IikoRateLimitError,
  IikoServerError,
  IikoValidationError,
  redact,
  responseError,
  retryAfterMs,
} from "../src/errors.js";
import { json, testClient } from "./helpers.js";

const context = { method: "GET", endpoint: "/api/1/organizations" };

const cases: Array<[number, typeof IikoError]> = [
  [400, IikoValidationError],
  [401, IikoAuthError],
  [403, IikoError],
  [404, IikoError],
  [409, IikoValidationError],
  [422, IikoValidationError],
  [429, IikoRateLimitError],
  [500, IikoServerError],
  [502, IikoServerError],
  [503, IikoServerError],
];

describe("responseError", () => {
  it.each(cases)("maps %i to the right class", (status, ErrorClass) => {
    const error = responseError(
      json({ errorDescription: "boom", correlationId: "c-1", error: "CODE" }, status),
      { errorDescription: "boom", correlationId: "c-1", error: "CODE" },
      context,
    );

    expect(error).toBeInstanceOf(ErrorClass);
    expect(error.status).toBe(status);
    expect(error.message).toBe("boom");
    expect(error.code).toBe("CODE");
    expect(error.correlationId).toBe("c-1");
    expect(error.endpoint).toBe("/api/1/organizations");
    expect(error.method).toBe("GET");
  });

  it("falls back to a readable message when the body is empty", () => {
    const error = responseError(new Response(null, { status: 500 }), undefined, context);
    expect(error.message).toContain("500");
  });

  it("reads Retry-After as seconds and as a date", () => {
    const seconds = retryAfterMs(json({}, 429, { "retry-after": "2" }));
    expect(seconds).toBe(2000);

    // An HTTP date carries whole seconds only, so allow one second of truncation slack.
    const inAnHour = 3_600_000;
    const date = retryAfterMs(
      json({}, 429, { "retry-after": new Date(Date.now() + inAnHour).toUTCString() }),
    );
    expect(date).toBeGreaterThan(inAnHour - 1000);
    expect(date).toBeLessThanOrEqual(inAnHour);

    expect(retryAfterMs(json({}, 429, { "retry-after": "nonsense" }))).toBeUndefined();
  });
});

describe("redact", () => {
  it("removes credentials from keys, arrays and bearer values", () => {
    const payload = {
      appId: "app",
      nested: { clientSecret: "secret", apiKey: "key", organizationIds: ["org"] },
      header: "Bearer abc.def-ghi_jkl",
    };

    expect(redact(payload)).toEqual({
      appId: "[redacted]",
      nested: { clientSecret: "[redacted]", apiKey: "[redacted]", organizationIds: ["org"] },
      header: "Bearer [redacted]",
    });
  });

  it("survives cycles and preserves primitives", () => {
    const circular: Record<string, unknown> = { count: 1, ok: true, nothing: null };
    circular.self = circular;

    expect(redact(circular)).toEqual({
      count: 1,
      ok: true,
      nothing: null,
      self: "[circular]",
    });
  });

  it("keeps secrets out of a real error and every log line", async () => {
    const records: string[] = [];
    const logger = {
      debug: (message: string, meta?: unknown) =>
        records.push(`${message} ${JSON.stringify(meta)}`),
      info: (message: string, meta?: unknown) => records.push(`${message} ${JSON.stringify(meta)}`),
      warn: (message: string, meta?: unknown) => records.push(`${message} ${JSON.stringify(meta)}`),
      error: (message: string, meta?: unknown) =>
        records.push(`${message} ${JSON.stringify(meta)}`),
    };

    const { client } = testClient(
      () =>
        json(
          {
            errorDescription: "rejected",
            appId: "test-app",
            clientSecret: "test-secret",
            apiKey: "test-key",
          },
          500,
        ),
      { logger },
    );

    const { error } = await client.transport.organizations.list();
    expect(error).toBeInstanceOf(IikoServerError);

    const serialized = [
      error?.message,
      error?.stack,
      JSON.stringify(error),
      JSON.stringify(error?.responseBody),
      ...records,
    ].join(" ");

    expect(serialized).not.toContain("test-secret");
    expect(serialized).not.toContain("test-key");
    expect(serialized).not.toContain("test-app");
  });
});
