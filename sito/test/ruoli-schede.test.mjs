// Ogni ruolo immagine che il sito consuma è nominato da una scheda del pannello, e viceversa.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 PERCHÉ QUESTO TEST ESISTE. La richiesta originale dell'utente era letterale: *«ogni pagina
//    del sito una voce di menu, e lì mi dici quante immagini posso caricare»*. La risposta vive
//    in `duedgusto/…/pagine/ruoliPagine.tsx`, che dichiara i sette ruoli con la pagina che li
//    ospita; le immagini vere le prendono i `.astro`, che leggono `ruoli.<nome>` dalla rotta
//    pubblica. Sono due dichiarazioni in due progetti diversi e finora si corrispondevano **per
//    disciplina**: un ruolo aggiunto al sito e non al pannello non produce alcun errore, produce
//    una scheda che dichiara meno immagini di quante la pagina ne mostri — cioè un conteggio che
//    mente in difetto con sicurezza.
//
// ⚠️ E l'attribuzione a una PAGINA conta quanto l'esistenza del ruolo: se `fotoMenu` venisse
//    letto da `index.astro`, la scheda «Menu» continuerebbe a dichiarare tre posti che la sua
//    pagina non mostra più. Il confronto è quindi per coppia (ruolo, pagina), non per insieme
//    di nomi.
//
// 🔴 LA SECONDA COSA CHE QUESTO FILE TIENE ONESTA: il «fino a 3» delle fotografie che la home
//    prende dai PRODOTTI e non dalla galleria. È `MAX_MOMENTI` in `index.astro`, e il pannello
//    lo dichiara in `IMMAGINI_FUORI_GALLERIA.massimo` per non far mentire in difetto il
//    conteggio della home. Restano due scritture — il gestionale non può importare dal sito, e
//    il server quel numero non lo conosce affatto — ma non sono più mute: divergono e questo
//    test diventa rosso. È un debito **ridotto**, non estinto, e va scritto così com'è.
//
// ⚠️ Si tolgono i commenti prima di cercare, come in tutti i test di scansione di questa
//    cartella: `index.astro` nomina `ruoli.eroeHome` dentro il commento che spiega perché la
//    lettura per nome ha sostituito l'indice, e senza `senzaCommenti` il test sarebbe verde per
//    la ragione sbagliata — cioè cieco all'eventuale sparizione della lettura vera.
// ─────────────────────────────────────────────────────────────────────────────────────────

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { senzaCommenti, radiceSito } from './_scansione.mjs';

const RADICE_REPO = dirname(radiceSito);
const RUOLI_PANNELLO = join(RADICE_REPO, 'duedgusto/src/components/pages/sito/pagine/ruoliPagine.tsx');
const INDEX = join(radiceSito, 'src/pages/index.astro');

/** Le sei pagine, dal nome che il pannello usa al file che le rende. */
const PAGINE = {
  home: 'src/pages/index.astro',
  menu: 'src/pages/menu.astro',
  aperitivo: 'src/pages/aperitivo.astro',
  piatto: 'src/pages/piatto-del-giorno.astro',
  locale: 'src/pages/locale.astro',
  contatti: 'src/pages/contatti.astro',
};

/**
 * I ruoli dichiarati dal pannello, come coppie `pagina/chiave`.
 *
 * ⚠️ La regex pretende che `chiave` e `pagina` siano adiacenti e in quest'ordine, come sono in
 *    `RUOLI_IMMAGINI`. `\s*` attraversa gli a capo perché quel file è formattato da prettier e
 *    le due proprietà stanno su due righe.
 */
function ruoliDelPannello() {
  const testo = senzaCommenti(readFileSync(RUOLI_PANNELLO, 'utf8'));
  return [...testo.matchAll(/chiave:\s*"(\w+)",\s*pagina:\s*"(\w+)",/g)].map(([, chiave, pagina]) => `${pagina}/${chiave}`);
}

/** I ruoli che ciascuna pagina del sito consuma davvero, come coppie `pagina/chiave`. */
function ruoliDelSito() {
  return Object.entries(PAGINE).flatMap(([pagina, relativo]) => {
    const testo = senzaCommenti(readFileSync(join(radiceSito, relativo), 'utf8'));
    return [...new Set([...testo.matchAll(/\bruoli\??\.(\w+)/g)].map(([, chiave]) => chiave))].map((chiave) => `${pagina}/${chiave}`);
  });
}

test('la scansione trova davvero le due dichiarazioni', () => {
  // ① Senza, due elenchi vuoti coinciderebbero perfettamente e il test sarebbe CIECO invece che
  //    rosso: è la stessa difesa di `mappa-pagine.test.mjs` e di `iconeDelSeed.test.tsx`.
  const pannello = ruoliDelPannello();
  const sito = ruoliDelSito();

  assert.equal(pannello.length, 7, `letti ${pannello.length} ruoli da ruoliPagine.tsx invece di 7: la scansione non riconosce più la forma di RUOLI_IMMAGINI`);
  assert.ok(sito.length >= 7, `letti solo ${sito.length} usi di ruoli.* nei .astro: la scansione non riconosce più le letture del sito`);
});

test('🔴 ogni ruolo che una pagina del sito consuma è nominato dalla scheda di quella pagina', () => {
  const pannello = new Set(ruoliDelPannello());
  const sito = new Set(ruoliDelSito());

  const nonNominati = [...sito].filter((coppia) => !pannello.has(coppia)).sort();
  const fantasma = [...pannello].filter((coppia) => !sito.has(coppia)).sort();

  assert.deepEqual(
    { nonNominati, fantasma },
    { nonNominati: [], fantasma: [] },
    `ruoli che il sito consuma e che nessuna scheda nomina: ${nonNominati.join(', ') || '—'}\n` +
      `ruoli dichiarati dal pannello che nessuna pagina consuma più: ${fantasma.join(', ') || '—'}\n` +
      `Il primo verso fa dichiarare alla scheda MENO immagini di quante la pagina ne mostri; il secondo, di più.`
  );
});

test("🔴 il «fino a 3» delle fotografie dai prodotti è lo stesso numero di MAX_MOMENTI", () => {
  // È l'unico numero rimasto scritto due volte in due progetti: il gestionale non può importare
  // dal sito e il server non conosce affatto i «momenti» della home. Il debito resta, ma smette
  // di essere muto.
  const daIndex = /const MAX_MOMENTI = (\d+);/.exec(senzaCommenti(readFileSync(INDEX, 'utf8')));
  assert.ok(daIndex, 'MAX_MOMENTI non si trova più in index.astro: la scansione è cieca, non verde');

  const testoPannello = senzaCommenti(readFileSync(RUOLI_PANNELLO, 'utf8'));
  const daPannello = /pagina:\s*"home",\s*massimo:\s*(\d+),/.exec(testoPannello);
  assert.ok(daPannello, 'la voce «fuori galleria» della home non si trova più in ruoliPagine.tsx');

  assert.equal(
    Number(daPannello[1]),
    Number(daIndex[1]),
    `la scheda «Home» dichiara fino a ${daPannello[1]} fotografie dai prodotti, ma index.astro ne mostra fino a ${daIndex[1]}: il conteggio della scheda mentirebbe.`
  );
});

test('la pagina «Contatti» non consuma alcun ruolo, e il pannello non gliene attribuisce', () => {
  // Zero è una risposta e va verificata: una scheda che tacesse la sezione immagini sarebbe
  // indistinguibile da una che non sa rispondere.
  assert.deepEqual(
    ruoliDelSito().filter((coppia) => coppia.startsWith('contatti/')),
    []
  );
  assert.deepEqual(
    ruoliDelPannello().filter((coppia) => coppia.startsWith('contatti/')),
    []
  );
});
