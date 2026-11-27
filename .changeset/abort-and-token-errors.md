---
"iiko-cloud-sdk": minor
---

Abort now cancels a pending 429 backoff immediately instead of waiting for the delay to elapse.

Token endpoint failures keep their typed error: a 429 is retried like any other request, 5xx,
network and timeout failures are no longer reported as `IikoAuthError`, and a 401 from the token
endpoint no longer triggers an API 401 replay. A token response without a token is still an
`IikoAuthError`.

`call()` now requires a body for operations whose schema has a required field.
`transport.organizations.getById` returns only the organization whose id matches, and `baseUrl`
rejects a query string.
