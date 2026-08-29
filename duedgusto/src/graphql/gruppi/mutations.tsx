import { gql, TypedDocumentNode } from "@apollo/client";

import { gruppoProdottiFragment } from "./fragments";

interface MutateGruppoData {
  vendite: {
    mutateGruppoProdotti: GruppoProdotti | null;
  };
}

interface MutateGruppoVariables {
  gruppo: GruppoProdottiInput;
}

/**
 * Crea o aggiorna un gruppo, **membri compresi**.
 *
 * 🔴 L'elenco dei membri è una **sostituzione totale**: si invia ciò che il gruppo deve
 *    contenere, non un delta. L'alternativa — aggiungi/togli uno per volta — avrebbe reso il
 *    riordino una sequenza di chiamate che può interrompersi a metà, lasciando il gruppo in un
 *    ordine che nessuno ha scelto.
 */
export const mutationMutateGruppoProdotti: TypedDocumentNode<MutateGruppoData, MutateGruppoVariables> = gql`
  ${gruppoProdottiFragment}
  mutation MutateGruppoProdotti($gruppo: GruppoProdottiInput!) {
    vendite {
      mutateGruppoProdotti(gruppo: $gruppo) {
        ...GruppoProdottiFragment
      }
    }
  }
`;

interface EliminaGruppoData {
  vendite: {
    eliminaGruppoProdotti: boolean;
  };
}

/**
 * Scioglie un gruppo.
 *
 * ⚠️ I prodotti **non** vengono toccati: la cascata porta via le sole appartenenze, e i membri
 *    tornano a comparire sciolti nella griglia. È la differenza fra sciogliere un raggruppamento
 *    e cancellare mezzo listino.
 */
export const mutationEliminaGruppoProdotti: TypedDocumentNode<EliminaGruppoData, { gruppoProdottiId: number }> = gql`
  mutation EliminaGruppoProdotti($gruppoProdottiId: Int!) {
    vendite {
      eliminaGruppoProdotti(gruppoProdottiId: $gruppoProdottiId)
    }
  }
`;
