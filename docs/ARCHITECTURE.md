# Architecture

`iiko-cloud-sdk` is one package with two generated service surfaces and a small hand-written runtime:

```
spec/raw.json            committed OpenAPI document (iikoCloud, iikoTransport model)
        │
        ├─ scripts/normalize-spec.mjs   patches invalid types, builds discriminated unions
        ▼
spec/normalized.json     derived, not committed
        │
        ├─ openapi-typescript           src/generated/schema.ts
        ▼
scripts/generate.mjs     spec + names -> wrappers, named types, manifest
        │
        ├─ src/transport/generated/*.ts   transport.<domain>.<method>
        ├─ src/office/generated/*.ts      office.<domain>.<subresource>.<method>
        ├─ src/transport|office/generated/types.ts
        ├─ src/generated/no-body.ts       paths without a documented body
        └─ src/generated/operations.ts    active manifest for tests
```

## Spec pipeline

- `spec/raw.json` is the only committed source. Updates are deliberate: `pnpm spec:sync` downloads and rebuilds; `pnpm spec:build` rebuilds from the committed document.
- `normalize-spec.mjs` fixes known OpenAPI defects (`uuid`, `float`, `boolean`, enum-from-example), turns every discriminated base schema into a `oneOf` union at all use sites, and derives filter `op` enums from their descriptions (26 schemas, 11 operators). Unknown defects fail the run.
- `generate.mjs` never guesses silently: an active Transport operation without a name, a stale table entry, a non-POST operation, a duplicate method or type name, or an unmapped path fails the build.
- Transport names are curated in `scripts/names/transport.json` (126 operations): mutations are verb-first (`addCustomerCategory`, `holdCustomerWallet`), queries are noun-first (`customerInfo`, `customerCategories`). Office names are derived in `scripts/names/office.json` (domain + subresource + method, version suffixes in multi-version domains) with explicit overrides.

## Runtime

`src/core/` is hand-written:

- `transport.ts` — `fetch`, JSON, 401 replay, 429 retry, server-side `Timeout` header with a client grace, `User-Agent`, `onAttempt`, debug logging.
- `auth.ts` — JWT `exp` with a five-minute margin, one-hour fallback, single-flight token requests.
- `errors.ts` — eight classes, redacted bodies, `correlationId`, `code`, `retryAfterMs`.
- `types.ts` — `Path`, `RequestOf`, `ResponseOf` (`void` for an empty 2xx; JSON 200 and 201 are typed), `CallOptions`.
- `dates.ts` — iiko's UTC date format.

The public client is a factory, not a class: `createIikoClient` returns `{ transport, office, call }`. `call(path, ...)` is the typed escape hatch for deprecated operations that have no wrapper.

## Generated code

Generated files are never edited by hand. They are excluded from lint, format and coverage, and their behavior is covered by:

- `tests/operations.test.ts` — every active operation calls its documented path and body.
- `tests/api.test.ts` — the public export list is frozen in `tests/api.snapshot.txt`.
- `tests/types.test.ts` — unions, required fields, JSON 200/201 and `void` responses, per-operation type names.

## Design decisions

- [ADR-0001](adr/0001-merged-sdk.md): one package for Transport and Office.
- [ADR-0002](adr/0002-retry-policy.md): only HTTP 429 is retried.
- [ADR-0003](adr/0003-errors-and-results.md): typed errors are thrown, not returned.

## Known limits

- iiko rejects a POST that has a documented JSON body when the body is missing (`INVALID_BODY_JSON_FORMAT`, confirmed against production). A method whose body schema has no required top-level fields lets the caller omit the argument and sends `{}` instead; operations with no documented body send nothing.

- Unions are closed over today's variants: a new iiko variant is invisible to TypeScript until the spec is regenerated.
- Types describe structure, not business rules: numeric ranges, dependent fields and terminal-local dates are not validated at runtime.
- `src/generated/schema.ts` is about 2.4 MB; the shipped `dist/index.d.ts` is 2.58 MB and 67k
  lines. Each consumer loads it once per project; the package ships one declaration file shared by
  ESM and CJS. Measured cold `tsc` delta: ~0.12 s and ~50 MB with `skipLibCheck: true`. See
  [ADR-0004](adr/0004-declaration-size.md) for why service subpaths are deferred.
