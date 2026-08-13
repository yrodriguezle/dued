# Tasks: Il pannello «Sito» modellato sulle pagine (pannello-sito-per-pagine)

> Artefatti di riferimento: [proposal.md](./proposal.md), [design.md](./design.md) (§D1-D15),
> [specs/](./specs/) — tre delta: [`impostazioni-vetrina`](./specs/impostazioni-vetrina/spec.md),
> [`media-assets`](./specs/media-assets/spec.md), [`sito-pubblico`](./specs/sito-pubblico/spec.md).
> Change precedenti, completati: [`vetrina-api-pubblica`](../archive/2026-08-13-vetrina-api-pubblica/tasks.md),
> [`vetrina-fondamenta-media`](../archive/2026-08-13-vetrina-fondamenta-media/tasks.md).
>
> **Come leggere questo file.** Ogni task ha una *Verifica*: chi lo chiude deve poter dimostrare
> che è chiuso, con un comando o un'osservazione. Ogni fase si apre con la ragione per cui esiste,
> si chiude con lo stato in cui lascia l'albero e con **come si torna indietro da lì**.
>
> **Le fasi 1-7 sono i sette punti di [design.md §"Migration / Rollout"](./design.md), nello stesso
> ordine e con lo stesso rollback.** Davanti c'è una Fase 0 di sola misura (non tocca codice) e in
> coda una Fase 8 di chiusura. L'ordine **non è organizzativo**: la Fase 1 è la rete che deve
> esistere *prima* che la Fase 5 possa rompere qualcosa in silenzio.
>
> ⚠️ **I test non hanno una fase propria.** Vivono dentro la fase che pinnano, perché è la
> condizione perché ogni gradino sia verificabile senza il successivo.

---

## Otto risoluzioni già decise, da non rimettere in discussione durante l'apply

1. 🔴 **I campi scrivibili di `ImpostazioniVetrina` sono 30, non 31** ([D15](./design.md) punto 1).
   La proposal scrive 31 in sette punti ed è **sbagliata**: l'elenco letterale di
   `ImpostazioniVetrinaInput_HaEsattamenteICampiScrivibili`
   ([ImpostazioniVetrinaTests.cs:429-446](../../../backend/DuedGusto.Tests/Integration/GraphQL/ImpostazioniVetrinaTests.cs)),
   le proprietà di `ImpostazioniVetrinaInput` e le chiavi di `ValoriImpostazioniVetrina` danno
   **30** in tutti e tre i conteggi. La partizione è **20 + 4 + 2 + 4**. Il numero si corregge nella
   proposal al task 8.3.
2. 🔴 **Dopo la Fase 3 i campi scrivibili diventano 33.** I tre slot immagine nuovi
   (`ImmagineEroeHomeId`, `ImmagineRitrattoLocaleId`, `ImmagineEroeAperitivoId`) **sono scrivibili**
   — nella lista `NonScrivibiliDaGraphQL` di [D3](./design.md) ② stanno le sole **navigazioni**
   (`ImmagineEroeHome`, …), non gli identificativi. La partizione passa quindi da 30 a 33 campi al
   task 3.11, e i test di totalità asseriscono **33** dalla Fase 3 in poi. Chi legge «30» in un test
   dopo la Fase 3 sta guardando un test che non è stato aggiornato.
3. 🔴 **`mutateImpostazioniVetrina` diventa una modifica breaking dello schema** (30 → 20 campi),
   e si accetta: l'unico consumatore è il frontend di questo repository. La conseguenza operativa
   è il vincolo di deploy della Fase 5 e l'ordine di rollback di [D15](./design.md) punto 3 —
   **prima** si riespande l'input, **poi** si fa il revert del frontend.
4. **La scheda «Impostazioni sito» non si rinomina** ([D15](./design.md) punto 4). La proposal la
   vuole rinominata; dopo la riduzione contiene esattamente ciò che quel nome già descrive, e il
   `Percorso` deve comunque restare invariato perché è la chiave di idempotenza del seed.
5. **L'etichetta della scheda resta «Menu»**, identica a `rotte.ts`, e si disambigua
   dall'anagrafica menu del gestionale con l'annidamento e l'icona `UtensilsCrossed`
   ([D12](./design.md), Open Question 1). Rispecchiare il sito è il punto del change.
6. 🔴 ~~**Il ripiego dell'aperitivo resta `galleria.at(-1)`** (Open Question 4). È la regola peggiore
   delle sei, e si tiene perché cambiarla violerebbe *«il sito non cambia comportamento a contenuti
   invariati»*. Il rimedio non è cambiare il ripiego: è **valorizzare lo slot**.~~
   **SUPERATA da una decisione dell'utente, presa dopo la stesura del design e applicata in Fase 2.**
   L'eroe di `/aperitivo` **non ha ripiego**: a slot vuoto la pagina esce **senza** immagine di
   testata. La motivazione, le conseguenze sulle Fasi 4 e 6 e il perché la differenza visibile sia
   accettata stanno nel riquadro del **task 2.2**, che è l'unico posto in cui vanno lette.
7. **Nessun backfill degli slot** ([D5](./design.md) ③). Nascono `null` e restano `null` finché
   qualcuno non sceglie. Il ripiego è la **semantica permanente** dello slot vuoto, non un ponte.
8. **Titolo e descrizione SEO per pagina restano fuori scope** ([D10](./design.md), Open Question 2):
   sono una migrazione e un'altra decisione. `/menu` e `/contatti` non possiedono alcun testo, e le
   loro schede sono **mappe**, non moduli — non un modulo vuoto con un Salva grigio.

---

## Vincoli operativi dell'ambiente

Ripetuti dentro i task in cui mordono davvero — qui una volta sola per non doverli cercare.

- 🔧 **Il backend in esecuzione dell'utente tiene bloccata `bin/`.** Per compilare o testare mentre
  gira:
  ```bash
  dotnet build backend/duedgusto.csproj -o /tmp/dued-build
  dotnet test  backend/DuedGusto.Tests/DuedGusto.Tests.csproj -o /tmp/dued-test
  ```
- 🔧 **`dotnet ef` non ha l'equivalente di `-o`.** La compilazione si devia con la variabile
  d'ambiente `OutputPath`, che MSBuild raccoglie come proprietà globale:
  `EF_MIGRATIONS=1 OutputPath="…/scratchpad/dued-ef/" dotnet ef …` da `backend/`. Senza, il comando
  fallisce con `MSB3027`. ⚠️ **`EF_MIGRATIONS=1` è obbligatorio**: senza,
  `ServerVersion.AutoDetect` apre una connessione e serve un MySQL in esecuzione
  ([Program.cs:96-98](../../../backend/Program.cs)).
- 🔧 **Per le prove end-to-end serve una seconda istanza** su porta libera, che non tocchi quella
  dell'utente:
  ```bash
  ASPNETCORE_URLS=https://localhost:4012 SEED_ON_STARTUP=false dotnet run --project backend
  ```
  `SEED_ON_STARTUP=false` **tranne** nel task 6.18, dove il seed è il punto.
- 🔧 **Il JWT scade in 5 minuti** e il signin è limitato a **5 tentativi ogni 15 minuti per IP**: si
  rigenera il token, non si rifà il login a raffica.
- 🔧 **I test del sito girano con `node --test`** (`cd sito && npm test`) e pretendono **Node ≥
  22.12** (`sito/.npmrc`, `engine-strict`). La macchina è su Node 22.23.2: nessun accorgimento.
- 🔧 **In un worktree fresco `node_modules` va collegato con una junction**, non reinstallato,
  altrimenti `npm run ts:check` muore.

---

## Fase 0 — Misurare il «prima», e sgombrare il campo dal change vicino

**Perché esiste.** La spec [`sito-pubblico`](./specs/sito-pubblico/spec.md) pretende che la prova di
non regressione sia una **cattura prima/dopo confrontabile** e non una lettura a occhio, e la
cattura si può fare **solo adesso**. Dopo la Fase 4 non esiste più un «prima» da fotografare.
Nessun task di questa fase tocca codice.

- [x] 0.1 **Coordinamento con `vetrina-redesign-mockup`** (issue #14, Open Question 4 del design) —
  quel change tocca gli stessi quattro `.astro`. **Stato verificato al 2026-08-13**: è **già in
  `main`** (merge `c577b1a`, PR #15), e le quattro letture della galleria sono ancora nella forma
  che [D5](./design.md) assume — `index.astro:85`, `menu.astro:68`, `locale.astro:38-39`,
  `aperitivo.astro:50`. Resta da verificare che **non ci sia lavoro aperto** su quell'issue che
  rimetta mano agli stessi file prima della Fase 4.
  *Verifica*: `git log --oneline -1 -- sito/src/pages/` è anteriore all'inizio di questo change;
  `gh issue view 14` non elenca lavoro pendente sui `.astro`; se ne elenca, **questo change aspetta
  o riscrive dopo**, e la sostituzione delle letture della galleria va *fatta*, non assunta.

- [x] 0.2 🔴 **Cattura del «prima» del sito, nei due stati delle pagine condizionate** — con il
  database reale e il backend acceso, salva sotto
  `openspec/changes/pannello-sito-per-pagine/prove/prima/`: l'HTML delle cinque pagine, l'elenco
  delle **chiavi immagine** rese da ciascuna e la loro posizione, il codice HTTP di ciascuna, la
  sitemap e le voci di navigazione di intestazione e piè di pagina.
  ⚠️ **Due passate**: una con `StoriaTesto`/`AperitivoTesto` valorizzati e una con entrambi vuoti.
  Una cattura fatta nel solo stato pubblicato non dimostrerebbe nulla sul caso che questo change
  rende raggiungibile da sei posti invece che da uno.
  *Verifica* (spec `sito-pubblico` → *Le cinque pagine rispondono come prima*, *Il 404 condizionato
  si comporta come prima, in entrambi gli stati*): esistono dieci catture (5 pagine × 2 stati) e per
  ciascuna l'elenco ordinato delle chiavi immagine. I contenuti modificati per la seconda passata
  sono **ripristinati** a fine task.

- [x] 0.3 ⚠️ **Conta le immagini che ci sono davvero** — `SELECT COUNT(*) FROM MediaAssets WHERE
  Cartella = 'galleria' AND Pubblicato = 1` sul database reale.
  🔴 Se il risultato è **1**, e oggi lo è, allora la stessa foto è **contemporaneamente** eroe della
  home, ritratto del locale ed eroe dell'aperitivo, e le griglie da tre sono **vuote**. Non è un caso
  limite teorico: è lo stato della produzione, ed è il caso su cui i test dei task 2.3, 4.6 e 6.17
  devono avere una riga esplicita.
  *Verifica*: il numero è annotato nell'uscita di fase, e i tre task lo citano.

- [x] 0.4 **Baseline dei test** — annota i conteggi verdi di partenza: `dotnet test`, `npm run test`
  in `duedgusto/`, `npm test` in `sito/`.
  *Verifica*: tre numeri scritti nell'uscita di fase. Ogni fase successiva dichiara il proprio
  delta rispetto a questi.

**Uscita di fase.** Nessuna riga di codice modificata (`git status` pulito a parte `prove/`), un
«prima» confrontabile in archivio, e il numero di foto reali in galleria.

**Rollback.** Non applicabile: nulla è stato cambiato.

### ✅ Esito misurato — Fase 0 (2026-08-13)

**0.1 — coordinamento.** PR #15 (`Redesign vetrina sul mockup`) **merged** il 2026-08-13T08:54:09Z;
l'ultimo commit su `sito/src/pages/` è `b918dde` (2026-08-13 10:48:56 +0200), cioè dentro quella PR e
**anteriore** all'inizio di questo change. L'issue #14 resta **aperta** ma il solo lavoro pendente è
la **Fase 8 — il catalogo** (39 voci di listino da correggere e approvare, con l'aliquota IVA non
verificata): è una decisione sui *contenuti*, **non tocca alcun `.astro`**. L'unica PR aperta al
momento della misura era la #17 (cassa/fatture), poi merged, e non tocca `sito/`.
Le quattro letture della galleria sono **verificate nella forma che [D5](./design.md) assume**:
`index.astro:85-86`, `menu.astro:68`, `locale.astro:38-39`, `aperitivo.astro:50`.
⚠️ Nota per la Fase 4: su `/` compaiono **quattro** `<picture>`, non due — le due in mezzo vengono
dai **prodotti** (blocco «momenti», `index.astro:62-76`, foto del primo piatto della categoria), non
dalla galleria. Una di esse riusa per caso lo stesso media dell'eroe. La sostituzione del task 4.5
**non deve toccarle**.

**0.2 — cattura del «prima».** In `prove/prima/pubblicato/` e `prove/prima/svuotato/`: dieci HTML
(5 pagine × 2 stati), due `riepilogo.json` con codici HTTP, `Cache-Control`, chiavi immagine
**ordinate con il tag che le porta**, voci di navigazione di intestazione e piè di pagina, e le due
sitemap. Lo strumento è `prove/cattura.mjs` ed è **lo stesso** che rieseguirà il confronto al task 4.8.

| Pagina | pubblicato | svuotato |
|---|---|---|
| `/` | 200 — `A A A A P P B B` | 200 — identico |
| `/menu` | 200 — `A A B B` | 200 — identico |
| `/aperitivo` | 200 — `B B` | **404** — nessuna immagine |
| `/locale` | 200 — `B B` | **404** — nessuna immagine |
| `/contatti` | 200 — nessuna | 200 — identico |
| sitemap | 5 voci | **3 voci** (`/`, `/menu`, `/contatti`) |

`A` = `2026/08/prova-cartella-xxuvbm` (galleria, 1ª) · `B` = `2026/08/800-xxpt4q` (galleria, 2ª) ·
`P` = `2026/08/800-89qao7` (**prodotto**, non galleria). Ogni chiave compare due volte perché è un
`<picture>`: `<source>` webp + `<img>` di ripiego.
🔴 **Contenuti ripristinati e verificato che lo siano**: `MD5(StoriaTesto)` e `MD5(AperitivoTesto)`
identici prima e dopo (`3c4adb02…`, `3907e500…`), e una terza cattura di controllo è risultata
**identica byte per byte** al `riepilogo.json` dello stato pubblicato.

**0.3 — 🔴 quante immagini ci sono davvero.**
`SELECT COUNT(*) FROM MediaAssets WHERE Cartella='galleria' AND Pubblicato=1` → **2**, non 1.
⚠️ **Il numero misurato è quello del database di sviluppo locale** (`localhost:3306/duedgusto`), che
è l'unico raggiungibile da qui. Il testo del task afferma «in produzione ce n'è **una sola**»: la
divergenza **non è stata risolta**, perché verificarla richiede l'accesso al VPS. Le due letture
vanno tenute distinte, e i task 2.3, 4.6 e 6.17 devono coprire **entrambi** i casi — che comunque
già fanno, perché la matrice del task 2.3 include 0, 1 **e** 2 immagini.
Il caso a **2** immagini è quello osservato ed è già degenere quanto quello a 1:
`RitrattoLocale` = `EroeAperitivo` = `GrigliaHome[0]` = la **stessa** foto (`B`), `QuadrateLocale` è
**vuota**, `FotoMenu` ha due elementi. La cattura 0.2 lo conferma riga per riga.

**0.4 — baseline dei test.** ⚠️ Misurati **due volte**: durante la Fase 0 il repository è avanzato
(merge della PR #17, `39c0bbe` → `c58e420`), quindi la baseline valida è la **seconda**.

| Suite | a `39c0bbe` | 🔴 a `c58e420` (baseline valida) |
|---|---|---|
| `dotnet test` | 672 / 672 | **709 / 709** |
| `npm run test` in `duedgusto/` | 784 / 784 (99 file) | **789 / 789** (100 file) |
| `npm test` in `sito/` | 111 / 111 | **111 / 111** (`sito/` non toccato dal merge) |

---

## Fase 1 — 🔴 La rete, con il modulo ancora intero

*(punto 1 del rollout — [D3](./design.md) ①, [D4](./design.md))*

**Perché esiste, e perché è prima di tutto.** Il test *«ogni valore del modulo finisce nell'input»*
([ImpostazioniVetrinaPage.test.tsx:143](../../../duedgusto/src/components/pages/sito/__tests__/ImpostazioniVetrinaPage.test.tsx))
fa `Object.keys(valori).filter(chiave => !(chiave in input))`: confronta il modulo **con sé stesso**.
Su una scheda che conoscesse 4 campi su 30 sarebbe **verde mentre il salvataggio ne azzera 26**.
Il guasto che questa rete previene **è già avvenuto una volta in questo stesso file** — è la ragione
per cui `turnstileSiteKey` viaggia senza essere mostrato — e la divisione in schede ne moltiplica
per cinque le occasioni.

🔴 **Se si divide il modulo prima di questa fase, la rete verifica il codice appena scritto invece
del contrario.** È il rischio numero uno dell'intero change. Nessuna riga di divisione prima del
task 1.8.

- [x] 1.1 **`duedgusto/src/@types/vetrina.d.ts` — i tre tipi input nuovi, solo come tipi** —
  `PaginaHomeInput` (4 campi), `PaginaLocaleInput` (2), `PaginaAperitivoInput` (4), esattamente
  secondo la tabella di [D2](./design.md). ⚠️ **`ImpostazioniVetrinaInput` NON si tocca**: resta a
  30 campi fino alla Fase 5. L'intersezione dei quattro nomina comunque 30 chiavi, perché i tre
  nuovi sono sottoinsiemi — è corretto e voluto. ⚠️ **Niente `immagine*Id` qui**: gli slot nascono
  alla Fase 3 (task 3.11).
  *Verifica*: `cd duedgusto && npm run ts:check` esce 0; nessun file `.tsx` importa ancora i tre
  tipi nuovi.

- [x] 1.2 🔴 **`duedgusto/src/components/pages/sito/proprietaCampiVetrina.tsx`** — il file di
  [D3](./design.md) ①: `type SchedaSito`, `type CampiScrivibiliVetrina` (intersezione dei quattro
  input), `export const PROPRIETA_CAMPI: Record<keyof CampiScrivibiliVetrina, SchedaSito>` con le
  30 voci della tabella [D2](./design.md), e `CAMPI_SCRIVIBILI` **derivato** da `PROPRIETA_CAMPI`
  (mai una seconda lista scritta a mano).
  🔴 `Record<keyof …>` e **non** `Partial<Record<…>>`: un campo scrivibile non assegnato a una
  scheda deve essere un **errore di compilazione**, non un test rosso.
  *Verifica*: `npm run ts:check` esce 0; `Object.keys(PROPRIETA_CAMPI).length === 30`; i due
  grappoli a validazione incrociata cadono ciascuno dentro **una sola** scheda (`latitudine`+
  `longitudine` → `impostazioni`; `punteggioGoogle`+`numeroRecensioniGoogle` → `home`).

- [x] 1.3 **Le quattro proiezioni, sopra il modulo ancora unico** — in
  `impostazioniVetrinaModulo.tsx` aggiungi `inputImpostazioni`, `inputHome`, `inputLocale`,
  `inputAperitivo`. In **questa fase** sono **proiezioni di `inputDaValori`** filtrate per
  `PROPRIETA_CAMPI`, non costruttori indipendenti: è ciò che rende dimostrabile il task 1.5 —
  togliendo un campo a `inputDaValori` il campo sparisce dall'unione. `ImpostazioniVetrinaPage`
  continua a chiamare `inputDaValori` e **non cambia comportamento**.
  *Verifica*: `npm run test` in `duedgusto/` verde; `git diff` non tocca `ImpostazioniVetrinaPage.tsx`.

- [x] 1.4 🔴 **Il test si riscrive contro un'autorità esterna** — in
  `__tests__/ImpostazioniVetrinaPage.test.tsx` **sostituisci** il test di riga 143 con quello di
  [D4](./design.md): le quattro proiezioni, `flatMap(Object.keys)`, `new Set(prodotti).size ===
  prodotti.length` (nessun campo in due schede) e `prodotti.sort()` uguale a
  `[...CAMPI_SCRIVIBILI].sort()` (nessun campo orfano). Il confronto modulo-con-sé-stesso **sparisce**:
  lasciarlo accanto darebbe due test di cui uno mente.
  *Verifica* (spec `impostazioni-vetrina` → *L'unione dei perimetri è l'insieme dei campi
  scrivibili*, *Nessun campo ha due proprietari*): `npm run test` verde e il messaggio di
  fallimento, quando fallisce, **nomina i campi** e non solo la lunghezza degli elenchi.

- [x] 1.5 🔴 **Verifica per mutazione — campo orfano. Da eseguire e da annotare nel commit.**
  Togli a mano un campo da `inputDaValori`, **esegui i test e vedi il test 1.4 fallire con il nome
  del campo nel messaggio**, poi rimetti la riga e vedilo tornare verde.
  *Verifica* (spec `impostazioni-vetrina` → *Verifica per mutazione — campo orfano*): l'esito è
  annotato nell'uscita di fase con il nome del test rosso e quello dei test rimasti verdi. Un test
  strutturale che nessuno ha mai visto fallire è indistinguibile da un test che non verifica niente.

- [x] 1.6 🔴 **Verifica per mutazione — campo conteso.** Fai restituire lo stesso campo a due
  proiezioni (per esempio `claimVetrina` da `inputHome` **e** da `inputImpostazioni`), vedi il test
  1.4 fallire sulla **disgiunzione** e non sulla totalità, poi rimuovi la modifica.
  *Verifica* (spec `impostazioni-vetrina` → *Verifica per mutazione — campo conteso*): i due modi di
  marcire della partizione sono coperti da **due** asserzioni distinte, e ciascuna è stata vista
  fallire da sola.

- [x] 1.7 🔴 **Verifica per mutazione della totalità dal compilatore.** Togli una voce da
  `PROPRIETA_CAMPI` e verifica che `npm run ts:check` **fallisca** nominando la chiave mancante;
  ripristina. Poi aggiungi un campo finto a uno dei tipi input e verifica che fallisca di nuovo;
  ripristina.
  *Verifica* (spec `impostazioni-vetrina` → *Un campo aggiunto in futuro non può restare fuori*):
  `ts:check` gira in CI, quindi questa è la difesa che scatta **nell'editor**, prima di ogni test.

- [x] 1.8 **Il test della chiave antispam resta com'è, in questa fase** — *«trasporta la chiave
  antispam che la pagina non mostra»* (riga 137) **non si tocca**: si sposterà sulla scheda
  Impostazioni sito al task 5.16, quando ci sarà un posto dove spostarlo.
  *Verifica*: `git diff` su quel test è vuoto.

**Uscita di fase.** Suite frontend verde, **nessun comportamento cambiato**, `git diff` non tocca
`backend/` né `sito/`, e la rete ha dimostrato di saper fallire in **tre** modi diversi (orfano,
conteso, non compilante). Annota il delta rispetto alla baseline 0.4.

**Rollback.** Revert puro, nessun dato coinvolto: i file nuovi non hanno consumatori a runtime.

### ✅ Esito misurato — Fase 1 (2026-08-13)

**Comandi di fine fase**, tutti sul tree con la Fase 1 applicata:

| Comando | Esito | Delta sulla baseline 0.4 |
|---|---|---|
| `npm run ts:check` | **0** | — |
| `npm run lint` | **0** | — |
| `npm run test` in `duedgusto/` | **790 / 790** (100 file) | **+1** — un test sostituito da **due** |
| `git status -- backend/ sito/` | **vuoto** | il diff non esce da `duedgusto/` |

**1.2 — la partizione, per cardinalità.** `Object.keys(PROPRIETA_CAMPI).length === 30`, ripartiti
**20 + 4 + 2 + 4**, e i due grappoli incrociati cadono ciascuno dentro una scheda sola
(`latitudine`+`longitudine` → `impostazioni`; `punteggioGoogle`+`numeroRecensioniGoogle` → `home`).
Fissato dal test *«la mappa di proprietà è esaustiva e non separa i grappoli a validazione
incrociata»*.

**1.3 — `ImpostazioniVetrinaPage.tsx` non toccata**: `git diff --stat` su quel file è **vuoto**. Le
quattro `inputXxx` sono proiezioni di `inputDaValori` filtrate per `PROPRIETA_CAMPI`, come richiesto;
diventeranno costruttori indipendenti al task 5.14.

**1.8 — il test della chiave antispam è identico**: `diff` del blocco `it("trasporta la chiave
antispam…")` fra il tree e `HEAD` → **vuoto**.

#### 🔴 Le tre verifiche per mutazione — eseguite, non dedotte

| # | Mutazione | Rosso | Verde intorno |
|---|---|---|---|
| **1.5** | `claimVetrina` tolto da `inputDaValori` | *l'unione delle schede copre esattamente i campi scrivibili* — `AssertionError: campi scrivibili che NESSUNA scheda spedisce (verrebbero azzerati): claimVetrina` | **18 su 19**, fra cui *«invia tutti i campi scrivibili quando i valori sono coerenti»* e *«trasporta la chiave antispam»* |
| **1.6** | `claimVetrina` rivendicato **anche** da `inputImpostazioni` | lo stesso test, ma sull'asserzione ① — `campi rivendicati da PIÙ DI UNA scheda (vince l'ultima che salva): claimVetrina (impostazioni + home)` | **18 su 19** |
| **1.7a** | voce `urlProfiloGoogle` tolta da `PROPRIETA_CAMPI` | `ts:check` esce **2** — `error TS2741: Property 'urlProfiloGoogle' is missing … but required in type 'Record<…, SchedaSito>'` | — |
| **1.7b** | campo `campoFintoDiProva` aggiunto a `PaginaLocaleInput` | `ts:check` esce **2** — `error TS2741: Property 'campoFintoDiProva' is missing …` | — |

🔴 **Le due letture che valgono più del rosso stesso.**

1. Nella mutazione **1.5**, `ts:check` è rimasto a **0**. I campi editoriali sono opzionali nel tipo
   input, quindi *dimenticarne uno non è un errore di compilazione*: il compilatore garantisce la
   totalità della **mappa**, mai quella dell'**invio**. È esattamente il buco che il test 1.4 copre,
   ed è la ragione per cui i due lati di [D3](./design.md) non sono ridondanti.
2. Sempre in **1.5**, il test di pagina *«invia tutti i campi scrivibili quando i valori sono
   coerenti»* è rimasto **verde** mentre un campo veniva azzerato a ogni salvataggio. È la prova
   diretta che la rete preesistente non avrebbe protetto niente.
3. **1.5 e 1.6 falliscono su asserzioni diverse dello stesso test**, e in quest'ordine per
   costruzione: la disgiunzione è verificata **per prima**, perché un campo conteso farebbe fallire
   anche il confronto di totalità (l'elenco avrebbe un elemento in più) e il messaggio parlerebbe
   della proprietà sbagliata.

Dopo ogni mutazione il ripristino è stato verificato: **19 / 19** verdi sul file, `ts:check` a **0**.

---

## Fase 2 — `RuoliImmaginiVetrina`, con gli slot che ancora non esistono

*(punto 2 del rollout — [D5](./design.md) ②)*

**Perché esiste.** È la mossa vera del nodo B, e vale **a prescindere dal pannello**: la regola che
assegna i ruoli per posizione oggi è scritta **quattro volte dentro quattro file `.astro`**, e il
backend non ne ha copia — motivo per cui *«quante immagini ospita questa pagina»* non ha risposta da
nessuna parte, nemmeno per chi legge il codice. In questa fase la funzione esiste, è provata, e
**nessuno la chiama ancora**: lo schema GraphQL e il contratto pubblico restano identici.

- [x] 2.1 **`backend/Services/Vetrina/RuoliImmaginiVetrina.cs`** — classe statica, **logica pura,
  nessun `DbContext`**, stessa collocazione e stessa ragione di `MenuLimiti` e `RegoleVetrina`.
  Espone `PianoImmagini Risolvi(int? eroeHomeId, int? ritrattoLocaleId, int? eroeAperitivoId,
  IReadOnlyList<MediaAsset> galleria)` e i record `PianoImmagini` / `enum OrigineRuolo { Slot,
  Posizione }` di [design.md §"Interfaces / Contracts"](./design.md).
  ⚠️ **La firma prende i tre identificativi e non l'entità**: le colonne nascono alla Fase 3, e
  l'overload di comodo `Risolvi(ImpostazioniVetrina, galleria)` arriva lì **delegando** a questa —
  mai reimplementando (stesso idioma di `RegoleVetrina.PrezzoEffettivo`).
  *Verifica*: `dotnet build backend/duedgusto.csproj -o /tmp/dued-build` esce 0; nessun file la
  chiama ancora.

- [x] 2.2 🔴 **Le sei regole del piano, e il ripiego per ciascun ruolo singolo** — la tabella di
  [D5](./design.md): `EroeHome` = slot, ripiego `galleria[0]`; `GrigliaHome` = finestra `[1..4)`;
  `FotoMenu` = `[0..3)`; `RitrattoLocale` = slot, ripiego `galleria[1] ?? galleria[0]`;
  `QuadrateLocale` = `[2..5)`; `EroeAperitivo` = slot, ~~ripiego `galleria.at(-1)`~~ **nessun
  ripiego** (vedi il riquadro sotto).
  🔴 Il commento deve dire che **a slot tutti vuoti il piano riproduce, immagine per immagine, ciò
  che il sito rende oggi**, ~~e che il ripiego dell'aperitivo è `.at(-1)` **deliberatamente** — è la
  regola peggiore delle sei ed è tenuta perché cambiarla cambierebbe il sito (risoluzione 6)~~.
  *Verifica*: `dotnet build` esce 0; `origine` vale `Slot` se e solo se lo slot è valorizzato **e**
  l'immagine è nella galleria passata.

  > 🔴 **DECISIONE DELL'UTENTE, successiva alla stesura del design — ribalta la risoluzione 6.**
  > L'eroe di `/aperitivo` **non ha ripiego**: con lo slot vuoto la pagina esce **senza** immagine
  > di testata, invece di prendere l'ultima foto della galleria. È l'unico punto in cui il change
  > **rompe deliberatamente** il principio *«a slot vuoti il sito rende immagine per immagine ciò
  > che rende oggi»*, e la differenza è **visibile**: finché nessuno valorizza lo slot,
  > `/aperitivo` perde l'immagine grande che mostra adesso.
  > **Perché.** `at(-1)` è la regola peggiore delle sei: fa sì che caricare una foto *qualsiasi*,
  > anche per un'altra pagina, sposti di nascosto l'eroe dell'aperitivo. Il ripiego non è un ponte
  > verso una migrazione ma la **semantica permanente** dello slot vuoto ([D5](./design.md) ③,
  > nessun backfill), quindi tenerlo avrebbe voluto dire tenere quel difetto per sempre. Uscire
  > senza immagine è invece la regola che governa già tutto il resto del sito — *una sezione senza
  > il suo dato non si rende*.
  > **Cosa ne consegue altrove**, da onorare nelle fasi successive:
  > – la **risoluzione 6** del preambolo di questo file è **superata**;
  > – il task **2.6** non può mutare un ripiego che non esiste: è stato riscritto (vedi lì);
  > – il task **4.6** (`immagini-ruoli.test.mjs`) e il task **4.8** (confronto con la cattura del
  >   «prima») **non possono più pretendere un `diff` vuoto su `/aperitivo`**: la cattura dello
  >   stato *pubblicato* mostra `B B` su quella pagina e dopo il change mostrerà **nessuna
  >   immagine**. Il confronto resta obbligatorio per le altre quattro pagine e per lo stato
  >   *svuotato* (`/aperitivo` è già 404 lì); su `/aperitivo` pubblicato l'attesa va **riscritta**,
  >   non allentata.
  > – il testo della scheda Aperitivo (Fase 6) non dirà più *«usa l'ultima della galleria, quindi
  >   cambia ogni volta che ne carichi una»* ma *«nessuna immagine scelta: la pagina esce senza
  >   immagine di testata»*.

- [x] 2.3 🔴 **Il test portante: a slot vuoti il piano è il sito di oggi** — crea
  `backend/DuedGusto.Tests/Unit/Services/RuoliImmaginiVetrinaTests.cs` con una matrice su gallerie
  da **0, 1, 2, 3, 5, 6** immagini, slot tutti vuoti, e l'asserzione chiave per chiave contro gli
  indici letterali di oggi (`[0]`; `[1..4)`; `[0..3)`; `[1] ?? [0]`; `[2..5)`; ~~`.at(-1)`~~
  **`null`**, per la decisione annotata al task 2.2).
  🔴 **I casi 0, 1 e 2 non sono casi limite teorici e vanno scritti a uno a uno**: oggi nessun test
  copre l'indicizzazione sotto le tre immagini, e in produzione la galleria ne ha **una sola**
  (task 0.3). Con una foto, la stessa immagine è contemporaneamente `EroeHome` e `RitrattoLocale`
  (~~ed `EroeAperitivo`~~ — che ora resta **scoperto**, task 2.2), `FotoMenu` ha un elemento e le
  due griglie sono **vuote**: il test lo deve affermare, non subire.
  *Verifica* (spec `media-assets` → *Primo avvio dopo la migrazione, slot tutti vuoti*):
  `dotnet test … --filter "RuoliImmagini"` passa; il caso a 1 immagine ha un `Assert` per ciascuno
  dei sei ruoli, non un confronto d'insieme.

- [x] 2.4 **La finestra salta i ruoli singoli e scorre** — con `EroeHome` valorizzato sulla 3ª
  immagine di una galleria da 6, `GrigliaHome` **non la contiene** e ha comunque 3 elementi.
  ⚠️ E il caso complementare: a slot vuoti la regola **non ha effetto** (l'eroe è `[0]`, la griglia
  parte da `[1]`), quindi non altera il comportamento attuale.
  *Verifica* ([D5](./design.md) ⚠️): entrambi i casi sono test distinti; il secondo è ciò che
  dimostra che la regola nuova non ha cambiato nulla oggi.

- [x] 2.5 **`origine` distingue la scelta dalla posizione** — slot valorizzato → `Slot`; slot vuoto
  → `Posizione`; slot che punta a un'immagine **non presente nella galleria** (non pubblicata o in
  un'altra cartella) → `Posizione`, cioè si ricade sul ripiego.
  *Verifica* (spec `media-assets` → *Un'immagine non pubblicata non ha ruoli*, *Un'immagine fuori
  dalla galleria non ha ruoli di pagina*): il piano non attribuisce mai un ruolo a un'immagine che
  la rotta pubblica non selezionerebbe.

- [x] 2.6 🔴 **Verifica per mutazione del test portante** — ~~cambia il ripiego dell'aperitivo da
  `.at(-1)` a `[0]`, **esegui i test e vedi fallire i casi con più di una immagine** mentre quelli
  con 0 e 1 **restano verdi** (con una foto sola i due ripieghi coincidono), poi ripristina.~~
  ⚠️ **Riscritto**: dopo la decisione del task 2.2 l'aperitivo **non ha un ripiego da mutare**. Al
  suo posto, **tre** mutazioni che colpiscono lo stesso bersaglio — che il test portante non stia
  pinnando se stesso — e che coprono anche il ripiego con la forma d'esito che il task descriveva:
  **A** reintroduce `at(-1)` sull'aperitivo (deve far cadere i casi con ≥ 1 immagine); **B** riduce
  il ripiego del ritratto da `[1] ?? [0]` a `[0]` (deve far cadere i casi con ≥ 2 immagini, lasciando
  verdi 0 e 1 — è **letteralmente** la forma prevista qui, applicata al ruolo che un ripiego ce
  l'ha); **C** toglie il salto della finestra (deve far cadere **solo** i due test del task 2.4).
  *Verifica*: l'esito è annotato con i test rossi e i verdi. Se restassero verdi tutti, il test
  starebbe pinnando se stesso.

- [x] 2.7 **Nessuno chiama ancora la funzione** — controllo esplicito di fine fase.
  *Verifica*: `grep -rn "RuoliImmaginiVetrina" backend/ --include=*.cs` trova la definizione e il
  solo file di test; `git diff --stat backend/Controllers/ backend/GraphQL/` è **vuoto**.

**Uscita di fase.** Una funzione pura, provata su sei dimensioni di galleria compresi i tre casi
sotto le tre foto, **zero superficie nuova**, schema GraphQL e contratto pubblico invariati.

**Rollback.** Revert puro: nessun chiamante, nessun dato, nessuno schema.

### ✅ Esito misurato — Fase 2 (2026-08-13)

**Due file nuovi, nessun file esistente modificato.**
`backend/Services/Vetrina/RuoliImmaginiVetrina.cs` (definizione) e
`backend/DuedGusto.Tests/Unit/Services/RuoliImmaginiVetrinaTests.cs` (test). `git status` non elenca
alcun file modificato: la fase è **solo additiva**.

| Comando | Esito | Delta sulla baseline 0.4 |
|---|---|---|
| `dotnet build backend/duedgusto.csproj` | **0 errori, 0 avvisi** | — |
| `dotnet test` (suite intera) | **726 / 726** | **+17** — i soli test nuovi |
| `dotnet test --filter "RuoliImmagini"` | **17 / 17** | — |

**2.1 — la firma.** `Risolvi(int? eroeHomeId, int? ritrattoLocaleId, int? eroeAperitivoId,
IReadOnlyList<MediaAsset> galleria)`, logica pura senza `DbContext`, con `PianoImmagini` e
`OrigineRuolo` nello stesso file. Prende i **tre identificativi e non l'entità** perché le colonne
nascono alla Fase 3: l'overload di comodo del task 3.3 delegherà a questa.

**2.2 — 🔴 la divergenza, e dov'è annotata.** Il ripiego dell'aperitivo è stato **rimosso** per
decisione dell'utente (riquadro nel task 2.2). L'eccezione è scritta **tre volte, in prosa**: nella
docstring di classe di `RuoliImmaginiVetrina`, nella docstring del parametro `EroeAperitivo` di
`PianoImmagini`, e nella docstring di classe del file di test. Non è una riga di codice silenziosa.

**2.3 — i tre casi reali, uno a uno.** `Risolvi_ConGalleriaVuota_…`,
`Risolvi_ConUnaSolaImmagine_…` (lo stato della **produzione**) e `Risolvi_ConDueImmagini_…` (lo
stato dello **sviluppo locale**) hanno un'asserzione per ciascuno dei sei ruoli, con i valori attesi
scritti a mano. La `[Theory]` su 0-1-2-3-5-6 confronta invece contro l'**aritmetica dei `.astro`
riscritta accanto a ogni riga** (`galleria.Skip(1).Take(3)` per `index.astro:86`, …), quindi è
un'autorità esterna alla funzione e non un suo riflesso.

**2.4 — il salto, e il caso complementare.** Con `EroeHome` sulla 3ª di 6, `GrigliaHome` vale
`[2ª, 4ª, 5ª]`: non la contiene e ha **comunque 3 elementi**. Stesso test per `RitrattoLocale` sulla
4ª e le quadrate. Il complementare (`…_IlSaltoNonHaAlcunEffettoSulleFinestre`) è un test **distinto**
ed è quello che dimostra che la regola nuova non cambia nulla oggi. Aggiunto un terzo caso: la
finestra di `/menu` **non** salta gli slot delle altre pagine — il salto è per pagina, non globale.

#### 🔴 Le tre verifiche per mutazione — eseguite, non dedotte

| # | Mutazione | Rossi | Verdi |
|---|---|---|---|
| **A** | ripiego `at(-1)` **reintrodotto** sull'aperitivo | **8**: la `[Theory]` su 1, 2, 3, 5, 6 + `ConUnaSolaImmagine` + `ConDueImmagini` + `ConSlotFuoriDallaGalleria`. Messaggio: `Expected piano.EroeAperitivo to be <null>, but found duedgusto.Models.MediaAsset { … Chiave = "2026/08/foto-1" … }` | **9**, fra cui `[Theory](0)` e `ConGalleriaVuota`: a galleria vuota `at(-1)` è `null` comunque |
| **B** | ripiego del ritratto ridotto da `[1] ?? [0]` a `[0]` | **7**: la `[Theory]` su 2, 3, 5, 6 + `ConDueImmagini` + `ConSlotFuoriDallaGalleria` + `IlSaltoNonHaAlcunEffetto` | **10**: `[Theory]` su **0 e 1**, `ConGalleriaVuota`, `ConUnaSolaImmagine` — con una foto sola i due ripieghi coincidono, esattamente la forma prevista dal task |
| **C** | salto della finestra **rimosso** | **2**, e **solo** quelli: `ConEroeHomeDentroLaFinestra` e `ConRitrattoLocaleDentroLaFinestra` | **15**, tutta la matrice compresa |

🔴 **La lettura che vale più del rosso.** La mutazione **C** lascia verdi tutti e sei i casi della
matrice: è la **prova diretta**, e non l'argomento a parole di [D5](./design.md), che il salto della
finestra **non altera il comportamento attuale** — se lo alterasse, togliendolo la matrice sarebbe
diventata rossa. È l'unica cosa che il task 2.4 chiedeva di dimostrare e che una lettura del codice
non poteva stabilire.

Dopo ogni mutazione il ripristino è stato verificato: **17 / 17** sul file, suite intera **726 / 726**.

**2.7 — nessun chiamante.** `grep -rl "RuoliImmaginiVetrina" backend/ --include=*.cs` restituisce
**due** file, la definizione e il test. `git diff --stat backend/Controllers/ backend/GraphQL/` è
**vuoto**: schema GraphQL e contratto pubblico sono identici byte per byte.

---

## Fase 3 — Modello, migrazione additiva, e l'eliminazione a cinque referenti

*(punto 3 del rollout — [D7](./design.md), [D8](./design.md))*

**Perché esiste.** Tre colonne nullable sembrano innocue, e lo sono — tranne in un punto:
`EliminaMediaAssetAsync` verifica **due** referenti e li verifica **prima** del disco, e il modo di
sbagliare qui è **silenzioso a metà**. Con la verifica dopo, la chiave esterna rifiuta comunque, ma
**a file già cancellati**: il sintomo non è «i dati sono spariti», è «i file sono spariti e il
messaggio d'errore è incomprensibile».

**Task di migrazione (3.4, 3.5, 3.6) separati da quelli di codice applicativo**, come da
`openspec/config.yaml` → `rules.tasks`.

- [ ] 3.1 **`backend/Models/ImpostazioniVetrina.cs` — i tre slot** — `ImmagineEroeHomeId` +
  `ImmagineEroeHome`, `ImmagineRitrattoLocaleId` + `ImmagineRitrattoLocale`,
  `ImmagineEroeAperitivoId` + `ImmagineEroeAperitivo`, sul modello esatto di `ImmagineOgId`.
  Ogni docstring dice cosa succede a lasciarlo vuoto, con le stesse parole della scheda: *«Vuota: il
  sito usa la prima della galleria, che è il comportamento di oggi»*.
  *Verifica*: `dotnet build` esce 0; nessuna collezione inversa aggiunta a `MediaAsset`.

- [ ] 3.2 🔴 **`backend/DataAccess/AppDbContext.cs` — tre relazioni senza navigazione inversa** —
  `HasOne(x => x.ImmagineEroeHome).WithMany().HasForeignKey(x => x.ImmagineEroeHomeId)
  .OnDelete(DeleteBehavior.Restrict)`, e idem per le altre due, dentro il blocco
  `ImpostazioniVetrina` esistente.
  ⚠️ `WithMany()` **esplicito e senza argomento**: `MediaAsset` ha già `ICollection<Prodotto>`, e
  senza la dichiarazione EF può creare una FK ombra, cioè una colonna su `MediaAssets` che questo
  change ha promesso di non toccare. È la trappola già documentata due change fa.
  *Verifica* (spec `media-assets` → *Nessuna colonna ombra sull'entità dei media*): `dotnet build`
  esce 0.

- [ ] 3.3 **L'overload di comodo di `Risolvi`** — `Risolvi(ImpostazioniVetrina impostazioni,
  IReadOnlyList<MediaAsset> galleria)` che **delega** alla firma a tre identificativi del task 2.1.
  🔴 Mai una seconda implementazione: è la firma che [D5](./design.md) dichiara sede **unica** della
  regola.
  *Verifica*: il corpo è una riga sola; un test verifica che le due forme **coincidono** su tutta la
  matrice del task 2.3.

- [ ] 3.4 🔴 **Scaffolding della migrazione `SlotImmaginiPagineVetrina`, a backend spento** — la
  procedura è scritta per intero in [design.md §D8](./design.md) e **non si duplica qui**: si
  eseguono quei tre passi, nell'ordine, con i vincoli operativi di questo file.
  🔴 In questo repository `dotnet ef migrations add` **non gira con il backend acceso** — lo
  strumento ricostruisce il progetto e il `.dll` è bloccato dal processo. Fermalo prima
  (`Ctrl-C` sul `dotnet run`), e ricorda `EF_MIGRATIONS=1` e `OutputPath`.
  *Verifica*: il file generato esiste e `dotnet build` era verde **prima** della generazione.

- [ ] 3.5 **Ispezione dello script prima di fidarsi** — `EF_MIGRATIONS=1 dotnet ef migrations script`.
  Si accetta **solo**: `AddColumn<int>(…, nullable: true)` × 3 su `ImpostazioniVetrina`,
  `CreateIndex` × 3, `AddForeignKey(… onDelete: ReferentialAction.Restrict)` × 3.
  🔴 **Nessun `AlterTable` e nessun `AddColumn` su `MediaAssets`.** Se compaiono, la causa è quasi
  certamente il `WithMany()` del task 3.2: si corregge **il modello** e si **rigenera**
  (`dotnet ef migrations remove`, poi `add`), **mai** si edita la migrazione a mano.
  *Verifica* (spec `media-assets` → *La migrazione non tocca la tabella dei media*):
  `grep -cE "AlterTable|AlterColumn|DropColumn" <script>` vale **0**, e nessuna riga nomina
  `MediaAssets` se non come tabella **referenziata** dalle tre FK.

- [ ] 3.6 **Applicazione su un database con dati reali** — riavvia il backend: `MigrateAsync` la
  applica all'avvio ([Program.cs](../../../backend/Program.cs)), niente `database update` a mano.
  *Verifica* (spec `media-assets` → *Nessuna colonna ombra sull'entità dei media*): `SHOW CREATE
  TABLE MediaAssets` **identico byte per byte** a prima; `SELECT COUNT(*)` su `MediaAssets`,
  `Prodotti` e `ImpostazioniVetrina` invariati; le tre colonne nuove esistono e valgono `NULL`.

- [ ] 3.7 🔴 **`EliminaMediaAssetAsync`: da due referenti a cinque** — in
  [`VetrinaMutations.cs:374-419`](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs) i tre slot
  entrano nella **stessa** verifica, **prima** di `storage.EliminaAsync(asset.Chiave)`, con la query
  singola di [D7](./design.md) che restituisce il **ruolo occupato** già in prosa.
  ⚠️ Il conteggio: referente 1 = i prodotti, referenti 2-5 = i quattro slot immagine delle
  impostazioni (anteprima social + i tre nuovi). La docstring del metodo dice «**DUE**» e va
  riscritta, altrimenti resta la sola documentazione del file ed è falsa.
  🔴 Fra la lettura dei referenti e `storage.EliminaAsync` **non deve poter entrare nulla**.
  *Verifica*: `dotnet build` esce 0; il messaggio d'errore nomina il ruolo in italiano
  (*«l'immagine grande della pagina Home»*), non il nome della colonna.

- [ ] 3.8 🔴 **Test dell'eliminazione: una `[Theory]` sui quattro slot, e l'asserzione che conta è
  la seconda** — in `backend/DuedGusto.Tests/Integration/GraphQL/VetrinaMediaTests.cs`: per ciascuno
  dei quattro slot, il rifiuto **nomina il ruolo** *e* **i file sono ancora sul filesystem**.
  🔴 Una `[Theory]` parametrizzata sui quattro, **non** il test esistente copiato quattro volte.
  *Verifica* (spec `media-assets`; [D7](./design.md)): `dotnet test --filter "EliminaMediaAsset"`
  passa; ogni caso ha **due** `Assert`, e il secondo è sui file.

- [ ] 3.9 🔴 **Verifica per mutazione dell'ordine** — sposta la lettura dei cinque referenti
  **dopo** `storage.EliminaAsync`, esegui i test e osserva che **il test sul rifiuto resta verde**
  mentre **quello sui file diventa rosso**; poi ripristina.
  *Verifica*: l'esito è annotato con i due nomi. È la prova diretta che un test scritto solo sul
  rifiuto non avrebbe protetto niente — e la ragione per cui il task 3.8 ne pretende due.

- [ ] 3.10 **`ImpostazioniVetrinaType` espone i tre slot in lettura** — il tipo di **output** resta
  unico (la divisione è nella scrittura, non nella lettura).
  *Verifica*: l'introspezione mostra i tre campi nuovi; nessun tipo di output nuovo è stato creato.

- [ ] 3.11 🔴 **`PROPRIETA_CAMPI` e i tipi TS guadagnano i tre slot: la partizione passa da 30 a 33** —
  `immagineEroeHomeId` → `home`, `immagineRitrattoLocaleId` → `locale`, `immagineEroeAperitivoId` →
  `aperitivo`, nei tre tipi input di `@types/vetrina.d.ts` e nella mappa di
  `proprietaCampiVetrina.tsx`.
  ⚠️ Il test del task 1.4 **deve restare verde**: se diventa rosso, o la mappa o i tipi sono
  incompleti — ed è esattamente ciò che deve succedere se se ne dimentica uno.
  *Verifica*: `npm run ts:check` esce 0; `Object.keys(PROPRIETA_CAMPI).length === 33`; `npm run test`
  in `duedgusto/` verde.

- [ ] 3.12 **Nessuno scrive ancora gli slot** — controllo esplicito di fine fase: la scrittura
  arriva alla Fase 5, insieme a `VerificaImmagineAssegnabileAsync` per ciascuno slot.
  *Verifica*: `grep -rn "ImmagineEroeHomeId" backend/GraphQL/` trova solo il tipo di output; nessun
  input type li accetta.

**Uscita di fase.** Le colonne esistono e sono tutte `NULL`, `MediaAssets` è identica byte per byte,
l'eliminazione protegge cinque referenti e lo fa **prima** del disco. Il sito e il pannello non sono
ancora cambiati.

**Rollback.** La migrazione è **additiva** e lasciarla in produzione è **innocuo**: le tre colonne
sono nullable e il codice precedente le ignora. ⚠️ Da qui in avanti nasce l'unico **punto di non
ritorno** del change — vedi il rollback della Fase 4.

---

## Fase 4 — `/api/public/galleria` guadagna `ruoli`, e i quattro `.astro` lo leggono

*(punto 4 del rollout — [D6](./design.md))*

**Perché esiste.** È il gradino che **toglie la regola dai quattro `.astro`**. Finché la
risoluzione resta lassù, il ripiego («slot, altrimenti la posizione») finirebbe scritto quattro volte
nei sorgenti del sito e una quinta nel pannello — cioè il problema di partenza con un campo in più.
Ed è il gradino verificabile **interamente con `curl` e con i test del sito**, senza una riga di
pannello.

⚠️ **Ordine di deploy interno alla fase**: il **backend prima del sito**. `leggiGalleria` valida le
chiavi della risposta ([api.ts:172-176](../../../sito/src/lib/api.ts)); un sito che pretende `ruoli`
davanti a un backend che non li manda **degrada** invece di rendere le immagini.

- [ ] 4.1 **`backend/Controllers/Public/Dto/GalleriaPubblicaDto.cs`** — `+Ruoli` sul record
  esistente e il nuovo `RuoliImmaginiDto` che **riusa `ImmaginePubblicaDto`**, come da
  [D6](./design.md). `IReadOnlyList<T>` per le tre griglie, nullable per i tre ruoli singoli.
  ⚠️ `immagini` **resta**: è additivo per definizione, e toglierlo romperebbe quattro scenari della
  spec `api-pubblica` e i test `menu.test.mjs:157` e `prefissi.test.mjs:50`.
  *Verifica*: `dotnet build` esce 0; `ImmaginePubblicaDto` è **identico** (è lo stesso tipo di
  `/api/public/menu`, e `PublicControllerTests.cs:611` lo pinna).

- [ ] 4.2 **`PublicController` compone `Ruoli` da `RuoliImmaginiVetrina`** — la galleria si legge
  come oggi (`Cartella == "galleria" && Pubblicato`, ordinata per `Ordinamento`), poi si chiama
  `Risolvi`. Nessun altro cambio: stessa politica di cache, stessa proiezione, nessun parametro di
  query nuovo.
  *Verifica* (spec `sito-pubblico` → *La politica di cache non cambia*): `curl` sulla rotta mostra
  `Cache-Control: public,max-age=300` invariato e `immagini` identico alla risposta di prima.

- [ ] 4.3 **La superficie pubblica resta chiusa per costruzione** — i tre test strutturali di
  `SuperficiePubblicaTests` attraversano `RuoliImmaginiDto` **senza modifiche** (la BFS è ricorsiva
  sui tipi annidati) purché il record stia in `duedgusto.Controllers.Public.Dto`.
  *Verifica*: `dotnet test --filter "SuperficiePubblica"` passa **senza che il test sia stato
  toccato**. Se è stato necessario modificarlo, il record è nel namespace sbagliato.

- [ ] 4.4 **`sito/src/lib/tipi.ts` e `api.ts`** — `GalleriaPubblica` guadagna `ruoli`;
  `leggiGalleria` aggiunge `'ruoli'` alle chiavi riconosciute.
  ⚠️ Da questo commit il sito **pretende** il campo: il backend va in linea per primo.
  *Verifica*: `cd sito && npm run check` esce 0.

- [ ] 4.5 **I quattro `.astro` leggono per nome invece che per indice** — `index.astro`
  (`ruoli.eroeHome` / `ruoli.grigliaHome`), `menu.astro` (`ruoli.fotoMenu`), `locale.astro`
  (`ruoli.ritrattoLocale` / `ruoli.quadrateLocale`), `aperitivo.astro` (`ruoli.eroeAperitivo`).
  🔴 **`contatti.astro` non si tocca**: non legge la galleria.
  ⚠️ I commenti sopra le righe sostituite descrivono l'aritmetica che sparisce e vanno riscritti:
  quello di `index.astro:82-84` dichiara una premessa (*«l'ordine è editoriale»*) che **da adesso in
  poi è vera** e prima non lo era.
  *Verifica*: `grep -n "galleria\[\|slice(\|at(-1)" sito/src/pages/*.astro` non trova più
  aritmetica sugli indici della galleria.

- [ ] 4.6 🔴 **`sito/test/immagini-ruoli.test.mjs`** — con il sito di prova e **slot vuoti**, le
  quattro pagine rendono **le stesse chiavi immagine** di prima del change, nelle stesse posizioni.
  🔴 Tre dimensioni obbligatorie: la galleria di prova, **una sola immagine** (lo stato reale della
  produzione, task 0.3) e **zero immagini**. Con una foto sola la stessa chiave compare su home
  e locale, e le griglie sono vuote: il test lo afferma.
  ⚠️ **`/aperitivo` è l'eccezione, ed è voluta** (riquadro del task 2.2): a slot vuoto quella pagina
  rende **nessuna** immagine di testata, dove prima rendeva l'ultima della galleria. Il test deve
  affermare **l'assenza**, non ricopiare il «prima»: quattro pagine su cinque provano la non
  regressione, la quinta prova la differenza decisa.
  *Verifica* (spec `sito-pubblico` → *Le cinque pagine rispondono come prima*): `cd sito && npm test`
  passa; il file usa `_sito-di-prova.mjs` come gli altri, non una nuova impalcatura.

- [ ] 4.7 **Le regressioni del sito restano verdi senza modifiche** — `navigazione.test.mjs`,
  `menu.test.mjs`, `prefissi.test.mjs`, `immagini.test.mjs`, `degradazione.test.mjs`.
  *Verifica*: `git diff sito/test/` mostra **solo** il file nuovo del task 4.6. Se un test esistente
  è stato modificato, il contratto è cambiato in un modo che il task 4.1 diceva additivo.

- [ ] 4.8 🔴 **Confronto con la cattura del «prima»** — riesegui la cattura del task 0.2 e
  **confronta**, nei due stati delle pagine condizionate: stessi codici HTTP, stesse chiavi immagine
  nelle stesse posizioni, stessa sitemap, stesse voci di intestazione e piè di pagina.
  *Verifica* (spec `sito-pubblico` → *Navigazione e sitemap invariate*, *Il 404 condizionato si
  comporta come prima, in entrambi gli stati*): il `diff` fra le dieci catture prima/dopo è
  **vuoto**. Non una lettura a occhio: un confronto di file.
  ⚠️ **Una sola cella attesa diversa, e va scritta prima di rieseguire** (riquadro del task 2.2):
  `/aperitivo` nello stato **pubblicato** passa da `B B` a **nessuna immagine**. Le altre nove
  catture su dieci devono dare `diff` vuoto — compreso `/aperitivo` nello stato *svuotato*, che è
  già 404. 🔴 L'attesa va **riscritta**, non allentata: un confronto reso permissivo su una pagina
  smetterebbe di sorvegliare anche tutto il resto di quella pagina.

- [ ] 4.9 **Prova manuale della rotta** — su una seconda istanza, `curl -k
  https://localhost:4012/api/public/galleria`.
  *Verifica*: la risposta contiene `immagini` **e** `ruoli`; con la galleria reale a una foto,
  `eroeHome` e `ritrattoLocale` sono la **stessa** chiave, `eroeAperitivo` è **`null`** (task 2.2)
  e le tre griglie sono liste vuote o di un elemento, coerenti con il task 2.3.

**Uscita di fase.** Il sito legge i ruoli per nome e rende **le stesse immagini** di prima, provato
per confronto e non per impressione. La regola vive in un posto solo. Nessuna scrittura è ancora
partizionata.

**Rollback.** Revert dei `.astro`, di `tipi.ts` e di `api.ts`; il campo `ruoli` può restare nella
risposta (è additivo). ⚠️ 🔴 **Se nel frattempo qualcuno ha valorizzato uno slot**, i valori vanno
**riportati nell'ordine della galleria prima** del revert: altrimenti la scelta editoriale si perde
in silenzio. È l'**unico punto di non ritorno** del change.

---

## Fase 5 — 🔴 La partizione della scrittura

*(punto 5 del rollout — [D1](./design.md), [D2](./design.md), [D3](./design.md) ②, [D14](./design.md))*

**Perché esiste.** È il gradino che il change esiste per fare, ed è quello in cui il rischio
principale si chiude o resta aperto. L'assegnazione totale — la riga che permette di **svuotare** un
campo — sopravvive intatta *dentro* ogni scheda; ciò che sparisce è la **sovrapposizione** fra
scheda e scheda.

🔴 **Vincolo di deploy non negoziabile: backend e frontend nello stesso deploy.** Ridurre
`mutateImpostazioniVetrina` da 30 a 20 campi è una modifica **breaking** della forma dell'input: fra
i due, un frontend vecchio invierebbe 30 campi a un input che ne accetta 20 e verrebbe **rifiutato
dalla validazione del documento** — rumoroso, non silenzioso, ma comunque un'interruzione.

- [ ] 5.1 **`CaricaOCreaSingletonAsync` estratto** — l'helper privato di [D1](./design.md), **sede
  unica dell'upsert**: legge per `ImpostazioniVetrinaId == IdSingleton` e crea la riga se manca
  (installazione con `SEED_ON_STARTUP=false`, dove il primo salvataggio è anche il primo
  inserimento). `ApplicaImpostazioniVetrinaAsync` smette di avere il proprio `FirstOrDefaultAsync`.
  🔴 **Mai un `FirstOrDefault()` senza criterio**: c'è una riga sola, il database lo impone con un
  `CHECK`, e chiederla per identificativo è anche il modo di dirlo al lettore.
  *Verifica*: `grep -n "ImpostazioniVetrina$" -A3 backend/GraphQL/Vetrina/VetrinaMutations.cs` mostra
  **una sola** lettura del singleton; `dotnet build` esce 0.

- [ ] 5.2 🔴 **I tre input type nuovi e la riduzione del quarto** — `PaginaHomeInputType` (4 campi +
  `immagineEroeHomeId`), `PaginaLocaleInputType` (2 + `immagineRitrattoLocaleId`),
  `PaginaAperitivoInputType` (4 + `immagineEroeAperitivoId`) in
  `backend/GraphQL/Vetrina/Types/`; `ImpostazioniVetrinaInputType` **ridotto a 20 campi**.
  Le `Description` di ogni campo migrato si conservano **carattere per carattere**: cambia dove il
  campo vive, non ciò che il contratto promette.
  *Verifica*: l'introspezione mostra quattro input; nessun campo compare in due; nessuno dei quattro
  nomina `openingTime`, `closingTime`, `operatingDays`, `timezone`.

- [ ] 5.3 🔴 **I tre resolver e le tre `Applica…Async`, ad assegnazione totale sul proprio
  sottoinsieme** — `mutatePaginaHome`, `mutatePaginaLocale`, `mutatePaginaAperitivo`, ognuna con
  `GuardAmministratore` come **prima istruzione** e **tutte** le validazioni prima di qualunque tocco
  al change tracker.
  🔴 Il commento-divieto di [`VetrinaMutations.cs:488-490`](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs)
  va **ricopiato in ognuno dei quattro**, e la ragione riscritta perché adesso è **locale**:
  *l'input possiede esattamente i campi scrivibili di quella scheda, quindi non c'è nulla da
  preservare e quindi nessuna ragione di assegnare sotto condizione.* Nessun
  `if (!string.IsNullOrEmpty(...))`, oggi né mai.
  *Verifica*: `dotnet build` esce 0; il tipo di ritorno delle quattro è `ImpostazioniVetrina`, **uno
  solo** (dividere anche l'output significherebbe quattro fragment e quattro copie in cache).

- [ ] 5.4 **Le due validazioni incrociate cambiano chiamante, non forma** — `ValidaCoordinate` resta
  dov'è ed è chiamata **solo** da `mutateImpostazioniVetrina`; `ValidaReputazione` **solo** da
  `mutatePaginaHome`.
  *Verifica* (spec `impostazioni-vetrina` → *Le coppie a validazione incrociata non si separano*):
  ciascuna delle due funzioni ha **un solo** chiamante, e i due membri di ogni coppia stanno nello
  stesso input.

- [ ] 5.5 **`VerificaImmagineAssegnabileAsync` per ciascuno slot** — `mutatePaginaHome` per l'eroe,
  `mutatePaginaLocale` per il ritratto, `mutatePaginaAperitivo` per il suo eroe. È `internal static`
  ed è la **sede unica** della regola *«esiste ed è pubblicato»*: si chiama, non si reimplementa.
  *Verifica*: assegnare uno slot a un media non pubblicato viene rifiutato con lo stesso messaggio
  che già oggi protegge `immagineOgId`.

- [ ] 5.6 **Query `ruoliImmagini` dietro `GuardAmministratore`** — in `VetrinaQueries.cs`, con
  `origine: SLOT | POSIZIONE` per i tre ruoli singoli, come da [D6](./design.md). 🔴 `origine` **non
  esce in pubblico**: il sito non ha nulla da farci.
  *Verifica*: l'introspezione mostra il campo sotto `vetrina`; nessun campo `origine` compare nel DTO
  di `/api/public/galleria`.

- [ ] 5.7 🔴 **Il pin per riflessione diventa un confronto contro il modello** — in
  `ImpostazioniVetrinaTests.cs`, l'elenco letterale di
  `ImpostazioniVetrinaInput_HaEsattamenteICampiScrivibili` (righe 427-447) è sostituito da
  `NonScrivibiliDaGraphQL` + i due `Fact` di [D3](./design.md) ②:
  `UnioneDegliInput_EEsattamenteLInsiemeDeiCampiScrivibili` e `NessunCampoAppartieneADueSchede`
  (intersezione a coppie = ∅).
  ⚠️ `NonScrivibiliDaGraphQL` contiene le tre **navigazioni** nuove, non i tre identificativi: la
  partizione è su **33** campi (risoluzione 2).
  *Verifica* (spec `impostazioni-vetrina` → *L'unione dei perimetri è l'insieme dei campi
  scrivibili*): un campo aggiunto al modello e a nessun input viene dichiarato **orfano per nome**.

- [ ] 5.8 🔴 **Verifica per mutazione del pin, nei due versi** — togli un campo da un input: il test
  nomina l'orfano; copia un campo in due input: il test nomina il conteso. Ripristina entrambi.
  *Verifica* (spec `impostazioni-vetrina` → *Verifica per mutazione — campo orfano*, *— campo
  conteso*): l'esito è annotato con i nomi dei test rossi. Sono **due proprietà distinte** e nessun
  meccanismo singolo le copre bene entrambe: qui si dimostra che sono coperte davvero.

- [ ] 5.9 🔴 **Nessun azzeramento incrociato — il test che è il motivo del change** — per **ognuna**
  delle quattro mutation: si semina la riga con tutti i **33** campi a valori non di default, si
  salva la scheda, e si asserisce che **ogni** campo fuori dal gruppo è **invariato**.
  🔴 Parametrizzato sulla **definizione dei gruppi**, non copiato quattro volte: una copia
  dimenticherebbe il campo aggiunto domani.
  *Verifica* (spec `impostazioni-vetrina` → *Salvataggio a vuoto di ciascuna scheda*, *Salvataggio
  con una modifica dentro il perimetro*, *La chiave del servizio antispam sopravvive a tutti i
  salvataggi*): `dotnet test --filter "AzzeramentoIncrociato"` passa; `TurnstileSiteKey` sopravvive
  a tutti e quattro i salvataggi.

- [ ] 5.10 🔴 **Verifica per mutazione dell'assenza di azzeramento** — togli un campo dal proprio
  input **lasciandolo assegnato** nella `Applica…Async` (cioè assegnandolo da un valore assente):
  il test 5.9 deve diventare rosso **nominando il campo azzerato**. Ripristina.
  *Verifica* (spec `impostazioni-vetrina` → *Verifica per mutazione dell'assenza di azzeramento
  incrociato*): annota il nome del campo comparso nel messaggio.

- [ ] 5.11 🔴 **Lo svuotamento continua a funzionare** —
  `Mutation_ConUnCampoOpzionaleSvuotato_PersisteLAssenza`
  ([ImpostazioniVetrinaTests.cs:82](../../../backend/DuedGusto.Tests/Integration/GraphQL/ImpostazioniVetrinaTests.cs))
  passa **senza modifiche di sostanza**, + un caso equivalente per ciascuna delle tre mutation nuove
  (svuotare `claimVetrina`, `storiaTitolo`, `aperitivoCategorie` persiste l'assenza).
  *Verifica* (spec `impostazioni-vetrina` → *Svuotamento di un campo opzionale, dalla scheda che lo
  possiede*, *Lo scenario di svuotamento preesistente resta valido*): se quel test ha richiesto una
  modifica di **sostanza**, la semantica di patch è rientrata dalla finestra ed è da rifiutare.

- [ ] 5.12 🔴 **Gli orari restano fuori, per costruzione, su quattro mutation** — la `[Theory]` di
  [`ImpostazioniVetrinaTests.cs:386-418`](../../../backend/DuedGusto.Tests/Integration/GraphQL/ImpostazioniVetrinaTests.cs)
  passa da **una** mutation × 6 campi vietati a **quattro** × 6 = **24 casi generati, non copiati**.
  *Verifica* (spec `impostazioni-vetrina` → *Nessun campo di orario in alcuna scheda*;
  [D14](./design.md)): il rifiuto arriva dalla **validazione del documento**, prima del resolver, su
  tutte e quattro. È ciò che fa ereditare la protezione a una scheda scritta fra sei mesi.

- [ ] 5.13 **Privilegi** — un utente autenticato **non amministratore** è respinto su tutte e quattro
  le mutation e sulla query `ruoliImmagini`.
  ⚠️ L'anonimo **non** richiede test nuovi, e per una ragione precisa: le `[Theory]` di
  `AutorizzazioneAnonimaTests` enumerano i **rami root** (`vetrina`), non i singoli campi, e il ramo
  porta già `this.Authorize()` di tipo. Nessun ramo root nuovo → `SchemaEspone_TuttiIRamiRootAttesi`
  resta verde **senza modifiche**.
  *Verifica*: `dotnet test --filter "Privilegi|AutorizzazioneAnonima"` passa; `git diff` su
  `AutorizzazioneAnonimaTests.cs` è **vuoto**.

- [ ] 5.14 🔴 **Il modulo Formik si divide davvero** — in `impostazioniVetrinaModulo.tsx` le quattro
  `inputXxx` del task 1.3 smettono di essere proiezioni di `inputDaValori` e diventano **costruttori
  indipendenti**; `inputDaValori` sparisce con l'ultimo dei suoi chiamanti.
  *Verifica*: 🔴 il test del task 1.4 resta **verde senza modifiche di sostanza**. È il momento per
  cui quella rete è stata scritta per prima: se ha richiesto un ritocco per restare verde, è stata
  adattata al codice invece di verificarlo.

- [ ] 5.15 🔴 **Il `superRefine` si spezza in due schemi** —
  [`impostazioniVetrinaModulo.tsx:249-288`](../../../duedgusto/src/components/pages/sito/impostazioniVetrinaModulo.tsx)
  contiene **entrambi** i grappoli incrociati: le coordinate vanno nello schema di **Impostazioni
  sito**, la reputazione in quello della **Home**.
  🔴 Un controllo incrociato spezzato fra due schemi **non segnalerebbe più entrambi i campi**, che è
  precisamente la proprietà dimostrata dai test alle righe 92-101 e 165-179 del file di test: quei
  due test si **replicano**, uno per schema, e continuano a pretendere due messaggi.
  *Verifica* (spec `impostazioni-vetrina` → *Le coppie a validazione incrociata non si separano*):
  `validaImpostazioniSito({latitudine: "45", longitudine: ""})` segnala **entrambi**;
  `validaPaginaHome({punteggioGoogle: "4.7", numeroRecensioniGoogle: ""})` segnala **entrambi**.

- [ ] 5.16 **`ImpostazioniVetrinaPage.tsx` ridotta ai 20 campi trasversali** — le cinque sezioni
  editoriali (claim, reputazione, storia, aperitivo) escono dalla pagina; identità, indirizzo,
  contatti, social, SEO di default, aspetto e ganci spenti restano. La pagina **non si rinomina**
  (risoluzione 4).
  ⚠️ Il test *«trasporta la chiave antispam che la pagina non mostra»* si sposta qui e **il commento
  va aggiornato**: la ragione non è più *«l'assegnazione del server è totale»* in astratto, è *«è
  totale su questo gruppo, e questo campo appartiene a questo gruppo»*.
  *Verifica*: `npm run test` verde; la pagina non mostra alcun campo editoriale.

- [ ] 5.17 **GraphQL del frontend** — `duedgusto/src/graphql/vetrina/mutations.tsx`: tre mutation
  nuove; `fragments.tsx`: il fragment delle impostazioni guadagna i tre slot e resta **unico**
  (il tipo di ritorno non si divide); `queries.tsx`: `ruoliImmagini`.
  *Verifica*: `npm run ts:check` e `npm run lint` escono 0.

- [ ] 5.18 **Prova manuale end-to-end della partizione** — su una seconda istanza, da GraphiQL con un
  token di amministratore: salva `mutatePaginaHome` con `claimVetrina` modificato e verifica a
  database che **`Via`, `UrlInstagram`, `StoriaTesto`, `AperitivoTesto` e `TurnstileSiteKey` siano
  invariati**; poi svuota `claimVetrina` e verifica che persista l'assenza.
  🔧 Il JWT scade in 5 minuti: prendi il token una volta e riusalo.
  *Verifica*: un `SELECT` prima e uno dopo, confrontati; la sola colonna cambiata è quella salvata.

- [ ] 5.19 🔴 **Nota di deploy scritta dove serve** — annota nel messaggio del commit (o nella PR) che
  backend e frontend di questa fase vanno **nello stesso deploy**, e che il rollback richiede di
  **riespandere l'input a 30 campi PRIMA** del revert del frontend, non dopo ([D15](./design.md)
  punto 3).
  *Verifica*: la nota esiste in un posto che chi fa il deploy legge, non solo in questo file.

**Uscita di fase.** Quattro scritture disgiunte, l'assegnazione totale viva dentro ognuna, lo
svuotamento intatto, gli orari fuori per costruzione su tutte e quattro, e il pin per riflessione che
ha dimostrato di saper nominare sia l'orfano sia il conteso. Le schede non esistono ancora: si scrive
da GraphiQL.

**Rollback.** 🔴 Si torna all'input unico da 30 campi **prima** del revert del frontend. I nomi dei
campi non cambiano, quindi il ripristino è meccanico — ma è la **forma** dell'input a essere
cambiata, non i nomi, e l'ordine inverso lascerebbe una scheda in linea che scrive su una mutation
che non esiste più.

---

## Fase 6 — Le cinque schede, il seed e le icone

*(punto 6 del rollout — [D10](./design.md), [D11](./design.md), [D12](./design.md), [D13](./design.md))*

**Perché esiste.** È la risposta letterale alla domanda dell'utente: *«ogni pagina del sito una voce
di menu, e lì mi dici quante immagini posso caricare e i testi da cambiare»*. Le rotte del gestionale
vengono dal database e il glob dinamico copre già le sottocartelle, quindi **cinque voci non costano
più di una**: nessuna modifica al routing.

- [ ] 6.1 **`duedgusto/src/components/pages/sito/pagine/SchedaPagina.tsx`** — il guscio condiviso
  che impone l'ordine delle tre risposte: ① stato di pubblicazione, ② immagini (capacità, occupati,
  ripieghi), ③ testi di proprietà, ④ testi ereditati in sola lettura con il collegamento.
  *Verifica* (spec `impostazioni-vetrina` → *Le tre risposte non sono nascoste*): l'ordine è imposto
  dal guscio, non ripetuto a mano in cinque componenti.

- [ ] 6.2 **`PaginaHome.tsx`** — modulo con `claimVetrina` + i tre della reputazione + lo slot eroe;
  i testi dell'aperitivo **in sola lettura** con il collegamento a `Sito → Aperitivo` (sono letti
  dalla home e **posseduti** dall'aperitivo); orari e recensioni in sola lettura con il rimando.
  «4 immagini: 1 eroe + 3 dalla galleria».
  *Verifica* (spec `impostazioni-vetrina` → *Un testo condiviso è modificabile da una scheda sola*):
  i campi aperitivo non sono modificabili da qui e la pagina dice **dove** lo sono.

- [ ] 6.3 **`PaginaLocale.tsx`** — `storiaTitolo`, `storiaTesto`, slot ritratto. «4 immagini: 1
  ritratto + 3 dalla galleria (3ª-5ª)».
  *Verifica*: il numero dichiarato coincide con il piano di `RuoliImmaginiVetrina`, non con una
  costante scritta a mano nel componente.

- [ ] 6.4 **`PaginaAperitivo.tsx`** — i quattro campi aperitivo + slot eroe. «1 immagine dedicata».
  ⚠️ La scheda **esiste sempre**, anche quando la pagina del sito non esiste: nasconderla sarebbe
  togliere l'unico posto da cui la si può creare.
  *Verifica* (spec `impostazioni-vetrina` → *La scheda dell'aperitivo esiste anche a pagina
  inesistente*): con `AperitivoTesto` vuoto la voce di menu c'è e la scheda si apre.

- [ ] 6.5 **`PaginaMenu.tsx` e `PaginaContatti.tsx`, senza modulo e senza Salva** — niente `Formik`,
  niente `FormikToolbar`, nessuna mutation. Solo: stato, conteggio immagini con i ruoli, testi
  ereditati in sola lettura con i collegamenti, e le altre sorgenti (prodotti pubblicati per
  `/menu`; orari e contatti per `/contatti`).
  🔴 La descrizione SEO di `/menu` è **scritta a mano nel sorgente** (`menu.astro:73`) e la scheda
  lo deve **dichiarare**, non fingere che sia un campo.
  *Verifica* (spec `impostazioni-vetrina` → *Una scheda senza testi propri non è una scheda vuota*,
  *Un testo scritto nel sorgente del sito è dichiarato tale*): nessun pulsante Salva grigio, che
  suggerirebbe che manchi qualcosa da compilare.

- [ ] 6.6 🔴 **Lo stato di pubblicazione è la prima riga** — su Locale e Aperitivo: *«Non pubblicata:
  manca il testo, e finché manca la pagina risponde 404 e non compare nel menu del sito»*.
  ⚠️ Il criterio è **solo il corpo del testo**, come fa il server (`PublicController.TestiDa`, righe
  453-464): un titolo compilato con il testo vuoto è **ancora** «non pubblicata». Il pannello non
  scrive una seconda regola.
  *Verifica* (spec `impostazioni-vetrina` → *Titolo compilato e testo vuoto è ancora «non
  pubblicata»*, *Le pagine sempre presenti non mostrano uno stato condizionato*): Home, Menu e
  Contatti **non** mostrano uno stato condizionato — non ne hanno uno.

- [ ] 6.7 🔴 **Conferma solo quando il salvataggio fa sparire una pagina** — con `useConfirm` (già
  usato in [`ImpostazioniVetrinaPage.tsx:117-133`](../../../duedgusto/src/components/pages/sito/ImpostazioniVetrinaPage.tsx)),
  **e solo** quando il valore letto dal server è non vuoto e quello nuovo è vuoto, sui **due soli**
  campi `StoriaTesto` e `AperitivoTesto`.
  ⚠️ Il **titolo non entra** nella condizione, perché non entra nella regola del server: una conferma
  che scattasse anche lì insegnerebbe una regola falsa. E estenderla a «ogni campo che si svuota»
  annegherebbe l'unico caso in cui svuotare cancella un URL.
  *Verifica* (spec `impostazioni-vetrina` → *Conferma prima di far sparire una pagina pubblicata*,
  *Nessuna conferma quando non c'è nulla da far sparire*): svuotando il **titolo** non compare alcuna
  conferma.

- [ ] 6.8 **`MediaLibrary.tsx` dichiara i ruoli attivi** — accanto a ogni immagine della galleria,
  i ruoli che sta ricoprendo **con il nome della pagina** e mai con un numero di posizione; più
  ruoli si elencano tutti; un'immagine **senza** ruolo lo dice con parole proprie; le non pubblicate
  e quelle fuori dalla cartella `galleria` **non** risultano titolari di alcun ruolo, e la libreria
  dice che è la mancata pubblicazione a escluderle.
  🔴 I dati vengono da `vetrina { ruoliImmagini }`, cioè dalla **stessa dichiarazione** che alimenta
  i conteggi delle schede: mai due elenchi che si corrispondono per disciplina.
  *Verifica* (spec `media-assets` → *I ruoli sono scritti accanto alle immagini* e i quattro scenari
  seguenti): nessuna etichetta contiene un indice.

- [ ] 6.9 **`SeedMenusSito.cs`: `UpsertVoceSitoAsync` al posto dei quattro blocchi copiati** — un
  helper locale e **nove chiamate**, con le posizioni e i percorsi della tabella di
  [D12](./design.md). I `Percorso` delle quattro voci esistenti **non cambiano**: sono le chiavi di
  idempotenza, e il riordino non ne ricrea nessuna.
  ⚠️ I percorsi nuovi stanno sotto `pagine/` (`/gestionale/sito/pagine/home`), perché
  `/gestionale/sito/menu` accanto a `/gestionale/sito/media` sarebbe indistinguibile da una risorsa.
  *Verifica*: il file non contiene nove blocchi copiati; `dotnet build` esce 0.

- [ ] 6.10 **Le cinque icone in `iconMapping.tsx`** — `House`, `UtensilsCrossed`, `Martini`,
  `Armchair`, `MapPin`, tutte esistenti in `lucide-react` e nessuna in collisione con i 29 nomi già
  mappati.
  ⚠️ `Menu` esiste già nella mappa ma è **l'hamburger** di lucide, non il listino: ragione in più per
  non riusarlo per la pagina Menu del sito.
  *Verifica*: `npm run ts:check` esce 0; i cinque nomi del seed e i cinque della mappa sono gli
  stessi, scritti nello stesso commit.

- [ ] 6.11 🔴 **Il test delle icone, che oggi non esiste** — crea
  `duedgusto/src/components/layout/sideBar/__tests__/iconeDelSeed.test.tsx`: legge **tutti** i
  sorgenti di `backend/SeedData/*.cs` (non un elenco scritto a mano — un file nuovo deve entrare da
  solo) e pretende che ogni icona nominata esista in `iconMapping`.
  ⚠️ Le icone compaiono in **due** posizioni sintattiche: inizializzatore di oggetto (`Icona =
  "Globe"`) e **terzo argomento posizionale** di `UpdateMenuIfNeeded(menu, titolo, percorso, icona,
  …)`. La regex deve coprirle entrambe, e serve un'asserzione sul **conteggio** (`> 20`) che riveli
  se ne ha persa una.
  🔴 Perché serve: `getLazyIcon` restituisce `undefined` per un nome sconosciuto — la voce compare
  **senza icona, senza alcun errore**, e la cosa si nota solo guardando la barra. Questo test è
  l'unico punto in cui quel silenzio diventa rumore.
  *Verifica* (spec `impostazioni-vetrina` → *Ogni icona nominata dal seed esiste*): `npm run test`
  verde.

- [ ] 6.12 🔴 **Verifica per mutazione del test delle icone, nei due versi** — ① rinomina un'icona nel
  seed in un nome inesistente: il test è rosso **e lo nomina**; ② rompi la regex (per esempio
  togliendo il ramo dell'argomento posizionale): il **conteggio** scatta e il test è rosso invece che
  **cieco**. Ripristina entrambi.
  *Verifica* (spec `impostazioni-vetrina` → *Verifica per mutazione dell'allineamento delle icone*):
  senza ②, un test di scansione che smette di trovare le occorrenze è verde e rassicurante.

- [ ] 6.13 🔴 **Allineamento pannello ↔ `rotte.ts`** — un test che confronta le cinque pagine
  dichiarate da [`rotte.ts`](../../../sito/src/lib/rotte.ts) con le cinque voci nuove del seed:
  **stessi percorsi logici e stesse etichette**. Casa consigliata: `sito/test/schede-pannello.test.mjs`,
  perché i test del sito **già scansionano i sorgenti** (`_scansione.mjs`) e questo è il verso che il
  repository ha già preso; il backend oggi scansiona solo `backend/`.
  *Verifica* (spec `sito-pubblico` → *Le due liste coincidono*, *Verifica per mutazione
  dell'allineamento*; spec `impostazioni-vetrina` → *Una pagina aggiunta al sito senza scheda viene
  rilevata*): rinominando un'etichetta in **uno solo** dei due posti il test fallisce **nominando la
  pagina e le due etichette**. Eseguita la mutazione e ripristinata.

- [ ] 6.14 **Test componente: nessun campo di orario, replicato su tre schede** — Home, Contatti e
  Impostazioni sito: nessun `getByLabelText(/apertura|chiusura|fuso/)`, e il collegamento alle
  impostazioni della cassa **presente**.
  *Verifica* (spec `impostazioni-vetrina` → *Nessun campo di orario in alcuna scheda*, *Gli orari
  mostrati sono in sola lettura e dicono dove si cambiano*): è il test di riga 200 del file
  esistente, replicato — non spostato.

- [ ] 6.15 **Test componente: stato in prima riga e conferma** — su Locale e Aperitivo: con il testo
  pieno lo stato dice «Pubblicata»; svuotandolo e salvando, `useConfirm` **viene invocato** e **senza
  conferma nessuna mutation parte**.
  *Verifica* (spec `impostazioni-vetrina` → *Pagina non pubblicata, dichiarata in prima riga*,
  *Conferma prima di far sparire una pagina pubblicata*): la seconda asserzione è quella che conta —
  una conferma che compare ma non blocca non è una conferma.

- [ ] 6.16 **Test componente: le schede senza modulo** — `PaginaMenu` e `PaginaContatti` non rendono
  alcun pulsante «Salva» e non montano `Formik`.
  *Verifica* ([D10](./design.md)): `queryByRole("button", { name: /salva/i })` è `null`.

- [ ] 6.17 🔴 **Test: il numero dichiarato dalla scheda viene dal piano, non da una costante** —
  cambiando la dichiarazione di un ruolo cambiano **insieme** ciò che la libreria mostra e ciò che la
  scheda conta. Se solo uno dei due si muove, esistono due scritture.
  ⚠️ E il caso reale: con **una sola** immagine in galleria (task 0.3), la scheda Home dichiara 1
  eroe e **0** in griglia, e la libreria attribuisce a quell'unica foto **tre** ruoli. I due numeri
  coincidono per ogni pagina.
  *Verifica* (spec `media-assets` → *Un ruolo aggiunto compare in entrambi i posti*, *La somma dei
  ruoli e i conteggi delle schede coincidono*; spec `impostazioni-vetrina` → *Posti vuoti — capacità
  e riempimento sono grandezze diverse*, *Zero è una risposta scritta*): la scheda distingue
  **capacità** da **riempimento** e dichiara se sta mostrando **lo slot o il ripiego**.

- [ ] 6.18 **Prova manuale: tre riavvii, nove voci, nessuna senza icona** — su una seconda istanza
  con `SEED_ON_STARTUP=true` (🔧 qui è il punto), tre avvii consecutivi.
  *Verifica* (spec `impostazioni-vetrina` → *Tre avvii consecutivi*, *Le voci preesistenti conservano
  la propria identità*, *L'ordine mette le pagine davanti alle risorse*): `SELECT Titolo, Percorso,
  Posizione FROM Menus WHERE …` mostra **nove** voci con `Posizione` 1-9 come da [D12](./design.md)
  dopo **ognuno** dei tre avvii, nessuna duplicata, i quattro `Percorso` preesistenti invariati; e a
  video **nessuna voce senza icona** nella barra laterale.

- [ ] 6.19 **Prova manuale: un non amministratore non arriva da nessuna parte** — con un utente
  autenticato senza flag `Amministratore`: nessuna delle cinque voci compare, nessuna scheda si apre
  per URL diretto, e le quattro mutation più le due query rispondono negato **anche chiamando
  GraphQL direttamente**.
  *Verifica* (spec `impostazioni-vetrina` → *Un ruolo non amministrativo non vede alcuna scheda*):
  `SitoGuard` e `GuardUtenteAmministratore` si riusano **invariati**.

**Uscita di fase.** Il pannello risponde alle due domande dell'utente, il sottomenu ha nove voci
nell'ordine deliberato (pagine, poi risorse), e l'icona mancante non è più un silenzio.

**Rollback.** `Visibile = false` sulle cinque voci nuove (o revoca di `AssegnaRuoli`) le fa sparire
**senza cancellare record**; ripristinare le `Posizione` 1-4 delle esistenti riporta il sottomenu
com'era; toglierle dal seed impedisce che rinascano al riavvio. Il frontend si revert-a da solo:
nessun'altra pagina del gestionale dipende dalle schede.

---

## Fase 7 — La mappa pagina → campi, e la verifica che la tiene onesta

*(punto 7 del rollout — [D9](./design.md))*

**Perché esiste.** Renderla esplicita crea una **seconda scrittura**, e due scritture divergono:
qualcuno aggiunge un campo a `locale.astro`, la scheda «Il locale» non lo impara mai, e
l'amministratore ha una mappa che **mente con sicurezza** — il modo peggiore di sbagliare per uno
strumento di orientamento. La mappa senza il test del 7.4 è peggio di nessuna mappa.

- [ ] 7.1 **`backend/Services/Vetrina/MappaPagineVetrina.cs`** — **una voce per riga**, tre campi per
  voce: **pagina**, **campo del modello**, **percorso nel DTO pubblico** (`testi.storia.testo`), più
  la scheda proprietaria.
  🔴 La forma testuale è **vincolante**: il test del task 7.4 legge questo file con una regex.
  Cambiare la forma senza cambiare la regex renderebbe il test **cieco** invece che rosso — per
  questo il test asserisce anche il **numero** di voci trovate, e il commento in testa al file lo
  deve dire.
  ⚠️ Il terzo campo è anche la prima documentazione della mappatura che oggi esiste solo dentro
  `PublicController.TestiDa` (righe 453-464).
  *Verifica*: `dotnet build` esce 0; le voci coprono tutte e cinque le pagine.

- [ ] 7.2 **Query `mappaPagine` dietro `GuardAmministratore`** — in `VetrinaQueries.cs`, servita al
  pannello. Il test dei privilegi del task 5.13 si estende a questa seconda query.
  *Verifica*: un non amministratore è respinto; l'introspezione non mostra alcun ramo root nuovo.

- [ ] 7.3 **Le schede costruiscono le due sezioni dei testi dalla mappa** — «testi di questa pagina»
  e «testi ereditati, si cambiano qui», **da GraphQL** e non da una copia nel frontend.
  ⚠️ La sola lettura dev'essere riconoscibile a colpo d'occhio, non solo al tentativo di scrittura.
  *Verifica* (spec `impostazioni-vetrina` → *La mappa non ha una seconda copia*, *Sola lettura
  riconoscibile a colpo d'occhio*): `grep -rn "storia.testo\|claim" duedgusto/src/components/pages/sito/pagine/`
  non trova un secondo elenco di campi per pagina.

- [ ] 7.4 🔴 **`sito/test/mappa-pagine.test.mjs`, con tre asserzioni e non una** — scansiona i cinque
  `.astro`, raccoglie le espressioni `sito.<percorso>` e le confronta con le voci dichiarate in
  `MappaPagineVetrina.cs`: ① le voci parsate sono **≥ N** (la regex ha funzionato); ② ogni
  `sito.<percorso>` trovato è **dichiarato** (nessun campo letto e non dichiarato); ③ ogni voce
  dichiarata per una pagina **compare** in quel `.astro` (nessuna voce fantasma).
  ⚠️ Usa `_scansione.mjs` e `senzaCommenti`, come `orari-sorgenti.test.mjs`: senza, un percorso
  nominato in un commento produce un falso positivo, e chi lo vede rosso la prima volta «aggiusta» il
  test allentando l'asserzione.
  *Verifica* (spec `impostazioni-vetrina` → *Un campo letto e non dichiarato fa fallire la verifica*):
  `cd sito && npm test` passa.

- [ ] 7.5 🔴 **Verifica per mutazione della mappa, nei tre versi** — ① aggiungi una lettura
  `sito.testi.…` in un `.astro` senza dichiararla → rosso; ② togli una voce dichiarata → rosso; ③
  cambia la **forma** di una riga in `MappaPagineVetrina.cs` (spezzandola su due righe) → il
  conteggio scatta e il test è **rosso invece che cieco**. Ripristina tutti e tre.
  *Verifica*: l'esito è annotato con i tre nomi. ③ è la mutazione che nessuno pensa a fare ed è
  l'unica che protegge dalla modalità di guasto peggiore di un test di scansione.

- [ ] 7.6 **Il gestionale non dipende dalla build del sito** — controllo esplicito: nessun import da
  `sito/` in `duedgusto/` né in `backend/`; il confronto vive nei **test del sito** e non nella CI
  del backend.
  *Verifica* (spec `impostazioni-vetrina` → *Il gestionale non dipende dalla build del sito*):
  `grep -rn "from ['\"].*sito/" duedgusto/src/` è vuoto.

- [ ] 7.7 **Ogni ruolo immagine è nominato da almeno una scheda** — l'insieme dei ruoli che le pagine
  consumano coincide con l'insieme dei ruoli nominati dalle cinque schede.
  *Verifica* (spec `media-assets` → *Ogni ruolo è nominato da una scheda*, *Nessun secondo percorso
  di scelta delle immagini*): ogni punto in cui si sceglie un'immagine usa `MediaPickerDialog`, che
  esiste già.

**Uscita di fase.** La mappa esiste in un posto solo, il pannello la legge, e il sito la verifica.
Divergono in un verso o nell'altro → **rosso**.

**Rollback.** Revert puro, nessun dato coinvolto.

---

## Fase 8 — Chiusura

**Perché esiste.** I criteri di successo della proposal non si spuntano a memoria, e due delta di
spec potrebbero mancare.

- [ ] 8.1 ⚠️ **I due delta di spec che il design nomina e la cartella `specs/` non ha** —
  `/api/public/galleria` cambia forma, e il contratto è **pinnato** dalle spec attive
  `api-pubblica` e `consumo-api-pubblica` ([design.md §"File Changes"](./design.md) le elenca fra i
  delta). La cartella `specs/` di questo change ne ha **tre**, non cinque.
  *Verifica*: o esistono `specs/api-pubblica/spec.md` e `specs/consumo-api-pubblica/spec.md` con il
  campo `ruoli` come **ADDED** additivo, o è scritto qui perché non servono. Non lasciato implicito:
  il cambio è additivo ma è **sul contratto**.

- [ ] 8.2 🔴 **I criteri di successo della proposal, spuntati con la loro prova** — riprendi i
  quattordici criteri di [proposal.md §"Success Criteria"](./proposal.md) e accanto a ciascuno scrivi
  **il task che lo dimostra**.
  *Verifica*: nessun criterio resta senza una prova nominata. Quelli con 🔴 hanno una verifica **per
  mutazione**, non solo un test verde.

- [ ] 8.3 **Correggi il «31» nella proposal** — compare **sette volte** e i campi scrivibili sono
  **30** ([D15](./design.md) punto 1). È il numero su cui il test di partizione asserisce, quindi
  lasciarlo sbagliato manderebbe fuori strada chi legge la proposal per capire un test rosso.
  *Verifica*: `grep -c "31" openspec/changes/pannello-sito-per-pagine/proposal.md` non trova più
  occorrenze riferite ai campi scrivibili.

- [ ] 8.4 **Verifica finale completa** — `dotnet build`, `dotnet test`, `npm run ts:check`,
  `npm run lint`, `npm run test` in `duedgusto/`, `npm test` in `sito/`.
  *Verifica*: sei comandi verdi; i conteggi confrontati con la baseline del task 0.4 e il delta
  annotato per fase.

- [ ] 8.5 **Le tre Open Questions restanti, confermate con l'utente** — ① l'etichetta «Menu» resta
  identica a `rotte.ts` (risoluzione 5) o diventa «Pagina Menu»; ② il ripiego dell'aperitivo resta
  `.at(-1)` (risoluzione 6) o diventa `galleria[0]` accettando una differenza visibile al primo
  deploy; ③ titolo e descrizione SEO per pagina restano fuori scope (risoluzione 8).
  *Verifica*: le tre risposte sono scritte. ② **è una decisione dell'utente, non del design**.
  ✅ **① e ② sono già state risposte dall'utente durante la Fase 2**, e non vanno rimesse in
  discussione qui: ① l'etichetta **resta «Menu»** (risoluzione 5 confermata); ② 🔴 **nessuna delle
  due uscite proposte**: l'aperitivo **non ha ripiego** e a slot vuoto la pagina esce senza immagine
  di testata — la differenza visibile al primo deploy è **accettata consapevolmente** (riquadro del
  task 2.2). Resta aperta la sola ③.

- [ ] 8.6 **Il piano di rollback riletto sul codice che esiste davvero** — sette punti, sette
  rollback, e l'unico punto di non ritorno (slot valorizzati, Fase 4) annotato **dove chi fa il
  deploy lo legge**.
  *Verifica*: il rollback della Fase 5 dice esplicitamente che si riespande l'input **prima** del
  revert del frontend.

- [ ] 8.7 **Esito reale, scritto in questo file** — come nei change archiviati: per ogni fase, il
  delta dei test, le mutazioni eseguite con **quali test sono diventati rossi e quali no**, e le
  divergenze dal testo dei task.
  *Verifica*: le divergenze sono **scritte**, non nascoste. Una mutazione annotata come «eseguita»
  senza il nome del test rosso non è una prova.

**Uscita di fase.** Il change è pronto per `sdd-verify`.

---

## Riepilogo

| Fase | Task | Punto di rollout | Fuoco |
|---|---|---|---|
| 0 | 4 | — | Misura del «prima», coordinamento con `vetrina-redesign-mockup` |
| 1 | 8 | 1 | 🔴 La rete, **con il modulo ancora intero**, vista fallire |
| 2 | 7 | 2 | `RuoliImmaginiVetrina`, gallerie da 0/1/2/3/5/6 immagini |
| 3 | 12 | 3 | Modello, migrazione additiva, eliminazione a cinque referenti |
| 4 | 9 | 4 | `/api/public/galleria` + i quattro `.astro` |
| 5 | 19 | 5 | 🔴 La partizione della scrittura — **stesso deploy** |
| 6 | 19 | 6 | Le cinque schede, il seed, le icone |
| 7 | 7 | 7 | La mappa e la sua verifica |
| 8 | 7 | — | Chiusura |
| **Totale** | **92** | | |
