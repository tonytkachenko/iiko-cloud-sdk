import { describe, expect, it } from "vitest";

import { tokenExpiryMs } from "../src/auth.js";
import { createIikoClient, IikoAuthError } from "../src/index.js";
import { fakeServer, json, jwt, testClient } from "./helpers.js";

const organizations = { correlationId: "c", organizations: [] };

describe("auth", () => {
  it("adds a bearer token and reuses it", async () => {
    const { client, server, token } = testClient(() => json(organizations));

    await client.organizations.list();
    await client.organizations.list();

    expect(server.count("/api/v2/access_token")).toBe(1);
    expect(server.calls[1]?.headers.get("authorization")).toBe(`Bearer ${token}`);
  });

  it("issues one token request for parallel calls", async () => {
    const { client, server } = testClient(() => json(organizations));

    await Promise.all([
      client.organizations.list(),
      client.terminals.list("org-1"),
      client.organizations.getById("org-1"),
    ]);

    expect(server.count("/api/v2/access_token")).toBe(1);
  });

  it("refreshes on 401 and replays the request once", async () => {
    let protectedCalls = 0;
    const { client, server } = testClient(() =>
      ++protectedCalls === 1
        ? json({ errorDescription: "token expired" }, 401)
        : json(organizations),
    );

    const { data } = await client.organizations.list();

    expect(data?.organizations).toEqual([]);
    expect(server.count("/api/v2/access_token")).toBe(2);
    expect(protectedCalls).toBe(2);
  });

  it("refreshes a token that is about to expire", async () => {
    let tokenCalls = 0;
    const server = fakeServer((call) =>
      call.path === "/api/v2/access_token"
        ? json({ token: jwt(Math.floor(Date.now() / 1000) + 30) })
        : json(organizations),
    );
    const client = createIikoClient({
      appId: "a",
      clientSecret: "s",
      apiKey: "k",
      fetch: server.fetch,
    });

    await client.organizations.list();
    expect(tokenCalls).toBe(0);
    await client.organizations.list();

    // Both calls were inside the 60s refresh margin.
    expect(server.count("/api/v2/access_token")).toBe(2);
    expect(tokenCalls).toBe(0);
  });

  it("reports a rejected token request as an auth error", async () => {
    const server = fakeServer(() => json({ errorDescription: "bad credentials" }, 401));
    const client = createIikoClient({
      appId: "a",
      clientSecret: "s",
      apiKey: "k",
      fetch: server.fetch,
    });

    const { error } = await client.organizations.list();

    expect(error).toBeInstanceOf(IikoAuthError);
    expect(error?.message).toBe("bad credentials");
  });

  it("reports a token response without a token", async () => {
    const server = fakeServer(() => json({ correlationId: "c" }));
    const client = createIikoClient({
      appId: "a",
      clientSecret: "s",
      apiKey: "k",
      fetch: server.fetch,
    });

    const { error } = await client.organizations.list();

    expect(error).toBeInstanceOf(IikoAuthError);
    expect(error?.message).toContain("did not contain a token");
  });

  it("reports an unreachable token endpoint", async () => {
    const server = fakeServer(() => {
      throw new TypeError("fetch failed");
    });
    const client = createIikoClient({
      appId: "a",
      clientSecret: "s",
      apiKey: "k",
      fetch: server.fetch,
    });

    const { error } = await client.organizations.list();

    expect(error).toBeInstanceOf(IikoAuthError);
    expect(error?.message).toContain("access token endpoint");
  });

  it("ignores a token whose expiry cannot be read", async () => {
    expect(tokenExpiryMs("not-a-jwt")).toBeUndefined();
    expect(tokenExpiryMs("a.!!!.c")).toBeUndefined();
    expect(tokenExpiryMs(jwt(Math.floor(Date.now() / 1000) + 3600))).toBeGreaterThan(Date.now());
  });
});
