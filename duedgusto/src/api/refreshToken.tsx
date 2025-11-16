import { getAuthToken, setAuthToken } from "../common/authentication/auth";
import { getCsrfTokenFromCookie } from "../common/authentication/csrfToken";

const defaultServices = {
  fetch: window.fetch.bind(window),
  getAuthToken,
  getCsrfTokenFromCookie,
};

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000; // 1 second

/**
 * Wait for a specified amount of time (used for exponential backoff).
 */
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculates exponential backoff delay based on retry count.
 * Formula: INITIAL_DELAY_MS * 2^retryCount
 */
const getBackoffDelay = (retryCount: number): number => {
  return INITIAL_DELAY_MS * Math.pow(2, retryCount);
};

/**
 * Checks if an error is retryable (transient error vs permanent).
 */
const isRetryable = (status: number): boolean => {
  // Retry on 429 (Too Many Requests) and 5xx server errors
  return status === 429 || (status >= 500 && status < 600);
};

/**
 * Refreshes the authentication token with exponential backoff retry logic.
 *
 * Refresh token is now stored in httpOnly cookie and sent automatically by the browser.
 * We only send the access token for the server to validate/refresh from.
 *
 * @param services - Dependency injection for testing
 * @param retryCount - Internal parameter for tracking retries
 * @returns true if token was successfully refreshed, false if session expired (401)
 * @throws Error if refresh fails after all retries or on non-retryable errors
 */
async function refreshToken(services = defaultServices, retryCount = 0): Promise<boolean> {
  const authToken = services.getAuthToken();

  try {
    // Get CSRF token from cookie for request validation
    const csrfToken = services.getCsrfTokenFromCookie();

    const response = await services.fetch(`${(window as Global).API_ENDPOINT}/api/auth/refresh`, {
      method: "POST",
      credentials: "include", // Include httpOnly cookies in request
      body: JSON.stringify({
        token: authToken?.token || "",
        // refreshToken is now in httpOnly cookie, sent automatically
        // Keeping this field for backward compatibility with old server
        refreshToken: authToken?.refreshToken || "",
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json;charset=UTF-8",
        // CSRF token for double-submit cookie pattern validation
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
    });

    if (response.ok) {
      const responseData: AuthToken = await response.json();
      setAuthToken(responseData);
      return true;
    }

    // 401 means session is invalid - don't retry, just return false
    if (response.status === 401) {
      return false;
    }

    // 403 means CSRF validation failed or request is forbidden - treat as auth failure
    if (response.status === 403) {
      return false;
    }

    // Check if error is retryable
    if (isRetryable(response.status) && retryCount < MAX_RETRIES) {
      const backoffDelay = getBackoffDelay(retryCount);
      await delay(backoffDelay);
      return refreshToken(services, retryCount + 1);
    }

    throw new Error(`Error refreshing token: ${response.status}`);
  } catch (error) {
    // Retry on network errors (e.g., fetch timeout)
    if (retryCount < MAX_RETRIES && error instanceof Error) {
      const backoffDelay = getBackoffDelay(retryCount);
      await delay(backoffDelay);
      return refreshToken(services, retryCount + 1);
    }
    throw error;
  }
}

export default refreshToken;
