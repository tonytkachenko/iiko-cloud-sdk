# Contributing

## Setup

```bash
pnpm install
pnpm spec:build
pnpm typecheck && pnpm lint && pnpm test
pnpm build
```

## Before opening a pull request

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` and `pnpm build` must be clean.
- Never edit `src/generated/`, `src/transport/generated/` or `src/office/generated/` by hand. Run `pnpm spec:build` instead.
- Add or rename public methods in `scripts/names/transport.json` or `scripts/names/office.json`, then regenerate. The generator fails on collisions, stale entries and unnamed active operations.
- The public API is frozen in `tests/api.snapshot.txt`. Update it only with `pnpm exec vitest run tests/api.test.ts -u` and review the diff; a removed or renamed name is a breaking change.
- Add a Changeset (`pnpm changeset`) for anything that changes published behaviour.
- Use Conventional Commits: `fix:` patch, `feat:` minor, `BREAKING CHANGE:` major.

## Updating the spec

1. `pnpm spec:sync` downloads `spec/raw.json`, normalizes it and regenerates types, wrappers and the manifest.
2. Check the generation diff and `src/generated/operations.ts`.
3. If a new active operation is unnamed, the generator names the path and stops; add its public name to the matching naming table.
4. `pnpm test` must pass; the spec-coverage test compares the generated list with `spec/raw.json`.
5. Commit `spec/raw.json` together with the regenerated files.

## Tests worth knowing

- `tests/operations.test.ts` calls every active operation and checks method, path and body.
- `tests/api.test.ts` freezes the export list; `tests/api.snapshot.txt` is the contract.
- `tests/retry.test.ts` pins the 429-only policy; widening it is an ADR-level decision.
- `tests/types.test.ts` checks unions, required fields and JSON 200/201 responses.
- `pnpm live:check` (manual, needs real keys) runs read-only calls against production.

## Release

1. `pnpm changeset version` bumps `package.json` and the changelog.
2. `pnpm test && pnpm build && npm pack --dry-run`.
3. Commit, tag `v<version>` and push the tag.
4. The publish workflow checks that the tag matches `package.json` and publishes.

The first release authenticates with the `NPM_TOKEN` secret. Once the package exists, configure npm trusted publishing for this repository and workflow; later releases can drop the token and use OIDC.
