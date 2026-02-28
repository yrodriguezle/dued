import { TypedDocumentNode, gql } from "@apollo/client";
import { utenteFragment } from "./fragment";

export type SigninValues = {
  username: string;
  password: string;
};

export interface UtenteInput {
  id?: number;
  nomeUtente: string;
  nome: string;
  cognome: string;
  descrizione: string;
  disabilitato: boolean;
  ruoloId: number;
  password?: string;
}

interface SubmitUtenteData {
  authentication: {
    mutateUtente: Utente;
  };
}

export interface SubmitUtenteValues {
  utente: UtenteInput;
}

export const mutationSubmitUtente: TypedDocumentNode<SubmitUtenteData, SubmitUtenteValues> = gql`
  ${utenteFragment}
  mutation SubmitUtente($utente: UtenteInput!) {
    authentication {
      mutateUtente(utente: $utente) {
        ...UtenteFragment
      }
    }
  }
`;
