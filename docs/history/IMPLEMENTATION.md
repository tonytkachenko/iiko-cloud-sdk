> **Исторический документ.** Описывает Transport-only версию на `openapi-fetch`. Заменён `docs/PLAN.md`.

# Implementation plan — `@toniq/iiko-cloud-sdk`

Source of requirements: `SPECS.md` (v1.0.0 scope). This plan is the execution order, not a re-statement of the spec.

**Status:** P0–P9 done. 45 tests, 98.1% statements / 99.4% lines. Live smoke run against production with real credentials, read-only.
**Spec snapshot:** `iikoTransport` **9.9.4.2**, 417 paths, 1095 schemas, verified against `api-ru.iiko.services` on 2026-11-23.

## Locked decisions

| Area | Decision |
|---|---|
| Package | `@toniq/iiko-cloud-sdk`, unpublished for now |
| Modules | `organizations`, `terminals`, `menu` — nothing else |
| Module format | ESM only, `"type": "module"`, no `require` condition |
| TypeScript | `^6.0.3` — TS 7 is current but cannot run `openapi-typescript` (see below) |
| Node | `>=22.12`, CI matrix 22 + 24 |
| Package manager | pnpm 12 (`packageManager` pin + committed `pnpm-lock.yaml`) |
| Build | one `tsc` pass with declaration emit |
| Tests | Vitest 5, 85% thresholds, generated files excluded |
| Lint / format | oxlint + oxfmt (no eslint config) |
| Release | Changesets, no publish job yet |
| License | MIT (assumed) |

## Deviations from SPECS.md

| Spec | Spec says | We do | Why |
|---|---|---|---|
| §3 | TS 6.x | TS 6.0.3 | kept: TS 7 no longer exposes `ts.factory`, which `openapi-typescript` needs |
| §6.1 | Node 20 + 22 | 22.12 + 24 | Node 20 reached EOL April 2026 |
| §6.1, §11.10 | CJS via `exports`/`main` | ESM only | Node 20.19+/22.12+ `require()` ESM; no consumers yet, so CJS can be added later as a minor |
| §8 | `eslint.config.js` | `.oxlintrc.json` + `.oxfmtrc.json` | oxlint and oxfmt are the chosen tools |
| §4.6 | delivery + payments "after confirming" | omitted | only 3 modules in 1.0.0 |
| §9.8 | publish on release tags | job omitted | package is not published |

## Facts verified against the live spec

- `GET https://api-ru.iiko.services/api-docs/docs` returns OpenAPI **3.0.4 JSON, 417 paths, 1095 schemas, iikoTransport 9.9.4.2** — the `iiko:download` script works as written. Regenerating from the committed document reproduces `schema.ts` byte for byte.
- `POST /api/v2/access_token` returns `{ correlationId, token }` — **no expiry field**, so proactive refresh must read the JWT `exp` claim locally.
- `GET /api/1/organizations` returns a simple list; `POST /api/1/organizations` accepts `{ organizationIds, ... }` → use for `getById`.
- `POST /api/1/terminal_groups` with `{ organizationIds }` (it is a POST, not a GET).
- `POST /api/2/menu/by_id` with `{ externalMenuId, organizationIds, priceCategoryId?, version?, language?, asyncMode?, startRevision? }`. `POST /api/2/menu` exists but takes no body — ignore it.
- Every operation also accepts an iiko-side `Timeout` header (seconds). We rely on the client-side timeout instead.
- The spec marks `Authorization` as **required** on every operation, so `openapi-fetch` demands a header parameter. Calls pass an empty placeholder (`AUTH_PARAMS`), which the fetch wrapper overwrites with the real bearer token.
- `openapi-typescript@7` imports `typescript`'s `ts.factory`; the TS 7 native compiler does not provide it. Hence TS 6.0.3, and the generated file is `schema.ts` (not `.d.ts`) so `tsc` emits declarations into `dist/`.
- Live run against production (read-only): 13 organizations, 1 terminal group, and a deliberately bogus menu id returned `400 EXTERNAL_MENU_DATA_MISSED` with a real `correlationId` — confirming that iiko's `error` field is an error code and that error mapping works outside fixtures.

## Architecture

```
createIikoClient(options)
  ├─ config.ts     validate + defaults (baseUrl, timeoutMs 15000, maxRetries 2)
  ├─ logger.ts     ILogger + noop implementation (logging off by default)
  ├─ errors.ts     IikoError hierarchy + redaction + factories
  ├─ auth.ts       token cache, single-flight, JWT exp, 401 invalidation
  ├─ http.ts       fetch wrapper (timeout/retry) + request() error mapping
  └─ resources/*   thin typed methods over the openapi-fetch client
```

### Design calls that resolve spec contradictions

1. **No throwing.** §4.3 and the §5 example require `{ data, error }`; §4.4 says "throw". We keep the `openapi-fetch` shape and make `error` **always** an `IikoError` instance. Nothing throws except invalid options / programmer error. This satisfies both sections with one behaviour.
2. **Timeout + retry live in one injected `fetch`**, not in `openapi-fetch` (it has neither). `createClient<paths>({ baseUrl, fetch: wrappedFetch })`.
3. **Error mapping lives in `HttpClient.request()`**, because the wrapper must return a `Response` after retries. `request()` awaits the `openapi-fetch` call, and on `error` replaces it with the typed class built from `response.status`, body and headers.
4. **401 handling is a separate single retry** in `request()`, outside the `maxRetries` budget: invalidate token → `auth.getToken()` → replay once.
5. **Secret safety by construction**: the only credentials ever placed in a body are in `auth.ts`; the logger and error factories only accept sanitized metadata. `requestBody`/`responseBody` on errors are passed through `redact()`.

## Phases

### P0 — scaffold
Files: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `.oxlintrc.json`, `.oxfmtrc.json`, `.gitignore`, `.changeset/config.json`.

Details:
- `package.json`: `type: module`, `engines.node: ">=22.12"`, `packageManager: "pnpm@12.15.0"`, `exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } }`, `files: ["dist"]`, `sideEffects: false`. `pnpm-lock.yaml` is committed.
- Scripts: `build`, `typecheck` (`tsc --noEmit`), `lint`, `format`, `format:check`, `test` (`vitest run --coverage`), `iiko:download`, `iiko:types`, `iiko:sync`, `changeset`.
- `tsconfig.json`: `target ES2022`, `module`/`moduleResolution` `NodeNext`, `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `declaration` + `declarationMap` + `sourceMap`, `rootDir src`, `outDir dist`, `skipLibCheck` (the 2.7 MB spec).
- Dependencies: runtime `openapi-fetch` only. Dev: `typescript`, `openapi-typescript`, `vitest`, `@vitest/coverage-v8`, `oxlint`, `oxfmt`, `@types/node`, `@changesets/cli`.
- Relative imports use `.js` extensions (NodeNext requirement).

Done when: `pnpm typecheck`, `pnpm lint` and `pnpm test` pass on an empty `src/index.ts`.

### P1 — spec sync
- `pnpm iiko:sync` → `src/generated/openapi.json` (2.7 MB, committed) + `src/generated/schema.ts` (committed, excluded from lint/format/coverage). A `.ts` file, not `.d.ts`, so declarations land in `dist/`.
- Add a header comment to `schema.d.ts`'s output path only via README note — files are never hand-edited.

Done when: `paths` type exists and `src/index.ts` compiles against it.

### P2 — errors
File: `src/errors.ts`
- 7 classes per §4.4, all extending `IikoError` with the required fields (`status`, `code`, `correlationId`, `endpoint`, `method`, `requestBody`, `responseBody`, `retryAfterMs`).
- `redact(value)` replaces `appId` / `clientSecret` / `apiKey` / `Authorization` / any `Bearer …` with `"[redacted]"`, recursive over plain objects and arrays.
- Factories: `fromResponse()` (status → class, `Retry-After` → `retryAfterMs`, `correlationId` from body) and `fromFetchError()` (AbortError → timeout → `IikoTimeoutError`, else `IikoNetworkError`).
- `Error.captureStackTrace` kept; message never includes credentials.

Done when: `tests/errors.test.ts` proves status → class mapping and that a body containing all three secrets comes back redacted.

### P3 — config + logger
Files: `src/config.ts`, `src/logger.ts`
- Validate non-empty strings, numeric defaults, `baseUrl` with trailing slash trimmed.
- `ILogger` per §6.4 + `noopLogger`.
- `logger.debug` gets method, path (query stripped of token-ish keys), status, `correlationId`, duration. Bodies only when `debug: true`.

Done when: factory rejects a missing `apiKey` with a message that does not echo the other secrets.

### P4 — http
File: `src/http.ts`
- `wrappedFetch`: per-request `AbortController` + `AbortSignal.any([options.signal, timeout])`; retry on network error and `408/429/500/502/503/504`; idempotent-only by default (`GET/PUT/DELETE`), `POST` opt-in per call; `Retry-After` (seconds or HTTP date) honoured on `429`; exponential backoff 500 ms → 1 s → 2 s with jitter.
- `HttpClient.request(call)` → `{ data, error }`, error mapped, 401 → refresh + replay once.
- Also emits the `Authorization` header lazily per attempt (a retry after refresh must use the new token).
- POST opt-in for retries is the `x-iiko-retry: true` header; the wrapper strips it before sending. Note: bodies are buffered once so a retry can rebuild the single-use `Request`.

Done when: `tests/retry.test.ts` covers each retriable status, `Retry-After`, network error, timeout via fake timers, and a `POST` that is not retried.

### P5 — auth
File: `src/auth.ts`
- `getToken()` returns the cached token; single-flight via a shared promise; proactive refresh when `exp*1000 - 60_000 <= now` (base64url JWT payload decode, no verification).
- `invalidate()` clears the cache; called by `HttpClient` on 401.
- Token request: plain `fetch` POST `{ appId, clientSecret, apiKey }`, its own timeout, `IikoAuthError` on failure/invalid body.
- `TokenStore` interface: **skipped** — spec marks it optional, in-memory only.

Done when: `tests/auth.test.ts` proves one token call for N parallel requests, cache reuse, and refresh after 401.

### P6 — resources
Files: `src/resources/organizations.ts`, `terminals.ts`, `menu.ts`
- `organizations.list()` → `GET /api/1/organizations`
- `organizations.getById(id)` → `POST /api/1/organizations` `{ organizationIds: [id] }`, returns the single match or `undefined`
- `terminals.list(organizationId)` → `POST /api/1/terminal_groups` `{ organizationIds: [organizationId] }`
- `menu.getExternalMenu(organizationId, externalMenuId, opts?)` → `POST /api/2/menu/by_id` (POST → retries off by default)
- Each method: typed result from generated types, JSDoc with params + thrown-vs-returned errors note.

Done when: `tests/client.test.ts` asserts the URL, method and body each resource sends through a fake `fetch`.

### P7 — client + entrypoint
Files: `src/client.ts`, `src/index.ts`
- `createIikoClient(options)` → `{ organizations, terminals, menu }`, typed as `IikoClient`.
- `src/index.ts` re-exports exactly §5's list plus `ILogger` and the client options type. Nothing internal, no generated types.

Done when: ESM import and Node `require()` both return the same object shape (smoke test below).

### P8 — tests
`tests/helpers/fakeFetch.ts` (scripted responses + recorded requests), then the matrix:

| Spec §7 requirement | File |
|---|---|
| token acquire / reuse / 401 refresh / parallel single-flight / header | `auth.test.ts` |
| 400, 401, 403, 404, 409, 429, 500, 502, 503 | `errors.test.ts` |
| retries, `Retry-After`, timeout, AbortSignal | `retry.test.ts` |
| secrets absent from errors/logs | `errors.test.ts` |
| public method types | `client.test.ts` (type-level assertions) |
| ESM + CJS import | CI step in `.github/workflows/ci.yml` (two `node -e` runs against `dist`) |

Coverage thresholds on `src/**` excluding `src/generated/**`.

### P9 — docs, examples, CI
- `README.md` (disclaimer first, install, quick start, auth, errors, env vars, spec update, license, contributing), `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`, `SECURITY.md`, `examples/basic.ts`, `docs/README.md` (pointer or copy).
- `scripts/live-check.mjs` (`pnpm live:check`) — read-only smoke test against the live API; reads the three credentials from environment variables and prints no secrets.
- `.github/workflows/ci.yml`: `pnpm/action-setup` → `pnpm install --frozen-lockfile` → lint → format check → typecheck → test (22, 24) → build → interop smoke → `pnpm audit` → spec diff (`pnpm iiko:sync` then `git diff --exit-code src/generated`).
- No publish job.

Done when: CI is green on a fresh clone and `node -e "require('./dist/index.js')"` works.

## Acceptance criteria mapping

| §11 | Covered by |
|---|---|
| 1 installs | P0 |
| 2 client works | P7 |
| 3 token cached | P5, P8 |
| 4 Authorization header | P4, P8 |
| 5 expiry → refresh → replay | P4, P5, P8 |
| 6 typed errors | P2, P8 |
| 7 no secrets in logs/errors | P2, P3, P8 |
| 8 types from OpenAPI | P1 |
| 9 tests in CI | P9 |
| 10 ESM + CJS | **deviation** — ESM-only, `require()` interop smoke instead |
| 11 README example | P9 |
| 12 automated publish | **deviation** — deferred, not published |

## Risks / open

- **2.7 MB spec in git.** Every sync adds a large diff. Acceptable; the CI diff job is the only drift guard.
- **POST retries.** iiko orders are POST; retrying them risks duplicates. Default stays off; callers opt in per call.
- **`exp` decode assumes a JWT.** If iiko ever returns an opaque token, proactive refresh silently degrades to on-401 refresh. One `shortcut:` comment covers it.
- **`error` vs `throw`.** Consumers expecting a throw must check `error`. README states it explicitly.
- **TS 7 is unusable with the generator.** `openapi-typescript` needs `ts.factory`. We pin TS 6.0.3; revisit when the generator supports the native compiler.
- **License** assumed MIT; change before the first publish.
