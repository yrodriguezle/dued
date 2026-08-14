// Alza il sito **nella forma costruita**, contro un backend costruito, senza deployare.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// PERCHÉ ESISTE, dato che `npm run dev` c'è già.
//
// `npm run dev` alza i **dev server**: Astro serve i moduli non impacchettati e il backend
// gira da `bin/`. È la cosa giusta mentre si scrive, ed è la cosa **sbagliata** per
// verificare: i due falliscono in modi diversi, e in produzione va il secondo.
//
// Fra il dev server e il bundle cambiano cose che si vedono solo qui:
//   • `astro:env` **inlina le variabili nel bundle**, quindi `API_INTERNA_URL` è una
//     variabile di BUILD. Un dev server la rilegge, un bundle no;
//   • le URL dei caratteri e del CSS prendono un hash di contenuto, e il `<link rel=preload>`
//     deve puntare allo stesso file — cosa che nel dev server è vera per costruzione;
//   • il micro-cache e gli header di `Cache-Control` valgono sulle risposte vere.
//
// ⚠️ E il backend di sviluppo su `:4000` **non va bene** per verificare: se gira da prima di
//    un cambio del DTO pubblico, il sito nasce degradato e si misura una pagina che non è
//    quella vera. Qui se ne costruisce e se ne accende uno apposta, su una porta sua, senza
//    toccare quello che sta usando chi sviluppa.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE TRE TRAPPOLE CHE QUESTO FILE ESISTE PER TOGLIERE DI MEZZO
//
// 1. 🔴 **`pkill` non ferma i processi Node e dotnet su Windows.** Un server rimasto acceso
//    da una sessione precedente continua a rispondere `200` servendo la build **vecchia**, e
//    il sintomo è che le correzioni «non hanno effetto». Ne è stato trovato uno vivo da un
//    giorno intero. Qui le porte si liberano per PID, prima di ogni avvio.
//
// 2. 🔴 **Il backend acceso blocca `bin/`**: una `dotnet build` normale fallisce con un
//    errore di copia che non nomina la causa. Si costruisce in una cartella a parte.
//
// 3. 🔴 **`API_INTERNA_URL` è una variabile di BUILD**: passarla all'ambiente del server già
//    costruito non dà errore e non fa nulla — il sito continua a leggere l'origine con cui è
//    stato costruito. È il modo in cui una suite di prove diventa verde leggendo il backend
//    sbagliato. Qui il sito si **ricostruisce** ogni volta contro la porta scelta.
// ═══════════════════════════════════════════════════════════════════════════════════════
//
//   node scripts/anteprima.mjs           alza tutto e resta acceso (Ctrl+C per fermare)
//   node scripts/anteprima.mjs --prove   alza tutto, esegue le verifiche di browser, scende
//   node scripts/anteprima.mjs --seed    semina anche i menu (serve dopo una voce nuova)

import { spawnSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';

import { liberaPorta } from './libera-porte.mjs';

const radice = dirname(dirname(fileURLToPath(import.meta.url)));
const conProve = process.argv.includes('--prove');
const conSeed = process.argv.includes('--seed');

const PEM = join(radice, 'backend', '.certs', 'aspnet-dev.pem');
const PROVE = join(radice, 'openspec/changes/vetrina-redesign-mockup/prove/verifiche-di-browser.mjs');

// ── 🔴 Si rilancia da sé con la CA nell'ambiente ──────────────────────────────────────
//
// `NODE_EXTRA_CA_CERTS` va nell'ambiente **prima che Node parta**: la legge all'avvio del
// processo, e assegnarla a `process.env` a metà strada non ha alcun effetto. Questo script
// però la usa *lui stesso* — `fetch` verso il backend HTTPS, per sapere quando è pronto —
// e non solo per i figli, quindi non basta metterla nell'ambiente dei figli come fa
// `sito/scripts/dev.mjs`.
//
// ⚠️ La via sbagliata e allettante è `rejectUnauthorized: false`, o peggio
//    `NODE_TLS_REJECT_UNAUTHORIZED=0`: sono **vietati senza riserve** in questo progetto —
//    il secondo è globale al processo e si copia-incolla fra macchine finché non finisce in
//    un compose di produzione. Qui si AGGIUNGE un'autorità, non si toglie una difesa.
//
// Il sintomo, se questo blocco sparisse: «il backend non ha risposto», con il backend
// perfettamente acceso e funzionante.
if (existsSync(PEM) && process.env.NODE_EXTRA_CA_CERTS !== PEM) {
  const io = spawn(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_EXTRA_CA_CERTS: PEM },
  });
  io.on('exit', (codice, segnale) => process.exit(segnale ? 1 : (codice ?? 0)));
  // Nulla sotto deve girare in questo processo: è solo il guscio che ha rilanciato.
  await new Promise(() => {});
}

const figli = [];
let chiuso = false;

function log(riga) {
  console.log(riga);
}

// ── Le porte: si scelgono libere, e si liberano comunque ──────────────────────────────
//
// ⚠️ Non porte fisse a caso: si chiede al sistema una porta libera e si usa quella. Due
//    anteprime in parallelo non si pestano i piedi, e non c'è un numero da ricordare.
function portaLibera() {
  return new Promise((risolvi) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => risolvi(port));
    });
  });
}

/**
 * Libera una porta **davvero**, anche su Windows, e lo dice.
 *
 * 🔴 Il come sta in `scripts/libera-porte.mjs`, che è anche il gancio `predev` di
 *    `package.json`: la logica per sistema operativo esiste in UN posto solo. Due copie
 *    divergono, e la copia che diverge è sempre quella del ramo che si prova di meno —
 *    cioè Windows, dove `pkill` riferisce successo senza aver fatto nulla.
 */
function annunciaLiberaPorta(porta) {
  const abbattuti = liberaPorta(porta);
  if (abbattuti.length > 0) {
    log(`   porta ${porta}: fermato ${abbattuti.join(', ')}`);
  }
}

/** Attende che un indirizzo risponda, invece di dormire un tempo scelto a caso. */
async function attendi(url, cosa, tentativi = 150) {
  for (let i = 0; i < tentativi; i++) {
    try {
      const r = await fetch(url);
      // Anche 404 e 503 vanno bene: dicono che qualcuno ascolta e sta rispondendo.
      if (r.status < 500 || r.status === 503) return;
    } catch {
      /* non ancora in ascolto */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${cosa} non ha risposto su ${url}`);
}

function esegui(comando, argomenti, opzioni = {}) {
  const esito = spawnSync(comando, argomenti, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opzioni,
  });
  if (esito.status !== 0) {
    throw new Error(`"${comando} ${argomenti.join(' ')}" è uscito con ${esito.status}`);
  }
}

function avvia(comando, argomenti, opzioni) {
  const figlio = spawn(comando, argomenti, {
    stdio: 'ignore',
    shell: process.platform === 'win32',
    ...opzioni,
  });
  figli.push(figlio);
  return figlio;
}

function chiudi(codice) {
  if (chiuso) return;
  chiuso = true;
  log('\n⏹  chiusura…');
  figli.forEach((f) => {
    try {
      f.kill();
    } catch {
      /* già morto */
    }
  });
  // 🔴 E poi per porta: su Windows `kill()` sul processo che abbiamo lanciato non basta
  //    quando quello ha generato figli suoi (dotnet lo fa). Senza questa seconda passata la
  //    porta resta occupata e l'anteprima successiva serve la build vecchia.
  [porteScelte.backend, porteScelte.sito].filter(Boolean).forEach((porta) => liberaPorta(porta));
  process.exit(codice);
}

const porteScelte = { backend: null, sito: null };

process.on('SIGINT', () => chiudi(0));
process.on('SIGTERM', () => chiudi(0));

// ══════════════════════════════════════════════════════════════════════════════════════

try {
  if (!existsSync(PEM)) {
    console.error(`⛔  Manca il certificato di sviluppo: ${PEM}`);
    console.error('    Si esporta una volta per macchina:\n');
    console.error('    cd backend && mkdir .certs');
    console.error('    dotnet dev-certs https --export-path ./.certs/aspnet-dev.pem --format PEM --no-password\n');
    process.exit(1);
  }

  porteScelte.backend = await portaLibera();
  porteScelte.sito = await portaLibera();

  log('🔓  libero le porte (su Windows `pkill` non le libera, e il server vecchio resta)');
  annunciaLiberaPorta(porteScelte.backend);
  annunciaLiberaPorta(porteScelte.sito);

  // ── (1) Il backend, costruito FUORI da bin/ ─────────────────────────────────────────
  const uscita = mkdtempSync(join(tmpdir(), 'anteprima-backend-'));
  log(`\n🔨  costruisco il backend in ${uscita}`);
  log('    (fuori da bin/, che il backend di sviluppo tiene bloccato)');
  esegui('dotnet', ['build', 'duedgusto.csproj', '-o', uscita, '-v', 'quiet', '--nologo'], {
    cwd: join(radice, 'backend'),
  });

  log(`\n▶️   backend su https://localhost:${porteScelte.backend}`);
  log(`    seed dei menu: ${conSeed ? 'SÌ (--seed)' : 'no'}`);
  avvia('dotnet', [join(uscita, 'duedgusto.dll')], {
    cwd: join(radice, 'backend'),
    env: {
      ...process.env,
      ASPNETCORE_URLS: `https://localhost:${porteScelte.backend}`,
      ASPNETCORE_ENVIRONMENT: 'Development',
      // ⚠️ Le migrazioni girano SEMPRE all'avvio, anche senza seed: è il modo in cui una
      //    colonna nuova arriva al database di sviluppo senza comandi a mano.
      SEED_ON_STARTUP: conSeed ? 'true' : 'false',
    },
  });
  await attendi(`https://localhost:${porteScelte.backend}/api/public/site`, 'il backend');
  log('    ✓ risponde');

  // ── (2) Il sito, COSTRUITO contro quella porta ──────────────────────────────────────
  log(`\n🔨  costruisco il sito contro https://localhost:${porteScelte.backend}`);
  log("    (API_INTERNA_URL è una variabile di BUILD: passarla al server non farebbe nulla)");
  esegui('npx', ['astro', 'build'], {
    cwd: join(radice, 'sito'),
    env: {
      ...process.env,
      API_INTERNA_URL: `https://localhost:${porteScelte.backend}`,
      NODE_EXTRA_CA_CERTS: PEM,
    },
  });

  log(`\n▶️   sito su http://127.0.0.1:${porteScelte.sito}`);
  avvia('node', ['dist/server/entry.mjs'], {
    cwd: join(radice, 'sito'),
    env: {
      ...process.env,
      PORT: String(porteScelte.sito),
      HOST: '127.0.0.1',
      NODE_EXTRA_CA_CERTS: PEM,
    },
  });
  await attendi(`http://127.0.0.1:${porteScelte.sito}/`, 'il sito');
  log('    ✓ risponde');

  const base = `http://127.0.0.1:${porteScelte.sito}`;
  log('\n═══════════════════════════════════════════════════════════');
  log(`  sito      ${base}`);
  log(`  backend   https://localhost:${porteScelte.backend}`);
  log('═══════════════════════════════════════════════════════════');
  log('  /  ·  /menu  ·  /aperitivo  ·  /locale  ·  /contatti  ·  /sitemap.xml');
  log('');
  log('  ⚠️  /aperitivo e /locale rispondono 404 finché i loro testi non sono');
  log('      compilati dal pannello Sito — e in quel caso non compaiono nemmeno');
  log('      in navigazione. Non è un guasto.');

  if (conProve) {
    log('\n🔬  verifiche di browser…\n');
    const esito = spawnSync('node', [PROVE, base], { stdio: 'inherit' });
    chiudi(esito.status ?? 1);
  } else {
    log('\n   Ctrl+C per fermare tutto.\n');
  }
} catch (errore) {
  console.error(`\n⛔  ${errore.message}`);
  chiudi(1);
}
