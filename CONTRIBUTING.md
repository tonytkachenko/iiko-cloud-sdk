# Contributing

## Setup

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test
```

## Before opening a pull request

- `pnpm format` and `pnpm lint` must be clean.
- `pnpm test` must stay above the 85% coverage thresholds.
- Never edit `src/generated/` by hand. Run `pnpm iiko:sync` instead.
- Add a Changeset (`pnpm changeset`) for anything that changes published behaviour.
- Use Conventional Commits: `fix:` patch, `feat:` minor, `BREAKING CHANGE:` major.

## Adding an API operation

1. Confirm the operation in the live spec: `pnpm iiko:sync`.
2. Add the method to the matching resource in `src/resources/`, typed from the generated `paths`.
3. Add a test in `tests/` asserting method, path and body.
4. Document parameters and that errors are returned, not thrown.

Do not add endpoints "just in case" — every method needs a use case.
