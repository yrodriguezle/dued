import { gql, TypedDocumentNode } from "@apollo/client";
import { ordineConRigheFragments, rigaOrdineFragment } from "./fragments";

/*
 * ── Composizione ────────────────────────────────────────────────────────────────────────────
 *
 * 🔴 Nessuna delle quattro mutation di questa sezione tocca un secchio del registro né la
 *    ripartizione IVA, ed è la ragione per cui possono essere ritentate senza pensarci: un
 *    ordine aperto è una **pre-vendita**, non un incasso. La differenza con le transizioni più
 *    in basso è tutta qui, e va tenuta a mente prima di aggiungere un retry a una delle due
 *    famiglie.
 */

interface ApriOrdineData {
  vendite: {
    apriOrdine: Ordine;
  };
}

/** Apre un conto al bancone sul registro del giorno. Non muove nulla. */
export const mutationApriOrdine: TypedDocumentNode<ApriOrdineData, { registroCassaId: number }> = gql`
  ${ordineConRigheFragments}
  mutation ApriOrdine($registroCassaId: Int!) {
    vendite {
      apriOrdine(registroCassaId: $registroCassaId) {
        ...OrdineFragment
      }
    }
  }
`;

interface AggiungiRigaOrdineData {
  vendite: {
    aggiungiRigaOrdine: RigaOrdine;
  };
}

interface AggiungiRigaOrdineVariables {
  ordineId: number;
  prodottoId: number;
  quantita: number;
  note?: string | null;
}

/**
 * Batte una voce sull'ordine aperto, **congelandone prezzo e aliquota**: è il prezzo detto al
 * cliente, e un ritocco di listino a ordine aperto non deve cambiare il conto sotto di lui.
 */
export const mutationAggiungiRigaOrdine: TypedDocumentNode<AggiungiRigaOrdineData, AggiungiRigaOrdineVariables> = gql`
  ${rigaOrdineFragment}
  mutation AggiungiRigaOrdine($ordineId: Int!, $prodottoId: Int!, $quantita: Decimal!, $note: String) {
    vendite {
      aggiungiRigaOrdine(ordineId: $ordineId, prodottoId: $prodottoId, quantita: $quantita, note: $note) {
        ...RigaOrdineFragment
      }
    }
  }
`;

interface AggiornaRigaOrdineData {
  vendite: {
    aggiornaRigaOrdine: RigaOrdine;
  };
}

/**
 * Cambia la quantità di una voce.
 *
 * ⚠️ Il prezzo **non** si riprende dal listino: resta quello del tocco. Rileggerlo qui farebbe
 *    cambiare il conto a un cliente che ha già sentito dire l'altro prezzo.
 */
export const mutationAggiornaRigaOrdine: TypedDocumentNode<AggiornaRigaOrdineData, { rigaOrdineId: number; quantita: number }> = gql`
  ${rigaOrdineFragment}
  mutation AggiornaRigaOrdine($rigaOrdineId: Int!, $quantita: Decimal!) {
    vendite {
      aggiornaRigaOrdine(rigaOrdineId: $rigaOrdineId, quantita: $quantita) {
        ...RigaOrdineFragment
      }
    }
  }
`;

interface RimuoviRigaOrdineData {
  vendite: {
    rimuoviRigaOrdine: boolean;
  };
}

/**
 * Toglie una voce da un ordine **ancora aperto**.
 *
 * ⚠️ Non contraddice «le righe di un ordine non si cancellano mai»: quella regola parla delle
 *    *transizioni* — lo storno conserva le righe, perché sono la storia di un incasso disfatto.
 *    Qui si corregge un tocco sbagliato prima che esista un incasso da spiegare.
 */
export const mutationRimuoviRigaOrdine: TypedDocumentNode<RimuoviRigaOrdineData, { rigaOrdineId: number }> = gql`
  mutation RimuoviRigaOrdine($rigaOrdineId: Int!) {
    vendite {
      rimuoviRigaOrdine(rigaOrdineId: $rigaOrdineId)
    }
  }
`;

/*
 * ── Transizioni ─────────────────────────────────────────────────────────────────────────────
 *
 * 🔴 Qui, e solo qui, si muovono i secchi del registro. **Nessuna di queste tre va ritentata
 *    automaticamente**: il delta è per differenza e non è idempotente, quindi la stessa chiusura
 *    inviata due volte sommerebbe due volte l'importo. Il server ha una guardia che ne fa
 *    passare una sola, ma è una rete, non un permesso: in caso di dubbio si ricarica l'elenco
 *    degli ordini e si guarda, invece di riprovare.
 */

interface ChiudiOrdineData {
  vendite: {
    chiudiOrdine: EsitoChiusuraOrdine;
  };
}

/**
 * Incassa l'ordine. **Un taglio = chiusura semplice, 2..n = split**, in una sola transazione.
 *
 * <p>Non esiste una seconda mutation per lo split, ed è deliberato: n chiusure orchestrate dal
 * client sarebbero n occasioni di doppio incasso, e una sequenza interrotta a metà lascerebbe un
 * ordine spaccato che nessuno stato sa descrivere.</p>
 */
export const mutationChiudiOrdine: TypedDocumentNode<ChiudiOrdineData, { input: ChiudiOrdineInput }> = gql`
  ${ordineConRigheFragments}
  mutation ChiudiOrdine($input: ChiudiOrdineInput!) {
    vendite {
      chiudiOrdine(input: $input) {
        ordine {
          ...OrdineFragment
        }
        ordiniGenerati {
          ...OrdineFragment
        }
        restoDaRendere
      }
    }
  }
`;

interface AnnullaOrdineData {
  vendite: {
    annullaOrdine: Ordine;
  };
}

/**
 * Butta via un conto **aperto** che nessuno incasserà: nessun delta, perché non c'era nulla da
 * disfare. L'ordine non sparisce e resta consultabile.
 *
 * ⚠️ Il motivo è **obbligatorio** e gli spazi soli non valgono: è la scappatoia per sbloccare la
 *    chiusura di cassa, e una scappatoia senza traccia non controlla niente.
 *
 * ℹ️ **Per chiunque venda**, non solo per gli amministratori — al contrario dello storno. Un
 *    annullo riservato spingerebbe l'operatore a non chiudere affatto gli ordini, che è peggio
 *    del rischio che eviterebbe.
 */
export const mutationAnnullaOrdine: TypedDocumentNode<AnnullaOrdineData, { ordineId: number; motivo: string }> = gql`
  ${ordineConRigheFragments}
  mutation AnnullaOrdine($ordineId: Int!, $motivo: String!) {
    vendite {
      annullaOrdine(ordineId: $ordineId, motivo: $motivo) {
        ...OrdineFragment
      }
    }
  }
`;

interface StornaOrdineData {
  vendite: {
    stornaOrdine: Ordine;
  };
}

/**
 * Disfa un incasso **già dichiarato**: applica il delta inverso e cancella le vendite generate.
 *
 * 🔴 **Solo amministratori**, ed è l'asimmetria voluta con l'annullo: qui si tocca un numero che
 *    qualcuno ha già letto per quadrare la giornata.
 * ⚠️ Un ordine `SPLITTATO` non si storna: si stornano i figli, uno per uno.
 */
export const mutationStornaOrdine: TypedDocumentNode<StornaOrdineData, { ordineId: number; motivo: string }> = gql`
  ${ordineConRigheFragments}
  mutation StornaOrdine($ordineId: Int!, $motivo: String!) {
    vendite {
      stornaOrdine(ordineId: $ordineId, motivo: $motivo) {
        ...OrdineFragment
      }
    }
  }
`;
