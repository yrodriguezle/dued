import { useQuery } from "@apollo/client";
import { getCashRegister } from "./queries";

interface UseQueryCashRegisterParams {
  date: string;
  skip?: boolean;
}

function useQueryCashRegister({ date, skip = false }: UseQueryCashRegisterParams) {
  const { data, error, loading, refetch } = useQuery(getCashRegister, {
    variables: { date },
    skip,
  });

  const cashRegister = data?.cashManagement?.cashRegister || null;

  return {
    cashRegister,
    error,
    loading,
    refetch,
  };
}

export default useQueryCashRegister;
