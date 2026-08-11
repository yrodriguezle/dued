import { gql, TypedDocumentNode } from "@apollo/client";
import { mediaAssetFragment, prodottoVetrinaFragment } from "./fragments";

// ============ PRODOTTI VETRINA ============

interface MutateProdottoVetrinaData {
  vetrina: {
    mutateProdottoVetrina: ProdottoVetrina;
  };
}

interface MutateProdottoVetrinaVariables {
  prodottoId: number;
  input: ProdottoVetrinaInput;
}

/**
 * Scrive i dieci campi vetrina di un prodotto **esistente**. Non esiste un ramo di creazione,
 * e non è una dimenticanza: i prodotti nascono in cassa. L'input non contiene alcun campo
 * contabile, quindi il server non ha il dato per riscrivere il listino nemmeno volendo.
 */
export const mutationMutateProdottoVetrina: TypedDocumentNode<MutateProdottoVetrinaData, MutateProdottoVetrinaVariables> = gql`
  ${prodottoVetrinaFragment}
  mutation MutateProdottoVetrina($prodottoId: Int!, $input: ProdottoVetrinaInput!) {
    vetrina {
      mutateProdottoVetrina(prodottoId: $prodottoId, input: $input) {
        ...ProdottoVetrinaFragment
      }
    }
  }
`;

// ============ MEDIA ============

interface MutateMediaAssetData {
  vetrina: {
    mutateMediaAsset: MediaAsset;
  };
}

interface MutateMediaAssetVariables {
  mediaAssetId: number;
  input: MediaAssetInput;
}

/** Soli metadati editoriali: i file su disco e i campi tecnici restano quelli misurati dalla pipeline. */
export const mutationMutateMediaAsset: TypedDocumentNode<MutateMediaAssetData, MutateMediaAssetVariables> = gql`
  ${mediaAssetFragment}
  mutation MutateMediaAsset($mediaAssetId: Int!, $input: MediaAssetInput!) {
    vetrina {
      mutateMediaAsset(mediaAssetId: $mediaAssetId, input: $input) {
        ...MediaAssetFragment
      }
    }
  }
`;

interface EliminaMediaAssetData {
  vetrina: {
    eliminaMediaAsset: boolean;
  };
}

interface EliminaMediaAssetVariables {
  mediaAssetId: number;
}

/**
 * Un media ancora referenziato da un prodotto non si elimina: il server rifiuta con un errore
 * che **nomina i prodotti** che lo usano. Quel messaggio va mostrato così com'è, senza
 * riscritture: è già la spiegazione di cosa fare.
 */
export const mutationEliminaMediaAsset: TypedDocumentNode<EliminaMediaAssetData, EliminaMediaAssetVariables> = gql`
  mutation EliminaMediaAsset($mediaAssetId: Int!) {
    vetrina {
      eliminaMediaAsset(mediaAssetId: $mediaAssetId)
    }
  }
`;
