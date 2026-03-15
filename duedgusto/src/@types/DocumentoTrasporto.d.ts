type DocumentoTrasporto = {
  __typename: "DocumentoTrasporto";
  ddtId: number;
  fatturaId?: number | null;
  fornitoreId: number;
  fornitore?: Fornitore;
  fattura?: FatturaAcquisto | null;
  numeroDdt: string;
  dataDdt: string;
  importo?: number | null;
  note?: string | null;
  pagamenti?: PagamentoFornitore[];
  creatoIl: string;
  aggiornatoIl: string;
};

type DocumentoTrasportoInput = {
  ddtId?: number;
  fatturaId?: number;
  fornitoreId: number;
  numeroDdt: string;
  dataDdt: string;
  importo?: number;
  note?: string;
};
