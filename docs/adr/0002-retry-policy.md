# ADR-0002: Only HTTP 429 is retried

## Context

Every iikoCloud operation is a POST. Retrying a write after a network error, a timeout or a 5xx can create a second order or repeat a command: the server may have executed the first request and failed only on the response.

HTTP 429 is different: the rate limiter refuses the request before the operation runs, so resending is safe for reads and writes alike.

## Decision

Retry only HTTP 429. Use `Retry-After` when present (delta seconds or an HTTP date), otherwise exponential backoff from `retryBaseMs` with jitter. Three retries by default. Never retry 5xx, network errors or timeouts. A 401 is not a retry: the token is invalidated and the request is replayed once, because a 401 means the request was not processed.

Timeouts use iiko's own `Timeout` header (15 seconds by default) plus a five-second client grace, so the server stops the operation instead of leaving it running after the client gives up.

## Alternatives rejected

- **Retry 5xx and network errors.** Cheaper to implement, but unsafe for order and command creation.
- **Retry only idempotent methods.** iikoCloud has no idempotent methods: all active operations are POST.
- **No retries at all.** Safe but wasteful: rate limiting is the one failure that is guaranteed not to have executed anything.

## Consequences

- A transient 5xx on a read is not retried by the SDK; the caller decides.
- The policy lives in `retryDelay` in `src/core/transport.ts`, and `tests/retry.test.ts` fails if it widens.
