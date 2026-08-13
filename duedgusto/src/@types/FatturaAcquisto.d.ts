type FatturaAcquisto = {
  __typename: "FatturaAcquisto";
  fatturaId: number;
  fornitoreId: number;
  fornitore?: Fornitore;
  numeroFattura: string;
  dataFattura: string;
  dataScadenza?: string | null;
  imponibile: number;
  importoIva?: number | null;
  totaleConIva?: number | null;
  /** false = `importoIva` è stato digitato dall'operatore (fattura multialiquota), non calcolato. */
  ivaCalcolata: boolean;
  stato: "DA_PAGARE" | "PARZIALMENTE_PAGATA" | "PAGATA";
  note?: string | null;
  documentiTrasporto?: DocumentoTrasporto[];
  pagamenti?: PagamentoFornitore[];
  createdAt: string;
  updatedAt: string;
};

type FatturaAcquistoInput = {
  fatturaId?: number;
  fornitoreId: number;
  numeroFattura: string;
  dataFattura: string;
  dataScadenza?: string;
  imponibile: number;
  aliquotaIva: number;
  /** IVA presa dal documento: se valorizzata prevale su `aliquotaIva`, che il backend ignora. */
  importoIva?: number;
  stato?: string;
  note?: string;
  pagamenti?: PagamentoFornitoreInput[];
};
