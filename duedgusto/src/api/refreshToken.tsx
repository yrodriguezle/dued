import { getAuthToken, setAuthToken } from "../common/authentication/auth";

const defaultServices = {
  fetch: window.fetch.bind(window),
  getAuthToken,
};

async function refreshToken(services = defaultServices): Promise<boolean> {
  const authToken = services.getAuthToken();
  const response = await services.fetch(`${(window as Global).API_ENDPOINT}/api/auth/refresh`, {
    method: "POST",
    body: JSON.stringify({
      token: authToken?.token || "",
      refreshToken: authToken?.refreshToken || "",
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json;charset=UTF-8",
    },
  });

  if (response.ok) {
    const responseData: AuthToken = await response.json();
    setAuthToken(responseData);
    return true;
  }

  if (response.status === 401) {
    return false;
  }

  throw new Error(`Error refreshing token: ${response.status}`);
}

export default refreshToken;
