import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  UNSUPPORTED_WEBHOOK_EVENT_TYPES,
  WEBHOOK_EVENT_TYPES,
  type DeliveryOrderUpdateEvent,
  type UnsupportedWebhookEvent,
  type UnsupportedWebhookEventType,
  type WebhookEvent,
  type WebhookEventType,
} from "../src/index.js";

interface WebhookSchema {
  enum?: string[];
  properties?: {
    eventType?: {
      enum?: string[];
      example?: string;
      type?: string;
    };
  };
}

const spec = JSON.parse(
  readFileSync(fileURLToPath(new URL("../spec/raw.json", import.meta.url)), "utf8"),
) as {
  "x-webhooks"?: Record<string, unknown>;
  components: { schemas: Record<string, WebhookSchema> };
};

const eventTypeOf = (schema: string) => {
  const eventType = spec.components.schemas[schema]?.properties?.eventType;
  return (
    eventType?.enum?.[0] ??
    eventType?.example ??
    /^constant string '(.+)'$/.exec(eventType?.type ?? "")?.[1]
  );
};

describe("webhook types", () => {
  it("covers every x-webhooks event and every enum-only type", () => {
    const fromSpec = Object.keys(spec["x-webhooks"] ?? {})
      .map(eventTypeOf)
      .filter((type): type is string => type !== undefined)
      .toSorted();

    expect(WEBHOOK_EVENT_TYPES.toSorted()).toEqual(fromSpec);

    const enumValues =
      spec.components.schemas[
        "iikoTransport.PublicApi.Contracts.WebHooks.WebHookEventType"
      ]?.enum?.toSorted();
    expect(UNSUPPORTED_WEBHOOK_EVENT_TYPES.toSorted()).toEqual(
      enumValues?.filter((type) => !fromSpec.includes(type)),
    );
  });

  it("narrows a supported event by eventType", () => {
    const event: DeliveryOrderUpdateEvent = {
      eventType: "DeliveryOrderUpdate",
      eventTime: "2026-10-09 14:15:22.123",
      organizationId: "org",
      correlationId: "correlation",
      eventInfo: {
        id: "order",
        organizationId: "org",
        timestamp: 1,
        creationStatus: "InProgress",
      },
    };

    expectTypeOf(event.eventType).toEqualTypeOf<"DeliveryOrderUpdate">();
    expectTypeOf(event.eventInfo).toHaveProperty("creationStatus");

    const union: WebhookEvent = event;
    if (union.eventType === "DeliveryOrderUpdate") {
      expectTypeOf(union.eventInfo).toHaveProperty("creationStatus");
    }
  });

  it("keeps the enum-only events as unsupported", () => {
    const event: UnsupportedWebhookEvent = {
      eventType: "NomenclatureUpdate",
      eventTime: "2026-10-09 14:15:22.123",
      organizationId: "org",
      correlationId: "correlation",
      eventInfo: { changed: true },
    };

    expectTypeOf(event.eventType).toEqualTypeOf<UnsupportedWebhookEventType>();
    expectTypeOf(event.eventInfo).toEqualTypeOf<unknown>();

    // @ts-expect-error an enum-only event is not one of the supported types
    const supported: WebhookEventType = "NomenclatureUpdate";
    void supported;
  });
});
