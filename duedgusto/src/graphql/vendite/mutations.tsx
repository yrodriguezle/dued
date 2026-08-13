import { gql, TypedDocumentNode } from "@apollo/client";
import { venditaFragment } from "./fragments";

interface CreaVenditaData {
  vendite: {
    creaVendita: Vendita;
  };
}

interface CreaVenditaVariables {
  input: CreaVenditaInput;
}

/**
 * Batte una consumazione. Il server calcola lo snapshot IVA di riga, muove il secchio del
 * metodo scelto e ricalcola il breakdown del registro.
 *
 * 🔴 **Non va mai ritentata automaticamente.** L'alimentazione dei secchi è per delta e quindi
 *    non è idempotente: la stessa vendita inviata due volte somma due volte l'importo a
 *    `IncassiElettronici`, e nessun controllo a valle se ne accorge. In caso di dubbio si
 *    ricarica lo scontrino e si guarda, invece di riprovare.
 */
export const mutationCreaVendita: TypedDocumentNode<CreaVenditaData, CreaVenditaVariables> = gql`
  ${venditaFragment}
  mutation CreaVendita($input: CreaVenditaInput!) {
    vendite {
      creaVendita(input: $input) {
        ...VenditaFragment
      }
    }
  }
`;

interface AggiornaVenditaData {
  vendite: {
    aggiornaVendita: Vendita;
  };
}

interface AggiornaVenditaVariables {
  id: number;
  input: AggiornaVenditaInput;
}

/** Correggere il metodo sposta l'importo **da un secchio all'altro**, non solo dentro il suo. */
export const mutationAggiornaVendita: TypedDocumentNode<AggiornaVenditaData, AggiornaVenditaVariables> = gql`
  ${venditaFragment}
  mutation AggiornaVendita($id: Int!, $input: AggiornaVenditaInput!) {
    vendite {
      aggiornaVendita(id: $id, input: $input) {
        ...VenditaFragment
      }
    }
  }
`;

interface EliminaVenditaData {
  vendite: {
    eliminaVendita: boolean;
  };
}

export const mutationEliminaVendita: TypedDocumentNode<EliminaVenditaData, { id: number }> = gql`
  mutation EliminaVendita($id: Int!) {
    vendite {
      eliminaVendita(id: $id)
    }
  }
`;
