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

interface GetRuoliImmaginiData {
  vetrina: {
    ruoliImmagini: RuoliImmaginiVetrina;
  };
}

/**
 * Quale immagine ricopre quale ruolo su ciascuna pagina del sito, adesso.
 *
 * 🔴 **Lo stesso piano che alimenta il sito**, calcolato dalla stessa funzione del backend: la
 * scheda di una pagina non può dichiarare che quella pagina usa una foto mentre il sito ne rende
 * un'altra. Fino a questa change la regola viveva scritta quattro volte dentro quattro file
 * `.astro`, e il pannello non aveva alcun modo di conoscerla.
 *
 * ⚠️ `origine` non esiste nella risposta pubblica: è ciò che permette alla scheda di distinguere
 * «scelta da te» da «è la prima della galleria, e cambierà», e al sito non serve.
 */
export const getRuoliImmaginiVetrina: TypedDocumentNode<GetRuoliImmaginiData, Record<string, never>> = gql`
  ${mediaAssetFragment}
  query GetRuoliImmaginiVetrina {
    vetrina {
      ruoliImmagini {
        eroeHome {
          mediaAssetId
          origine
          immagine { ...MediaAssetFragment }
        }
        ritrattoLocale {
          mediaAssetId
          origine
          immagine { ...MediaAssetFragment }
        }
        eroeAperitivo {
          mediaAssetId
          origine
          immagine { ...MediaAssetFragment }
        }
        grigliaHome { ...MediaAssetFragment }
        fotoMenu { ...MediaAssetFragment }
        quadrateLocale { ...MediaAssetFragment }
        ampiezzaGriglia
      }
    }
  }
`;

interface GetMappaPagineData {
  vetrina: {
    mappaPagine: VocePaginaVetrina[];
  };
}

/**
 * Quali testi governano quale pagina del sito, e dove si modificano.
 *
 * 🔴 **Le schede la leggono e non ne tengono una copia.** Le due sezioni «testi di questa
 * pagina» e «testi ereditati» si costruiscono da qui: gli elenchi scritti a mano dentro ogni
 * scheda — che è com'erano prima di questa query — divergono dai sorgenti del sito alla prima
 * modifica, e la divergenza è **muta**: una scheda che elenca il campo sbagliato non produce
 * alcun errore, orienta soltanto nella direzione sbagliata.
 *
 * ⚠️ La stessa dichiarazione C# è confrontata con i `.astro` da
 * `sito/test/mappa-pagine.test.mjs`. Il gestionale non dipende dalla build del sito: sono due
 * dichiarazioni testuali messe a confronto, non un'estrazione a tempo di compilazione.
 */
export const getMappaPagineVetrina: TypedDocumentNode<GetMappaPagineData, Record<string, never>> = gql`
  query GetMappaPagineVetrina {
    vetrina {
      mappaPagine {
        pagina
        campo
        percorso
        scheda
        etichetta
        nota
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
