import { useEffect, useRef } from "react";

import useStore from "../../store/useStore";
import fetchLoggedUtente from "../../graphql/utente/fetchLoggedUser";
import { isAuthenticated } from "../../common/authentication/auth";
import { initAuthChannel, cleanupAuthChannel } from "../../common/authentication/broadcastChannel";
import useConfirm from "../common/confirm/useConfirm";
import { OFFLINE } from "../../store/serverStatusStore";
import logger from "../../common/logger/logger";
import configureClient from "../../graphql/configureClient";
import { GET_BUSINESS_SETTINGS } from "../../graphql/settings/queries";

function useBootstrap() {
  const serverStatus = useStore((store) => store.serverStatus);
  const utente = useStore((store) => store.utente);
  const inProgressGlobal = useStore((store) => store.inProgress.global);
  const receiveUtente = useStore((store) => store.receiveUtente);
  const setSettings = useStore((store) => store.setSettings);
  const onInProgress = useStore((store) => store.onInProgress);
  const offInProgress = useStore((store) => store.offInProgress);
  const promiseLock = useRef<Promise<void> | null>(null);
  const confirm = useConfirm();

  // Inizializza il BroadcastChannel per la sincronizzazione auth tra tab
  useEffect(() => {
    initAuthChannel();
    return () => {
      cleanupAuthChannel();
    };
  }, []);

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

          // Carica le BusinessSettings nello store (non blocca il bootstrap se fallisce)
          try {
            const { data: settingsData } = await configureClient().query({
              query: GET_BUSINESS_SETTINGS,
            });
            const rawSettings = settingsData?.settings?.businessSettings;
            if (rawSettings) {
              const parsed: BusinessSettings = {
                ...rawSettings,
                openingTime: rawSettings.openingTime?.substring(0, 5) || "",
                closingTime: rawSettings.closingTime?.substring(0, 5) || "",
                operatingDays: typeof rawSettings.operatingDays === "string" ? JSON.parse(rawSettings.operatingDays) : rawSettings.operatingDays,
              };
              setSettings(parsed);
            }
          } catch (settingsError) {
            logger.log("Failed to load business settings:", settingsError);
          }
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
  }, [confirm, offInProgress, onInProgress, receiveUtente, setSettings, serverStatus, utente]);
}

export default useBootstrap;
