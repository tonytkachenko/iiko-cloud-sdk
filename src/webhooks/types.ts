import type { components } from "../generated/schema.js";

type Schemas = components["schemas"];

/** Shared envelope of an iiko webhook event. */
interface WebhookEventBase {
  /** Event date and time (UTC), `yyyy-MM-dd HH:mm:ss.fff`. */
  eventTime: string;
  /** Organization the event belongs to. */
  organizationId: string;
  /** Operation ID for tracing. */
  correlationId: string;
}

/** Event types with a payload schema in the spec's `x-webhooks`. */
export type WebhookEventType =
  | "DeliveryOrderUpdate"
  | "DeliveryOrderError"
  | "ReserveUpdate"
  | "ReserveError"
  | "TableOrderUpdate"
  | "TableOrderError"
  | "StopListUpdate"
  | "PersonalShift";

/**
 * Event types from the spec's `WebHookEventType` enum without a payload schema.
 * The parser returns them as {@link UnsupportedWebhookEvent} instead of rejecting a valid event.
 */
export type UnsupportedWebhookEventType =
  | "KitchenOrderUpdate"
  | "NomenclatureUpdate"
  | "BusinessHoursAndMappingUpdate";

type OrderInfo = Schemas["iikoTransport.PublicApi.Contracts.Deliveries.Response.Order.OrderInfo"];
type ReserveInfo = Schemas["iikoTransport.PublicApi.Contracts.Reserves.ReserveInfo"];
type TableOrderInfo =
  Schemas["iikoTransport.PublicApi.Contracts.TableOrders.Response.TableOrderInfo"];
type StopListChange =
  Schemas["iikoTransport.PublicApi.Contracts.StopLists.WebHookOnStopListChangeData"];
type PersonalShift = Schemas["iikoTransport.PublicApi.Contracts.Employees.PersonalShift"];

export type DeliveryOrderUpdateEvent = WebhookEventBase & {
  eventType: "DeliveryOrderUpdate";
  eventInfo: OrderInfo;
};

export type DeliveryOrderErrorEvent = WebhookEventBase & {
  eventType: "DeliveryOrderError";
  eventInfo: OrderInfo;
};

export type ReserveUpdateEvent = WebhookEventBase & {
  eventType: "ReserveUpdate";
  eventInfo: ReserveInfo;
};

export type ReserveErrorEvent = WebhookEventBase & {
  eventType: "ReserveError";
  eventInfo: ReserveInfo;
};

export type TableOrderUpdateEvent = WebhookEventBase & {
  eventType: "TableOrderUpdate";
  eventInfo: TableOrderInfo;
};

export type TableOrderErrorEvent = WebhookEventBase & {
  eventType: "TableOrderError";
  eventInfo: TableOrderInfo;
};

export type StopListUpdateEvent = WebhookEventBase & {
  eventType: "StopListUpdate";
  eventInfo: StopListChange;
};

export type PersonalShiftEvent = WebhookEventBase & {
  eventType: "PersonalShift";
  eventInfo: PersonalShift;
};

/** An event with a documented `eventType` but no payload schema in `x-webhooks`. */
export type UnsupportedWebhookEvent = WebhookEventBase & {
  eventType: UnsupportedWebhookEventType;
  eventInfo: unknown;
};

/** Every event the webhook parser can return. */
export type WebhookEvent =
  | DeliveryOrderUpdateEvent
  | DeliveryOrderErrorEvent
  | ReserveUpdateEvent
  | ReserveErrorEvent
  | TableOrderUpdateEvent
  | TableOrderErrorEvent
  | StopListUpdateEvent
  | PersonalShiftEvent
  | UnsupportedWebhookEvent;

export const WEBHOOK_EVENT_TYPES = [
  "DeliveryOrderUpdate",
  "DeliveryOrderError",
  "ReserveUpdate",
  "ReserveError",
  "TableOrderUpdate",
  "TableOrderError",
  "StopListUpdate",
  "PersonalShift",
] as const satisfies readonly WebhookEventType[];

export const UNSUPPORTED_WEBHOOK_EVENT_TYPES = [
  "KitchenOrderUpdate",
  "NomenclatureUpdate",
  "BusinessHoursAndMappingUpdate",
] as const satisfies readonly UnsupportedWebhookEventType[];
