// Read-only check of an expired Bearer token against the live iiko API.
// It reuses a real client token and swaps in the stale one for the first API attempt,
// so it exercises the SDK's 401 -> invalidate -> replay path without any writes.
import { createIikoClient, IikoAuthError } from "../dist/index.js";

const { IIKO_APP_ID, IIKO_CLIENT_SECRET, IIKO_API_KEY, IIKO_EXPIRED_TOKEN } = process.env;
if (!IIKO_APP_ID || !IIKO_CLIENT_SECRET || !IIKO_API_KEY || !IIKO_EXPIRED_TOKEN) {
  console.error("missing IIKO_APP_ID / IIKO_CLIENT_SECRET / IIKO_API_KEY / IIKO_EXPIRED_TOKEN");
  process.exit(1);
}

const stale = IIKO_EXPIRED_TOKEN;
const mask = (text) => String(text).replaceAll(stale, "[redacted]");
const API = "https://api-ru.iiko.services/api/1/organizations";

let ok = 0;
let failed = 0;

function report(pass, name, detail) {
  if (pass) ok++;
  else failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name}: ${mask(detail)}`);
}

// 1. What iiko itself answers for the stale token, called outside the SDK.
{
  const response = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${stale}`, "Content-Type": "application/json" },
    body: "{}",
  });
  const text = await response.text();
  let description = text.slice(0, 160);
  try {
    const body = JSON.parse(text);
    description = [body.error, body.errorDescription ?? body.message].filter(Boolean).join(": ");
  } catch {
    // keep the raw prefix
  }
  report(response.status === 401, "expired token at the API", `${response.status} ${description}`);
}

// 2. The SDK must treat the stale token as 401, drop the cache and replay once.
{
  const events = [];
  let swapped = false;
  const client = createIikoClient({
    appId: IIKO_APP_ID,
    clientSecret: IIKO_CLIENT_SECRET,
    apiKey: IIKO_API_KEY,
    onAttempt: (event) => events.push(event),
    fetch: (input, init) => {
      const url = String(input);
      if (!swapped && !url.includes("/api/v2/access_token")) {
        swapped = true;
        const headers = new Headers(init?.headers);
        headers.set("Authorization", `Bearer ${stale}`);
        return fetch(input, { ...init, headers });
      }
      return fetch(input, init);
    },
  });

  const result = await client.transport.organizations.list().catch((error) => ({ error }));
  const calls = events.filter((event) => !event.path.includes("access_token"));
  const tokens = events.filter((event) => event.path.includes("access_token"));
  const statuses = calls.map((event) => event.status ?? "no-status");

  report(
    !("error" in result) && statuses.join(",") === "401,200" && tokens.length === 2,
    "stale token -> one 401 -> fresh token -> replay",
    `api attempts [${statuses.join(", ")}], token requests ${tokens.length}, result ${
      "error" in result ? String(result.error) : "ok"
    }`,
  );
}

// 3. A token that stays stale: exactly one replay, then IikoAuthError with status 401.
{
  const events = [];
  const client = createIikoClient({
    appId: IIKO_APP_ID,
    clientSecret: IIKO_CLIENT_SECRET,
    apiKey: IIKO_API_KEY,
    onAttempt: (event) => events.push(event),
    fetch: (input, init) => {
      const url = String(input);
      if (url.includes("/api/v2/access_token")) return fetch(input, init);
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${stale}`);
      return fetch(input, { ...init, headers });
    },
  });

  const error = await client.transport.organizations.list().catch((caught) => caught);
  const calls = events.filter((event) => !event.path.includes("access_token"));
  const statuses = calls.map((event) => event.status ?? "no-status");

  report(
    error instanceof IikoAuthError &&
      error.status === 401 &&
      statuses.join(",") === "401,401" &&
      calls.length === 2,
    "permanently stale token",
    `${error instanceof IikoAuthError ? "IikoAuthError" : String(error)} status=${
      error?.status ?? "-"
    }, api attempts [${statuses.join(", ")}], no third attempt`,
  );
}

console.log(`\nexpired-token check finished: ${ok} ok, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
