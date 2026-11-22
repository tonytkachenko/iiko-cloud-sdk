import { AUTH_PARAMS, type HttpClient } from "../http.js";

export function createOrganizationsResource(http: HttpClient) {
  return {
    /**
     * Lists the organizations the API key can access.
     *
     * Errors are returned, never thrown: check `error` before using `data`.
     *
     * @param signal Cancels the request.
     */
    list(signal?: AbortSignal) {
      return http.request({ method: "GET", endpoint: "/api/1/organizations" }, () =>
        http.client.GET("/api/1/organizations", { params: AUTH_PARAMS, signal }),
      );
    },

    /**
     * Finds one organization by ID.
     *
     * @param id Organization UUID.
     * @param signal Cancels the request.
     * @returns `data` is the organization, or `undefined` when no match exists.
     */
    async getById(id: string, signal?: AbortSignal) {
      const body = { organizationIds: [id] };
      const result = await http.request(
        { method: "POST", endpoint: "/api/1/organizations", requestBody: body },
        () => http.client.POST("/api/1/organizations", { params: AUTH_PARAMS, body, signal }),
      );

      return result.error ? { error: result.error } : { data: result.data?.organizations?.[0] };
    },
  };
}
