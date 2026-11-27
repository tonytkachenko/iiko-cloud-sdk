---
"iiko-cloud-sdk": minor
---

Allow omitting a request body whose schema has no required top-level fields. The client sends `{}` instead, so iiko still receives a JSON body.
