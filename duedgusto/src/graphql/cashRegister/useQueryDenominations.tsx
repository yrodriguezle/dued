import { useQuery } from "@apollo/client";
import { getDenominations } from "./queries";

function useQueryDenominations() {
  const { data, error, loading } = useQuery(getDenominations);

  const denominations = data?.cashManagement?.denominations || [];

  return {
    denominations,
    error,
    loading,
  };
}

export default useQueryDenominations;
