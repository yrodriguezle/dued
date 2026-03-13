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
import showToast from "../../common/toast/showToast";

const SETTINGS_RETRY_DELAYS = [1000, 2000, 4000];
const OPERATING_DAYS_FALLBACK: boolean[] = [false, false, false, false, false, false, false];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseOperatingDays(raw: unknown): boolean[] {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed) && parsed.length === 7 && parsed.every((v: unknown) => typeof v === "boolean")) {
      return parsed;
    }
    logger.warn("operatingDays non valido, uso fallback:", parsed);
    return OPERATING_DAYS_FALLBACK;
  } catch (parseError) {
    logger.warn("Errore nel parsing di operatingDays, uso fallback:", parseError);
    return OPERATING_DAYS_FALLBACK;
  }
}

function useBootstrap() {
  const serverStatus = useStore((store) => store.serverStatus);
  const utente = useStore((store) => store.utente);
  const settingsLoaded = useStore((store) => store.settingsLoaded);
  const inProgressGlobal = useStore((store) => store.inProgress.global);
  const receiveUtente = useStore((store) => store.receiveUtente);
  const setSettings = useStore((store) => store.setSettings);
  const setSettingsLoaded = useStore((store) => store.setSettingsLoaded);
  const setSettingsError = useStore((store) => store.setSettingsError);
  const setPeriodi = useStore((store) => store.setPeriodi);
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
      if (serverStatus === OFFLINE || promiseLock.current || inProgressGlobal || !isAuthenticated()) return;
      // Se utente e settings sono già caricati, non fare nulla
      if (utente && settingsLoaded) return;

      let needsRetry = false;
      promiseLock.current = (async () => {
        try {
          onInProgress("global");

          // Fetch utente solo se non ancora caricato
          if (!utente) {
            const { data } = await fetchLoggedUtente();
            if (!data?.authentication?.utenteCorrente) {
              receiveUtente(null);
              return;
            }
            const {
              authentication: { utenteCorrente },
            } = data;
            receiveUtente(utenteCorrente);
          }

          // Carica le BusinessSettings nello store con retry e backoff esponenziale
          let settingsSuccess = false;
          let lastError: unknown = null;

          await SETTINGS_RETRY_DELAYS.reduce(async (previousAttempt, delay, index) => {
            await previousAttempt;
            if (settingsSuccess) return;

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
                  operatingDays: parseOperatingDays(rawSettings.operatingDays),
                };
                setSettings(parsed);
              }

              // Estrai e parsa i periodi di programmazione
              const rawPeriodi = settingsData?.settings?.periodiProgrammazione;
              if (Array.isArray(rawPeriodi)) {
                const periodi: PeriodoProgrammazione[] = rawPeriodi.map(
                  (p: { periodoId: number; dataInizio: string; dataFine: string | null; giorniOperativi: unknown; settingsId?: number; creatoIl?: string; aggiornatoIl?: string }) => ({
                    ...p,
                    settingsId: p.settingsId ?? 0,
                    giorniOperativi: parseOperatingDays(p.giorniOperativi),
                  }),
                );
                setPeriodi(periodi);
              }

              settingsSuccess = true;
            } catch (settingsError) {
              lastError = settingsError;
              logger.log(`Tentativo ${index + 1}/${SETTINGS_RETRY_DELAYS.length} fallito per il caricamento settings:`, settingsError);
              if (index < SETTINGS_RETRY_DELAYS.length - 1) {
                await wait(delay);
              }
            }
          }, Promise.resolve());

          if (!settingsSuccess) {
            const errorMessage = "Impossibile caricare le impostazioni dell'attività";
            logger.log("Tutti i tentativi di caricamento settings falliti:", lastError);
            setSettingsError(errorMessage);
            showToast({ type: "error", message: errorMessage });
          }

          setSettingsLoaded(true);
        } catch (error: unknown) {
          logger.log(error);
          await confirm({
            title: "Network error",
            content: "Connessione con il server non riuscita",
            acceptLabel: "Riprova",
          });
          needsRetry = true;
        } finally {
          offInProgress("global");
          promiseLock.current = null;
        }
      })();
      await promiseLock.current;
      if (needsRetry) {
        bootstrap();
      }
    }
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm, offInProgress, onInProgress, receiveUtente, setSettings, setSettingsLoaded, setSettingsError, setPeriodi, serverStatus, settingsLoaded, utente]);
}

export default useBootstrap;
