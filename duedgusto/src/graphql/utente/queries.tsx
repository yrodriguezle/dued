import { gql, TypedDocumentNode } from "@apollo/client";
import { utenteFragment } from "./fragment";

interface GetUtenteData {
    authentication: {
      utenteCorrente: Utente;
    };
}
export const getUtenteCorrente: TypedDocumentNode<GetUtenteData> = gql(`
  ${utenteFragment}
  query GetUtenteCorrente {
    authentication {
      utenteCorrente {
        ...UtenteFragment
      }
    }
  }`);

interface GetUtentePerIdData {
    authentication: {
      utente: Utente;
    };
}

interface GetUtentePerIdVariables {
    id: number;
}

export const getUtentePerId: TypedDocumentNode<GetUtentePerIdData, GetUtentePerIdVariables> = gql(`
  ${utenteFragment}
  query GetUtentePerId($id: Int!) {
    authentication {
      utente(id: $id) {
        ...UtenteFragment
      }
    }
  }`);
