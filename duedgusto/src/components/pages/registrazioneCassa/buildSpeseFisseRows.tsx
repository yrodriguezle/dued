import dayjs from "dayjs";
import { SpeseGridRow } from "./SpeseDataGrid";

/**
 * Categorie considerate "spese fisse del mese": sono le uniche che la griglia della
 * Chiusura Mensile mostra e permette di inserire. La minuta quotidiana (categoria
 * `Altro`: GIORNALE, spesa del giorno) resta sul registro giornaliero.
 */
export const CATEGORIE_FISSE: CategoriaSpesa[] = ["Affitto", "Utenze", "Stipendi"];

const isFissa = (categoria?: CategoriaSpesa | null): categoria is CategoriaSpesa =>
  !!categoria && CATEGORIE_FISSE.includes(categoria);

/**
 * Costruisce le righe della griglia spese fisse a partire dai registri inclusi nella
 * chiusura. Aggregazione pura: la chiusura non possiede spese, le legge dai giorni.
 *
 * - Solo i registri con `incluso`, la stessa base dei KPI del mese.
 * - Spese non tracciate: tenute se la categoria è fissa.
 * - Pagamenti: tenuti solo se hanno una categoria fissa. I pagamenti documentali
 *   (fatture/DDT fornitori) hanno `categoria` null e restano fuori.
 * - La colonna Data viene dal registro genitore: `SpesaCassa` non ha una data propria.
 * - Ordine stabile per data e id: la griglia ricostruisce le righe a ogni refetch e
 *   senza un ordine deterministico salterebbero di posto.
 */
function buildSpeseFisseRows(registriInclusi: RegistroCassaMensile[]): SpeseGridRow[] {
  const righe = registriInclusi
    .filter((ri) => ri.incluso && ri.registro)
    .flatMap((ri) => {
      const data = dayjs(ri.registro.data).format("YYYY-MM-DD");

      const spese: SpeseGridRow[] = (ri.registro.spese ?? [])
        .filter((s) => isFissa(s.categoria))
        .map((s) => ({
          spesaId: s.id,
          description: s.descrizione,
          amount: s.importo,
          categoria: s.categoria,
          data,
          registroCassaId: ri.registroId,
        }));

      const pagamenti: SpeseGridRow[] = (ri.registro.pagamentiFornitori ?? [])
        .filter((p) => isFissa(p.categoria))
        .map((p) => ({
          pagamentoId: p.pagamentoId,
          isPagamentoFornitore: true,
          description: p.note?.trim() || `Spesa fissa tracciata (${p.categoria})`,
          amount: p.importo,
          categoria: p.categoria as CategoriaSpesa,
          data,
          paymentMethod: p.metodoPagamento ?? undefined,
          fatturaId: p.fatturaId ?? undefined,
          ddtId: p.ddtId ?? undefined,
          documentType: p.fatturaId != null ? "FA" : "DDT",
          registroCassaId: ri.registroId,
        }));

      return [...spese, ...pagamenti];
    });

  return righe.sort((a, b) => {
    if (a.data !== b.data) return (a.data ?? "").localeCompare(b.data ?? "");
    const aFornitore = a.isPagamentoFornitore ? 1 : 0;
    const bFornitore = b.isPagamentoFornitore ? 1 : 0;
    if (aFornitore !== bFornitore) return aFornitore - bFornitore;
    return (a.spesaId ?? a.pagamentoId ?? 0) - (b.spesaId ?? b.pagamentoId ?? 0);
  });
}

export default buildSpeseFisseRows;
