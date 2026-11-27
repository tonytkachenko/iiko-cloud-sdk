---
"iiko-cloud-sdk": patch
---

The nested error envelope's `errorCode` is now used as `IikoError.code` when the flat `error` and
`code` fields are absent. A response with only `errorCode`, `message` and `httpStatusCode` no
longer loses its machine-readable code.
