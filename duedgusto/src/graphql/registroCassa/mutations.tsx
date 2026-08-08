import { gql, TypedDocumentNode } from "@apollo/client";
import { registroCassaFragment } from "./fragments";

// Submit (create or update) cash register
interface SubmitRegistroCassaData {
  gestioneCassa: {
    mutateRegistroCassa: RegistroCassa;
  };
}

export interface ConteggioMonetaInput {
  denominazioneMonetaId: number;
  quantita: number;
}

export interface SpesaCassaInput {
  descrizione: string;
  importo: number;
  // Categoria NON tracciata: se assente il backend applica il default "Altro".
  categoria?: CategoriaSpesa;
}

export interface PagamentoFornitoreRegistroInput {
  pagamentoId?: number;
  fornitoreId: number;
  numeroDdt: string;
  importo: number;
  metodoPagamento?: string;
  tipoDocumento: "FA" | "DDT";
  numeroFattura?: string;
  fatturaId?: number;
  ddtId?: number;
  dataFattura?: string;
  dataDdt?: string;
  aliquotaIva?: number;
  // Categoria (opzionale): valorizzata solo per le spese fisse pagate in modo tracciato.
  categoria?: CategoriaSpesa;
}

export interface RegistroCassaInput {
  id?: number;
  data: string;
  utenteId: number;
  conteggiApertura: ConteggioMonetaInput[];
  conteggiChiusura: ConteggioMonetaInput[];
  spese: SpesaCassaInput[];
  pagamentiFornitori: PagamentoFornitoreRegistroInput[];
  incassoContanteTracciato: number;
  incassiElettronici: number;
  incassiFattura: number;
  speseFornitori: number;
  speseGiornaliere: number;
  note?: string;
  stato: StatoRegistroCassa;
}

export interface SubmitRegistroCassaValues {
  registroCassa: RegistroCassaInput;
}

export const mutationSubmitRegistroCassa: TypedDocumentNode<SubmitRegistroCassaData, SubmitRegistroCassaValues> = gql`
  ${registroCassaFragment}
  mutation SubmitRegistroCassa($registroCassa: RegistroCassaInput!) {
    gestioneCassa {
      mutateRegistroCassa(registroCassa: $registroCassa) {
        ...RegistroCassaFragment
      }
    }
  }
`;

// Close cash register (change status to CLOSED)
interface ChiudiRegistroCassaData {
  gestioneCassa: {
    chiudiRegistroCassa: RegistroCassa;
  };
}

interface ChiudiRegistroCassaValues {
  registroCassaId: number;
}

export const mutationChiudiRegistroCassa: TypedDocumentNode<ChiudiRegistroCassaData, ChiudiRegistroCassaValues> = gql`
  ${registroCassaFragment}
  mutation ChiudiRegistroCassa($registroCassaId: Int!) {
    gestioneCassa {
      chiudiRegistroCassa(registroCassaId: $registroCassaId) {
        ...RegistroCassaFragment
      }
    }
  }
`;

// Reopen cash register (change status back to DRAFT) — solo ruoli amministratori
interface RiapriRegistroCassaData {
  gestioneCassa: {
    riapriRegistroCassa: RegistroCassa;
  };
}

interface RiapriRegistroCassaValues {
  registroCassaId: number;
}

export const mutationRiapriRegistroCassa: TypedDocumentNode<RiapriRegistroCassaData, RiapriRegistroCassaValues> = gql`
  ${registroCassaFragment}
  mutation RiapriRegistroCassa($registroCassaId: Int!) {
    gestioneCassa {
      riapriRegistroCassa(registroCassaId: $registroCassaId) {
        ...RegistroCassaFragment
      }
    }
  }
`;

// Delete cash register
interface EliminaRegistroCassaData {
  gestioneCassa: {
    eliminaRegistroCassa: boolean;
  };
}

interface EliminaRegistroCassaValues {
  registroCassaId: number;
}

export const mutationEliminaRegistroCassa: TypedDocumentNode<EliminaRegistroCassaData, EliminaRegistroCassaValues> = gql`
  mutation EliminaRegistroCassa($registroCassaId: Int!) {
    gestioneCassa {
      eliminaRegistroCassa(registroCassaId: $registroCassaId)
    }
  }
`;

// ============ MUTATION: spesa non tracciata riga per riga ============
// Usata dalla griglia spese della Chiusura Mensile: scrive UNA riga sul registro del
// giorno indicato, creandolo se assente (registro "leggero"). Mantiene il guard sul
// mese chiuso ma non quello sul giorno operativo, così una spesa fissa può cadere
// anche di domenica. Cambiare `data` sposta la riga sul registro dell'altro giorno.

export interface SpesaCassaMutateInput {
  /** Null = creazione; valorizzato = aggiornamento. */
  spesaId?: number | null;
  data: string;
  descrizione: string;
  /** Annotazione libera, distinta dalla causale. */
  note?: string | null;
  importo: number;
  categoria: CategoriaSpesa;
}

interface MutateSpesaCassaData {
  gestioneCassa: {
    mutateSpesaCassa: {
      id: number;
      registroCassaId: number;
      descrizione: string;
      note: string | null;
      importo: number;
      categoria: CategoriaSpesa;
    } | null;
  };
}

interface MutateSpesaCassaValues {
  spesa: SpesaCassaMutateInput;
}

export const mutationMutateSpesaCassa: TypedDocumentNode<MutateSpesaCassaData, MutateSpesaCassaValues> = gql`
  mutation MutateSpesaCassa($spesa: SpesaCassaMutateInput!) {
    gestioneCassa {
      mutateSpesaCassa(spesa: $spesa) {
        id
        registroCassaId
        descrizione
        note
        importo
        categoria
      }
    }
  }
`;

interface EliminaSpesaCassaData {
  gestioneCassa: {
    eliminaSpesaCassa: boolean;
  };
}

interface EliminaSpesaCassaValues {
  spesaId: number;
}

export const mutationEliminaSpesaCassa: TypedDocumentNode<EliminaSpesaCassaData, EliminaSpesaCassaValues> = gql`
  mutation EliminaSpesaCassa($spesaId: Int!) {
    gestioneCassa {
      eliminaSpesaCassa(spesaId: $spesaId)
    }
  }
`;
