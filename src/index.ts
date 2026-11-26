export { createIikoClient } from "./client.js";
export type { IikoClient } from "./client.js";
export type { IikoClientOptions } from "./core/config.js";
export type { CallArgs, CallOptions, Path, RequestOf, ResponseOf } from "./core/types.js";
export type { AttemptEvent } from "./core/transport.js";
export type { Transport } from "./transport/index.js";

export {
  IikoError,
  IikoApiError,
  IikoAuthError,
  IikoValidationError,
  IikoRateLimitError,
  IikoServerError,
  IikoNetworkError,
  IikoTimeoutError,
  IikoCommandError,
} from "./core/errors.js";

export type { ILogger } from "./logger.js";

export type * from "./transport/generated/types.js";
export type * from "./office/generated/types.js";
