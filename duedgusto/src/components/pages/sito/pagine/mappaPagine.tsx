import { PERCORSI_PANNELLO, PaginaSito } from "./ruoliPagine";

/**
 * La mappa pagina → campo, **letta** e mai riscritta.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 **PERCHÉ QUESTO FILE NON CONTIENE ALCUN ELENCO DI CAMPI.** Fino alla fase precedente ogni
 *    scheda scriveva a mano i propri «testi ereditati»: cinque elenchi, ciascuno accanto al
 *    componente che lo mostrava. Erano una **seconda scrittura** di ciò che i sorgenti del sito
 *    già dicono, e due scritture divergono — qualcuno aggiunge una lettura a `locale.astro`, la
 *    scheda «Il locale» non la impara mai, e la scheda continua a elencare con sicurezza
 *    l'elenco di ieri. Il guasto è **muto**: un elenco incompleto somiglia in tutto a una pagina
 *    che quel testo non lo usa.
 *
 *    Adesso l'elenco arriva da `vetrina { mappaPagine }`, cioè da `MappaPagineVetrina.cs`, che è
 *    la stessa dichiarazione che `sito/test/mappa-pagine.test.mjs` confronta con i `.astro`.
 *    Qui restano soltanto le due traduzioni che il backend non può fare: da nome di scheda a
 *    indirizzo del pannello, e da nome di colonna a chiave del tipo TypeScript.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */

/** La pagina del pannello, nel nome che il backend usa per la mappa. */
export const PAGINA_MAPPA: Record<PaginaSito, PaginaVetrinaMappa> = {
  home: "HOME",
  menu: "MENU",
  aperitivo: "APERITIVO",
  piatto: "PIATTO",
  locale: "LOCALE",
  contatti: "CONTATTI",
};

/**
 * Dove si va a modificare il valore.
 *
 * ⚠️ Due destinazioni su sette **non** sono schede del sito, ed è il motivo per cui la mappa le
 *    nomina: chi cerca gli orari o le citazioni dei clienti dentro una scheda di pagina non li
 *    trova, e senza un rimando esplicito conclude che non si possano cambiare.
 */
export const DESTINAZIONI: Record<SchedaVetrinaMappa, { etichetta: string; percorso: string }> = {
  IMPOSTAZIONI: { etichetta: "Impostazioni sito", percorso: "/gestionale/sito/impostazioni" },
  HOME: { etichetta: "Sito → Home", percorso: PERCORSI_PANNELLO.home },
  LOCALE: { etichetta: "Sito → Il locale", percorso: PERCORSI_PANNELLO.locale },
  APERITIVO: { etichetta: "Sito → Aperitivo", percorso: PERCORSI_PANNELLO.aperitivo },
  PIATTO: { etichetta: "Sito → Piatto della settimana", percorso: PERCORSI_PANNELLO.piatto },
  IMPOSTAZIONI_CASSA: { etichetta: "impostazioni della cassa", percorso: "/gestionale/settings" },
  RECENSIONI_SITO: { etichetta: "Recensioni sito", percorso: "/gestionale/sito/recensioni" },
};

/** Quale scheda del pannello possiede i campi di una pagina, quando ne possiede. */
const SCHEDA_DELLA_PAGINA: Partial<Record<PaginaSito, SchedaVetrinaMappa>> = {
  home: "HOME",
  locale: "LOCALE",
  aperitivo: "APERITIVO",
  piatto: "PIATTO",
};

/**
 * La chiave TypeScript del campo, dal nome della colonna: `InsegnaPubblica` → `insegnaPubblica`.
 *
 * ⚠️ La conversione è **meccanica** e non una tabella: una tabella sarebbe una terza scrittura
 *    degli stessi trenta nomi. Un campo che non appartiene alla riga delle impostazioni — gli
 *    orari, le recensioni — semplicemente non si trova, e la voce si mostra **senza valore**
 *    invece di inventarne uno: è la forma giusta, perché quei valori vivono altrove e la scheda
 *    dice dove.
 */
export function chiaveDelCampo(campo: string): keyof ImpostazioniVetrina {
  return (campo.charAt(0).toLowerCase() + campo.slice(1)) as keyof ImpostazioniVetrina;
}

/**
 * I due valori che il sito mostra e che **non** vivono nella riga della vetrina. La scheda li
 * dichiara con parole diverse da «non compilato», perché non sono vuoti: sono altrove.
 */
export function vivrebbeNelleImpostazioni(voce: VocePaginaVetrina): boolean {
  return voce.scheda !== "IMPOSTAZIONI_CASSA" && voce.scheda !== "RECENSIONI_SITO";
}

/**
 * Il valore di una voce, quando la riga delle impostazioni lo porta.
 *
 * ⚠️ `null` significa due cose diverse, e la scheda le distingue **con le parole** e non con il
 *    valore: «non compilato» per un campo della vetrina lasciato vuoto, «vive altrove» per un
 *    valore che quella riga non contiene affatto (orari, citazioni).
 *
 * ⚠️ Un campo che finisce per `Id` è un **riferimento**, non un testo: mostrarne il numero
 *    (`12`) sarebbe un dettaglio interno spacciato per contenuto. Si dice se una scelta è stata
 *    fatta, che è l'unica cosa che l'amministratore può volerne sapere da qui.
 */
export function valoreDellaVoce(voce: VocePaginaVetrina, impostazioni: ImpostazioniVetrina | null): string | null {
  if (!impostazioni) {
    return null;
  }
  const grezzo = impostazioni[chiaveDelCampo(voce.campo)] as unknown;
  if (grezzo === null || grezzo === undefined || typeof grezzo === "object") {
    return null;
  }
  if (voce.campo.endsWith("Id")) {
    return "Scelta.";
  }
  return String(grezzo);
}

export type TestiDellaPagina = {
  /** I campi che **questa** scheda modifica. Vuoto sulle due schede senza campi propri. */
  propri: VocePaginaVetrina[];
  /** Letti da questa pagina, modificabili altrove. */
  ereditati: VocePaginaVetrina[];
  /** Mostrati dalla cornice — intestazione, piè di pagina, dati strutturati — su ogni pagina. */
  cornice: VocePaginaVetrina[];
};

/**
 * I testi di una pagina, divisi nei tre gruppi che la scheda mostra.
 *
 * 🔴 La divisione è **derivata**, non dichiarata: «di proprietà» significa *la scheda di questa
 *    pagina è anche la sede in cui il campo si modifica*. È la stessa regola che la partizione
 *    della scrittura impone sul server, quindi le due non possono divergere — e un campo che
 *    cambiasse proprietario si sposterebbe da solo, in tutte le schede insieme.
 */
export function testiDellaPagina(mappa: VocePaginaVetrina[], pagina: PaginaSito): TestiDellaPagina {
  const dellaPagina = mappa.filter((voce) => voce.pagina === PAGINA_MAPPA[pagina]);
  const proprietaria = SCHEDA_DELLA_PAGINA[pagina];

  return {
    propri: proprietaria ? dellaPagina.filter((voce) => voce.scheda === proprietaria) : [],
    ereditati: dellaPagina.filter((voce) => voce.scheda !== proprietaria),
    cornice: mappa.filter((voce) => voce.pagina === "CORNICE"),
  };
}
