// La navigazione offre soltanto le pagine che esistono.
//
// 🔴 Due rotte sono **condizionate al loro testo** — `/aperitivo` e `/locale` rispondono 404
//    finché un amministratore non le scrive — e la lista delle voci è statica. Le due cose
//    insieme producono il difetto che questa prova esiste per impedire: **su
//    un'installazione nuova, due voci su cinque portano a un «pagina non trovata»**.
//
//    Non è teorico: è esattamente lo stato della produzione il giorno del primo deploy del
//    redesign, dove i campi editoriali sono vuoti perché nessuno li ha ancora compilati.
//
// ⚠️ E la stessa lista la usano quattro posti — intestazione, piè di pagina, pagina 404 e
//    **sitemap**. L'ultimo è quello che nessuno guarderebbe: una sitemap che dichiara ai
//    motori due URL che rispondono 404 non produce alcun sintomo visibile, e si scopre nella
//    Search Console settimane dopo.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  backendFinto,
  costruisci,
  avviaSito,
  SITO_FINTO,
  SITO_FINTO_CON_TESTI,
} from './_sito-di-prova.mjs';

let api;
let sito;

before(async () => {
  api = await backendFinto();
  costruisci({ API_INTERNA_URL: api.origine });
  sito = await avviaSito();
});

after(() => {
  sito?.ferma();
  api?.chiudi();
});

/** Le etichette delle voci nella navigazione principale della pagina indicata. */
async function vociDi(percorso) {
  const html = await (await fetch(`${sito.base}${percorso}`)).text();
  const nav = html.slice(html.indexOf('aria-label="Principale"'));
  return [...nav.matchAll(/<a\s+href="(\/[a-z]*)"[^>]*>\s*([^<]+?)\s*<\/a>/g)]
    .map((m) => m[1])
    .filter((percorso, indice, tutti) => tutti.indexOf(percorso) === indice);
}

test('🔴 senza i testi, le due pagine editoriali non compaiono in navigazione', async () => {
  api.stato.risposte['/api/public/site'] = SITO_FINTO;
  const voci = await vociDi('/');

  assert.deepEqual(
    voci,
    ['/', '/menu', '/contatti'],
    'la navigazione offre pagine che rispondono 404: su un\'installazione nuova sarebbero ' +
      'due voci su cinque'
  );
});

test('con i testi compilati, le cinque voci ci sono tutte', async () => {
  api.stato.risposte['/api/public/site'] = SITO_FINTO_CON_TESTI;
  const voci = await vociDi('/');

  assert.deepEqual(voci, ['/', '/menu', '/aperitivo', '/locale', '/contatti']);
});

test('🔴 la sitemap dichiara le stesse rotte della navigazione, non tutte', async () => {
  // È il consumatore che nessuno guarderebbe, ed è quello in cui l'errore costa di più: un
  // URL in sitemap che risponde 404 non ha alcun sintomo visibile sul sito.
  api.stato.risposte['/api/public/site'] = SITO_FINTO;
  const xml = await (await fetch(`${sito.base}/sitemap.xml`)).text();

  assert.ok(!xml.includes('/aperitivo'), 'la sitemap dichiara /aperitivo, che risponde 404');
  assert.ok(!xml.includes('/locale'), 'la sitemap dichiara /locale, che risponde 404');
  assert.match(xml, /<loc>https:\/\/duedgusto\.it\/menu<\/loc>/);

  api.stato.risposte['/api/public/site'] = SITO_FINTO_CON_TESTI;
  const conTesti = await (await fetch(`${sito.base}/sitemap.xml`)).text();
  assert.match(conTesti, /<loc>https:\/\/duedgusto\.it\/aperitivo<\/loc>/);
});

test('la pagina «non trovato» non propone altri «non trovato»', async () => {
  api.stato.risposte['/api/public/site'] = SITO_FINTO;
  const risposta = await fetch(`${sito.base}/una-rotta-che-non-esiste`);
  assert.equal(risposta.status, 404);

  const html = await risposta.text();
  const corpo = html.slice(html.indexOf('aria-label="Dove andare"'));
  assert.ok(!corpo.includes('href="/aperitivo"'), 'la 404 propone una pagina che è anch\'essa 404');
  assert.ok(!corpo.includes('href="/locale"'));
});

test('⚠️ in degradazione si mostrano TUTTE: non si sa cosa esiste', async () => {
  // Nascondere metà del sito perché l'API non ha risposto per un minuto trasformerebbe un
  // guasto temporaneo in una navigazione mutilata — e la cache lo servirebbe anche dopo.
  api.stato.risposte['/api/public/site'] = null;
  const voci = await vociDi('/');
  assert.deepEqual(voci, ['/', '/menu', '/aperitivo', '/locale', '/contatti']);

  api.stato.risposte['/api/public/site'] = SITO_FINTO;
});
