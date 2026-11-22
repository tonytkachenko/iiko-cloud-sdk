export interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/** Logging is off unless the consumer passes a logger. */
export const noopLogger: ILogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};
