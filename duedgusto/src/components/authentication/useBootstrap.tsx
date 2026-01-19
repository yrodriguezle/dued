import { useEffect, useRef } from "react";

import useStore from "../../store/useStore";
import fetchLoggedUtente from "../../graphql/utente/fetchLoggedUser";
import { isAuthenticated } from "../../common/authentication/auth";
import useConfirm from "../common/confirm/useConfirm";
import { OFFLINE } from "../../store/serverStatusStore";
import logger from "../../common/logger/logger";

function useBootstrap() {
  const serverStatus = useStore((store) => store.serverStatus);
  const utente = useStore((store) => store.utente);
  const inProgressGlobal = useStore((store) => store.inProgress.global);
  const receiveUtente = useStore((store) => store.receiveUtente);
  const onInProgress = useStore((store) => store.onInProgress);
  const offInProgress = useStore((store) => store.offInProgress);
  const promiseLock = useRef<Promise<void> | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    async function bootstrap() {
      if (serverStatus === OFFLINE || promiseLock.current || inProgressGlobal || utente || !isAuthenticated()) return;
      promiseLock.current = (async () => {
        try {
          onInProgress("global");
          const { data } = await fetchLoggedUtente();
          if (!data?.authentication?.utenteCorrente) {
            receiveUtente(null);
            return;
          }
          const {
            authentication: { utenteCorrente },
          } = data;
          receiveUtente(utenteCorrente);
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
  }, [confirm, offInProgress, onInProgress, receiveUtente, serverStatus, utente]);
}

export default useBootstrap;
