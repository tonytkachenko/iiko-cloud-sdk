import type { CallOptions, Path, RequestOf, ResponseOf } from "./core/types.js";
import { AUTH_PARAMS, type HttpClient, type IikoResult } from "./http.js";

/**
 * Runs one documented POST through the shared client, so every generated method
 * gets auth, timeout, 401 replay and typed errors.
 *
 * The cast covers a spec quirk: `Authorization` is a required parameter on most
 * operations and absent on a few, and `openapi-fetch` cannot reduce its response
 * type through a generic path. `ResponseOf` restates exactly what the spec documents.
 * shortcut: replace with a `paths` type whose auth header is optional.
 */
export function call<P extends Path>(
  http: HttpClient,
  path: P,
  body: RequestOf<P> | undefined,
  init?: CallOptions,
): Promise<IikoResult<ResponseOf<P>>> {
  return http.request({ method: "POST", endpoint: path, requestBody: body }, () =>
    http.client.POST(path, { params: AUTH_PARAMS, body, ...init } as never),
  ) as Promise<IikoResult<ResponseOf<P>>>;
}
