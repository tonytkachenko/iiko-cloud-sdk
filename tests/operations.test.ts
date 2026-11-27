import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEPRECATED_OPERATIONS, OPERATIONS } from "../src/generated/operations.js";
import { fakeIiko, makeClient } from "./helpers.js";

type Loose = (...args: unknown[]) => Promise<unknown>;

function methodOf(client: ReturnType<typeof makeClient>, op: (typeof OPERATIONS)[number]): Loose {
  const service = op.service === "transport" ? client.transport : client.office;
  const domain = (service as unknown as Record<string, Record<string, unknown>>)[op.domain];
  const owner = op.subresource
    ? (domain?.[op.subresource] as Record<string, Loose> | undefined)
    : (domain as Record<string, Loose> | undefined);
  const method = owner?.[op.method];
  if (typeof method !== "function") {
    throw new Error(`Missing generated method ${op.service}.${op.domain}.${op.method}`);
  }
  return method;
}

describe("generated operations", () => {
  const rows = OPERATIONS.map((op) => ({
    ...op,
    label: `${op.service}.${op.domain}${op.subresource ? `.${op.subresource}` : ""}.${op.method}`,
  }));

  it.each(rows)("$label POSTs $path", async (op) => {
    const iiko = fakeIiko(() => ({}));
    const client = makeClient(iiko.fetch);

    await methodOf(client, op).call(undefined, ...(op.body === "required" ? [{ marker: 1 }] : []));

    expect(iiko.api()).toHaveLength(1);
    const [call] = iiko.api();
    expect(call?.method).toBe("POST");
    expect(call?.path).toBe(op.path);
    expect(call?.body).toEqual(
      op.body === "required" ? { marker: 1 } : op.body === "optional" ? {} : undefined,
    );
  });

  it("covers every non-deprecated POST of the committed spec, and nothing else", () => {
    const spec = JSON.parse(
      readFileSync(fileURLToPath(new URL("../spec/raw.json", import.meta.url)), "utf8"),
    );
    const live = Object.entries<any>(spec.paths)
      .filter(
        ([path, item]) => item.post && !item.post.deprecated && path !== "/api/v2/access_token",
      )
      .map(([path]) => path)
      .toSorted();

    expect(OPERATIONS.map((op) => op.path).toSorted()).toEqual(live);
  });

  it("lists every deprecated POST, so the escape hatch stays complete", () => {
    const spec = JSON.parse(
      readFileSync(fileURLToPath(new URL("../spec/raw.json", import.meta.url)), "utf8"),
    );
    const deprecated = Object.entries<any>(spec.paths)
      .filter(([, item]) => item.post?.deprecated)
      .map(([path]) => path)
      .toSorted();

    expect(DEPRECATED_OPERATIONS.toSorted()).toEqual(deprecated);
  });
});
