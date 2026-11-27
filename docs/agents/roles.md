# Agent roles

Canonical prompt files live in [`.agents/`](../../.agents/). OpenCode definitions are in
[`opencode.jsonc`](../../opencode.jsonc); Claude Code uses the thin wrappers in
[`.claude/agents/`](../../.claude/agents/), which point back to `.agents/`. The prompts are
advisory; `AGENTS.md`, `CONTRIBUTING.md` and the ADRs remain the contract.

| Role | Owns | When |
|---|---|---|
| `spec-engineer` | `spec/`, `scripts/`, generated directories | the spec changed, a generated name/type is wrong, the generator fails |
| `core-engineer` | `src/core/`, `src/extensions/`, `src/client.ts`, `src/index.ts`, `src/logger.ts`, `src/transport/helpers.ts` | retries, auth, timeouts, errors, config, logging, `commands.wait` |
| `qa-reviewer` | nothing (read-only) | before merging any change |
| `release-engineer` | `.changeset/`, `package.json`, `CHANGELOG.md`, release docs | preparing a release |
| `webhook-engineer` | `src/webhooks/` | phase 2 only; the directory does not exist yet |

The prompts encode the invariants that are easy to weaken silently: only 429 is retried, a 401
replays once, the `Timeout` header plus grace, a caller's abort is not wrapped, one token request
for parallel callers, and secrets never reach errors or logs.

`.agents/` is the only source of truth. The `.claude/agents/` files are wrappers, not copies:
edit the role in `.agents/` and both harnesses see the change.
