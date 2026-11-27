// Read-only smoke check against the live iikoCloud API.
// Uses only list/lookup operations from both services; run it manually with real keys.
import { createIikoClient } from "../dist/index.js";

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

const failure = (error) =>
  `${error.name} status=${error.status ?? "-"} code=${error.code ?? "-"} ` +
  `correlationId=${error.correlationId ?? "-"}: ${error.message}`;

async function check(name, run) {
  try {
    console.log(`${name}: ${await run()}`);
  } catch (error) {
    console.log(`${name}: ERROR ${failure(error)}`);
  }
}

let organizationId;

await check("organizations", async () => {
  const { organizations } = await iiko.transport.organizations.list();
  organizationId = organizations[0]?.id;
  for (const organization of organizations.slice(0, 5)) {
    console.log(`  - ${organization.id} ${organization.name ?? ""}`);
  }
  return `${organizations.length} found`;
});

if (organizationId) {
  await check("terminal groups", async () => {
    const { terminalGroups, terminalGroupsInSleep } = await iiko.transport.terminalGroups.list({
      organizationIds: [organizationId],
    });
    return `${terminalGroups.length} group(s), ${terminalGroupsInSleep.length} asleep`;
  });

  // A bogus menu id is deliberate: it proves a real 4xx body maps to a typed error.
  await check("menu (expected 4xx)", async () => {
    await iiko.transport.menu.byIdV3({
      organizationId,
      externalMenuId: "00000000-0000-0000-0000-000000000000",
    });
    return "unexpected success";
  });
}

await check("office nomenclature products", async () => {
  const { products } = await iiko.office.nomenclature.product.listV2({ limit: 1 });
  return `${products?.length ?? 0} product(s) in one page`;
});

await check("office inventory storages", async () => {
  const { stores } = await iiko.office.inventory.storages.listV2({ limit: 1 });
  return `${stores?.length ?? 0} store(s)`;
});

console.log("read-only check finished");
