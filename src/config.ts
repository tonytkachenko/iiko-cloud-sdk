import { noopLogger, type ILogger } from "./logger.js";

export interface IikoClientOptions {
  /** iiko application ID. */
  appId: string;
  /** iiko application client secret. */
  clientSecret: string;
  /** Organization API key. */
  apiKey: string;
  /** API base URL. Defaults to `https://api-ru.iiko.services`. */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Defaults to 15000. */
  timeoutMs?: number;
  /** Retries after the first attempt. Defaults to 2. */
  maxRetries?: number;
  /** Receives sanitized request metadata. Logging is off by default. */
  logger?: ILogger;
  /** Custom fetch implementation for tests or proxies. */
  fetch?: typeof fetch;
  /** Logs request and response bodies, redacted. Defaults to false. */
  debug?: boolean;
}

export interface ResolvedConfig {
  appId: string;
  clientSecret: string;
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  logger: ILogger;
  fetch: typeof fetch;
  debug: boolean;
}

export const DEFAULT_BASE_URL = "https://api-ru.iiko.services";
export const DEFAULT_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_RETRIES = 2;

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

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('iiko: option "timeoutMs" must be a positive number');
  }

  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new TypeError('iiko: option "maxRetries" must be a non-negative integer');
  }

  return {
    appId: required(options, "appId"),
    clientSecret: required(options, "clientSecret"),
    apiKey: required(options, "apiKey"),
    baseUrl: parsed.origin + parsed.pathname.replace(/\/+$/, "") + parsed.search,
    timeoutMs,
    maxRetries,
    logger: options.logger ?? noopLogger,
    fetch: options.fetch ?? globalThis.fetch,
    debug: options.debug ?? false,
  };
}
