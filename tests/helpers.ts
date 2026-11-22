import { createIikoClient, type IikoClientOptions } from "../src/index.js";

export interface Call {
  method: string;
  url: string;
  path: string;
  headers: Headers;
  body: unknown;
}

export interface FakeServer {
  fetch: typeof fetch;
  calls: Call[];
  count(path: string): number;
}

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** JWT-shaped token so `exp` can be read without a signature. */
export function jwt(expSeconds: number): string {
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ exp: expSeconds })}.sig`;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  if (status === 204) return new Response(null, { status, headers });
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export function fakeServer(
  handler: (call: Call, signal: AbortSignal) => Response | Promise<Response>,
): FakeServer {
  const calls: Call[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const request = new Request(input as Request, init);
    const raw = ["GET", "HEAD"].includes(request.method) ? "" : await request.clone().text();
    const call: Call = {
      method: request.method,
      url: request.url,
      path: new URL(request.url).pathname,
      headers: request.headers,
      body: raw ? JSON.parse(raw) : undefined,
    };
    calls.push(call);
    return handler(call, request.signal);
  };

  return {
    fetch: fakeFetch,
    calls,
    count: (path) => calls.filter((call) => call.path === path).length,
  };
}

/** Fake iiko server: answers the token endpoint, delegates everything else. */
export function testClient(
  handler: (call: Call, signal: AbortSignal) => Response | Promise<Response>,
  options: Partial<IikoClientOptions> = {},
) {
  const token = jwt(Math.floor(Date.now() / 1000) + 3600);
  const server = fakeServer((call, signal) =>
    call.path === "/api/v2/access_token"
      ? json({ token, correlationId: "auth-correlation" })
      : handler(call, signal),
  );
  const client = createIikoClient({
    appId: "test-app",
    clientSecret: "test-secret",
    apiKey: "test-key",
    fetch: server.fetch,
    ...options,
  });
  return { client, server, token };
}

/** Never settles until the request is aborted. */
export function hang(signal: AbortSignal): Promise<Response> {
  return new Promise((_, reject) => {
    const abort = () => reject(new DOMException("The operation was aborted.", "AbortError"));
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort);
  });
}
