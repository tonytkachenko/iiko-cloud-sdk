import type { HttpClient } from "../http.js";
import { createGeneratedTransport } from "./generated/index.js";
import { withHelpers } from "./helpers.js";

/** The public Transport API surface: every generated domain plus the helpers. */
export type Transport = ReturnType<typeof withHelpers>;

export function createTransport(http: HttpClient): Transport {
  return withHelpers(createGeneratedTransport(http));
}
