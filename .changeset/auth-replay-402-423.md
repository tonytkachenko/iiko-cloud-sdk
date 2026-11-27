---
"iiko-cloud-sdk": minor
---

Handle `402 Payment Required` and `423 Locked` the way iiko documents, like `401`: map them to
`IikoAuthError`, invalidate the token, fetch a new one and replay the request once. A second
auth error propagates, and `403` still does not replay. See ADR-0005.
