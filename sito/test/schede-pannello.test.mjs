// Il pannello rispecchia le pagine del sito, e non ne tiene una seconda lista.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 PERCHÉ QUESTO TEST ESISTE. `rotte.ts` è la sorgente unica delle pagine del sito: la usano
//    navigazione, piè di pagina, 404 e sitemap. Il gestionale adesso ha una scheda per ciascuna
//    di quelle pagine, e le schede vivono a **database**, seedate da `SeedMenusSito.cs`. Sono
//    due liste in due progetti diversi, e due liste divergono: qualcuno aggiunge una pagina al
//    sito, nessuno aggiunge la scheda, e l'amministratore non ha più alcun posto da cui
//    governarla. Il guasto non si manifesta come un errore — si manifesta come una voce di
//    menu che non c'è, cioè come niente.
//
// ⚠️ Il confronto vive **nei test del sito** e non in quelli del backend, per la stessa ragione
//    per cui ci vive `orari-sorgenti.test.mjs`: qui i sorgenti si scansionano già, e il backend
//    oggi scansiona solo `backend/`. Il gestionale non dipende dalla build del sito — questo è
//    un confronto fra due **dichiarazioni**, non un'estrazione a tempo di compilazione.
//
// ⚠️ Si tolgono i commenti prima di cercare: `rotte.ts` nomina «Mobile» in un commento per
//    dire che NON è una pagina, e un test che lo raccogliesse sarebbe rosso per la ragione
//    sbagliata — cioè verrebbe «aggiustato» allentando l'asserzione.
// ─────────────────────────────────────────────────────────────────────────────────────────

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { senzaCommenti, radiceSito } from './_scansione.mjs';

const RADICE_REPO = dirname(radiceSito);
const ROTTE = join(radiceSito, 'src/lib/rotte.ts');
const SEED = join(RADICE_REPO, 'backend/SeedData/SeedMenusSito.cs');

/** Il prefisso sotto cui vivono le schede di pagina, distinto da quello delle risorse. */
const PREFISSO_SCHEDE = '/gestionale/sito/pagine/';

/**
 * Le pagine dichiarate dal sito: percorso pubblico ed etichetta.
 *
 * ⚠️ La regex copre entrambe le forme in cui `ROTTE` è scritto — voce su una riga sola e voce
 *    spezzata su più righe — perché `\s*` attraversa gli a capo. Le due chiavi sono sempre
 *    adiacenti e in quest'ordine.
 */
/**
 * ⚠️ Si legge `etichetta`, che è il nome **canonico** della pagina, e non `etichettaPubblica`:
 *    quella è il nome che il visitatore legge e può dipendere dal contenuto — «Piatto del
 *    mercoledì», col giorno che si sceglie dal gestionale. Una voce di pannello che rispecchiasse
 *    il nome pubblico si rinominerebbe da sola a ogni salvataggio, e questo confronto sarebbe
 *    rosso a seconda del giorno impostato in produzione. Sono due nomi per due pubblici, e il
 *    pannello rispecchia quello che non cambia.
 */
function pagineDelSito() {
  const testo = senzaCommenti(readFileSync(ROTTE, 'utf8'));
  return [...testo.matchAll(/percorso:\s*'([^']+)',\s*etichetta:\s*'([^']+)'/g)].map(([, percorso, etichetta]) => ({ percorso, etichetta }));
}

/** Le voci del sottomenu «Sito» seedate dal gestionale: titolo, percorso, icona, posizione, file. */
function vociDelPannello() {
  const testo = senzaCommenti(readFileSync(SEED, 'utf8'));
  return [...testo.matchAll(/"([^"]+)",\s*"(\/gestionale\/sito\/[^"]+)",\s*"([A-Za-z0-9_]+)",\s*true,\s*(\d+),\s*"([A-Za-z0-9_]+)",\s*"([^"]+)"/g)].map(
    ([, titolo, percorso, icona, posizione, nomeVista, percorsoFile]) => ({
      titolo,
      percorso,
      icona,
      posizione: Number(posizione),
      nomeVista,
      percorsoFile,
    })
  );
}

/**
 * Il percorso della scheda che corrisponde a una pagina del sito.
 * 🔴 È l'unica traduzione fra i due mondi, ed è qui una volta sola.
 */
function schedaDi(percorsoSito) {
  return `${PREFISSO_SCHEDE}${percorsoSito === '/' ? 'home' : percorsoSito.replace(/^\//, '')}`;
}

test('la scansione trova davvero le due liste', () => {
  // ① Senza questo, una regex che smette di riconoscere la forma dei due file rende il test
  //    CIECO invece che rosso: due liste vuote coinciderebbero perfettamente.
  const pagine = pagineDelSito();
  const voci = vociDelPannello();

  assert.ok(pagine.length >= 6, `lette solo ${pagine.length} pagine da rotte.ts: la scansione non riconosce più la forma di ROTTE`);
  assert.ok(voci.length >= 10, `lette solo ${voci.length} voci da SeedMenusSito.cs: la scansione non riconosce più la forma del seed`);
});

test('ogni pagina del sito ha la sua scheda nel pannello, con la stessa etichetta', () => {
  const attese = pagineDelSito().map((pagina) => ({ percorso: schedaDi(pagina.percorso), etichetta: pagina.etichetta }));
  const trovate = vociDelPannello()
    .filter((voce) => voce.percorso.startsWith(PREFISSO_SCHEDE))
    .map((voce) => ({ percorso: voce.percorso, etichetta: voce.titolo }));

  const perPercorso = (elenco) => Object.fromEntries(elenco.map((voce) => [voce.percorso, voce.etichetta]));
  const mappaAttese = perPercorso(attese);
  const mappaTrovate = perPercorso(trovate);

  // ② Nessuna pagina senza scheda, e nessuna scheda che nomini una pagina che non esiste.
  const senzaScheda = Object.keys(mappaAttese).filter((percorso) => !(percorso in mappaTrovate));
  const senzaPagina = Object.keys(mappaTrovate).filter((percorso) => !(percorso in mappaAttese));
  assert.deepEqual(
    { senzaScheda, senzaPagina },
    { senzaScheda: [], senzaPagina: [] },
    `pagine del sito senza scheda nel pannello: ${senzaScheda.join(', ') || '—'} | schede che nominano pagine inesistenti: ${senzaPagina.join(', ') || '—'}`
  );

  // ③ E le etichette coincidono CARATTERE PER CARATTERE: rispecchiare il sito è il punto della
  //    sezione, e un'etichetta diversa nei due posti è una scheda che parla di un'altra pagina.
  const divergenti = Object.keys(mappaAttese)
    .filter((percorso) => mappaAttese[percorso] !== mappaTrovate[percorso])
    .map((percorso) => `${percorso}: il sito la chiama «${mappaAttese[percorso]}», il pannello «${mappaTrovate[percorso]}»`);
  assert.deepEqual(divergenti, [], `etichette divergenti fra sito e pannello:\n  ${divergenti.join('\n  ')}`);
});

test("l'ordine del sottomenu mette le sei pagine davanti alle risorse trasversali", () => {
  // 🔴 È il valore del change, non un dettaglio: prima la sezione elencava quattro ENTITÀ e chi
  //    voleva sapere «cosa c'è sulla pagina del locale» non aveva dove guardare. Appendere le
  //    pagine in coda avrebbe rimesso «Libreria media» davanti a «Home».
  const voci = vociDelPannello().filter((voce) => voce.posizione >= 1 && voce.posizione <= 10);
  const schede = voci.filter((voce) => voce.percorso.startsWith(PREFISSO_SCHEDE));
  const risorse = voci.filter((voce) => !voce.percorso.startsWith(PREFISSO_SCHEDE));

  assert.equal(schede.length, 6);
  assert.equal(risorse.length, 4);
  assert.deepEqual(
    schede.map((voce) => voce.posizione).sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6]
  );
  assert.deepEqual(
    risorse.map((voce) => voce.posizione).sort((a, b) => a - b),
    [7, 8, 9, 10]
  );

  // ⚠️ E le sei schede stanno nello stesso ORDINE in cui il sito elenca le sue pagine: il
  //    pannello rispecchia il sito anche nella successione, non solo nei nomi.
  const ordineSito = pagineDelSito().map((pagina) => schedaDi(pagina.percorso));
  const ordinePannello = [...schede].sort((a, b) => a.posizione - b.posizione).map((voce) => voce.percorso);
  assert.deepEqual(ordinePannello, ordineSito, "l'ordine delle schede non è quello con cui il sito elenca le proprie pagine");
});

test('ogni voce del sottomenu punta a un componente che esiste davvero', () => {
  // 🔴 `PercorsoFile` è ciò che il gestionale importa a RUNTIME, relativo a
  //    `duedgusto/src/components/pages/`. Un percorso sbagliato non rompe alcuna build e non
  //    rompe alcun test del gestionale: rompe la voce di menu, con una pagina che non si apre —
  //    e lo scopre chi clicca. Questo è l'unico punto del repository da cui si vedono insieme
  //    la dichiarazione (nel backend) e il file (nel gestionale).
  const mancanti = vociDelPannello()
    .map((voce) => ({ voce, assoluto: join(RADICE_REPO, 'duedgusto/src/components/pages', voce.percorsoFile) }))
    .filter(({ assoluto }) => !existsSync(assoluto))
    .map(({ voce }) => `${voce.titolo} → ${voce.percorsoFile}`);

  assert.deepEqual(mancanti, [], `voci di menu che puntano a un componente inesistente:\n  ${mancanti.join('\n  ')}`);
});

test('ogni voce del sottomenu ha un nome di icona, e sono tutte diverse', () => {
  // Un'icona mancante non dà errore: la voce compare senza. Che i nomi ESISTANO nella mappa del
  // frontend lo verifica `duedgusto/…/__tests__/iconeDelSeed.test.tsx`; qui si verifica che
  // siano dichiarati e distinti, perché due voci con la stessa icona sono indistinguibili.
  const icone = vociDelPannello().map((voce) => voce.icona);
  assert.equal(icone.length, 10);
  assert.deepEqual([...new Set(icone)].length, icone.length, `icone ripetute nel sottomenu Sito: ${icone.join(', ')}`);
});
