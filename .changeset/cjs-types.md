---
"iiko-cloud-sdk": patch
---

The package now ships `dist/index.d.cts` and points the `require` condition at it, so TypeScript
projects on `module: node16` can import the SDK from CommonJS instead of failing with TS1479.
