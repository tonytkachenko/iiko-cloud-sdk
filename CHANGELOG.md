# Changelog

## 0.5.0

### Minor Changes

- a2c89cb: Handle `402 Payment Required` and `423 Locked` the way iiko documents, like `401`: map them to
  `IikoAuthError`, invalidate the token, fetch a new one and replay the request once. A second
  auth error propagates, and `403` still does not replay. See ADR-0005.
- f7484e6: Add typed iikoCloud webhook events: the 8 payload types from `x-webhooks` plus
  `UnsupportedWebhookEvent` for the three event names that the spec enum documents without a payload
  schema.

### Patch Changes

- 5d1e458: Generated JSDoc now includes the minimum iiko RMS version when the spec documents one, so methods
  such as `transport.dictionaries.tipsTypes` show that they require RMS 7.7.4 or newer.
- e870b2c: `call()` now sends `{}` when a documented body is optional and the caller omits it, matching the
  generated methods. Operations without a documented body still send nothing.
- e445042: `IikoCommandError` now exposes the command's `exception` payload from `commands.status`, alongside
  `reason`.
- ac54524: `commands.wait` now polls every 2 seconds instead of 500 ms and waits 120 seconds instead of 30 by
  default, matching iiko's recommended 2–5 s polling interval and the 1–2 minutes an order can spend
  before it settles. Pass `intervalMs` or `timeoutMs` to override.
- f49b7d3: `baseUrl` must now use `http:` or `https:`, and `timeoutSec` must be a positive integer both in the
  client options and per call. A fractional timeout no longer produces a non-integer `Timeout`
  header.
- f91ef93: `reserves.create` and `tableOrders.create` now type `customer` as the documented union of a
  `regular` and a `one-time` customer instead of `Omit<RegularCustomer, "type">`. Table order
  responses expose `customer.type` again, and the delivery customer, address and payment unions stay
  intact.
- 46e1d6b: The nested error envelope's `errorCode` is now used as `IikoError.code` when the flat `error` and
  `code` fields are absent. A response with only `errorCode`, `message` and `httpStatusCode` no
  longer loses its machine-readable code.
- ff2ef14: A per-call `timeoutSec` must now be a positive finite number, like the client option. Values such
  as `0`, `NaN` or `Infinity` throw a `TypeError` before any request is sent instead of producing a
  `Timeout: NaN` header and an immediately aborted request.
- f49b7d3: A request body that cannot be serialized to JSON now throws a `TypeError` with the cause instead of
  being reported as `IikoNetworkError`. Circular objects and `BigInt` values are caller errors, not
  network failures.

## 0.4.1

### Patch Changes

- 59b70a0: The package now ships `dist/index.d.cts` and points the `require` condition at it, so TypeScript
  projects on `module: node16` can import the SDK from CommonJS instead of failing with TS1479.

## 0.4.0

### Minor Changes

- 9ab2ef8: Abort now cancels a pending 429 backoff immediately instead of waiting for the delay to elapse.

  Token endpoint failures keep their typed error: a 429 is retried like any other request, 5xx,
  network and timeout failures are no longer reported as `IikoAuthError`, and a 401 from the token
  endpoint no longer triggers an API 401 replay. A token response without a token is still an
  `IikoAuthError`.

  `call()` now requires a body for operations whose schema has a required field.
  `transport.organizations.getById` returns only the organization whose id matches, and `baseUrl`
  rejects a query string.

### Patch Changes

- 2280fb1: The token request now uses the call's `timeoutSec`. A short-lived token gets a proportional
  refresh margin, and a token whose `exp` is already past is cached for 30 s so clock skew does not
  cause a token request on every call.

  `commands.wait` cancels the sleep between polls with the caller's signal and rejects a non-positive
  `intervalMs` or a negative `timeoutMs`.

  A generated operation that collides with a hand-written helper now fails fast instead of being
  silently shadowed. `prepublishOnly` builds the package before a manual publish, and the README
  documents that debug bodies are redacted for credentials, not customer data.

- 7855d6e: Debug logs and `IikoError` bodies now redact credential-shaped keys such as `authToken` and
  `credential`; the rule matches key suffixes instead of a fixed list of names.

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
