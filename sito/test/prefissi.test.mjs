// 🔴 LA PROVA A — l'host sentinella. È il rischio centrale del change, chiuso su un'asserzione.
//
// Il guasto: comporre gli URL delle immagini con il prefisso dell'API. In sviluppo i due
// valori COINCIDONO, quindi il sito funziona, le foto caricano, nessun test diventa rosso —
// e in produzione ogni `<img>` punta all'host interno del backend, irraggiungibile da un
// browser. Non esiste un momento in cui qualcosa si accorga di niente.
//
// La prova mette un valore **impossibile** nel prefisso dei media e verifica che compaia nel
// markup, e che l'host dell'API **non ci sia**.
//
// ⚠️ Non serve che l'host sentinella risolva: è un'asserzione sul MARKUP, non sul
//    caricamento. Per questo è deterministica e gira senza rete.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  backendFinto,
  costruisci,
  avviaSito,
  immagineFinta,
  prodottoFinto,
} from './_sito-di-prova.mjs';

const SENTINELLA = 'https://media.sentinella.invalid';

let api;
let sito;
let html = '';

before(async () => {
  api = await backendFinto({
    '/api/public/menu': {
      categorie: [
        {
          nome: 'Caffetteria',
          prodotti: [prodottoFinto(900, 'Caffè espresso', { immagine: immagineFinta() })],
        },
      ],
      totaleProdottiPubblicati: 1,
      limiteApplicato: 300,
      troncato: false,
    },
  });

  // 🔴 Entrambe alla BUILD: `astro:env` inlina le variabili `public` nel bundle, di
  //    qualunque contesto. Darle solo all'ambiente del server non fallisce e non fa nulla.
  costruisci({ API_INTERNA_URL: api.origine, PUBLIC_MEDIA_ORIGINE: SENTINELLA });
  sito = await avviaSito();
  html = await (await fetch(`${sito.base}/menu`)).text();
});

after(async () => {
  sito?.ferma();
  api?.chiudi();
  // Rimette in `dist/` una build normale: lasciare quella con l'host sentinella
  // significherebbe che un `npm run preview` dopo i test mostra un sito con le foto rotte.
  costruisci();
});

test("🔴 prova A — l'host dei media nel markup è quello del BROWSER", () => {
  assert.ok(
    html.includes(SENTINELLA),
    "il prefisso dei media non compare nel markup: le immagini non passano da mediaUrl"
  );
});

test("🔴 prova A — l'host di lettura delle rotte NON compare mai nel markup", () => {
  const ospite = new URL(api.origine).host;
  const occorrenze = html.split(ospite).length - 1;
  assert.equal(
    occorrenze,
    0,
    `l'host interno dell'API compare ${occorrenze} volte nel markup servito. In sviluppo ` +
      'questo non si vede — i due prefissi coincidono — e in produzione ogni immagine del ' +
      "sito punterebbe a un host che il browser del visitatore non può raggiungere."
  );
});

test('le sorgenti delle immagini sono tutte sull\'host del browser', () => {
  const sorgenti = [...html.matchAll(/(?:src|srcset)="([^"]+)"/g)]
    .flatMap((m) => m[1].split(',').map((s) => s.trim().split(' ')[0]))
    .filter((u) => u.includes('/media/'));

  assert.ok(sorgenti.length > 0, 'nessuna immagine nel markup: la prova non sta guardando nulla');
  for (const url of sorgenti) {
    assert.ok(url.startsWith(SENTINELLA), `sorgente con l'origine sbagliata: ${url}`);
  }
});
