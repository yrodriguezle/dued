import { useCallback } from "react";

import useStore from "../../store/useStore";
import { parseSettingsFromRaw, RawSettingsData } from "./parseSettingsFromRaw";

/**
 * Unico writer Apollo → Zustand per i settings.
 * Riceve i dati raw del campo Query.settings (da query, refetch o subscription)
 * e scrive nello store la shape normalizzata prodotta da parseSettingsFromRaw
 * (orari troncati a HH:mm, operatingDays/giorniOperativi come boolean[]).
 */
function useSyncSettingsToStore() {
  const setSettings = useStore((state) => state.setSettings);
  const setPeriodi = useStore((state) => state.setPeriodi);
  const setGiorniNonLavorativi = useStore((state) => state.setGiorniNonLavorativi);

  return useCallback(
    (raw: RawSettingsData | null | undefined) => {
      const parsed = parseSettingsFromRaw(raw);
      if (parsed.settings) setSettings(parsed.settings);
      setPeriodi(parsed.periodi);
      setGiorniNonLavorativi(parsed.giorniNonLavorativi);
    },
    [setSettings, setPeriodi, setGiorniNonLavorativi]
  );
}

export default useSyncSettingsToStore;
