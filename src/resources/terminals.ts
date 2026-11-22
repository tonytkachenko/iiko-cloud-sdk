import { AUTH_PARAMS, type HttpClient } from "../http.js";

export function createTerminalsResource(http: HttpClient) {
  return {
    /**
     * Lists terminal groups of an organization, including sleeping ones.
     *
     * @param organizationId Organization UUID.
     * @param signal Cancels the request.
     */
    list(organizationId: string, signal?: AbortSignal) {
      const body = { organizationIds: [organizationId] };
      return http.request(
        { method: "POST", endpoint: "/api/1/terminal_groups", requestBody: body },
        () => http.client.POST("/api/1/terminal_groups", { params: AUTH_PARAMS, body, signal }),
      );
    },
  };
}
