import { useQuery } from "@apollo/client";
import { getCashRegister } from "./queries";

interface UseQueryCashRegisterParams {
  registerId?: number;
  date?: string;
  skip?: boolean;
}

function useQueryCashRegister({ registerId, date, skip = false }: UseQueryCashRegisterParams) {
  const { data, error, loading, refetch } = useQuery(getCashRegister, {
    variables: { registerId, date },
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
