// Scansione dei sorgenti — l'attrezzo comune ai test di unicità.
//
// L'idioma è quello di `RegolaPubblicazioneUnicaTests` del backend: invece di fidarsi che
// una regola stia in un posto solo, si legge l'albero e si pretende che ci sia davvero.
//
// ⚠️ Un test di scansione è fragile ai FALSI POSITIVI, e la fragilità è concreta qui: il
//    commento di `mediaUrl.ts` nomina proprio la stringa `/media/` che il test cerca, e
//    `dev.mjs` nomina `NODE_TLS_REJECT_UNAUTHORIZED` per dire che è vietata. Senza togliere
//    i commenti, i test sarebbero rossi per la ragione sbagliata — e chi li vede rossi la
//    prima volta li "aggiusta" allentando l'asserzione.
//
// Le tre difese: (a) si tolgono i commenti, (b) si escludono `test/`, `node_modules/`,
// `dist/` e `.astro/`, (c) il messaggio di fallimento nomina il file di troppo.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, extname } from 'node:path';

export const radiceSito = dirname(dirname(fileURLToPath(import.meta.url)));

/** Le cartelle che contengono codice applicativo. Tutto il resto non è "un sorgente". */
const CARTELLE = ['src', 'scripts'];

const ESTENSIONI = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.astro', '.css']);

/**
 * Toglie i commenti conservando le stringhe.
 *
 * 🔴 Perché non basta un `replace(/\/\/.*$/gm, '')`: `https://localhost:4000` dentro una
 *    stringa contiene `//`, e un taglio ingenuo cancellerebbe il resto della riga — cioè
 *    potrebbe NASCONDERE proprio l'occorrenza che il test cerca. Un test di unicità che
 *    perde occorrenze è peggio di nessun test: è verde e rassicurante.
 *
 * Automa a stati minimo: codice, stringa (con apice, virgolette o backtick), commento di
 * riga, commento di blocco, commento HTML. Non gestisce le regex letterali — in questo
 * progetto non ce ne sono, e una regex che contenesse `//` sarebbe comunque vuota.
 */
export function senzaCommenti(testo) {
  let fuori = '';
  let i = 0;
  let stato = 'codice';
  let delimitatore = '';

  while (i < testo.length) {
    const c = testo[i];
    const due = testo.slice(i, i + 2);

    if (stato === 'codice') {
      if (due === '//') { stato = 'riga'; i += 2; continue; }
      if (due === '/*') { stato = 'blocco'; i += 2; continue; }
      if (testo.startsWith('<!--', i)) { stato = 'html'; i += 4; continue; }
      if (c === '"' || c === "'" || c === '`') { stato = 'stringa'; delimitatore = c; }
      fuori += c;
      i += 1;
      continue;
    }

    if (stato === 'stringa') {
      if (c === '\\') { fuori += testo.slice(i, i + 2); i += 2; continue; }
      if (c === delimitatore) stato = 'codice';
      fuori += c;
      i += 1;
      continue;
    }

    if (stato === 'riga') {
      if (c === '\n') { stato = 'codice'; fuori += c; }
      i += 1;
      continue;
    }

    if (stato === 'blocco') {
      if (due === '*/') { stato = 'codice'; i += 2; continue; }
      if (c === '\n') fuori += c; // le righe restano allineate
      i += 1;
      continue;
    }

    // html
    if (testo.startsWith('-->', i)) { stato = 'codice'; i += 3; continue; }
    if (c === '\n') fuori += c;
    i += 1;
  }

  return fuori;
}

/** Tutti i sorgenti applicativi, come percorsi relativi a `sito/` con separatori `/`. */
export function sorgenti() {
  const trovati = [];
  const cammina = (cartella) => {
    for (const voce of readdirSync(cartella)) {
      const percorso = join(cartella, voce);
      if (statSync(percorso).isDirectory()) {
        if (['node_modules', 'dist', '.astro', 'test'].includes(voce)) continue;
        cammina(percorso);
      } else if (ESTENSIONI.has(extname(voce))) {
        trovati.push(relative(radiceSito, percorso).split('\\').join('/'));
      }
    }
  };
  for (const cartella of CARTELLE) {
    const assoluta = join(radiceSito, cartella);
    if (existsSync(assoluta)) cammina(assoluta);
  }
  return trovati.sort();
}

/** I sorgenti che contengono `ago`, ignorando i commenti. Ordinati, per confronti stabili. */
export function sorgentiCheContengono(ago) {
  return sorgenti().filter((percorso) =>
    senzaCommenti(readFileSync(join(radiceSito, percorso), 'utf8')).includes(ago)
  );
}
