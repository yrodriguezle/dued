export const getAuthToken = (): AuthToken => (localStorage.getItem("jwtToken") && JSON.parse(localStorage.getItem("jwtToken") || "")) || null;

export const getAuthHeaders = () => {
  const authToken = getAuthToken();
  return authToken?.token ? { Authorization: `Bearer ${authToken.token}` } : null;
};

/**
 * Decodifica il payload di un token JWT (senza verifica crittografica).
 * Restituisce null se il token è malformato o non decodificabile.
 */
export const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Ripristina il padding base64
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

/**
 * Verifica se l'utente è autenticato controllando l'esistenza del token JWT in localStorage.
 * Non controlla la scadenza: è responsabilità del server (ACCESS_DENIED) e del meccanismo
 * di refresh (Apollo error link + tokenRefreshManager) gestire i token scaduti.
 */
export const isAuthenticated = (): boolean => {
  const authToken = getAuthToken();
  return !!authToken?.token;
};

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

export const removeRememberPassword = () => localStorage.removeItem("remember");
