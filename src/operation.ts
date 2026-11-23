import { AUTH_PARAMS, type HttpClient, type IikoResult } from "./http.js";
import type { paths } from "./generated/schema.js";

export type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

/** One documented operation, as described by the generated `paths` type. */
export type Operation<P extends keyof paths, M extends HttpMethod> = M extends keyof paths[P]
  ? paths[P][M]
  : never;

/** The JSON body an operation accepts, or `never` when it takes none. */
export type JsonBody<P extends keyof paths, M extends HttpMethod> =
  Operation<P, M> extends { requestBody?: infer Body }
    ? Body extends { content: { "application/json": infer Value } }
      ? Value
      : never
    : never;

/**
 * The documented 200 response body. Operations with an empty 200 resolve to `void`,
 * which is why nothing here claims a payload exists when the spec says otherwise.
 */
export type SuccessBody<P extends keyof paths, M extends HttpMethod> =
  Operation<P, M> extends { responses: { 200: { content: { "application/json": infer Value } } } }
    ? Value
    : void;

/** What a caller may override per request; the body stays typed. */
export interface CallOptions {
  signal?: AbortSignal;
}

const UPPER = {
  get: "GET",
  post: "POST",
  put: "PUT",
  delete: "DELETE",
  patch: "PATCH",
} as const;

/**
 * Runs one documented operation through the shared client, so every generated method
 * gets auth, timeout, 401 replay and typed errors.
 *
 * The cast covers two spec quirks no single call-site shape satisfies: `Authorization`
 * is a required parameter on most operations and absent on a few (purchasing), and
 * `openapi-fetch` cannot reduce its response type through a generic path.
 * shortcut: replace with a `paths` type whose auth header is optional.
 */
export function call<P extends keyof paths, M extends HttpMethod>(
  http: HttpClient,
  method: M,
  path: P,
  body: JsonBody<P, M> | undefined,
  init?: CallOptions,
): Promise<IikoResult<SuccessBody<P, M>>> {
  const upper = UPPER[method];
  // One cast: openapi-fetch types each HTTP method separately, so a value keyed by a
  // union of method names is not callable. The path stays checked by `keyof paths`.
  const send = http.client[upper] as unknown as (
    path: P,
    init: { params: typeof AUTH_PARAMS; body: JsonBody<P, M> | undefined; signal?: AbortSignal },
  ) => Promise<{ data?: unknown; error?: unknown; response: Response }>;
  return http.request({ method: upper, endpoint: path, requestBody: body }, () =>
    send(path, { params: AUTH_PARAMS, body, ...init }),
  ) as Promise<IikoResult<SuccessBody<P, M>>>;
}
