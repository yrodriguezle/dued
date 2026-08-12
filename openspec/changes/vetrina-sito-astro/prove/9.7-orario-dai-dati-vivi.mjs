// Prova 9.7 — l'orario cambiato in cassa si riflette sul sito.
//
// È la dimostrazione, chiusa SUL SITO, che gli orari hanno una sorgente sola. La garanzia è
// strutturale — `ImpostazioniVetrina` non possiede alcun campo di orario, apposta — ma
// finché non la si guarda dal lato del visitatore resta un'affermazione sul database.
//
// ⚠️ Il campo si cambia dal PERIODO DI PROGRAMMAZIONE in corso, non dalla pagina delle
//    impostazioni della vetrina, dove non esiste. È la scoperta annotata nel change
//    precedente, e questa prova la conferma dal lato opposto.
//
// ⚠️ Stessa divergenza dichiarata della prova 9.6: si usa la mutation che l'app di cassa
//    invoca (`settings { aggiornaPeriodo }`), non il database e non l'interfaccia.
import playwright from '../../../../duedgusto/node_modules/playwright/index.js';
const { chromium } = playwright;

const SITO = process.argv[2] ?? 'http://127.0.0.1:4399/';
const BACKEND = process.argv[3] ?? 'https://localhost:4000';

const auth = await (await fetch(`${BACKEND}/api/auth/signin`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'X-Forwarded-For': '10.9.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250),
  },
  body: JSON.stringify({ userName: 'e2e-admin', password: 'e2e-test-password' }),
})).json();

const gq = async (query, variables) => {
  const r = await fetch(`${BACKEND}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
};

const CAMPI = 'periodoId dataInizio dataFine giorniOperativi orarioApertura orarioChiusura';
const { settings } = await gq(`{ settings { periodoAttivo { ${CAMPI} } } }`);
const prima = settings.periodoAttivo;
console.log('Periodo attivo:', JSON.stringify(prima));

const scrivi = (orarioChiusura) =>
  gq(`mutation($in: PeriodoProgrammazioneInput!){ settings { aggiornaPeriodo(periodo:$in) { ${CAMPI} } } }`, {
    in: {
      periodoId: prima.periodoId,
      dataInizio: prima.dataInizio,
      dataFine: prima.dataFine,
      giorniOperativi: prima.giorniOperativi,
      orarioApertura: prima.orarioApertura,
      orarioChiusura,
    },
  });

const browser = await chromium.launch();
const pagina = await browser.newPage({ viewport: { width: 1100, height: 700 } });

/** L'orario COME LO LEGGE UN VISITATORE, non da `curl`: è il punto della prova. */
const sulSito = async (etichetta) => {
  await pagina.goto(SITO, { waitUntil: 'networkidle' });
  await pagina.reload({ waitUntil: 'networkidle' });
  const testo = await pagina.innerText('body');
  const riga = testo.match(/\d{2}:\d{2}\s*–\s*\d{2}:\d{2}/)?.[0] ?? '(nessun orario in pagina)';
  const api = (await (await fetch(`${BACKEND}/api/public/site`)).json()).orari;
  console.log(`${etichetta.padEnd(24)} sito: ${riga.padEnd(16)} api: ${api.apertura}–${api.chiusura}`);
  return riga;
};

const NUOVO = '21:30';
const a = await sulSito('prima');
await scrivi(NUOVO);
const b = await sulSito(`chiusura → ${NUOVO}`);
await pagina.screenshot({ path: new URL('./9.7-orario-cambiato.png', import.meta.url).pathname.slice(1) });
await scrivi(prima.orarioChiusura);
const c = await sulSito('ripristinata');

const { settings: dopo } = await gq(`{ settings { periodoAttivo { ${CAMPI} } } }`);
const uguale = JSON.stringify(dopo.periodoAttivo) === JSON.stringify(prima);

const ok = b.includes(NUOVO) && !a.includes(NUOVO) && c === a && uguale;
console.log(`\nIl sito ha seguito la cassa? ${ok}`);
console.log("Il periodo è tornato esattamente com'era?", uguale);

await browser.close();
process.exit(ok ? 0 : 1);
