// Prova 8.6 — IL DELIVERABLE: `/menu` nel browser, confrontata UNO PER UNO con l'API.
//
// Non uno screenshot che «sembra giusto»: ogni prodotto della risposta viene cercato nella
// pagina con il suo nome, il suo prezzo, la sua descrizione, i suoi allergeni e i suoi
// marcatori. E ogni immagine deve rispondere 200 — non l'`alt` di un 404, che a colpo
// d'occhio somiglia a un'immagine che «non è ancora stata caricata».
import playwright from '../../../../duedgusto/node_modules/playwright/index.js';
const { chromium } = playwright;

const SITO = process.argv[2] ?? 'http://127.0.0.1:4399/menu';
const API = process.argv[3] ?? 'https://localhost:4000/api/public/menu';
const cartella = new URL('.', import.meta.url).pathname.slice(1);

const menu = await (await fetch(API)).json();

const browser = await chromium.launch();
const pagina = await browser.newPage({ viewport: { width: 1100, height: 900 } });

const immagini = [];
pagina.on('response', (r) => {
  if (r.request().resourceType() === 'image') immagini.push({ stato: r.status(), url: r.url() });
});

await pagina.goto(SITO, { waitUntil: 'networkidle' });
const testo = await pagina.innerText('body');

const euro = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
let differenze = 0;
const esito = (ok, etichetta) => { if (!ok) differenze++; return ok ? '  ok  ' : ' DIFF '; };

console.log(`API: ${menu.totaleProdottiPubblicati} prodotti pubblicati, troncato=${menu.troncato}\n`);

for (const categoria of menu.categorie) {
  console.log(`${esito(testo.includes(categoria.nome))} categoria «${categoria.nome}»`);
  for (const p of categoria.prodotti) {
    console.log(`${esito(testo.includes(p.nome))} nome        ${p.nome}`);
    console.log(`${esito(testo.includes(euro(p.prezzo)))} prezzo      ${euro(p.prezzo)}`);
    if (p.descrizione) console.log(`${esito(testo.includes(p.descrizione))} descrizione ${p.descrizione}`);
    if (p.allergeni) console.log(`${esito(testo.includes(p.allergeni))} allergeni   ${p.allergeni}`);
    if (p.novita) console.log(`${esito(/novit/i.test(testo))} marcatore   novità`);
    if (p.consigliato) console.log(`${esito(/consigliato/i.test(testo))} marcatore   consigliato`);
    if (p.immagine) {
      const chiesta = immagini.filter((i) => i.url.includes(p.immagine.chiave));
      console.log(`${esito(chiesta.length > 0 && chiesta.every((i) => i.stato === 200))} immagine    ${p.immagine.chiave} -> ${chiesta.map((i) => i.stato).join(',') || 'nessuna richiesta'}`);
    }
  }
}

console.log(`\nAvviso di troncamento in pagina: ${/Sono mostrati i primi/.test(testo)} (atteso ${menu.troncato})`);
if (/Sono mostrati i primi/.test(testo) !== menu.troncato) differenze++;

for (const registro of ['giorno', 'sera']) {
  await pagina.evaluate((r) => document.documentElement.setAttribute('data-tema', r), registro);
  await pagina.screenshot({ path: `${cartella}8.6-menu-${registro}.png`, fullPage: true });
}

console.log(`\nDIFFERENZE FRA API E PAGINA: ${differenze}`);
await browser.close();
process.exit(differenze === 0 ? 0 : 1);
