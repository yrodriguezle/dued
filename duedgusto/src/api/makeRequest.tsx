import { getAuthHeaders } from "../common/authentication/auth";
import onRefreshFails from "../common/authentication/onRefreshFails";
import { executeTokenRefresh } from "../common/authentication/tokenRefreshManager";
import logger from "../common/logger/logger";
import { WEB_REQUEST_UNAUTHORIZED } from "./httpStatusCodes";

const defaultServices = {
  fetch: window.fetch.bind(window),
  getAuthHeaders,
  refreshToken: executeTokenRefresh,
};

async function makeRequest<T, InputData>({ path, method, data, headers = {}, failOnForbidden = false }: MakeRequest<InputData>, services = defaultServices): Promise<T | null> {
  const authHeaders = services.getAuthHeaders();

  const mergedHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json;charset=UTF-8",
    ...headers,
    ...(authHeaders || {}),
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
    return responseData;
  }

  if (response.status === WEB_REQUEST_UNAUTHORIZED && !failOnForbidden) {
    logger.log('Received 401, attempting token refresh from makeRequest');
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

  // 403 Forbidden
  if (response.status === 403) {
    logger.error("Request forbidden (403)");
    throw new Error("Richiesta non autorizzata");
  }

  const err = await response.json();
  throw new Error(err.message || "Errore nella risposta del server");
}

export default makeRequest;
