// I tre caratteri sono nostri, e il preload punta al file che il CSS chiede davvero.
//
// 🔴 Questo test costruisce E AVVIA il sito, perché le due cose da confrontare vivono in
//    posti diversi: l'`href` del preload sta nell'HTML, che con `output: 'server'` viene
//    generato a ogni richiesta e non esiste come file; l'`url()` sta nel CSS, che è un
//    artefatto. Confrontarli è l'unico modo di vedere la trappola: se il preload puntasse
//    a un percorso scritto a mano, il browser scaricherebbe DUE file e il preload
//    comparirebbe negli strumenti come «inutile» invece che come sbagliato — cioè verrebbe
//    tolto, che è la reazione opposta a quella giusta.
//
// Nessun browser: `fetch` e basta. Il browser serve alla prova 5.8, che è un'altra cosa.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { radiceSito } from './_scansione.mjs';

const DOMINI_ESTERNI = ['fonts.gstatic.com', 'fonts.googleapis.com'];

let html = '';
let css = '';
let server;

function portaLibera() {
  return new Promise((risolvi) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => risolvi(port));
    });
  });
}

/** Attende che il server risponda, invece di dormire un tempo scelto a caso. */
async function attendi(url, tentativi = 60) {
  for (let i = 0; i < tentativi; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r.text();
    } catch {
      /* non ancora in ascolto */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`il server di prova non ha risposto su ${url}`);
}

before(async () => {
  execFileSync('npx', ['astro', 'build'], { cwd: radiceSito, shell: true, stdio: 'pipe' });

  const cartella = join(radiceSito, 'dist/client/_astro');
  css = readdirSync(cartella)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(join(cartella, f), 'utf8'))
    .join('\n');

  const porta = await portaLibera();
  // ⚠️ Node direttamente, non `npm`: il bundle standalone è già un server.
  server = spawn(process.execPath, ['dist/server/entry.mjs'], {
    cwd: radiceSito,
    env: { ...process.env, PORT: String(porta), HOST: '127.0.0.1' },
    stdio: 'ignore',
  });
  html = await attendi(`http://127.0.0.1:${porta}/`);
});

after(() => server?.kill());

test('🔴 l\'URL del preload è la STESSA che il CSS richiede', () => {
  const preload = html.match(/<link[^>]+rel="preload"[^>]+href="([^"]+)"[^>]*>/);
  assert.ok(preload, 'nessun <link rel="preload"> nell\'HTML servito');

  const daCss = css.match(/url\((\/[^)]*Anton[^)]*\.woff2)\)/);
  assert.ok(daCss, 'il CSS non chiede alcun file di Anton');

  assert.equal(
    preload[1],
    daCss[1],
    'il preload punta a un file diverso da quello che il CSS chiede: il browser ne ' +
      'scaricherebbe due. Il percorso va importato con `?url`, mai scritto a mano — Vite ' +
      'ci mette un hash di contenuto che cambia a ogni modifica del file.'
  );
  // La prova che l'hash c'è davvero, cioè che il confronto sopra non è fra due stringhe
  // scritte a mano identiche per caso.
  assert.match(preload[1], /Anton-latin\.[A-Za-z0-9_-]{6,}\.woff2$/);
});

test('🔴 il preload porta crossorigin', () => {
  const tag = html.match(/<link[^>]+rel="preload"[^>]*>/)[0];
  assert.match(
    tag,
    /\scrossorigin/,
    'senza crossorigin il preload NON viene riusato: i caratteri si recuperano in modalità ' +
      'CORS anche same-origin, e il file si scarica due volte.'
  );
  assert.match(tag, /as="font"/);
  assert.match(tag, /type="font\/woff2"/);
});

test('un solo preload di carattere: Allura e Playfair non si preloadano', () => {
  const preloads = [...html.matchAll(/<link[^>]+rel="preload"[^>]*>/g)].map((m) => m[0]);
  const diFont = preloads.filter((t) => t.includes('as="font"'));
  assert.equal(
    diFont.length,
    1,
    `preload di carattere trovati: ${diFont.length}. Solo Anton è sopra la piega; gli altri ` +
      'due sono decorativi e ruberebbero banda a ciò che serve per leggere.'
  );
});

test('i domini dei font esterni non compaiono in nessun file generato', () => {
  const file = [];
  const cammina = (cartella) => {
    for (const voce of readdirSync(cartella)) {
      const percorso = join(cartella, voce);
      if (statSync(percorso).isDirectory()) cammina(percorso);
      else if (/\.(html|css|js|mjs|json)$/.test(voce)) file.push(percorso);
    }
  };
  cammina(join(radiceSito, 'dist'));

  const colpevoli = file.filter((f) => {
    const testo = readFileSync(f, 'utf8');
    return DOMINI_ESTERNI.some((d) => testo.includes(d));
  });
  assert.deepEqual(colpevoli, [], `questi file nominano un CDN di caratteri: ${colpevoli}`);

  // E anche nell'HTML servito, che non è un file di `dist`.
  for (const dominio of DOMINI_ESTERNI) assert.ok(!html.includes(dominio));
});

test('i tre file sono in albero, con licenza e provenienza', () => {
  const cartella = join(radiceSito, 'src/assets/fonts');
  const attesi = {
    'Anton-latin.woff2': 18612,
    'Allura-latin.woff2': 26488,
    'PlayfairDisplay-900-latin.woff2': 22372,
  };
  let totale = 0;
  for (const [nome, byte] of Object.entries(attesi)) {
    const percorso = join(cartella, nome);
    assert.ok(existsSync(percorso), `manca ${nome}`);
    assert.equal(statSync(percorso).size, byte, `${nome} ha una dimensione inattesa`);
    totale += byte;
  }
  assert.equal(totale, 67472);

  // 🔴 La licenza RICHIEDE di accompagnare i file: non è documentazione, è una condizione
  //    della redistribuzione. E senza PROVENIENZA.md le URL — che sono opache — sarebbero
  //    da riscoprire invece che da rifare.
  assert.ok(existsSync(join(cartella, 'OFL.txt')), 'manca OFL.txt');
  assert.ok(existsSync(join(cartella, 'PROVENIENZA.md')), 'manca PROVENIENZA.md');
});

test('il corpo non scarica alcun file: nessun @font-face per lo stack di sistema', () => {
  const sorgente = readFileSync(join(radiceSito, 'src/styles/global.css'), 'utf8');
  const famiglie = [...sorgente.matchAll(/@font-face\s*\{[^}]*font-family:\s*'([^']+)'/g)].map(
    (m) => m[1]
  );
  assert.deepEqual(famiglie.sort(), ['Allura', 'Anton', 'Playfair Display']);
});

test("l'intervallo Unicode copre ciò che il sito scrive", () => {
  const sorgente = readFileSync(join(radiceSito, 'src/styles/global.css'), 'utf8');
  const intervalli = [...sorgente.matchAll(/unicode-range:([^;]+);/g)].map((m) =>
    m[1].replace(/\s+/g, ' ').trim()
  );
  assert.equal(intervalli.length, 3, 'ogni @font-face deve dichiarare il suo intervallo');
  for (const intervallo of intervalli) {
    // Le accentate italiane, l'apostrofo tipografico e il grado stanno nei primi due;
    // 🔴 l'euro sta a parte, e senza sarebbero i PREZZI a non avere glifo.
    assert.ok(intervallo.includes('U+0000-00FF'), `manca il latino base: ${intervallo}`);
    assert.ok(intervallo.includes('U+2000-206F'), `mancano apostrofi e trattini`);
    assert.ok(intervallo.includes('U+20AC'), "manca l'euro: sarebbero i prezzi");
  }
});
