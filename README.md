# iiko-cloud-sdk

[![npm version](https://img.shields.io/npm/v/iiko-cloud-sdk.svg)](https://www.npmjs.com/package/iiko-cloud-sdk)

Unofficial TypeScript SDK for the iikoCloud API (`https://api-ru.iiko.services`).
**Not affiliated with iiko.** It wraps the public iikoCloud Transport and Office APIs, generated from the official OpenAPI document.

- 360 active operations: 126 Transport, 234 Office.
- Typed requests and responses, including discriminated unions for payments, customers and order items.
- JWT auth with a single-flight token cache, 401 replay, 429 retries and typed errors.
- Zero runtime dependencies. ESM and CommonJS. Node.js 22.12+.

## Install

```bash
npm install iiko-cloud-sdk
# or: pnpm add iiko-cloud-sdk
```

## Quick start

```ts
import { createIikoClient, IikoError, IikoRateLimitError } from "iiko-cloud-sdk";

const iiko = createIikoClient({
  appId: process.env.IIKO_APP_ID!,
  clientSecret: process.env.IIKO_CLIENT_SECRET!,
  apiKey: process.env.IIKO_API_KEY!,
});

try {
  const { organizations } = await iiko.transport.organizations.list();

  const { correlationId } = await iiko.transport.deliveries.create({
    organizationId: organizations[0]!.id,
    terminalGroupId: "terminal-group-id",
    order: {
      phone: "+10000000000",
      orderServiceType: "DeliveryByCourier",
      items: [{ type: "Product", productId: "product-id", price: 450, amount: 1 }],
    },
  });

  // Many mutations are commands: wait until the front has processed them.
  await iiko.transport.commands.wait({
    organizationId: organizations[0]!.id,
    correlationId,
  });

  // Office API, same client:
  const { products } = await iiko.office.nomenclature.product.listV2({ limit: 100 });
} catch (error) {
  if (error instanceof IikoRateLimitError) {
    console.error("rate limited, retry after", error.retryAfterMs);
  } else if (error instanceof IikoError) {
    console.error(error.name, error.status, error.message, error.correlationId);
  }
}
```

## Client options

| Option | Default | Meaning |
|---|---|---|
| `appId`, `clientSecret`, `apiKey` | required | iiko app credentials and the organization API key |
| `baseUrl` | `https://api-ru.iiko.services` | API host; a query string is rejected |
| `timeoutSec` | `15` | Sent as the `Timeout` header; the client waits five seconds longer |
| `retries` | `3` | Retries for HTTP 429 only |
| `retryBaseMs` | `1000` | First backoff delay; doubled with jitter |
| `fetch` | global `fetch` | Custom fetch for tests or proxies |
| `logger`, `debug` | off, `false` | Debug logging; bodies are redacted for credentials only |
| `userAgent` | `iiko-cloud-sdk/<version>` | Override the User-Agent |
| `onAttempt` | — | Called after every HTTP attempt: path, attempt, status, duration, correlationId, error |

Credentials are kept in memory and never logged. Debug output and error bodies pass through `redact()`, which removes keys ending in `token`, `secret`, `password`, `credential`, `authorization`, `apiKey`, `apiLogin` or `appId`, and any `Bearer` value. It does not remove customer data: names, phones and addresses remain in debug bodies, so do not enable `debug` in production without a data policy. Use `onAttempt` for metadata without bodies.

## Errors

Errors are thrown, not returned. Every error has `status`, `code`, `correlationId`, `endpoint` and `retryAfterMs` where applicable.

| Class | When |
|---|---|
| `IikoAuthError` | 401 or 403 from the API or the token endpoint |
| `IikoValidationError` | 400, 404, 409, 422 |
| `IikoRateLimitError` | 429, with `retryAfterMs` |
| `IikoServerError` | 5xx |
| `IikoTimeoutError` | 408 and client timeouts |
| `IikoNetworkError` | fetch failed |
| `IikoCommandError` | `commands.wait` saw state `Error` |
| `IikoApiError`, `IikoError` | generic bases |

A token request that fails with 429, 5xx, a network error or a timeout keeps that class; only
401/403 from the token endpoint are `IikoAuthError`.

`organizations.settings` answers 500 when `parameters` is empty, even though the spec marks it
optional; pass at least one parameter, such as `["Name"]`.

## Retries and timeouts

- Only HTTP 429 is retried, for reads and writes alike: the limiter refuses the request before it runs.
- Token requests follow the same policy: a 429 is retried; 5xx, network errors and timeouts are not.
- `Retry-After` is honoured as seconds or an HTTP date for 429 retries; the parsed value is exposed as `retryAfterMs` on any error response.
- 5xx, network errors and timeouts are never retried: the operation may have run.
- 401 invalidates the token and replays once. A 401 from the token endpoint is not replayed.
- Aborting the caller's signal cancels a pending 429 backoff immediately.
- Timeouts use iiko's `Timeout` header; the client gives up five seconds later.

## Commands

Many mutations return a `correlationId` before the front has processed them. `commands.wait` polls
`commands.status` until `Success`:

```ts
await iiko.transport.commands.wait(
  { organizationId, correlationId },
  { timeoutMs: 60_000, intervalMs: 500, signal },
);
```

It throws `IikoCommandError` on state `Error` and `IikoTimeoutError` at the deadline. A failed
`status` call passes through as its typed error: an unknown `correlationId` is a 410
`PASSED_COMMAND_NOT_FOUND` (`IikoApiError`). The default deadline is 30 s and the polling interval
is 500 ms; `intervalMs` must be positive and `timeoutMs` non-negative. The caller's signal cancels
the wait, including the sleep between polls.

## Types

Each operation has named types: `<Domain><Method>Params` and `<Domain><Method>Response` (`DeliveriesCreateParams`, `InventoryIncomingInvoiceCreateV1Params`, …). Path-based aliases are also available: `RequestOf<'/api/1/deliveries/create'>`, `ResponseOf<'/api/1/organizations'>`.

A body whose fields are all optional can be omitted; the client sends `{}`, because iiko rejects a POST with no body.

Discriminated schemas are real unions, so a wrong payment kind or a missing order item field is a compile error:

```ts
import type { DeliveriesCreateParams } from "iiko-cloud-sdk";

type Payment = NonNullable<NonNullable<DeliveriesCreateParams["order"]>["payments"]>[number];
const payment: Payment = { paymentTypeKind: "Cash", sum: 450, paymentTypeId };
```

Unions are closed over the variants known to the current spec. Regenerate after an iiko update to see new ones.

Filter operators are literal unions too: `op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin" | "like" | "blank" | "notblank"`, so the editor suggests them and a typo fails to compile.

## Dates

`toIikoDateUtc(date)` and `fromIikoDateUtc(string)` handle iiko's `yyyy-MM-dd HH:mm:ss.fff` format for fields documented as UTC. Fields documented as terminal-local time have no time zone; format those yourself.

## Deprecated operations

Deprecated operations have no typed wrappers. They remain reachable by path:

```ts
await iiko.call("/api/2/menu/by_id", { externalMenuId, organizationIds });
```

`call` enforces the same body rule as generated methods: a body with required fields is a required
argument.

## Updating the spec

`spec/raw.json` is committed; `spec/normalized.json` and `src/generated` are produced from it.

```bash
pnpm spec:sync    # download the live document, normalize, regenerate
pnpm spec:build   # regenerate from the committed document
```

The generator fails on an unnamed active operation, a stale naming entry, a non-POST operation or a duplicate name/type. Update names in `scripts/names/transport.json` or `scripts/names/office.json` and rerun.

## Development

```bash
pnpm install
pnpm spec:build
pnpm check         # tsc + 452 tests, coverage thresholds
pnpm build         # tsup: ESM + CJS + one shared .d.ts
```

GitHub Actions is not used at the moment; run the checks locally.

The public API is frozen in `tests/api.snapshot.txt`. Update it only with `pnpm exec vitest run tests/api.test.ts -u` and review the diff: a removed or renamed name is a major version.

See `docs/ARCHITECTURE.md`, `docs/adr/` and `CONTRIBUTING.md`.

## License

MIT. Not an official iiko package.
