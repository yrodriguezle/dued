import { PagamentoFornitoreRegistroInput } from "../../../graphql/registroCassa/mutations";

/**
 * Pagamento "libero": senza fattura né DDT, con causale e categoria (affitto, utenze,
 * stipendi). Nasce dalla griglia spese fisse della chiusura mensile ma sta sul registro del
 * giorno, quindi il form del giorno lo ricarica come ogni altra spesa.
 */
export const isPagamentoLibero = (pagamento: Pick<PagamentoFornitoreRegistro, "fattura" | "ddt">): boolean => !pagamento.fattura && !pagamento.ddt;

/** Riga della griglia che rappresenta un pagamento libero già salvato. */
export const isRigaPagamentoLibero = (row: Spese): boolean => !!row.isPagamentoFornitore && !row.fornitoreId && row.pagamentoId != null;

const rigaPagamentoLibero = (p: PagamentoFornitoreRegistro): Spese => ({
  // `descrizione` è la causale; `note` copre le righe scritte prima che i due campi fossero separati.
  description: p.descrizione?.trim() || p.note?.trim() || (p.categoria ? `Spesa fissa (${p.categoria})` : "Spesa"),
  amount: p.importo,
  isPagamentoFornitore: true,
  pagamentoId: p.pagamentoId,
  paymentMethod: p.metodoPagamento,
  categoria: p.categoria ?? undefined,
});

const rigaPagamentoDocumentale = (p: PagamentoFornitoreRegistro): Spese => {
  const hasInvoice = !!p.fattura;
  const nomeFornitore = hasInvoice ? p.fattura?.fornitore?.ragioneSociale || "Fornitore" : p.ddt?.fornitore?.ragioneSociale || "Fornitore";
  const fornitoreIdVal = hasInvoice ? p.fattura?.fornitore?.fornitoreId : p.ddt?.fornitore?.fornitoreId;
  const docType: "FA" | "DDT" = hasInvoice ? "FA" : "DDT";
  const docLabel = hasInvoice ? `FA ${p.fattura?.numeroFattura || ""}` : `DDT ${p.ddt?.numeroDdt || ""}`;

  // Ripristina aliquotaIva dal fornitore collegato
  const fornitoreAliquota = hasInvoice ? p.fattura?.fornitore?.aliquotaIva : p.ddt?.fornitore?.aliquotaIva;

  // Fattura con IVA digitata: si ripristina com'è invece di riderivarla dall'aliquota
  // del fornitore. La modalità è il campo persistito, non una deduzione dagli importi.
  const ivaDigitata = hasInvoice && p.fattura?.ivaCalcolata === false ? p.fattura?.importoIva : undefined;

  return {
    description: `Pagamento ${nomeFornitore} - ${docLabel}`,
    amount: p.importo,
    isPagamentoFornitore: true,
    fornitoreId: fornitoreIdVal,
    ddtNumber: p.ddt?.numeroDdt,
    paymentMethod: p.metodoPagamento,
    documentType: docType,
    invoiceNumber: p.fattura?.numeroFattura,
    pagamentoId: p.pagamentoId,
    fatturaId: p.fattura?.fatturaId,
    ddtId: p.ddt?.ddtId,
    dataFattura: p.fattura?.dataFattura,
    dataDdt: p.ddt?.dataDdt,
    aliquotaIva: fornitoreAliquota ?? undefined,
    importoIva: ivaDigitata ?? undefined,
    categoria: p.categoria ?? undefined,
  };
};

/**
 * Righe della griglia spese per i pagamenti del registro: tutti, qualunque sia il punto da
 * cui sono stati inseriti (registro giornaliero o chiusura mensile).
 */
export const buildPagamentoRows = (pagamenti: PagamentoFornitoreRegistro[] | undefined | null): Spese[] =>
  (pagamenti ?? []).map((p) => (isPagamentoLibero(p) ? rigaPagamentoLibero(p) : rigaPagamentoDocumentale(p)));

/**
 * Payload `pagamentiFornitori` di `mutateRegistroCassa`. Il backend tratta l'elenco come la
 * verità del giorno e cancella ogni pagamento che non c'è: nessuna riga pagamento della
 * griglia può quindi restare fuori, né i documentali (con fornitore) né i liberi (già salvati).
 */
export const buildPagamentiInput = (expenses: Spese[]): PagamentoFornitoreRegistroInput[] =>
  expenses
    .filter((row) => row.isPagamentoFornitore && (row.fornitoreId || isRigaPagamentoLibero(row)))
    .map((row) =>
      isRigaPagamentoLibero(row)
        ? {
            pagamentoId: row.pagamentoId,
            numeroDdt: "",
            importo: row.amount,
            metodoPagamento: row.paymentMethod || undefined,
            tipoDocumento: "DDT",
            categoria: row.categoria,
            descrizione: row.description,
          }
        : {
            fornitoreId: row.fornitoreId!,
            numeroDdt: row.ddtNumber || "",
            importo: row.amount,
            metodoPagamento: row.paymentMethod || undefined,
            tipoDocumento: row.documentType || "DDT",
            numeroFattura: row.invoiceNumber || undefined,
            pagamentoId: row.pagamentoId,
            fatturaId: row.fatturaId,
            ddtId: row.ddtId,
            dataFattura: row.dataFattura,
            dataDdt: row.dataDdt,
            aliquotaIva: row.aliquotaIva ?? undefined,
            importoIva: row.importoIva ?? undefined,
            categoria: row.categoria,
          }
    );
