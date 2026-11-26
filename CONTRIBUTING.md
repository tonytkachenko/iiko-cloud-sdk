# Contributing

## Setup

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test
```

## Before opening a pull request

- `pnpm format` and `pnpm lint` must be clean.
- `pnpm test` must stay above the 85% coverage thresholds.
- Never edit `src/generated/` or `src/transport/generated/` by hand. Run `pnpm spec:build` instead.
- Add a Changeset (`pnpm changeset`) for anything that changes published behaviour.
- Use Conventional Commits: `fix:` patch, `feat:` minor, `BREAKING CHANGE:` major.

## Adding an API operation

Operations come from the spec; no hand-written resource file is involved.

1. Refresh the spec: `pnpm spec:sync` (or replace `spec/raw.json` and run `pnpm spec:build`).
2. Run `pnpm spec:build`. A new active operation without a name entry fails the build.
3. Add the name to the naming table under `scripts/`, then rerun `pnpm spec:build`.
