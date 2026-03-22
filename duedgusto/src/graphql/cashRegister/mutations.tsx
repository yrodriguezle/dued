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

export interface IncassoCassaInput {
  tipo: string;
  importo: number;
}

export interface SpesaCassaInput {
  descrizione: string;
  importo: number;
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
}

export interface RegistroCassaInput {
  id?: number;
  data: string;
  utenteId: number;
  conteggiApertura: ConteggioMonetaInput[];
  conteggiChiusura: ConteggioMonetaInput[];
  incassi: IncassoCassaInput[];
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
