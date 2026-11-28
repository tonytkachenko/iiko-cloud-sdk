---
"iiko-cloud-sdk": patch
---

A request body that cannot be serialized to JSON now throws a `TypeError` with the cause instead of
being reported as `IikoNetworkError`. Circular objects and `BigInt` values are caller errors, not
network failures.
