// Prova 5.8 — la scheda di rete: quante richieste di carattere partono, e verso chi.
//
// Il test automatico (test/font.test.mjs) guarda gli ARTEFATTI: nessun dominio esterno nei
// file generati. Questa guarda il RUNTIME: cosa il browser chiede davvero. Sono due prove
// diverse dello stesso fatto e servono entrambe — un file pulito che genera una richiesta a
// terzi è possibile (un @import annidato, un CSS iniettato), e l'artefatto non lo mostra.
//
// Playwright arriva da duedgusto/, per percorso esplicito: il task 12.12 pretende che
// sito/package.json non contenga alcun automatore di browser.
// ⚠️ Playwright è CommonJS: l'import nominato fallisce, serve il default e poi la
// destrutturazione. È la prima cosa che si sbaglia importandolo per percorso.
import playwright from '../../../../duedgusto/node_modules/playwright/index.js';
const { chromium } = playwright;

const INDIRIZZO = process.argv[2] ?? 'http://localhost:4321/';

const browser = await chromium.launch();
const pagina = await browser.newPage();

const richieste = [];
pagina.on('request', (r) => {
  if (r.resourceType() === 'font') richieste.push({ url: r.url(), host: new URL(r.url()).host });
});

await pagina.goto(INDIRIZZO, { waitUntil: 'networkidle' });

console.log(`Pagina: ${INDIRIZZO}`);
console.log(`Richieste di carattere: ${richieste.length}`);
for (const r of richieste) console.log(`  ${r.host.padEnd(24)} ${new URL(r.url).pathname}`);

const esterne = richieste.filter((r) => /gstatic|googleapis|fonts\.google/.test(r.host));
console.log(`Verso domini esterni: ${esterne.length}`);

await pagina.screenshot({ path: new URL('./5.8-pagina-con-anton.png', import.meta.url).pathname.slice(1), fullPage: true });
await browser.close();

process.exit(esterne.length === 0 ? 0 : 1);
