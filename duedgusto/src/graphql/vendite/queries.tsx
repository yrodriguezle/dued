import { gql, TypedDocumentNode } from "@apollo/client";
import { prodottoVendibileFragment, venditaFragment } from "./fragments";

interface ProdottiVendibiliData {
  vendite: {
    prodotti: ProdottoVendibile[];
    categorieProdotto: (string | null)[];
  };
}

interface ProdottiVendibiliVariables {
  ricerca?: string | null;
  categoria?: string | null;
  limite?: number;
}

/**
 * Il listino **vendibile**: questa query filtra su `attivo`, al contrario della connection
 * `prodotti` che restituisce l'anagrafica intera. Non è una svista da uniformare — un prodotto
 * disattivato non si vende, e il pulsante non deve esistere.
 */
export const getProdottiVendibili: TypedDocumentNode<ProdottiVendibiliData, ProdottiVendibiliVariables> = gql`
  ${prodottoVendibileFragment}
  query GetProdottiVendibili($ricerca: String, $categoria: String, $limite: Int) {
    vendite {
      prodotti(ricerca: $ricerca, categoria: $categoria, limite: $limite) {
        ...ProdottoVendibileFragment
      }
      categorieProdotto
    }
  }
`;

interface VenditeDelRegistroData {
  vendite: {
    vendite: Vendita[];
  };
}

interface VenditeDelRegistroVariables {
  registroCassaId: number;
  limite?: number;
}

/** Lo scontrino del giorno: le vendite del registro, dalla più recente. */
export const getVenditeDelRegistro: TypedDocumentNode<VenditeDelRegistroData, VenditeDelRegistroVariables> = gql`
  ${venditaFragment}
  query GetVenditeDelRegistro($registroCassaId: Int!, $limite: Int) {
    vendite {
      vendite(registroCassaId: $registroCassaId, limite: $limite) {
        ...VenditaFragment
      }
    }
  }
`;
