# Security

## Reporting a vulnerability

Do not open a public issue. Report it privately to the maintainer, or use GitHub's private vulnerability reporting on the repository.

Include what you did, what happened, and the impact. You will get an acknowledgement, and a fix or an explanation as soon as possible.

## Scope

- Credential leaks: `appId`, `clientSecret`, `apiKey` or the `Authorization` header appearing in logs, errors, stack traces or telemetry.
- Request smuggling, SSRF or header injection through `baseUrl`, `fetch` or request options.
- Token caching bugs: tokens persisted to disk, shared across clients, or surviving `invalidate()`.

Secrets are never persisted by the SDK. If you find a path where they are, that is a vulnerability.
