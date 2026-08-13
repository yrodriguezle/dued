// Da un elenco di date a una frase che una persona legge.
//
// Sono funzioni pure su stringhe `"yyyy-MM-dd"`: nessun orologio, nessun fuso del processo,
// ogni caso è una data scritta a mano.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raggruppa, descrivi } from '../src/lib/chiusure.ts';

function ferie(...giorni) {
  return giorni.map((giorno) => ({
    data: `2026-08-${String(giorno).padStart(2, '0')}`,
    descrizione: 'Ferie',
    motivo: 'FERIE',
  }));
}

test('i giorni contigui con la stessa descrizione diventano un periodo solo', () => {
  // Il caso reale: tredici righe a database, un avviso in pagina.
  const periodi = raggruppa(ferie(10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22));

  assert.equal(periodi.length, 1);
  assert.equal(periodi[0].inizio, '2026-08-10');
  assert.equal(periodi[0].fine, '2026-08-22');
  assert.equal(periodi[0].giorni, 13);
});

test('🔴 un buco spezza il periodo: non si dichiara chiuso un giorno aperto', () => {
  // Chiuso lunedì e mercoledì, aperto martedì. Raggruppare per «voce successiva nell'elenco»
  // invece che per giorno contiguo direbbe al visitatore che il bar è chiuso anche martedì.
  const periodi = raggruppa(ferie(10, 12));

  assert.equal(periodi.length, 2);
  assert.deepEqual(
    periodi.map((p) => p.inizio),
    ['2026-08-10', '2026-08-12']
  );
});

test('due descrizioni diverse restano due periodi, anche se i giorni sono attaccati', () => {
  const periodi = raggruppa([
    { data: '2026-08-10', descrizione: 'Ferie', motivo: 'FERIE' },
    { data: '2026-08-11', descrizione: 'Riapertura ritardata', motivo: 'CHIUSURA_STRAORDINARIA' },
  ]);

  assert.equal(periodi.length, 2);
  assert.equal(periodi[1].motivo, 'CHIUSURA_STRAORDINARIA');
});

test('un elenco vuoto non produce periodi', () => {
  assert.deepEqual(raggruppa([]), []);
});

test('🔴 il mese di apertura si scrive solo quando cambia', () => {
  // «dal 28 al 3 gennaio» sarebbe sbagliato: il 28 è di dicembre. E «dal 10 agosto al 22
  // agosto» si legge peggio di «dal 10 al 22 agosto».
  const stessoMese = raggruppa(ferie(10, 11, 12))[0];
  assert.equal(descrivi(stessoMese), 'dal 10 al 12 agosto');

  const aCavallo = raggruppa([
    { data: '2026-12-28', descrizione: 'Chiusura', motivo: 'FERIE' },
    { data: '2026-12-29', descrizione: 'Chiusura', motivo: 'FERIE' },
    { data: '2026-12-30', descrizione: 'Chiusura', motivo: 'FERIE' },
    { data: '2026-12-31', descrizione: 'Chiusura', motivo: 'FERIE' },
    { data: '2027-01-01', descrizione: 'Chiusura', motivo: 'FERIE' },
  ])[0];
  assert.equal(descrivi(aCavallo), 'dal 28 dicembre al 1 gennaio');
});

test('un giorno solo si descrive con il giorno della settimana', () => {
  // È l'informazione utile quando la chiusura è di un giorno: «giovedì 13 agosto» dice
  // subito se riguarda il momento in cui uno stava pensando di passare.
  const singolo = raggruppa(ferie(13))[0];
  assert.equal(descrivi(singolo), 'giovedì 13 agosto');
});

test('⚠️ la data non slitta di un giorno per il fuso del processo', () => {
  // `new Date('2026-08-10')` è mezzanotte UTC, e formattarla nel fuso locale la manda al 9
  // per chiunque stia a ovest di Greenwich. Qui il fuso è dichiarato UTC in entrambi i
  // sensi, quindi il numero che si legge è quello che c'è nella stringa.
  const singolo = raggruppa([{ data: '2026-08-01', descrizione: 'Chiuso', motivo: 'FERIE' }])[0];
  assert.match(descrivi(singolo), /\b1 agosto$/);
});
