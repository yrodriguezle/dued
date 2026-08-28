import { useMemo } from "react";
import { useQuery } from "@apollo/client";
import { parseDateForGraphQL } from "../../common/date/date";
import { getRegistroCassa } from "./queries";

interface UseQueryRegistroCassaParams {
  data: string;
  skip?: boolean;
}

function useQueryRegistroCassa({ data: dataParam, skip = false }: UseQueryRegistroCassaParams) {
  // 🔴 `registroCassa(data:)` è mappato su DateTimeGraphType: pretende l'ISO-8601 completo e
  //    rifiuta la data secca con "Unable to convert '2026-08-28' to 'DateTime'". La normalizzazione
  //    sta qui, e non nei chiamanti, perché questo hook è l'unico posto che dichiara `$data:
  //    DateTime!`: chi ha in mano una data la passa com'è e non deve ricordarsi la forma giusta.
  //    `parseDateForGraphQL` è idempotente, quindi anche una data già estesa attraversa indenne.
  const dataNormalizzata = useMemo(() => parseDateForGraphQL(dataParam) ?? dataParam, [dataParam]);

  const { data, error, loading, refetch } = useQuery(getRegistroCassa, {
    variables: { data: dataNormalizzata },
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
