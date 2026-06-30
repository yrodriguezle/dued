import { useQuery } from "@apollo/client";
import { useCallback, useMemo } from "react";
import dayjs from "dayjs";
import { getRegistriCassa } from "./queries";

interface UseQueryRegistriCassaByMonthProps {
  year: number;
  month: number;
  skip?: boolean;
}

export function useQueryCashRegistersByMonth({ year, month, skip = false }: UseQueryRegistriCassaByMonthProps) {
  // Get first and last day of month
  const firstDay = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  const lastDay = firstDay.endOf("month");

  const startDate = firstDay.format("YYYY-MM-DD");
  const endDate = lastDay.format("YYYY-MM-DD");

  // Build where clause for date range - use 'data' (Italian field name)
  const whereClause = `data >= '${startDate}' AND data <= '${endDate}'`;

  const { data, loading, error, refetch } = useQuery(getRegistriCassa, {
    variables: {
      pageSize: 100, // Get up to 100 records for the month
      where: whereClause,
      orderBy: "data DESC",
    },
    skip,
  });

  const registriCassa = useMemo(() => {
    return data?.connection?.registriCassa?.items || [];
  }, [data]);

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    registriCassa,
    // Legacy alias
    cashRegisters: registriCassa,
    loading,
    error,
    refresh,
  };
}

export default useQueryCashRegistersByMonth;
