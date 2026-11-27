import { createIikoClient, IikoError } from "iiko-cloud-sdk";

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

try {
  const { organizations } = await iiko.transport.organizations.list();

  for (const organization of organizations ?? []) {
    console.log(organization.id, organization.name);
  }
} catch (error) {
  // Errors are thrown as typed classes and never contain credentials.
  if (error instanceof IikoError) {
    console.error(`${error.name}${error.status ? ` ${error.status}` : ""}: ${error.message}`);
    if (error.correlationId) console.error(`correlationId: ${error.correlationId}`);
  } else {
    console.error(error);
  }
  process.exit(1);
}
