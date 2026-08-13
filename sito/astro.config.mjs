// @ts-check
import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// Configurazione del sito vetrina.
//
// ⚠️ Cosa NON entra, e va lasciato fuori deliberatamente (§D1). Le ultime tre sono
//    stabili nella 7, ed è il motivo per cui vanno nominate: sono scelte, non omissioni.
//
//  | Assente                            | Perché                                              |
//  |------------------------------------|-----------------------------------------------------|
//  | integrations: [react()]            | Nessuna isola in questo change. Una dipendenza       |
//  |                                    | installata e non usata è una che nessuno verifica    |
//  | export const prerender             | Con output: 'server' l'on-demand è già il default:   |
//  |                                    | entrambe le pagine leggono dati vivi                 |
//  | routeRules                         | La cache di questo sito è CONDIZIONALE sullo stato   |
//  |                                    | (no-store quando degradata) e routeRules è statica   |
//  |                                    | per rotta: sarebbero due posti a scrivere            |
//  |                                    | Cache-Control sulla stessa risposta (§D4)            |
//  | cache: { provider: memoryCache() } | Duplicherebbe il micro-cache nginx di Fase 6, in un  |
//  |                                    | processo che il deploy riavvia — cioè si svuota      |
//  |                                    | proprio quando servirebbe. Restano tre righe se      |
//  |                                    | un giorno il micro-cache non bastasse                |
//  | logger: logHandlers.json()         | Candidato di Fase 6, quando i log saranno quelli di  |
//  |                                    | un container e non di un terminale che si guarda     |
export default defineConfig({
  // On-demand per tutte le pagine: leggono dati vivi dal backend a ogni richiesta.
  output: 'server',

  // 🔴 L'ORIGINE PUBBLICA, e non quella con cui il processo si vede addosso.
  //    Serve a `<link rel="canonical">`, a `og:url` e alla sitemap. In produzione il sito
  //    gira dietro nginx: `Astro.url` è l'host interno del container, e un canonical
  //    costruito su quello punterebbe a un host che per nessun visitatore esiste — senza
  //    che nulla si rompa e senza che nessuno se ne accorga, se non nella Search Console
  //    settimane dopo.
  //
  // ⚠️ Il dominio è stato acquistato il 12 agosto 2026 su IONOS e il go-live è fatto: la
  //    vetrina sta sull'apice, il gestionale su `app.`. Questa riga era assente proprio
  //    perché il dominio non esisteva, ed è la ragione per cui non c'erano né canonical né
  //    sitemap.
  site: 'https://duedgusto.it',

  // 🔴 L'11 è l'adapter DELLA 7 (peer `astro ^7.0.0`); il 10.x è quello della 6.
  //    'standalone' produce dist/server/entry.mjs, che si avvia con `node` e basta:
  //    nessun server esterno da configurare nel container di Fase 6.
  adapter: node({ mode: 'standalone' }),

  // host: true → ascolta su tutte le interfacce, come backend (4000) e cassa (4001),
  // così il sito si guarda anche dal telefono sulla stessa rete.
  server: { host: true, port: 4321 },

  // Tailwind 4 è un plugin di Vite, non un'integrazione di Astro: non esiste più
  // @astrojs/tailwind, e non esiste un tailwind.config.js — il tema vive nel CSS (§D6).
  vite: { plugins: [tailwindcss()] },

  // ── 🔴 I DUE PREFISSI (§D2) ────────────────────────────────────────────────────────
  // Due variabili, due CONTESTI, e quindi due moduli virtuali diversi da cui importarle.
  // Non è una preferenza stilistica rispetto a `import.meta.env`: lì tutto vive nello
  // stesso oggetto e nello stesso namespace, e un `import.meta.env.PUBLIC_MEDIA_ORIGINE`
  // scritto per errore in un file server-side è legale e silenzioso. Qui l'import
  // sbagliato è un errore di build in una direzione, e nell'altra il file che potrebbe
  // sbagliare è uno solo e ha un test sopra.
  // 🔴 ENTRAMBE SONO VARIABILI DI BUILD, NON DI RUNTIME — anche quella di contesto
  //    `server`. `astro:env` inlina nel bundle ogni variabile con `access: 'public'`, di
  //    qualunque contesto; solo i `secret` restano letti a runtime. Misurato il 12 agosto
  //    2026 e confermato dalla documentazione: «Public server variables are in the server
  //    bundle».
  //
  // ⚠️ Il modo in cui inganna: passare API_INTERNA_URL all'AMBIENTE del server costruito non
  //    dà alcun errore e non ha alcun effetto — il sito continua a leggere l'origine con cui
  //    è stato costruito. È successo nella suite di prova, dove i test puntavano a un
  //    backend finto e leggevano quello vero, restando verdi per la ragione sbagliata.
  //
  // 🔧 CONSEGUENZA PER IL DEPLOY (Fase 6 del progetto): l'immagine del container va
  //    COSTRUITA con l'origine di produzione; la stessa immagine non si riusa fra ambienti
  //    passando una variabile. Se un giorno servisse, `API_INTERNA_URL` andrebbe portata ad
  //    `access: 'secret'` e letta con `getSecret()` — ma non è un segreto, e finché il
  //    deploy costruisce per ambiente questa forma è più semplice e più verificabile.
  env: {
    schema: {
      // Il SERVER, e solo il server: la `fetch` in frontmatter verso /api/public/…
      // In produzione sarà la rete interna di Docker, irraggiungibile da un browser.
      API_INTERNA_URL: envField.string({ context: 'server', access: 'public' }),

      // Il BROWSER: l'origine dentro src/srcset delle foto.
      //
      // ⚠️ I due nomi non condividono un solo morfema — API ≠ MEDIA, INTERNA ≠ PUBLIC,
      //    URL ≠ ORIGINE. Non è vezzo: `API_BASE_URL` e `MEDIA_BASE_URL`, la coppia che
      //    il design precedente proponeva, differiscono per UNA parola in mezzo, e una
      //    copia-incolla distratta le confonde. Qui non esiste una copia-incolla che
      //    produca l'altra.
      //
      // ⚠️ Il prefisso PUBLIC_ è tenuto DELIBERATAMENTE anche se lo schema dichiara già
      //    il contesto: è la parola che qualcuno legge nel .env mentre decide quale
      //    valore mettere, e "PUBLIC" significa letteralmente *il browser lo vedrà*.
      PUBLIC_MEDIA_ORIGINE: envField.string({ context: 'client', access: 'public' }),
    },
  },
});
