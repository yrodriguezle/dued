// Le due decisioni invisibili del design system, provate sul **CSS generato**.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// PERCHÉ QUESTO TEST COSTRUISCE IL SITO INVECE DI LEGGERE UN FILE
//
// Le cose che deve dimostrare non esistono nel sorgente: `@theme inline` e `@theme` sono
// due righe quasi identiche, e la differenza compare **solo** in ciò che Tailwind emette.
// Leggere `global.css` proverebbe che abbiamo scritto la parola `inline`, che è la cosa
// che sappiamo già.
//
// ⚠️ E il CSS non esiste finché qualcosa non usa quelle classi: la generazione è on-demand.
//    Il test scrive quindi una PAGINA SONDA che le usa tutte, costruisce, legge, e la
//    cancella. È deliberato che la sonda non resti nell'albero: se restasse, il CSS
//    spedito conterrebbe per sempre utility che nessuna pagina usa, e la prova avrebbe
//    cambiato il prodotto per potersi eseguire.
//
// ⚠️ Il nome della sonda NON può iniziare con `_`: Astro esclude dal routing i file che lo
//    fanno, la pagina non verrebbe costruita, e il CSS non verrebbe emesso affatto — un
//    fallimento che si presenta come «nessun file CSS trovato» e manda a cercare altrove.
// ─────────────────────────────────────────────────────────────────────────────────────

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { radiceSito } from './_scansione.mjs';

const SONDA = join(radiceSito, 'src/pages/sonda-css.astro');

/** Usa ogni token in ogni famiglia, così il CSS emesso è completo. */
const PAGINA_SONDA = `---
import '../styles/global.css';
---
<html lang="it"><body class="bg-sfondo text-inchiostro border-bordo font-titolo">
  <span class="bg-sfondo-alt bg-superficie bg-accento text-inchiostro-tenue text-accento border-inchiostro"></span>
  <span class="bg-arancio border-arancio fill-arancio font-firma font-insegna font-corpo"></span>
  <span class="text-arancio sera:bg-superficie"></span>
</body></html>
`;

let css = '';

before(() => {
  writeFileSync(SONDA, PAGINA_SONDA);
  try {
    execFileSync('npx', ['astro', 'build'], {
      cwd: radiceSito,
      shell: true,
      stdio: 'pipe',
    });
  } finally {
    rmSync(SONDA, { force: true });
  }

  const cartella = join(radiceSito, 'dist/client/_astro');
  assert.ok(existsSync(cartella), `la build non ha prodotto asset in ${cartella}`);
  const fogli = readdirSync(cartella).filter((f) => f.endsWith('.css'));
  assert.ok(fogli.length > 0, 'nessun foglio di stile nel build: la sonda non è stata costruita');
  css = fogli.map((f) => readFileSync(join(cartella, f), 'utf8')).join('\n');
});

after(() => rmSync(SONDA, { force: true }));

test('🔴 le utility di colore inlinano il token di RUNTIME', () => {
  // Positiva: la classe punta a --c-sfondo, il nome che i sottoalberi riassegnano.
  assert.match(
    css,
    /\.bg-sfondo\s*\{[^}]*var\(--c-sfondo\)/,
    '.bg-sfondo non punta al token di runtime'
  );

  // 🔴 NEGATIVA, ed è questa a portare l'informazione. Con `@theme` semplice il valore
  //    passerebbe per --color-sfondo, dichiarata su :root con il valore letto in quel
  //    momento: ALLA RADICE il risultato sarebbe IDENTICO, e la pagina sembrerebbe
  //    perfetta. Si romperebbe solo dentro un sottoalbero con un tema proprio — la fascia
  //    "Aperitivo" in home — restando crema invece che lavagna, senza alcun errore da
  //    nessuna parte. Un test con la sola asserzione positiva non vedrebbe niente.
  assert.doesNotMatch(
    css,
    /\.bg-sfondo\s*\{[^}]*var\(--color-sfondo\)/,
    '.bg-sfondo passa per --color-sfondo: manca la parola `inline` in @theme, e la ' +
      'differenza NON si vede alla radice del documento — solo dentro un sottoalbero ' +
      'con data-tema proprio.'
  );
});

test('le sette utility di sfondo, testo e bordo esistono e puntano tutte a --c-*', () => {
  for (const [classe, proprieta, token] of [
    ['bg-sfondo', 'background-color', '--c-sfondo'],
    ['bg-sfondo-alt', 'background-color', '--c-sfondo-alt'],
    ['bg-superficie', 'background-color', '--c-superficie'],
    ['bg-accento', 'background-color', '--c-accento'],
    ['text-inchiostro', 'color', '--c-inchiostro'],
    ['text-inchiostro-tenue', 'color', '--c-inchiostro-tenue'],
    ['text-accento', 'color', '--c-accento'],
    ['border-bordo', 'border-color', '--c-bordo'],
  ]) {
    assert.ok(
      css.includes(`.${classe}{${proprieta}:var(${token})}`),
      `manca o non è inline: .${classe}`
    );
  }
});

test('🔴 la classe di testo arancione NON esiste nel CSS generato', () => {
  // La sonda la scrive (`class="text-arancio"`). Se il token fosse dentro @theme,
  // Tailwind la genererebbe: è precisamente la mutazione del task 4.9.
  assert.doesNotMatch(
    css,
    /\.text-arancio\b/,
    "l'arancio è rientrato nella namespace del tema: `text-arancio` ora esiste, e porta " +
      'testo a contrasto 2.11 sulla crema — sotto persino la soglia del testo grande.'
  );
  // Scriverla non produce alcun effetto: nessuna regola, quindi il testo resta del colore
  // ereditato. Il default del guasto è sicuro.
  assert.ok(!css.includes('text-arancio'));
});

test('le tre utility ammesse dell\'arancio esistono', () => {
  assert.ok(css.includes('.bg-arancio{background-color:var(--c-arancio)}'));
  assert.ok(css.includes('.border-arancio{border-color:var(--c-arancio)}'));
  assert.ok(css.includes('.fill-arancio{fill:var(--c-arancio)}'));
});

test('🔴 la sintesi dei caratteri è disattivata nel CSS generato', () => {
  // Nel generato, non solo nel sorgente: è la differenza fra averlo scritto e averlo
  // spedito. Senza, `font-weight: 700` su Anton — che ha solo il Regular — produce un
  // grassetto finto e diverso in ogni browser.
  assert.match(css, /font-synthesis\s*:\s*none/);
});

test('la variante del registro serale è legata a un attributo, non a una classe', () => {
  assert.match(
    css,
    /\.sera\\:bg-superficie:where\(\[data-tema=["']?sera["']?\][^)]*\)/,
    'la variante `sera:` non è legata a [data-tema="sera"]'
  );
});

test('i due registri dichiarano gli stessi sette nomi', () => {
  // Un token che esistesse in un registro solo produrrebbe un colore che "sparisce"
  // cambiando tema, ereditando il valore della radice senza che nulla lo segnali.
  const blocco = (selettore) => {
    const trovato = css.match(new RegExp(`${selettore}\\{([^}]*--c-[^}]*)\\}`));
    return trovato ? [...trovato[1].matchAll(/--c-[a-z-]+(?=:)/g)].map((m) => m[0]).sort() : null;
  };
  const giorno = blocco('\\:root,\\[data-tema=giorno\\]') ?? blocco('\\[data-tema=giorno\\]');
  const sera = blocco('\\[data-tema=sera\\]');

  assert.ok(giorno, 'blocco del registro giorno non trovato nel CSS generato');
  assert.ok(sera, 'blocco del registro sera non trovato nel CSS generato');
  assert.deepEqual(
    sera,
    giorno.filter((t) => !['--c-arancio', '--logo-arancio'].includes(t)),
    'i due registri non dichiarano gli stessi token'
  );
});

test('🔴 Open Question n. 1 — `@theme inline` NON emette alcuna variabile del tema su :root', () => {
  // La risposta, misurata il 12 agosto 2026: **no**. Con `inline` il valore viene inlinato
  // nelle utility e la variabile del tema non viene dichiarata affatto.
  //
  // ⚠️ Ci è voluto un secondo giro per arrivarci, e vale la pena scriverlo. Il primo build
  //    ne mostrava UNA — e sembrava la risposta «sì, le emette comunque». Non era Tailwind:
  //    era un COMMENTO di global.css che nominava quel nome dentro un `var(…)`. Tailwind
  //    decide quali variabili del tema emettere cercando i `var(…)` nel CSS e guarda anche
  //    dentro i commenti; cambiando il nome citato nel commento cambiava la variabile
  //    emessa. Un test scritto su quella prima osservazione avrebbe pinnato un artefatto
  //    di un commento, credendo di pinnare il comportamento di Tailwind.
  //
  // Questa asserzione vale quindi in due direzioni: risponde alla Open Question, e
  // impedisce che un commento futuro rimetta per sbaglio una variabile inutile nel foglio
  // spedito — che sarebbe una tentazione per chi la trovasse lì.
  const emesse = [...css.matchAll(/--color-[a-z-]+(?=\s*:)/g)].map((m) => m[0]);
  assert.deepEqual(
    [...new Set(emesse)],
    [],
    `il foglio dichiara variabili del tema: ${[...new Set(emesse)].join(', ')}. Con @theme ` +
      'inline non dovrebbero esistere — controlla se un commento le nomina dentro un var().'
  );
});
