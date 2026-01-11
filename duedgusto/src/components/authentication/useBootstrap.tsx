import { useEffect, useRef } from "react";

import useStore from "../../store/useStore";
import fetchLoggedUser from "../../graphql/user/fetchLoggedUser";
import { isAuthenticated } from "../../common/authentication/auth";
import useConfirm from "../common/confirm/useConfirm";
import { OFFLINE } from "../../store/serverStatusStore";
import logger from "../../common/logger/logger";

function useBootstrap() {
  const serverStatus = useStore((store) => store.serverStatus);
  const user = useStore((store) => store.user);
  const inProgressGlobal = useStore((store) => store.inProgress.global);
  const receiveUser = useStore((store) => store.receiveUser);
  const onInProgress = useStore((store) => store.onInProgress);
  const offInProgress = useStore((store) => store.offInProgress);
  const promiseLock = useRef<Promise<void> | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    async function bootstrap() {
      if (serverStatus === OFFLINE || promiseLock.current || inProgressGlobal || user || !isAuthenticated()) return;
      promiseLock.current = (async () => {
        try {
          onInProgress("global");
          const { data } = await fetchLoggedUser();
          if (!data?.authentication?.currentUser) {
            receiveUser(null);
            return;
          }
          const {
            authentication: { currentUser },
          } = data;
          receiveUser(currentUser);
        } catch (error: unknown) {
          logger.log(error);
          await confirm({
            title: "Network error",
            content: "Connessione con il server non riuscita",
            acceptLabel: "Riprova",
          });
        } finally {
          offInProgress("global");
          promiseLock.current = null;
        }
      })();
      await promiseLock.current;
    }
    bootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm, offInProgress, onInProgress, receiveUser, serverStatus, user]);
}

export default useBootstrap;
