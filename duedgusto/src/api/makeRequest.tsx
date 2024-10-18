import { getAuthHeaders, setLastActivity } from "../common/authentication/auth";
import debounce from "../common/bones/debounce";
import logger from "../common/logger/logger";
import onRefreshFails from "./authentication/onRefreshFails";
import refreshToken from "./authentication/refreshToken";
import fetchPromise from "./fetchPromise";
import { WEB_REQUEST_UNAUTHORIZED } from "./httpStatusCodes";

const debouncedLastActivity = debounce(setLastActivity, 100);

async function makeRequest<T, InputData>({
  path,
  method,
  data,
  headers = {},
  failOnForbidden = false,
  // onError,
}: MakeRequest<InputData>): Promise<T|null> {
  const authHeaders = getAuthHeaders();

  const mergedHeaders: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    ...headers,
    ...(authHeaders || {}),
  };

  const response = await fetchPromise(`${(window as Global).API_ENDPOINT}/api/${path}`, {
    method,
    body: data ? JSON.stringify(data) : undefined,
    headers: mergedHeaders,
  });

  if (response.ok) {
    // if (['amico4config/pushconnection', 'amico4config/logout'].includes(path)) {
    //   return null;
    // }
    const contentLength = response.headers.get('content-length');
    if (contentLength === '0') {
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
    const tokenRefreshed = await refreshToken();
    if (tokenRefreshed) {
      return makeRequest({
        path,
        method,
        data,
        headers,
        failOnForbidden: true,
      });
    } else {
      await onRefreshFails();
    }
  }
  // if (onError) {
  //   onError(response);
  // }
  // return null;
  throw response;
}

export default makeRequest;
