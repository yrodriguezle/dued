import { gql, TypedDocumentNode } from "@apollo/client";
import { prodottoCassaFragment } from "./fragments";

interface MutateProdottoData {
  vendite: {
    mutateProdotto: ProdottoCassa;
  };
}

interface MutateProdottoVariables {
  prodotto: ProdottoCassaInput;
}

/**
 * Crea o aggiorna un prodotto del listino di cassa. Upsert per `prodottoId`: assente o `0`
 * crea, valorizzato aggiorna.
 *
 * ⚠️ Il ramo è **annidato** (`mutation { vendite { … } }`), non alla radice.
 *
 * 🔴 Non esiste una `eliminaProdotto`. Un prodotto si può solo disattivare (`attivo: false`),
 *    perché è referenziato dalle vendite con `DeleteBehavior.Restrict` e cancellarlo
 *    riscriverebbe la storia contabile. Conseguenza pratica: un `codice` sbagliato **resta**,
 *    e va corretto invece che ricreato.
 *
 * Le validazioni vivono sul server (`UpsertProdottoAsync`) e tornano come errori parlanti:
 * aliquota fuori dal set ammesso, codice vuoto o già usato, prezzo negativo. Vanno mostrate
 * così come arrivano, non riscritte qui.
 */
export const mutationMutateProdotto: TypedDocumentNode<MutateProdottoData, MutateProdottoVariables> = gql`
  ${prodottoCassaFragment}
  mutation MutateProdotto($prodotto: ProdottoInput!) {
    vendite {
      mutateProdotto(prodotto: $prodotto) {
        ...ProdottoCassaFragment
      }
    }
  }
`;
