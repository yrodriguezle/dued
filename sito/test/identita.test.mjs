// 🔴 Il server emette UNA SOLA PAGINA, priva di tema — quattro asserzioni, e solo una conta.
//
// Le prime tre escludono che la risposta dipenda dal lettore (orologio, cookie, header). La
// quarta esclude il guasto vero: un `data-tema` scritto dal server sul tag radice. Le prime
// tre **passano lo stesso** se il server scrive sempre lo stesso tema — ed è precisamente
// il caso che si verifica in sviluppo, dove chi prova la pagina la prova sempre alla stessa
// ora del giorno. La controprova del task 6.8 lo dimostra per mutazione.
//
// Perché importa: davanti a queste pagine ci sarà un micro-cache. Una risposta che dipende
// dal lettore o frammenta la chiave o serve a metà dei visitatori il tema di chi ha
// riempito la cache.
//
// ⚠️ Tutte le asserzioni sono RICERCHE DI SOTTOSTRINGA, mai confronti su righe o
//    indentazione: in Astro 7 `compressHTML: 'jsx'` è il default. La compressione è
//    deterministica — quindi l'identità byte per byte regge — ma il markup non ha più
//    l'indentazione su cui si sarebbe tentati di asserire.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { radiceSito } from './_scansione.mjs';
import { backendFinto, costruisci, avviaSito } from './_sito-di-prova.mjs';

let base = '';
let api;
let sito;
let html = '';

async function scarica(intestazioni = {}) {
  const r = await fetch(base, { headers: intestazioni });
  return Buffer.from(await r.arrayBuffer());
}

before(async () => {
  // ⚠️ **Il backend FINTO, non quello di sviluppo su :4000.** Fino al redesign questa prova
  //    leggeva il backend vero, e la cosa si è rivelata una trappola precisa: il giorno in
  //    cui il DTO pubblico è cresciuto, l'istanza che l'utente aveva acceso da prima —
  //    quindi con lo schema vecchio — ha fatto nascere la pagina **degradata**, e le
  //    asserzioni fallivano dicendo «gli orari non sono stati resi dal server». Il guasto
  //    non era nel sito: era che la prova dipendeva da quale build stava girando su un'altra
  //    finestra. È lo stesso motivo per cui le altre prove della suite non lo usano.
  api = await backendFinto();
  costruisci({ API_INTERNA_URL: api.origine });
  sito = await avviaSito();
  base = `${sito.base}/`;
  html = await (await fetch(base)).text();
});

after(() => {
  sito?.ferma();
  api?.chiudi();
});

test('1 — due richieste a cavallo di un minuto sono identiche byte per byte', async () => {
  // ⚠️ Non due richieste ravvicinate: DUE MINUTI DIVERSI. Una stringa che dipende
  //    dall'orologio — "aperto ora" reso server-side è l'esempio del design — sopravvive a
  //    due `fetch` a un secondo di distanza e muore qui.
  //    Il costo è l'attesa fino al minuto successivo (≤ 60 s, in media 30). È il prezzo
  //    dell'unica prova che vede davvero quel guasto.
  const prima = await scarica();
  const alMinutoDopo = 60_000 - (Date.now() % 60_000) + 500;
  await new Promise((r) => setTimeout(r, alMinutoDopo));
  const dopo = await scarica();

  assert.ok(
    prima.equals(dopo),
    `le due risposte differiscono (${prima.length} vs ${dopo.length} byte): qualcosa nella ` +
      "pagina dipende dall'orologio del server. Gli orari sono dato e vanno resi; lo stato " +
      "di apertura è orologio e va calcolato nel browser."
  );
});

test('2 — il cookie del tema non cambia la risposta', async () => {
  const sera = await scarica({ Cookie: 'tema=sera' });
  const giorno = await scarica({ Cookie: 'tema=giorno' });
  assert.ok(
    sera.equals(giorno),
    'il server legge il tema da un cookie: la cache andrebbe frammentata con Vary: Cookie, ' +
      'che in pratica disattiva ogni cache condivisa.'
  );
});

test('3 — l\'header di preferenza non cambia la risposta', async () => {
  const scuro = await scarica({ 'Sec-CH-Prefers-Color-Scheme': 'dark' });
  const chiaro = await scarica({ 'Sec-CH-Prefers-Color-Scheme': 'light' });
  assert.ok(
    scuro.equals(chiaro),
    'il server negozia il tema dagli header: due varianti in cache per ogni URL.'
  );
});

test('4 🔴 — il tag radice non porta il tema, e l\'attributo compare una volta sola', () => {
  // È l'unica delle quattro che vede il guasto vero. Le altre tre passano anche se il
  // server scrive SEMPRE `data-tema="giorno"`.
  const tagRadice = html.match(/<html[^>]*>/)[0];
  assert.ok(
    !tagRadice.includes('data-tema'),
    `il tag radice porta il tema: ${tagRadice}. Deciderlo sul server significa servirlo ` +
      'dalla cache a chi lo apre in un altro momento della giornata.'
  );

  // L'attributo esiste nello script — è lui a scriverlo — e questa è la prova che il test
  // sta guardando la cosa giusta: se sparisse da lì, la pagina non avrebbe più un tema.
  const script = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(script, 'nessuno script inline nella pagina');
  assert.ok(
    script[1].includes('data-tema'),
    "lo script inline non scrive l'attributo del tema: la pagina resterebbe senza registro"
  );

  // ⚠️ E le occorrenze FUORI dallo script possono esistere, ma solo dentro il corpo e solo
  //    su elementi ANNIDATI. È la fascia "Aperitivo", che sta sempre in registro sera
  //    qualunque sia il tema della pagina — ed è l'unico posto in cui la differenza fra
  //    `@theme` e `@theme inline` si vede a occhio.
  //
  //    Il testo della spec dice «l'attributo compare una volta sola nell'intero documento»,
  //    e quella lettera è incompatibile con la fascia, che la STESSA spec pretende. Il
  //    conflitto è solo apparente: ciò che quella frase proteggeva è che il tema non sia una
  //    decisione del SERVER, e la forma che lo protegge davvero è qui sotto.
  const markup = html.replace(/<script>[\s\S]*?<\/script>/g, '');
  const testa = markup.slice(0, markup.indexOf('<body'));
  assert.ok(
    !testa.includes('data-tema'),
    "l'attributo del tema compare nel <head> fuori dallo script: è una decisione del server"
  );
  for (const tag of markup.match(/<[a-z]+[^>]*data-tema[^>]*>/g) ?? []) {
    assert.ok(
      !tag.startsWith('<html'),
      `l'attributo del tema è sul tag radice: ${tag}`
    );
  }
});

test("l'attributo di pronto non è nel markup servito", () => {
  assert.ok(
    !html.includes('data-pronto'),
    'data-pronto è nel markup: lo aggiunge lo script al frame successivo, e serve solo a ' +
      'spegnere le transizioni fino al primo paint.'
  );
});

test('🔴 lo stato di apertura non compare nel corpo, gli orari sì', () => {
  // ⚠️ Si guarda il CORPO: le due parole esistono nello script (è lui a scriverle), e
  //    cercarle in tutto il documento renderebbe questa prova impossibile da soddisfare.
  const corpo = html.slice(html.indexOf('<body'));

  // Il contenitore del testo è servito VUOTO: è lui a ricevere «Aperto · fino alle 20:00».
  const testoStato = corpo.match(/id="stato-testo"[^>]*>([^<]*)</);
  assert.ok(testoStato, 'manca il contenitore del testo di stato');
  assert.equal(
    testoStato[1].trim(),
    '',
    `il server ha già scritto lo stato («${testoStato[1]}»): finirebbe nel micro-cache e ` +
      'verrebbe servito a chi apre la pagina in un altro momento della giornata'
  );

  // ⚠️ La pastiglia è servita TRASPARENTE con la larghezza già riservata, e non con
  //    `hidden`, come faceva la versione precedente. Non è un dettaglio di stile: dal
  //    redesign quell'elemento sta nell'intestazione, in mezzo al bottone del tema e al
  //    richiamo. Con `display:none` l'accensione li farebbe slittare — uno spostamento di
  //    layout nel punto più guardato della pagina, e dopo il primo paint, cioè quello che
  //    pesa di più nella metrica.
  const pastiglia = corpo.match(/<span[^>]*id="stato-apertura"[^>]*>/)[0];
  assert.match(pastiglia, /opacity-0/, 'la pastiglia di stato è servita già visibile');
  assert.match(
    pastiglia,
    /min-w-\[/,
    'la pastiglia non riserva la propria larghezza: accendendosi sposterebbe il resto ' +
      "dell'intestazione"
  );

  // Gli orari invece ci sono: sono dato, non orologio.
  assert.match(corpo, /\d{2}:\d{2}/, 'gli orari non sono stati resi dal server');
});

test('🔴 nemmeno la scelta del registro è nel markup servito', () => {
  // `data-scelta` è il secondo attributo che lo script scrive sulla radice — è quello che
  // permette al CSS di dipingere l'icona giusta del selettore prima del primo paint. Vale la
  // stessa regola di `data-tema`: deciderlo sul server significa servirlo dalla cache a chi
  // ha una preferenza diversa.
  const tagRadice = html.match(/<html[^>]*>/)[0];
  assert.ok(!tagRadice.includes('data-scelta'), `il tag radice porta la scelta: ${tagRadice}`);

  const markup = html.replace(/<script>[\s\S]*?<\/script>/g, '');
  assert.ok(
    !markup.slice(0, markup.indexOf('<body')).includes('data-scelta'),
    "la scelta del registro compare nel <head> fuori dallo script: è una decisione del server"
  );
});

test("l'etichetta del toggle servita è neutra", () => {
  const corpo = html.slice(html.indexOf('<body'));
  const etichetta = corpo.match(/id="tema-etichetta"[^>]*>([^<]*)</);
  assert.ok(etichetta, 'nessuna etichetta del toggle nel markup');
  assert.ok(
    !/giorno|sera|auto/i.test(etichetta[1]),
    `l'etichetta servita è «${etichetta[1]}»: rivela lo stato, e lo stato è client-side — ` +
      'finirebbe in cache e verrebbe servita a chi apre la pagina in un altro momento.'
  );
});

test('nessun runtime di framework UI nel bundle del client', () => {
  const cartella = join(radiceSito, 'dist/client');
  const file = [];
  const cammina = (c) => {
    for (const v of readdirSync(c)) {
      const p = join(c, v);
      if (statSync(p).isDirectory()) cammina(p);
      else if (v.endsWith('.js') || v.endsWith('.mjs')) file.push(p);
    }
  };
  cammina(cartella);
  for (const f of file) {
    const testo = readFileSync(f, 'utf8');
    for (const spia of ['react-dom', 'createElement', 'preact', 'Vue', 'svelte']) {
      assert.ok(!testo.includes(spia), `${f} contiene «${spia}»: il toggle è vanilla`);
    }
  }
});
