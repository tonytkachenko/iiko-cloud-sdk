export interface TokenProvider {
  getToken(): Promise<string>;
  /** Drops the cached token so the next call fetches a new one. */
  invalidate(): void;
}

/** Refresh this long before the JWT expires. */
const REFRESH_MARGIN_MS = 5 * 60_000;
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

  constructor(private readonly fetchToken: () => Promise<string>) {}

  getToken(): Promise<string> {
    if (this.#token && this.#token.expiresAt > Date.now()) {
      return Promise.resolve(this.#token.value);
    }
    this.#pending ??= this.fetchToken()
      .then((value) => {
        this.#token = {
          value,
          expiresAt: (tokenExpiryMs(value) ?? Date.now() + FALLBACK_TTL_MS) - REFRESH_MARGIN_MS,
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
