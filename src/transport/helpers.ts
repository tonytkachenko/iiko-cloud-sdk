import { commandsExtension } from "../extensions/commands.js";
import type { createGeneratedTransport } from "./generated/index.js";

type GeneratedTransport = ReturnType<typeof createGeneratedTransport>;

/**
 * Hand-written helpers that are more than a documented call. Everything else in
 * `transport` comes straight from the generator.
 */
export function withHelpers(transport: GeneratedTransport) {
  return {
    ...transport,
    organizations: {
      ...transport.organizations,

      /**
       * Finds one organization by ID.
       *
       * iiko has no by-id operation: this asks the list endpoint for one ID and
       * returns the single match. Throws the same typed errors as any call.
       *
       * @param id Organization UUID.
       * @param signal Cancels the request.
       */
      async getById(id: string, signal?: AbortSignal) {
        const { organizations } = await transport.organizations.list(
          { organizationIds: [id] },
          { signal },
        );
        return organizations?.find((organization) => organization.id === id);
      },
    },
    commands: {
      ...transport.commands,
      ...commandsExtension(transport.commands.status),
    },
  };
}
