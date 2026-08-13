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
  lavagna: [],
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

test('🔴 le linguette dei momenti sono le categorie del payload, non tre parole del mockup', async () => {
  const { stato, html } = await home();
  assert.equal(stato, 200);

  // È la regressione che questo test esiste per impedire: il mockup ha «Colazione / Pranzo /
  // Aperitivo» scritte nel componente, con i piatti elencati a mano. Copiate così, il giorno
  // in cui il locale smette di fare il congri il sito continua a proporlo — e nessuno
  // collegherebbe mai quella riga al listino.
  const linguette = [...html.matchAll(/data-linguetta="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(linguette, ['Caffetteria', 'Aperitivi']);
});

test('dentro un momento i consigliati vengono per primi', async () => {
  const { html } = await home();
  const pannello = html.slice(
    html.indexOf('data-pannello="Caffetteria"'),
    html.indexOf('data-pannello="Aperitivi"')
  );

  const espresso = pannello.indexOf('Caffè espresso');
  const cappuccino = pannello.indexOf('Cappuccino');
  assert.ok(espresso >= 0 && cappuccino >= 0, 'il pannello non contiene i due prodotti');
  assert.ok(
    espresso < cappuccino,
    'il consigliato non viene per primo: è il marcatore che l\'amministratore governa dalla ' +
      'cassa, ed è l\'unica leva che ha su cosa si vede sopra la piega'
  );
});

test('il nastro ripiega sulle categorie quando i consigliati sono meno di tre', async () => {
  // Due consigliati nel catalogo di prova: un nastro di due parole non è un nastro, e le
  // categorie sono comunque dato vero.
  const { html } = await home();
  const nastro = html.slice(html.indexOf('nastro-scorre'));
  assert.match(nastro, /Caffetteria/);
  assert.match(nastro, /Aperitivi/);
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

test('la lavagna porta il registro serale come attributo', async () => {
  const conLavagna = { ...CATALOGO, lavagna: [prodottoFinto(903, 'Congri con pollo')] };
  const { html } = await home(conLavagna);

  assert.match(html, /Congri con pollo/);
  assert.match(
    html,
    /<div[^>]+data-tema="sera"/,
    'la lavagna non dichiara il proprio registro: senza, il caso che rende `@theme inline` ' +
      'necessario non esiste più in nessuna pagina, e la differenza fra le due forme torna ' +
      'indistinguibile'
  );
  await home();
});

test('🔴 lavagna vuota: la sezione non c\'è affatto', async () => {
  // È la proprietà che rende sicura la scelta di persistere una DATA invece di un
  // interruttore: dimenticarsi di aggiornarla fa sparire la sezione, invece di lasciare
  // online il piatto di venerdì scorso con l'aria di essere quello di oggi.
  const { html } = await home();
  assert.ok(
    !html.includes('La lavagna di oggi'),
    'con la lavagna vuota la sezione si rende comunque: mostrerebbe un titolo «di oggi» ' +
      'sopra il nulla'
  );
  assert.ok(!/<div[^>]+data-tema="sera"/.test(html));
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
