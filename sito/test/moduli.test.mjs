// 🔴 Un file solo per prefisso — letto dai sorgenti, non promesso in una convenzione.
//
// Idioma verbatim di `RegolaPubblicazioneUnicaTests` del backend: invece di fidarsi che
// una regola stia in un posto solo, si legge l'albero e si pretende che ci sia davvero.
//
// Il guasto che questi due test esistono per intercettare è **invisibile in sviluppo**: i
// due prefissi coincidono su questa macchina, quindi una seconda composizione di URL
// scritta a mano in una pagina funziona qui e si rompe per ogni visitatore il giorno del
// deploy. Non c'è nessun altro momento in cui qualcosa diventerebbe rosso.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sorgentiCheContengono } from './_scansione.mjs';

test('🔴 astro:env/server compare in un file solo', () => {
  const trovati = sorgentiCheContengono('astro:env/server');
  assert.deepEqual(
    trovati,
    ['src/lib/api.ts'],
    `l'ambiente server è importato da: ${trovati.join(', ')}. Deve leggerlo solo il modulo ` +
      'delle rotte: un secondo lettore è un secondo posto in cui si sceglie un\'origine.'
  );
});

test('🔴 la stringa "/media/" compare in un file solo', () => {
  const trovati = sorgentiCheContengono('/media/');
  assert.deepEqual(
    trovati,
    ['src/lib/mediaUrl.ts'],
    `il percorso dei media è composto in: ${trovati.join(', ')}. Deve comporlo solo ` +
      'mediaUrl.ts — che è anche l\'unico a conoscere il prefisso del browser.'
  );
});

test("🔴 lo stesso file è anche l'unico a importare astro:env/client", () => {
  // La spec pretende che siano LO STESSO file, non due: il modulo che conosce il
  // prefisso del browser è quello che compone gli URL. Separarli riaprirebbe la
  // possibilità di comporre un URL senza passare da chi sa da dove si scarica.
  assert.deepEqual(sorgentiCheContengono('astro:env/client'), ['src/lib/mediaUrl.ts']);
});

test('nessuna delle due stringhe compare nell\'altro file', () => {
  // Controllo incrociato: se un giorno i due moduli venissero fusi, i test sopra
  // resterebbero verdi e il confine sarebbe sparito.
  assert.notEqual(
    sorgentiCheContengono('astro:env/server')[0],
    sorgentiCheContengono('astro:env/client')[0],
    'i due contesti sono importati dallo stesso file: il confine dei due prefissi non esiste più'
  );
});
