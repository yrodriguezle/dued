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
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { radiceSito } from './_scansione.mjs';

let base = '';
let server;
let html = '';

function portaLibera() {
  return new Promise((risolvi) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => risolvi(port));
    });
  });
}

async function scarica(intestazioni = {}) {
  const r = await fetch(base, { headers: intestazioni });
  return Buffer.from(await r.arrayBuffer());
}

before(async () => {
  execFileSync('npx', ['astro', 'build'], { cwd: radiceSito, shell: true, stdio: 'pipe' });

  const porta = await portaLibera();
  server = spawn(process.execPath, ['dist/server/entry.mjs'], {
    cwd: radiceSito,
    env: {
      ...process.env,
      PORT: String(porta),
      HOST: '127.0.0.1',
      // Il server legge il backend in HTTPS: senza la CA la pagina nascerebbe degradata, e
      // le prove girerebbero su un HTML che non è quello vero.
      NODE_EXTRA_CA_CERTS: join(radiceSito, '..', 'backend', '.certs', 'aspnet-dev.pem'),
    },
    stdio: 'ignore',
  });
  base = `http://127.0.0.1:${porta}/`;

  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(base);
      if (r.ok) {
        html = await r.text();
        return;
      }
    } catch {
      /* non ancora in ascolto */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`il server di prova non ha risposto su ${base}`);
});

after(() => server?.kill());

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
  assert.ok(!/aperto ora|chiuso ora/i.test(corpo), 'lo stato è già deciso nel markup');

  // L'elemento che le ospiterà è servito nascosto: niente salto di layout quando compare.
  assert.match(corpo, /id="stato-apertura"[^>]*hidden/);

  // Gli orari invece ci sono: sono dato, non orologio.
  assert.match(corpo, /\d{2}:\d{2}/, 'gli orari non sono stati resi dal server');
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
