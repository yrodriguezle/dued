import { ApolloError, useQuery } from "@apollo/client";
import { useMemo } from "react";
import { getRiepilogoAnnuale } from "./queries";
import { completaDodiciMesi, normalizzaMeseServer } from "../../common/registroCassa/aggregaRegistri";

// Riferimento stabile a livello di modulo: evita nuovi [] a ogni render
// (react-best-practices §3).
const EMPTY_MESI: RiepilogoMeseDashboard[] = [];

/**
 * Rileva l'errore di validazione schema che indica che il field
 * `riepilogoAnnuale` non è ancora deployato sul backend
 * (GRAPHQL_VALIDATION_FAILED / "Cannot query field ...").
 */
export function isRiepilogoAnnualeNonDisponibile(error: ApolloError | undefined): boolean {
  if (!error) return false;
  return error.graphQLErrors.some(
    (graphQLError) =>
      graphQLError.extensions?.code === "GRAPHQL_VALIDATION_FAILED" ||
      /Cannot query field "?riepilogoAnnuale"?/i.test(graphQLError.message)
  );
}

interface UseQueryRiepilogoAnnualeProps {
  anno: number;
  skip?: boolean;
}

export function useQueryRiepilogoAnnuale({ anno, skip = false }: UseQueryRiepilogoAnnualeProps) {
  const { data, loading, error, refetch } = useQuery(getRiepilogoAnnuale, {
    variables: { anno },
    skip,
    // cache-first servirebbe uno snapshot stantio dell'anno quando si salva da
    // altre pagine con la dashboard smontata (stesso pattern del fix 33896a4 in
    // useQueryCashRegistersByMonth): mostra la cache ma rivalida sempre dalla rete.
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  // Normalizzazione: 12 mesi sempre garantiti + derivati client (totaleSpese, differenza)
  const mesi = useMemo(() => {
    const mesiServer = data?.gestioneCassa?.riepilogoAnnuale?.mesi;
    if (!mesiServer) return EMPTY_MESI;
    return completaDodiciMesi(anno, mesiServer.map(normalizzaMeseServer));
  }, [data, anno]);

  // Flag per l'adapter di fallback: il backend non espone ancora il field
  const schemaNonDisponibile = useMemo(() => isRiepilogoAnnualeNonDisponibile(error), [error]);

  const hasData = Boolean(data?.gestioneCassa?.riepilogoAnnuale);

  return {
    mesi,
    hasData,
    loading,
    error,
    refetch,
    schemaNonDisponibile,
  };
}

export default useQueryRiepilogoAnnuale;
