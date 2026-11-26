import { resolveConfig, type IikoClientOptions } from "./core/config.js";
import { Transport as CoreTransport } from "./core/transport.js";
import { createTransport, type Transport } from "./transport/index.js";

export interface IikoClient {
  /** Every active iikoCloud Transport API operation, grouped by domain. */
  transport: Transport;
}

/**
 * Creates an iikoCloud client.
 *
 * Credentials are kept in memory only and never logged.
 * API errors are thrown as typed `IikoError` subclasses.
 */
export function createIikoClient(options: IikoClientOptions): IikoClient {
  const config = resolveConfig(options);
  return {
    transport: createTransport(new CoreTransport(config)),
  };
}
