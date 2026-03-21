import { useMemo } from "react";
import { useQuery } from "@apollo/client";
import { GET_BUSINESS_SETTINGS } from "./queries";

interface UseGetBusinessSettingsResult {
  settings: BusinessSettings | undefined;
  periodi: PeriodoProgrammazione[];
  giorniNonLavorativi: GiornoNonLavorativo[];
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<unknown>;
}

export function useGetBusinessSettings(skip = false): UseGetBusinessSettingsResult {
  const { data, loading, error, refetch } = useQuery(GET_BUSINESS_SETTINGS, {
    skip,
    pollInterval: 0,
  });

  const settings = useMemo(() => {
    const rawSettings = data?.settings?.businessSettings;
    if (!rawSettings) return undefined;

    return {
      ...rawSettings,
      openingTime: rawSettings.openingTime?.substring(0, 5) || "",
      closingTime: rawSettings.closingTime?.substring(0, 5) || "",
      operatingDays: typeof rawSettings.operatingDays === "string" ? JSON.parse(rawSettings.operatingDays) : rawSettings.operatingDays,
    } as BusinessSettings;
  }, [data?.settings?.businessSettings]);

  const periodi = useMemo(() => {
    const rawPeriodi = data?.settings?.periodiProgrammazione;
    if (!rawPeriodi || !Array.isArray(rawPeriodi)) return [];

    return rawPeriodi.map((p: { periodoId: number; dataInizio: string; dataFine: string | null; giorniOperativi: string | boolean[] }) => ({
      ...p,
      giorniOperativi: typeof p.giorniOperativi === "string" ? JSON.parse(p.giorniOperativi) : p.giorniOperativi,
    })) as PeriodoProgrammazione[];
  }, [data?.settings?.periodiProgrammazione]);

  const giorniNonLavorativi = useMemo(() => {
    const rawGiorni = data?.settings?.giorniNonLavorativi;
    if (!rawGiorni || !Array.isArray(rawGiorni)) return [];
    return rawGiorni as GiornoNonLavorativo[];
  }, [data?.settings?.giorniNonLavorativi]);

  return {
    settings,
    periodi,
    giorniNonLavorativi,
    loading,
    error,
    refetch,
  };
}

export default useGetBusinessSettings;
