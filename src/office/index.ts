import type { Transport } from "../core/transport.js";
import { createGeneratedOffice } from "./generated/index.js";

/** The public Office API surface: every generated domain and subresource. */
export type Office = ReturnType<typeof createGeneratedOffice>;

export function createOffice(transport: Transport): Office {
  return createGeneratedOffice(transport);
}
