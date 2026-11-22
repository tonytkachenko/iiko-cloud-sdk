export interface IikoErrorOptions {
  status?: number;
  code?: string;
  correlationId?: string;
  endpoint?: string;
  method?: string;
  requestBody?: unknown;
  responseBody?: unknown;
  retryAfterMs?: number;
  cause?: unknown;
}

const SECRET_KEY = /^(appId|clientSecret|apiKey|authorization|token)$/i;
const BEARER = /(Bearer\s+)[\w.~+/-]+=*/gi;
const REDACTED = "[redacted]";

/** Replaces credentials found in keys or `Bearer` values, recursively. */
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return value.replace(BEARER, `$1${REDACTED}`);
  if (Array.isArray(value)) return value.map((item) => redact(item, seen));
  if (value !== null && typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = SECRET_KEY.test(key) ? REDACTED : redact(item, seen);
    }
    return result;
  }
  return value;
}

export class IikoError extends Error {
  status?: number;
  code?: string;
  correlationId?: string;
  endpoint?: string;
  method?: string;
  requestBody?: unknown;
  responseBody?: unknown;
  retryAfterMs?: number;

  constructor(message: string, options: IikoErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    if (options.status !== undefined) this.status = options.status;
    if (options.code !== undefined) this.code = options.code;
    if (options.correlationId !== undefined) this.correlationId = options.correlationId;
    if (options.endpoint !== undefined) this.endpoint = options.endpoint;
    if (options.method !== undefined) this.method = options.method;
    if (options.requestBody !== undefined) this.requestBody = redact(options.requestBody);
    if (options.responseBody !== undefined) this.responseBody = redact(options.responseBody);
    if (options.retryAfterMs !== undefined) this.retryAfterMs = options.retryAfterMs;
  }
}

export class IikoAuthError extends IikoError {}
export class IikoValidationError extends IikoError {}
export class IikoRateLimitError extends IikoError {}
export class IikoServerError extends IikoError {}
export class IikoNetworkError extends IikoError {}
export class IikoTimeoutError extends IikoError {}

function field(body: unknown, key: string): string | undefined {
  if (body === null || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** Parses `Retry-After` as delta-seconds or an HTTP date. */
export function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, date - Date.now());
}

function errorClass(status: number): typeof IikoError {
  if (status === 401) return IikoAuthError;
  if (status === 408) return IikoTimeoutError;
  if (status === 429) return IikoRateLimitError;
  if (status >= 500) return IikoServerError;
  if (status === 400 || status === 409 || status === 422) return IikoValidationError;
  return IikoError;
}

export interface ErrorContext {
  method: string;
  endpoint: string;
  requestBody?: unknown;
}

/** Builds the typed error for a non-2xx response. */
export function responseError(response: Response, body: unknown, context: ErrorContext): IikoError {
  const description = field(body, "errorDescription") ?? field(body, "message");
  const status = response.status;
  const message = description ?? `${status} ${response.statusText || "request failed"}`;
  const ErrorClass = errorClass(status);
  return new ErrorClass(message, {
    status,
    code: field(body, "error"),
    correlationId: field(body, "correlationId"),
    endpoint: context.endpoint,
    method: context.method,
    requestBody: context.requestBody,
    responseBody: body,
    retryAfterMs: status === 429 ? retryAfterMs(response) : undefined,
  });
}

/** Maps anything thrown by `fetch` to the typed hierarchy. */
export function networkError(error: unknown, context: ErrorContext): IikoError {
  if (error instanceof IikoError) return error;
  const aborted = error instanceof Error && error.name === "AbortError";
  return new IikoNetworkError(aborted ? "Request aborted" : "Network request failed", {
    code: aborted ? "ABORTED" : undefined,
    endpoint: context.endpoint,
    method: context.method,
    requestBody: context.requestBody,
    cause: error,
  });
}
