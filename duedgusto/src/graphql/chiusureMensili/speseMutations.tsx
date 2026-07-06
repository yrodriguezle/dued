import { gql, TypedDocumentNode } from "@apollo/client";

// ============================================================================
// CRUD per-riga delle spese/pagamenti della CHIUSURA MENSILE.
// La chiusura NON possiede le spese: ogni riga è instradata al registro cassa
// del giorno (campo `data`) tramite le mutation `*SuGiorno` del namespace
// `gestioneCassa`. Le create ritornano l'id assegnato dal server (patch riga).
// ============================================================================

// Shape di ritorno di un PagamentoFornitore instradato al giorno (campi minimi
// per ricostruire la riga griglia CON fattura). `registroCassaId` distingue
// l'origine (registro leggero editabile vs registro operativo read-only).
export interface PagamentoFornitoreSuGiornoResult {
  __typename?: "PagamentoFornitore";
  pagamentoId: number;
  fatturaId?: number | null;
  ddtId?: number | null;
  registroCassaId?: number | null;
  dataPagamento: string;
  importo: number;
  metodoPagamento?: string | null;
  categoria?: CategoriaSpesa | null;
  note?: string | null;
  fattura?: FatturaChiusuraRidotta | null;
}

const pagamentoFornitoreSuGiornoFields = `
  pagamentoId
  fatturaId
  ddtId
  registroCassaId
  dataPagamento
  importo
  metodoPagamento
  categoria
  note
  fattura {
    fatturaId
    numeroFattura
    dataFattura
    imponibile
    totaleConIva
    stato
    fornitore {
      fornitoreId
      ragioneSociale
      aliquotaIva
    }
  }
`;

// ============ SpesaCassa: aggiungi ============

export interface AggiungiSpesaCassaSuGiornoInput {
  data: string;
  descrizione: string;
  importo: number;
  // Enum CategoriaSpesa NON-NULL lato server (default "Altro").
  categoria: CategoriaSpesa;
}

interface AggiungiSpesaCassaSuGiornoData {
  gestioneCassa: {
    aggiungiSpesaCassaSuGiorno: SpesaCassa;
  };
}

export const mutationAggiungiSpesaCassaSuGiorno: TypedDocumentNode<AggiungiSpesaCassaSuGiornoData, { input: AggiungiSpesaCassaSuGiornoInput }> = gql`
  mutation AggiungiSpesaCassaSuGiorno($input: AggiungiSpesaCassaSuGiornoInput!) {
    gestioneCassa {
      aggiungiSpesaCassaSuGiorno(input: $input) {
        id
        registroCassaId
        descrizione
        importo
        categoria
      }
    }
  }
`;

// ============ SpesaCassa: aggiorna (cambio data = sposta la riga) ============

export interface AggiornaSpesaCassaSuGiornoInput {
  spesaId: number;
  data: string;
  descrizione: string;
  importo: number;
  categoria: CategoriaSpesa;
}

interface AggiornaSpesaCassaSuGiornoData {
  gestioneCassa: {
    aggiornaSpesaCassaSuGiorno: SpesaCassa;
  };
}

export const mutationAggiornaSpesaCassaSuGiorno: TypedDocumentNode<AggiornaSpesaCassaSuGiornoData, { input: AggiornaSpesaCassaSuGiornoInput }> = gql`
  mutation AggiornaSpesaCassaSuGiorno($input: AggiornaSpesaCassaSuGiornoInput!) {
    gestioneCassa {
      aggiornaSpesaCassaSuGiorno(input: $input) {
        id
        registroCassaId
        descrizione
        importo
        categoria
      }
    }
  }
`;

// ============ SpesaCassa: elimina ============

interface EliminaSpesaCassaSuGiornoData {
  gestioneCassa: {
    eliminaSpesaCassaSuGiorno: boolean;
  };
}

export const mutationEliminaSpesaCassaSuGiorno: TypedDocumentNode<EliminaSpesaCassaSuGiornoData, { spesaId: number }> = gql`
  mutation EliminaSpesaCassaSuGiorno($spesaId: Int!) {
    gestioneCassa {
      eliminaSpesaCassaSuGiorno(spesaId: $spesaId)
    }
  }
`;

// ============ PagamentoFornitore: aggiungi (fattura opzionale, DDT esclusi) ============

export interface AggiungiPagamentoFornitoreSuGiornoInput {
  data: string;
  importo: number;
  metodoPagamento?: string;
  categoria?: CategoriaSpesa;
  // Con `fornitoreId` valorizzato il server crea/collega una FatturaAcquisto ("FA").
  fornitoreId?: number;
  numeroFattura?: string;
  dataFattura?: string;
  aliquotaIva?: number;
}

interface AggiungiPagamentoFornitoreSuGiornoData {
  gestioneCassa: {
    aggiungiPagamentoFornitoreSuGiorno: PagamentoFornitoreSuGiornoResult;
  };
}

export const mutationAggiungiPagamentoFornitoreSuGiorno: TypedDocumentNode<AggiungiPagamentoFornitoreSuGiornoData, { input: AggiungiPagamentoFornitoreSuGiornoInput }> = gql`
  mutation AggiungiPagamentoFornitoreSuGiorno($input: AggiungiPagamentoFornitoreSuGiornoInput!) {
    gestioneCassa {
      aggiungiPagamentoFornitoreSuGiorno(input: $input) {
        ${pagamentoFornitoreSuGiornoFields}
      }
    }
  }
`;

// ============ PagamentoFornitore: aggiorna (PagamentoFornitoreInput) ============

export interface AggiornaPagamentoFornitoreSuGiornoInput {
  pagamentoId: number;
  fatturaId?: number;
  ddtId?: number;
  // dataPagamento = Date (cambio data sposta la riga di giorno).
  dataPagamento: string;
  importo: number;
  metodoPagamento?: string;
  note?: string;
  categoria?: CategoriaSpesa;
}

interface AggiornaPagamentoFornitoreSuGiornoData {
  gestioneCassa: {
    aggiornaPagamentoFornitoreSuGiorno: PagamentoFornitoreSuGiornoResult;
  };
}

export const mutationAggiornaPagamentoFornitoreSuGiorno: TypedDocumentNode<AggiornaPagamentoFornitoreSuGiornoData, { input: AggiornaPagamentoFornitoreSuGiornoInput }> = gql`
  mutation AggiornaPagamentoFornitoreSuGiorno($input: PagamentoFornitoreInput!) {
    gestioneCassa {
      aggiornaPagamentoFornitoreSuGiorno(input: $input) {
        ${pagamentoFornitoreSuGiornoFields}
      }
    }
  }
`;

// ============ PagamentoFornitore: elimina ============

interface EliminaPagamentoFornitoreSuGiornoData {
  gestioneCassa: {
    eliminaPagamentoFornitoreSuGiorno: boolean;
  };
}

export const mutationEliminaPagamentoFornitoreSuGiorno: TypedDocumentNode<EliminaPagamentoFornitoreSuGiornoData, { pagamentoId: number }> = gql`
  mutation EliminaPagamentoFornitoreSuGiorno($pagamentoId: Int!) {
    gestioneCassa {
      eliminaPagamentoFornitoreSuGiorno(pagamentoId: $pagamentoId)
    }
  }
`;
