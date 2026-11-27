---
"iiko-cloud-sdk": patch
---

`commands.wait` now polls every 2 seconds instead of 500 ms and waits 120 seconds instead of 30 by
default, matching iiko's recommended 2–5 s polling interval and the 1–2 minutes an order can spend
before it settles. Pass `intervalMs` or `timeoutMs` to override.
