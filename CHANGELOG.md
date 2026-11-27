# Changelog

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
