import { createIikoClient, type IikoClientOptions } from "../src/index.js";

export const ORG = "00000000-0000-0000-0000-000000000001";

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** JWT-shaped token so `exp` can be read without a signature. */
export const jwt = (expMs: number) =>
  `${b64({ alg: "none", typ: "JWT" })}.${b64({ exp: Math.floor(expMs / 1000) })}.sig`;

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

export interface Call {
  method: string;
  path: string;
  url: string;
  body: unknown;
  headers: Headers;
}

type Handler = (call: Call, signal: AbortSignal) => Response | object | Promise<Response | object>;

export interface FakeIikoOptions {
  /** Overrides the token endpoint answer. A function is called for every token request. */
  token?: Response | object | Handler;
}

/** Fake iiko server: answers the token endpoint, delegates everything else to `handler`. */
export function fakeIiko(handler: Handler = () => ({}), options: FakeIikoOptions = {}) {
  const calls: Call[] = [];
  const fetchMock: typeof fetch = async (input, init) => {
    const request = new Request(input as Request, init);
    const text = await request.clone().text();
    const call: Call = {
      method: request.method,
      path: new URL(request.url).pathname,
      url: request.url,
      body: text ? JSON.parse(text) : undefined,
      headers: request.headers,
    };
    calls.push(call);
    const out =
      call.path === "/api/v2/access_token"
        ? typeof options.token === "function"
          ? await options.token(call, request.signal)
          : options.token instanceof Response
            ? options.token.clone()
            : (options.token ?? {
                correlationId: "token-correlation",
                token: jwt(Date.now() + 3_600_000),
              })
        : await handler(call, request.signal);
    return out instanceof Response ? out : json(out);
  };

  return {
    fetch: fetchMock,
    calls,
    api: () => calls.filter((call) => call.path !== "/api/v2/access_token"),
    tokenRequests: () => calls.filter((call) => call.path === "/api/v2/access_token").length,
  };
}

export const makeClient = (
  fetch: typeof globalThis.fetch,
  extra: Partial<IikoClientOptions> = {},
) =>
  createIikoClient({
    apiKey: "key",
    appId: "app",
    clientSecret: "secret",
    retries: 0,
    fetch,
    ...extra,
  });

/** Never settles until the request is aborted. */
export function hang(signal: AbortSignal): Promise<Response> {
  return new Promise((_, reject) => {
    const abort = () => reject(new DOMException("The operation was aborted.", "AbortError"));
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort);
  });
}
