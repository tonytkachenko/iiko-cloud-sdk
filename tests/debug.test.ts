import { describe, expect, it } from "vitest";
import type { ILogger } from "../src/index.js";
import { json, testClient } from "./helpers.js";

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

describe("debug logging", () => {
  it("logs redacted bodies only when debug is on", async () => {
    const body = { correlationId: "c", organizations: [{ id: "org-1", apiKey: "leak-me" }] };
    const off = recorder();
    await testClient(() => json(body), {
      logger: off.logger,
    }).client.transport.organizations.list();
    expect(off.entries.some((entry) => entry.message.endsWith("iiko: response body"))).toBe(false);

    const on = recorder();
    const { client } = testClient(() => json(body), { logger: on.logger, debug: true });
    await client.transport.organizations.getById("org-1");

    const logged = JSON.stringify(on.entries);
    expect(logged).toContain("org-1");
    expect(logged).toContain("[redacted]");
    expect(logged).not.toContain("leak-me");
    expect(logged).not.toContain("test-key");
    expect(logged).not.toContain("Bearer ");
  });
});
