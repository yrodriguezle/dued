// Gli orari vengono dall'API, non dai template.
//
// È la garanzia strutturale che il change precedente ha comprato: `BusinessSettings` è la
// sorgente unica, e `ImpostazioniVetrina` non ha campi di orario **apposta**, così la classe
// di bug «il sito dice aperto fino alle 21, la cassa alle 19» non è raggiungibile.
// Riscrivere un orario in un template la riaprirebbe dal lato del sito.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sorgenti, senzaCommenti, radiceSito } from './_scansione.mjs';

const ORARIO = /\b([01]\d|2[0-3]):[0-5]\d\b/;

/**
 * Gli unici file in cui una stringa `HH:mm` è legittima, ognuno con i valori che può
 * contenere e la ragione per cui li contiene.
 *
 * 🔴 **Questa tabella è il posto in cui si dice di no.** Se un test fallisce, la domanda
 *    giusta non è «aggiungo il file all'elenco»: è «da dove viene questo orario». In tutti i
 *    casi tranne questi due la risposta è «dal database», e allora va letto da lì.
 */
const ECCEZIONI = {
  // I due ripieghi della degradazione: fanno funzionare la formula del registro serale
  // quando l'API non risponde, e NON compaiono mai in pagina — una pagina degradata dichiara
  // di non sapere gli orari, non ne inventa.
  'src/lib/degradazione.ts': ['07:00', '18:00'],
  // Come schema.org scrive «chiuso»: un intervallo di durata nulla. Non è un orario del
  // locale — vale `00:00`–`00:00` ovunque — ed è ciò che permette a
  // `specialOpeningHoursSpecification` di dichiarare i giorni di ferie ai motori, invece di
  // lasciarli convinti che il bar sia aperto.
  'src/lib/chiusure.ts': ['00:00'],
};

test('nessun orario scritto nei sorgenti, tranne le eccezioni dichiarate', () => {
  const colpevoli = [];

  for (const percorso of sorgenti()) {
    if (percorso in ECCEZIONI) continue;
    const testo = senzaCommenti(readFileSync(join(radiceSito, percorso), 'utf8'));
    for (const riga of testo.split('\n')) {
      if (ORARIO.test(riga)) colpevoli.push(`${percorso}: ${riga.trim()}`);
    }
  }

  assert.deepEqual(
    colpevoli,
    [],
    `orari scritti a mano: ${colpevoli.join(' | ')}. Gli orari hanno una sorgente sola, ed è ` +
      'il database che la cassa legge e scrive.'
  );
});

test('le eccezioni contengono ESATTAMENTE i valori dichiarati', () => {
  // ⚠️ L'elenco esatto e non «almeno questi»: un terzo orario che comparisse dentro un file
  //    già in tabella entrerebbe senza che nessuno decida niente, ed è precisamente il modo
  //    in cui un'eccezione dichiarata si allarga fino a non essere più un'eccezione.
  for (const [percorso, attesi] of Object.entries(ECCEZIONI)) {
    const testo = senzaCommenti(readFileSync(join(radiceSito, percorso), 'utf8'));
    const trovati = [...new Set(testo.match(new RegExp(ORARIO, 'g')) ?? [])];
    assert.deepEqual(
      trovati.sort(),
      [...attesi].sort(),
      `${percorso} contiene orari diversi da quelli dichiarati in questo test`
    );
  }
});
