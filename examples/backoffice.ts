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

const PAGE_SIZE = 100;

try {
  let offset = 0;
  let total = 0;

  do {
    const page = await iiko.office.nomenclature.product.listV2({
      filters: [{ field: "type", op: "in", values: ["DISH"] }],
      limit: PAGE_SIZE,
      offset,
    });
    total = page.totalCount ?? 0;
    offset += PAGE_SIZE;
    console.log(`${page.items?.length ?? 0} products, ${offset} of ${total}`);
  } while (offset < total);

  const { stores } = await iiko.office.inventory.storages.listV2({ limit: 0 });
  for (const store of stores ?? []) {
    console.log(store.id, store.name, store.deleted ? "(deleted)" : "");
  }
} catch (error) {
  if (error instanceof IikoError) {
    console.error(`${error.name} ${error.status ?? ""}: ${error.message}`, error.correlationId);
    process.exit(1);
  }
  throw error;
}
