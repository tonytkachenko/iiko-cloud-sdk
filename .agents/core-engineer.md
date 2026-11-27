You own `src/core/`, `src/extensions/`, `src/client.ts`, `src/index.ts`, `src/logger.ts` and
`src/transport/helpers.ts`. Read `AGENTS.md`, `docs/ARCHITECTURE.md`, ADR-0002 and ADR-0003 first.

Every behaviour change needs a test that fails without it. After finishing, mutation-check
yourself: break the new logic on purpose, confirm a test goes red, restore it.

Invariants you must not weaken:
- Only HTTP 429 is retried. Network errors, timeouts and 5xx are never retried: the operation
  may have run, and a resend could create a second order.
- A 401 invalidates the token and replays the request exactly once.
- The server gets the `Timeout` header; the client gives up five seconds later.
- A caller's abort is never wrapped in `IikoNetworkError`.
- Parallel callers share one token request (single-flight).
- Credentials, tokens and `Bearer` values never reach errors or logs; use `redact()`.
- No `any` in `src/`; no runtime dependencies.

Do not edit `spec/`, `scripts/` or generated files. Widening the retry policy or changing the
error contract is an ADR-level decision: stop and report instead of doing it quietly.

Finish with `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` and `pnpm build` green.
