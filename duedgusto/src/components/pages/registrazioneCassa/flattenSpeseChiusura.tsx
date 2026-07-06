import dayjs from "dayjs";
import { SpeseGridRow } from "./SpeseDataGrid";
import { statoRegistroCassa } from "../../../common/globals/constants";

// Un registro "leggero" della chiusura è un registro in bozza creato solo per
// ospitare spese/pagamenti instradati dalla chiusura (nessuna operatività cassa:
// totali apertura/chiusura a zero). Le sue righe sono editabili nella chiusura.
// Criterio allineato al backend (CleanupRegistroLeggeroVuotoAsync).
const isRegistroLeggero = (registro: RegistroCassaMensileRidotto): boolean =>
  registro.stato === statoRegistroCassa.DRAFT && !registro.totaleApertura && !registro.totaleChiusura;

// Appiattisce `registriInclusi[].registro.{spese, pagamentiFornitori}` in righe
// della griglia spese. `data` = giorno del registro; le spese sono sempre
// editabili; i pagamenti su registro operativo restano read-only (registroCassaId
// valorizzato → isReadOnlyPayment), quelli su registro leggero sono editabili
// (registroCassaId = null).
export default function flattenSpeseChiusura(registriInclusi: RegistroCassaMensile[]): SpeseGridRow[] {
  return registriInclusi.flatMap((ri) => {
    const registro = ri.registro;
    const data = dayjs(registro.data).format("YYYY-MM-DD");
    const leggero = isRegistroLeggero(registro);

    const pagamentoRows: SpeseGridRow[] = (registro.pagamentiFornitori ?? []).map((p): SpeseGridRow => {
      const nomeFornitore = p.fattura?.fornitore?.ragioneSociale || "Fornitore";
      const hasFattura = !!p.fattura;
      const docLabel = hasFattura ? `FA ${p.fattura?.numeroFattura || ""}`.trim() : "";
      return {
        description: docLabel ? `Pagamento ${nomeFornitore} - ${docLabel}` : `Pagamento ${nomeFornitore}`,
        amount: p.importo,
        isPagamentoFornitore: true,
        fornitoreId: p.fattura?.fornitore?.fornitoreId,
        documentType: "FA",
        invoiceNumber: p.fattura?.numeroFattura,
        pagamentoId: p.pagamentoId,
        fatturaId: p.fatturaId ?? undefined,
        ddtId: p.ddtId ?? undefined,
        dataFattura: p.fattura?.dataFattura,
        paymentMethod: p.metodoPagamento ?? undefined,
        aliquotaIva: p.fattura?.fornitore?.aliquotaIva ?? undefined,
        categoria: p.categoria ?? undefined,
        data,
        registroCassaId: leggero ? null : p.registroCassaId ?? null,
      };
    });

    const speseRows: SpeseGridRow[] = (registro.spese ?? []).map((s): SpeseGridRow => ({
      description: s.descrizione,
      amount: s.importo,
      categoria: s.categoria,
      spesaId: s.id,
      data,
    }));

    return [...pagamentoRows, ...speseRows];
  });
}
