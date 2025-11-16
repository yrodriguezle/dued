import { getCurrentDate } from "../date/date";

/**
 * Decodes a JWT token without verifying the signature.
 * Only use for reading claims on the client side.
 */
const decodeJWT = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
};

/**
 * Checks if a JWT token is expired based on its exp claim.
 */
export const isTokenExpired = (token: string): boolean => {
  const payload = decodeJWT(token);
  if (!payload || typeof payload.exp !== 'number') {
    return true;
  }
  return payload.exp * 1000 < Date.now();
};

/**
 * Returns the number of seconds until a JWT token expires.
 * Returns null if token is invalid or malformed.
 */
export const getTokenExpiresIn = (token: string): number | null => {
  const payload = decodeJWT(token);
  if (!payload || typeof payload.exp !== 'number') {
    return null;
  }
  return (payload.exp * 1000 - Date.now()) / 1000;
};

/**
 * Checks if token should be refreshed (expires within 5 minutes).
 */
export const shouldRefreshToken = (): boolean => {
  const token = getAuthToken()?.token;
  if (!token) return false;

  const expiresIn = getTokenExpiresIn(token);
  // Refresh if expires in less than 5 minutes (300 seconds)
  return expiresIn !== null && expiresIn < 300;
};

export const getAuthToken = (): AuthToken => (localStorage.getItem("jwtToken") && JSON.parse(localStorage.getItem("jwtToken") || "")) || null;

export const getAuthHeaders = () => {
  const authToken = getAuthToken();
  return authToken?.token ? { Authorization: `Bearer ${authToken.token}` } : null;
};

export const isAuthenticated = () => !!localStorage.getItem("jwtToken");

export const setAuthToken = (accessTokenAndrefreshToken: AuthToken) => {
  const authToken = getAuthToken() || {};
  const newAuthToken = {
    ...authToken,
    ...accessTokenAndrefreshToken,
  };
  localStorage.setItem("jwtToken", JSON.stringify(newAuthToken));
};

export const removeAuthToken = () => localStorage.removeItem("jwtToken");

export const setRememberPassword = (remember: boolean) => {
  const rememberInt = remember ? 1 : 0;
  localStorage.setItem("remember", JSON.stringify(rememberInt));
};

export const hasRememberPassword = () => !!localStorage.getItem("remember");

export const setLastActivity = () => {
  if (isAuthenticated() && !hasRememberPassword()) {
    localStorage.setItem("lastActivity", JSON.stringify(getCurrentDate()).replace(/"/g, ""));
  }
};

export const removeLastActivity = () => localStorage.removeItem("lastActivity");

export const removeRememberPassword = () => localStorage.removeItem("remember");
