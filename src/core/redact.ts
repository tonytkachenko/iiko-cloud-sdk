const SECRET_KEY = /^(appId|clientSecret|apiKey|authorization|token)$/i;
const BEARER = /(Bearer\s+)[\w.~+/-]+=*/gi;
const REDACTED = "[redacted]";

/**
 * Replaces credentials found in keys or `Bearer` values, recursively.
 * Other body data (names, phones, addresses) is not redacted.
 */
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return value.replace(BEARER, `$1${REDACTED}`);
  if (Array.isArray(value)) return value.map((item) => redact(item, seen));
  if (value !== null && typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = SECRET_KEY.test(key) ? REDACTED : redact(item, seen);
    }
    return result;
  }
  return value;
}
