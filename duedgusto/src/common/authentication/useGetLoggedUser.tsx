import { useCallback } from "react";
import useStore from "../../store/useStore";
import fetchLoggedUtente from "../../graphql/utente/fetchLoggedUser";

function useGetLoggedUtente() {
  const receiveUtente = useStore((store) => store.receiveUtente);
  const inProgressFetchUser = useStore((store) => store.inProgress.fetchUser);
  const onInProgress = useStore((store) => store.onInProgress);
  const offInProgress = useStore((store) => store.offInProgress);

  return useCallback(async () => {
    try {
      if (inProgressFetchUser) {
        return null;
      }
      onInProgress("fetchUser");
      const { data } = await fetchLoggedUtente();
      if (!data?.authentication?.utenteCorrente) {
        return null;
      }
      const {
        authentication: { utenteCorrente },
      } = data;
      receiveUtente(utenteCorrente);
      return utenteCorrente;
    } finally {
      offInProgress("fetchUser");
    }
  }, [inProgressFetchUser, offInProgress, onInProgress, receiveUtente]);
}

export default useGetLoggedUtente;
