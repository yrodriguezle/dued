// Attende che qualcuno ascolti su una porta, poi esce. Nient'altro.
//
//   node scripts/attendi-porta.mjs 4000 [secondi]
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// PERCHÉ SERVE
//
// In un compound di VS Code le configurazioni partono **insieme**: il sito fa la sua prima
// lettura mentre il backend sta ancora salendo, e il risultato è la pagina degradata —
// «alcune informazioni non sono raggiungibili», `/menu` a 503 — con nel log tre righe
// `ECONNREFUSED`. Si aggiusta al primo reload, ma la prima schermata che si vede aprendo il
// debugger è quella sbagliata, e sembra un guasto.
//
// ⚠️ Si aspetta il **socket TCP**, non una risposta HTTP, ed è deliberato: il backend è
//    HTTPS con il certificato di sviluppo, e una `fetch` da qui fallirebbe la verifica TLS a
//    meno di conoscere la CA — cioè servirebbe `NODE_EXTRA_CA_CERTS` prima che questo
//    processo parta, per attendere. Un socket che si apre è già la risposta alla domanda
//    «Kestrel è in ascolto?», che è tutto ciò che serve sapere per non partire troppo
//    presto.
//
// ⚠️ Non fallisce mai il chiamante: scaduto il tempo esce **0** con un avviso. Un task di
//    attesa che blocca l'avvio quando il backend non c'è trasformerebbe «il sito parte
//    degradato» in «il sito non parte», che è peggio.
// ═══════════════════════════════════════════════════════════════════════════════════════

import { connect } from 'node:net';

const porta = Number(process.argv[2]);
const secondi = Number(process.argv[3] ?? 60);

if (!Number.isInteger(porta) || porta <= 0) {
  console.error('Uso: node scripts/attendi-porta.mjs <porta> [secondi]');
  process.exit(1);
}

function inAscolto() {
  return new Promise((risolvi) => {
    const presa = connect({ port: porta, host: '127.0.0.1' });
    const chiudi = (esito) => {
      presa.destroy();
      risolvi(esito);
    };
    presa.once('connect', () => chiudi(true));
    presa.once('error', () => chiudi(false));
    presa.setTimeout(1000, () => chiudi(false));
  });
}

const scadenza = Date.now() + secondi * 1000;
let annunciato = false;

while (Date.now() < scadenza) {
  if (await inAscolto()) {
    if (annunciato) console.log(`✓ la porta ${porta} risponde`);
    process.exit(0);
  }
  if (!annunciato) {
    console.log(`⏳ attendo la porta ${porta}…`);
    annunciato = true;
  }
  await new Promise((r) => setTimeout(r, 400));
}

console.log(
  `⚠️  la porta ${porta} non risponde dopo ${secondi}s: si prosegue comunque.\n` +
    '    Le prime richieste falliranno e la pagina nascerà degradata — si aggiusta al reload.'
);
process.exit(0);
