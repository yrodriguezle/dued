import { useEffect, useRef } from "react";
import { useApolloClient } from "@apollo/client";

import useSettingsSubscription from "./useSettingsSubscription";
import useStore from "../../store/useStore";
import { GET_BUSINESS_SETTINGS } from "../settings/queries";
import { parseSettingsFromRaw } from "../settings/parseSettingsFromRaw";

/**
 * Hook globale che ascolta la subscription onSettingsUpdated
 * e sincronizza lo Zustand store con i dati freschi dal server.
 * Da usare in un componente always-mounted (es. Layout).
 */
function useSettingsSync() {
  const apolloClient = useApolloClient();
  const { setGiorniNonLavorativi, setPeriodi, setSettings } = useStore();
  const { data: settingsSubscriptionData } = useSettingsSubscription();
  const lastSettingsEventRef = useRef(settingsSubscriptionData);

  useEffect(() => {
    if (settingsSubscriptionData && settingsSubscriptionData !== lastSettingsEventRef.current) {
      lastSettingsEventRef.current = settingsSubscriptionData;
      apolloClient
        .query({ query: GET_BUSINESS_SETTINGS, fetchPolicy: "network-only" })
        .then((result) => {
          const parsed = parseSettingsFromRaw(result.data?.settings);
          if (parsed.settings) {
            setSettings(parsed.settings);
          }
          setPeriodi(parsed.periodi);
          setGiorniNonLavorativi(parsed.giorniNonLavorativi);
        });
    }
  }, [settingsSubscriptionData, apolloClient, setGiorniNonLavorativi, setPeriodi, setSettings]);
}

export default useSettingsSync;
