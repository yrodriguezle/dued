import { useQuery } from "@apollo/client";
import { getDashboardKPIs } from "./queries";

function useQueryDashboardKPIs() {
  const { data, error, loading, refetch } = useQuery(getDashboardKPIs);

  const kpis = data?.gestioneCassa?.dashboardKPIs || null;

  return {
    kpis,
    error,
    loading,
    refetch,
  };
}

export default useQueryDashboardKPIs;
