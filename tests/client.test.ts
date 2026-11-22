import { describe, expect, expectTypeOf, it } from "vitest";
import { createIikoClient, IikoError, IikoServerError } from "../src/index.js";
import { resolveConfig } from "../src/config.js";
import { json, testClient } from "./helpers.js";

const organizations = {
  correlationId: "c-1",
  organizations: [
    { id: "org-1", name: "First" },
    { id: "org-2", name: "Second" },
  ],
};

describe("resources", () => {
  it("lists organizations with GET and no body", async () => {
    const { client, server } = testClient(() => json(organizations));

    const result = await client.organizations.list();

    expect(result.data?.organizations).toHaveLength(2);
    expect(result.error).toBeUndefined();
    const call = server.calls[1];
    expect(call?.method).toBe("GET");
    expect(call?.path).toBe("/api/1/organizations");
    expect(call?.body).toBeUndefined();
  });

  it("fetches a single organization by id", async () => {
    const { client, server } = testClient(() => json(organizations));

    const { data } = await client.organizations.getById("org-2");

    expect(data?.id).toBe("org-1");
    const call = server.calls[1];
    expect(call?.method).toBe("POST");
    expect(call?.path).toBe("/api/1/organizations");
    expect(call?.body).toEqual({ organizationIds: ["org-2"] });
  });

  it("returns undefined when the organization does not exist", async () => {
    const { client } = testClient(() => json({ correlationId: "c", organizations: [] }));

    const { data } = await client.organizations.getById("missing");

    expect(data).toBeUndefined();
  });

  it("lists terminal groups for an organization", async () => {
    const { client, server } = testClient(() =>
      json({ correlationId: "c", terminalGroups: [], terminalGroupsInSleep: [] }),
    );

    await client.terminals.list("org-1");

    const call = server.calls[1];
    expect(call?.method).toBe("POST");
    expect(call?.path).toBe("/api/1/terminal_groups");
    expect(call?.body).toEqual({ organizationIds: ["org-1"] });
  });

  it("fetches an external menu with its options", async () => {
    const { client, server } = testClient(() => json({ id: "menu" }));

    await client.menu.getExternalMenu("org-1", "menu-1", { version: 2, language: "ru" });

    const call = server.calls[1];
    expect(call?.method).toBe("POST");
    expect(call?.path).toBe("/api/2/menu/by_id");
    expect(call?.body).toEqual({
      organizationIds: ["org-1"],
      externalMenuId: "menu-1",
      version: 2,
      language: "ru",
    });
  });

  it("returns a typed error instead of throwing", async () => {
    const { client } = testClient(() => json({ errorDescription: "no access" }, 403));

    const result = await client.terminals.list("org-1");

    expect(result.error).toBeInstanceOf(IikoError);
    expect(result.data).toBeUndefined();
  });

  it("exposes typed results and options", async () => {
    const { client } = testClient(() => json(organizations));

    const result = await client.organizations.list();
    expectTypeOf(result.error).toEqualTypeOf<IikoError | undefined>();
    if (result.data) expectTypeOf(result.data.organizations).toBeArray();

    expectTypeOf(createIikoClient).parameter(0).toHaveProperty("clientSecret");
    expectTypeOf<IikoServerError>().toMatchTypeOf<IikoError>();
  });
});

describe("config", () => {
  const valid = { appId: "a", clientSecret: "secret-value", apiKey: "key-value" };

  it("requires credentials without echoing them", () => {
    const error = (() => {
      try {
        createIikoClient({ ...valid, appId: "" });
      } catch (caught) {
        return caught as Error;
      }
    })();

    expect(error).toBeInstanceOf(TypeError);
    expect(error?.message).toContain("appId");
    expect(error?.message).not.toContain("secret-value");
    expect(error?.message).not.toContain("key-value");
  });

  it("rejects invalid numeric and URL options", () => {
    expect(() => createIikoClient({ ...valid, baseUrl: "not a url" })).toThrow(TypeError);
    expect(() => createIikoClient({ ...valid, timeoutMs: 0 })).toThrow(TypeError);
    expect(() => createIikoClient({ ...valid, maxRetries: -1 })).toThrow(TypeError);
    expect(() => createIikoClient({ ...valid, maxRetries: 1.5 })).toThrow(TypeError);
  });

  it("defaults to the iikoCloud base URL and trims a trailing slash", async () => {
    const { client, server } = testClient(() => json(organizations));
    await client.organizations.list();
    expect(server.calls[1]?.url).toBe("https://api-ru.iiko.services/api/1/organizations");

    const custom = testClient(() => json(organizations), { baseUrl: "https://proxy.test/" });
    await custom.client.organizations.list();
    expect(custom.server.calls[1]?.url).toBe("https://proxy.test/api/1/organizations");
  });

  it("fills in defaults, including the global fetch", () => {
    const config = resolveConfig({ appId: "a", clientSecret: "s", apiKey: "k" });

    expect(config.fetch).toBe(globalThis.fetch);
    expect(config.baseUrl).toBe("https://api-ru.iiko.services");
    expect(config.timeoutMs).toBe(15_000);
    expect(config.maxRetries).toBe(2);
    expect(config.debug).toBe(false);
  });
});
