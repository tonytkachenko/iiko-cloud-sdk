# ADR-0001: One package for Transport and Office

## Context

Two prototypes existed:

- a Transport-only SDK on `openapi-fetch`, 126 operations, curated names, release plumbing;
- a generated SDK on raw `fetch`, 360 operations across both services, normalized unions, named per-operation types and strong per-operation tests.

Maintaining both means two naming contracts, two runtimes and two release processes. The APIs share one host and one token endpoint but differ in error envelopes and vocabulary.

## Decision

Ship one package, `iiko-cloud-sdk`, with two explicit service surfaces:

- `iiko.transport.*` — 126 active iikoTransport operations;
- `iiko.office.*` — 234 active iikoOffice operations.

Names are curated for Transport and derived from paths (with overrides) for Office. Office uses one extra level for subresources (`office.inventory.incomingInvoice.create`) so 107 inventory operations do not collapse into one object. Deprecated operations have no wrappers; `iiko.call(path, ...)` reaches them by typed path.

## Consequences

- One runtime, one spec pipeline, one release.
- Service namespaces avoid collisions (`organizations` exists in both APIs) and keep the error-envelope difference visible.
- Office naming is a public contract too: `scripts/names/office.json` and the API snapshot freeze it.
- The package covers roughly three times the surface of the Transport draft, so the snapshot and per-operation tests are mandatory before release.
