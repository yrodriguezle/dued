import { gql, TypedDocumentNode } from "@apollo/client";
import { impostazioniVetrinaFragment, mediaAssetFragment, prodottoVetrinaFragment, recensioneVetrinaFragment } from "./fragments";

// ============ IMPOSTAZIONI VETRINA ============

interface MutateImpostazioniVetrinaData {
  vetrina: {
    mutateImpostazioniVetrina: ImpostazioniVetrina;
  };
}

interface MutateImpostazioniVetrinaVariables {
  input: ImpostazioniVetrinaInput;
}

/**
 * Scrive le impostazioni del sito con **assegnazione totale**: si inviano tutti i campi
 * scrivibili, sempre. Non è una scomodità — è la ragione per cui un campo si può **svuotare**.
 * Un'assegnazione condizionale (`if (valore) …`) renderebbe impossibile togliere un link
 * social già inserito, e nessun errore lo direbbe.
 *
 * ⚠️ L'input **non possiede** l'identificativo della riga né alcun campo di orario: il resolver
 * fa upsert sulla costante di dominio, e gli orari hanno una sola sorgente in `BusinessSettings`.
 */
export const mutationMutateImpostazioniVetrina: TypedDocumentNode<MutateImpostazioniVetrinaData, MutateImpostazioniVetrinaVariables> = gql`
  ${impostazioniVetrinaFragment}
  mutation MutateImpostazioniVetrina($input: ImpostazioniVetrinaInput!) {
    vetrina {
      mutateImpostazioniVetrina(input: $input) {
        ...ImpostazioniVetrinaFragment
      }
    }
  }
`;

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

// ============ RECENSIONI RIPORTATE ============

interface MutateRecensioneVetrinaData {
  vetrina: {
    mutateRecensioneVetrina: RecensioneVetrina;
  };
}

interface MutateRecensioneVetrinaVariables {
  /** Assente o `null` per crearne una nuova. */
  recensioneVetrinaId?: number | null;
  input: RecensioneVetrinaInput;
}

/**
 * Crea o aggiorna una recensione riportata, con **assegnazione totale** come le impostazioni.
 *
 * ⚠️ Qui esiste un ramo di **creazione**, al contrario di `mutateProdottoVetrina`. Non è
 * un'incoerenza: i prodotti nascono in cassa dal listino, e una vetrina che sapesse crearli
 * diventerebbe un secondo listino. Una citazione non ha alcuna controparte in cassa — non nasce
 * da nessun'altra parte, quindi deve nascere qui.
 */
export const mutationMutateRecensioneVetrina: TypedDocumentNode<MutateRecensioneVetrinaData, MutateRecensioneVetrinaVariables> = gql`
  ${recensioneVetrinaFragment}
  mutation MutateRecensioneVetrina($recensioneVetrinaId: Int, $input: RecensioneVetrinaInput!) {
    vetrina {
      mutateRecensioneVetrina(recensioneVetrinaId: $recensioneVetrinaId, input: $input) {
        ...RecensioneVetrinaFragment
      }
    }
  }
`;

interface EliminaRecensioneVetrinaData {
  vetrina: {
    eliminaRecensioneVetrina: boolean;
  };
}

interface EliminaRecensioneVetrinaVariables {
  recensioneVetrinaId: number;
}

/**
 * Elimina davvero, al contrario dei prodotti — che si possono solo disattivare.
 *
 * La differenza ha una ragione: un prodotto è referenziato dalle vendite e dalla contabilità,
 * quindi cancellarlo riscriverebbe la storia. Una citazione non è referenziata da nulla, e
 * tenersi per sempre una recensione inserita per sbaglio — magari attribuita a una persona che
 * ha chiesto di toglierla — sarebbe il difetto, non la prudenza.
 */
export const mutationEliminaRecensioneVetrina: TypedDocumentNode<EliminaRecensioneVetrinaData, EliminaRecensioneVetrinaVariables> = gql`
  mutation EliminaRecensioneVetrina($recensioneVetrinaId: Int!) {
    vetrina {
      eliminaRecensioneVetrina(recensioneVetrinaId: $recensioneVetrinaId)
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
