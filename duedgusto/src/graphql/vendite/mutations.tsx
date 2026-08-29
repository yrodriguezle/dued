import { gql, TypedDocumentNode } from "@apollo/client";
import { venditaFragment } from "./fragments";

/*
 * 🔴 **`mutationCreaVendita` non esiste più**, e il campo `creaVendita` non esiste più nemmeno
 *    nello schema: è una rimozione, non una deprecazione. Finché quel campo rispondeva, i due
 *    regimi convivevano — uno che muove i secchi al momento della riga, uno che li muove alla
 *    chiusura dell'ordine — cioè esattamente il difetto che gli ordini esistono per togliere.
 *    Una vendita nasce ora **solo** dalla chiusura di un ordine: vedi
 *    `graphql/ordini/mutations.tsx`, `mutationChiudiOrdine`.
 *
 * ⚠️ Le due mutation qui sotto **rifiutano** ogni vendita nata da un ordine (`ordineId != null`)
 *    e rimandano a `stornaOrdine`: correggere lì muoverebbe i secchi una seconda volta. Restano
 *    in piedi per le sole righe di sviluppo nate col vecchio regime.
 */

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
