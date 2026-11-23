import { createIikoClient } from "iiko-cloud-sdk";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before running this example`);
  return value;
}

const iiko = createIikoClient({
  appId: required("IIKO_APP_ID"),
  clientSecret: required("IIKO_CLIENT_SECRET"),
  apiKey: required("IIKO_API_KEY"),
});

const { data, error } = await iiko.transport.organizations.list();

if (error) {
  // Errors are returned, not thrown. They already contain no credentials.
  console.error(`${error.name}${error.status ? ` ${error.status}` : ""}: ${error.message}`);
  if (error.correlationId) console.error(`correlationId: ${error.correlationId}`);
  process.exit(1);
}

for (const organization of data.organizations ?? []) {
  console.log(organization.id, organization.name);
}
