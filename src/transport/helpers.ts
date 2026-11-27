import { commandsExtension } from "../extensions/commands.js";
import type { createGeneratedTransport } from "./generated/index.js";

type GeneratedTransport = ReturnType<typeof createGeneratedTransport>;

/**
 * Hand-written helpers that are more than a documented call. Everything else in
 * `transport` comes straight from the generator.
 */
export function withHelpers(transport: GeneratedTransport) {
  // The generator does not know about hand-written helpers; fail fast instead of shadowing.
  if ("getById" in transport.organizations) {
    throw new Error("iiko: generated organizations.getById collides with the hand-written helper");
  }
  if ("wait" in transport.commands) {
    throw new Error("iiko: generated commands.wait collides with the hand-written helper");
  }
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
