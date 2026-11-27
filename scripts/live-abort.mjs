// Read-only check of caller cancellation (AbortSignal) against the live iiko API.
// It only calls list/get operations; the one bogus call is a read that returns 4xx.
// Run manually with real credentials: it never prints them.
import { createIikoClient, IikoError } from "../dist/index.js";

const { IIKO_APP_ID, IIKO_CLIENT_SECRET, IIKO_API_KEY } = process.env;
if (!IIKO_APP_ID || !IIKO_CLIENT_SECRET || !IIKO_API_KEY) {
  console.error("missing IIKO_APP_ID / IIKO_CLIENT_SECRET / IIKO_API_KEY");
  process.exit(1);
}

let ok = 0;
let failed = 0;

function report(pass, name, detail) {
  if (pass) ok++;
  else failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name}: ${detail}`);
}

function makeClient(events) {
  return createIikoClient({
    appId: IIKO_APP_ID,
    clientSecret: IIKO_CLIENT_SECRET,
    apiKey: IIKO_API_KEY,
    onAttempt: (event) => events.push(event),
  });
}

const reason = new Error("caller cancelled");
const isReason = (error) => error === reason;

// Warm the token cache so the next aborts hit the API request, not token acquisition.
const warmEvents = [];
const warm = makeClient(warmEvents);
const { organizations } = await warm.transport.organizations.list();
report(true, "warm token", `${organizations.length} organization(s) visible`);

// 1. A signal already aborted before the call: the request must not run.
{
  warmEvents.length = 0;
  const controller = new AbortController();
  controller.abort(reason);
  const started = Date.now();
  let error;
  await warm.transport.organizations
    .list({}, { signal: controller.signal })
    .catch((caught) => (error = caught));
  report(
    isReason(error) && warmEvents.length === 1 && !(error instanceof IikoError),
    "pre-aborted signal",
    `${error === reason ? "caller reason" : String(error)} in ${Date.now() - started} ms, ${warmEvents.length} attempt(s)`,
  );
}

// 2. Abort while the request is in flight: must reject at once with the caller's reason.
{
  warmEvents.length = 0;
  const controller = new AbortController();
  const started = Date.now();
  setTimeout(() => controller.abort(reason), 0);
  let error;
  await warm.transport.organizations
    .list({}, { signal: controller.signal })
    .catch((caught) => (error = caught));
  const elapsed = Date.now() - started;
  report(
    isReason(error) && warmEvents.length === 1 && elapsed < 1000,
    "in-flight abort",
    `${error === reason ? "caller reason" : String(error)} in ${elapsed} ms, ${warmEvents.length} attempt(s)`,
  );
}

// 3. Abort a cold client: the token request is not cancellable, so this is best-effort.
{
  const events = [];
  const client = makeClient(events);
  const controller = new AbortController();
  controller.abort(reason);
  const started = Date.now();
  let error;
  await client.transport.organizations
    .list({}, { signal: controller.signal })
    .catch((caught) => (error = caught));
  report(
    isReason(error),
    "cold-client abort (known gap)",
    `${error === reason ? "caller reason" : String(error)} after the token round-trip, ${Date.now() - started} ms, ${events.length} attempt(s) — token acquisition ignores the signal`,
  );
}

console.log(`\nabort check finished: ${ok} ok, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
