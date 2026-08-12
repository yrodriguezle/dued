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

test('il numero dello stiramento dell\'insegna compare una volta sola', () => {
  // §D9 — `transform` non partecipa al layout, quindi il fattore serve DUE volte: allo
  // scaleX e alla riserva di spazio. Se fossero due numeri, un giorno divergerebbero e il
  // testo starebbe in un riquadro della misura sbagliata.
  const righe = sorgenti()
    .flatMap((percorso) =>
      senzaCommenti(readFileSync(join(radiceSito, percorso), 'utf8'))
        .split('\n')
        .map((riga) => [percorso, riga])
    )
    .filter(([, riga]) => riga.includes('1.55'));

  assert.equal(
    righe.length,
    1,
    `il fattore di stiramento compare in ${righe.length} righe: ${righe
      .map(([f]) => f)
      .join(', ')}`
  );
});
