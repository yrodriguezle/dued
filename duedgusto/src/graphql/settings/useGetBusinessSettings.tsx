import { useMemo } from "react";
import { useQuery } from "@apollo/client";
import { GET_BUSINESS_SETTINGS } from "./queries";

interface UseGetBusinessSettingsResult {
  settings: BusinessSettings | undefined;
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

  return {
    settings,
    loading,
    error,
    refetch,
  };
}

export default useGetBusinessSettings;
