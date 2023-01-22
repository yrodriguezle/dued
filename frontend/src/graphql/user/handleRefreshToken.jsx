import {
  getAuthToken, isAuthenticated, removeAuthToken, setAuthToken,
} from '../../common/auth';

// make a traffic light here
let refreshAuthTokenPromise = Promise.resolve();

const handleRefreshToken = async () => {
  refreshAuthTokenPromise = refreshAuthTokenPromise.then(async () => {
    if (!isAuthenticated()) {
      return false;
    }
    const { token, refreshToken } = getAuthToken();
    if (token && refreshToken) {
      try {
        const response = await fetch(
          `${global.API_ENDPOINT}/api/authentication`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            cache: 'no-store',
            body: JSON.stringify({
              token,
              refreshToken,
            }),
          },
        );
        const data = await response.json();
        setAuthToken(data);
        return data;
      } catch (error) {
        removeAuthToken();
        window.location.href = global.ROOT_URL;
        return false;
      }
    }
    return false;
  });
  return refreshAuthTokenPromise;
};

export default handleRefreshToken;
