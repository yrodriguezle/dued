/**
 * CSRF Token management using the double-submit cookie pattern.
 *
 * The CSRF token is stored in a non-HttpOnly cookie that can be read by JavaScript.
 * On each state-changing request, the token must be read from the cookie and
 * sent in the X-CSRF-Token header for validation by the server.
 *
 * This pattern works seamlessly with httpOnly refresh tokens:
 * - httpOnly refresh token: Auto-sent by browser, protected from XSS
 * - CSRF token: Readable by JavaScript, sent in header, protected from CSRF
 */

/**
 * Reads CSRF token from the csrfToken cookie.
 * Token is set by server on login and subsequent refreshes.
 *
 * @returns The CSRF token string, or null if not found
 */
export const getCsrfTokenFromCookie = (): string | null => {
  if (typeof document === "undefined") return null; // SSR safety

  const cookies = document.cookie
    .split("; ")
    .find(row => row.startsWith("csrfToken="));

  if (!cookies) return null;

  try {
    return decodeURIComponent(cookies.split("=")[1]);
  } catch {
    return null;
  }
};

/**
 * Gets CSRF token, throws if not found.
 * Should only fail if user is not authenticated.
 *
 * @throws Error if CSRF token not found
 * @returns The CSRF token string
 */
export const getCsrfToken = (): string => {
  const token = getCsrfTokenFromCookie();

  if (!token) {
    throw new Error(
      "CSRF token not found. User may not be authenticated. " +
      "Ensure cookies are enabled and endpoint sent Set-Cookie header."
    );
  }

  return token;
};

/**
 * Checks if CSRF token exists (indicates user is authenticated).
 *
 * @returns true if CSRF token is found, false otherwise
 */
export const hasCsrfToken = (): boolean => {
  return getCsrfTokenFromCookie() !== null;
};
