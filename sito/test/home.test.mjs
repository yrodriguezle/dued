// La home: una selezione viva, e ciò che deliberatamente NON fa.

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

const CATALOGO = {
  categorie: [
    {
      nome: 'Caffetteria',
      prodotti: [
        prodottoFinto(900, 'Caffè espresso', { consigliato: true, immagine: immagineFinta() }),
        prodottoFinto(901, 'Cappuccino', { consigliato: false }),
      ],
    },
    {
      nome: 'Aperitivi',
      prodotti: [prodottoFinto(902, 'Spritz cubano', { consigliato: true })],
    },
  ],
  totaleProdottiPubblicati: 3,
  limiteApplicato: 300,
  troncato: false,
};

before(async () => {
  api = await backendFinto({ '/api/public/menu': CATALOGO });
  costruisci({ API_INTERNA_URL: api.origine });
  sito = await avviaSito();
});

after(() => {
  sito?.ferma();
  api?.chiudi();
});

async function home(menu = CATALOGO) {
  api.stato.risposte['/api/public/menu'] = menu;
  const r = await fetch(`${sito.base}/`);
  return { stato: r.status, intestazioni: r.headers, html: await r.text() };
}

test('la striscia dei consigli viene dal payload, non da una lista scritta a mano', async () => {
  const { stato, html } = await home();
  assert.equal(stato, 200);
  const striscia = html.slice(html.indexOf('I nostri consigli'), html.indexOf('Ogni sera'));

  assert.match(striscia, /Caffè espresso/);
  assert.match(striscia, /Spritz cubano/);
  // E chi non è consigliato NON c'è: se la striscia fosse una lista nel template, ci
  // sarebbe tutto o ci sarebbe altro.
  assert.ok(!striscia.includes('Cappuccino'), 'un prodotto non consigliato è nella striscia');
});

test('cambiare il marcatore nel payload cambia la striscia', async () => {
  const senza = {
    ...CATALOGO,
    categorie: CATALOGO.categorie.map((c) => ({
      ...c,
      prodotti: c.prodotti.map((p) => ({ ...p, consigliato: false })),
    })),
  };
  const { html } = await home(senza);
  assert.ok(!html.includes('I nostri consigli'), 'la striscia esiste senza alcun consigliato');
  await home(); // ripristina lo stato per i test seguenti
});

test('🔴 la home NON mostra l\'avviso di troncamento, il menu sì', async () => {
  // La home espone per natura una SELEZIONE, non un listino: non promette completezza, e un
  // avviso lì sarebbe rumore.
  // ⚠️ Conseguenza da conoscere: con il menu troncato, un `consigliato` oltre il limite non
  //    compare in home. Il rimedio è l'ordinamento di vetrina, che l'admin già ha.
  const troncato = { ...CATALOGO, totaleProdottiPubblicati: 999, limiteApplicato: 300, troncato: true };
  const { html: homeHtml } = await home(troncato);
  assert.ok(!/Sono mostrati i primi/.test(homeHtml), 'la home avvisa del troncamento');

  const menuHtml = await (await fetch(`${sito.base}/menu`)).text();
  assert.match(menuHtml, /Sono mostrati i primi\s*300\s*prodotti di\s*999/);
  await home();
});

test('la fascia Aperitivo porta il registro serale come attributo', async () => {
  const { html } = await home();
  assert.match(
    html,
    /<section[^>]+data-tema="sera"/,
    'la fascia non dichiara il proprio registro: senza, il caso che rende `@theme inline` ' +
      'necessario non esiste più in nessuna pagina'
  );
});

test('la home dichiara la cache come il menu', async () => {
  const { intestazioni } = await home();
  const direttive = intestazioni.get('cache-control').split(',').map((d) => d.trim());
  assert.ok(direttive.includes('public'));
  assert.ok(direttive.includes('max-age=60'));
});

test('gli orari in home vengono dall\'API', async () => {
  const { html } = await home();
  // Il backend finto dichiara 07:00–20:00: se la home li scrivesse a mano, cambiando la
  // risposta non cambierebbe nulla.
  assert.match(html, /07:00/);
  assert.match(html, /20:00/);

  api.stato.risposte['/api/public/site'] = {
    ...api.stato.risposte['/api/public/site'],
    orari: { ...api.stato.risposte['/api/public/site'].orari, chiusura: '23:45' },
  };
  const dopo = await (await fetch(`${sito.base}/`)).text();
  assert.match(dopo, /23:45/, 'la home non segue l\'orario dell\'API');
});
