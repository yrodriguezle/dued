// Le regole delle immagini che **nessun comportamento osservabile rivelerebbe**.
//
// Un `<Image>` di `astro:assets` al posto del `<picture>` funzionerebbe: la pagina si vede,
// le foto caricano. Il costo — l'ottimizzazione rifatta a runtime su file già ottimizzati,
// le origini remote da autorizzare una per una, e `sharp` con i suoi binari nativi dentro il
// container — non produce nulla che si veda guardando il sito. Per questo è pinnato.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sorgenti, senzaCommenti, radiceSito, sorgentiCheContengono } from './_scansione.mjs';

/** Il testo di un sorgente senza commenti — la stessa cautela sui falsi positivi di sempre. */
function pulito(percorso) {
  return senzaCommenti(readFileSync(join(radiceSito, percorso), 'utf8'));
}

test("🔴 il componente immagine del framework non compare nei sorgenti", () => {
  const colpevoli = sorgenti().filter((p) => {
    const testo = pulito(p);
    return /astro:assets/.test(testo) || /<Image[\s/>]/.test(testo);
  });
  assert.deepEqual(
    colpevoli,
    [],
    `${colpevoli.join(', ')} usa <Image> di astro:assets. Rifarebbe a runtime ciò che il ` +
      'backend ha già fatto, e porterebbe sharp con i suoi binari nel container.'
  );
});

test('nessuna libreria di elaborazione immagini fra le NOSTRE dipendenze', () => {
  const pkg = JSON.parse(readFileSync(join(radiceSito, 'package.json'), 'utf8'));
  const tutte = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const vietata of ['sharp', 'imagemin', 'jimp', '@squoosh/lib']) {
    assert.ok(!(vietata in tutte), `${vietata} è fra le dipendenze dichiarate`);
  }
});

test('⚠️ sharp arriva comunque con Astro, ed è OPZIONALE — misurato, non dedotto', () => {
  // 🔴 Correzione a §D12, che dava per scontato il contrario. Non usare `<Image>` NON tiene
  //    sharp fuori dall'albero: `astro@7.2.1` lo dichiara fra le `optionalDependencies`, e
  //    un `npm install` normale lo installa insieme ai binari nativi di ogni piattaforma —
  //    **29 MB** misurati (1,1 MB in `sharp`, 28 MB in `@img`).
  //
  //    Ciò che si guadagna evitando `<Image>` resta vero ed è un'altra cosa: sharp non viene
  //    mai CARICATO a runtime, e — poiché è opzionale — l'immagine del container di Fase 6
  //    può ometterlo del tutto con `npm ci --omit=optional`. È un guadagno che si incassa
  //    solo se qualcuno scrive quel flag, ed è per questo che questo test esiste: perché
  //    quella riga abbia un posto da cui essere ricordata.
  const lock = JSON.parse(readFileSync(join(radiceSito, 'package-lock.json'), 'utf8'));
  const sharp = lock.packages['node_modules/sharp'];
  assert.ok(sharp, 'sharp non è più nell\'albero: Astro ha smesso di dichiararlo?');
  assert.equal(
    sharp.optional,
    true,
    'sharp non è più opzionale: `npm ci --omit=optional` non basterebbe più a tenerlo ' +
      'fuori dal container, e la scelta di non usare <Image> perderebbe metà del suo valore.'
  );
});

test('nessuna autorizzazione di origini remote nella configurazione', () => {
  const config = senzaCommenti(readFileSync(join(radiceSito, 'astro.config.mjs'), 'utf8'));
  for (const chiave of ['image:', 'domains', 'remotePatterns']) {
    assert.ok(!config.includes(chiave), `astro.config.mjs contiene «${chiave}»`);
  }
});

test('🔴 nessun formato inventato: solo i due che il backend genera', () => {
  // Il backend produce `{larghezza}.webp` e `{larghezza}.jpg` per ogni variante, e basta.
  // Un `.avif` scritto qui perché «è più moderno» è un 404 per ogni immagine del sito, in
  // un ramo di `<picture>` che il browser prova per primo proprio perché lo preferisce.
  const colpevoli = [];
  for (const percorso of sorgenti()) {
    const testo = pulito(percorso);
    for (const formato of ['avif', 'jxl', 'heic', 'png']) {
      if (new RegExp(`image/${formato}|'${formato}'|"${formato}"`).test(testo)) {
        colpevoli.push(`${percorso} (${formato})`);
      }
    }
  }
  assert.deepEqual(colpevoli, [], `formati che il backend non genera: ${colpevoli.join(', ')}`);
});

test('la dimensione di resa compare su ENTRAMBE le sorgenti', () => {
  // `sizes` sulla sola `<img>` lascia la `<source type="image/webp">` a `100vw` — cioè il
  // ramo che i browser moderni scelgono per primo, che è quasi tutti.
  const componente = readFileSync(join(radiceSito, 'src/components/Immagine.astro'), 'utf8');
  const source = componente.match(/<source[^>]*>/s);
  const img = componente.match(/<img[\s\S]*?\/>/);
  assert.ok(source && /sizes=/.test(source[0]), '<source> senza sizes');
  assert.ok(img && /sizes=/.test(img[0]), '<img> senza sizes');
});

test('nessun default per sizes nel componente', () => {
  const componente = senzaCommenti(
    readFileSync(join(radiceSito, 'src/components/Immagine.astro'), 'utf8')
  );
  assert.ok(
    !/sizes\s*=\s*['"]/.test(componente.match(/const \{[^}]*\}\s*=\s*Astro\.props/s)?.[0] ?? ''),
    'sizes ha un default nella destrutturazione: il componente non può indovinare il layout ' +
      'di chi lo usa, e un default silenzioso che triplica il peso della pagina è peggio di ' +
      'un errore di compilazione.'
  );
});

test('🔴 il logo entra nel DOM come markup, non come risorsa', () => {
  const logo = readFileSync(join(radiceSito, 'src/components/Logo.astro'), 'utf8');
  assert.ok(logo.includes('?raw'), "l'SVG non è importato come stringa");
  assert.ok(logo.includes('set:html'), "l'SVG non è inserito nel DOM come markup");
  assert.ok(
    !/<img[\s>]/.test(senzaCommenti(logo)),
    'il logo è dentro un <img>: un SVG lì è un documento isolato, currentColor si risolve ' +
      'al nero, e il segno sparisce sul fondo lavagna del registro serale. Senza errori.'
  );

  // E i due file importati sono quelli scritti per essere inline: hanno currentColor.
  for (const nome of ['logo-2dgusto.svg', 'monogramma-2d.svg']) {
    const svg = readFileSync(join(radiceSito, 'src/assets', nome), 'utf8');
    assert.ok(svg.includes('currentColor'), `${nome} non usa currentColor: inlinearlo non serve`);
  }
});

test('i file serviti verbatim stanno ai loro percorsi, e il robots è permissivo', () => {
  // Il browser li cerca a URL fisse: un hash di contenuto li renderebbe introvabili, ed è
  // la ragione per cui questi quattro stanno in `public/` e il logo no.
  for (const nome of ['favicon.svg', 'apple-touch-icon.png', 'og-default.jpg', 'robots.txt']) {
    assert.ok(
      readFileSync(join(radiceSito, 'public', nome)).length > 0,
      `manca public/${nome}`
    );
  }
  const robots = readFileSync(join(radiceSito, 'public/robots.txt'), 'utf8');
  assert.ok(
    !/^\s*Disallow:\s*\/\s*$/m.test(robots),
    'robots.txt vieta tutto: il Disallow va sull\'host dell\'app di cassa, non su questo — ' +
      'qui deindicizzerebbe il sito che stiamo costruendo.'
  );
  assert.match(robots, /Allow:\s*\//);
});

test('solo un sottoinsieme del master di marca è stato copiato', () => {
  // `docs/brand/` è il master e resta invariato: è la ragione per cui `rm -rf sito/` non fa
  // perdere alcun asset. Se qui comparisse un file che lì non c'è, il master non sarebbe più
  // il master.
  const copiati = ['logo-2dgusto.svg', 'monogramma-2d.svg'];
  for (const nome of copiati) {
    const qui = readFileSync(join(radiceSito, 'src/assets', nome));
    const master = readFileSync(join(radiceSito, '..', 'docs', 'brand', nome));
    assert.ok(qui.equals(master), `${nome} diverge dal master di docs/brand/`);
  }
});

test('la composizione degli URL resta nel modulo dedicato', () => {
  // Controllo incrociato con moduli.test.mjs: i componenti chiamano mediaUrl/srcSet, non
  // compongono a mano. Se un giorno qualcuno lo facesse, il test dell'unicità lo direbbe —
  // questo dice che sta usando la strada giusta.
  const componente = pulito('src/components/Immagine.astro');
  assert.ok(componente.includes('mediaUrl(') && componente.includes('srcSet('));
  assert.deepEqual(sorgentiCheContengono('/media/'), ['src/lib/mediaUrl.ts']);
});
