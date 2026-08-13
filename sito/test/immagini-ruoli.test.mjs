// 🔴 Le quattro pagine chiedono le immagini **per nome**, e rendono le stesse di prima.
//
// Perché questo file esiste. Fino a questo change ogni pagina indicizzava la galleria con i
// propri offset — `galleria[0]`, `slice(0,3)`, `galleria[1] ?? galleria[0]`, `slice(2,5)`,
// `at(-1)` — cioè la stessa regola scritta in quattro file, con quattro convenzioni diverse
// per «la seconda foto». Spostarla nel backend è la mossa del change; questo file è la prova
// che spostandola **non è cambiato ciò che il visitatore vede**.
//
// ⚠️ **Con una eccezione, e la si afferma invece di ricopiarla.** `/aperitivo` a slot vuoto
//    ora esce **senza** immagine di testata, dove prima rendeva l'ultima della galleria. È una
//    decisione presa, non una regressione: `at(-1)` faceva sì che caricare una foto qualsiasi
//    — anche per un'altra pagina — spostasse di nascosto l'eroe dell'aperitivo, e quel ripiego
//    non era un ponte ma la semantica permanente dello slot vuoto. Quattro pagine su cinque
//    provano la non regressione; la quinta prova la differenza decisa.
//
// 🔴 **L'autorità del confronto è esterna al codice sotto prova**: gli indici attesi qui sotto
//    sono l'aritmetica che i `.astro` avevano PRIMA del change, copiata alla lettera e
//    calcolata in questo file. Se il backend finto e questa aritmetica divergessero, il test
//    diventerebbe rosso — che è precisamente il suo mestiere.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  backendFinto,
  costruisci,
  avviaSito,
  galleriaFinta,
  immagineFinta,
  SITO_FINTO_CON_TESTI,
} from './_sito-di-prova.mjs';

let api;
let sito;

/** Sei foto distinguibili per chiave: la galleria "di prova" del task 4.6. */
const GALLERIA = Array.from({ length: 6 }, (_, i) => immagineFinta(`2026/08/foto-${i + 1}`));

before(async () => {
  api = await backendFinto({ '/api/public/site': SITO_FINTO_CON_TESTI });
  costruisci({ API_INTERNA_URL: api.origine });
  sito = await avviaSito();
});

after(() => {
  sito?.ferma();
  api?.chiudi();
});

/**
 * Le chiavi immagine rese da una pagina, **in ordine di documento e una per tag**.
 *
 * 🔴 Una per tag e non per occorrenza: un `<picture>` ripete la stessa chiave in ogni
 *    `<source>` e nell'`<img>` di ripiego, e contarle tutte darebbe un elenco che cambia quando
 *    cambia il numero di varianti invece di quando cambia la foto. È la stessa normalizzazione
 *    che usa `prove/cattura.mjs` per il confronto prima/dopo.
 */
function chiaviRese(html) {
  const viste = [];
  for (const incontro of html.matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const chiave = incontro[0].match(/\/media\/(.+?)\/\d+\.(?:webp|jpg)/);
    if (chiave && viste.at(-1) !== chiave[1]) viste.push(chiave[1]);
  }
  return viste;
}

/** Rende la galleria indicata e restituisce le chiavi rese dalla pagina. */
async function chiaviDi(percorso, immagini) {
  api.stato.risposte['/api/public/galleria'] = galleriaFinta(immagini);
  const risposta = await fetch(`${sito.base}${percorso}`);
  return { stato: risposta.status, chiavi: chiaviRese(await risposta.text()) };
}

const chiave = (immagine) => immagine.chiave;

// ─────────────────────────────────────────────────────────────────────────────────────────
//  La galleria di prova — sei foto, slot vuoti
// ─────────────────────────────────────────────────────────────────────────────────────────

test('🔴 `/` rende eroe e griglia come li rendeva l’aritmetica di prima', async () => {
  // Era: `const [eroe, ...altre] = galleria; const griglia = altre.slice(0, 3)`.
  const atteso = [GALLERIA[0], ...GALLERIA.slice(1, 4)].map(chiave);

  const { stato, chiavi } = await chiaviDi('/', GALLERIA);

  assert.equal(stato, 200);
  // ⚠️ Le foto dei **prodotti** (i pannelli dei momenti) non entrano qui: il catalogo di questo
  //    file non ne ha, e la home mostra quindi le sole immagini della galleria. È voluto — la
  //    sostituzione non doveva toccare i `<picture>` dei momenti, e se li avesse toccati questo
  //    elenco conterrebbe chiavi che nessuno ha messo in galleria.
  assert.deepEqual(chiavi, atteso);
});

test('`/menu` rende le prime tre della galleria, come `slice(0, 3)`', async () => {
  const atteso = GALLERIA.slice(0, 3).map(chiave);

  const { stato, chiavi } = await chiaviDi('/menu', GALLERIA);

  assert.equal(stato, 200);
  assert.deepEqual(chiavi, atteso);
});

test('`/locale` rende ritratto e quadrate come `[1] ?? [0]` e `slice(2, 5)`', async () => {
  const atteso = [GALLERIA[1], ...GALLERIA.slice(2, 5)].map(chiave);

  const { stato, chiavi } = await chiaviDi('/locale', GALLERIA);

  assert.equal(stato, 200);
  assert.deepEqual(chiavi, atteso);
});

test('🔴 `/aperitivo` a slot vuoto non rende ALCUNA immagine di testata', async () => {
  // Era `galleria.at(-1)`, cioè `2026/08/foto-6`. L'attesa è **riscritta**, non allentata: si
  // afferma l'assenza, e un giorno in cui il ripiego rientrasse dalla finestra questo test
  // sarebbe rosso nominando la foto ricomparsa.
  const { stato, chiavi } = await chiaviDi('/aperitivo', GALLERIA);

  assert.equal(stato, 200, 'la pagina esiste: manca l’immagine, non il contenuto');
  assert.deepEqual(
    chiavi,
    [],
    'l’eroe dell’aperitivo non ha ripiego posizionale: a slot vuoto la pagina esce senza ' +
      'immagine di testata. Vedi RuoliImmaginiVetrina e il task 2.2.'
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────
//  Le due dimensioni che il dato reale contiene — e che nessun test copriva
// ─────────────────────────────────────────────────────────────────────────────────────────

test('🔴 con UNA sola foto — lo stato della produzione — la stessa compare su home e locale', async () => {
  // È lo stato misurato al task 0.3, non un caso limite teorico: con una foto sola l'eroe della
  // home e il ritratto del locale sono **la stessa immagine**, `/menu` ne mostra una, e le due
  // griglie sono **vuote**. Il test lo afferma invece di subirlo.
  const una = [immagineFinta('2026/08/unica')];

  const home = await chiaviDi('/', una);
  const menu = await chiaviDi('/menu', una);
  const locale = await chiaviDi('/locale', una);
  const aperitivo = await chiaviDi('/aperitivo', una);

  assert.deepEqual(home.chiavi, ['2026/08/unica'], 'eroe sì, griglia vuota');
  assert.deepEqual(menu.chiavi, ['2026/08/unica']);
  assert.deepEqual(locale.chiavi, ['2026/08/unica'], 'ritratto sì, quadrate vuote');
  assert.deepEqual(aperitivo.chiavi, [], 'e l’aperitivo resta scoperto');
});

test('con ZERO foto nessuna delle quattro pagine rende immagini, e nessuna rompe', async () => {
  for (const percorso of ['/', '/menu', '/locale', '/aperitivo']) {
    const { stato, chiavi } = await chiaviDi(percorso, []);
    assert.equal(stato, 200, `${percorso} non risponde 200 con la galleria vuota`);
    assert.deepEqual(chiavi, [], `${percorso} rende immagini con la galleria vuota`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
//  Ciò che la lettura per nome compra
// ─────────────────────────────────────────────────────────────────────────────────────────

test('🔴 con gli slot valorizzati le pagine seguono la SCELTA, non la posizione', async () => {
  // È la proprietà che l'aritmetica sugli indici non poteva avere, ed è il motivo del change:
  // la stessa galleria, ordine invariato, e ogni pagina mostra ciò che l'amministratore ha
  // scelto. Nessun `.astro` sa che esiste uno slot — legge un nome.
  api.stato.risposte['/api/public/galleria'] = galleriaFinta(GALLERIA, {
    eroeHome: GALLERIA[4],
    grigliaHome: [GALLERIA[0], GALLERIA[1], GALLERIA[2]],
    ritrattoLocale: GALLERIA[5],
    quadrateLocale: [GALLERIA[0]],
    eroeAperitivo: GALLERIA[3],
  });

  const home = chiaviRese(await (await fetch(`${sito.base}/`)).text());
  const locale = chiaviRese(await (await fetch(`${sito.base}/locale`)).text());
  const aperitivo = chiaviRese(await (await fetch(`${sito.base}/aperitivo`)).text());

  assert.deepEqual(home, [
    '2026/08/foto-5',
    '2026/08/foto-1',
    '2026/08/foto-2',
    '2026/08/foto-3',
  ]);
  assert.deepEqual(locale, ['2026/08/foto-6', '2026/08/foto-1']);
  assert.deepEqual(aperitivo, ['2026/08/foto-4']);
});

test('⚠️ se la galleria non si legge, le pagine escono senza foto e non rompono', async () => {
  // `RUOLI_VUOTI` non è un ripiego editoriale: è la forma vuota, e serve perché le quattro
  // pagine possano scrivere `ruoli.eroeHome` senza un `?.` per ogni ruolo. Un backend che
  // risponde 500 sulla galleria non deve produrre un 500 servito al visitatore.
  api.stato.risposte['/api/public/galleria'] = 500;

  for (const percorso of ['/', '/menu', '/locale', '/aperitivo']) {
    const risposta = await fetch(`${sito.base}${percorso}`);
    assert.equal(risposta.status, 200, `${percorso} non sopravvive alla galleria assente`);
    assert.deepEqual(chiaviRese(await risposta.text()), []);
  }

  api.stato.risposte['/api/public/galleria'] = galleriaFinta();
});
