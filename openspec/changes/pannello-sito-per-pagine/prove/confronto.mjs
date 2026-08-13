// Il confronto del task 4.8: le dieci catture del «prima» contro le dieci del «dopo».
//
// 🔴 Perché è un file e non una lettura a occhio. La spec `sito-pubblico` pretende che la prova
//    di non regressione sia un **confronto**, e la ragione è la forma del guasto che questo
//    change rischia: un contenuto azzerato da un salvataggio che non lo mostrava si manifesta
//    come una pagina *quasi* uguale. Quasi non si vede.
//
// 🔴 **L'attesa è RISCRITTA, non allentata, e la differenza è tutto.** Una cella su cinquanta
//    cambia — `/aperitivo` nello stato *pubblicato* perde l'immagine di testata, per la
//    decisione annotata al task 2.2 — e la si dichiara qui **per esteso**: quella pagina passa
//    da un elenco preciso di chiavi a un elenco **vuoto**, e ogni altro suo attributo (codice
//    HTTP, politica di cache, navigazione di intestazione e piè di pagina) resta sorvegliato
//    come tutti gli altri. Un confronto reso *permissivo* su quella pagina — «ignora
//    /aperitivo» — smetterebbe di sorvegliare anche tutto il resto di quella pagina, che è
//    esattamente il modo in cui una prova diventa inutile senza che nessuno se ne accorga.
//
// Uso:  node confronto.mjs        (esce 0 se il «dopo» è quello atteso, 1 altrimenti)

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = dirname(fileURLToPath(import.meta.url));
const leggi = (stato) =>
  JSON.parse(readFileSync(resolve(RADICE, stato, 'riepilogo.json'), 'utf8'));

/** Le chiavi immagine con il tag che le porta: l'ordine di documento è parte dell'attesa. */
const immaginiDi = (pagina) => pagina.immagini.map((i) => `${i.tag}:${i.chiave}`);

/**
 * 🔴 L'unica differenza attesa dell'intero change, scritta per esteso.
 *
 * Prima: `/aperitivo` rendeva `galleria.at(-1)` — l'ultima foto della galleria — dentro un
 * `<picture>`, quindi due volte (la `<source>` webp e l'`<img>` di ripiego). Dopo: **niente**,
 * finché l'amministratore non valorizza lo slot dalla scheda della pagina.
 *
 * ⚠️ Riguarda **solo** lo stato *pubblicato*. Nello stato *svuotato* quella pagina è già 404 e
 *    non rende immagini né prima né dopo: là l'attesa resta «identica», e se cambiasse sarebbe
 *    una regressione vera.
 */
const DIFFERENZE_ATTESE = [
  {
    stato: 'pubblicato',
    percorso: '/aperitivo',
    campo: 'immagini',
    perche:
      'l’eroe dell’aperitivo non ha più ripiego posizionale (task 2.2): a slot vuoto la ' +
      'pagina esce senza immagine di testata',
    // Il «dopo» atteso, alla lettera. Non «meno immagini di prima», non «qualsiasi cosa»:
    // l'elenco vuoto. Se un giorno una foto ricomparisse qui, questo confronto sarebbe rosso.
    atteso: [],
  },
];

const problemi = [];
const differenzeOnorate = new Set();

for (const stato of ['pubblicato', 'svuotato']) {
  const prima = leggi(`prima/${stato}`);
  const dopo = leggi(`dopo/${stato}`);

  console.log(`\n═══ stato «${stato}» ═══`);

  for (const pa of prima.pagine) {
    const pb = dopo.pagine.find((x) => x.percorso === pa.percorso);
    if (!pb) {
      problemi.push(`[${stato}] ${pa.percorso}: la pagina non compare nel «dopo»`);
      continue;
    }

    const campi = [
      ['stato', pa.stato, pb.stato],
      ['cacheControl', pa.cacheControl, pb.cacheControl],
      ['immagini', immaginiDi(pa), immaginiDi(pb)],
      ['navIntestazione', pa.navIntestazione, pb.navIntestazione],
      ['navPiePagina', pa.navPiePagina, pb.navPiePagina],
    ];

    const note = [];
    for (const [campo, valorePrima, valoreDopo] of campi) {
      if (JSON.stringify(valorePrima) === JSON.stringify(valoreDopo)) continue;

      const attesa = DIFFERENZE_ATTESE.find(
        (d) => d.stato === stato && d.percorso === pa.percorso && d.campo === campo
      );

      if (!attesa) {
        problemi.push(
          `[${stato}] ${pa.percorso} · ${campo}: ${JSON.stringify(valorePrima)} → ` +
            JSON.stringify(valoreDopo)
        );
        note.push(`✗ ${campo} cambiato e NON atteso`);
        continue;
      }

      if (JSON.stringify(valoreDopo) !== JSON.stringify(attesa.atteso)) {
        problemi.push(
          `[${stato}] ${pa.percorso} · ${campo}: cambia come previsto ma non in ciò che era ` +
            `previsto — atteso ${JSON.stringify(attesa.atteso)}, trovato ${JSON.stringify(valoreDopo)}`
        );
        note.push(`✗ ${campo} cambiato in modo diverso dall'attesa riscritta`);
        continue;
      }

      differenzeOnorate.add(`${stato}|${pa.percorso}|${campo}`);
      note.push(`△ ${campo}: differenza ATTESA — ${attesa.perche}`);
    }

    console.log(`  ${note.length ? '△' : '✓'} ${pa.percorso.padEnd(11)} ${note.join('; ') || 'identica su tutti e cinque i campi'}`);
  }

  for (const [nome, valorePrima, valoreDopo] of [
    ['sitemap', prima.sitemap, dopo.sitemap],
    ['galleriaSorgente', prima.galleriaSorgente, dopo.galleriaSorgente],
  ]) {
    const uguale = JSON.stringify(valorePrima) === JSON.stringify(valoreDopo);
    if (!uguale) problemi.push(`[${stato}] ${nome}: ${JSON.stringify(valorePrima)} → ${JSON.stringify(valoreDopo)}`);
    console.log(`  ${uguale ? '✓' : '✗'} ${nome.padEnd(11)} ${uguale ? `identica (${valoreDopo.length} voci)` : 'DIVERSA'}`);
  }
}

// ⚠️ Una differenza attesa che NON si verifica è un problema quanto una inattesa: significa che
//    il ripiego è rientrato dalla finestra, e il confronto lo direbbe tacendo.
for (const attesa of DIFFERENZE_ATTESE) {
  const chiave = `${attesa.stato}|${attesa.percorso}|${attesa.campo}`;
  if (!differenzeOnorate.has(chiave)) {
    problemi.push(
      `[${attesa.stato}] ${attesa.percorso} · ${attesa.campo}: la differenza DICHIARATA non si ` +
        'è verificata — il vecchio comportamento è tornato?'
    );
  }
}

console.log('');
if (problemi.length === 0) {
  console.log('✓ Le dieci catture sono quelle attese: nove identiche, una diversa come dichiarato.');
  process.exit(0);
}
console.error(`✗ ${problemi.length} difformità:`);
problemi.forEach((p) => console.error(`   ${p}`));
process.exit(1);
