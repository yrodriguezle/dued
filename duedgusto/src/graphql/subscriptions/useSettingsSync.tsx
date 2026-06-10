import { useEffect, useRef } from "react";
import { useApolloClient } from "@apollo/client";

import useSettingsSubscription from "./useSettingsSubscription";
import { GET_BUSINESS_SETTINGS } from "../settings/queries";
import useSyncSettingsToStore from "../settings/useSyncSettingsToStore";

/**
 * Hook globale che ascolta la subscription onSettingsUpdated
 * e sincronizza lo Zustand store con i dati freschi dal server
 * tramite useSyncSettingsToStore (unico writer Apollo → Zustand).
 * Da usare in un componente always-mounted (es. Layout).
 */
function useSettingsSync() {
  const apolloClient = useApolloClient();
  const syncToStore = useSyncSettingsToStore();
  const { data: settingsSubscriptionData } = useSettingsSubscription();
  const lastSettingsEventRef = useRef(settingsSubscriptionData);

  useEffect(() => {
    if (settingsSubscriptionData && settingsSubscriptionData !== lastSettingsEventRef.current) {
      lastSettingsEventRef.current = settingsSubscriptionData;
      apolloClient
        .query({ query: GET_BUSINESS_SETTINGS, fetchPolicy: "network-only" })
        .then((result) => {
          syncToStore(result.data?.settings);
        });
    }
  }, [settingsSubscriptionData, apolloClient, syncToStore]);
}

export default useSettingsSync;
