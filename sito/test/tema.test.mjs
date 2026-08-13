// Il confine del registro serale, e lo stato di apertura.
//
// Sono funzioni pure su stringhe `"HH:mm"`: non serve un browser, non serve un orologio
// finto, e ogni caso è un'ora scritta a mano.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eSera,
  eAperto,
  oraDiRoma,
  giornoDiRoma,
  dataDiRoma,
  dataFraGiorni,
} from '../src/lib/tema.ts';

const SERA = '18:00';
const APERTURA = '07:00';
const CHIUSURA = '20:00';

/** Un giorno qualunque, e nessuna chiusura: i due parametri che quasi ogni caso non esercita. */
const OGGI = '2026-08-13';
const APERTI = [];

test('🔴 le due di notte sono registro serale', () => {
  // È il caso che la sola prima metà della formula sbaglia: `"01:00" >= "18:00"` è FALSO,
  // e senza l'estremo di uscita il sito sarebbe crema e oliva alle due del mattino.
  // Sta in un test a sé perché deve poter fallire da solo.
  assert.equal(eSera('01:00', SERA, APERTURA), true);
});

test('il registro serale finisce quando il locale apre', () => {
  assert.equal(eSera('06:59', SERA, APERTURA), true, 'un minuto prima è ancora notte');
  assert.equal(eSera('07:00', SERA, APERTURA), false, "all'apertura è giorno");
});

test("dopo l'ora di inizio è sera", () => {
  assert.equal(eSera('17:59', SERA, APERTURA), false);
  assert.equal(eSera('18:00', SERA, APERTURA), true, "l'estremo di ingresso è incluso");
  assert.equal(eSera('23:59', SERA, APERTURA), true);
});

test("l'estremo di uscita segue l'orario del locale, non una costante", () => {
  // Se il locale aprisse alle 05:00, il registro notturno finirebbe alle 05:00. Nessun
  // numero nuovo da nessuna parte: è lo stesso dato che il sito mostra al visitatore.
  assert.equal(eSera('06:00', SERA, '05:00'), false);
  assert.equal(eSera('06:00', SERA, '09:00'), true);
});

test('🔴 mezzanotte non produce un\'ora fuori scala', () => {
  // ⚠️ `hour12: false` restituisce "24:00" a mezzanotte in alcune versioni di ICU, e
  //    "24:00" >= "18:00" darebbe il registro serale all'ora sbagliata per sessanta minuti
  //    l'anno. `hourCycle: 'h23'` dà "00:00".
  const mezzanotte = new Date(Date.UTC(2026, 7, 12, 22, 0, 0)); // 00:00 a Roma (CEST)
  const ora = oraDiRoma(mezzanotte);
  assert.equal(ora, '00:00');
  assert.ok(!ora.startsWith('24'), `ora fuori scala: ${ora}`);
  // E a quell'ora il registro è comunque sera, per l'altro ramo della formula.
  assert.equal(eSera(ora, SERA, APERTURA), true);
});

test("l'ora è quella di Roma, non quella del visitatore", () => {
  // Le 15:30 UTC del 12 agosto sono le 17:30 a Roma (ora legale).
  assert.equal(oraDiRoma(new Date('2026-08-12T15:30:00Z')), '17:30');
});

test('il giorno ha lunedì a zero, come l\'array del backend', () => {
  // ⚠️ `Date.getDay()` metterebbe domenica a 0 e userebbe il fuso del visitatore: due
  //    disallineamenti che si compensano solo per caso.
  assert.equal(giornoDiRoma(new Date('2026-08-10T12:00:00Z')), 0, 'lunedì');
  assert.equal(giornoDiRoma(new Date('2026-08-16T12:00:00Z')), 6, 'domenica');
});

test('aperto solo dentro la fascia oraria', () => {
  const lun = 0;
  const settimana = [true, true, true, true, true, true, false];
  assert.equal(eAperto('06:59', lun, APERTURA, CHIUSURA, settimana, OGGI, APERTI), false);
  assert.equal(eAperto('07:00', lun, APERTURA, CHIUSURA, settimana, OGGI, APERTI), true);
  assert.equal(eAperto('19:59', lun, APERTURA, CHIUSURA, settimana, OGGI, APERTI), true);
  assert.equal(
    eAperto('20:00', lun, APERTURA, CHIUSURA, settimana, OGGI, APERTI),
    false,
    'alla chiusura è chiuso'
  );
});

test('un giorno non operativo è chiuso a qualunque ora', () => {
  const dom = 6;
  const settimana = [true, true, true, true, true, true, false];
  assert.equal(eAperto('10:00', dom, APERTURA, CHIUSURA, settimana, OGGI, APERTI), false);
});

test('⚠️ giorniOperativi nullo: ci si limita al confronto orario', () => {
  // Il backend lo espone `null` quando il JSON persistito non è leggibile come sette
  // booleani: omettere gli orari settimanali è meglio che dichiararne di sbagliati. Il
  // badge non deve indovinare i giorni, e nemmeno sollevare.
  assert.equal(eAperto('10:00', 6, APERTURA, CHIUSURA, null, OGGI, APERTI), true);
  assert.equal(eAperto('22:00', 6, APERTURA, CHIUSURA, null, OGGI, APERTI), false);
});

test('🔴 un giorno di ferie è chiuso, anche se è operativo e siamo dentro la fascia', () => {
  // ─────────────────────────────────────────────────────────────────────────────────────
  // È IL BUG. Il 13 agosto 2026 il bar era in ferie dal 10 al 22, registrate in cassa: un
  // giovedì (indice 3, operativo) alle dieci del mattino, dentro 07:00–20:00. La pastiglia
  // si accendeva verde e diceva «Aperto · fino alle 20:00».
  //
  // Le tre condizioni sono indipendenti e nessuna implica le altre: questo test fallisce da
  // solo se qualcuno togliesse la prima riga di `eAperto`.
  // ─────────────────────────────────────────────────────────────────────────────────────
  const gio = 3;
  const settimana = [true, true, true, true, true, true, false];
  const ferie = ['2026-08-13', '2026-08-14'];

  assert.equal(eAperto('10:00', gio, APERTURA, CHIUSURA, settimana, '2026-08-13', ferie), false);
  assert.equal(
    eAperto('10:00', gio, APERTURA, CHIUSURA, settimana, '2026-08-20', ferie),
    true,
    'un giorno FUORI dalle ferie resta aperto: la chiusura è per data, non per periodo dedotto'
  );
});

test('la data di Roma è quella di Roma, e nella forma dell\'API', () => {
  // Le 23:30 UTC del 12 agosto sono già l'1:30 del 13 a Roma: chi guarda da Londra deve
  // vedere il giorno di Thiene, altrimenti il confronto con le chiusure scivola di uno.
  assert.equal(dataDiRoma(new Date('2026-08-12T23:30:00Z')), '2026-08-13');
  assert.equal(dataDiRoma(new Date('2026-01-05T09:00:00Z')), '2026-01-05');
  assert.match(dataDiRoma(new Date('2026-08-12T15:30:00Z')), /^\d{4}-\d{2}-\d{2}$/);
});

test('🔴 ogni riga della settimana vale la sua prossima occorrenza', () => {
  // ─────────────────────────────────────────────────────────────────────────────────────
  // È IL SECONDO MEZZO-VERO, quello rimasto dopo il primo: la tabella «Dove e quando»
  // marcava la sola riga di oggi, quindi il 13 agosto — giovedì, in ferie fino al 22 —
  // scriveva «chiuso · Ferie» su giovedì e «07:00 — 20:00» su venerdì e sabato.
  //
  // La riga «Venerdì» significa il venerdì che sta per arrivare: questo è il conto che le
  // dà una data, ed è quello che permette allo script di confrontarla con le chiusure.
  // ─────────────────────────────────────────────────────────────────────────────────────
  const GIOVEDI = 3;
  const oggi = '2026-08-13';
  const scarto = (indice) => (indice - GIOVEDI + 7) % 7;

  assert.equal(dataFraGiorni(oggi, scarto(GIOVEDI)), '2026-08-13', 'oggi è a distanza zero');
  assert.equal(dataFraGiorni(oggi, scarto(4)), '2026-08-14', 'venerdì è domani');
  assert.equal(dataFraGiorni(oggi, scarto(5)), '2026-08-15');
  assert.equal(
    dataFraGiorni(oggi, scarto(2)),
    '2026-08-19',
    'mercoledì è già passato questa settimana: vale quello della prossima, e cade nelle ferie'
  );
});

test('la data che scavalca il mese, l\'anno e l\'ora legale resta esatta', () => {
  // ⚠️ Il capodanno e il cambio di mese sono i due punti in cui un conto scritto a mano
  //    sbaglia: `Date.UTC` normalizza il traboccamento da solo, e questo lo pinna.
  assert.equal(dataFraGiorni('2026-08-31', 1), '2026-09-01');
  assert.equal(dataFraGiorni('2026-12-30', 5), '2027-01-04');
  // ⚠️ L'ultima domenica di ottobre: con un'aritmetica su fuso locale, «+1 giorno» a
  //    cavallo del ritorno all'ora solare può restituire lo STESSO giorno. In UTC no.
  assert.equal(dataFraGiorni('2026-10-24', 1), '2026-10-25');
  assert.equal(dataFraGiorni('2026-10-25', 1), '2026-10-26');
  assert.equal(dataFraGiorni('2026-02-28', 1), '2026-03-01', 'il 2026 non è bisestile');
});

test('🔴 le funzioni serializzate restano codice funzionante', () => {
  // Il layout le manda al browser con `Function.prototype.toString()`, perché la formula
  // deve esistere in un posto solo. Il prezzo è che devono essere AUTOSUFFICIENTI: se
  // qualcuno vi aggiungesse un import o una costante esterna, nel browser fallirebbero con
  // un ReferenceError e in nessun test si vedrebbe niente. Questo lo vede.
  const sorgente = `
    const eSera = ${eSera.toString()};
    const eAperto = ${eAperto.toString()};
    const oraDiRoma = ${oraDiRoma.toString()};
    const giornoDiRoma = ${giornoDiRoma.toString()};
    const dataDiRoma = ${dataDiRoma.toString()};
    const dataFraGiorni = ${dataFraGiorni.toString()};
    return [eSera('01:00','18:00','07:00'),
            eAperto('10:00',0,'07:00','20:00',null,'2026-08-13',[]),
            eAperto('10:00',3,'07:00','20:00',null,'2026-08-13',['2026-08-13']),
            oraDiRoma(new Date('2026-08-12T15:30:00Z')),
            giornoDiRoma(new Date('2026-08-10T12:00:00Z')),
            dataDiRoma(new Date('2026-08-12T23:30:00Z')),
            dataFraGiorni('2026-08-13', 1)];
  `;
  const risultato = new Function(sorgente)();
  assert.deepEqual(risultato, [true, true, false, '17:30', 0, '2026-08-13', '2026-08-14']);
});
