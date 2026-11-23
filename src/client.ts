import { AuthService } from "./auth.js";
import { resolveConfig, type IikoClientOptions } from "./config.js";
import { HttpClient } from "./http.js";
import { createTransport, type Transport } from "./transport/index.js";

export type { IikoClientOptions } from "./config.js";

export interface IikoClient {
  /** Every active iikoCloud Transport API operation, grouped by domain. */
  transport: Transport;
}

/**
 * Creates an iikoCloud client.
 *
 * Credentials are kept in memory only and never logged.
 * API errors come back in `error`; they are never thrown.
 */
export function createIikoClient(options: IikoClientOptions): IikoClient {
  const config = resolveConfig(options);
  const auth = new AuthService({
    appId: config.appId,
    clientSecret: config.clientSecret,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    fetch: config.fetch,
    logger: config.logger,
  });
  const http = new HttpClient(config, auth);

  return {
    transport: createTransport(http),
  };
}
