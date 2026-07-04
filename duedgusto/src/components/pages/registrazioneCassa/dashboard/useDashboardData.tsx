import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@apollo/client";
import logger from "../../../../common/logger/logger";
import { aggregaRegistriPerMese, derivaTotali } from "../../../../common/registroCassa/aggregaRegistri";
import { getRegistriCassa } from "../../../../graphql/registroCassa/queries";
import useQueryRiepilogoAnnuale from "../../../../graphql/registroCassa/useQueryRiepilogoAnnuale";
import useRegistroCassaSubscription from "../../../../graphql/subscriptions/useRegistroCassaSubscription";

// Riferimento stabile a livello di modulo (react-best-practices §3)
const EMPTY_MESI: RiepilogoMeseDashboard[] = [];
// L'adapter è temporaneo: replica il pageSize del vecchio useQueryYearlySummary
const PAGE_SIZE_ADAPTER = 1000;

/** Estrae l'anno da una data ISO ("2026-07-04" o "2026-07-04T00:00:00.000Z"). */
function annoDaData(data: string | null | undefined): number | null {
  if (!data) return null;
  const [annoStr] = data.split("T")[0].split("-");
  const anno = parseInt(annoStr, 10);
  return Number.isNaN(anno) ? null : anno;
}

interface UseDashboardDataProps {
  anno: number;
}

/**
 * Contratto dati unico della dashboard cassa (`RiepilogoDashboard`):
 * 1. fonte primaria = query server aggregata `riepilogoAnnuale(anno)`;
 * 2. fallback adapter client SOLO se il server risponde con errore di
 *    validazione schema (field non ancora deployato);
 * 3. refetch mirato via subscription (solo eventi dell'anno selezionato);
 * 4. derivati (totaliAnno, meseCorrente, mese di riferimento) memoizzati.
 */
function useDashboardData({ anno }: UseDashboardDataProps) {
  const {
    mesi: mesiServer,
    loading: serverLoading,
    error: serverError,
    refetch: serverRefetch,
    schemaNonDisponibile,
  } = useQueryRiepilogoAnnuale({ anno });

  // TEMPORANEO: rimuovere quando riepilogoAnnuale è deployato su tutti gli
  // ambienti. L'adapter scarica i registri dell'anno e applica le stesse
  // formule normative client-side (aggregaRegistriPerMese).
  const adapterAttivo = schemaNonDisponibile;

  const whereClause = `data >= '${anno}-01-01' AND data <= '${anno}-12-31'`;
  const {
    data: adapterData,
    loading: adapterLoading,
    error: adapterError,
    refetch: adapterRefetch,
  } = useQuery(getRegistriCassa, {
    variables: {
      pageSize: PAGE_SIZE_ADAPTER,
      where: whereClause,
      orderBy: "data ASC",
    },
    // L'adapter NON viene eseguito quando il server risponde
    skip: !adapterAttivo,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  useEffect(() => {
    if (adapterAttivo) {
      logger.warn(
        "useDashboardData: query riepilogoAnnuale non disponibile sul server (GRAPHQL_VALIDATION_FAILED), attivo l'adapter client con aggregazione locale dei registri."
      );
    }
  }, [adapterAttivo]);

  const mesiAdapter = useMemo(() => {
    const items = adapterData?.connection?.registriCassa?.items;
    if (!items) return EMPTY_MESI;
    return aggregaRegistriPerMese(items, anno);
  }, [adapterData, anno]);

  const fonte: RiepilogoDashboard["fonte"] = adapterAttivo ? "adapter" : "server";
  const mesi = adapterAttivo ? mesiAdapter : mesiServer;

  const refetch = useCallback(() => {
    if (adapterAttivo) return adapterRefetch();
    return serverRefetch();
  }, [adapterAttivo, adapterRefetch, serverRefetch]);

  // Subscription: refetch mirato SOLO se l'evento riguarda l'anno selezionato
  // (pattern useRef sull'evento precedente, come VistaMensile.tsx righe 66-73).
  const { data: subscriptionData } = useRegistroCassaSubscription();
  const lastEventRef = useRef(subscriptionData);

  useEffect(() => {
    if (subscriptionData && subscriptionData !== lastEventRef.current) {
      lastEventRef.current = subscriptionData;
      const annoEvento = annoDaData(subscriptionData.onRegistroCassaUpdated?.data);
      if (annoEvento === anno) {
        refetch();
      }
    }
  }, [subscriptionData, anno, refetch]);

  // Derivati (catena useMemo, react-best-practices §12)
  const totaliAnno = useMemo<RiepilogoDashboard["totaliAnno"]>(() => ({ ...derivaTotali(mesi), anno }), [mesi, anno]);

  const oggi = new Date();
  const annoCorrente = oggi.getFullYear();
  const numeroMeseCorrente = oggi.getMonth() + 1;

  const meseCorrente = useMemo<RiepilogoMeseDashboard | null>(() => {
    if (anno !== annoCorrente) return null;
    return mesi[numeroMeseCorrente - 1] ?? null;
  }, [mesi, anno, annoCorrente, numeroMeseCorrente]);

  // Mese di riferimento per i KPI: mese corrente se anno corrente, altrimenti
  // ultimo mese dell'anno con almeno un registro.
  const meseRiferimento = useMemo<RiepilogoMeseDashboard | null>(() => {
    if (mesi.length === 0) return null;
    if (anno === annoCorrente) return mesi[numeroMeseCorrente - 1] ?? null;
    const mesiConRegistri = mesi.filter((mese) => mese.registri > 0);
    return mesiConRegistri.length > 0 ? mesiConRegistri[mesiConRegistri.length - 1] : null;
  }, [mesi, anno, annoCorrente, numeroMeseCorrente]);

  const riepilogo = useMemo<RiepilogoDashboard>(
    () => ({ anno, mesi, totaliAnno, meseCorrente, fonte }),
    [anno, mesi, totaliAnno, meseCorrente, fonte]
  );

  const loading = adapterAttivo ? adapterLoading : serverLoading;
  // L'errore di validazione schema è gestito dall'adapter: non va propagato
  const error = adapterAttivo ? adapterError : serverError;

  // Spec "Gestione errori": gli errori non recuperabili (dopo l'eventuale
  // fallback adapter) MUST essere loggati tramite il logger dell'app.
  useEffect(() => {
    if (error) {
      logger.error("useDashboardData: errore nel caricamento dei dati della dashboard cassa.", error);
    }
  }, [error]);

  return {
    riepilogo,
    meseRiferimento,
    fonte,
    loading,
    error,
    refetch,
  };
}

export default useDashboardData;
