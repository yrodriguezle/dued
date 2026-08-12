// 🔴 L'UNICO file che compone un URL di media.
//
// Come `api.ts` per l'altro prefisso, è pinnato da un test che legge i sorgenti: la
// stringa `/media/` deve comparire qui e in nessun altro posto. Un secondo compositore non
// romperebbe niente **finché i due prefissi coincidono**, cioè per tutto il tempo dello
// sviluppo, e si romperebbe il giorno del deploy per ogni visitatore.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// PERCHÉ QUESTO FILE NON È CONDIVISO con `duedgusto/src/components/pages/sito/mediaUrl.tsx`
//
// Stessa dottrina, e deliberatamente **non lo stesso file**. L'app di cassa ha **un**
// prefisso perché è tutta browser: server e client leggono dallo stesso posto, e la
// distinzione non esiste. Il sito ne ha **due** — il server legge le API dalla rete
// interna, il browser scarica le foto dall'host pubblico.
//
// Estrarre una utility comune imporrebbe al sito la forma che vale per l'admin, che è la
// forma sbagliata: quella in cui esiste un solo prefisso. La duplicazione qui costa dieci
// righe; l'astrazione costerebbe la trappola che questo change esiste per chiudere.
// ─────────────────────────────────────────────────────────────────────────────────────

import { PUBLIC_MEDIA_ORIGINE } from 'astro:env/client';
import type { ImmaginePubblica } from './tipi.ts';

/**
 * L'URL di una variante.
 *
 * 🔴 **Origine assoluta sempre, mai vuota**, in ogni ambiente. Un prefisso vuoto darebbe
 *    URL relative — tecnicamente corrette, visto che in produzione nginx serve `/media/`
 *    sullo stesso host — ma `og:image` **deve** essere assoluta, e `""` è anche ciò che si
 *    ottiene dimenticando la variabile: con il valore vuoto un errore di configurazione e
 *    una scelta deliberata diventano indistinguibili.
 */
export function mediaUrl(
  chiave: string,
  larghezza: number,
  formato: 'webp' | 'jpg' = 'webp'
): string {
  return `${PUBLIC_MEDIA_ORIGINE}/media/${chiave}/${larghezza}.${formato}`;
}

/**
 * Il `srcset` di un'immagine, **solo** con le varianti che esistono davvero.
 *
 * 🔴 Le larghezze **non si deducono mai**: si leggono da `larghezzeDisponibili`. La
 *    pipeline del backend non fa upscaling, quindi un'immagine caricata a 400px esiste
 *    solo a 400px — e una scala fissa (400/800/1200/1600) genererebbe tre sorgenti che
 *    rispondono 404. Il browser sceglie proprio quelle sugli schermi densi, cioè su quasi
 *    tutti i telefoni: il guasto colpirebbe la maggioranza dei visitatori e nessuno degli
 *    sviluppatori.
 *
 * Con un elenco vuoto restituisce la stringa vuota e **non solleva**: il markup degrada
 * all'immagine singola, che è un peggioramento accettabile e non una pagina rotta.
 */
export function srcSet(immagine: ImmaginePubblica, formato: 'webp' | 'jpg' = 'webp'): string {
  return immagine.larghezzeDisponibili
    .map((larghezza) => `${mediaUrl(immagine.chiave, larghezza, formato)} ${larghezza}w`)
    .join(', ');
}
