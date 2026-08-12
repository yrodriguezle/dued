// Riscarica i tre caratteri e ne verifica le impronte.
//
// ⚠️ NON gira durante la build, e non deve. È uno script a sé: i tre `.woff2` sono
//    committati, e il loro scarico è un'operazione che si fa quando si vuole aggiornarli o
//    controllare che quelli in albero siano ancora quelli dichiarati. Una build che
//    scaricasse font da Internet sarebbe una build che fallisce quando Google ha un brutto
//    giorno, e un sito che dipende da un terzo proprio nel criterio che dice di non farlo.
//
// 🔴 Le impronte non sono scritte qui: si leggono da `PROVENIENZA.md`, che è il documento
//    che un umano guarda. Se stessero in due posti, un giorno divergerebbero e vincerebbe
//    quello sbagliato — cioè questo, che nessuno legge.
//
// Zero dipendenze: `fetch` e `node:crypto` del runtime.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const radiceSito = dirname(dirname(fileURLToPath(import.meta.url)));
const cartellaFont = join(radiceSito, 'src/assets/fonts');
const provenienza = join(cartellaFont, 'PROVENIENZA.md');

// ⚠️ Con uno user-agent vecchio `fonts.googleapis.com` risponde con `.ttf` invece che con
//    `.woff2`: è negoziazione del contenuto, e senza questa riga si scaricherebbero file
//    dieci volte più grandi e con un altro formato, senza alcun errore.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/131.0.0.0 Safari/537.36';

/** Legge dal documento le triple (file, URL, sha256). È l'unica sorgente di verità. */
function dichiarati() {
  const testo = readFileSync(provenienza, 'utf8');
  const schema = /^(\S+\.woff2)\n\s+(https:\/\/\S+)\n\s+sha256\s+([0-9a-f]{64})$/gm;
  const trovati = [...testo.matchAll(schema)].map(([, nome, url, sha256]) => ({
    nome,
    url,
    sha256,
  }));
  if (trovati.length === 0) {
    throw new Error(
      `Nessuna terna file/URL/sha256 in ${relative(radiceSito, provenienza)}: il formato ` +
        'del blocco è cambiato, e questo script lo legge invece di duplicarlo.'
    );
  }
  return trovati;
}

const soloVerifica = process.argv.includes('--verifica');
const font = dichiarati();
let problemi = 0;

console.log(
  `${soloVerifica ? 'Verifico' : 'Scarico'} ${font.length} caratteri dichiarati in ` +
    `${relative(radiceSito, provenienza)}\n`
);

for (const { nome, url, sha256 } of font) {
  const destinazione = join(cartellaFont, nome);
  let contenuto;

  if (soloVerifica) {
    if (!existsSync(destinazione)) {
      console.error(`✗ ${nome}  — manca dall'albero`);
      problemi++;
      continue;
    }
    contenuto = readFileSync(destinazione);
  } else {
    const risposta = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!risposta.ok) {
      console.error(`✗ ${nome}  — HTTP ${risposta.status} da ${url}`);
      problemi++;
      continue;
    }
    contenuto = Buffer.from(await risposta.arrayBuffer());
  }

  const impronta = createHash('sha256').update(contenuto).digest('hex');

  if (impronta !== sha256) {
    console.error(`✗ ${nome}  — impronta diversa da quella dichiarata`);
    console.error(`    attesa   ${sha256}`);
    console.error(`    trovata  ${impronta}  (${contenuto.length} byte)`);
    // 🔴 Non si sovrascrive. Se Google pubblica una revisione nuova, la versione dentro
    //    l'URL cambia: un'impronta diversa a URL invariata è un fatto da guardare, non da
    //    accettare in silenzio sovrascrivendo il file in albero.
    problemi++;
    continue;
  }

  if (!soloVerifica) writeFileSync(destinazione, contenuto);
  console.log(`✓ ${nome.padEnd(34)} ${String(contenuto.length).padStart(6)} byte`);
}

if (problemi > 0) {
  console.error(
    `\n${problemi} problemi. Nessun file è stato sovrascritto: aggiorna PROVENIENZA.md ` +
      'con la versione e le impronte nuove, dopo aver guardato cosa è cambiato.'
  );
  process.exit(1);
}

console.log('\nTutte le impronte corrispondono.');
