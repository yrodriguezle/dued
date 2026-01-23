import { gql, TypedDocumentNode } from "@apollo/client";
import { registroCassaFragment } from "./fragments";

// Submit (create or update) cash register
interface SubmitRegistroCassaData {
  cashManagement: {
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

export interface RegistroCassaInput {
  id?: number;
  data: string;
  utenteId: number;
  conteggiApertura: ConteggioMonetaInput[];
  conteggiChiusura: ConteggioMonetaInput[];
  incassi: IncassoCassaInput[];
  spese: SpesaCassaInput[];
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
    cashManagement {
      mutateRegistroCassa(registroCassa: $registroCassa) {
        ...RegistroCassaFragment
      }
    }
  }
`;

// Legacy alias
export const mutationSubmitCashRegister = mutationSubmitRegistroCassa;

// Legacy input types for backward compatibility
export type CashCountInput = ConteggioMonetaInput;
export type CashIncomeInput = IncassoCassaInput;
export type CashExpenseInput = SpesaCassaInput;
export type CashRegisterInput = RegistroCassaInput;
export type SubmitCashRegisterValues = SubmitRegistroCassaValues;

// Close cash register (change status to CLOSED)
interface ChiudiRegistroCassaData {
  cashManagement: {
    chiudiRegistroCassa: RegistroCassa;
  };
}

interface ChiudiRegistroCassaValues {
  registroCassaId: number;
}

export const mutationChiudiRegistroCassa: TypedDocumentNode<ChiudiRegistroCassaData, ChiudiRegistroCassaValues> = gql`
  ${registroCassaFragment}
  mutation ChiudiRegistroCassa($registroCassaId: Int!) {
    cashManagement {
      chiudiRegistroCassa(registroCassaId: $registroCassaId) {
        ...RegistroCassaFragment
      }
    }
  }
`;

// Legacy alias
export const mutationCloseCashRegister = mutationChiudiRegistroCassa;

// Delete cash register
interface EliminaRegistroCassaData {
  cashManagement: {
    eliminaRegistroCassa: boolean;
  };
}

interface EliminaRegistroCassaValues {
  registroCassaId: number;
}

export const mutationEliminaRegistroCassa: TypedDocumentNode<EliminaRegistroCassaData, EliminaRegistroCassaValues> = gql`
  mutation EliminaRegistroCassa($registroCassaId: Int!) {
    cashManagement {
      eliminaRegistroCassa(registroCassaId: $registroCassaId)
    }
  }
`;

// Legacy alias
export const mutationDeleteCashRegister = mutationEliminaRegistroCassa;
