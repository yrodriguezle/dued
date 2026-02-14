import { gql, TypedDocumentNode } from "@apollo/client";
import { chiusuraMensileFragment, spesaMensileLiberaFragment } from "./fragments";

// ============ MUTATION: Crea Chiusura Mensile ============

interface CreaChiusuraMensileData {
  monthlyClosures: {
    creaChiusuraMensile: ChiusuraMensile;
  };
}

interface CreaChiusuraMensileVariables {
  anno: number;
  mese: number;
}

export const mutationCreaChiusuraMensile: TypedDocumentNode<CreaChiusuraMensileData, CreaChiusuraMensileVariables> = gql`
  mutation CreaChiusuraMensile($anno: Int!, $mese: Int!) {
    monthlyClosures {
      creaChiusuraMensile(anno: $anno, mese: $mese) {
        ...ChiusuraMensileFragment
      }
    }
  }
  ${chiusuraMensileFragment}
`;

// ============ MUTATION: Aggiungi Spesa Libera ============

interface AggiungiSpesaLiberaData {
  monthlyClosures: {
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
    monthlyClosures {
      aggiungiSpesaLibera(chiusuraId: $chiusuraId, descrizione: $descrizione, importo: $importo, categoria: $categoria) {
        ...SpesaMensileLiberaFragment
      }
    }
  }
  ${spesaMensileLiberaFragment}
`;

// ============ MUTATION: Modifica Spesa Libera ============

interface ModificaSpesaLiberaData {
  monthlyClosures: {
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
    monthlyClosures {
      modificaSpesaLibera(spesaId: $spesaId, descrizione: $descrizione, importo: $importo, categoria: $categoria) {
        ...SpesaMensileLiberaFragment
      }
    }
  }
  ${spesaMensileLiberaFragment}
`;

// ============ MUTATION: Elimina Spesa Libera ============

interface EliminaSpesaLiberaData {
  monthlyClosures: {
    eliminaSpesaLibera: boolean;
  };
}

interface EliminaSpesaLiberaVariables {
  spesaId: number;
}

export const mutationEliminaSpesaLibera: TypedDocumentNode<EliminaSpesaLiberaData, EliminaSpesaLiberaVariables> = gql`
  mutation EliminaSpesaLibera($spesaId: Int!) {
    monthlyClosures {
      eliminaSpesaLibera(spesaId: $spesaId)
    }
  }
`;

// ============ MUTATION: Includi Pagamento Fornitore ============

interface IncludiPagamentoFornitoreData {
  monthlyClosures: {
    includiPagamentoFornitore: boolean;
  };
}

interface IncludiPagamentoFornitoreVariables {
  chiusuraId: number;
  pagamentoId: number;
}

export const mutationIncludiPagamentoFornitore: TypedDocumentNode<IncludiPagamentoFornitoreData, IncludiPagamentoFornitoreVariables> = gql`
  mutation IncludiPagamentoFornitore($chiusuraId: Int!, $pagamentoId: Int!) {
    monthlyClosures {
      includiPagamentoFornitore(chiusuraId: $chiusuraId, pagamentoId: $pagamentoId)
    }
  }
`;

// ============ MUTATION: Chiudi Chiusura Mensile ============

interface ChiudiChiusuraMensileData {
  monthlyClosures: {
    chiudiChiusuraMensile: ChiusuraMensile;
  };
}

interface ChiudiChiusuraMensileVariables {
  chiusuraId: number;
}

export const mutationChiudiChiusuraMensile: TypedDocumentNode<ChiudiChiusuraMensileData, ChiudiChiusuraMensileVariables> = gql`
  mutation ChiudiChiusuraMensile($chiusuraId: Int!) {
    monthlyClosures {
      chiudiChiusuraMensile(chiusuraId: $chiusuraId) {
        ...ChiusuraMensileFragment
      }
    }
  }
  ${chiusuraMensileFragment}
`;

// ============ MUTATION: Elimina Chiusura Mensile ============

interface EliminaChiusuraMensileData {
  monthlyClosures: {
    eliminaChiusuraMensile: boolean;
  };
}

interface EliminaChiusuraMensileVariables {
  chiusuraId: number;
}

export const mutationEliminaChiusuraMensile: TypedDocumentNode<EliminaChiusuraMensileData, EliminaChiusuraMensileVariables> = gql`
  mutation EliminaChiusuraMensile($chiusuraId: Int!) {
    monthlyClosures {
      eliminaChiusuraMensile(chiusuraId: $chiusuraId)
    }
  }
`;
