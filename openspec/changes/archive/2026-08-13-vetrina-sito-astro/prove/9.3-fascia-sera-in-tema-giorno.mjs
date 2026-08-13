// Prova 9.3 — la fascia "Aperitivo" in registro sera dentro una pagina in tema giorno.
//
// 🔴 È l'unico posto in cui la differenza fra `@theme` e `@theme inline` si vede a OCCHIO.
//    Con `@theme` semplice le utility di colore dentro la fascia resterebbero crema-e-oliva
//    — una fascia che dovrebbe essere lavagna, dipinta con i colori del giorno — e non ci
//    sarebbe alcun errore da nessuna parte: la pagina si renderizza, i test sulla pagina
//    intera passano, e sembra una scelta editoriale.
//
// Il test sul CSS generato lo ha già provato (Fase 4). Questa è la stessa cosa guardata.
import playwright from '../../../../duedgusto/node_modules/playwright/index.js';
const { chromium } = playwright;

const INDIRIZZO = process.argv[2] ?? 'http://127.0.0.1:4399/';
const cartella = new URL('.', import.meta.url).pathname.slice(1);

const browser = await chromium.launch();
const pagina = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
await pagina.goto(INDIRIZZO, { waitUntil: 'networkidle' });

const colori = (selettore) =>
  pagina.$eval(selettore, (n) => {
    const s = getComputedStyle(n);
    return { sfondo: s.backgroundColor, testo: s.color };
  });

let differenze = 0;
for (const registro of ['giorno', 'sera']) {
  await pagina.evaluate((r) => document.documentElement.setAttribute('data-tema', r), registro);

  const pagina_ = await colori('body');
  const fascia = await colori('section[data-tema="sera"]');
  const titoloFascia = await colori('section[data-tema="sera"] h2');

  console.log(`\n── pagina in tema ${registro} ──`);
  console.log('  body   ', pagina_);
  console.log('  fascia ', fascia);
  console.log('  titolo ', titoloFascia);

  // La fascia deve essere LAVAGNA in entrambi i casi: #251C19 = rgb(37, 28, 25).
  const eLavagna = fascia.sfondo === 'rgb(37, 28, 25)';
  // E il suo titolo deve portare il gesso giallo: #FDDB5B = rgb(253, 219, 91).
  const eGesso = titoloFascia.testo === 'rgb(253, 219, 91)';
  console.log(`  fascia lavagna? ${eLavagna}   titolo gesso giallo? ${eGesso}`);
  if (!eLavagna || !eGesso) differenze++;

  await pagina.screenshot({ path: `${cartella}9.3-home-${registro}.png`, fullPage: true });
}

// E la prova che il caso è davvero misto: in tema giorno il corpo è crema e la fascia no.
await pagina.evaluate(() => document.documentElement.setAttribute('data-tema', 'giorno'));
const corpo = await colori('body');
const fascia = await colori('section[data-tema="sera"]');
console.log(`\nIn tema giorno il corpo è ${corpo.sfondo} e la fascia ${fascia.sfondo}`);
console.log('Sono diversi?', corpo.sfondo !== fascia.sfondo);
if (corpo.sfondo === fascia.sfondo) differenze++;

console.log(`\nDIFFERENZE: ${differenze}`);
await browser.close();
process.exit(differenze === 0 ? 0 : 1);
