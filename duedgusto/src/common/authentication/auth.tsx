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
 * Verifica se l'utente è autenticato controllando:
 * 1. Che esista un token JWT in localStorage
 * 2. Che il token non sia scaduto (claim "exp")
 */
export const isAuthenticated = (): boolean => {
  try {
    const authToken = getAuthToken();
    if (!authToken?.token) return false;

    const payload = decodeJwtPayload(authToken.token);
    if (!payload || typeof payload.exp !== "number") return false;

    // exp è in secondi Unix, Date.now() è in millisecondi
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return payload.exp > nowInSeconds;
  } catch {
    return false;
  }
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
