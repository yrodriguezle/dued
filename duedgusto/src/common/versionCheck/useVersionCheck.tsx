import { useCallback, useEffect, useState } from "react";
import fetchConfiguration from "../../api/fetchConfiguration";

// TODO: riportare a 5 minuti dopo il test del meccanismo di notifica
const CHECK_INTERVAL_MS = 30_000;

/**
 * Rileva la disponibilità di una nuova versione dell'app confrontando
 * la versione compilata nel bundle (__APP_VERSION__) con quella pubblicata
 * dal deploy in config.json (APP_VERSION).
 *
 * Il controllo avviene a intervalli regolari e quando l'utente torna
 * sulla scheda (visibilitychange). In sviluppo config.json non contiene
 * APP_VERSION, quindi il controllo non scatta mai.
 *
 * @returns true se sul server è pubblicata una versione diversa da quella in esecuzione
 */
function useVersionCheck(): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const checkVersion = useCallback(async () => {
    try {
      const response = await fetchConfiguration();
      if (!response.ok) {
        return;
      }
      const config: Partial<Global> = await response.json();
      const remoteVersion = config.APP_VERSION;
      const localVersion = (window as Global).appVersion;
      if (remoteVersion && localVersion && remoteVersion !== localVersion) {
        setUpdateAvailable(true);
      }
    } catch {
      // Rete assente o config non raggiungibile: riprova al prossimo ciclo
    }
  }, []);

  useEffect(() => {
    if (updateAvailable) {
      return;
    }
    const intervalId = window.setInterval(checkVersion, CHECK_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkVersion();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [checkVersion, updateAvailable]);

  return updateAvailable;
}

export default useVersionCheck;
