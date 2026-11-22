import type { components } from "../generated/schema.js";
import { AUTH_PARAMS, type HttpClient } from "../http.js";

type MenuRequest =
  components["schemas"]["iikoTransport.PublicApi.Contracts.Nomenclature.MenuRequest"];

export type ExternalMenuOptions = Omit<MenuRequest, "externalMenuId" | "organizationIds">;

export function createMenuResource(http: HttpClient) {
  return {
    /**
     * Fetches an external menu for an organization.
     *
     * This is a POST, so it is not retried automatically.
     *
     * @param organizationId Organization UUID.
     * @param externalMenuId External menu ID from the iikoOffice back office.
     * @param options Price category, version, language, async mode, revision.
     * @param signal Cancels the request.
     */
    getExternalMenu(
      organizationId: string,
      externalMenuId: string,
      options: ExternalMenuOptions = {},
      signal?: AbortSignal,
    ) {
      const body = { organizationIds: [organizationId], externalMenuId, ...options };
      return http.request(
        { method: "POST", endpoint: "/api/2/menu/by_id", requestBody: body },
        () => http.client.POST("/api/2/menu/by_id", { params: AUTH_PARAMS, body, signal }),
      );
    },
  };
}
