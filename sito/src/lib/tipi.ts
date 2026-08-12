// Lo specchio dei DTO pubblici del backend.
//
// Rispecchia `backend/Controllers/Public/Dto/`. La regola, che vale in entrambe le
// direzioni:
//
//   • un campo QUI che il DTO non ha sarà sempre `undefined` — TypeScript non lo sa e
//     non lo dirà, perché nessuno valida la risposta contro questo file;
//   • un campo del DTO che manca QUI è un dato che il sito ignora, e va bene finché è
//     una scelta invece di una dimenticanza.
//
// Non c'è validazione a runtime e non deve essercene: `api.ts` distingue il caso
// `formato` guardando la FORMA minima della risposta, non convalidando ogni campo. Uno
// schema completo qui sarebbe un secondo posto in cui il contratto è scritto, e i due
// divergerebbero.

/**
 * La forma di un'immagine — **una sola** per tutta la superficie pubblica, condivisa da
 * `/api/public/menu` e `/api/public/galleria`.
 *
 * 🔴 Porta la **chiave**, non l'URL: nessuno schema, nessun host, nessun prefisso
 *    `/media`. È il consumatore a comporre l'URL, e questo consumatore ha **due**
 *    prefissi distinti — vedi `mediaUrl.ts`, che è l'unico posto in cui succede.
 */
export interface ImmaginePubblica {
  chiave: string;

  /**
   * 🔴 **Mai dedotte.** La pipeline del backend non fa upscaling: un'immagine caricata a
   *    400px esiste solo a 400px, e chiedere `/800.webp` è un 404. Comporre `srcset` con
   *    una scala fissa produce sorgenti rotte per ogni immagine piccola — e il browser
   *    sceglie proprio quelle sugli schermi densi, cioè quasi tutti i telefoni.
   */
  larghezzeDisponibili: number[];

  /** Dimensioni dell'originale: servono a dichiarare il riquadro e azzerare il salto di layout. */
  larghezza: number;
  altezza: number;

  testoAlternativo: string | null;
  didascalia: string | null;

  /** Già nella forma di destinazione (`object-position`), es. `"50% 40%"`. Non due numeri da ricomporre. */
  focale: string | null;

  /** `data:image/webp;base64,…`, ≤ 2 kB. Sta inline nel markup: nessuna richiesta in più. */
  placeholder: string | null;
}

/**
 * Un prodotto come lo vede il cliente. Possiede **soltanto** questi campi: non esiste una
 * property da cui possa uscire il codice di listino, l'aliquota IVA o lo stato in cassa.
 */
export interface ProdottoPubblico {
  /** Identificativo interno. Non è un segreto e non sblocca nulla: è una chiave stabile di rendering. */
  id: number;
  nome: string;

  /**
   * ⚠️ È la descrizione **di vetrina** e non ha alcun fallback su quella contabile: un
   *    prodotto senza scheda di vetrina espone `null`. Ricadere sull'altra farebbe
   *    comparire sul sito una nota interna scritta per la cassa.
   */
  descrizione: string | null;

  /**
   * 🔴 Il prezzo **effettivo, già risolto** dal backend — non quello di listino.
   *    **`0` è un omaggio, non un'assenza**: chi scrive `prezzo || 'n.d.'` o
   *    `prezzo > 0 ? … : …` trasforma un omaggio in un prezzo mancante. Se un giorno il
   *    prezzo potesse mancare davvero, il DTO lo direbbe con `null`.
   */
  prezzo: number;

  allergeni: string | null;
  novita: boolean;
  consigliato: boolean;
  immagine: ImmaginePubblica | null;
}

/** Un raggruppamento del menu. Il campo è `nome`: `categoria` è il nome della categoria *contabile*. */
export interface CategoriaMenu {
  nome: string;
  prodotti: ProdottoPubblico[];
}

/**
 * Il menu, più i tre numeri che rendono il troncamento **dichiarato** invece che
 * silenzioso (§D13).
 */
export interface MenuPubblico {
  categorie: CategoriaMenu[];

  /**
   * Il conteggio **reale**, con lo stesso predicato di pubblicazione — non la lunghezza
   * della lista restituita. Se coincidesse con la lista, non direbbe nulla.
   */
  totaleProdottiPubblicati: number;

  /** Arriva dal server perché il consumatore non debba indovinarlo. */
  limiteApplicato: number;

  /** Esiste perché nessuno debba dedurlo confrontando due numeri. */
  troncato: boolean;
}

/** L'identità del locale come la legge un visitatore. */
export interface SitoPubblico {
  insegna: string;

  /** **Scomposto**, perché lo pretende `schema.org/PostalAddress`. */
  indirizzo: {
    via: string;
    cap: string;
    citta: string;
    provincia: string;
    paese: string;
  };

  /**
   * 🔴 L'oggetto **intero** è `null` quando le coordinate non sono impostate: mai una
   *    coppia di zeri, che sarebbe una mappa capace di indicare con sicurezza il posto
   *    sbagliato — un punto nel Golfo di Guinea. O entrambe, o niente.
   */
  geo: { latitudine: number; longitudine: number } | null;

  contatti: { telefono: string | null; email: string | null };

  /** URL **completi** dei profili, non gli identificativi: il `sameAs` è una copia diretta. */
  social: { instagram: string | null; facebook: string | null };

  orari: {
    /** `"HH:mm"`. */
    apertura: string;
    /** `"HH:mm"`. */
    chiusura: string;

    /**
     * ⚠️ **NULLABLE, e la nullabilità va gestita — non aggirata con `?? [...]`.** Il
     *    backend espone `null` quando il JSON persistito non è leggibile come sette
     *    booleani, perché *omettere gli orari settimanali è meglio che dichiararne di
     *    sbagliati*. In quel caso il sito mostra apertura e chiusura **senza** i giorni,
     *    lo script "aperto ora" si limita al confronto orario, e i dati strutturati
     *    **omettono** la sezione degli orari.
     *
     *    Indice 0 = lunedì … 6 = domenica.
     */
    giorniOperativi: boolean[] | null;

    /** Es. `"Europe/Rome"`. */
    timezone: string;
  };

  seo: {
    titoloDefault: string | null;
    descrizioneDefault: string | null;
    immagineOg: ImmaginePubblica | null;
  };

  /** `"HH:mm"` — il parametro del tema serale, deciso dall'amministratore (§D5). */
  oraInizioTemaSera: string;
}
