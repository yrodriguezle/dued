import { useEffect, useRef } from "react";

import useStore from "../../store/useStore";
import fetchLoggedUser from "../../api/fetchLoggedUser";
import { isAuthenticated } from "../../common/authentication/auth";
import useConfirm from "../common/confirm/useConfirm";
import { OFFLINE } from "../../store/serverStatusStore";
import logger from "../../common/logger/logger";

function useBootstrap() {
  const { serverStatus, user, inProgress, receiveUser, onInProgress, offInProgress } = useStore((store) => store);
  const promiseLock = useRef<Promise<void> | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    async function bootstrap() {
      if (serverStatus === OFFLINE || promiseLock.current || inProgress.global || user || !isAuthenticated()) return;
      promiseLock.current = (async () => {
        try {
          onInProgress("global");
          const currentUser = await fetchLoggedUser();
          receiveUser(currentUser || null);
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
  }, [confirm, inProgress.global, offInProgress, onInProgress, receiveUser, serverStatus, user]);
}

export default useBootstrap;
