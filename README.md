# @toniq/iiko-cloud-sdk

> **This is not an official iiko package.** It is an unofficial, community TypeScript SDK for the [iikoCloud API](https://api-ru.iiko.help/docs/). iiko does not support or endorse it.

Typed HTTP client for iikoCloud: generated request/response types, JWT handling, typed errors, retries and timeouts.

## Install

```bash
pnpm add @toniq/iiko-cloud-sdk
```

Requires Node.js 22.12 or newer. ESM only — CommonJS projects can use `require()` from Node 20.19+.

## Quick start

```ts
import { createIikoClient } from "@toniq/iiko-cloud-sdk";

const iiko = createIikoClient({
  appId: process.env.IIKO_APP_ID!,
  clientSecret: process.env.IIKO_CLIENT_SECRET!,
  apiKey: process.env.IIKO_API_KEY!,
});

const { data, error } = await iiko.organizations.list();

if (error) throw error;
console.log(data?.organizations);
```

## Resources

| Resource | Method | iikoCloud operation |
|---|---|---|
| `organizations` | `list()` | `GET /api/1/organizations` |
| `organizations` | `getById(id)` | `POST /api/1/organizations` |
| `terminals` | `list(organizationId)` | `POST /api/1/terminal_groups` |
| `menu` | `getExternalMenu(organizationId, externalMenuId, options?)` | `POST /api/2/menu/by_id` |

Only these operations are covered in 1.0.0. Everything else waits for a real use case.

## Authentication

`appId`, `clientSecret` and `apiKey` are exchanged for a JWT at `POST /api/v2/access_token`. The token is cached in memory only — never written to disk, Redis or any store.

- There is no refresh token. When iiko rejects a token with `401`, the SDK fetches a new one and replays the request **once**.
- Tokens are refreshed 60 seconds before the `exp` claim when it can be read.
- Concurrent calls share one token request.
- Credentials and the `Authorization` header never appear in logs, errors or stack traces.

## Errors

Every method returns `{ data, error }` — like `openapi-fetch`. **Errors are not thrown**; check `error` before using `data`.

```ts
const { data, error } = await iiko.terminals.list(organizationId);

if (error) {
  console.error(error.name, error.status, error.correlationId);
}
```

| Class | When |
|---|---|
| `IikoAuthError` | token endpoint failure, or `401` after re-authentication |
| `IikoValidationError` | `400`, `409`, `422` |
| `IikoRateLimitError` | `429`, with `retryAfterMs` |
| `IikoServerError` | `5xx` |
| `IikoNetworkError` | fetch failure, or caller abort (`code: "ABORTED"`) |
| `IikoTimeoutError` | local timeout or `408` |
| `IikoError` | other `4xx` and the base class |

Each error carries `status`, `code`, `correlationId`, `endpoint`, `method`, `requestBody`, `responseBody` and `retryAfterMs` where available, with credentials redacted.

## Retries and timeouts

- Timeout per attempt: `timeoutMs` (default `15_000`).
- Retried: `GET`, `PUT`, `DELETE` on network errors and `408`, `429`, `500`, `502`, `503`, `504`.
- `POST` is not retried unless an operation opts in with the `x-iiko-retry: true` header (stripped before sending).
- Backoff is exponential with jitter: 500 ms, 1 s, 2 s. `Retry-After` wins on `429`.
- Cancellation: pass an `AbortSignal` as the last argument of any method.

## Configuration

| Option | Type | Default |
|---|---|---|
| `appId` | `string` | required |
| `clientSecret` | `string` | required |
| `apiKey` | `string` | required |
| `baseUrl` | `string` | `https://api-ru.iiko.services` |
| `timeoutMs` | `number` | `15_000` |
| `maxRetries` | `number` | `2` |
| `logger` | `ILogger` | off |
| `fetch` | `typeof fetch` | global `fetch` |
| `debug` | `boolean` | `false` |

Environment variables used by the example: `IIKO_APP_ID`, `IIKO_CLIENT_SECRET`, `IIKO_API_KEY`.

## Updating the OpenAPI types

`spec/raw.json` is the committed source. `spec/normalized.json` and `src/generated/` are produced from it and must never be edited by hand.

```bash
pnpm spec:sync    # download spec/raw.json, normalize, regenerate types and modules
pnpm spec:build   # regenerate from the committed spec (what CI runs)
```

CI rebuilds from the committed spec and fails when the result differs. An incompatible schema change ships as a major version.

## Status

Unpublished. No release job yet; changes are recorded with Changesets.

## License

MIT. See [LICENSE](LICENSE). Not affiliated with iiko.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
