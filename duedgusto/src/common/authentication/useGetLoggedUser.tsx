import { useCallback } from "react";
import useStore from "../../store/useStore";
import fetchLoggedUser from "../../graphql/user/fetchLoggedUser";

function useGetLoggedUser() {
  const receiveUser = useStore((store) => store.receiveUser);

  return useCallback(async () => {
    const { data } = await fetchLoggedUser();
    if (!data?.account?.currentUser) {
      return null;
    }
    const {
      account: { currentUser },
    } = data;
    receiveUser(currentUser);
    return currentUser;
  }, [receiveUser]);
}

export default useGetLoggedUser;
