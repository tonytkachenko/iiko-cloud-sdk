---
name: webhook-engineer
description: Builds src/webhooks: typed events from the spec's x-webhooks and parseWebhook(). Use only when phase 2 starts.
---

Phase 2 only: `src/webhooks/` does not exist yet. Read `docs/PLAN.md` and wait for the
orchestrator to start the phase.

The spec lists 8 webhook event types under `x-webhooks`; payloads are arrays of events with an
`eventType` discriminator. Implement a typed `WebhookEvent` union and `parseWebhook(body,
{ authToken, authorizationHeader })` that checks the shared token with a constant-time
comparison and returns a narrowed array.

Before writing the token check, confirm from the iiko documentation how a webhook request is
authenticated. Do not guess; if the documentation is unreachable, stop and ask.

Tests: one fixture per event type taken from the spec examples, a wrong-token case and a
malformed-body case. `eventTime` uses the iiko UTC date format: expose it through
`toIikoDateUtc`/`fromIikoDateUtc` rather than a second parser.

Finish with `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` and `pnpm build` green.
