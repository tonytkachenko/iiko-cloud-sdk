import type { components } from "./generated/schema.js";

type Schemas = components["schemas"];
type CreateOrder = "iikoTransport.PublicApi.Contracts.Deliveries.Request.CreateOrder";

/**
 * One line of a delivery order. The base schema only carries `type` and `amount`;
 * `productId` and `price` live on `ProductOrderItem`.
 */
export type OrderItem = Schemas[`${CreateOrder}.OrderItem`];

/**
 * A product line. Build these and pass them as `items`: a `ProductOrderItem` is
 * structurally an `OrderItem`, so the body type accepts it without a cast.
 */
export type ProductOrderItem = Schemas[`${CreateOrder}.ProductOrderItem`];

/** A compound line (a main component with an optional minor one). */
export type CompoundOrderItem = Schemas[`${CreateOrder}.CompoundOrderItem`];
