import { describe, expect, it } from "vitest";
import {
  IikoCommandError,
  IikoTimeoutError,
  fromIikoDateUtc,
  toIikoDateUtc,
} from "../src/index.js";
import { fakeIiko, makeClient, ORG } from "./helpers.js";

describe("office", () => {
  it("calls a generated Office method with its path and body", async () => {
    const iiko = fakeIiko(() => ({ products: [] }));
    const client = makeClient(iiko.fetch);

    await client.office.nomenclature.product.listV2({ limit: 1 });

    const call = iiko.api()[0];
    expect(call?.method).toBe("POST");
    expect(call?.path).toBe("/api/nomenclature/v2/product/list");
    expect(call?.body).toEqual({ limit: 1 });
  });
});

describe("call escape hatch", () => {
  it("reaches a deprecated operation by path", async () => {
    const iiko = fakeIiko(() => ({ id: "menu" }));
    const client = makeClient(iiko.fetch);

    await client.call("/api/2/menu/by_id", {
      externalMenuId: "menu-1",
      organizationIds: [ORG],
    });

    expect(iiko.api()[0]?.path).toBe("/api/2/menu/by_id");
  });

  it("is typed by the spec paths", () => {
    const client = makeClient(fakeIiko().fetch);
    expect(typeof client.call).toBe("function");
    // @ts-expect-error unknown path
    void (() => client.call("/api/1/nope", {}));
  });
});

describe("commands.wait", () => {
  it("polls until Success", async () => {
    const states = [{ state: "InProgress" }, { state: "InProgress" }, { state: "Success" }];
    const iiko = fakeIiko(() => states.shift()!);
    const client = makeClient(iiko.fetch);

    await expect(
      client.transport.commands.wait(
        { organizationId: ORG, correlationId: "cmd-1" },
        { intervalMs: 1, timeoutMs: 50 },
      ),
    ).resolves.toEqual({ state: "Success" });
    expect(iiko.api()).toHaveLength(3);
  });

  it("throws IikoCommandError with the reason on state Error", async () => {
    const iiko = fakeIiko(() => ({ state: "Error", errorReason: "Table is busy" }));
    const client = makeClient(iiko.fetch);

    const error = await client.transport.commands
      .wait({ organizationId: ORG, correlationId: "cmd-1" }, { intervalMs: 1, timeoutMs: 50 })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(IikoCommandError);
    expect(error).toMatchObject({ correlationId: "cmd-1", reason: "Table is busy" });
  });

  it("throws IikoTimeoutError when the command never finishes", async () => {
    const iiko = fakeIiko(() => ({ state: "InProgress" }));
    const client = makeClient(iiko.fetch);

    await expect(
      client.transport.commands.wait(
        { organizationId: ORG, correlationId: "cmd-1" },
        { intervalMs: 1, timeoutMs: 5 },
      ),
    ).rejects.toBeInstanceOf(IikoTimeoutError);
  });
});

describe("dates", () => {
  it("formats and parses the iiko date format", () => {
    const date = new Date(Date.UTC(2019, 7, 24, 14, 15, 22, 123));
    expect(toIikoDateUtc(date)).toBe("2019-08-24 14:15:22.123");
    expect(fromIikoDateUtc("2019-08-24 14:15:22.123")).toEqual(date);
    expect(toIikoDateUtc(new Date(Date.UTC(2020, 0, 2, 3, 4, 5, 6)))).toBe(
      "2020-01-02 03:04:05.006",
    );
  });

  it("rejects garbage", () => {
    expect(() => fromIikoDateUtc("tomorrow")).toThrow(RangeError);
  });
});
