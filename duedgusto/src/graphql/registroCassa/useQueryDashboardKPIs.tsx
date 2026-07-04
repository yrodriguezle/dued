import { useQuery } from "@apollo/client";
import { getDashboardKPIs } from "./queries";

/**
 * @deprecated Hook mai consumato dall'app: la dashboard usa
 * `useQueryRiepilogoAnnuale` + `useDashboardData`
 * (change dashboard-charts-redesign). Rimozione in cleanup separato.
 */
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
