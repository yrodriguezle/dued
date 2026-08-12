// Prova 7.8 — un media REALE e il logo, nei due registri.
//
// Due guasti che nessuna build rivela: un `srcset` dedotto emette URL che rispondono 404 (e
// il browser sceglie proprio quelle sugli schermi densi), e un logo dentro `<img>` sparisce
// sul fondo lavagna perché `currentColor` non attraversa il confine di un documento isolato.
import playwright from '../../../../duedgusto/node_modules/playwright/index.js';
const { chromium } = playwright;

const INDIRIZZO = process.argv[2] ?? 'http://127.0.0.1:4399/prova-fase7';
const cartella = new URL('.', import.meta.url).pathname.slice(1);

const browser = await chromium.launch();
const pagina = await browser.newPage({ viewport: { width: 900, height: 800 } });

const immagini = [];
pagina.on('response', (r) => {
  if (r.request().resourceType() === 'image') immagini.push({ stato: r.status(), url: r.url() });
});

await pagina.goto(INDIRIZZO, { waitUntil: 'networkidle' });

console.log('— Risposte delle immagini —');
for (const i of immagini) console.log(`  ${i.stato}  ${new URL(i.url).pathname}`);
const rotte = immagini.filter((i) => i.stato !== 200);
console.log(`Immagini non 200: ${rotte.length}`);

// 🔴 Il logo deve essere <svg> nel DOM, non <img>.
const tagLogo = await pagina.$$eval('[role="img"][aria-label], [aria-hidden="true"]', (nodi) =>
  nodi.map((n) => (n.firstElementChild ? n.firstElementChild.tagName.toLowerCase() : n.tagName.toLowerCase()))
);
console.log('Primo figlio dei contenitori del logo:', tagLogo);
console.log('Ci sono <img> per il logo?', await pagina.$$eval('span img', (n) => n.length));

// Il colore calcolato del tracciato che usa currentColor, nei due registri.
const colore = () => pagina.$eval('svg', (s) => getComputedStyle(s).color);

for (const registro of ['giorno', 'sera']) {
  await pagina.evaluate((r) => document.documentElement.setAttribute('data-tema', r), registro);
  console.log(`registro ${registro}: color = ${await colore()}`);
  await pagina.screenshot({ path: `${cartella}7.8-${registro}.png`, fullPage: true });
}

await browser.close();
process.exit(rotte.length === 0 ? 0 : 1);
