/**
 * CSRF Token management (deprecated - no longer used).
 * These functions are kept for backward compatibility but do nothing.
 */

/**
 * @deprecated CSRF protection has been removed
 * @returns Always returns null
 */
export const getCsrfTokenFromCookie = (): string | null => {
  return null;
};

/**
 * @deprecated CSRF protection has been removed
 * @throws Error always
 */
export const getCsrfToken = (): string => {
  throw new Error("CSRF protection has been removed from this application");
};

/**
 * @deprecated CSRF protection has been removed
 * @returns Always returns false
 */
export const hasCsrfToken = (): boolean => {
  return false;
};
