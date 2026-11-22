# Technical Specification: TypeScript SDK for iikoCloud

## 1. Project goal

Develop an npm package, provisionally named `@toniq/iiko-cloud-sdk`, for integrating Node.js and TypeScript applications with the iikoCloud API.

The package must provide:

- A typed HTTP client for iikoCloud.
- Automatic authentication and JWT token refresh.
- Convenient methods for key business operations.
- Consistent API error handling.
- A maintainable extension model that does not require manual edits to generated code.

This is **not an official iiko SDK**. This must be stated clearly in the package README.

## 2. Context and sources

- Official iiko API documentation: https://api.iiko.help/docs/
- iikoCloud OpenAPI specification: `https://api-ru.iiko.services/api-docs/docs`
- Base API URL: `https://api-ru.iiko.services`
- Token endpoint: `POST /api/v2/access_token`
- Authorization header: `Authorization: Bearer {token}`
- JWT tokens are valid for approximately one hour. There is no refresh token; when a token expires, the SDK must request a new one.

The implementation must use the current OpenAPI specification rather than manually hard-coding request and response schemas. The page at `https://api-ru.iiko.services/docs` is a ReDoc documentation interface, not the OpenAPI specification itself.

## 3. Technology stack

### Required stack

| Area | Requirement |
|---|---|
| Language | TypeScript 6.x |
| Runtime | Node.js 20 LTS or newer |
| Module system | ESM-first, with CommonJS compatibility through `exports` |
| OpenAPI types | `openapi-typescript` |
| HTTP client | `openapi-fetch` |
| Tests | Vitest |
| Linting | oxlint |
| Formatting | oxfmt |
| Versioning | Semantic Versioning (SemVer) |
| Release tooling | Changesets or semantic-release |
| CI/CD | GitHub Actions |

Do not use Axios as a mandatory dependency. The HTTP layer must use the native `fetch` API or allow the fetch implementation to be injected for testing, proxying, and custom networking.

## 4. Functional requirements

### 4.1 Client creation

The package must export a factory function:

```ts
import { createIikoClient } from "@yourorg/iiko-cloud-sdk";

const iiko = createIikoClient({
  appId: process.env.IIKO_APP_ID!,
  clientSecret: process.env.IIKO_CLIENT_SECRET!,
  apiKey: process.env.IIKO_API_KEY!,
  baseUrl: "[https://api-ru.iiko.services](https://api-ru.iiko.services)",
});
```

### Required client options

| Option | Type | Required | Description |
|---|---|---:|---|
| `appId` | `string` | Yes | iiko application ID |
| `clientSecret` | `string` | Yes | iiko application client secret |
| `apiKey` | `string` | Yes | Organization API key |
| `baseUrl` | `string` | No | Defaults to `https://api-ru.iiko.services` |
| `timeoutMs` | `number` | No | Request timeout in milliseconds; default: `15000` |
| `maxRetries` | `number` | No | Maximum retry attempts; default: `2` |
| `logger` | `ILogger` | No | Custom logger implementation |
| `fetch` | `typeof fetch` | No | Custom fetch implementation for tests or proxies |
| `debug` | `boolean` | No | Enables verbose request/response logging; default: `false` |

The options `appId`, `clientSecret`, and `apiKey` must never be logged, serialized into errors, or included in stack traces.

### 4.2 Authentication

Implement an `AuthService` that:

1. Requests a JWT using `POST /api/v2/access_token`.
2. Sends `appId`, `clientSecret`, and `apiKey` in the JSON request body.
3. Caches the received token in memory.
4. Adds `Authorization: Bearer {token}` to every protected request.
5. Refreshes the token when the API returns `401` and retries the original request once.
6. Prevents parallel token requests: if multiple requests are waiting for a token, only one authorization request must be made.
7. Refreshes the token proactively, for example 60 seconds before its expected expiration, when expiration time is known or can be calculated.

By default, tokens must not be persisted to disk, `localStorage`, Redis, or any other external storage. Optionally, provide a `TokenStore` interface for enterprise scenarios.

If the API response includes a `correlationId`, include it in errors and logs where available.

### 4.3 HTTP layer

Requirements:

- All requests must be executed through a type-safe client based on `openapi-fetch`.
- Support `GET`, `POST`, `PUT`, and `DELETE`.
- Set `Content-Type: application/json` for requests with a body.
- Automatically add `Authorization: Bearer {token}` to protected requests.
- Support `AbortSignal` for request cancellation.
- Apply a timeout to every request.
- Retry only idempotent requests by default: `GET`, `PUT`, and `DELETE`.
- For `POST`, retry only when explicitly enabled for a specific operation.
- Retry on network errors and HTTP statuses `408`, `429`, `500`, `502`, `503`, and `504`.
- Respect the `Retry-After` header when it is returned with `429`.
- Use exponential backoff with jitter between retries, for example 500 ms, 1 second, 2 seconds.
- Return API responses in the `{ data, error }` format used by `openapi-fetch`.

### 4.4 Error handling

Create the following error hierarchy:

```ts
export class IikoError extends Error {}
export class IikoAuthError extends IikoError {}
export class IikoValidationError extends IikoError {}
export class IikoRateLimitError extends IikoError {}
export class IikoServerError extends IikoError {}
export class IikoNetworkError extends IikoError {}
export class IikoTimeoutError extends IikoError {}
```

Every error must include:

```ts
{
  status?: number;
  code?: string;
  message: string;
  correlationId?: string;
  endpoint?: string;
  method?: string;
  requestBody?: unknown;
  responseBody?: unknown;
  retryAfterMs?: number;
}
```

Requirements:

- Never include `clientSecret`, `apiKey`, or the `Authorization` header in `requestBody`, `responseBody`, error messages, or stack traces.
- Throw `IikoAuthError` for `401` after a failed re-authentication attempt.
- Throw `IikoRateLimitError` for `429`, including `retryAfterMs` when the header is available.
- Throw `IikoValidationError` or a generic `IikoError` for other `4xx` responses.
- Throw `IikoServerError` for `5xx` responses.
- Throw `IikoNetworkError` for network failures.
- Throw `IikoTimeoutError` when the request timeout is exceeded.

### 4.5 OpenAPI type generation

Add the following scripts to `package.json`:

```json
{
  "scripts": {
    "iiko:download": "curl -sS -L [https://api-ru.iiko.services/api-docs/docs](https://api-ru.iiko.services/api-docs/docs) -o src/generated/openapi.json",
    "iiko:types": "openapi-typescript src/generated/openapi.json -o src/generated/schema.d.ts",
    "iiko:sync": "npm run iiko:download && npm run iiko:types"
  }
}
```

Requirements:

- Generated files must be stored in `src/generated/`.
- Generated code must never be edited manually.
- CI must include a task that detects unexpected changes to the OpenAPI specification.
- When the specification changes, run all tests and check backward compatibility of the public API.
- If iiko introduces an incompatible schema change, publish a new major package version.

### 4.6 Domain resources

Implement convenient resource modules. For the first release, implement at least:

| Module | Minimum methods |
|---|---|
| `organizations` | `list()`, `getById(id)` |
| `terminals` | `list(organizationId)` |
| `menu` | `getExternalMenu(organizationId, ...)` if the endpoint exists in the current specification |
| `delivery` | Order creation and retrieval methods, only after confirming the required operations |
| `payments` | Methods required by the business, only after confirming the required operations |

Each resource module must:

- Use generated OpenAPI types.
- Return typed results.
- Not duplicate HTTP-layer business logic.
- Include JSDoc documentation for parameters and possible errors.

Do not implement every API endpoint “just in case.” Cover only the operations required by the initial use cases.

## 5. Public API

The package must export:

```ts
export { createIikoClient } from "./client";

export type {
  IikoClient,
  IikoClientOptions
} from "./client";

export {
  IikoError,
  IikoAuthError,
  IikoValidationError,
  IikoRateLimitError,
  IikoServerError,
  IikoNetworkError,
  IikoTimeoutError
} from "./errors";
```

Example usage:

```ts
const iiko = createIikoClient({
  appId: process.env.IIKO_APP_ID!,
  clientSecret: process.env.IIKO_CLIENT_SECRET!,
  apiKey: process.env.IIKO_API_KEY!,
});

const { data, error } = await iiko.organizations.list();

if (error) {
  throw error;
}

console.log(data);
```

The public API must remain stable. Internal classes, utilities, and generated types must not become part of the public contract unless explicitly required.

## 6. Non-functional requirements

### 6.1 Compatibility

- Node.js: 20 LTS and 22 LTS.
- TypeScript: 5.x.
- ESM: required.
- CommonJS: supported through `exports`, `main`, and a correct build configuration.
- Browser support: not required for the first release. If required later, secrets must never be exposed in client-side code.

### 6.2 Security

- Credentials must be provided only through constructor options or environment variables.
- Secrets must not appear in logs, errors, request dumps, or telemetry.
- By default, log only the HTTP method, URL without sensitive query parameters, response status, and `correlationId`.
- Log request and response bodies only when `debug: true` is explicitly enabled.
- Keep runtime dependencies minimal and keep them updated.
- Run `npm audit` or an equivalent vulnerability check in CI.

### 6.3 Performance

- The package must not include heavyweight dependencies.
- Use `openapi-fetch` because it is a lightweight, type-safe client with a very small runtime footprint.
- Cache tokens in process memory.
- Do not perform authorization before every request when a valid token is already available.

### 6.4 Observability

Implement a simple logger interface:

```ts
export interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
```

Logging must be disabled by default. Consumers may provide their own logger implementation.

## 7. Testing

### Required tests

- Successful token acquisition.
- Reuse of a cached token.
- Token refresh on `401`.
- Prevention of parallel authorization requests.
- Correct `Authorization` header on protected requests.
- Handling of `400`, `401`, `403`, `404`, `409`, `429`, `500`, `502`, `503`.
- Retries for `429`, `500`, `502`, `503`, and network errors.
- Respect for `Retry-After`.
- Request timeout behavior.
- Cancellation through `AbortSignal`.
- Verification that secrets never appear in errors or logs.
- Type checks for key public methods.
- ESM and CommonJS import checks after building the package.

### Coverage requirement

Minimum test coverage: **85%** for `src/`, excluding generated files.

## 8. Repository structure

```text
.
├── src/
│   ├── client.ts
│   ├── auth.ts
│   ├── http.ts
│   ├── errors.ts
│   ├── logger.ts
│   ├── config.ts
│   ├── resources/
│   │   ├── organizations.ts
│   │   ├── terminals.ts
│   │   └── menu.ts
│   └── generated/
│       ├── openapi.json
│       └── schema.ts
├── tests/
│   ├── auth.test.ts
│   ├── client.test.ts
│   ├── errors.test.ts
│   └── retry.test.ts
├── examples/
│   └── basic.ts
├── docs/
│   └── README.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .github/workflows/ci.yml
└── README.md
```

## 9. CI/CD

GitHub Actions must run:

1. Dependency installation.
2. Linting.
3. TypeScript type checking.
4. Unit and integration tests.
5. ESM and CommonJS builds.
6. Dependency vulnerability checks.
7. OpenAPI specification diff checks.
8. npm publishing only for release tags.

Use Semantic Versioning:

- `patch`: backward-compatible bug fixes.
- `minor`: backward-compatible new features.
- `major`: breaking changes.

The first stable release must be `1.0.0`.

Commits must follow Conventional Commits:

- `fix` produces a patch release.
- `feat` produces a minor release.
- `BREAKING CHANGE` produces a major release.

## 10. Documentation

The README must include:

- Short package description.
- Installation command: `npm i @yourorg/iiko-cloud-sdk`.
- Quick start example.
- Example of retrieving organizations.
- Authentication explanation.
- Error handling examples.
- Environment variable reference.
- Instructions for updating the OpenAPI schema.
- A clear disclaimer that this is not an official iiko package.
- License information.
- Contributing instructions.

Also create:

- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `LICENSE`
- `SECURITY.md`
- `examples/basic.ts`

## 11. Acceptance criteria

The task is complete when:

1. `npm i @yourorg/iiko-cloud-sdk` installs successfully.
2. `createIikoClient()` creates a working client.
3. The SDK obtains and caches a JWT token.
4. Every protected request includes a valid `Authorization` header.
5. When a token expires, the SDK automatically obtains a new one and retries the failed request.
6. API errors are converted into typed error classes.
7. Secrets never appear in logs or error objects.
8. Request and response types are generated from OpenAPI.
9. All tests pass in CI.
10. The package can be imported correctly in both ESM and CommonJS projects.
11. The README contains a working example.
12. The package is published to npm through an automated release process.

## 12. Out of scope for version 1.0.0

The first release does not need to include:

- Support for every iikoCloud endpoint.
- Official browser support.
- Integration with iikoServer, iikoFront, or iikoCard.
- Webhooks.
- GraphQL.
- Caching of menus or other business data.
- Integrations with React Query, TanStack Query, or a specific frontend framework.

These features may be added later as separate minor releases.

## 13. Questions to clarify before implementation

The implementing engineer or AI agent must clarify the following before starting:

1. What npm package name and scope should be used: `@toniq/iiko-cloud-sdk` or another?
2. Which business operations are required in the first release: organizations, menu, delivery, orders, payments?
3. Will the package be published publicly to npm or used as a private internal package?
4. Is CommonJS support required, or is ESM-only acceptable?
5. Which iikoCloud regional endpoint will be used: `api-ru.iiko.services` or another?
6. Are test `appId`, `clientSecret`, and `apiKey` credentials available?
7. Should the SDK integrate with an existing logging system such as Pino, Winston, or OpenTelemetry?
8. Which package manager should be used: npm, pnpm, or yarn?