import { getAuthToken, setAuthToken } from "../common/authentication/auth";
import { broadcastTokenRefreshed } from "../common/authentication/broadcastChannel";
import logger from "../common/logger/logger";

const defaultServices = {
  fetch: window.fetch.bind(window),
  getAuthToken,
};

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000; // 1 second

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const getBackoffDelay = (retryCount: number): number => {
  return INITIAL_DELAY_MS * Math.pow(2, retryCount);
};

const isRetryable = (status: number): boolean => {
  // Retry on 429 (Too Many Requests) and 5xx server errors
  return status === 429 || (status >= 500 && status < 600);
};

async function refreshToken(services = defaultServices, retryCount = 0): Promise<boolean> {
  const authToken = services.getAuthToken();

  try {
    const response = await services.fetch(`${(window as Global).API_ENDPOINT}/api/auth/refresh`, {
      method: "POST",
      credentials: "include", // Include httpOnly cookies in request
      body: JSON.stringify({
        token: authToken?.token || "",
        refreshToken: authToken?.refreshToken || "",
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json;charset=UTF-8",
      },
    });

    if (response.ok) {
      const responseData: AuthToken = await response.json();
      setAuthToken(responseData);
      broadcastTokenRefreshed(responseData);
      return true;
    }

    // 401 means session is invalid - don't retry, just return false
    if (response.status === 401) {
      return false;
    }

    // 403 means request is forbidden - treat as auth failure
    if (response.status === 403) {
      return false;
    }

    // Check if error is retryable
    if (isRetryable(response.status) && retryCount < MAX_RETRIES) {
      const backoffDelay = getBackoffDelay(retryCount);
      await delay(backoffDelay);
      logger.warn(`Retrying refresh token request 1 (attempt ${retryCount + 1}) after ${backoffDelay}ms due to status ${response.status}`);
      return refreshToken(services, retryCount + 1);
    }

    throw new Error(`Error refreshing token: ${response.status}`);
  } catch (error) {
    // Retry on network errors (e.g., fetch timeout)
    if (retryCount < MAX_RETRIES && error instanceof Error) {
      const backoffDelay = getBackoffDelay(retryCount);
      await delay(backoffDelay);
      logger.warn(`Retrying refresh token request 2 (attempt ${retryCount + 1}) after ${backoffDelay}ms due to error: ${error.message}`);
      return refreshToken(services, retryCount + 1);
    }
    throw error;
  }
}

export default refreshToken;
