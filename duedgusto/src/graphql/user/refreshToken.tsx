import { getAuthToken, setAuthToken } from "../../common/authentication/auth";
import configureClient from "../configureClient";
import { mutationRefreshToken } from "./mutations";

async function refreshToken() {
  try {
    const apolloClient = configureClient();
    const authHeaders = getAuthToken();

    const { data } = await apolloClient.mutate({
      mutation: mutationRefreshToken,
      variables: {
        refreshToken: authHeaders?.refreshToken || '',
      },
    });
    const result = data?.authentication.refreshToken;
    if (result) {
      setAuthToken(result);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error loading data:', error);
    throw new Response('Failed to load data', { status: 500 });
  }
}

export default refreshToken