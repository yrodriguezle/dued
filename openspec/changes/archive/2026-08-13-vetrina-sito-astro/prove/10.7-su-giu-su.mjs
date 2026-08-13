// Prova 10.7 — la pagina degradata NON resta congelata dopo il ripristino.
//
// È la proprietà che `no-store` esiste per garantire, e si vede solo facendo il giro
// completo: **su → giù → su**. Con la cache dichiarata a 60 secondi e senza `no-store` sul
// ramo degradato, il visitatore continuerebbe a vedere la pagina rotta per un minuto DOPO
// che il backend è tornato — cioè il guasto durerebbe più del guasto.
//
// ⚠️ Il backend di chi sviluppa (`:4000`) NON si tocca: si usa il modo (b) del task 10.4,
//    una SECONDA istanza su 4012 avviata con `SEED_ON_STARTUP=false`, e si spegne QUELLA.
//
// ⚠️ `dotnet run` va lanciato con `--no-build`: l'istanza su 4000 tiene bloccata `bin/`, e
//    senza quel flag la seconda istanza muore provando a copiarci sopra l'eseguibile.
//
// Il sito va costruito puntando a 4012 (`API_INTERNA_URL` è una variabile di BUILD) e
// servito su una porta sua.

import { execSync, spawn } from 'node:child_process';
import playwright from '../../../../duedgusto/node_modules/playwright/index.js';
const { chromium } = playwright;

const SITO = process.argv[2] ?? 'http://127.0.0.1:4390';
const PORTA_BACKEND = process.argv[3] ?? '4012';
const CARTELLA_BACKEND = process.argv[4] ?? 'C:\\Users\\yalian\\Projects\\dued\\backend';

/**
 * Il pid in ascolto sulla porta, o `null`.
 *
 * ⚠️ `findstr` esce con codice 1 quando non trova nulla, e senza il try/catch `execSync`
 *    solleverebbe proprio nel momento in cui la risposta corretta è «nessuno» — cioè
 *    esattamente a metà di questa prova.
 */
function pid() {
  try {
    const righe = execSync(`netstat -ano | findstr :${PORTA_BACKEND}`, {
      encoding: 'utf8',
      shell: 'cmd.exe',
    })
      .split('\n')
      .filter((r) => r.includes('LISTENING'));
    return righe.length ? righe[0].trim().split(/\s+/).pop() : null;
  } catch {
    return null;
  }
}

function accendi() {
  spawn('dotnet', ['run', '--no-build', '--no-launch-profile'], {
    cwd: CARTELLA_BACKEND,
    env: {
      ...process.env,
      ASPNETCORE_URLS: `https://localhost:${PORTA_BACKEND}`,
      SEED_ON_STARTUP: 'false',
      ASPNETCORE_ENVIRONMENT: 'Development',
    },
    detached: true,
    stdio: 'ignore',
    shell: true,
  }).unref();
}

async function attendi(acceso) {
  for (let i = 0; i < 160; i++) {
    if (Boolean(pid()) === acceso) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

if (!pid()) {
  console.log('Il backend di prova non è in ascolto: lo accendo.');
  accendi();
  if (!(await attendi(true))) throw new Error(`nessun ascoltatore su ${PORTA_BACKEND}`);
}

const browser = await chromium.launch();
const pagina = await browser.newPage({ viewport: { width: 1000, height: 800 } });

// 🔴 SENZA QUESTA RIGA LA PROVA MISURA LA CACHE DEL BROWSER, non il server — ed è successo
//    al primo giro: spento il backend, `/` e `/menu` continuavano a rispondere `200` con i
//    prodotti veri, perché Chromium riusava la copia buona che si era tenuto per i 60
//    secondi di `max-age`. Sembrava che la degradazione non funzionasse.
//
//    Quel comportamento è **giusto e desiderabile** (è la cache che fa il suo lavoro), ma
//    non è ciò che questa prova deve guardare: qui si vuole sapere COSA DECIDE IL SERVER
//    quando il backend è giù, e cosa decide quando torna. Con `no-cache` il browser
//    rivalida a ogni richiesta.
await pagina.setExtraHTTPHeaders({ 'Cache-Control': 'no-cache', Pragma: 'no-cache' });

async function guarda(etichetta) {
  const risposte = {};
  for (const percorso of ['/', '/menu']) {
    const r = await pagina.goto(SITO + percorso, { waitUntil: 'domcontentloaded' });
    risposte[percorso] = {
      stato: r.status(),
      cache: r.headers()['cache-control'] ?? '',
      retry: r.headers()['retry-after'],
    };
  }
  const testo = await pagina.innerText('body');
  console.log(`\n── ${etichetta} ──`);
  console.log(`  /      ${risposte['/'].stato}  ${risposte['/'].cache}`);
  console.log(
    `  /menu  ${risposte['/menu'].stato}  ${risposte['/menu'].cache}` +
      (risposte['/menu'].retry ? `  Retry-After: ${risposte['/menu'].retry}` : '')
  );
  console.log(`  il menu nomina un prodotto vero? ${/Caff|Spritz|Mojito/i.test(testo)}`);
  return risposte;
}

const su1 = await guarda('backend SU');

const p = pid();
console.log(`\nSpengo il backend di prova (pid ${p})…`);
execSync(`taskkill /PID ${p} /F`, { shell: 'cmd.exe', stdio: 'ignore' });
await attendi(false);

const giu = await guarda('backend GIÙ');
await pagina.screenshot({
  path: new URL('./10.7-degradata.png', import.meta.url).pathname.slice(1),
  fullPage: true,
});

console.log('\nRiaccendo il backend di prova…');
accendi();
if (!(await attendi(true))) throw new Error('il backend di prova non è tornato');
console.log(`  di nuovo in ascolto (pid ${pid()})`);

// ⚠️ Nessuna attesa di TTL: si ricarica SUBITO. È il punto della prova.
const su2 = await guarda('backend di nuovo SU, senza attendere alcun TTL');

const ok =
  su1['/'].stato === 200 &&
  su1['/menu'].stato === 200 &&
  giu['/'].stato === 200 &&
  giu['/menu'].stato === 503 &&
  giu['/'].cache.includes('no-store') &&
  giu['/menu'].cache.includes('no-store') &&
  su2['/'].stato === 200 &&
  su2['/menu'].stato === 200 &&
  su2['/menu'].cache.includes('max-age=60');

console.log(`\nIl giro su → giù → su si è chiuso senza congelamenti? ${ok}`);
await browser.close();
process.exit(ok ? 0 : 1);
