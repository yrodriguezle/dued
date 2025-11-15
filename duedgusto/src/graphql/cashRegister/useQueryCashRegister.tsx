import { useQuery } from "@apollo/client";
import { getCashRegister } from "./queries";

interface UseQueryCashRegisterParams {
  registerId: number;
  skip?: boolean;
}

function useQueryCashRegister({ registerId, skip = false }: UseQueryCashRegisterParams) {
  const { data, error, loading, refetch } = useQuery(getCashRegister, {
    variables: { registerId },
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
