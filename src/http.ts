import createClient, { type Client } from "openapi-fetch";
import type { TokenProvider } from "./auth.js";
import type { ResolvedConfig } from "./config.js";
import {
  IikoError,
  IikoTimeoutError,
  networkError,
  responseError,
  retryAfterMs,
  type ErrorContext,
} from "./errors.js";
import type { ILogger } from "./logger.js";
import type { paths } from "./generated/schema.js";

export interface IikoResult<T> {
  data?: T;
  error?: IikoError;
}

export interface HttpContext {
  method: string;
  endpoint: string;
  requestBody?: unknown;
}

/** The spec marks `Authorization` as required; the real value is injected by the wrapper. */
export const AUTH_PARAMS = { header: { Authorization: "" } } as const;

interface FetchOptions {
  fetch: typeof fetch;
  auth: TokenProvider;
  timeoutMs: number;
  maxRetries: number;
  logger: ILogger;
  debug: boolean;
}

const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(["GET", "PUT", "DELETE"]);

/** Set on a request to opt a POST into retries; stripped before sending. */
export const RETRY_HEADER = "x-iiko-retry";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function retryDelay(attempt: number, retryAfter?: number): number {
  if (retryAfter !== undefined) return retryAfter;
  const base = 500 * 2 ** attempt;
  return base + Math.random() * base * 0.2;
}

function pathOf(url: string): string {
  return new URL(url).pathname;
}

/** Adds auth, timeout and retries on top of the injected fetch. */
export function createFetch(options: FetchOptions): typeof fetch {
  return async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const method = request.method.toUpperCase();
    const context: ErrorContext = { method, endpoint: pathOf(request.url) };

    const headers = new Headers(request.headers);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    const retryPost = headers.get(RETRY_HEADER) === "true";
    headers.delete(RETRY_HEADER);
    const retryable = IDEMPOTENT_METHODS.has(method) || (method === "POST" && retryPost);

    headers.set("authorization", `Bearer ${await options.auth.getToken()}`);
    const callerSignal = request.signal;

    // Buffer the body once: a Request is single-use, retries need a fresh one.
    const body =
      method === "GET" || method === "HEAD" || request.body === null
        ? undefined
        : await request.clone().text();

    const send = (signal: AbortSignal) =>
      options.fetch(new Request(request.url, { ...init, method, headers, body, signal }));

    for (let attempt = 0; ; attempt++) {
      const timeoutSignal = AbortSignal.timeout(options.timeoutMs);
      const signal = callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;

      try {
        const response = await send(signal);
        options.logger.debug("iiko: response", {
          method,
          path: context.endpoint,
          status: response.status,
          attempt,
        });

        if (response.status === 401) return response;
        if (!RETRY_STATUSES.has(response.status) || !retryable || attempt >= options.maxRetries) {
          return response;
        }

        const delay = retryDelay(attempt, retryAfterMs(response));
        options.logger.warn("iiko: retrying request", {
          method,
          path: context.endpoint,
          status: response.status,
          attempt,
          delayMs: Math.round(delay),
        });
        await sleep(delay);
      } catch (error) {
        if (timeoutSignal.aborted) {
          throw new IikoTimeoutError(`iiko: request timed out after ${options.timeoutMs}ms`, {
            ...context,
            cause: error,
          });
        }
        // Caller cancellation is reported by the request layer as ABORTED.
        if (callerSignal?.aborted) throw error;
        if (!retryable || attempt >= options.maxRetries) throw error;

        const delay = retryDelay(attempt);
        options.logger.warn("iiko: retrying after network error", {
          method,
          path: context.endpoint,
          attempt,
          delayMs: Math.round(delay),
        });
        await sleep(delay);
      }
    }
  };
}

type CallResult<T> = () => Promise<{ data?: T; error?: unknown; response: Response }>;

/** Thin layer over an `openapi-fetch` client: errors in, typed errors out. */
export class HttpClient {
  readonly client: Client<paths>;

  constructor(
    private readonly config: ResolvedConfig,
    private readonly auth: TokenProvider,
  ) {
    this.client = createClient<paths>({
      baseUrl: config.baseUrl,
      fetch: createFetch({
        fetch: config.fetch,
        auth,
        timeoutMs: config.timeoutMs,
        maxRetries: config.maxRetries,
        logger: config.logger,
        debug: config.debug,
      }),
    });
  }

  async request<T>(context: HttpContext, call: CallResult<T>): Promise<IikoResult<T>> {
    try {
      let result = await call();
      if (result.response.status === 401) {
        this.auth.invalidate();
        result = await call();
      }

      if (!result.response.ok) {
        this.config.logger.warn("iiko: request failed", {
          method: context.method,
          path: context.endpoint,
          status: result.response.status,
        });
        return { error: responseError(result.response, result.error, context) };
      }

      return { data: result.data };
    } catch (error) {
      return { error: networkError(error, context) };
    }
  }
}
