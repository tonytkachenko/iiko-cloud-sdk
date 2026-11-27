// Read-only smoke check against the live iikoCloud API.
// Only list/get operations are called; nothing here creates, updates or cancels.
// Run manually with real credentials: it never prints them.
import { createIikoClient, IikoValidationError } from "../dist/index.js";

const { IIKO_APP_ID, IIKO_CLIENT_SECRET, IIKO_API_KEY } = process.env;
if (!IIKO_APP_ID || !IIKO_CLIENT_SECRET || !IIKO_API_KEY) {
  console.error("missing IIKO_APP_ID / IIKO_CLIENT_SECRET / IIKO_API_KEY");
  process.exit(1);
}

const iiko = createIikoClient({
  appId: IIKO_APP_ID,
  clientSecret: IIKO_CLIENT_SECRET,
  apiKey: IIKO_API_KEY,
});

let ok = 0;
let failed = 0;

const failure = (error) =>
  [
    error.name,
    `status=${error.status ?? "-"}`,
    `code=${error.code ?? "-"}`,
    `correlationId=${error.correlationId ?? "-"}`,
    error.message,
  ].join(" ");

async function check(name, run) {
  try {
    const summary = await run();
    ok++;
    console.log(`ok   ${name}: ${summary}`);
    return true;
  } catch (error) {
    failed++;
    console.log(`FAIL ${name}: ${failure(error)}`);
    return false;
  }
}

let organizationId;

const organizationsOk = await check("transport.organizations.list", async () => {
  const { organizations } = await iiko.transport.organizations.list();
  organizationId = organizations[0]?.id;
  return `${organizations.length} visible`;
});

if (organizationsOk && organizationId) {
  const organizationIds = [organizationId];

  await check("transport.terminalGroups.list", async () => {
    const { terminalGroups, terminalGroupsInSleep } = await iiko.transport.terminalGroups.list({
      organizationIds,
    });
    return `${terminalGroups.length} group(s), ${terminalGroupsInSleep.length} asleep`;
  });

  await check("transport.deliveries.orderTypes", async () => {
    const { orderTypes } = await iiko.transport.deliveries.orderTypes({ organizationIds });
    return `${orderTypes.length} order type(s)`;
  });

  await check("transport.stopLists.list", async () => {
    const { terminalGroupStopLists } = await iiko.transport.stopLists.list({ organizationIds });
    return `${terminalGroupStopLists.length} terminal group stop list(s)`;
  });

  await check("transport.dictionaries.paymentTypes", async () => {
    const { paymentTypes } = await iiko.transport.dictionaries.paymentTypes({ organizationIds });
    return `${paymentTypes.length} payment type(s)`;
  });

  await check("transport.addresses.cities", async () => {
    const { cities } = await iiko.transport.addresses.cities({ organizationIds });
    return `${cities.length} city/cities`;
  });

  // A bogus menu id is deliberate: it proves a real 4xx body maps to a typed error.
  await check("transport.menu.byIdV3 (expected 4xx)", async () => {
    try {
      await iiko.transport.menu.byIdV3({
        organizationId,
        externalMenuId: "00000000-0000-0000-0000-000000000000",
      });
    } catch (error) {
      if (error instanceof IikoValidationError) {
        return `typed 400 with correlationId=${error.correlationId ?? "-"}`;
      }
      throw error;
    }
    return "unexpected success (bogus menu id resolved?)";
  });
}

await check("office.nomenclature.product.listV2", async () => {
  const { items, totalCount } = await iiko.office.nomenclature.product.listV2({ limit: 1 });
  return `${items?.length ?? 0} product(s) in one page, total=${totalCount ?? "-"}`;
});

await check("office.inventory.storages.listV2", async () => {
  const { stores } = await iiko.office.inventory.storages.listV2({ limit: 1 });
  return `${stores?.length ?? 0} store(s)`;
});

console.log(`\nread-only check finished: ${ok} ok, ${failed} failed`);
if (!organizationsOk) process.exitCode = 1;
