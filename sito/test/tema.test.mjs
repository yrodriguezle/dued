// Il confine del registro serale, e lo stato di apertura.
//
// Sono funzioni pure su stringhe `"HH:mm"`: non serve un browser, non serve un orologio
// finto, e ogni caso è un'ora scritta a mano.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eSera, eAperto, oraDiRoma, giornoDiRoma } from '../src/lib/tema.ts';

const SERA = '18:00';
const APERTURA = '07:00';
const CHIUSURA = '20:00';

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
  assert.equal(eAperto('06:59', lun, APERTURA, CHIUSURA, settimana), false);
  assert.equal(eAperto('07:00', lun, APERTURA, CHIUSURA, settimana), true);
  assert.equal(eAperto('19:59', lun, APERTURA, CHIUSURA, settimana), true);
  assert.equal(eAperto('20:00', lun, APERTURA, CHIUSURA, settimana), false, 'alla chiusura è chiuso');
});

test('un giorno non operativo è chiuso a qualunque ora', () => {
  const dom = 6;
  const settimana = [true, true, true, true, true, true, false];
  assert.equal(eAperto('10:00', dom, APERTURA, CHIUSURA, settimana), false);
});

test('⚠️ giorniOperativi nullo: ci si limita al confronto orario', () => {
  // Il backend lo espone `null` quando il JSON persistito non è leggibile come sette
  // booleani: omettere gli orari settimanali è meglio che dichiararne di sbagliati. Il
  // badge non deve indovinare i giorni, e nemmeno sollevare.
  assert.equal(eAperto('10:00', 6, APERTURA, CHIUSURA, null), true);
  assert.equal(eAperto('22:00', 6, APERTURA, CHIUSURA, null), false);
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
    return [eSera('01:00','18:00','07:00'), eAperto('10:00',0,'07:00','20:00',null),
            oraDiRoma(new Date('2026-08-12T15:30:00Z')), giornoDiRoma(new Date('2026-08-10T12:00:00Z'))];
  `;
  const risultato = new Function(sorgente)();
  assert.deepEqual(risultato, [true, true, '17:30', 0]);
});
