type PagamentoFornitore = {
  __typename: "PagamentoFornitore";
  pagamentoId: number;
  fatturaId?: number | null;
  ddtId?: number | null;
  fattura?: FatturaAcquisto | null;
  ddt?: DocumentoTrasporto | null;
  dataPagamento: string;
  importo: number;
  metodoPagamento?: string | null;
  note?: string | null;
  creatoIl: string;
  aggiornatoIl: string;
};

type PagamentoFornitoreInput = {
  pagamentoId?: number;
  fatturaId?: number;
  ddtId?: number;
  dataPagamento: string;
  importo: number;
  metodoPagamento?: string;
  note?: string;
};
