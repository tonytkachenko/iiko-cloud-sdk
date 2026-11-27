import type { ILogger } from "../logger.js";
import { AuthService } from "./auth.js";
import type { ResolvedConfig } from "./config.js";
import {
  IikoApiError,
  IikoAuthError,
  IikoError,
  IikoNetworkError,
  IikoRateLimitError,
  IikoTimeoutError,
  responseError,
} from "./errors.js";
import { redact } from "./redact.js";
import { sleep } from "./sleep.js";
import type { CallArgs, CallOptions, Path, ResponseOf } from "./types.js";

export interface AttemptEvent {
  path: string;
  /** 0 for the first try, 1 for the first retry, and so on. */
  attempt: number;
  status?: number;
  durationMs: number;
  correlationId?: string;
  /** The error that ended this attempt, if any. Bodies are already redacted. */
  error?: IikoError;
}

/** The client gives up this long after the server-side timeout. */
const CLIENT_GRACE_SEC = 5;

/** Only 429 is retried: iiko refuses it before running the operation. */
function retryDelay(error: unknown, attempt: number, baseMs: number): number | undefined {
  if (!(error instanceof IikoRateLimitError)) return undefined;
  if (error.retryAfterMs !== undefined) return error.retryAfterMs;
  const delay = baseMs * 2 ** attempt;
  return delay + Math.random() * delay * 0.2;
}

const parse = (text: string): unknown => {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const correlationOf = (body: unknown): string | undefined => {
  if (body === null || typeof body !== "object") return undefined;
  const value = (body as { correlationId?: unknown }).correlationId;
  return typeof value === "string" ? value : undefined;
};

export class Transport {
  readonly #config: ResolvedConfig;
  readonly #fetch: typeof fetch;
  readonly #logger: ILogger;
  readonly #tokens: AuthService;

  constructor(config: ResolvedConfig) {
    this.#config = config;
    this.#fetch = config.fetch;
    this.#logger = config.logger;
    this.#tokens = new AuthService((timeoutSec) =>
      this.#requestToken(timeoutSec ?? this.#config.timeoutSec),
    );
  }

  async call<P extends Path>(path: P, ...args: CallArgs<P>): Promise<ResponseOf<P>> {
    const [body, options] = args as [unknown, CallOptions?];
    for (let attempt = 0; ; attempt++) {
      try {
        return (await this.#authed(path, body, options ?? {}, attempt)) as ResponseOf<P>;
      } catch (error) {
        const delay = retryDelay(error, attempt, this.#config.retryBaseMs);
        if (delay === undefined || attempt >= this.#config.retries) throw error;
        this.#logger.warn("iiko: retrying", {
          path,
          attempt,
          status: error instanceof IikoApiError ? error.status : undefined,
          delayMs: Math.round(delay),
        });
        await sleep(delay, options?.signal);
      }
    }
  }

  async #requestToken(timeoutSec: number): Promise<string> {
    const body = await this.#once(
      "/api/v2/access_token",
      {
        apiKey: this.#config.apiKey,
        appId: this.#config.appId,
        clientSecret: this.#config.clientSecret,
      },
      { timeoutSec },
      0,
    );
    const token =
      body !== null && typeof body === "object" ? (body as { token?: unknown }).token : undefined;
    if (typeof token !== "string" || token === "") {
      throw new IikoAuthError("iiko: access token response did not contain a token", {
        endpoint: "/api/v2/access_token",
        method: "POST",
        responseBody: body,
      });
    }
    return token;
  }

  async #authed(
    path: string,
    body: unknown,
    options: CallOptions,
    attempt: number,
  ): Promise<unknown> {
    const timeoutSec = options.timeoutSec ?? this.#config.timeoutSec;
    try {
      return await this.#once(
        path,
        body,
        options,
        attempt,
        await this.#tokens.getToken(timeoutSec),
      );
    } catch (error) {
      // A 401 means the request was not processed, so replaying it is safe.
      // A rejected token request is not an API 401 and must not be replayed.
      if (
        !(error instanceof IikoAuthError) ||
        error.status !== 401 ||
        error.endpoint === "/api/v2/access_token" ||
        path === "/api/v2/access_token"
      ) {
        throw error;
      }
      this.#tokens.invalidate();
      return this.#once(path, body, options, attempt, await this.#tokens.getToken(timeoutSec));
    }
  }

  async #once(
    path: string,
    body: unknown,
    options: CallOptions,
    attempt: number,
    token?: string,
  ): Promise<unknown> {
    const timeoutSec = options.timeoutSec ?? this.#config.timeoutSec;
    const controller = new AbortController();
    const caller = options.signal;
    const abortFromCaller = () => controller.abort(caller?.reason);
    if (caller?.aborted) controller.abort(caller.reason);
    else caller?.addEventListener("abort", abortFromCaller, { once: true });
    const timer = setTimeout(
      () => controller.abort(new DOMException("iiko request timed out", "TimeoutError")),
      (timeoutSec + CLIENT_GRACE_SEC) * 1000,
    );

    const headers: Record<string, string> = { "User-Agent": this.#config.userAgent };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token !== undefined) headers.Authorization = `Bearer ${token}`;
    headers.Timeout = String(timeoutSec);

    const started = Date.now();
    const event: AttemptEvent = { path, attempt, durationMs: 0 };
    let failure: unknown;

    if (this.#config.debug) {
      this.#logger.debug("iiko: request", { path, body: redact(body) });
    }

    try {
      const response = await this.#fetch(`${this.#config.baseUrl}${path}`, {
        method: "POST",
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      event.status = response.status;
      const text = await response.text();
      const data = parse(text);
      event.correlationId = correlationOf(data);

      if (!response.ok) {
        throw responseError(response, data, { endpoint: path, method: "POST", requestBody: body });
      }
      if (text && data === undefined) {
        throw new IikoError("iiko: response is not valid JSON", {
          status: response.status,
          endpoint: path,
          method: "POST",
        });
      }
      if (this.#config.debug) {
        this.#logger.debug("iiko: response body", {
          path,
          status: response.status,
          body: redact(data),
        });
      }
      return data;
    } catch (error) {
      if (error instanceof IikoError) {
        failure = error;
        throw error;
      }
      if (caller?.aborted) {
        failure = error;
        throw error;
      }
      const timeout =
        controller.signal.aborted && !caller?.aborted
          ? new IikoTimeoutError(`iiko: ${path} did not answer in ${timeoutSec}s`, {
              endpoint: path,
              method: "POST",
              requestBody: body,
              cause: error,
            })
          : undefined;
      if (timeout) {
        failure = timeout;
        throw timeout;
      }
      const network = new IikoNetworkError("iiko: network request failed", {
        endpoint: path,
        method: "POST",
        requestBody: body,
        cause: error,
      });
      failure = network;
      throw network;
    } finally {
      clearTimeout(timer);
      caller?.removeEventListener("abort", abortFromCaller);
      event.durationMs = Date.now() - started;
      if (failure instanceof IikoError) event.error = failure;
      this.#logger.debug("iiko: response", {
        path,
        status: event.status,
        attempt,
        durationMs: event.durationMs,
        correlationId: event.correlationId,
      });
      try {
        this.#config.onAttempt?.(event);
      } catch {
        // a broken observer must not break the call
      }
    }
  }
}
