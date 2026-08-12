// Prova B (task 8.9) — i due prefissi DIVERSI, entrambi funzionanti.
//
// La prova A è un'asserzione sul markup e non tocca la rete. Questa è l'altra metà, ed è
// quella umana: con `API_INTERNA_URL` su `localhost` e `PUBLIC_MEDIA_ORIGINE` sull'IP di
// rete, la pagina si renderizza (il SERVER ha letto) **e** le immagini caricano davvero (il
// BROWSER ha letto, da un altro host). È la configurazione che avremo in produzione.
//
// ⚠️ Il certificato di sviluppo non nomina l'IP di rete fra i suoi SAN: il browser
//    protesterebbe una volta e l'utente accetterebbe. `ignoreHTTPSErrors` è quel clic.
import playwright from '../../../../duedgusto/node_modules/playwright/index.js';
const { chromium } = playwright;

const SITO = process.argv[2] ?? 'http://127.0.0.1:4399/menu';
const IP_RETE = process.argv[3] ?? '192.168.1.232';

const browser = await chromium.launch();
const pagina = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 900 } });

const richieste = [];
pagina.on('response', (r) => {
  if (r.request().resourceType() === 'image') richieste.push({ stato: r.status(), url: r.url() });
});

await pagina.goto(SITO, { waitUntil: 'networkidle' });

const testo = await pagina.innerText('body');
console.log('La pagina si è renderizzata?', /Menu/.test(testo) && /Caffè espresso/.test(testo));

console.log('\nImmagini richieste:');
for (const r of richieste) console.log(`  ${r.stato}  ${r.url}`);

const sullIp = richieste.filter((r) => r.url.includes(IP_RETE));
const caricate = sullIp.filter((r) => r.stato === 200);
console.log(`\nSull'IP di rete (${IP_RETE}): ${sullIp.length}   di cui 200: ${caricate.length}`);

// E la conferma che le due origini sono davvero DUE: il markup non nomina localhost:4000.
const html = await pagina.content();
console.log("Il markup nomina l'host dell'API (localhost:4000)?", html.includes('localhost:4000'));

// Le immagini hanno una dimensione reale? Un 404 renderebbe naturalWidth = 0.
const dimensioni = await pagina.$$eval('picture img', (n) => n.map((i) => i.naturalWidth));
console.log('naturalWidth delle <img>:', dimensioni);

await pagina.screenshot({ path: new URL('./8.9-due-prefissi-diversi.png', import.meta.url).pathname.slice(1), fullPage: true });
await browser.close();

const ok = sullIp.length > 0 && sullIp.length === caricate.length && dimensioni.every((d) => d > 0);
process.exit(ok ? 0 : 1);
