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

  return {
    settings: data?.getBusinessSettings as BusinessSettings | undefined,
    loading,
    error,
    refetch,
  };
}

export default useGetBusinessSettings;
