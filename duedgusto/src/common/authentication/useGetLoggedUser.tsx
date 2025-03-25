import { useCallback } from "react";
import useStore from "../../store/useStore";
import fetchLoggedUser from "../../graphql/user/fetchLoggedUser";

function useGetLoggedUser() {
  const { receiveUser, inProgress, onInProgress, offInProgress } = useStore((store) => store);

  return useCallback(async () => {
    try {
      if (inProgress.fetchUser) {
        return null;
      }
      onInProgress("fetchUser");
      const { data } = await fetchLoggedUser();
      if (!data?.authentication?.currentUser) {
        return null;
      }
      const {
        authentication: { currentUser },
      } = data;
      receiveUser(currentUser);
      return currentUser;
    } finally {
      offInProgress("fetchUser");
    }
  }, [inProgress.fetchUser, offInProgress, onInProgress, receiveUser]);
}

export default useGetLoggedUser;
