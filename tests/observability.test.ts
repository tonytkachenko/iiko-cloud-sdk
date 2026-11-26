import { describe, expect, it } from "vitest";
import { IikoRateLimitError, type AttemptEvent, type ILogger } from "../src/index.js";
import { fakeIiko, json, makeClient } from "./helpers.js";

function recorder() {
  const entries: { message: string; meta?: Record<string, unknown> }[] = [];
  const log =
    (level: string): ILogger["debug"] =>
    (message, meta) =>
      entries.push({ message: `${level}: ${message}`, meta });
  const logger: ILogger = {
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
  };
  return { logger, entries };
}

describe("observability", () => {
  it("reports every attempt: token request, 429 retry and the final answer", async () => {
    const answers = [
      json({ correlationId: "c-429", errorDescription: "slow" }, 429),
      { correlationId: "c-ok", organizations: [] },
    ];
    const iiko = fakeIiko(() => answers.shift()!);
    const events: AttemptEvent[] = [];

    await makeClient(iiko.fetch, {
      retries: 2,
      retryBaseMs: 1,
      onAttempt: (event) => events.push(event),
    }).transport.organizations.list();

    expect(
      events.map((event) => [event.path, event.attempt, event.status, event.correlationId]),
    ).toEqual([
      ["/api/v2/access_token", 0, 200, "token-correlation"],
      ["/api/1/organizations", 0, 429, "c-429"],
      ["/api/1/organizations", 1, 200, "c-ok"],
    ]);
    expect(events[1]?.error).toBeInstanceOf(IikoRateLimitError);
    expect(events.every((event) => event.durationMs >= 0)).toBe(true);
    expect(events.every((event) => !("body" in event))).toBe(true);
  });

  it("swallows a broken onAttempt hook", async () => {
    const iiko = fakeIiko(() => ({ correlationId: "c", organizations: [] }));
    const client = makeClient(iiko.fetch, {
      onAttempt: () => {
        throw new Error("logger is broken");
      },
    });

    await expect(client.transport.organizations.list()).resolves.toHaveProperty("organizations");
  });

  it("logs redacted bodies only when debug is on", async () => {
    const body = { correlationId: "c", organizations: [{ id: "org-1", apiKey: "leak-me" }] };

    const off = recorder();
    await makeClient(fakeIiko(() => body).fetch, {
      logger: off.logger,
    }).transport.organizations.list();
    expect(JSON.stringify(off.entries)).not.toContain("leak-me");

    const on = recorder();
    const iiko = fakeIiko(() => body);
    await makeClient(iiko.fetch, { logger: on.logger, debug: true }).transport.organizations.list();

    const logged = JSON.stringify(on.entries);
    expect(logged).toContain("org-1");
    expect(logged).toContain("[redacted]");
    expect(logged).not.toContain("leak-me");
    expect(logged).not.toContain("Bearer ");
  });
});
