import { IikoAuthError } from "./errors.js";
import type { ILogger } from "./logger.js";

export interface TokenProvider {
  getToken(): Promise<string>;
  /** Drops the cached token so the next call fetches a new one. */
  invalidate(): void;
}

export interface AuthServiceOptions {
  appId: string;
  clientSecret: string;
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  fetch: typeof fetch;
  logger: ILogger;
}

/** Refresh this long before the JWT expires. */
const REFRESH_MARGIN_MS = 60_000;

/**
 * Reads `exp` from the JWT payload.
 * shortcut: no signature verification and no support for opaque tokens;
 * an unreadable token just falls back to refreshing on 401.
 */
export function tokenExpiryMs(token: string): number | undefined {
  const payload = token.split(".")[1];
  if (!payload) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: unknown;
    };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

interface CachedToken {
  value: string;
  expiresAt?: number;
}

export class AuthService implements TokenProvider {
  #token?: CachedToken;
  #pending?: Promise<string>;

  constructor(private readonly options: AuthServiceOptions) {}

  getToken(): Promise<string> {
    const cached = this.#token;
    if (cached && !this.#expiring(cached)) return Promise.resolve(cached.value);

    // Single-flight: every concurrent caller shares one token request.
    this.#pending ??= this.#request()
      .then((token) => {
        this.#token = token;
        return token.value;
      })
      .finally(() => {
        this.#pending = undefined;
      });
    return this.#pending;
  }

  invalidate(): void {
    this.#token = undefined;
  }

  #expiring(token: CachedToken): boolean {
    return token.expiresAt !== undefined && token.expiresAt - REFRESH_MARGIN_MS <= Date.now();
  }

  async #request(): Promise<CachedToken> {
    const { appId, clientSecret, apiKey, baseUrl, timeoutMs, fetch, logger } = this.options;
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/v2/access_token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appId, clientSecret, apiKey }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      throw new IikoAuthError("iiko: could not reach the access token endpoint", {
        endpoint: "/api/v2/access_token",
        method: "POST",
        cause,
      });
    }

    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const description =
        body !== null && typeof body === "object"
          ? ((body as Record<string, unknown>).errorDescription as string | undefined)
          : undefined;
      throw new IikoAuthError(description ?? "iiko: access token request was rejected", {
        status: response.status,
        endpoint: "/api/v2/access_token",
        method: "POST",
        responseBody: body,
      });
    }

    const token =
      body !== null && typeof body === "object"
        ? (body as Record<string, unknown>).token
        : undefined;
    if (typeof token !== "string" || token === "") {
      throw new IikoAuthError("iiko: access token response did not contain a token", {
        status: response.status,
        endpoint: "/api/v2/access_token",
        method: "POST",
        responseBody: body,
      });
    }

    logger.debug("iiko: access token acquired", { expiresAt: tokenExpiryMs(token) });
    return { value: token, expiresAt: tokenExpiryMs(token) };
  }
}
