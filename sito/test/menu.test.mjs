// `/menu` — il troncamento dichiarato, il listino vuoto, e i campi che non devono uscire.
//
// I tre casi che contano non esistono a database: il menu troncato vorrebbe 301 prodotti, e
// il listino vuoto vorrebbe svuotare la vetrina di un locale vero. Qui sono tre righe di
// JSON servite da un backend finto.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  backendFinto,
  costruisci,
  avviaSito,
  immagineFinta,
  prodottoFinto,
} from './_sito-di-prova.mjs';

let api;
let sito;

before(async () => {
  api = await backendFinto();
  // 🔴 L'origine dell'API va data alla BUILD, non all'ambiente del server: `astro:env`
  //    inlina le variabili `public` nel bundle. Passarla solo al server non fallisce —
  //    il sito legge il backend vero, i test diventano verdi per la ragione sbagliata, e
  //    sembrano funzionare. Vedi la nota in `_sito-di-prova.mjs`.
  costruisci({ API_INTERNA_URL: api.origine });
  sito = await avviaSito();
});

after(() => {
  sito?.ferma();
  api?.chiudi();
});

/** Imposta la risposta del menu e scarica la pagina. */
async function menuCon(risposta) {
  api.stato.risposte['/api/public/menu'] = risposta;
  const r = await fetch(`${sito.base}/menu`);
  return { stato: r.status, intestazioni: r.headers, html: await r.text() };
}

const CATALOGO = {
  categorie: [
    {
      nome: 'Caffetteria',
      prodotti: [
        prodottoFinto(900, 'Caffè espresso', {
          descrizione: 'Miscela della casa, tostatura media',
          prezzo: 1.2,
          consigliato: true,
          immagine: immagineFinta(),
        }),
        prodottoFinto(901, 'Mojito omaggio', { prezzo: 0, novita: true, allergeni: 'solfiti' }),
      ],
    },
  ],
  totaleProdottiPubblicati: 2,
  limiteApplicato: 300,
  troncato: false,
  lavagna: [],
};

test('il menu rende categorie e prodotti nell\'ordine dell\'API', async () => {
  const { stato, html } = await menuCon(CATALOGO);
  assert.equal(stato, 200);
  assert.match(html, /Caffetteria/);
  assert.match(html, /Caffè espresso/);
  assert.match(html, /Miscela della casa/);
});

test('🔴 prezzo a zero: è un omaggio e si stampa', async () => {
  // Non è un prezzo mancante, e nasconderlo o scrivere «—» trasformerebbe una decisione
  // dell'amministratore in un buco. Il backend distingue: solo `null` sarebbe assenza.
  const { html } = await menuCon(CATALOGO);
  assert.match(html, /0,00\s*&nbsp;?€|0,00\s*€/u, 'il prezzo zero non compare nel markup');
});

test('🔴 menu troncato: l\'avviso c\'è e porta i due numeri della RISPOSTA', async () => {
  const { html } = await menuCon({
    ...CATALOGO,
    totaleProdottiPubblicati: 412,
    limiteApplicato: 300,
    troncato: true,
    lavagna: [],
  });
  assert.match(html, /Sono mostrati i primi\s*300\s*prodotti di\s*412/);
  assert.match(html, /chiedi in cassa/i);
});

test('menu non troncato: nessun avviso', async () => {
  const { html } = await menuCon(CATALOGO);
  assert.ok(!/Sono mostrati i primi/.test(html));
});

test("i due numeri non sono costanti del sito", async () => {
  // Se il limite fosse scritto nel template, cambiando la risposta l'avviso resterebbe
  // uguale. Qui il server ne manda altri due e la pagina deve seguirli.
  const { html } = await menuCon({
    ...CATALOGO,
    totaleProdottiPubblicati: 57,
    limiteApplicato: 25,
    troncato: true,
    lavagna: [],
  });
  assert.match(html, /primi\s*25\s*prodotti di\s*57/);
});

test('nessun prodotto pubblicato: 200 con un messaggio, mai una pagina bianca', async () => {
  const { stato, html } = await menuCon({
    categorie: [],
    totaleProdottiPubblicati: 0,
    limiteApplicato: 300,
    troncato: false,
    lavagna: [],
  });
  // ⚠️ È uno stato LEGITTIMO — nessuno ha ancora pubblicato — ed è diverso dalla
  //    degradazione, dove il dato non è arrivato: quella risponde 503 (Fase 10).
  assert.equal(stato, 200);
  assert.match(html, /non è ancora pubblicato/i);
});

test('un solo punto scrive la cache, e nello stato normale dichiara 60 secondi', async () => {
  const { intestazioni } = await menuCon(CATALOGO);
  const cache = intestazioni.get('cache-control');
  // ⚠️ L'header si LEGGE, non si confronta con una stringa: le direttive possono essere
  //    emesse senza spazio dopo la virgola, ed è la stessa direttiva.
  const direttive = cache.split(',').map((d) => d.trim());
  assert.ok(direttive.includes('public'), cache);
  assert.ok(direttive.includes('max-age=60'), cache);
});

test('nessun campo contabile o interno nella pagina renderizzata', async () => {
  // Il contratto pubblico non li possiede: questo verifica che il sito non li abbia presi
  // da altrove — per esempio da una seconda chiamata, o da un campo aggiunto al DTO.
  const { html } = await menuCon(CATALOGO);
  for (const vietato of [
    'AliquotaIva',
    'aliquotaIva',
    'unitaDiMisura',
    'CodiceListino',
    'createdAt',
    'updatedAt',
    'prezzoListino',
  ]) {
    assert.ok(!html.includes(vietato), `la pagina contiene «${vietato}»`);
  }
});

test('🔴 il listino NON scarica una foto per riga', async () => {
  // ⚠️ È la differenza che pesa di più fra questa pagina e quella che c'era prima, e non è
  //    estetica: il listino era una griglia di card con la foto di ogni prodotto. Con
  //    quaranta voci sono quaranta immagini da scaricare **per leggere dei prezzi** — su un
  //    telefono, in strada, mentre si decide se entrare.
  //
  //    Le foto restano, ma sono quelle della galleria e stanno in coda: un numero fisso,
  //    indipendente da quanto è lungo il listino.
  api.stato.risposte['/api/public/galleria'] = { immagini: [immagineFinta()] };
  const { html } = await menuCon(CATALOGO);

  const immagini = [...html.matchAll(/<picture/g)].length;
  assert.ok(
    immagini <= 3,
    `la pagina del menu rende ${immagini} immagini: il listino è tornato a card, e il peso ` +
      'della pagina cresce con il numero di prodotti'
  );

  // Quelle che ci sono passano comunque dal componente, con srcset e sizes.
  assert.match(html, /type="image\/webp"/);
  // Due varianti, non quattro: l'immagine finta ne dichiara due.
  const srcset = html.match(/srcset="([^"]*webp[^"]*)"/)[1];
  assert.equal(srcset.split(',').length, 2, srcset);
  assert.match(html, /sizes="/);

  api.stato.risposte['/api/public/galleria'] = { immagini: [] };
});
