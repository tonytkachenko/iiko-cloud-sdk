import { resolveConfig, type IikoClientOptions } from "./core/config.js";
import { Transport as CoreTransport } from "./core/transport.js";
import { createOffice, type Office } from "./office/index.js";
import { createTransport, type Transport } from "./transport/index.js";

export interface IikoClient {
  /** Every active iikoCloud Transport API operation, grouped by domain. */
  transport: Transport;
  /** Every active iikoCloud Office API operation, grouped by domain and subresource. */
  office: Office;
  /** Typed call to any POST operation by path, deprecated ones included. */
  call: CoreTransport["call"];
}

/**
 * Creates an iikoCloud client.
 *
 * Credentials are kept in memory only and never logged.
 * API errors are thrown as typed `IikoError` subclasses.
 */
export function createIikoClient(options: IikoClientOptions): IikoClient {
  const core = new CoreTransport(resolveConfig(options));
  return {
    transport: createTransport(core),
    office: createOffice(core),
    call: core.call.bind(core) as CoreTransport["call"],
  };
}
