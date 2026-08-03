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
  createdAt: string;
  updatedAt: string;
};

type PagamentoFornitoreInput = {
  pagamentoId?: number;
  fatturaId?: number;
  ddtId?: number;
  dataPagamento: string;
  importo: number;
  metodoPagamento?: string;
  note?: string;
  /**
   * Valorizzata solo per le spese fisse pagate in modo tracciato (bonifico senza
   * documento): è ciò che le distingue dai pagamenti documentali, dove resta null.
   */
  categoria?: CategoriaSpesa;
};
