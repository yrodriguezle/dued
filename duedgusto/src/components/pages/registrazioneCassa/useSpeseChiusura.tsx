import { useMemo } from "react";
import { useMutation } from "@apollo/client";
import { SpeseDataGridPersistence, SpeseGridRow } from "./SpeseDataGrid";
import {
  mutationAggiungiSpesaCassaSuGiorno,
  mutationAggiornaSpesaCassaSuGiorno,
  mutationEliminaSpesaCassaSuGiorno,
  mutationAggiungiPagamentoFornitoreSuGiorno,
  mutationAggiornaPagamentoFornitoreSuGiorno,
  mutationEliminaPagamentoFornitoreSuGiorno,
} from "../../../graphql/chiusureMensili/speseMutations";

interface UseSpeseChiusuraArgs {
  // Refetch della query chiusura mensile: riquadra i KPI aggregati dopo ogni op.
  refetch: () => Promise<unknown> | void;
}

// Persistenza per-riga della griglia spese della CHIUSURA MENSILE.
// Mappa i 6 callback di SpeseDataGridPersistence sulle mutation `*SuGiorno`,
// instradando ogni riga al registro del giorno (row.data). Le create ritornano
// l'id assegnato dal server (patch riga anti doppio-insert). Dopo ogni op esegue
// il refetch della chiusura per riaggregare i KPI.
export default function useSpeseChiusura({ refetch }: UseSpeseChiusuraArgs): SpeseDataGridPersistence {
  const [aggiungiSpesa] = useMutation(mutationAggiungiSpesaCassaSuGiorno);
  const [aggiornaSpesa] = useMutation(mutationAggiornaSpesaCassaSuGiorno);
  const [eliminaSpesa] = useMutation(mutationEliminaSpesaCassaSuGiorno);
  const [aggiungiPagamento] = useMutation(mutationAggiungiPagamentoFornitoreSuGiorno);
  const [aggiornaPagamento] = useMutation(mutationAggiornaPagamentoFornitoreSuGiorno);
  const [eliminaPagamento] = useMutation(mutationEliminaPagamentoFornitoreSuGiorno);

  return useMemo<SpeseDataGridPersistence>(
    () => ({
      createExpense: async (row: SpeseGridRow) => {
        const { data } = await aggiungiSpesa({
          variables: {
            input: {
              data: row.data ?? "",
              descrizione: row.description,
              importo: row.amount,
              categoria: row.categoria ?? "Altro",
            },
          },
        });
        await refetch();
        return data?.gestioneCassa.aggiungiSpesaCassaSuGiorno.id ?? null;
      },
      updateExpense: async (row: SpeseGridRow) => {
        if (!row.spesaId || row.spesaId <= 0) return;
        await aggiornaSpesa({
          variables: {
            input: {
              spesaId: row.spesaId,
              data: row.data ?? "",
              descrizione: row.description,
              importo: row.amount,
              categoria: row.categoria ?? "Altro",
            },
          },
        });
        await refetch();
      },
      deleteExpense: async (row: SpeseGridRow) => {
        if (!row.spesaId || row.spesaId <= 0) return;
        await eliminaSpesa({ variables: { spesaId: row.spesaId } });
        await refetch();
      },
      createSupplierPayment: async (row: SpeseGridRow) => {
        const { data } = await aggiungiPagamento({
          variables: {
            input: {
              data: row.data ?? "",
              importo: row.amount,
              metodoPagamento: row.paymentMethod || undefined,
              categoria: row.categoria || undefined,
              // Riga CON fattura: DDT esclusi (Decision 2), si instrada come "FA".
              fornitoreId: row.fornitoreId,
              numeroFattura: row.invoiceNumber ?? row.ddtNumber,
              dataFattura: row.dataFattura ?? row.dataDdt,
              aliquotaIva: row.aliquotaIva ?? undefined,
            },
          },
        });
        await refetch();
        return data?.gestioneCassa.aggiungiPagamentoFornitoreSuGiorno.pagamentoId ?? null;
      },
      updateSupplierPayment: async (row: SpeseGridRow) => {
        if (!row.pagamentoId) return;
        await aggiornaPagamento({
          variables: {
            input: {
              pagamentoId: row.pagamentoId,
              fatturaId: row.fatturaId ?? undefined,
              ddtId: row.ddtId ?? undefined,
              dataPagamento: row.data ?? "",
              importo: row.amount,
              metodoPagamento: row.paymentMethod || undefined,
              categoria: row.categoria || undefined,
            },
          },
        });
        await refetch();
      },
      deleteSupplierPayment: async (row: SpeseGridRow) => {
        if (!row.pagamentoId) return;
        await eliminaPagamento({ variables: { pagamentoId: row.pagamentoId } });
        await refetch();
      },
    }),
    [aggiungiSpesa, aggiornaSpesa, eliminaSpesa, aggiungiPagamento, aggiornaPagamento, eliminaPagamento, refetch]
  );
}
