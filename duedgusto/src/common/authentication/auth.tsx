import { getCurrentDate } from "../date/date";

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
