---
"iiko-cloud-sdk": patch
---

`call()` now sends `{}` when a documented body is optional and the caller omits it, matching the
generated methods. Operations without a documented body still send nothing.
