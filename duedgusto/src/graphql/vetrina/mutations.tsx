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
 * Scrive i **venti campi trasversali** del sito con assegnazione totale: si inviano tutti,
 * sempre. Non è una scomodità — è la ragione per cui un campo si può **svuotare**.
 * Un'assegnazione condizionale (`if (valore) …`) renderebbe impossibile togliere un link
 * social già inserito, e nessun errore lo direbbe.
 *
 * 🔴 **L'assegnazione totale vale sul PROPRIO gruppo, non su tutti i campi della riga.** Questa
 * mutation non nomina i testi editoriali né la reputazione: appartengono alle schede delle
 * pagine, e non essendo nominabili da qui non c'è alcun percorso per cui un salvataggio delle
 * impostazioni li azzeri.
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

// ============ LE TRE SCRITTURE PER PAGINA ============
//
// 🔴 Tre mutation e non tre argomenti della stessa: una mutation, una pagina. Con un input a
//    gruppi facoltativi un client potrebbe legittimamente inviarne due in una chiamata, cioè
//    «un salvataggio che tocca due pagine» — la cosa che questa change esiste per rendere
//    impossibile. Qui è impossibile per costruzione.
//
// ⚠️ Il tipo di ritorno è lo STESSO delle impostazioni, e il fragment pure: la divisione
//    riguarda la scrittura, non la lettura. Quattro fragment vorrebbero dire quattro copie in
//    cache Apollo della stessa riga singleton, che divergerebbero al primo salvataggio.

interface MutatePaginaData<Nome extends string> {
  vetrina: Record<Nome, ImpostazioniVetrina>;
}

/** La frase sotto il titolo, i tre numeri della reputazione e lo slot dell'immagine grande. */
export const mutationMutatePaginaHome: TypedDocumentNode<MutatePaginaData<"mutatePaginaHome">, { input: PaginaHomeInput }> = gql`
  ${impostazioniVetrinaFragment}
  mutation MutatePaginaHome($input: PaginaHomeInput!) {
    vetrina {
      mutatePaginaHome(input: $input) {
        ...ImpostazioniVetrinaFragment
      }
    }
  }
`;

/**
 * Titolo e testo della storia, e lo slot del ritratto.
 *
 * 🔴 Svuotare `storiaTesto` **fa sparire `/locale` dal sito**: risponde 404 e sparisce da
 * intestazione, piè di pagina e sitemap. È un'operazione voluta, non un incidente da impedire —
 * ma è l'unico punto del prodotto in cui salvare cancella un URL.
 */
export const mutationMutatePaginaLocale: TypedDocumentNode<MutatePaginaData<"mutatePaginaLocale">, { input: PaginaLocaleInput }> = gql`
  ${impostazioniVetrinaFragment}
  mutation MutatePaginaLocale($input: PaginaLocaleInput!) {
    vetrina {
      mutatePaginaLocale(input: $input) {
        ...ImpostazioniVetrinaFragment
      }
    }
  }
`;

/**
 * I quattro testi dell'aperitivo e lo slot dell'immagine grande.
 *
 * ⚠️ Questi testi sono **letti anche dalla home** e restano di proprietà di questa scheda: la
 * regola non è «un campo, una pagina», è «un campo, un proprietario».
 */
export const mutationMutatePaginaAperitivo: TypedDocumentNode<MutatePaginaData<"mutatePaginaAperitivo">, { input: PaginaAperitivoInput }> = gql`
  ${impostazioniVetrinaFragment}
  mutation MutatePaginaAperitivo($input: PaginaAperitivoInput!) {
    vetrina {
      mutatePaginaAperitivo(input: $input) {
        ...ImpostazioniVetrinaFragment
      }
    }
  }
`;

/**
 * Nome, descrizione, giorno e fotografia del piatto della settimana.
 *
 * ⚠️ `piattoGiorno` viaggia **sempre**, anche a pagina non pubblicata: l'assegnazione del server
 * è totale e non è un campo nullable, quindi ometterlo lo porterebbe a zero — cioè a lunedì.
 */
export const mutationMutatePaginaPiatto: TypedDocumentNode<MutatePaginaData<"mutatePaginaPiatto">, { input: PaginaPiattoInput }> = gql`
  ${impostazioniVetrinaFragment}
  mutation MutatePaginaPiatto($input: PaginaPiattoInput!) {
    vetrina {
      mutatePaginaPiatto(input: $input) {
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
