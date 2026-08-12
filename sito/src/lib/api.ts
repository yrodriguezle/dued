// 🔴 L'UNICO file che importa `astro:env/server`, e la lettura che **non lancia mai**.
//
// L'unicità non è una convenzione: è pinnata da un test che legge i sorgenti
// (`test/moduli.test.mjs`) e che nomina il file di troppo quando ne compare un secondo.
// Il motivo è §D2 — i due prefissi coincidono in sviluppo, quindi una `fetch` server-side
// scritta altrove con l'origine sbagliata funzionerebbe qui e si romperebbe in produzione,
// senza che nulla diventi rosso.
//
// ⚠️ Il file si chiama `api.ts` e vive in `src/lib/`. **`src/fetch.ts` è un nome
//    riservato** in Astro 7 — viene auto-importato come configurazione del routing — da
//    sapere prima che a qualcuno venga in mente di "semplificare" spostandolo lì.

import { API_INTERNA_URL } from 'astro:env/server';
import type { MenuPubblico, SitoPubblico } from './tipi.ts';

/**
 * 🔴 **L'unico valore di timeout del progetto.** Non è una costante "di stile": duplicarlo
 *    significa che un giorno qualcuno ne cambierà uno e non l'altro, e il sito aspetterà
 *    tre secondi in una pagina e otto nell'altra senza che nulla sia rotto abbastanza da
 *    accorgersene. Cercando quel numero in `src/` si deve trovare la sola riga qui sotto.
 *
 * Tre secondi è il tempo oltre il quale una pagina degradata è meglio di una pagina lenta:
 * il visitatore di una vetrina non aspetta, e il contenuto locale (marca, slogan, orari di
 * ripiego) c'è comunque.
 */
export const TIMEOUT_LETTURA_MS = 3000;

/** Perché un dato non c'è. Quattro cause distinte, perché si diagnosticano in modi diversi. */
export type Motivo =
  /** Nessuna risposta entro `TIMEOUT_LETTURA_MS`. Il backend è vivo ma lento, o la rete è ferma. */
  | 'timeout'
  /** Nessun ascoltatore, DNS muto, TLS rifiutato: la connessione non si è stabilita. */
  | 'rete'
  /** Ha risposto, con un codice che non è 2xx. Il backend è vivo e sta dicendo di no. */
  | 'http'
  /** Ha risposto 2xx con un corpo che non è ciò che dice di essere. Il contratto è cambiato. */
  | 'formato';

/**
 * L'esito di una lettura. **Non c'è un ramo "eccezione"**: le due letture non rifiutano mai.
 *
 * 🔴 **La proprietà che ne discende, e che vale la pena scrivere**: poiché nessuna lettura
 *    rifiuta, `Promise.all([leggiSito(), leggiMenu()])` **non può cortocircuitare**. Le due
 *    letture della home partono insieme senza bisogno di `Promise.allSettled`, e un
 *    fallimento parziale **resta parziale** — il sito mostra ciò che ha letto e dichiara
 *    ciò che manca, invece di perdere anche il pezzo che era arrivato.
 */
export type Esito<T> =
  | { stato: 'ok'; dati: T }
  | { stato: 'assente'; motivo: Motivo; dettaglio: string };

/** Cosa registrare quando un dato manca. Una riga sola, con il motivo e l'URL. */
function registra(url: string, motivo: Motivo, dettaglio: string): void {
  console.log(`[vetrina] lettura assente  motivo=${motivo}  url=${url}  ${dettaglio}`);
}

function descrivi(errore: unknown): string {
  if (!(errore instanceof Error)) return String(errore);
  // `fetch` avvolge la causa vera: senza questo si legge «fetch failed» e nient'altro,
  // che è precisamente il messaggio che non dice mai perché.
  const causa = (errore as { cause?: unknown }).cause;
  const codice =
    causa instanceof Error ? ((causa as { code?: string }).code ?? causa.message) : undefined;
  return codice ? `${errore.message} (${codice})` : errore.message;
}

/** `true` se il valore è un oggetto con tutte le chiavi indicate. La forma, non il contenuto. */
function haLeChiavi(valore: unknown, chiavi: string[]): boolean {
  if (typeof valore !== 'object' || valore === null || Array.isArray(valore)) return false;
  return chiavi.every((chiave) => chiave in valore);
}

/**
 * Legge JSON da `url` e ne verifica la **forma minima**. Non rifiuta mai.
 *
 * ⚠️ `riconosci` guarda la forma, non convalida ogni campo: uno schema completo qui sarebbe
 *    un secondo posto in cui il contratto è scritto (il primo è `tipi.ts`), e i due
 *    divergerebbero. Serve a distinguere «il backend ha risposto un'altra cosa» da «il
 *    backend ha risposto» — che è la differenza fra `formato` e `ok`.
 */
export async function leggiJson<T>(
  url: string,
  riconosci: (valore: unknown) => boolean
): Promise<Esito<T>> {
  let risposta: Response;

  try {
    risposta = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_LETTURA_MS) });
  } catch (errore) {
    // `AbortSignal.timeout` rifiuta con una DOMException chiamata 'TimeoutError'. Tutto il
    // resto — connessione rifiutata, DNS, TLS — arriva come TypeError di `fetch`.
    const scaduto = errore instanceof Error && errore.name === 'TimeoutError';
    const motivo: Motivo = scaduto ? 'timeout' : 'rete';
    const dettaglio = scaduto
      ? `nessuna risposta entro ${TIMEOUT_LETTURA_MS} ms`
      : descrivi(errore);
    registra(url, motivo, dettaglio);
    return { stato: 'assente', motivo, dettaglio };
  }

  if (!risposta.ok) {
    const dettaglio = `HTTP ${risposta.status}`;
    registra(url, 'http', dettaglio);
    return { stato: 'assente', motivo: 'http', dettaglio };
  }

  let corpo: unknown;
  try {
    corpo = await risposta.json();
  } catch (errore) {
    const dettaglio = `corpo non JSON: ${descrivi(errore)}`;
    registra(url, 'formato', dettaglio);
    return { stato: 'assente', motivo: 'formato', dettaglio };
  }

  if (!riconosci(corpo)) {
    const dettaglio = 'il corpo non ha la forma attesa';
    registra(url, 'formato', dettaglio);
    return { stato: 'assente', motivo: 'formato', dettaglio };
  }

  return { stato: 'ok', dati: corpo as T };
}

/**
 * L'identità del locale: insegna, indirizzo, contatti, social, orari, SEO, ora del tema.
 *
 * Non rifiuta mai: in caso di guasto restituisce `{ stato: 'assente', motivo, dettaglio }`
 * e lascia una riga nei log.
 */
export function leggiSito(): Promise<Esito<SitoPubblico>> {
  return leggiJson<SitoPubblico>(`${API_INTERNA_URL}/api/public/site`, (v) =>
    haLeChiavi(v, ['insegna', 'indirizzo', 'orari', 'oraInizioTemaSera'])
  );
}

/**
 * Il menu pubblicato, raggruppato per categoria di vetrina, con i tre numeri del
 * troncamento.
 *
 * 🔴 Come sopra, non rifiuta mai — ed è la ragione per cui la home può scrivere
 *    `Promise.all([leggiSito(), leggiMenu()])` senza `allSettled`: non esiste un ramo che
 *    cortocircuiti, quindi un fallimento parziale **resta parziale**.
 */
export function leggiMenu(): Promise<Esito<MenuPubblico>> {
  return leggiJson<MenuPubblico>(`${API_INTERNA_URL}/api/public/menu`, (v) =>
    haLeChiavi(v, ['categorie', 'totaleProdottiPubblicati', 'limiteApplicato', 'troncato'])
  );
}
