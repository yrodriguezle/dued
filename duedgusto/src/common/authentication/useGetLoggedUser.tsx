import { useCallback } from "react";
import useStore from "../../store/useStore";
import fetchLoggedUser from "../../graphql/user/fetchLoggedUser";

function useGetLoggedUser() {
  const receiveUser = useStore((store) => store.receiveUser);
  const inProgressFetchUser = useStore((store) => store.inProgress.fetchUser);
  const onInProgress = useStore((store) => store.onInProgress);
  const offInProgress = useStore((store) => store.offInProgress);

  return useCallback(async () => {
    try {
      if (inProgressFetchUser) {
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
  }, [inProgressFetchUser, offInProgress, onInProgress, receiveUser]);
}

export default useGetLoggedUser;
