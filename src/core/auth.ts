export interface TokenProvider {
  /** The first caller's timeout applies while a token request is in flight. */
  getToken(timeoutSec?: number): Promise<string>;
  /** Drops the cached token so the next call fetches a new one. */
  invalidate(): void;
}

/** Refresh this long before the JWT expires, capped at half the remaining TTL. */
const REFRESH_MARGIN_MS = 5 * 60_000;
/** Cache a token whose reported expiry is already past, so clock skew does not fetch per call. */
const CLOCK_SKEW_CACHE_MS = 30_000;
/** iiko tokens live one hour; used when `exp` cannot be read. */
const FALLBACK_TTL_MS = 60 * 60_000;

/**
 * Reads `exp` from the JWT payload.
 * shortcut: no signature verification and no support for opaque tokens;
 * an unreadable token falls back to the one-hour TTL.
 */
export function tokenExpiryMs(token: string): number | undefined {
  const payload = token.split(".")[1];
  if (!payload) return undefined;
  try {
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: unknown;
    };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

/** Caches the session token and shares one request between parallel callers. */
export class AuthService implements TokenProvider {
  #token?: CachedToken;
  #pending?: Promise<string>;

  constructor(private readonly fetchToken: (timeoutSec?: number) => Promise<string>) {}

  getToken(timeoutSec?: number): Promise<string> {
    if (this.#token && this.#token.expiresAt > Date.now()) {
      return Promise.resolve(this.#token.value);
    }
    // Single-flight: a caller that joins an in-flight request shares its timeout.
    this.#pending ??= this.fetchToken(timeoutSec)
      .then((value) => {
        const now = Date.now();
        const expiry = tokenExpiryMs(value);
        const ttl = expiry === undefined ? FALLBACK_TTL_MS : expiry - now;
        const margin = Math.min(REFRESH_MARGIN_MS, Math.max(ttl / 2, 0));
        this.#token = {
          value,
          expiresAt: ttl <= 0 ? now + CLOCK_SKEW_CACHE_MS : now + Math.max(ttl - margin, 0),
        };
        return value;
      })
      .finally(() => {
        this.#pending = undefined;
      });
    return this.#pending;
  }

  invalidate(): void {
    this.#token = undefined;
  }
}
