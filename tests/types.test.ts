import { describe, expectTypeOf, it } from "vitest";
import type {
  CommandStatus,
  DeliveriesCreateParams,
  NomenclatureProductListV2Params,
  RequestOf,
  ResponseOf,
} from "../src/index.js";

type CreateOrderBody = RequestOf<"/api/1/deliveries/create">;
type CreateOrderItem = NonNullable<CreateOrderBody["order"]["items"]>[number];
type CreateOrderPayment = NonNullable<NonNullable<CreateOrderBody["order"]>["payments"]>[number];
type CreateOrderCustomer = NonNullable<NonNullable<CreateOrderBody["order"]>["customer"]>;

describe("response types", () => {
  it("keeps the payload of a documented JSON 200", () => {
    expectTypeOf<ResponseOf<"/api/1/organizations">>().toHaveProperty("organizations");
  });

  it("is void for the one operation documented with an empty 200", () => {
    expectTypeOf<ResponseOf<"/api/1/deliveries/update_tracking_link">>().toEqualTypeOf<void>();
  });
});

describe("request types", () => {
  it("is undefined for a body-less operation", () => {
    expectTypeOf<RequestOf<"/api/2/menu">>().toEqualTypeOf<undefined>();
  });

  it("exports a named type per operation that matches the path type", () => {
    expectTypeOf<DeliveriesCreateParams>().toEqualTypeOf<CreateOrderBody>();
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

describe("payments", () => {
  it("is a discriminated union of the known kinds", () => {
    expectTypeOf<CreateOrderPayment["paymentTypeKind"]>().toEqualTypeOf<
      "Cash" | "Card" | "LoyaltyCard" | "External" | "Credit"
    >();

    const cash: CreateOrderPayment = { paymentTypeKind: "Cash", sum: 10, paymentTypeId: "p" };
    // @ts-expect-error a kind that is not in the discriminator mapping
    const bitcoin: CreateOrderPayment = { paymentTypeKind: "Bitcoin", sum: 10, paymentTypeId: "p" };
    // @ts-expect-error sum is required on every variant
    const noSum: CreateOrderPayment = { paymentTypeKind: "Cash", paymentTypeId: "p" };
    void [cash, bitcoin, noSum];
  });
});

describe("customers", () => {
  it("keeps the variant fields of a nested union", () => {
    expectTypeOf<CreateOrderCustomer["type"]>().toEqualTypeOf<"regular" | "one-time">();

    const regular: CreateOrderCustomer = { type: "regular", id: "c1", name: "Ann" };
    const anonymous: CreateOrderCustomer = { type: "one-time", name: "Guest" };
    // @ts-expect-error the one-time variant requires a name
    const nameless: CreateOrderCustomer = { type: "one-time" };
    // @ts-expect-error surname belongs to the regular variant only
    const mixed: CreateOrderCustomer = { type: "one-time", name: "Guest", surname: "Lee" };
    void [regular, anonymous, nameless, mixed];
  });
});

describe("command status", () => {
  it("narrows by state", () => {
    const status = {} as CommandStatus;
    if (status.state === "Error") expectTypeOf(status).toHaveProperty("errorReason");
    expectTypeOf<CommandStatus["state"]>().toEqualTypeOf<"InProgress" | "Success" | "Error">();
  });
});

describe("filters", () => {
  it("suggests the documented comparison operators", () => {
    type Filter = NonNullable<NomenclatureProductListV2Params["filters"]>[number];

    const filter: Filter = { field: "type", op: "in", values: ["DISH"] };
    // @ts-expect-error an operator iiko does not document
    const unknown: Filter = { field: "type", op: "includes", values: ["DISH"] };

    expectTypeOf<NonNullable<Filter["op"]>>().toEqualTypeOf<
      "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin" | "like" | "blank" | "notblank"
    >();
    void [filter, unknown];
  });
});
