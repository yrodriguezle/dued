import { getAuthToken, isAuthenticated, setAuthToken } from "../../common/authentication/auth";
import isEmpty from "../../common/bones/isEmpty";

async function refreshToken() {
  const authToken = getAuthToken();
  if (!isAuthenticated() || isEmpty(authToken) || !authToken?.token || !authToken?.refreshToken) {
    return false;
  }
  const response = await fetch(`${(window as Global).API_ENDPOINT}/api/authentication`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify({
      token: authToken.token,
      refreshToken: authToken.refreshToken,
    }),
  });
  if (response.ok) {
    const responseData = await response.json();
    setAuthToken(responseData);
    return true;
  }
  return false;
}

export default refreshToken;
