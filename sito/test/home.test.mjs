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

// ── Le chiusure ──────────────────────────────────────────────────────────────────────────
//
// 🔴 Il guasto che questi test chiudono: il 13 agosto 2026, con il bar in ferie dal 10 al 22
//    registrate in cassa, la home scriveva «Giovedì 07:00 — 20:00» e la pastiglia si
//    accendeva su «Aperto». L'orario settimanale arrivava vivo e corretto — il guasto era
//    che le eccezioni a quell'orario non erano nel contratto pubblico.

/** Rimette il payload dell'identità com'era, così i test successivi non lo ereditano. */
async function conChiusure(chiusure) {
  const originale = api.stato.risposte['/api/public/site'];
  api.stato.risposte['/api/public/site'] = { ...originale, chiusure };
  const html = await (await fetch(`${sito.base}/`)).text();
  api.stato.risposte['/api/public/site'] = originale;
  return html;
}

test('🔴 le ferie compaiono in home come un periodo, non come tredici righe', async () => {
  const html = await conChiusure(
    Array.from({ length: 13 }, (_, i) => ({
      data: `2026-08-${String(10 + i).padStart(2, '0')}`,
      descrizione: 'Ferie',
      motivo: 'FERIE',
    }))
  );

  const avvisi = [...html.matchAll(/data-periodo-chiuso="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(avvisi, ['2026-08-10'], 'tredici giorni contigui sono UN avviso');
  assert.match(html, /Ferie/);
  assert.match(html, /dal 10 al 22 agosto/);
});

test('🔴 lo script riceve le date chiuse: è ciò che spegne «Aperto»', async () => {
  // La pastiglia è orologio e vive nel browser, quindi qui non si può leggerne il testo. Si
  // prova la cosa da cui dipende: che le date arrivino ai parametri dello script. Senza,
  // `eAperto` non ha modo di sapere che oggi è un giorno di ferie.
  const html = await conChiusure([
    { data: '2026-08-13', descrizione: 'Ferie', motivo: 'FERIE' },
  ]);

  const parametri = JSON.parse(
    html.match(/<script>([\s\S]*?)<\/script>/)[1].match(/const P = (\{.*?\});/)[1]
  );
  assert.deepEqual(parametri.chiusure, [{ data: '2026-08-13', descrizione: 'Ferie' }]);
});

test('⚠️ una descrizione lunga arriva alla pastiglia accorciata, non intera', async () => {
  // La pastiglia sta accanto al selettore del tema e si accende dopo il primo paint: una
  // descrizione lunga spingerebbe fuori l'intestazione nel momento peggiore.
  const html = await conChiusure([
    {
      data: '2026-08-13',
      descrizione: 'Chiusura straordinaria per lavori di ristrutturazione',
      motivo: 'CHIUSURA_STRAORDINARIA',
    },
  ]);

  const parametri = JSON.parse(
    html.match(/<script>([\s\S]*?)<\/script>/)[1].match(/const P = (\{.*?\});/)[1]
  );
  assert.ok(parametri.chiusure[0].descrizione.length <= 22);
  assert.match(parametri.chiusure[0].descrizione, /…$/);
});

test('🔴 i dati strutturati dichiarano le date chiuse, non solo la settimana', async () => {
  // È la copia che i motori mostrano nella scheda del locale. Senza le eccezioni,
  // `openingHoursSpecification` da sola dichiara il bar aperto ogni giovedì, ferie comprese.
  const html = await conChiusure([
    { data: '2026-08-13', descrizione: 'Ferie', motivo: 'FERIE' },
    { data: '2026-08-14', descrizione: 'Ferie', motivo: 'FERIE' },
  ]);

  const dati = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]
  );
  assert.deepEqual(dati.specialOpeningHoursSpecification, [
    {
      '@type': 'OpeningHoursSpecification',
      opens: '00:00',
      closes: '00:00',
      validFrom: '2026-08-13',
      validThrough: '2026-08-14',
    },
  ]);
});

test('senza chiusure non c\'è nessuna fascia e nessuna eccezione nei dati strutturati', async () => {
  // È lo stato di quasi tutto l'anno: una sezione senza il suo dato non si rende affatto.
  const { html } = await home();

  assert.ok(!html.includes('data-avviso-chiusura'), 'la fascia si rende con l\'elenco vuoto');
  const dati = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]
  );
  assert.equal(dati.specialOpeningHoursSpecification, undefined);
  assert.ok(Array.isArray(dati.openingHoursSpecification), 'la settimana ricorrente resta');
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
