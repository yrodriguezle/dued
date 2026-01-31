import { useQuery } from "@apollo/client";
import { getDenominazioni } from "./queries";

function useQueryDenominations() {
  const { data, error, loading } = useQuery(getDenominazioni);

  const denominazioni = data?.cashManagement?.denominazioni || [];

  return {
    denominazioni,
    error,
    loading,
  };
}

export default useQueryDenominations;
