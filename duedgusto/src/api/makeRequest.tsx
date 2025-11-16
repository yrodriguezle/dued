import { getAuthHeaders, setLastActivity } from "../common/authentication/auth";
import { getCsrfTokenFromCookie } from "../common/authentication/csrfToken";
import onRefreshFails from "../common/authentication/onRefreshFails";
import debounce from "../common/bones/debounce";
import logger from "../common/logger/logger";
import { WEB_REQUEST_UNAUTHORIZED } from "./httpStatusCodes";
import refreshToken from "./refreshToken";

const debouncedLastActivity = debounce(setLastActivity, 100);

const defaultServices = {
  fetch: window.fetch.bind(window),
  getAuthHeaders,
  refreshToken,
};

async function makeRequest<T, InputData>({ path, method, data, headers = {}, failOnForbidden = false }: MakeRequest<InputData>, services = defaultServices): Promise<T | null> {
  const authHeaders = services.getAuthHeaders();

  // Add CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
  const isStatefulRequest = ["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase());
  const csrfToken = isStatefulRequest ? getCsrfTokenFromCookie() : null;

  const mergedHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json;charset=UTF-8",
    ...headers,
    ...(authHeaders || {}),
    ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
  };

  const response = await services.fetch(`${(window as Global).API_ENDPOINT}/api/${path}`, {
    method,
    credentials: "include", // Include httpOnly cookies in requests
    body: data ? JSON.stringify(data) : undefined,
    headers: mergedHeaders,
  });

  if (response.ok) {
    const contentLength = response.headers.get("content-length");
    if (contentLength === "0") {
      return null;
    }
    const responseText = await response.clone().text();
    if (!responseText) {
      return null;
    }
    let responseData;
    try {
      responseData = await response.json();
    } catch (error) {
      logger.error(error);
    }
    debouncedLastActivity();
    return responseData;
  }

  if (response.status === WEB_REQUEST_UNAUTHORIZED && !failOnForbidden) {
    const tokenRefreshed = await services.refreshToken();
    if (tokenRefreshed) {
      return makeRequest({
        path,
        method,
        data,
        headers,
        failOnForbidden: true,
      });
    }
    await onRefreshFails();
    return null;
  }

  // 403 Forbidden - CSRF validation failed or request is forbidden
  if (response.status === 403) {
    logger.error("Request forbidden (403) - CSRF validation may have failed");
    throw new Error("Errore di sicurezza nella richiesta (CSRF validation failed)");
  }

  const err = await response.json();
  throw new Error(err.message || "Errore nella risposta del server");
}

export default makeRequest;
