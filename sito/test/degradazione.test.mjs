// Il backend può cadere, e il sito lo DICHIARA invece di rompersi.
//
// 🔴 In SSR il default è il comportamento peggiore: una `fetch` che fallisce nel frontmatter
//    fa fallire la pagina, Astro risponde 500 e in sviluppo mostra il proprio overlay. Per
//    una vetrina è la cosa peggiore che possa succedere, ed è ciò che accade senza far
//    niente.
//
// I casi non sono simmetrici, e la ragione è che le due pagine servono a cose diverse.

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  backendFinto,
  costruisci,
  avviaSito,
  portaLibera,
  prodottoFinto,
} from './_sito-di-prova.mjs';

// ⚠️ DUE GRUPPI, e non un `before` solo con due server accesi insieme.
//    L'adapter Node importa i moduli di una rotta alla PRIMA richiesta: due server avviati
//    da build diverse ma sulla stessa cartella `dist/` finiscono per caricare entrambi
//    l'ULTIMA build, e il «sito vivo» si ritrova a leggere la porta morta. Il sintomo è
//    insidioso — i test del caso felice falliscono e sembrano dire che la cache non viene
//    dichiarata. Ogni gruppo costruisce la sua configurazione, la usa e la spegne.

const CATALOGO = {
  categorie: [{ nome: 'Caffetteria', prodotti: [prodottoFinto(900, 'Caffè espresso')] }],
  totaleProdottiPubblicati: 1,
  limiteApplicato: 300,
  troncato: false,
  lavagna: [],
};

/** Le direttive di `Cache-Control`, lette e non confrontate con una stringa. */
function direttive(risposta) {
  // ⚠️ Le direttive possono essere emesse senza spazio dopo la virgola, ed è la stessa
  //    direttiva: `cache === 'public, max-age=60'` sarebbe un test sul formato, non sul
  //    significato.
  return (risposta.headers.get('cache-control') ?? '').split(',').map((d) => d.trim());
}

describe('con il backend irraggiungibile', () => {
  let sito;

  before(async () => {
    // ⚠️ Modo (a) del task 10.4: una PORTA LIBERA. Nessun ascoltatore produce lo stesso
    //    esito `rete` di un backend spento, è deterministico, e soprattutto non spegne
    //    nulla — il backend di chi sviluppa resta acceso.
    const morta = await portaLibera();
    costruisci({ API_INTERNA_URL: `http://127.0.0.1:${morta}` });
    sito = await avviaSito();
  });

  after(() => sito?.ferma());

  test('🔴 `/` risponde 200 e dichiara ciò che manca', async () => {
    const r = await fetch(`${sito.base}/`);
    assert.equal(r.status, 200, "la home degradata resta 200: è l'URL che i motori tengono");

    const html = await r.text();
    // Ciò che resta è contenuto VERO, perché quegli asset sono locali.
    //
    // ⚠️ Le tre parole sono il TITOLO della home e non più l'insegna riprodotta: dal redesign
    //    stanno su due righe con l'ultima in corsivo, quindi la stringa contigua «Colazione
    //    Pranzo Aperitivo» non esiste più nel markup. Restano testo, che è la proprietà che
    //    conta — leggibile, traducibile, indicizzabile — e questa forma lo verifica insieme
    //    al fatto che il corsivo sia un `<em>` e non un'inclinazione applicata a mano.
    assert.match(
      html,
      /Colazione,\s*<br[^>]*>\s*pranzo e <em[^>]*>aperitivo<\/em>/,
      'il titolo della home non è in pagina: era ciò che restava di vero quando manca tutto'
    );
    assert.match(html, /<svg/, 'il logo è locale e deve esserci comunque');
    // E ciò che manca è dichiarato, non semplicemente assente.
    assert.match(html, /non sono raggiungibili/i);
    // Nessun orario inventato: una pagina degradata non finge di sapere.
    assert.ok(
      !/\d{2}:\d{2}\s*–\s*\d{2}:\d{2}/.test(html.slice(html.indexOf('<body'))),
      'la home degradata mostra un orario: il ripiego non deve mai comparire in pagina'
    );
  });

  test('🔴 `/menu` risponde 503 con Retry-After e un corpo leggibile', async () => {
    const r = await fetch(`${sito.base}/menu`);
    // 🔴 Non 200: una pagina di menu senza prodotti sarebbe **un menu vuoto indicizzabile**,
    //    la stessa classe di guasto silenzioso che il flag `troncato` esiste per evitare.
    assert.equal(r.status, 503);
    assert.equal(r.headers.get('retry-after'), '120');
    assert.match(await r.text(), /non è raggiungibile/i);
  });

  test('🔴 ogni risposta degradata dice no-store', async () => {
    for (const percorso of ['/', '/menu']) {
      const r = await fetch(`${sito.base}${percorso}`);
      assert.ok(
        direttive(r).includes('no-store'),
        `${percorso} degradata non dice no-store: il micro-cache congelerebbe la pagina ` +
          'rotta per sessanta secondi DOPO che il backend è tornato su — il guasto ' +
          'durerebbe più del guasto.'
      );
    }
  });

  test("🔴 l'ora del tema viene dal ripiego, e il ripiego non compare in pagina", async () => {
    const html = await (await fetch(`${sito.base}/`)).text();
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const parametri = JSON.parse(script.match(/const P = (\{.*?\});/)[1]);

    // Il ripiego di `degradazione.ts`: serve perché la formula del registro serale ha due
    // estremi, e senza il secondo il tema resterebbe «giorno» alle due di notte anche qui.
    assert.equal(parametri.oraSera, '18:00');
    assert.equal(parametri.oraApertura, '07:00');
    // ⚠️ E non è un orario del locale: `oraChiusura` resta **null**, perché una pagina
    //    degradata dichiara di non sapere gli orari invece di inventarli. È anche il motivo
    //    per cui il badge «aperto ora» non compare: lo script non lo calcola senza chiusura.
    assert.equal(parametri.oraChiusura, null);
    assert.equal(parametri.giorniOperativi, null);
  });

  test('nessun overlay del framework al posto della vetrina', async () => {
    const html = await (await fetch(`${sito.base}/`)).text();
    for (const spia of ['astro-dev-toolbar', 'astro-error', 'ErrorOverlay', 'vite-error-overlay']) {
      assert.ok(!html.includes(spia), `la pagina degradata contiene «${spia}»`);
    }
    // La riga di log la scrive `api.ts`, e la sua forma è pinnata dai test di quel modulo:
    // chi guarda il sito vede meno, chi guarda i log sa perché.
  });
});

describe('con il backend raggiungibile', () => {
  let api;
  let sito;

  before(async () => {
    api = await backendFinto({ '/api/public/menu': CATALOGO });
    costruisci({ API_INTERNA_URL: api.origine });
    sito = await avviaSito();
  });

  after(() => {
    sito?.ferma();
    api?.chiudi();
  });

  test('entrambe le pagine dichiarano la cache, e nessuna dice no-store', async () => {
    for (const percorso of ['/', '/menu']) {
      const r = await fetch(`${sito.base}${percorso}`);
      assert.equal(r.status, 200, percorso);
      const d = direttive(r);
      assert.ok(d.includes('public'), `${percorso}: ${d}`);
      assert.ok(d.includes('max-age=60'), `${percorso}: ${d}`);
      assert.ok(!d.includes('no-store'), `${percorso} dice no-store con il backend vivo`);
    }
  });

  test("🔴 l'ora del tema viene dall'API, non dal ripiego che oggi vale lo stesso", async () => {
    // ⚠️ La prova NON confronta la stringa `"18:00"`: il ripiego e il valore a database oggi
    //    coincidono, quindi un test così sarebbe verde anche leggendo la costante sbagliata.
    //    Si cambia il valore nella risposta, e si guarda se il sito lo segue.
    const originale = api.stato.risposte['/api/public/site'];
    api.stato.risposte['/api/public/site'] = { ...originale, oraInizioTemaSera: '19:45' };

    const html = await (await fetch(`${sito.base}/`)).text();
    const parametri = JSON.parse(
      html.match(/<script>([\s\S]*?)<\/script>/)[1].match(/const P = (\{.*?\});/)[1]
    );
    assert.equal(parametri.oraSera, '19:45', "lo script sta leggendo il ripiego invece dell'API");
    // E gli altri tre parametri arrivano dagli orari, non da costanti.
    assert.equal(parametri.oraChiusura, '20:00');
    assert.deepEqual(parametri.giorniOperativi, [true, true, true, true, true, true, false]);

    api.stato.risposte['/api/public/site'] = originale;
  });

  test("fallimento parziale: il menu non risponde e l'identità sì", async () => {
    // Il caso che `Promise.all` senza cortocircuito rende possibile: si perde un pezzo, non
    // tutta la pagina. Se una delle due letture rifiutasse, il guasto di `/menu` porterebbe
    // via anche l'identità del locale, che sta in un'altra risposta.
    api.stato.risposte['/api/public/menu'] = 500;

    const r = await fetch(`${sito.base}/`);
    const html = await r.text();
    assert.equal(r.status, 200);
    assert.match(html, /2D Gusto Bar/, "l'identità letta deve sopravvivere al menu perduto");
    assert.match(html, /07:00/, 'gli orari letti devono restare in pagina');
    assert.match(html, /listino non è raggiungibile/i, "l'assenza del listino va dichiarata");
    assert.ok(!html.includes('I nostri consigli'), 'la striscia dei consigli non può esserci');
    assert.ok(direttive(r).includes('no-store'), 'una pagina parziale non va in cache');

    // E `/menu`, con lo stesso identico guasto, risponde 503: due pagine, due decisioni.
    const m = await fetch(`${sito.base}/menu`);
    assert.equal(m.status, 503);

    api.stato.risposte['/api/public/menu'] = CATALOGO;
  });
});
