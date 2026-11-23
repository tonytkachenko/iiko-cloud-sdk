import { describe, expectTypeOf, it } from "vitest";
import type { JsonBody, SuccessBody } from "../src/operation.js";
import type { OrderItem, ProductOrderItem } from "../src/types.js";

type CreateOrderBody = JsonBody<"/api/1/deliveries/create", "post">;
type CreateOrderItem = CreateOrderBody["order"]["items"][number];

describe("response types", () => {
  it("keeps the payload of a documented JSON 200", () => {
    expectTypeOf<SuccessBody<"/api/1/organizations", "post">>().toHaveProperty("organizations");
  });

  it("is void for the one operation documented with an empty 200", () => {
    expectTypeOf<
      SuccessBody<"/api/1/deliveries/update_tracking_link", "post">
    >().toEqualTypeOf<void>();
  });
});

describe("order items", () => {
  it("requires productId and price on a product item", () => {
    const item: ProductOrderItem = { type: "Product", productId: "p-1", price: 0, amount: 1 };
    // @ts-expect-error productId is required for a product item
    const noProduct: ProductOrderItem = { type: "Product", price: 0, amount: 1 };
    // @ts-expect-error price is required for a product item
    const noPrice: ProductOrderItem = { type: "Product", productId: "p-1", amount: 1 };
    expectTypeOf(item).toHaveProperty("productId");
    expectTypeOf(noProduct).toMatchTypeOf<OrderItem>();
    expectTypeOf(noPrice).toMatchTypeOf<OrderItem>();
  });

  it("accepts a typed product item without a cast", () => {
    const item: ProductOrderItem = { type: "Product", productId: "p-1", price: 0, amount: 1 };
    const items: CreateOrderItem[] = [item];
    expectTypeOf(items).toEqualTypeOf<CreateOrderItem[]>();
  });
});
