---
"iiko-cloud-sdk": patch
---

Debug logs and `IikoError` bodies now redact credential-shaped keys such as `authToken` and
`credential`; the rule matches key suffixes instead of a fixed list of names.
