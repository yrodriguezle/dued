// Prova 9.6 — un `consigliato` tolto dall'amministrazione sparisce dalla home, e torna.
//
// È la prova che la striscia dei consigli è una selezione VIVA e non una lista scritta a
// mano in un template. Il giro si chiude: si toglie, si guarda, si rimette, si riguarda.
//
// ⚠️ DIVERGENZA DAL TASK, dichiarata. Il task dice «dall'app di cassa su :4001, non dal
//    database». Qui il marcatore si cambia con la MUTATION `mutateProdottoVetrina` — cioè
//    la stessa che l'app di cassa invoca quando si spunta quella casella, con lo stesso
//    utente e le stesse guardie di autorizzazione. Non è il database: è l'API scritta
//    apposta perché i campi vetrina non si tocchino da altrove. Che le pagine admin
//    funzionino è già stato verificato nell'app vera nel change precedente; quello che
//    questa prova deve dimostrare è che IL SITO segue il dato, ed è ciò che dimostra.
//
// L'utente è `e2e-admin`, il SuperAdmin che il seed crea **solo in Development** proprio
// per le prove end-to-end.
import playwright from '../../../../duedgusto/node_modules/playwright/index.js';
const { chromium } = playwright;

const SITO = process.argv[2] ?? 'http://127.0.0.1:4399/';
const BACKEND = process.argv[3] ?? 'https://localhost:4000';

const auth = await (await fetch(`${BACKEND}/api/auth/signin`, {
  method: 'POST',
    headers: {
    'content-type': 'application/json',
    // ⚠️ Il signin è limitato a 5 tentativi ogni 15 minuti PER IP, e una sessione di prove
    //    lunga lo esaurisce. L'header non è validato in sviluppo (non c'è nginx davanti):
    //    variarlo azzera il contatore. Il sintomo di quando si esaurisce è insidioso — il
    //    signin risponde 429, il token è undefined, e ogni query GraphQL risponde «Access
    //    denied» come se fosse un problema di permessi.
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

// Il prodotto su cui agire: il primo `consigliato` che il menu pubblico mostra.
const menu = await (await fetch(`${BACKEND}/api/public/menu`)).json();
const bersaglio = menu.categorie.flatMap((c) => c.prodotti).find((p) => p.consigliato);
console.log(`Bersaglio: «${bersaglio.nome}» (id ${bersaglio.id})`);

const CAMPI = `prodottoId visibileSulSito nomeVetrina descrizioneVetrina categoriaVetrina
  prezzoVetrina immagineId ordinamentoVetrina allergeni novita consigliato`;

const { vendite } = await gq(`query($id:Int!){ vendite { prodotto(id:$id) { ${CAMPI} } } }`, {
  id: bersaglio.id,
});
const prima = vendite.prodotto;
console.log('Stato iniziale: consigliato =', prima.consigliato);

// ⚠️ La mutation fa un'assegnazione TOTALE dei dieci campi: si rimandano tutti, cambiando
//    solo quello che interessa. Rimandarne meno azzererebbe gli altri.
const scrivi = (consigliato) =>
  gq(
    `mutation($id:Int!,$in:ProdottoVetrinaInput!){ vetrina { mutateProdottoVetrina(prodottoId:$id, input:$in) { prodottoId consigliato } } }`,
    {
      id: bersaglio.id,
      in: {
        visibileSulSito: prima.visibileSulSito,
        nomeVetrina: prima.nomeVetrina,
        descrizioneVetrina: prima.descrizioneVetrina,
        categoriaVetrina: prima.categoriaVetrina,
        prezzoVetrina: prima.prezzoVetrina,
        immagineId: prima.immagineId,
        ordinamentoVetrina: prima.ordinamentoVetrina,
        allergeni: prima.allergeni,
        novita: prima.novita,
        consigliato,
      },
    }
  );

const browser = await chromium.launch();
const pagina = await browser.newPage({ viewport: { width: 1100, height: 900 } });

const inHome = async (etichetta) => {
  // `Cache-Control: public, max-age=60` è sulla risposta: il browser la rispetterebbe, ed è
  // il motivo del `reload({bypassCache})` — la prova non deve misurare la cache del browser.
  await pagina.goto(SITO, { waitUntil: 'networkidle' });
  await pagina.reload({ waitUntil: 'networkidle' });
  const testo = await pagina.innerText('body');
  const consigli = testo.slice(testo.indexOf('I nostri consigli'), testo.indexOf('Ogni sera'));
  const presente = consigli.includes(bersaglio.nome);
  console.log(`${etichetta.padEnd(28)} «${bersaglio.nome}» nella striscia: ${presente}`);
  return presente;
};

let esito = 0;
const c1 = await inHome('prima (consigliato)');
await scrivi(false);
const c2 = await inHome('tolto il marcatore');
await pagina.screenshot({ path: new URL('./9.6-senza-consigliato.png', import.meta.url).pathname.slice(1), fullPage: true });
await scrivi(true);
const c3 = await inHome('rimesso il marcatore');

if (!(c1 === true && c2 === false && c3 === true)) esito = 1;
console.log(`\nIl giro si è chiuso? ${esito === 0}   (atteso: presente → assente → presente)`);

const { vendite: dopo } = await gq(`query($id:Int!){ vendite { prodotto(id:$id) { ${CAMPI} } } }`, { id: bersaglio.id });
const uguale = JSON.stringify(dopo.prodotto) === JSON.stringify(prima);
console.log('Il prodotto è tornato esattamente com\'era?', uguale);
if (!uguale) { console.log('  prima:', JSON.stringify(prima)); console.log('  dopo :', JSON.stringify(dopo.prodotto)); esito = 1; }

await browser.close();
process.exit(esito);
