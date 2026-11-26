import type { Transport as CoreTransport } from "../core/transport.js";
import { createGeneratedTransport } from "./generated/index.js";
import { withHelpers } from "./helpers.js";

/** The public Transport API surface: generated domains plus the helpers. */
export type Transport = ReturnType<typeof withHelpers>;

export function createTransport(transport: CoreTransport): Transport {
  return withHelpers(createGeneratedTransport(transport));
}
