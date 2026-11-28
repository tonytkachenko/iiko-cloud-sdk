---
"iiko-cloud-sdk": patch
---

`baseUrl` must now use `http:` or `https:`, and `timeoutSec` must be a positive integer both in the
client options and per call. A fractional timeout no longer produces a non-integer `Timeout`
header.
