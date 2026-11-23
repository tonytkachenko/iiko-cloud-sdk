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
       * returns the single match.
       *
       * @param id Organization UUID.
       * @param signal Cancels the request.
       * @returns `data` is the organization, or `undefined` when no match exists.
       */
      async getById(id: string, signal?: AbortSignal) {
        const result = await transport.organizations.list({ organizationIds: [id] }, { signal });
        if (result.error) return { error: result.error };
        return { data: result.data.organizations?.[0] };
      },
    },
  };
}
