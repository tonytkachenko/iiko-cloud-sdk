---
"iiko-cloud-sdk": patch
---

A per-call `timeoutSec` must now be a positive finite number, like the client option. Values such
as `0`, `NaN` or `Infinity` throw a `TypeError` before any request is sent instead of producing a
`Timeout: NaN` header and an immediately aborted request.
