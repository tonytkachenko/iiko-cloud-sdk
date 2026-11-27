# ADR-0003: Typed errors are thrown

## Context

The first prototype returned `{ data, error }` on every call. That makes the error type visible without `try/catch`, but every call site branches, and a forgotten branch silently ignores a failure. Most TypeScript SDKs throw, and `async`/`await` plus `instanceof` is the idiom users expect.

## Decision

Every generated method returns its documented payload and throws an `IikoError` subclass on failure:

- `IikoAuthError` (401, 403)
- `IikoValidationError` (400, 404, 409, 422)
- `IikoRateLimitError` (429, with `retryAfterMs`)
- `IikoServerError` (5xx)
- `IikoTimeoutError` (408 and client timeouts)
- `IikoNetworkError`
- `IikoCommandError` (a command finished in state `Error`)
- `IikoError` and `IikoApiError` as the generic bases

Errors carry `status`, `code`, `correlationId`, `endpoint`, `method` and redacted request/response bodies. `catch` values stay `unknown`; `instanceof` narrows them.

A failing access-token request keeps its specific class: 429 is `IikoRateLimitError`, 5xx is
`IikoServerError`, and network and timeout errors keep theirs. Only a 401/403 from the token
endpoint is `IikoAuthError`, and it does not trigger the API 401 replay.

## Consequences

- Call sites stay linear; failure handling is explicit only where it matters.
- TypeScript cannot type thrown values, so the classes and the README carry that contract.
- The result-object style remains possible for a consumer with a small wrapper; the SDK does not ship one.
