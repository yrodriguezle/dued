// Le due regole del design system che si verificano leggendo i sorgenti.
//
// Non guardano il CSS generato — quello è `css-tema.test.mjs` — ma ciò che qualcuno
// potrebbe SCRIVERE. Sono le due strade con cui le difese di §D6 e §D7 si aggirano senza
// accorgersene.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sorgenti, senzaCommenti, radiceSito } from './_scansione.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** I sorgenti che, tolti i commenti, soddisfano `schema`. */
function sorgentiCheCorrispondono(schema) {
  return sorgenti().filter((percorso) =>
    schema.test(senzaCommenti(readFileSync(join(radiceSito, percorso), 'utf8')))
  );
}

test('il CSS scritto a mano usa il nome di RUNTIME, mai --color-*', () => {
  // Con `@theme inline` il nome --color-sfondo non è più il canale attraverso cui passa
  // il valore: esiste ancora su :root (è emesso, l'abbiamo misurato) ma non è quello che
  // le utility leggono. Chi lo usasse a mano scriverebbe codice che funziona alla radice
  // e si stacca dentro ogni sottoalbero con un tema proprio.
  const colpevoli = sorgentiCheCorrispondono(/var\(\s*--color-/);
  assert.deepEqual(
    colpevoli,
    [],
    `${colpevoli.join(', ')} legge --color-*: il nome di runtime è --c-*.`
  );
});

test('🔴 nessun testo arancione, in nessuna delle sue forme', () => {
  // L'utility mancante ferma `text-arancio`, non i VALORI ARBITRARI: `text-[#FD8502]` e
  // `text-[var(--c-arancio)]` bypassano la namespace del tema e generano CSS eccome.
  //
  // ⚠️ La difesa contro i falsi positivi qui è ESERCITATA, non teorica: il commento di
  //    global.css contiene letteralmente `#FD8502`, la parola `text-arancio` e la stringa
  //    `--c-arancio`. Senza l'esclusione dei commenti questo test nascerebbe rosso, e chi
  //    lo vedesse rosso la prima volta allenterebbe l'asserzione invece del filtro.
  //    Escludere invece l'intero global.css sarebbe la soluzione sbagliata: è proprio il
  //    file in cui un `color: var(--c-arancio)` verrebbe scritto.
  //
  // 🔴 Il negative lookbehind `(?<![-\w])` sulla terza alternativa non è un dettaglio:
  //    senza, `background-color: var(--c-arancio)` e `border-color: var(--c-arancio)` —
  //    cioè le DUE utility ammesse, che devono esistere — contengono la sottostringa
  //    `color: var(--c-arancio)` e farebbero fallire il test su se stesso.
  const schema =
    /text-\[?#?[Ff][Dd]8502|text-\[var\(--c-arancio\)\]|(?<![-\w])color:\s*var\(--c-arancio\)/;
  const colpevoli = sorgentiCheCorrispondono(schema);
  assert.deepEqual(
    colpevoli,
    [],
    `${colpevoli.join(', ')} porta testo arancione. Sulla crema il contrasto è 2.11, ` +
      "sotto la soglia del testo grande: l'accento che porta testo è --c-accento."
  );
});

test('🔴 i colori scritti a mano nei componenti sono solo i tre ammessi', () => {
  // ─────────────────────────────────────────────────────────────────────────────────────
  // Un colore esadecimale dentro un `.astro` è quasi sempre un errore: i token cambiano fra
  // i due registri, un letterale no. Chi scrive `#F7F4EF` al posto di `bg-sfondo` ottiene una
  // pagina identica di giorno e una fascia crema in mezzo alla lavagna di sera — e non c'è
  // alcun errore da nessuna parte, solo una sezione che «non ha preso il tema».
  //
  // Tre eccezioni, e ognuna esiste per una ragione che il token NON risolve:
  //
  //   #16130F  il testo sopra l'arancio di marca. 🔴 L'arancio è FISSO nei due registri,
  //            quindi il testo sopra dev'esserlo altrettanto: `text-inchiostro` darebbe
  //            crema su arancio di sera, che è **2.22** — illeggibile. Questo è **7.53**.
  //            Vale anche come fondo dell'eroe dell'aperitivo, che è sempre in registro sera.
  //   #F4F0E9  il testo sopra quel fondo, per la stessa ragione simmetrica.
  //   #5F9B4F  il pallino di «aperto». Un verde di stato non è un colore della marca e non
  //            appartiene alla palette: metterlo fra i token lo renderebbe disponibile come
  //            sfondo o come testo, che non deve essere.
  //
  // ⚠️ Se questo test fallisce, la domanda giusta non è «aggiungo il colore all'elenco»: è
  //    «perché questo pezzo non può usare un token». Nella maggioranza dei casi può.
  // ─────────────────────────────────────────────────────────────────────────────────────
  const AMMESSI = new Set(['#16130F', '#F4F0E9', '#5F9B4F']);

  // ⚠️ Solo i `.astro`: `global.css` **è** il posto in cui i colori si scrivono, ed è dove
  //    stanno i quattordici valori dei due registri. Scandirlo qui vorrebbe dire elencare la
  //    palette in due file — e il secondo sarebbe questo, che nessuno guarda quando cambia un
  //    colore.
  const trovati = new Map();
  for (const percorso of sorgenti().filter((p) => p.endsWith('.astro'))) {
    const testo = senzaCommenti(readFileSync(join(radiceSito, percorso), 'utf8'));
    for (const [colore] of testo.matchAll(/#[0-9A-Fa-f]{6}\b/g)) {
      if (AMMESSI.has(colore.toUpperCase())) continue;
      trovati.set(colore, [...(trovati.get(colore) ?? []), percorso]);
    }
  }

  assert.deepEqual(
    [...trovati.entries()],
    [],
    'colori scritti a mano fuori dai tre ammessi: ' +
      [...trovati.entries()].map(([c, f]) => `${c} (${[...new Set(f)].join(', ')})`).join('; ')
  );
});
