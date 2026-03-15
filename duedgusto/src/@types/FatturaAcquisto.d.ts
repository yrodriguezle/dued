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
  stato: "DA_PAGARE" | "PARZIALMENTE_PAGATA" | "PAGATA";
  note?: string | null;
  documentiTrasporto?: DocumentoTrasporto[];
  pagamenti?: PagamentoFornitore[];
  creatoIl: string;
  aggiornatoIl: string;
};

type FatturaAcquistoInput = {
  fatturaId?: number;
  fornitoreId: number;
  numeroFattura: string;
  dataFattura: string;
  dataScadenza?: string;
  imponibile: number;
  aliquotaIva: number;
  stato?: string;
  note?: string;
};
