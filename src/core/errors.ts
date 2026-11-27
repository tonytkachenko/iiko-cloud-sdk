import { redact } from "./redact.js";

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

export class IikoError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly correlationId?: string;
  readonly endpoint?: string;
  readonly method?: string;
  readonly requestBody?: unknown;
  readonly responseBody?: unknown;
  readonly retryAfterMs?: number;

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

/** Any non-2xx answer that does not fit a more specific class. */
export class IikoApiError extends IikoError {}
export class IikoAuthError extends IikoApiError {}
export class IikoValidationError extends IikoApiError {}
export class IikoRateLimitError extends IikoApiError {}
export class IikoServerError extends IikoApiError {}
export class IikoNetworkError extends IikoError {}
export class IikoTimeoutError extends IikoError {}

/** An asynchronous command finished in state `Error`. */
export class IikoCommandError extends IikoError {
  constructor(
    correlationId: string,
    readonly reason?: string,
  ) {
    super(`iiko command ${correlationId} failed${reason ? `: ${reason}` : ""}`, { correlationId });
  }
}

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
  if (status === 401 || status === 402 || status === 403 || status === 423) return IikoAuthError;
  if (status === 408) return IikoTimeoutError;
  if (status === 429) return IikoRateLimitError;
  if (status >= 500) return IikoServerError;
  if (status === 400 || status === 404 || status === 409 || status === 422) {
    return IikoValidationError;
  }
  return IikoApiError;
}

export interface ErrorContext {
  endpoint: string;
  method: string;
  requestBody?: unknown;
}

/** Builds the typed error for a non-2xx response. */
export function responseError(response: Response, body: unknown, context: ErrorContext): IikoError {
  const description =
    field(body, "errorDescription") ??
    field(body, "message") ??
    (typeof body === "string" && body !== "" ? body : undefined);
  const status = response.status;
  const ErrorClass = errorClass(status);
  return new ErrorClass(description ?? `${status} ${response.statusText || "request failed"}`, {
    status,
    code: field(body, "error") ?? field(body, "code") ?? field(body, "errorCode"),
    correlationId: field(body, "correlationId"),
    endpoint: context.endpoint,
    method: context.method,
    requestBody: context.requestBody,
    responseBody: body,
    retryAfterMs: retryAfterMs(response),
  });
}
