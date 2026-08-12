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

/** L'unico file in cui un orario è legittimo, e la ragione per cui lo è. */
const RIPIEGHI = 'src/lib/degradazione.ts';

test('nessun orario scritto nei sorgenti, tranne i due ripieghi dichiarati', () => {
  const orario = /\b([01]\d|2[0-3]):[0-5]\d\b/;
  const colpevoli = [];

  for (const percorso of sorgenti()) {
    if (percorso === RIPIEGHI) continue;
    const testo = senzaCommenti(readFileSync(join(radiceSito, percorso), 'utf8'));
    for (const riga of testo.split('\n')) {
      if (orario.test(riga)) colpevoli.push(`${percorso}: ${riga.trim()}`);
    }
  }

  assert.deepEqual(
    colpevoli,
    [],
    `orari scritti a mano: ${colpevoli.join(' | ')}. Gli orari hanno una sorgente sola, ed è ` +
      'il database che la cassa legge e scrive.'
  );
});

test('i due ripieghi sono solo due, e stanno dove devono', () => {
  // ⚠️ Sono l'eccezione, e va tenuta piccola: servono a far funzionare la formula del
  //    registro serale quando l'API non risponde, e NON compaiono mai in pagina — una
  //    pagina degradata dichiara di non sapere gli orari, non ne inventa.
  const testo = senzaCommenti(readFileSync(join(radiceSito, RIPIEGHI), 'utf8'));
  const trovati = testo.match(/\b([01]\d|2[0-3]):[0-5]\d\b/g) ?? [];
  assert.deepEqual(trovati.sort(), ['07:00', '18:00']);
});
