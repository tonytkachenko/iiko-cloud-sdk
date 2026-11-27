import { createIikoClient, IikoError, type RequestOf } from "iiko-cloud-sdk";

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

type CreateOrderBody = RequestOf<"/api/1/deliveries/create">;
type OrderItem = NonNullable<NonNullable<CreateOrderBody["order"]>["items"]>[number];

function productItem(productId: string, price: number): OrderItem {
  return { type: "Product", productId, price, amount: 1 };
}

try {
  const { organizations } = await iiko.transport.organizations.list();
  const organizationId = organizations[0]?.id;
  if (!organizationId) throw new Error("iiko: the API key sees no organizations");

  const { terminalGroups } = await iiko.transport.terminalGroups.list({
    organizationIds: [organizationId],
  });
  const terminalGroupId = terminalGroups[0]?.items[0]?.id;
  if (!terminalGroupId) throw new Error("iiko: no terminal groups for this organization");

  const menu = await iiko.transport.menu.byIdV3({
    organizationId,
    externalMenuId: required("IIKO_EXTERNAL_MENU_ID"),
  });
  const productId = menu.products?.[0]?.id;
  if (!productId) throw new Error("iiko: the menu is empty");

  const { correlationId, orderInfo } = await iiko.transport.deliveries.create({
    organizationId,
    terminalGroupId,
    order: {
      phone: "+10000000000",
      orderServiceType: "DeliveryByCourier",
      items: [productItem(productId, 0)],
    },
  });

  // Most mutations are commands: the front answers before the order is ready.
  const status = await iiko.transport.commands.wait({ organizationId, correlationId });
  console.log("command:", status.state);

  const { orders } = await iiko.transport.deliveries.byId({
    organizationId,
    orderIds: [orderInfo.id],
  });
  console.log("orders:", orders.length);

  await iiko.transport.deliveries.cancel({ organizationId, orderId: orderInfo.id });
  console.log("cancelled");
} catch (error) {
  if (error instanceof IikoError) {
    console.error(`${error.name} ${error.status ?? ""}: ${error.message}`, error.correlationId);
    process.exit(1);
  }
  throw error;
}
