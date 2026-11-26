import { describe, expectTypeOf, it } from "vitest";
import type { RequestOf, ResponseOf } from "../src/index.js";

type CreateOrderBody = RequestOf<"/api/1/deliveries/create">;
type CreateOrderItem = NonNullable<CreateOrderBody["order"]["items"]>[number];

describe("response types", () => {
  it("keeps the payload of a documented JSON 200", () => {
    expectTypeOf<ResponseOf<"/api/1/organizations">>().toHaveProperty("organizations");
  });

  it("is void for the one operation documented with an empty 200", () => {
    expectTypeOf<ResponseOf<"/api/1/deliveries/update_tracking_link">>().toEqualTypeOf<void>();
  });
});

describe("order items", () => {
  it("requires productId and price on a product item", () => {
    const item: CreateOrderItem = { type: "Product", productId: "p-1", price: 0, amount: 1 };
    // @ts-expect-error productId is required for a product item
    const noProduct: CreateOrderItem = { type: "Product", price: 0, amount: 1 };
    // @ts-expect-error price is required for a product item
    const noPrice: CreateOrderItem = { type: "Product", productId: "p-1", amount: 1 };
    expectTypeOf(item).toHaveProperty("productId");
    expectTypeOf(noProduct).toEqualTypeOf<CreateOrderItem>();
    expectTypeOf(noPrice).toEqualTypeOf<CreateOrderItem>();
  });

  it("accepts a typed product item without a cast", () => {
    const item: CreateOrderItem = { type: "Product", productId: "p-1", price: 0, amount: 1 };
    const items: CreateOrderItem[] = [item];
    expectTypeOf(items).toEqualTypeOf<CreateOrderItem[]>();
  });
});
