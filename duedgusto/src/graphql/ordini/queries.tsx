import { gql, TypedDocumentNode } from "@apollo/client";
import { ordineConRigheFragments } from "./fragments";

interface OrdiniApertiData {
  vendite: {
    ordiniAperti: Ordine[];
  };
}

interface OrdiniApertiVariables {
  registroCassaId?: number | null;
}

/**
 * Gli ordini ancora `APERTO`.
 *
 * 🔴 **`registroCassaId` è opzionale, e non è una comodità.** Omesso, la query restituisce gli
 *    aperti di **tutti** i registri, ed è il comportamento che serve: un ordine aperto alle 23:50
 *    appartiene al registro di ieri, e un filtro su «oggi» lo farebbe sparire dall'elenco alle
 *    00:05. Siccome la chiusura di cassa si blocca finché ci sono ordini aperti, il registro di
 *    ieri resterebbe bloccato per sempre da un ordine invisibile.
 *    Chi passa un registro lo fa per una ragione precisa — la schermata di chiusura cassa, che
 *    deve elencare esattamente gli ordini che stanno bloccando *quel* giorno.
 */
export const getOrdiniAperti: TypedDocumentNode<OrdiniApertiData, OrdiniApertiVariables> = gql`
  ${ordineConRigheFragments}
  query GetOrdiniAperti($registroCassaId: Int) {
    vendite {
      ordiniAperti(registroCassaId: $registroCassaId) {
        ...OrdineFragment
      }
    }
  }
`;

interface OrdineData {
  vendite: {
    ordine: Ordine | null;
  };
}

/** Un ordine per id, in qualunque stato. */
export const getOrdine: TypedDocumentNode<OrdineData, { id: number }> = gql`
  ${ordineConRigheFragments}
  query GetOrdine($id: Int!) {
    vendite {
      ordine(id: $id) {
        ...OrdineFragment
      }
    }
  }
`;

interface OrdiniDelRegistroData {
  vendite: {
    ordiniDelRegistro: Ordine[];
  };
}

interface OrdiniDelRegistroVariables {
  registroCassaId: number;
  stati?: StatoOrdine[] | null;
}

/**
 * Lo storico del giorno. Omettere `stati` restituisce tutto, annullati e stornati compresi.
 *
 * ⚠️ Uno stato scritto male viene **rifiutato** dal server con l'elenco di quelli ammessi, invece
 *    di dare una lista vuota: il vuoto è una risposta legittima — «non ci sono ordini» — e
 *    nessuno la metterebbe in dubbio.
 */
export const getOrdiniDelRegistro: TypedDocumentNode<OrdiniDelRegistroData, OrdiniDelRegistroVariables> = gql`
  ${ordineConRigheFragments}
  query GetOrdiniDelRegistro($registroCassaId: Int!, $stati: [String!]) {
    vendite {
      ordiniDelRegistro(registroCassaId: $registroCassaId, stati: $stati) {
        ...OrdineFragment
      }
    }
  }
`;
