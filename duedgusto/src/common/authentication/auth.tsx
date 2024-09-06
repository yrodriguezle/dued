export const getAuthToken = (): AuthToken => (
  localStorage.getItem('jwtToken') && JSON.parse(localStorage.getItem('jwtToken') || "")
) || null;

export const getAuthHeaders = () => {
  const authToken = getAuthToken();
  return ( authToken?.token ? { Authorization: `Bearer ${authToken.token}` } : null);
};

export const isAuthenticated = () => !!(localStorage.getItem('jwtToken'));

export const setAuthToken = (accessTokenAndrefreshToken: AuthToken) => {
  const authToken = getAuthToken() || {};
  const newAuthToken = {
    ...authToken,
    ...accessTokenAndrefreshToken,
  };
  localStorage.setItem('jwtToken', JSON.stringify(newAuthToken));
};

export const getLastUserTheme = (): ThemeMode => localStorage.getItem('theme') as ThemeMode || 'default';

export const setLastUserTheme = (theme: string) => localStorage.setItem('theme', theme);

export const removeAuthToken = () => localStorage.removeItem('jwtToken');