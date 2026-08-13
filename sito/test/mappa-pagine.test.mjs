// La mappa del pannello non mente sui testi che ciascuna pagina mostra.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 PERCHÉ QUESTO TEST ESISTE, e perché la mappa senza di lui sarebbe PEGGIO di nessuna mappa.
//    `backend/Services/Vetrina/MappaPagineVetrina.cs` dichiara quali valori ogni pagina del sito
//    mostra e dove si modificano; le cinque schede del gestionale costruiscono da lì le proprie
//    sezioni. È una SECONDA scrittura — la prima sono i `.astro` — e due scritture divergono:
//    qualcuno aggiunge una lettura a `locale.astro`, la scheda «Il locale» non la impara mai, e
//    l'amministratore ha una mappa che ORIENTA CON SICUREZZA NELLA DIREZIONE SBAGLIATA. Per uno
//    strumento di orientamento è il modo peggiore di sbagliare, perché non lascia sospettare
//    nulla: una scheda incompleta somiglia in tutto a una pagina che quel testo non lo usa.
//
// ⚠️ Il confronto vive nei test del SITO e non in quelli del backend, per la stessa ragione di
//    `orari-sorgenti.test.mjs` e `schede-pannello.test.mjs`: qui i sorgenti si scansionano già.
//    Il gestionale NON dipende dalla build del sito — questo è un confronto fra due
//    dichiarazioni testuali, non un'estrazione a tempo di compilazione.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LE QUATTRO ASSERZIONI, E PERCHÉ NON BASTA LA SECONDA
//
//   ① la scansione ha FUNZIONATO — voci lette ≥ N, ed entrambi i lati (mappa e sorgenti) non
//      vuoti. Senza, una regex che smette di riconoscere la forma del file C# rende questo test
//      CIECO invece che rosso: due insiemi vuoti si contengono a vicenda perfettamente, e la
//      suite resta verde e rassicurante mentre non verifica più niente. È la modalità di guasto
//      peggiore di un test di scansione, ed è quella che nessuno pensa a provocare.
//   ② nessun percorso LETTO e non dichiarato — il verso che il pannello sbaglia per omissione;
//   ③ nessuna voce DICHIARATA e non letta — il verso opposto, più lento: una mappa che elenca
//      campi morti invecchia allo stesso modo, solo che nessuno se ne accorge mai;
//   ④ nessun percorso letto ovunque nel sito che la mappa non conosca AFFATTO — vedi sotto.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ COME SI DEFINISCE «QUESTA PAGINA LEGGE QUEL CAMPO», che è la sola decisione di merito.
//
//    Non basta guardare i cinque file di pagina: il piè di pagina mostra indirizzo e orari su
//    OGNI pagina, e una mappa che dicesse «/menu mostra solo l'insegna» sarebbe falsa. Si segue
//    quindi il grafo degli import `.astro`, e si distinguono due ambiti:
//
//      • la CORNICE — `Base.astro` e ciò che importa: intestazione, piè di pagina, barra mobile,
//        dati strutturati. È su tutte le pagine, e la mappa la dichiara UNA volta sola sotto
//        `PaginaVetrina.Cornice`. Ripetere quelle sedici voci su cinque pagine avrebbe fatto
//        dire alla scheda «Menu» che quella pagina possiede l'indirizzo;
//      • il CORPO di una pagina — il suo `.astro` più i componenti che rende e che non stanno
//        nella cornice (`Mappa`, `OrariSettimana`, `Recensioni`, …).
//
//    Un percorso letto nel corpo può essere dichiarato per la pagina O per la cornice (② non
//    obbliga a ripetere ciò che la cornice già mostra); una voce dichiarata per una pagina deve
//    invece essere letta nel corpo di QUELLA pagina (③ non ammette voci fantasma).
//
// ⚠️ SI SCANSIONANO SOLO I `.astro`, ed è una limitazione dichiarata. Un modulo `.ts` riceve
//    `sito` come parametro e viene importato dalla cornice: attribuire le sue letture alle pagine
//    farebbe dire alla mappa che `/contatti` mostra il testo dell'aperitivo — `rotte.ts` lo legge
//    per decidere se la voce di navigazione esiste — che è falso e sarebbe rumore, non verità.
//    Il buco che questo lascia è chiuso dall'asserzione ④: ogni percorso letto in un QUALUNQUE
//    sorgente del sito, `.ts` compresi, deve comparire almeno da qualche parte nella mappa.
//
// ⚠️ Si tolgono i commenti prima di cercare (`senzaCommenti`), come in `orari-sorgenti.test.mjs`:
//    i `.astro` di questo progetto nominano `sito.testi.claim` e gli indici della galleria dentro
//    commenti esplicativi, e un test che li raccogliesse sarebbe rosso per la ragione sbagliata —
//    cioè verrebbe «aggiustato» allentando l'asserzione.
// ─────────────────────────────────────────────────────────────────────────────────────────

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { senzaCommenti, sorgenti, radiceSito } from './_scansione.mjs';

const RADICE_REPO = dirname(radiceSito);
const MAPPA = join(RADICE_REPO, 'backend/Services/Vetrina/MappaPagineVetrina.cs');

/** Le cinque pagine, dal nome dell'enum C# al file che le rende. */
const PAGINE = {
  Home: 'src/pages/index.astro',
  Menu: 'src/pages/menu.astro',
  Aperitivo: 'src/pages/aperitivo.astro',
  Locale: 'src/pages/locale.astro',
  Contatti: 'src/pages/contatti.astro',
};

const CORNICE = 'Cornice';
const BASE = 'src/layouts/Base.astro';

/**
 * Il numero minimo di voci che la mappa deve avere perché la scansione sia credibile.
 *
 * 🔴 Non è un numero esatto di proposito: un'uguaglianza costringerebbe ad aggiornarlo a ogni
 *    voce aggiunta, e chi lo aggiorna meccanicamente smette di leggerlo. Serve solo a distinguere
 *    «la regex funziona» da «la regex non trova più niente» — il caso in cui il tipo viene
 *    rinominato e la scansione perde TUTTO. Perdere UNA voce lo intercetta invece il confronto
 *    fra righe aperte e voci lette (vedi `vociDellaMappa`), che non ha soglie da mantenere.
 */
const VOCI_MINIME = 50;

// ── Lato mappa ────────────────────────────────────────────────────────────────────────────

/**
 * Quante voci il file **apre**, cioè quante righe cominciano una dichiarazione.
 * 🔴 È il denominatore del controllo di cecità: si confronta con quante la regex piena riesce a
 *    leggere, e la differenza è il numero di voci che la scansione sta **perdendo**.
 */
const APERTURA = /new\(PaginaVetrina\./g;

/**
 * La forma piena di una voce. ⚠️ Fra un argomento e l'altro si ammettono spazi e tabulazioni ma
 * **non** l'a capo (`[ \t]*` e non `\s*`), ed è deliberato: il file C# dichiara in testa che la
 * forma è «una voce per riga», e un separatore che attraversasse gli a capo renderebbe quella
 * regola non verificata — cioè una convenzione scritta e mai controllata, che è il modo in cui
 * le convenzioni smettono di valere.
 */
const VOCE = /new\(PaginaVetrina\.(\w+),[ \t]*"([^"]+)",[ \t]*"([^"]+)",[ \t]*SchedaVetrina\.(\w+),/g;

/**
 * Le voci dichiarate dal backend.
 *
 * 🔴 LA FORMA È VINCOLANTE, e il file C# lo dichiara in testa: una voce per riga, nella forma
 *    `new(PaginaVetrina.X, "Campo", "percorso", SchedaVetrina.Y, …)`. Cambiarla — spezzando la
 *    riga, invertendo due argomenti, nominando il costruttore per esteso — farebbe sparire la
 *    voce da qui **in silenzio**, ed è la modalità di guasto che l'asserzione ① intercetta.
 */
function vociDellaMappa() {
  const testo = senzaCommenti(readFileSync(MAPPA, 'utf8'));
  return [...testo.matchAll(VOCE)].map(([, pagina, campo, percorso, scheda]) => ({ pagina, campo, percorso, scheda }));
}

/** Quante dichiarazioni il file apre, comunque siano scritte. */
function apertureDellaMappa() {
  return [...senzaCommenti(readFileSync(MAPPA, 'utf8')).matchAll(APERTURA)].length;
}

// ── Lato sorgenti del sito ────────────────────────────────────────────────────────────────

/** I `.astro` importati da un file, come percorsi assoluti. */
function importatiAstro(assoluto) {
  const testo = senzaCommenti(readFileSync(assoluto, 'utf8'));
  return [...testo.matchAll(/from\s+'([^']+\.astro)'/g)].map(([, rel]) => resolve(dirname(assoluto), rel)).filter((percorso) => existsSync(percorso));
}

/** Il file e tutti i `.astro` che rende, transitivamente. */
function grafo(assoluto) {
  const visti = new Set();
  const coda = [assoluto];
  while (coda.length > 0) {
    const corrente = coda.pop();
    if (visti.has(corrente)) continue;
    visti.add(corrente);
    importatiAstro(corrente).forEach((importato) => coda.push(importato));
  }
  return visti;
}

/** Le espressioni `sito.x.y` / `sito?.x?.y` scritte per intero in un testo già ripulito. */
function letturePiane(testo) {
  return [...testo.matchAll(/\bsito\??\.([A-Za-z0-9_]+(?:\??\.[A-Za-z0-9_]+)*)/g)].map(([, percorso]) => percorso.replaceAll('?', ''));
}

/**
 * 🔴 **Gli alias, e perché senza di loro questo test sarebbe quasi inutile sui testi editoriali.**
 *
 * Nessuna pagina scrive `sito.testi.storia.titolo`: `locale.astro` fa
 * `const storia = sito?.testi.storia ?? null` e poi legge `storia.titolo`. Una scansione che si
 * fermasse alle espressioni piane vedrebbe soltanto `testi.storia`, e quel percorso è coperto da
 * QUALUNQUE voce sotto `testi.storia.` — quindi togliere dalla mappa la voce del **titolo** non
 * farebbe fallire nulla. Verificato: è precisamente la mutazione che passava inosservata prima di
 * queste righe, ed è il caso più probabile nella pratica, perché i testi editoriali sono
 * l'oggetto stesso della mappa.
 *
 * La regola è volutamente minima — un solo passaggio, dichiarazione locale con `const` — e copre
 * i due casi reali del progetto (`testi.storia`, `testi.aperitivo`).
 *
 * ⚠️ Ciò che NON copre, dichiarato: un oggetto passato come **proprietà** a un componente
 *    (`<Recensioni reputazione={sito.reputazione} />`) viene letto dentro l'altro file con un
 *    nome che non ha più alcun legame testuale con `sito`. Per quei rami la copertura resta al
 *    livello dell'oggetto (`reputazione`), e togliere dalla mappa una delle sue foglie non
 *    diventa rosso. Seguirli richiederebbe di risolvere le proprietà attraverso i file, cioè un
 *    compilatore invece di un test.
 */
function lettureTramiteAlias(testo) {
  const alias = [...testo.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*sito\??\.([A-Za-z0-9_]+(?:\??\.[A-Za-z0-9_]+)*)/g)].map(([, nome, percorso]) => ({ nome, percorso: percorso.replaceAll('?', '') }));

  return alias.flatMap(({ nome, percorso }) => [...testo.matchAll(new RegExp(`\\b${nome}\\??\\.([A-Za-z0-9_]+(?:\\??\\.[A-Za-z0-9_]+)*)`, 'g'))].map(([, coda]) => `${percorso}.${coda.replaceAll('?', '')}`));
}

/**
 * I percorsi `sito.<qualcosa>` letti in un file, espressioni piane **e** letture tramite alias.
 *
 * ⚠️ Copre sia `sito.x.y` sia `sito?.x?.y`: la forma con l'optional chaining è la più comune nei
 *    `.astro`, perché l'identità del locale può non essersi letta (degradazione).
 */
function percorsiLetti(assoluto) {
  const testo = senzaCommenti(readFileSync(assoluto, 'utf8'));
  return [...letturePiane(testo), ...lettureTramiteAlias(testo)];
}

function percorsiDelGrafo(files) {
  return new Set([...files].flatMap(percorsiLetti));
}

/**
 * Gli ambiti: la cornice e i cinque corpi di pagina, con i loro file e i loro percorsi.
 * 🔴 Il corpo di una pagina è il suo grafo **meno** la cornice: è la sottrazione che permette
 *    alla mappa di dichiarare una volta sola ciò che ogni pagina mostra.
 */
function ambiti() {
  const cornice = grafo(join(radiceSito, BASE));
  const risultato = {
    [CORNICE]: { files: cornice, percorsi: percorsiDelGrafo(cornice) },
  };
  Object.entries(PAGINE).forEach(([nome, relativo]) => {
    const corpo = new Set([...grafo(join(radiceSito, relativo))].filter((percorso) => !cornice.has(percorso)));
    risultato[nome] = { files: corpo, percorsi: percorsiDelGrafo(corpo) };
  });
  return risultato;
}

/**
 * Un percorso letto è «coperto» da uno dichiarato quando uno dei due è prefisso dell'altro.
 *
 * 🔴 Entrambi i versi servono, e per due ragioni reali di questo codice:
 *    – `sito.contatti.telefono.replace(...)` è più PROFONDO della voce `contatti.telefono`;
 *    – `<Mappa sito={sito} />` legge `sito.indirizzo` per intero, cioè è più CORTO delle cinque
 *      voci `indirizzo.via`, `indirizzo.cap`, … che la mappa dichiara.
 *
 * ⚠️ Il prezzo è dichiarato: una lettura «larga» come `sito.indirizzo` copre qualunque voce
 *    sotto `indirizzo.`, quindi ③ è più debole su quel ramo. È il compromesso di una scansione
 *    testuale, e l'alternativa — analizzare il flusso dei dati dentro i componenti — sarebbe un
 *    compilatore, non un test.
 */
function copre(dichiarato, letto) {
  return dichiarato === letto || dichiarato.startsWith(`${letto}.`) || letto.startsWith(`${dichiarato}.`);
}

// ── ① La scansione ha funzionato ──────────────────────────────────────────────────────────

test('la scansione trova davvero la mappa e i sorgenti del sito', () => {
  const voci = vociDellaMappa();
  const scope = ambiti();

  // 🔴 Senza questa asserzione, una regex che smette di riconoscere la forma del file C# non
  //    rende il test rosso: lo rende CIECO. Zero voci dichiarate significa zero voci fantasma
  //    (③ passa) e, con la clausola «o per la cornice», nessuna certezza in ② — cioè una suite
  //    verde che non verifica più niente. È la mutazione che nessuno pensa a fare.
  assert.ok(voci.length >= VOCI_MINIME, `lette solo ${voci.length} voci da MappaPagineVetrina.cs (attese almeno ${VOCI_MINIME}): la regex non riconosce più la forma del file, e questo test è CIECO invece che rosso`);

  // 🔴 E il controllo che intercetta la perdita di UNA SOLA voce, senza soglie da mantenere:
  //    quante dichiarazioni il file apre, tante la scansione ne deve leggere per intero. Una
  //    voce spezzata su due righe, o con due argomenti invertiti, apre e non si legge — e senza
  //    questo confronto sparirebbe in silenzio, lasciando la suite verde su una mappa che il
  //    test non guarda più.
  assert.equal(
    voci.length,
    apertureDellaMappa(),
    `MappaPagineVetrina.cs apre ${apertureDellaMappa()} voci ma la scansione ne legge ${voci.length}: qualcuna non è più nella forma vincolata (una voce per riga, new(PaginaVetrina.X, "Campo", "percorso", SchedaVetrina.Y, …)). Senza questo confronto la voce persa sarebbe semplicemente invisibile a questo test.`
  );

  // Ogni ambito dichiarato dall'enum esiste davvero come insieme di file.
  [CORNICE, ...Object.keys(PAGINE)].forEach((nome) => {
    assert.ok(scope[nome].files.size > 0, `l'ambito «${nome}» non ha alcun sorgente: il grafo degli import non si risolve più`);
  });

  // E i due lati sono entrambi popolati: un lato vuoto è contenuto in qualunque altro.
  assert.ok(scope[CORNICE].percorsi.size >= 10, `la cornice legge solo ${scope[CORNICE].percorsi.size} percorsi: la scansione dei .astro non riconosce più le espressioni sito.*`);
  assert.ok(new Set(voci.map((voce) => voce.pagina)).size === 6, `la mappa dichiara voci per ${new Set(voci.map((voce) => voce.pagina)).size} ambiti invece che per sei (cornice + cinque pagine)`);
});

// ── ② Nessun campo letto e non dichiarato ─────────────────────────────────────────────────

test('🔴 ogni valore che una pagina legge è dichiarato dalla mappa', () => {
  const voci = vociDellaMappa();
  const scope = ambiti();
  const dellaCornice = voci.filter((voce) => voce.pagina === CORNICE).map((voce) => voce.percorso);

  const mancanti = Object.entries(scope).flatMap(([nome, { percorsi }]) => {
    // Un percorso del corpo di una pagina può essere dichiarato per la pagina **o** per la
    // cornice: la cornice è su ogni pagina, quindi ripeterla non aggiungerebbe verità.
    const ammessi = nome === CORNICE ? dellaCornice : [...voci.filter((voce) => voce.pagina === nome).map((voce) => voce.percorso), ...dellaCornice];
    return [...percorsi].filter((letto) => !ammessi.some((dichiarato) => copre(dichiarato, letto))).map((letto) => `${nome}: sito.${letto}`);
  });

  assert.deepEqual(mancanti.sort(), [], `valori letti dal sito e NON dichiarati in MappaPagineVetrina.cs:\n  ${mancanti.sort().join('\n  ')}\nLa scheda di quella pagina non li elencherà, e nulla lo segnalerà.`);
});

// ── ③ Nessuna voce fantasma ───────────────────────────────────────────────────────────────

test('ogni voce dichiarata dalla mappa è letta davvero da quell’ambito', () => {
  const scope = ambiti();

  const fantasma = vociDellaMappa()
    .filter((voce) => !([...scope[voce.pagina].percorsi].some((letto) => copre(voce.percorso, letto))))
    .map((voce) => `${voce.pagina}: ${voce.campo} → sito.${voce.percorso}`);

  assert.deepEqual(fantasma.sort(), [], `voci dichiarate dalla mappa che quell'ambito non legge più:\n  ${fantasma.sort().join('\n  ')}\nUna mappa che elenca campi morti invecchia come una che ne dimentica, solo più lentamente.`);
});

// ── ④ Nulla sfugge del tutto, nemmeno fuori dai .astro ────────────────────────────────────

test('nessun valore del sito è letto da un modulo che la mappa non conosce affatto', () => {
  // ⚠️ Qui si scansiona TUTTO — `.ts` compresi — senza attribuire nulla a una pagina. È la rete
  //    sotto la limitazione dichiarata in testa al file: `rotte.ts` e `mappa.ts` leggono `sito.*`
  //    e non appartengono al corpo di alcuna pagina, ma ciò che leggono deve comunque essere un
  //    valore che la mappa conosce. Un campo nuovo letto SOLO da un modulo condiviso passerebbe
  //    altrimenti indenne da ② e ③.
  const dichiarati = vociDellaMappa().map((voce) => voce.percorso);
  const letti = new Map();
  sorgenti().forEach((relativo) => {
    percorsiLetti(join(radiceSito, relativo)).forEach((percorso) => {
      if (!letti.has(percorso)) letti.set(percorso, relativo);
    });
  });

  const sconosciuti = [...letti.entries()].filter(([letto]) => !dichiarati.some((dichiarato) => copre(dichiarato, letto))).map(([letto, dove]) => `sito.${letto} (${dove})`);

  assert.deepEqual(sconosciuti.sort(), [], `valori del sito che la mappa non conosce affatto:\n  ${sconosciuti.sort().join('\n  ')}`);
});

// ── Il gestionale non dipende dalla build del sito ────────────────────────────────────────

test('🔴 né il gestionale né il backend importano alcunché dal progetto del sito', () => {
  // 🔴 È il vincolo che ha determinato DOVE vive questa verifica. La casa naturale della mappa
  //    sarebbe `sito/src/lib/`, accanto a `rotte.ts`; è stata scartata perché il gestionale non
  //    può importare da `sito/` — sono due build separate — e la mappa sarebbe finita ricopiata
  //    nel pannello, cioè duplicata proprio nel punto in cui serve che non lo sia. Il confronto
  //    è fra due DICHIARAZIONI testuali, non un'estrazione a tempo di compilazione: `sito/` può
  //    non essere nemmeno installato e `npm run build` del gestionale passa lo stesso.
  //
  // ⚠️ `duedgusto/src/components/pages/sito/` è una cartella del GESTIONALE che si chiama così
  //    perché contiene le schede del sito: non è il progetto Astro. La distinzione la fa il
  //    prefisso del percorso relativo, non la parola.
  const progetti = [
    { radice: join(RADICE_REPO, 'duedgusto/src'), estensioni: ['.ts', '.tsx'] },
    { radice: join(RADICE_REPO, 'backend'), estensioni: ['.cs', '.csproj'] },
  ];

  const cammina = (cartella, estensioni, trovati = []) => {
    readdirSync(cartella, { withFileTypes: true }).forEach((voce) => {
      const percorso = join(cartella, voce.name);
      if (voce.isDirectory()) {
        if (['node_modules', 'bin', 'obj', 'dist'].includes(voce.name)) return;
        cammina(percorso, estensioni, trovati);
      } else if (estensioni.some((estensione) => voce.name.endsWith(estensione))) {
        trovati.push(percorso);
      }
    });
    return trovati;
  };

  // Un import che risalga fino alla radice del repository e scenda dentro `sito/`, in qualunque
  // delle forme che i due stack usano.
  const DIPENDENZA = /(from|import|require\()\s*['"][^'"]*\.\.\/sito\/(src|dist|node_modules)\//;

  const colpevoli = progetti.flatMap(({ radice, estensioni }) =>
    cammina(radice, estensioni)
      .filter((percorso) => DIPENDENZA.test(readFileSync(percorso, 'utf8')))
      .map((percorso) => relative(RADICE_REPO, percorso).split('\\').join('/'))
  );

  assert.deepEqual(colpevoli, [], `file del gestionale o del backend che importano dal progetto del sito:\n  ${colpevoli.join('\n  ')}`);
});

// ── La mappa parla delle pagine che il sito ha davvero ────────────────────────────────────

test('gli ambiti della mappa sono la cornice e le cinque pagine del sito, non altri', () => {
  // Una voce che nominasse una pagina inesistente non farebbe fallire nulla di quanto sopra:
  // `scope[voce.pagina]` sarebbe `undefined` e il test ③ esploderebbe con un errore oscuro
  // invece di dire cosa non va. Meglio dirlo qui, per nome.
  const noti = new Set([CORNICE, ...Object.keys(PAGINE)]);
  const ignoti = [...new Set(vociDellaMappa().map((voce) => voce.pagina))].filter((pagina) => !noti.has(pagina));

  assert.deepEqual(ignoti, [], `la mappa nomina ambiti che questo test non sa dove cercare: ${ignoti.join(', ')}`);
});
