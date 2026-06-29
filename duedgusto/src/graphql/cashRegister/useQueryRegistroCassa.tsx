import { useQuery } from "@apollo/client";
import { getRegistroCassa } from "./queries";

interface UseQueryRegistroCassaParams {
  data: string;
  skip?: boolean;
}

function useQueryRegistroCassa({ data: dataParam, skip = false }: UseQueryRegistroCassaParams) {
  const { data, error, loading, refetch } = useQuery(getRegistroCassa, {
    variables: { data: dataParam },
    skip,
  });

  const registroCassa = data?.gestioneCassa?.registroCassa || null;

  return {
    registroCassa,
    error,
    loading,
    refetch,
  };
}

export default useQueryRegistroCassa;
