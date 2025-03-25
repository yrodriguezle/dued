import { useEffect, useRef } from "react";
import useStore from "../../store/useStore";
import fetchLoggedUser from "../../api/fetchLoggedUser";
import { isAuthenticated } from "../../common/authentication/auth";

function useBootstrap() {
  const { user, inProgress, receiveUser, onInProgress, offInProgress } = useStore((store) => store);
  const promiseLock = useRef<Promise<void> | null>(null);

  useEffect(() => {
    async function bootstrap() {
      if (promiseLock.current || inProgress.fetchUser || user || !isAuthenticated()) return;
      promiseLock.current = (async () => {
        try {
          onInProgress("fetchUser");
          const currentUser = await fetchLoggedUser();
          receiveUser(currentUser || null);
        } finally {
          offInProgress("fetchUser");
          promiseLock.current = null;
        }
      })();
      await promiseLock.current;
    }
    bootstrap();
  }, [inProgress.fetchUser, offInProgress, onInProgress, receiveUser, user]);
}

export default useBootstrap;
