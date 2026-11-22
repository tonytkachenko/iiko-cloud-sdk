# Changelog

## Unreleased

First implementation, not yet published.

- `createIikoClient` with `organizations`, `terminals` and `menu` resources.
- JWT handling: in-memory cache, single-flight, proactive refresh, one replay on `401`.
- Typed error hierarchy with credential redaction and `correlationId` passthrough.
- Timeout, retry with backoff, `Retry-After` support and `AbortSignal` cancellation.
- OpenAPI types generated from the live iikoCloud specification.
