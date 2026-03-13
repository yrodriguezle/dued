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
}

export const mutationAggiungiSpesaLibera: TypedDocumentNode<AggiungiSpesaLiberaData, AggiungiSpesaLiberaVariables> = gql`
  mutation AggiungiSpesaLibera($chiusuraId: Int!, $descrizione: String!, $importo: Decimal!, $categoria: String!) {
    chiusureMensili {
      aggiungiSpesaLibera(chiusuraId: $chiusuraId, descrizione: $descrizione, importo: $importo, categoria: $categoria) {
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
}

export const mutationModificaSpesaLibera: TypedDocumentNode<ModificaSpesaLiberaData, ModificaSpesaLiberaVariables> = gql`
  mutation ModificaSpesaLibera($spesaId: Int!, $descrizione: String, $importo: Decimal, $categoria: String) {
    chiusureMensili {
      modificaSpesaLibera(spesaId: $spesaId, descrizione: $descrizione, importo: $importo, categoria: $categoria) {
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
