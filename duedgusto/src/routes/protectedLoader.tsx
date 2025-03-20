import { redirect } from "react-router";
import fetchConfiguration from "../api/fetchConfiguration";
import { isAuthenticated } from "../common/authentication/auth";

const protectedLoader = async () => {
  const globalThis = window as Global;
  if (!globalThis.API_ENDPOINT) {
    const response = await fetchConfiguration();
    const data: Partial<Global> = await response.json();
    globalThis.API_ENDPOINT = data.API_ENDPOINT;
  }

  console.log("protectedLoader");

  if (!isAuthenticated()) {
    return redirect("/login");
  }
  // const user = useStore.getState().user;
  // if (user) {
  //   return user;
  // }

  // const reult = await fetchLoggedUser();
  // if (reult?.data?.account?.currentUser) {
  //   const { account: { currentUser } } = reult.data;
  //   const { receiveUser } = useStore.getState();
  //   receiveUser(currentUser);
  //   return currentUser;
  // }
  // removeAuthToken();
  // redirect("/login");
};

export default protectedLoader;
