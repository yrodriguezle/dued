import { gql, TypedDocumentNode } from "@apollo/client";
import { impostazioniVetrinaFragment, mediaAssetFragment, prodottoVetrinaFragment } from "./fragments";

interface GetImpostazioniVetrinaData {
  vetrina: {
    /** `null` quando la riga non esiste ancora: la pagina mostra un modulo vuoto e il primo salvataggio la crea. */
    impostazioni: ImpostazioniVetrina | null;
  };
}

/**
 * Le impostazioni del sito. Il server le riserva agli amministratori **anche in lettura**,
 * benché una parte degli stessi dati esca anonima da `/api/public/site`: non sono gli stessi
 * dati: qui compaiono `turnstileSiteKey` e i campi delle prenotazioni, che la rotta pubblica
 * non contiene.
 */
export const getImpostazioniVetrina: TypedDocumentNode<GetImpostazioniVetrinaData, Record<string, never>> = gql`
  ${impostazioniVetrinaFragment}
  query GetImpostazioniVetrina {
    vetrina {
      impostazioni {
        ...ImpostazioniVetrinaFragment
      }
    }
  }
`;

/**
 * Anagrafica prodotti con i campi vetrina. Restituisce **anche i non attivi**: è l'anagrafica,
 * non il listino operativo — un prodotto stagionale disattivato deve restare raggiungibile per
 * curarne la scheda fuori stagione.
 */
export const getProdottiVetrinaConnection = gql(`
  ${prodottoVetrinaFragment}
  query GetProdottiVetrinaConnection($pageSize: Int!, $where: String, $orderBy: String, $cursor: Int) {
    connection {
      prodotti(first: $pageSize, where: $where, orderBy: $orderBy, cursor: $cursor) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        edges {
          node {
            ...ProdottoVetrinaFragment
          }
          cursor
        }
      }
    }
  }`);

/** Libreria media. Il server la riserva agli amministratori **anche in lettura**. */
export const getMediaAssetsConnection = gql(`
  ${mediaAssetFragment}
  query GetMediaAssetsConnection($pageSize: Int!, $where: String, $orderBy: String, $cursor: Int) {
    connection {
      mediaAssets(first: $pageSize, where: $where, orderBy: $orderBy, cursor: $cursor) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        edges {
          node {
            ...MediaAssetFragment
          }
          cursor
        }
      }
    }
  }`);
