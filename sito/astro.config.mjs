// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// Configurazione del sito vetrina. Nasce con i quattro pezzi che il gradino 1 deve
// dimostrare, e nient'altro: `env: { schema: … }` arriva in Fase 3 (§D2), quando le due
// variabili che descrive esistono davvero e vengono lette.
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
});
