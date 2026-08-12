// Il vincolo di Node è letto da npm, e lo è perché `.npmrc` sta in `sito/`.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// PERCHÉ QUESTO TEST ESISTE, E COSA HA SOSTITUITO
//
// I task 1.6 e 1.7 del change chiedevano due prove manuali una tantum su Node 20:
// l'install che **fallisce** con `.npmrc`, e la controprova che **riesce** senza. La
// finestra si è chiusa prima che fossero eseguite — il 12 agosto 2026 la macchina è stata
// portata a Node 22.23.2 e sul sistema non esiste più alcun Node 20.
//
// 🔴 Eseguirle oggi con l'npm di sistema le farebbe *riuscire entrambe*, cioè dimostrare
//    l'opposto di ciò che devono dimostrare. Decisione dell'utente (autonomia.md §2.2):
//    i due task si soddisfano in questa forma, che conserva **la logica discriminante**
//    dell'originale — due esiti opposti a un solo file di distanza — e prova ciò che
//    conta davvero. Il soggetto sotto esame non è Node 20: è `.npmrc`.
//
//    Che serva Node ≥ 22.12 è già scritto in tre posti (`engines`, `.nvmrc`, `.npmrc`), e
//    che `engine-strict` funzioni è comportamento documentato di npm, non codice nostro.
//    Il modo realistico di sbagliare è un altro: che quel file sia nel posto sbagliato,
//    col nome sbagliato, o non venga letto.
//
// ⚠️ IL LIMITE, scritto e non nascosto: questo test **non osserva l'install abortire**.
//    Verifica la configurazione attiva, non l'effetto finale — un anello più corto della
//    catena. Se un giorno npm cambiasse il significato di `engine-strict`, questo test
//    resterebbe verde mentre l'originale sarebbe diventato rosso.
//
// Il guadagno che rende la sostituzione un miglioramento e non un ripiego: 1.6 e 1.7
// erano due prove che nessuno avrebbe mai più rieseguito. Questa gira a ogni `npm test`,
// su qualunque macchina e in CI.
// ─────────────────────────────────────────────────────────────────────────────────────

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { renameSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const radiceSito = dirname(dirname(fileURLToPath(import.meta.url)));
const npmrc = join(radiceSito, '.npmrc');
const npmrcSpento = join(radiceSito, '.npmrc.off');

/**
 * Ambiente ripulito da ogni `npm_config_*`.
 *
 * 🔴 Senza questa pulizia la controprova è VERDE PER COSTRUZIONE, ed è stato osservato
 *    il 12 agosto 2026: eseguita con `node --test` diretto la controprova passava, e
 *    lanciata da `npm test` falliva con `'true' !== 'false'`. La ragione è che npm
 *    esporta la propria configurazione ai processi figli come variabili d'ambiente
 *    (`npm_config_engine_strict=true`), e per npm l'ambiente **batte il file**: il figlio
 *    rispondeva `true` anche con `.npmrc` rinominato, ereditando il valore dal padre che
 *    lo aveva letto un istante prima.
 *
 *    L'effetto è una prova che sembra funzionare e non misura nulla — esattamente il
 *    difetto che il task 1.7 esisteva per escludere, ricomparso da un'altra porta.
 */
function ambientePulito() {
  const env = { ...process.env };
  for (const chiave of Object.keys(env)) {
    if (chiave.toLowerCase().startsWith('npm_config_')) delete env[chiave];
  }
  return env;
}

/** Legge la configurazione npm **attiva in `sito/`**, che è il punto: npm risale dalla cwd. */
function engineStrictAttivo() {
  // shell: true è necessario su Windows — da Node 20 `execFile` rifiuta i `.cmd`
  // senza shell, e `npm` su Windows è `npm.cmd`.
  return execFileSync('npm', ['config', 'get', 'engine-strict'], {
    cwd: radiceSito,
    encoding: 'utf8',
    shell: true,
    env: ambientePulito(),
  }).trim();
}

test('il vincolo di Node è attivo: npm legge engine-strict=true da sito/.npmrc', () => {
  assert.equal(
    engineStrictAttivo(),
    'true',
    'npm non sta leggendo sito/.npmrc: senza engine-strict il campo "engines" è advisory ' +
      '— npm avvisa e installa lo stesso su Node 20, per fallire più tardi e altrove.'
  );
});

test('controprova: senza quel file il vincolo sparisce — non è vero per costruzione', (t) => {
  assert.ok(existsSync(npmrc), 'sito/.npmrc deve esistere prima della controprova');
  assert.ok(
    !existsSync(npmrcSpento),
    'sito/.npmrc.off esiste già: una corsa precedente è morta a metà, ripristina il nome a mano'
  );

  // Il ripristino va registrato PRIMA di rinominare, così avviene anche se l'assert
  // sotto fallisce: lasciare l'albero senza `.npmrc` disattiverebbe il vincolo per tutti.
  t.after(() => {
    if (existsSync(npmrcSpento)) renameSync(npmrcSpento, npmrc);
  });

  renameSync(npmrc, npmrcSpento);

  assert.equal(
    engineStrictAttivo(),
    'false',
    "L'esito non cambia togliendo il file: allora il primo test era verde per una ragione " +
      'diversa da sito/.npmrc — una configurazione utente o di macchina — e il vincolo non ' +
      'è nel repository.'
  );
});
