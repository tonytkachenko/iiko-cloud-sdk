# Changelog

## 0.3.0

### Minor Changes

- 631b1e9: Allow omitting a request body whose schema has no required top-level fields. The client sends `{}` instead, so iiko still receives a JSON body.
- 4099ab7: Expose `Retry-After` as `retryAfterMs` on every error response, not only 429. Automatic retries remain limited to 429.
- **Naming:** loyalty mutations are verb-first and their types follow the method (`addCustomerCategory` / `LoyaltyAddCustomerCategoryParams`, `holdCustomerWallet`, ...); queries remain noun-first (`customerInfo`, `customerCategories`). The package is not published yet, so no consumer migration is needed.

### Patch Changes

- f9ae9ad: Type JSON 201 responses instead of resolving them to `unknown`; 25 Office create operations now return their documented payload.
- 0b99800: Report the package version in `User-Agent` from `package.json` instead of a hardcoded string.

## 0.2.0

First released version. Not published yet at the time of this entry.

- 360 active operations: 126 Transport (`iiko.transport.*`) and 234 Office (`iiko.office.*`), generated from the committed OpenAPI document.
- Named request and response types per operation; discriminated unions for payments, customers, order items and command status.
- Runtime on native `fetch`, zero runtime dependencies. ESM and CommonJS builds.
- JWT auth with a single-flight cache, five-minute refresh margin and 401 replay.
- Retries only on HTTP 429 with `Retry-After` and jittered backoff; 5xx, network errors and timeouts are never retried.
- Server-side `Timeout` header, `User-Agent`, `onAttempt` hook and redacted debug logging.
- Typed errors with `status`, `code`, `correlationId` and `retryAfterMs`.
- `commands.wait`, UTC date helpers and a path-typed `iiko.call` escape hatch for deprecated operations.
- API snapshot, per-operation tests and spec-coverage checks in CI.
