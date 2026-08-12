// Hook di risoluzione per i due moduli virtuali di Astro.
//
// `astro:env/server` e `astro:env/client` esistono **solo dentro la build di Astro**: sono
// generati dalla configurazione, non stanno su disco, e importarli da `node:test`
// fallisce con ERR_MODULE_NOT_FOUND prima che una sola asserzione venga eseguita.
//
// 🔴 Perché questa strada e non «spostare la logica in un file senza quell'import».
//    La spec pretende che il modulo dei media sia **lo stesso file** che contiene il
//    segmento `/media/` **e** che importa dal contesto client. Separarli per rendere il
//    codice testabile violerebbe la cosa che i test devono proteggere: sarebbe la coda che
//    scodinzola il cane. Meglio insegnare a Node cosa sono quei due moduli.
//
// I valori sono LIVE BINDINGS riassegnabili: `api.ts` legge `API_INTERNA_URL` dentro il
// corpo delle funzioni, quindi un test può cambiarlo fra un caso e l'altro senza
// ricaricare il modulo — che è ciò che serve per provare i quattro motivi contro quattro
// server diversi.

const SORGENTE = {
  'astro-env-finto:server': `
    export let API_INTERNA_URL = 'https://localhost:4000';
    export function impostaApiInternaUrl(valore) { API_INTERNA_URL = valore; }
  `,
  'astro-env-finto:client': `
    export let PUBLIC_MEDIA_ORIGINE = 'https://localhost:4000';
    export function impostaMediaOrigine(valore) { PUBLIC_MEDIA_ORIGINE = valore; }
  `,
};

const ALIAS = {
  'astro:env/server': 'astro-env-finto:server',
  'astro:env/client': 'astro-env-finto:client',
};

export function resolve(specificatore, contesto, avanti) {
  const finto = ALIAS[specificatore] ?? (specificatore in SORGENTE ? specificatore : null);
  if (finto) return { url: finto, format: 'module', shortCircuit: true };
  return avanti(specificatore, contesto);
}

export function load(url, contesto, avanti) {
  if (url in SORGENTE) {
    return { format: 'module', source: SORGENTE[url], shortCircuit: true };
  }
  return avanti(url, contesto);
}
