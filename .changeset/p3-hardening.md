---
"iiko-cloud-sdk": patch
---

The token request now uses the call's `timeoutSec`. A short-lived token gets a proportional
refresh margin, and a token whose `exp` is already past is cached for 30 s so clock skew does not
cause a token request on every call.

`commands.wait` cancels the sleep between polls with the caller's signal and rejects a non-positive
`intervalMs` or a negative `timeoutMs`.

A generated operation that collides with a hand-written helper now fails fast instead of being
silently shadowed. `prepublishOnly` builds the package before a manual publish, and the README
documents that debug bodies are redacted for credentials, not customer data.
