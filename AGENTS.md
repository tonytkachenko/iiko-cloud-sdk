## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, driven with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Agent roles

Canonical prompts live in `.agents/`; OpenCode definitions are in `opencode.jsonc`, Claude Code
uses the wrappers in `.claude/agents/`. Roles: spec-engineer, core-engineer, qa-reviewer,
release-engineer and webhook-engineer (phase 2). See `docs/agents/roles.md`.
