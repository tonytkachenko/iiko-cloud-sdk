import { readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createIikoClient, IikoError, IikoValidationError } from "../src/index.js";
import { resolveConfig } from "../src/core/config.js";
import { fakeIiko, json, makeClient } from "./helpers.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};

const organizations = {
  correlationId: "c-1",
  organizations: [
    { id: "org-1", name: "First" },
    { id: "org-2", name: "Second" },
  ],
};

describe("transport", () => {
  it("lists organizations with the documented POST and no body", async () => {
    const iiko = fakeIiko(() => organizations);
    const client = makeClient(iiko.fetch);

    const result = await client.transport.organizations.list();

    expect(result.organizations).toHaveLength(2);
    const call = iiko.api()[0];
    expect(call?.method).toBe("POST");
    expect(call?.path).toBe("/api/1/organizations");
    expect(call?.body).toEqual({});
  });

  it("fetches a single organization by id", async () => {
    const iiko = fakeIiko(() => organizations);
    const client = makeClient(iiko.fetch);

    const organization = await client.transport.organizations.getById("org-2");

    expect(organization?.id).toBe("org-2");
    const call = iiko.api()[0];
    expect(call?.method).toBe("POST");
    expect(call?.path).toBe("/api/1/organizations");
    expect(call?.body).toEqual({ organizationIds: ["org-2"] });
  });

  it("returns undefined when the organization does not exist", async () => {
    const iiko = fakeIiko(() => json({ correlationId: "c", organizations: [] }));
    const client = makeClient(iiko.fetch);

    await expect(client.transport.organizations.getById("missing")).resolves.toBeUndefined();
  });

  it("returns undefined when the response contains other organizations", async () => {
    const iiko = fakeIiko(() => organizations);
    const client = makeClient(iiko.fetch);

    await expect(client.transport.organizations.getById("missing")).resolves.toBeUndefined();
  });

  it("lists terminal groups for an organization", async () => {
    const iiko = fakeIiko(() => ({
      correlationId: "c",
      terminalGroups: [],
      terminalGroupsInSleep: [],
    }));
    const client = makeClient(iiko.fetch);

    await client.transport.terminalGroups.list({ organizationIds: ["org-1"] });

    const call = iiko.api()[0];
    expect(call?.method).toBe("POST");
    expect(call?.path).toBe("/api/1/terminal_groups");
    expect(call?.body).toEqual({ organizationIds: ["org-1"] });
  });

  it("fetches a v3 external menu", async () => {
    const iiko = fakeIiko(() => ({ id: "menu" }));
    const client = makeClient(iiko.fetch);

    await client.transport.menu.byIdV3({ organizationId: "org-1", externalMenuId: "menu-1" });

    const call = iiko.api()[0];
    expect(call?.method).toBe("POST");
    expect(call?.path).toBe("/api/menu/v3/by_id");
    expect(call?.body).toEqual({ organizationId: "org-1", externalMenuId: "menu-1" });
  });

  it("throws a typed error instead of returning one", async () => {
    const iiko = fakeIiko(() => json({ errorDescription: "bad input" }, 400));
    const client = makeClient(iiko.fetch);

    await expect(client.transport.organizations.list()).rejects.toBeInstanceOf(IikoValidationError);
    await expect(client.transport.organizations.list()).rejects.toBeInstanceOf(IikoError);
  });

  it("exposes typed results and options", async () => {
    const iiko = fakeIiko(() => organizations);
    const client = makeClient(iiko.fetch);

    const result = await client.transport.organizations.list();
    expectTypeOf(result.organizations).toBeArray();

    expectTypeOf(createIikoClient).parameter(0).toHaveProperty("clientSecret");
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
    expect(() => createIikoClient({ ...valid, timeoutSec: 0 })).toThrow(TypeError);
    expect(() => createIikoClient({ ...valid, retries: -1 })).toThrow(TypeError);
    expect(() => createIikoClient({ ...valid, retries: 1.5 })).toThrow(TypeError);
    expect(() => createIikoClient({ ...valid, retryBaseMs: 0 })).toThrow(TypeError);
  });

  it("rejects a baseUrl with a query string", () => {
    expect(() => createIikoClient({ ...valid, baseUrl: "https://proxy.test/?key=x" })).toThrow(
      /query/,
    );
  });

  it("defaults to the iikoCloud base URL and trims a trailing slash", async () => {
    const iiko = fakeIiko(() => organizations, {});
    const client = makeClient(iiko.fetch);
    await client.transport.organizations.list();
    expect(iiko.api()[0]?.url).toBe("https://api-ru.iiko.services/api/1/organizations");

    const custom = fakeIiko(() => organizations);
    await makeClient(custom.fetch, {
      baseUrl: "https://proxy.test/",
    }).transport.organizations.list();
    expect(custom.api()[0]?.url).toBe("https://proxy.test/api/1/organizations");
  });

  it("fills in defaults", () => {
    const config = resolveConfig(valid);

    expect(config.fetch).toBe(globalThis.fetch);
    expect(config.baseUrl).toBe("https://api-ru.iiko.services");
    expect(config.timeoutSec).toBe(15);
    expect(config.retries).toBe(3);
    expect(config.retryBaseMs).toBe(1000);
    expect(config.debug).toBe(false);
    expect(config.userAgent).toBe(`iiko-cloud-sdk/${pkg.version}`);
  });
});
