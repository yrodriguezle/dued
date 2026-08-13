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
   * I piatti che stanno sulla **lavagna** all'ingresso **oggi**.
   *
   * 🔴 Sono gli stessi prodotti che compaiono anche in `categorie`: la lavagna è una
   *    **vista**, non un secondo listino.
   *
   * ⚠️ **Vuota è lo stato normale, non un guasto**: significa che stamattina non ci ha messo
   *    niente nessuno, e la sezione non si rende affatto. È il modo giusto di sbagliare per
   *    un dato che scade da solo — a database è una *data*, non un interruttore.
   */
  lavagna: ProdottoPubblico[];

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

/**
 * Chi ricopre quale ruolo su quale pagina — **già risolto dal server**.
 *
 * 🔴 Fino a questo change ogni pagina indicizzava `immagini` con i propri offset —
 *    `galleria[0]`, `slice(0,3)`, `galleria[1] ?? galleria[0]`, `slice(2,5)`, `at(-1)` — cioè
 *    la stessa regola scritta **quattro volte in quattro file**, senza che «quante immagini
 *    ospita questa pagina» avesse una risposta da nessuna parte. Ora si legge un **nome**, e la
 *    regola vive in un posto solo: `backend/Services/Vetrina/RuoliImmaginiVetrina.cs`.
 *
 * ⚠️ Le immagini qui dentro sono le **stesse** che compaiono in `immagini`, ripetute. Non è una
 *    selezione alternativa: è la stessa galleria, vista per ruolo.
 */
export interface RuoliImmagini {
  /** L'immagine grande in cima a `/`. Ripiego a slot vuoto: la prima della galleria. */
  eroeHome: ImmaginePubblica | null;

  /** Le foto della griglia di `/`. **Mai `null`**, ma può averne meno di tre, o zero. */
  grigliaHome: ImmaginePubblica[];

  /** Le foto in coda al listino di `/menu`. Stesse regole di `grigliaHome`. */
  fotoMenu: ImmaginePubblica[];

  /** Il ritratto verticale di `/locale`. Ripiego: la seconda della galleria, poi la prima. */
  ritrattoLocale: ImmaginePubblica | null;

  /** Le quadrate di `/locale`. Stesse regole di `grigliaHome`. */
  quadrateLocale: ImmaginePubblica[];

  /**
   * L'immagine grande in cima a `/aperitivo`.
   *
   * 🔴 **È l'unico ruolo singolo che resta `null` anche a galleria piena**: non ha ripiego
   *    posizionale. Finché l'amministratore non sceglie, quella pagina esce **senza** immagine
   *    di testata — che è la regola già in vigore su tutto il resto del sito, *una sezione senza
   *    il suo dato non si rende*. Prima di questo change era `galleria.at(-1)`, cioè caricare
   *    una foto qualsiasi, anche per un'altra pagina, spostava di nascosto questa immagine.
   */
  eroeAperitivo: ImmaginePubblica | null;
}

/**
 * La galleria: i media della cartella dedicata e pubblicati, nell'ordine editoriale, **più** i
 * ruoli già risolti.
 *
 * Un elenco **vuoto è uno stato legittimo** — nessuno ha ancora etichettato immagini — e
 * produce `200`, non un errore. ⚠️ In quel caso `ruoli` c'è comunque, con i ruoli singoli a
 * `null` e le griglie vuote: non è un campo da controllare prima di leggerlo.
 */
export interface GalleriaPubblica {
  immagini: ImmaginePubblica[];
  ruoli: RuoliImmagini;
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

  /**
   * I testi che il sito scrive **in prima persona** sul locale.
   *
   * 🔴 Ogni campo può essere `null`, e chi riceve `null` **non rende la sezione** — non la
   *    riempie con un ripiego scritto qui. È la sola forma che tiene l'informazione onesta:
   *    una frase sul locale dentro un componente Astro è una verità che invecchia lontano da
   *    chi la conosce, e il giorno in cui smette di essere vera chi lo sa non ha modo di
   *    dirlo. Meglio una sezione in meno che una sezione che mente.
   */
  testi: {
    /** Il paragrafo sotto il titolo della home. */
    claim: string | null;
    /** Esiste solo se c'è il testo: un titolo da solo non è una storia. */
    storia: { titolo: string | null; testo: string } | null;
    aperitivo: {
      titolo: string | null;
      testo: string;
      /** Già normalizzati dal backend: niente righe vuote, ordine conservato, al massimo sei. */
      punti: string[];
      /**
       * I nomi delle **categorie di vetrina** che la pagina dell'aperitivo mostra.
       *
       * 🔴 Sono **dichiarati** dall'amministratore, non dedotti dal sito. Cercare la parola
       *    «cocktail» nel nome di una categoria smette di funzionare il giorno in cui si
       *    chiama «Drink»; prendere «le ultime due» smette il giorno in cui se ne aggiunge
       *    una. Nessuna delle due deduzioni lascerebbe traccia — la pagina mostrerebbe le
       *    cose sbagliate, e nessuno lo collegherebbe a una rinomina.
       *
       * ⚠️ Un nome che non corrisponde ad alcuna categoria **non è un errore**: semplicemente
       *    non porta prodotti.
       */
      categorie: string[];
    } | null;
  };

  /**
   * Il giudizio medio, quando c'è.
   *
   * 🔴 L'oggetto **intero** è `null` se manca uno dei due numeri, per la stessa ragione per
   *    cui lo è `geo` quando manca una coordinata: presi da soli non sono un dato incompleto,
   *    sono un dato **fuorviante**. «4,7» senza conteggio nasconde che le recensioni
   *    potrebbero essere tre.
   */
  reputazione: { punteggio: number; numero: number; urlProfilo: string | null } | null;

  /**
   * Le recensioni **riportate**: citazioni scelte dall'amministratore da ciò che i clienti
   * hanno scritto altrove. Il sito non raccoglie giudizi e non esiste alcuna rotta che
   * scriva. Lista vuota — mai `null` — quando non ce ne sono di pubblicate.
   */
  recensioni: {
    id: number;
    autore: string;
    testo: string;
    fonte: string | null;
    punteggio: number;
  }[];
}
