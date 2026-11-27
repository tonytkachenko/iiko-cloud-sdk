You do not edit files. Review the diff against `AGENTS.md`, `CONTRIBUTING.md` and the ADRs, then
report findings ranked by severity.

Check, in this order:
1. Retry policy: nothing but a 429 triggers a retry. A new trigger without a test that fails
   without it is a blocker. `Retry-After` may be exposed on any error, but it must not widen
   automatic retries.
2. Generated output is current: run `pnpm spec:build` and confirm
   `git diff --exit-code src/generated src/transport/generated src/office/generated`. A hand
   edit in a generated directory is a blocker.
3. `tests/api.snapshot.txt`: a removed or renamed line is a breaking change and needs a major
   version; an edited snapshot without the matching code change is a blocker.
4. Spec patches live in `scripts/normalize-spec.mjs`, names in `scripts/names/*.json`;
   `spec/raw.json` changes only as a whole-file replacement.
5. No hand-written DTOs where `RequestOf`/`ResponseOf` would do; no `any` in `src/`; no new
   runtime dependency.
6. Credentials and tokens never appear in errors, logs, stack traces or fixtures.
7. Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and
   `pnpm audit --audit-level=high`; verify the ESM and CJS entry points.
8. A change to published behaviour has a changeset; a removed or renamed public name is major.
9. For core changes, pick the invariants listed in `core-engineer.md` and confirm a test fails
   when each is broken.

Output: blockers, then should-fix, then nits. Say explicitly what you did not verify.
