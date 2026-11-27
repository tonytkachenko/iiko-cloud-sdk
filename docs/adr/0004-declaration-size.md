# ADR-0004: One declaration file; no per-service subpaths yet

## Context

`dist/index.d.ts` is 2.58 MB and 67,123 lines. It contains the full OpenAPI `paths` type from
`src/generated/schema.ts` (2.4 MB, 65,462 lines), the generated operation wrappers (254 transport
and 472 office lines) and the hand-written runtime. Every import of `iiko-cloud-sdk` parses the
whole file, even `import { IikoError }`.

Measured in a six-file strict Node.js consumer (TypeScript 6.0.3, `module: NodeNext`, cold
`tsc --noEmit`):

| Consumer | `skipLibCheck: true` | `skipLibCheck: false` |
|---|---|---|
| SDK | 0.18–0.19 s, 70–71 MB | 0.39–0.40 s, 105–111 MB |
| Same app with a 13-line stub | 0.06–0.07 s, 21–26 MB | 0.12–0.13 s, 36 MB |
| Delta | ~0.12 s, ~45–50 MB | ~0.27 s, ~70 MB |

A single `IikoError` or `Transport` import still loads 67,124 lines: the whole file is parsed at
0.15–0.20 s and 60–69 MB. The cost is per project, not per source file.

A naive `iiko-cloud-sdk/transport` or `/office` entrypoint would still import `RequestOf` and
`ResponseOf` from the one schema, so it would not reduce the parse. A real split needs the spec
pipeline to emit a filtered spec per service. With the current normalized spec, transport uses 129
paths and 548 of 1,109 schemas (665 KB of JSON), office uses 287 paths and 513 schemas (956 KB);
the overlap is small. The main `createIikoClient` entrypoint would still need both schemas.

## Decision

Keep one declaration file and no service subpaths for now. Consumers should keep
`skipLibCheck: true`; the measured delta is ~0.12 s and ~50 MB per project. Add
`iiko-cloud-sdk/transport` and `/office` only together with per-service schema generation, and
measure again in a real consumer. A cheap `iiko-cloud-sdk/errors` entrypoint is possible, but it
does not address the main entrypoint and no consumer has asked for it.

## Alternatives rejected

- **Naive subpath re-exports.** Small to add, but they keep the one schema and show no measurable
  win.
- **Split the schema per service now.** Meaningful for service-specific apps, but it changes
  `spec/`, `scripts/` and generated files, and the main entrypoint still loads both. It is a
  spec-pipeline task, not a runtime change.
- **Drop typed operation types from the main entrypoint.** Defeats the SDK's main feature.
- **Ship a shallow client plus a typed subpath.** Splits the API and weakens the default.

## Consequences

- Consumers pay the declaration cost once per project; with `skipLibCheck: true` the measured cold
  `tsc` is ~0.2 s, acceptable for a backend SDK.
- If a consumer reports editor or `tsc` problems, this ADR is the starting point: measure the real
  project, then choose between per-service schemas and a typed/untyped split.
