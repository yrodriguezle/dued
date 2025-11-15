import { useQuery } from "@apollo/client";
import { getCashRegisters } from "./queries";

interface UseQueryCashRegisterByDateParams {
  date: string; // Format: YYYY-MM-DD
  skip?: boolean;
}

function useQueryCashRegisterByDate({ date, skip = false }: UseQueryCashRegisterByDateParams) {
  const { data, error, loading, refetch } = useQuery(getCashRegisters, {
    variables: {
      pageSize: 1,
      where: `date eq '${date}'`,
      orderBy: "date desc",
    },
    skip,
  });

  // Get the first cash register from the connection, or null if not found
  const cashRegister = data?.cashManagement?.cashRegistersConnection?.items?.[0] || null;

  return {
    cashRegister,
    error,
    loading,
    refetch,
  };
}

export default useQueryCashRegisterByDate;
