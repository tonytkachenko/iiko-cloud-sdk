import { noopLogger, type ILogger } from "../logger.js";
import type { AttemptEvent } from "./transport.js";

export interface IikoClientOptions {
  /** iiko application ID. */
  appId: string;
  /** iiko application client secret. */
  clientSecret: string;
  /** Organization API key. */
  apiKey: string;
  /** API base URL. Defaults to `https://api-ru.iiko.services`. */
  baseUrl?: string;
  /** Server-side timeout, sent as the `Timeout` header. Defaults to 15 seconds. */
  timeoutSec?: number;
  /** Retries after the first attempt, only for HTTP 429. Defaults to 3. */
  retries?: number;
  /** First retry delay in ms, doubled each time. Defaults to 1000. */
  retryBaseMs?: number;
  /** Receives sanitized request metadata. Logging is off by default. */
  logger?: ILogger;
  /** Custom fetch implementation for tests or proxies. */
  fetch?: typeof fetch;
  /** Logs request and response bodies, redacted. Defaults to false. */
  debug?: boolean;
  /** Sent as `User-Agent`; defaults to `iiko-cloud-sdk/<version>`. */
  userAgent?: string;
  /** Called after every HTTP attempt, token requests and retries included. */
  onAttempt?: (event: AttemptEvent) => void;
}

export interface ResolvedConfig extends Required<Omit<IikoClientOptions, "onAttempt">> {
  onAttempt?: (event: AttemptEvent) => void;
}

export const DEFAULT_BASE_URL = "https://api-ru.iiko.services";
export const DEFAULT_TIMEOUT_SEC = 15;
export const DEFAULT_RETRIES = 3;
export const DEFAULT_RETRY_BASE_MS = 1000;
export const DEFAULT_USER_AGENT = "iiko-cloud-sdk/0.2.0";

function required(options: IikoClientOptions, key: "appId" | "clientSecret" | "apiKey"): string {
  const value = options[key];
  if (typeof value !== "string" || value.trim() === "") {
    // The value itself is never echoed back.
    throw new TypeError(`iiko: option "${key}" is required`);
  }
  return value;
}

export function resolveConfig(options: IikoClientOptions): ResolvedConfig {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new TypeError('iiko: option "baseUrl" must be a valid absolute URL');
  }

  const timeoutSec = options.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
  if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) {
    throw new TypeError('iiko: option "timeoutSec" must be a positive number');
  }

  const retries = options.retries ?? DEFAULT_RETRIES;
  if (!Number.isInteger(retries) || retries < 0) {
    throw new TypeError('iiko: option "retries" must be a non-negative integer');
  }

  const retryBaseMs = options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;
  if (!Number.isFinite(retryBaseMs) || retryBaseMs <= 0) {
    throw new TypeError('iiko: option "retryBaseMs" must be a positive number');
  }

  return {
    appId: required(options, "appId"),
    clientSecret: required(options, "clientSecret"),
    apiKey: required(options, "apiKey"),
    baseUrl: parsed.origin + parsed.pathname.replace(/\/+$/, "") + parsed.search,
    timeoutSec,
    retries,
    retryBaseMs,
    logger: options.logger ?? noopLogger,
    fetch: options.fetch ?? globalThis.fetch,
    debug: options.debug ?? false,
    userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
    onAttempt: options.onAttempt,
  };
}
