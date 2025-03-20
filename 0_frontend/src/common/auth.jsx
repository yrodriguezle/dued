import { getCurrentDate } from './date';

const defaultServices = {
  localStorage,
  getCurrentDate,
};

export const isAuthenticated = (services = defaultServices) => Boolean(services.localStorage.getItem('jwtToken'));

export const getAuthToken = () => (
  localStorage.getItem('jwtToken') && JSON.parse(localStorage.getItem('jwtToken'))
) || {};

export const getAuthHeaders = () => {
  const jwtToken = getAuthToken();
  return (
    jwtToken && jwtToken.token
      ? { Authorization: `Bearer ${jwtToken.token}` }
      : {}
  );
};

export const setAuthToken = (accessTokenAndrefreshToken) => {
  const jwtToken = getAuthToken();
  const newAuthToken = {
    ...jwtToken,
    ...accessTokenAndrefreshToken,
  };
  localStorage.setItem('jwtToken', JSON.stringify(newAuthToken));
};

export const setRememberPassword = (remember) => {
  const rememberInt = remember ? 1 : 0;
  localStorage.setItem('remember', JSON.stringify(rememberInt));
};

export const getLastActivity = (services = defaultServices) => services.localStorage.getItem('lastActivity') || services.getCurrentDate();

export const hasRememberPassword = (services = defaultServices) => Boolean(services.localStorage.getItem('remember') && +services.localStorage.getItem('remember'));

export const removeAuthToken = () => localStorage.removeItem('jwtToken');

export const removeLastActivity = () => localStorage.removeItem('lastActivity');

export const removeRememberPassword = () => localStorage.removeItem('remember');
