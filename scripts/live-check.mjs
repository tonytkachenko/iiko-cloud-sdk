// Read-only smoke check against the live iikoCloud API.
// Only calls query endpoints: organizations, terminal groups, and an external menu lookup.
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

function report(name, error, summary) {
  if (error) {
    console.log(
      `${name}: ERROR ${error.name} status=${error.status ?? "-"} code=${error.code ?? "-"} correlationId=${error.correlationId ?? "-"}`,
    );
    console.log(`  message: ${error.message}`);
    return;
  }
  console.log(`${name}: ${summary()}`);
}

const organizations = await iiko.organizations.list();
report("organizations", organizations.error, () => {
  const list = organizations.data?.organizations ?? [];
  console.log(`  count: ${list.length}`);
  for (const organization of list.slice(0, 5)) {
    console.log(`  - ${organization.id} ${organization.name ?? ""}`);
  }
  return `${list.length} found`;
});

const organizationId = organizations.data?.organizations?.[0]?.id;
if (organizationId) {
  const terminals = await iiko.terminals.list(organizationId);
  report("terminals", terminals.error, () => {
    const groups = terminals.data?.terminalGroups ?? [];
    console.log(`  organization: ${organizationId}`);
    return `${groups.length} group(s), ${terminals.data?.terminalGroupsInSleep?.length ?? 0} asleep`;
  });

  // A bogus menu id is deliberate: it proves real 4xx bodies map into the error classes.
  const menu = await iiko.menu.getExternalMenu(
    organizationId,
    "00000000-0000-0000-0000-000000000000",
  );
  report("menu (expected 4xx)", menu.error, () => "unexpected success");
}

console.log("read-only check finished");
