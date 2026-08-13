import { gql, TypedDocumentNode } from "@apollo/client";
import { impostazioniVetrinaFragment, mediaAssetFragment, prodottoVetrinaFragment, recensioneVetrinaFragment } from "./fragments";

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

interface GetRecensioniVetrinaData {
  vetrina: {
    /** Pubblicate **e non**, nell'ordine in cui compaiono sul sito. */
    recensioni: RecensioneVetrina[];
  };
}

/**
 * Le recensioni riportate.
 *
 * ⚠️ Nessuna paginazione, e deliberatamente: sono citazioni scelte a mano per una home — tre o
 * quattro, non un archivio. Una connection qui porterebbe cursori e pagine per una lista che
 * sta in una schermata, e nasconderebbe il fatto che l'ordine è **manuale**.
 *
 * L'ordine è lo **stesso** che usa il sito (`OrdineRecensioni` sul server): l'anteprima con cui
 * si riordinano non servirebbe a niente se l'ordine di pagina fosse un altro.
 */
export const getRecensioniVetrina: TypedDocumentNode<GetRecensioniVetrinaData, Record<string, never>> = gql`
  ${recensioneVetrinaFragment}
  query GetRecensioniVetrina {
    vetrina {
      recensioni {
        ...RecensioneVetrinaFragment
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
