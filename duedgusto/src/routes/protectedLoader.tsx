import { redirect } from "react-router-dom";
import { isAuthenticated, removeAuthToken } from "../common/authentication/auth";
import useStore from "../store/useStore";
import fetchLoggedUser from "../graphql/user/fetchLoggedUser";

export const protectedLoader = async () => {
  const globalThisWithProperties = window as Global;
  if (!globalThisWithProperties.API_ENDPOINT) {
    const response = await fetch('/config.json',
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
    const data: Partial<Global> = await response.json();
    globalThisWithProperties.API_ENDPOINT = data.API_ENDPOINT;
  }

  if (!isAuthenticated()) {
    return redirect("/login");
  }
  const user = useStore.getState().user;
  if (user) {
    return user;
  }

  const reult = await fetchLoggedUser();
  if (reult?.data?.account?.currentUser) {
    const { account: { currentUser } } = reult.data;
    const { receiveUser } = useStore.getState();
    receiveUser(currentUser);
    return currentUser;
  }
  removeAuthToken();
  redirect("/login");
};