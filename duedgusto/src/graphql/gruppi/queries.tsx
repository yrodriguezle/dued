import { gql, TypedDocumentNode } from "@apollo/client";

import { gruppoProdottiFragment } from "./fragments";
import { prodottoVendibileFragment } from "../vendite/fragments";

interface GruppiProdottiData {
  vendite: {
    gruppiProdotti: GruppoProdotti[];
    prodottiNonRaggruppati: ProdottoVendibile[];
  };
}

interface GruppiProdottiVariables {
  soloAttivi?: boolean;
}

/**
 * I gruppi con i loro membri, e **insieme** i prodotti che non stanno in alcun gruppo attivo.
 *
 * 🔴 **Una query sola per le due liste**, perché insieme sono ciò che la griglia disegna: i
 *    tastoni di gruppo più le tessere sciolte. Chiederle separatamente aprirebbe una finestra in
 *    cui un prodotto compare due volte — sotto il suo tastone e fra gli sciolti — o sparisce da
 *    entrambe, a seconda di quale delle due risposte arriva prima.
 *
 * ⚠️ `soloAttivi` è vero per default: il banco vede i gruppi accesi, la pagina di gestione li
 *    chiede tutti perché deve poter riaccendere quelli spenti.
 */
export const getGruppiProdotti: TypedDocumentNode<GruppiProdottiData, GruppiProdottiVariables> = gql`
  ${gruppoProdottiFragment}
  ${prodottoVendibileFragment}
  query GetGruppiProdotti($soloAttivi: Boolean) {
    vendite {
      gruppiProdotti(soloAttivi: $soloAttivi) {
        ...GruppoProdottiFragment
      }
      prodottiNonRaggruppati {
        ...ProdottoVendibileFragment
      }
    }
  }
`;
