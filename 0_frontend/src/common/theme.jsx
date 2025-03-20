const defaultServices = {
  localStorage,
};

export const getIsDarkMode = (services = defaultServices) => Boolean(services.localStorage.getItem('darkTheme')) && +services.localStorage.getItem('darkTheme');

export const setIsDarkMode = (dark) => {
  localStorage.setItem('darkTheme', JSON.stringify(dark ? 1 : 0));
};
