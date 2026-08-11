import { gql } from "@apollo/client";
import { mediaAssetFragment, prodottoVetrinaFragment } from "./fragments";

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
