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
//  | site: 'https://…'                  | Il dominio non esiste. Un valore inventato oggi      |
//  |                                    | produrrebbe canonical e OG verso un host inesistente |
//  | integrations: [react()]            | Nessuna isola in questo change. Una dipendenza       |
//  |                                    | installata e non usata è una che nessuno verifica    |
//  | integrations: [sitemap()]          | Ha bisogno di `site`, e la SEO è Fase 3 del progetto |
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
  // On-demand per entrambe le pagine: leggono dati vivi dal backend a ogni richiesta.
  output: 'server',

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
