import { describe, expect, it, vi } from "vitest";

import { tokenExpiryMs } from "../src/core/auth.js";
import { IikoAuthError } from "../src/index.js";
import { fakeIiko, json, jwt, makeClient } from "./helpers.js";

const organizations = { correlationId: "c", organizations: [] };

describe("auth", () => {
  it("adds a bearer token and reuses it", async () => {
    const iiko = fakeIiko(() => organizations);
    const client = makeClient(iiko.fetch);

    await client.transport.organizations.list();
    await client.transport.organizations.list();

    expect(iiko.tokenRequests()).toBe(1);
    expect(iiko.api()[0]?.headers.get("authorization")).toMatch(/^Bearer /);
  });

  it("issues one token request for parallel calls", async () => {
    const iiko = fakeIiko(() => organizations);
    const client = makeClient(iiko.fetch);

    await Promise.all([
      client.transport.organizations.list(),
      client.transport.terminalGroups.list({ organizationIds: ["org-1"] }),
      client.transport.organizations.getById("org-1"),
    ]);

    expect(iiko.tokenRequests()).toBe(1);
  });

  it("refreshes on 401 and replays the request once", async () => {
    let protectedCalls = 0;
    const iiko = fakeIiko(() =>
      ++protectedCalls === 1 ? json({ errorDescription: "token expired" }, 401) : organizations,
    );
    const client = makeClient(iiko.fetch);

    const result = await client.transport.organizations.list();

    expect(result.organizations).toEqual([]);
    expect(iiko.tokenRequests()).toBe(2);
    expect(protectedCalls).toBe(2);
  });

  it("gives up when the replay is rejected too", async () => {
    const iiko = fakeIiko(() => json({ errorDescription: "Unauthorized" }, 401));
    const client = makeClient(iiko.fetch);

    await expect(client.transport.organizations.list()).rejects.toMatchObject({ status: 401 });
    expect(iiko.tokenRequests()).toBe(2);
  });

  it("refreshes a token that is about to expire", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const iiko = fakeIiko(() => organizations);
    const client = makeClient(iiko.fetch);

    await client.transport.organizations.list();
    await client.transport.organizations.list();
    expect(iiko.tokenRequests()).toBe(1);

    vi.setSystemTime(Date.now() + 56 * 60_000); // token lives 60 min, refreshed 5 min early
    await client.transport.organizations.list();
    expect(iiko.tokenRequests()).toBe(2);
    vi.useRealTimers();
  });

  it("reports a rejected token request as an auth error", async () => {
    const iiko = fakeIiko(() => organizations, {
      token: json({ errorDescription: "bad credentials" }, 401),
    });
    const client = makeClient(iiko.fetch);

    await expect(client.transport.organizations.list()).rejects.toBeInstanceOf(IikoAuthError);
    await expect(client.transport.organizations.list()).rejects.toMatchObject({
      message: "bad credentials",
    });
  });

  it("reports a token response without a token", async () => {
    const iiko = fakeIiko(() => organizations, { token: json({ correlationId: "c" }) });
    const client = makeClient(iiko.fetch);

    await expect(client.transport.organizations.list()).rejects.toThrow(/did not contain a token/);
  });

  it("reports an unreachable token endpoint", async () => {
    const client = makeClient(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(client.transport.organizations.list()).rejects.toBeInstanceOf(IikoAuthError);
  });

  it("ignores a token whose expiry cannot be read", () => {
    expect(tokenExpiryMs("not-a-jwt")).toBeUndefined();
    expect(tokenExpiryMs("a.!!!.c")).toBeUndefined();
    expect(tokenExpiryMs(jwt(Date.now() + 3_600_000))).toBeGreaterThan(Date.now());
  });
});
