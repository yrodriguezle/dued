import { useQuery } from "@apollo/client";
import { useCallback, useMemo } from "react";
import dayjs from "dayjs";
import { getCashRegisters } from "./queries";

interface UseQueryCashRegistersByMonthProps {
  year: number;
  month: number;
  skip?: boolean;
}

export function useQueryCashRegistersByMonth({
  year,
  month,
  skip = false,
}: UseQueryCashRegistersByMonthProps) {
  // Get first and last day of month
  const firstDay = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  const lastDay = firstDay.endOf("month");

  const startDate = firstDay.format("YYYY-MM-DD");
  const endDate = lastDay.format("YYYY-MM-DD");

  // Build where clause for date range
  const whereClause = `date >= '${startDate}' AND date <= '${endDate}'`;

  const { data, loading, error, refetch } = useQuery(getCashRegisters, {
    variables: {
      pageSize: 100, // Get up to 100 records for the month
      where: whereClause,
      orderBy: "date DESC",
    },
    skip,
  });

  const cashRegisters = useMemo(() => {
    return data?.cashManagement?.cashRegistersConnection?.items || [];
  }, [data]);

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    cashRegisters,
    loading,
    error,
    refresh,
  };
}

export default useQueryCashRegistersByMonth;
