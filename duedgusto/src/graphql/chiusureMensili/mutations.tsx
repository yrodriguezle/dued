import { gql, TypedDocumentNode } from "@apollo/client";
import { chiusuraMensileFragment, spesaMensileLiberaFragment } from "./fragments";

// ============ MUTATION: Crea Chiusura Mensile ============

interface CreaChiusuraMensileData {
  chiusureMensili: {
    creaChiusuraMensile: ChiusuraMensile;
  };
}

interface CreaChiusuraMensileVariables {
  anno: number;
  mese: number;
}

export const mutationCreaChiusuraMensile: TypedDocumentNode<CreaChiusuraMensileData, CreaChiusuraMensileVariables> = gql`
  mutation CreaChiusuraMensile($anno: Int!, $mese: Int!) {
    chiusureMensili {
      creaChiusuraMensile(anno: $anno, mese: $mese) {
        ...ChiusuraMensileFragment
      }
    }
  }
  ${chiusuraMensileFragment}
`;

// ============ MUTATION: Aggiungi Spesa Libera ============

interface AggiungiSpesaLiberaData {
  chiusureMensili: {
    aggiungiSpesaLibera: SpesaMensileLibera;
  };
}

interface AggiungiSpesaLiberaVariables {
  chiusuraId: number;
  descrizione: string;
  importo: number;
  categoria: string;
  data?: string | null;
}

export const mutationAggiungiSpesaLibera: TypedDocumentNode<AggiungiSpesaLiberaData, AggiungiSpesaLiberaVariables> = gql`
  mutation AggiungiSpesaLibera($chiusuraId: Int!, $descrizione: String!, $importo: Decimal!, $categoria: String!, $data: DateTime) {
    chiusureMensili {
      aggiungiSpesaLibera(chiusuraId: $chiusuraId, descrizione: $descrizione, importo: $importo, categoria: $categoria, data: $data) {
        ...SpesaMensileLiberaFragment
      }
    }
  }
  ${spesaMensileLiberaFragment}
`;

// ============ MUTATION: Modifica Spesa Libera ============

interface ModificaSpesaLiberaData {
  chiusureMensili: {
    modificaSpesaLibera: SpesaMensileLibera;
  };
}

interface ModificaSpesaLiberaVariables {
  spesaId: number;
  descrizione?: string;
  importo?: number;
  categoria?: string;
  data?: string | null;
}

export const mutationModificaSpesaLibera: TypedDocumentNode<ModificaSpesaLiberaData, ModificaSpesaLiberaVariables> = gql`
  mutation ModificaSpesaLibera($spesaId: Int!, $descrizione: String, $importo: Decimal, $categoria: String, $data: DateTime) {
    chiusureMensili {
      modificaSpesaLibera(spesaId: $spesaId, descrizione: $descrizione, importo: $importo, categoria: $categoria, data: $data) {
        ...SpesaMensileLiberaFragment
      }
    }
  }
  ${spesaMensileLiberaFragment}
`;

// ============ MUTATION: Elimina Spesa Libera ============

interface EliminaSpesaLiberaData {
  chiusureMensili: {
    eliminaSpesaLibera: boolean;
  };
}

interface EliminaSpesaLiberaVariables {
  spesaId: number;
}

export const mutationEliminaSpesaLibera: TypedDocumentNode<EliminaSpesaLiberaData, EliminaSpesaLiberaVariables> = gql`
  mutation EliminaSpesaLibera($spesaId: Int!) {
    chiusureMensili {
      eliminaSpesaLibera(spesaId: $spesaId)
    }
  }
`;

// ============ MUTATION: Includi Pagamento Fornitore ============

interface IncludiPagamentoFornitoreData {
  chiusureMensili: {
    includiPagamentoFornitore: boolean;
  };
}

interface IncludiPagamentoFornitoreVariables {
  chiusuraId: number;
  pagamentoId: number;
}

export const mutationIncludiPagamentoFornitore: TypedDocumentNode<IncludiPagamentoFornitoreData, IncludiPagamentoFornitoreVariables> = gql`
  mutation IncludiPagamentoFornitore($chiusuraId: Int!, $pagamentoId: Int!) {
    chiusureMensili {
      includiPagamentoFornitore(chiusuraId: $chiusuraId, pagamentoId: $pagamentoId)
    }
  }
`;

// ============ Pagamenti fornitore di origine-chiusura (documento FA/DDT) ============

// Fragment inline: dati del pagamento fornitore restituiti dalle mutation di chiusura.
const pagamentoFornitoreChiusuraFragment = gql`
  fragment PagamentoFornitoreChiusuraFragment on PagamentoFornitore {
    pagamentoId
    fatturaId
    ddtId
    registroCassaId
    dataPagamento
    importo
    metodoPagamento
    note
  }
`;

// Input per registrare un pagamento fornitore (documento FA/DDT reale) da una chiusura.
export interface PagamentoDocumentoChiusuraInput {
  fornitoreId: number;
  tipoDocumento: "FA" | "DDT";
  numeroDocumento?: string | null;
  dataPagamento: string;
  importo: number;
  aliquotaIva?: number | null;
  metodoPagamento?: string | null;
  fatturaId?: number | null;
  ddtId?: number | null;
}

export interface PagamentoFornitoreChiusura {
  pagamentoId: number;
  fatturaId: number | null;
  ddtId: number | null;
  registroCassaId: number | null;
  dataPagamento: string;
  importo: number;
  metodoPagamento: string | null;
  note: string | null;
}

// ---- Aggiungi pagamento fornitore in chiusura ----

interface AggiungiPagamentoFornitoreInChiusuraData {
  chiusureMensili: {
    aggiungiPagamentoFornitoreInChiusura: PagamentoFornitoreChiusura | null;
  };
}

interface AggiungiPagamentoFornitoreInChiusuraVariables {
  chiusuraId: number;
  input: PagamentoDocumentoChiusuraInput;
}

export const mutationAggiungiPagamentoFornitoreInChiusura: TypedDocumentNode<
  AggiungiPagamentoFornitoreInChiusuraData,
  AggiungiPagamentoFornitoreInChiusuraVariables
> = gql`
  mutation AggiungiPagamentoFornitoreInChiusura($chiusuraId: Int!, $input: PagamentoDocumentoChiusuraInput!) {
    chiusureMensili {
      aggiungiPagamentoFornitoreInChiusura(chiusuraId: $chiusuraId, input: $input) {
        ...PagamentoFornitoreChiusuraFragment
      }
    }
  }
  ${pagamentoFornitoreChiusuraFragment}
`;

// ---- Modifica pagamento fornitore in chiusura ----

interface ModificaPagamentoFornitoreInChiusuraData {
  chiusureMensili: {
    modificaPagamentoFornitoreInChiusura: PagamentoFornitoreChiusura | null;
  };
}

interface ModificaPagamentoFornitoreInChiusuraVariables {
  pagamentoId: number;
  importo?: number | null;
  dataPagamento?: string | null;
  metodoPagamento?: string | null;
  aliquotaIva?: number | null;
}

export const mutationModificaPagamentoFornitoreInChiusura: TypedDocumentNode<
  ModificaPagamentoFornitoreInChiusuraData,
  ModificaPagamentoFornitoreInChiusuraVariables
> = gql`
  mutation ModificaPagamentoFornitoreInChiusura(
    $pagamentoId: Int!
    $importo: Decimal
    $dataPagamento: DateTime
    $metodoPagamento: String
    $aliquotaIva: Decimal
  ) {
    chiusureMensili {
      modificaPagamentoFornitoreInChiusura(
        pagamentoId: $pagamentoId
        importo: $importo
        dataPagamento: $dataPagamento
        metodoPagamento: $metodoPagamento
        aliquotaIva: $aliquotaIva
      ) {
        ...PagamentoFornitoreChiusuraFragment
      }
    }
  }
  ${pagamentoFornitoreChiusuraFragment}
`;

// ---- Elimina pagamento fornitore in chiusura ----

interface EliminaPagamentoFornitoreInChiusuraData {
  chiusureMensili: {
    eliminaPagamentoFornitoreInChiusura: boolean;
  };
}

interface EliminaPagamentoFornitoreInChiusuraVariables {
  pagamentoId: number;
}

export const mutationEliminaPagamentoFornitoreInChiusura: TypedDocumentNode<
  EliminaPagamentoFornitoreInChiusuraData,
  EliminaPagamentoFornitoreInChiusuraVariables
> = gql`
  mutation EliminaPagamentoFornitoreInChiusura($pagamentoId: Int!) {
    chiusureMensili {
      eliminaPagamentoFornitoreInChiusura(pagamentoId: $pagamentoId)
    }
  }
`;

// ============ MUTATION: Aggiorna Giorni Esclusi ============

interface AggiornaGiorniEsclusiData {
  chiusureMensili: {
    aggiornaGiorniEsclusi: ChiusuraMensile;
  };
}

interface GiornoEsclusoInput {
  data: string;
  codiceMotivo: string;
  note?: string | null;
}

interface AggiornaGiorniEsclusiVariables {
  chiusuraId: number;
  giorniEsclusi: GiornoEsclusoInput[];
}

export const mutationAggiornaGiorniEsclusi: TypedDocumentNode<AggiornaGiorniEsclusiData, AggiornaGiorniEsclusiVariables> = gql`
  mutation AggiornaGiorniEsclusi($chiusuraId: Int!, $giorniEsclusi: [GiornoEsclusoInput!]!) {
    chiusureMensili {
      aggiornaGiorniEsclusi(chiusuraId: $chiusuraId, giorniEsclusi: $giorniEsclusi) {
        ...ChiusuraMensileFragment
      }
    }
  }
  ${chiusuraMensileFragment}
`;

// ============ MUTATION: Chiudi Chiusura Mensile ============

interface ChiudiChiusuraMensileData {
  chiusureMensili: {
    chiudiChiusuraMensile: ChiusuraMensile;
  };
}

interface ChiudiChiusuraMensileVariables {
  chiusuraId: number;
}

export const mutationChiudiChiusuraMensile: TypedDocumentNode<ChiudiChiusuraMensileData, ChiudiChiusuraMensileVariables> = gql`
  mutation ChiudiChiusuraMensile($chiusuraId: Int!) {
    chiusureMensili {
      chiudiChiusuraMensile(chiusuraId: $chiusuraId) {
        ...ChiusuraMensileFragment
      }
    }
  }
  ${chiusuraMensileFragment}
`;

// ============ MUTATION: Elimina Chiusura Mensile ============

interface EliminaChiusuraMensileData {
  chiusureMensili: {
    eliminaChiusuraMensile: boolean;
  };
}

interface EliminaChiusuraMensileVariables {
  chiusuraId: number;
}

export const mutationEliminaChiusuraMensile: TypedDocumentNode<EliminaChiusuraMensileData, EliminaChiusuraMensileVariables> = gql`
  mutation EliminaChiusuraMensile($chiusuraId: Int!) {
    chiusureMensili {
      eliminaChiusuraMensile(chiusuraId: $chiusuraId)
    }
  }
`;
