import { gql, TypedDocumentNode } from "@apollo/client";
import { chiusuraMensileFragment } from "./fragments";

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
