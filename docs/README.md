# Documentation

- [PLAN.md](PLAN.md) — delivery plan and fixed decisions.
- [ARCHITECTURE.md](ARCHITECTURE.md) — spec pipeline, runtime and generated code.
- [adr/](adr/) — decisions that shaped the SDK:
  - [0001](adr/0001-merged-sdk.md) — one package for Transport and Office;
  - [0002](adr/0002-retry-policy.md) — only HTTP 429 is retried;
  - [0003](adr/0003-errors-and-results.md) — typed errors are thrown;
  - [0004](adr/0004-declaration-size.md) — one declaration file, service subpaths deferred.
- [history/](history/) — superseded plans: the original specification, the Transport-only implementation plan and the Transport-only delivery plan.
- [agents/](agents/) — issue tracker, triage labels, domain-doc rules and [agent roles](agents/roles.md); canonical prompts live in `.agents/`, OpenCode config in `opencode.jsonc`.
