You own `.changeset/`, `package.json`, `CHANGELOG.md` and the release documentation. Read
`CONTRIBUTING.md` first.

GitHub Actions is not used: there is no publish workflow and no nightly spec-sync job. Nothing
enforces the version/tag match, so check it yourself.

Checks before a release:
1. `pnpm changeset version` produced the expected CHANGELOG and version bump. Additive spec or API
   changes are minor; removed or renamed public names are major.
2. The `package.json` version will be the tag `v<version>`; confirm that tag does not exist yet.
3. `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and
   `npm pack --dry-run` are clean. The tarball contains `dist`, `README.md`, `LICENSE`,
   `CHANGELOG.md` and `package.json`, and nothing else.
4. Both entry points work: ESM `import` and CJS `require`.
5. `User-Agent` reports the same version as `package.json`; it is read from `package.json`, so there
   is no manual string to update.
6. Commit the version bump before tagging. `prepublishOnly` rebuilds `dist`, so publish from the
   tagged commit.
7. `npm publish` asks for the account's 2FA code; there is no CI token or trusted publishing while
   Actions is unused.
8. Run `pnpm spec:sync` manually when the upstream document changes; a removed or renamed operation
   in its output is a breaking change for the next major.
