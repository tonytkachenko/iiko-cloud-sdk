export { createIikoClient } from "./client.js";
export type { IikoClient, IikoClientOptions } from "./client.js";
export type { IikoResult } from "./http.js";
export type { CallArgs, CallOptions, Path, RequestOf, ResponseOf } from "./core/types.js";
export type { Transport } from "./transport/index.js";
export type * from "./transport/generated/types.js";
export type * from "./office/generated/types.js";

export {
  IikoError,
  IikoAuthError,
  IikoValidationError,
  IikoRateLimitError,
  IikoServerError,
  IikoNetworkError,
  IikoTimeoutError,
} from "./errors.js";

export type { ILogger } from "./logger.js";
