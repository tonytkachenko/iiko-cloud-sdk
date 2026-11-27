// spec/raw.json (as downloaded from iiko) -> spec/normalized.json (what the generator sees).
// Every patch here fixes a known defect of the raw spec; anything unknown fails the run.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => path.join(root, "spec", name);

const spec = JSON.parse(fs.readFileSync(read("raw.json"), "utf8"));

// 1. Invalid `type` values. Each known defect has an explicit fix; anything new fails the run.
const FIXES = {
  uuid: { type: "string", format: "uuid" },
  float: { type: "number", format: "float" },
  bool: { type: "boolean" },
  int: { type: "integer" },
  "integer <int32>": { type: "integer", format: "int32" },
  "integer <int64>": { type: "integer", format: "int64" },
  "Array of strings <uuid>": { type: "array", items: { type: "string", format: "uuid" } },
};
const VALID = new Set(["string", "number", "integer", "boolean", "array", "object"]);
const SKIP = new Set(["example", "examples", "default", "enum"]); // values, not schemas
const unknown = [];
const patched = [];

const walk = (node, where) => {
  if (Array.isArray(node)) return node.forEach((value, index) => walk(value, `${where}[${index}]`));
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string" && !VALID.has(node.type)) {
    const constant = node.type.match(/^constant string '(.+)'$/); // webhook eventType
    // `type: enum` carries its values only as an example string: {"A", "B"}
    const listed =
      node.type === "enum"
        ? [...String(node.example).matchAll(/"([^"]+)"/g)].map((match) => match[1])
        : [];
    if (constant) {
      Object.assign(node, { type: "string", enum: [constant[1]] });
      patched.push(`${where}: constant string`);
    } else if (listed.length) {
      Object.assign(node, { type: "string", enum: listed, example: undefined });
      patched.push(`${where}: enum`);
    } else if (FIXES[node.type]) {
      Object.assign(node, FIXES[node.type]);
      patched.push(`${where}: ${node.type}`);
    } else {
      unknown.push(`${where}: type=${JSON.stringify(node.type)}`);
    }
  }
  for (const [key, value] of Object.entries(node))
    if (!SKIP.has(key)) walk(value, `${where}.${key}`);
};
walk(spec.components.schemas, "schemas");

// 2. Filter objects carry `op: string` with the allowed operators listed only in prose.
// Turn that prose into an enum so editors suggest the operators and unknown ones fail to compile.
const filterOps = [];
const walkFilters = (node, where) => {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    return node.forEach((value, index) => walkFilters(value, `${where}[${index}]`));
  }
  const op = node.properties?.op;
  if (op && node.properties?.field) {
    if (op.type !== "string") {
      unknown.push(`${where}.op: expected string, got ${JSON.stringify(op.type)}`);
    } else {
      const operators = [
        ...new Set(
          [...String(op.description ?? "").matchAll(/"([a-z]+)"/g)].map((match) => match[1]),
        ),
      ];
      if (operators.length === 0) {
        unknown.push(`${where}.op: no operators listed in the description`);
      } else {
        op.enum = operators;
        filterOps.push(where);
      }
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (!SKIP.has(key)) walkFilters(value, `${where}.${key}`);
  }
};
walkFilters(spec.components.schemas, "schemas");

// 3. A discriminated base type only says `state: string`; its variants are separate schemas.
// Point every use of the base at a oneOf of its variants (`<Base>Union`) so requests and responses
// are real unions. The one place that must keep naming the base is a variant's own `allOf` parent.
const schemas = spec.components.schemas;
const keep = new WeakSet();
const unionOf = new Map();
// A property may also reference a variant (`allOf: [{ $ref: RegularCustomer }]`). The API accepts
// every variant of the base there, so such a reference becomes the base union too.
const variantUnion = new Map();
for (const [key, base] of Object.entries(schemas)) {
  const mapping = base.discriminator?.mapping;
  if (!mapping) continue;
  const ref = `#/components/schemas/${key}`;
  for (const variantRef of Object.values(mapping)) {
    variantUnion.set(variantRef, `${ref}Union`);
    for (const part of schemas[variantRef.split("/").pop()]?.allOf ?? []) {
      if (part.$ref === ref) keep.add(part);
    }
  }
  schemas[`${key}Union`] = {
    oneOf: Object.values(mapping).map(($ref) => ({ $ref })),
    discriminator: base.discriminator,
  };
  unionOf.set(ref, `${ref}Union`);
}

const rewrite = (node, topLevel = false) => {
  if (Array.isArray(node)) return node.forEach((value) => rewrite(value));
  if (!node || typeof node !== "object" || keep.has(node)) return;
  // A property written as `allOf: [{ $ref: Base }]` (how Swashbuckle attaches a description to a
  // reference) reads as inheritance to openapi-typescript, which then emits Omit<Base, discriminator>.
  // Omit does not distribute over a union, so the property would collapse to the keys all variants
  // share. Make it a plain reference to the union.
  const only =
    !topLevel && Array.isArray(node.allOf) && node.allOf.length === 1 ? node.allOf[0] : undefined;
  if (only?.$ref && !keep.has(only)) {
    delete node.allOf;
    node.oneOf = [{ $ref: unionOf.get(only.$ref) ?? variantUnion.get(only.$ref) ?? only.$ref }];
    return;
  }
  const union = typeof node.$ref === "string" ? unionOf.get(node.$ref) : undefined;
  if (union) node.$ref = union;
  for (const [key, value] of Object.entries(node)) if (!SKIP.has(key)) rewrite(value);
};
rewrite(spec.paths);
for (const schema of Object.values(schemas)) rewrite(schema, true);

if (unknown.length > 0) {
  console.error(`Unknown invalid types, add a patch in normalize-spec.mjs:\n${unknown.join("\n")}`);
  process.exit(1);
}

fs.writeFileSync(read("normalized.json"), JSON.stringify(spec));
console.log(
  `normalized: ${Object.keys(spec.paths).length} paths, ${unionOf.size} discriminated unions, ` +
    `${filterOps.length} filter operator enums, ${patched.length} type patches`,
);
