import { useMemo } from "react";
import { useQuery } from "@apollo/client";
import { GET_BUSINESS_SETTINGS } from "./queries";
import { parseSettingsFromRaw, RawSettingsData } from "./parseSettingsFromRaw";

interface UseGetBusinessSettingsResult {
  settings: BusinessSettings | undefined;
  periodi: PeriodoProgrammazione[];
  giorniNonLavorativi: GiornoNonLavorativo[];
  rawSettings: RawSettingsData | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<unknown>;
}

export function useGetBusinessSettings(skip = false): UseGetBusinessSettingsResult {
  const { data, loading, error, refetch } = useQuery(GET_BUSINESS_SETTINGS, {
    skip,
    pollInterval: 0,
  });

  const rawSettings: RawSettingsData | undefined = data?.settings;

  const parsed = useMemo(() => parseSettingsFromRaw(rawSettings), [rawSettings]);

  return {
    settings: parsed.settings ?? undefined,
    periodi: parsed.periodi,
    giorniNonLavorativi: parsed.giorniNonLavorativi,
    rawSettings,
    loading,
    error,
    refetch,
  };
}

export default useGetBusinessSettings;
