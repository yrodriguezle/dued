// Avvia il sito in sviluppo — o il bundle di prova, con `--prova`.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// PERCHÉ QUESTO FILE ESISTE, invece di `"dev": "astro dev"`.
//
// 🔴 Per UNA ragione tecnica: `NODE_EXTRA_CA_CERTS` va nell'ambiente PRIMA che Node
//    parta. Node la legge all'avvio del processo, prima che Astro carichi qualunque
//    `.env` — scriverla lì produce un file che sembra configurato e un `fetch failed`
//    senza causa. Qui la variabile è impostata nel padre, e il figlio la eredita al
//    proprio avvio, che è l'unico momento in cui conta.
//
// E ne sfrutta una seconda gratis: è l'unico punto del progetto che vede entrambi i
// prefissi all'avvio, quindi è l'unico che può accorgersi che coincidono.
//
// ⚠️ Il backend di sviluppo è HTTPS con il certificato self-signed di ASP.NET. La
//    soluzione è AGGIUNGERE quella CA all'ambiente, mai spegnere la verifica:
//    NODE_TLS_REJECT_UNAUTHORIZED è vietato senza riserve (§D3), ed è globale al
//    processo — spegnerebbe TLS per ogni connessione, non solo per questa.
// ─────────────────────────────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

const radiceSito = dirname(dirname(fileURLToPath(import.meta.url)));
const prova = process.argv.includes('--prova');

// ── Le variabili effettive ────────────────────────────────────────────────────────────
// `.env` come base, l'ambiente reale sopra: così `PUBLIC_MEDIA_ORIGINE=… npm run dev`
// funziona, ed è il comando che l'avviso qui sotto suggerisce.
function leggiDotEnv(percorso) {
  if (!existsSync(percorso)) return {};
  const valori = {};
  for (const riga of readFileSync(percorso, 'utf8').split('\n')) {
    const pulita = riga.trim();
    if (!pulita || pulita.startsWith('#')) continue;
    const taglio = pulita.indexOf('=');
    if (taglio < 1) continue;
    valori[pulita.slice(0, taglio).trim()] = pulita
      .slice(taglio + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return valori;
}

const daFile = leggiDotEnv(resolve(radiceSito, '.env'));
const valore = (nome) => process.env[nome] ?? daFile[nome];

const apiInterna = valore('API_INTERNA_URL');
const mediaOrigine = valore('PUBLIC_MEDIA_ORIGINE');

// ── (1) Il certificato: se manca, si stampa il comando, non un fetch failed ───────────
const pemDichiarato = valore('NODE_EXTRA_CA_CERTS') ?? '../backend/.certs/aspnet-dev.pem';
const pem = resolve(radiceSito, pemDichiarato);

if (!existsSync(pem)) {
  const serve = (apiInterna ?? '').startsWith('https:');
  console.error('');
  console.error(`⛔  Il certificato di sviluppo non c'è: ${relative(radiceSito, pem)}`);
  console.error('');
  console.error('    Senza, ogni lettura verso il backend muore con «fetch failed» e nessuna causa.');
  console.error('    Si esporta una volta per macchina, e il comando è questo:');
  console.error('');
  console.error('        cd backend');
  console.error('        mkdir .certs');
  console.error('        dotnet dev-certs https --export-path ./.certs/aspnet-dev.pem --format PEM --no-password');
  console.error('');
  if (serve) {
    console.error(`    (${'API_INTERNA_URL'} è in https, quindi serve davvero. Uscita.)`);
    console.error('');
    process.exit(1);
  }
  console.error(`    (${'API_INTERNA_URL'} non è in https: si prosegue senza.)`);
  console.error('');
} else {
  // ── (2) La CA nell'ambiente, prima che il figlio parta ─────────────────────────────
  process.env.NODE_EXTRA_CA_CERTS = pem;
}

// ── (3) 🔴 L'avviso che si accende dove i due prefissi coincidono ─────────────────────
// Non è una guardia — è lecito che coincidano in sviluppo. È una diagnosi che compare
// da sé nel punto in cui il problema è per definizione invisibile.
if (apiInterna && mediaOrigine && apiInterna === mediaOrigine) {
  console.warn('');
  console.warn(`⚠️   I due prefissi coincidono (${apiInterna}).`);
  console.warn('     È lecito in sviluppo e sarà un guasto invisibile in produzione: ogni <img> del');
  console.warn("     sito porterebbe l'host interno del backend. Per provarli distinti:");
  console.warn('');
  console.warn(`         PUBLIC_MEDIA_ORIGINE=https://192.168.1.42:4000 npm run ${prova ? 'start:prova' : 'dev'}`);
  console.warn('');
}

// ── (4) Il figlio ─────────────────────────────────────────────────────────────────────
const [comando, argomenti] = prova
  ? [process.execPath, ['dist/server/entry.mjs']]
  : ['npx', ['astro', 'dev']];

const figlio = spawn(comando, argomenti, {
  cwd: radiceSito,
  stdio: 'inherit',
  shell: process.platform === 'win32', // `npx` su Windows è `npx.cmd`
  env: process.env,
});

figlio.on('exit', (codice, segnale) => process.exit(segnale ? 1 : (codice ?? 0)));
