# Tasks: progetto Astro, design system e due pagine vive (vetrina-sito-astro)

> 🔴 **Leggi prima [autonomia.md](./autonomia.md).** Questa corsa si esegue **senza l'utente**:
> quel file contiene le risposte alle domande che altrimenti faresti, il protocollo da seguire
> quando sei davvero bloccato, e come si eseguono da sole le quindici prove di browser. Contiene
> anche due notizie che cambiano la Fase 1: **il task 1.1 è chiuso** (la macchina è su Node
> 22.23.2) e 🔴 **i task 1.6 e 1.7 si soddisfano in forma diversa** — su questa macchina non esiste
> più un Node 20, ed eseguirli con l'npm di sistema li farebbe *riuscire*, cioè dimostrare
> l'opposto di ciò che devono dimostrare. La sostituzione decisa dall'utente è in autonomia.md
> §2.2, e vale **solo** per questi due: le mutazioni 3.9, 4.9 e 4.10 si eseguono tutte.
>
> Artefatti di riferimento: [proposal.md](./proposal.md), [design.md](./design.md) (§D1-D14 +
> tabella delle divergenze), [specs/](./specs/) — 4 spec, 47 requirement, 183 scenari, 38 marcati 🔴.
> Change precedente, completato: [`vetrina-api-pubblica`](../vetrina-api-pubblica/tasks.md), di cui
> si eredita la forma di questo file.
>
> **Come leggere questo file.** Ogni task ha una *Verifica*: chi lo chiude deve poter dimostrare
> che è chiuso, con un comando o un'osservazione. Ogni fase si apre con la ragione per cui esiste
> e si chiude con lo stato in cui lascia l'albero.
>
> **Le fasi sono gli undici gradini di design.md §"Migration / Rollout"**, più una fase di chiusura.
> Sono ordinate perché ognuna sia **provabile da sola**: alla fine della Fase 3 `npm test` è verde
> con una pagina sola e vuota; alla fine della Fase 4 `@theme inline` si è dimostrato **prima che
> esista un colore in una pagina**; alla fine della Fase 8 il menu reale con le foto reali è nel
> browser, senza che la home esista.
>
> ⚠️ **I test non hanno una fase propria.** Vivono dentro la fase che pinnano, perché è la
> condizione perché ogni gradino sia verificabile senza il successivo.
>
> 🔴 **I task che nessun test rieseguirà sono marcati 🧪.** Sono le prove distruttive, le
> controprove e le verifiche di browser: quelle che dimostrano che una difesa *sa fallire*, e che
> nessuna suite ripeterà mai. Ognuna dice **cosa eseguire** e **cosa documentare**, perché la sola
> traccia che ne resterà è ciò che viene scritto nell'"Esito reale" della fase. Sono raccolte nel
> task 12.15; sono **ventisei**, e undici di esse sono mutazioni o prove una tantum che dopo
> l'apply non saranno più eseguibili nelle stesse condizioni.

---

## Otto risoluzioni già decise, da non rimettere in discussione durante l'apply

1. 🔴 **Node ≥ 22.12 è un prerequisito della macchina, non un task di codice.** Non si aggira con
   `npm install --force`, con `--engine-strict=false`, né abbassando `engines`. Se l'aggiornamento
   non è possibile, il change **si ferma**: non esiste una variante di questo piano su Node 20.
2. 🔴 **Il floor di `@tailwindcss/vite` in `sito/` è `^4.2.2` e non si allinea a `duedgusto`**
   (`^4.2.1`). Sono due minimi diversi per due ragioni entrambe corrette: `sito/` gira su Vite 8
   (Astro 7), `duedgusto` su Vite 6. Chi "riallinea le versioni del monorepo" abbassando questa
   riga rompe la build (§D1).
3. **Astro `~7.2.1` e `@astrojs/node ~11.1.1`, con la tilde e non il caret.** Le patch entrano, i
   minor no: non c'è ancora una suite di regressione visiva a raccogliere il pezzo (è Fase 7 del
   progetto, non di questo file).
4. 🔴 **`text-arancio` non esiste e non deve esistere.** Chi cerca "l'arancio per un titolo" cerca
   `--c-accento`: oliva di giorno (7.45), gesso giallo di sera (12.28). L'arancio su crema è
   **2.11**, sotto persino la soglia del testo grande (§D7).
5. 🔴 **Il tema e lo stato "aperto ora" sono client-side, sempre.** Sono la stessa decisione presa
   due volte. Chi li "migliora" spostando il confronto sul server rompe il micro-cache di Fase 6 e
   fa fallire la prova di identità byte per byte, **senza che nulla diventi rosso** finché quella
   prova non esiste (§D5).
6. 🔴 **`NODE_TLS_REJECT_UNAUTHORIZED` è vietato senza riserve**, in ogni forma e in ogni file. La
   soluzione è `NODE_EXTRA_CA_CERTS`, che **aggiunge** un'autorità invece di spegnere la verifica
   (§D3).
7. 🔴 **`/` risponde sempre `200`, `/menu` risponde `503` con `Retry-After`**, ed entrambe scrivono
   `Cache-Control: no-store` quando sono degradate. Senza `no-store` il micro-cache di Fase 6
   congelerebbe la degradazione **dopo** il ripristino del backend (§D4).
8. **Le cinque Open Questions del design si chiudono con la raccomandazione già scritta**: non
   dipendere da `--color-*`; tenere il prefisso `PUBLIC_`; usare `Astro.url.origin` e riverificarlo
   in Fase 6; tenere il ripiego `og-default.jpg`; tenere la fascia "Aperitivo" dopo averla guardata
   accanto alle locandine. Conferma formale nel task 12.13.

**Le quindici divergenze** di design.md §"Divergenze dalla proposal e dal piano" sono **già
recepite nelle spec**. Non vanno ridiscusse: vanno implementate.

---

## Vincoli operativi dell'ambiente

Ripetuti dentro i task in cui mordono davvero — qui una volta sola per non doverli cercare.

- 🔧 **La macchina è su Node `v20.19.0` e va portata a ≥ 22.12.** L'aggiornamento richiede l'UAC e
  **lo esegue l'utente**. Fino ad allora **tutto il change è bloccato**: è il task 1.1, ed è il
  primo per questo motivo.
  ⚠️ Ma è anche una **finestra che si chiude**: le due prove di §D1 (l'installazione che fallisce su
  Node 20, e la controprova senza `.npmrc`) sono le uniche che richiedono *proprio* Node 20. Vedi
  il task 1.1 per come non sprecarla.
- 🔧 **Il backend .NET dell'utente su `:4000` è in esecuzione, è HTTPS con certificato self-signed e
  tiene bloccata `bin/`. Non va fermato.** Per questo change basta leggerlo: le tre rotte pubbliche
  sono GET anonime e non lo disturbano. Se servisse una seconda istanza:
  ```bash
  ASPNETCORE_URLS=https://localhost:4012 SEED_ON_STARTUP=false dotnet run --project backend
  ```
- 🔧 **Per provare "il backend è giù" NON si spegne quello dell'utente.** Due modi, entrambi nel
  task 10.4: puntare `API_INTERNA_URL` su una **porta libera** (nessun ascoltatore → stesso esito
  `rete`), oppure avviare la seconda istanza su 4012, puntarci il sito, e spegnere **quella**.
- 🔧 **A database ci sono i dati veri su cui il change si vede**: tre prodotti `VETR-F5-*`
  pubblicati e due media in cartella `galleria`. Sono ciò che `/menu` e la striscia della galleria
  mostreranno — non dati di prova da inventare.
- 🔧 **Le porte**: il sito è `localhost:4321`, l'app di cassa `4001`, il backend `4000`. Le ultime
  due **non si toccano**.
- 🔧 **`API_INTERNA_URL` deve essere esattamente `https://localhost:4000`**: il certificato di
  sviluppo ASP.NET ha `localhost` come **solo** SAN, e con `127.0.0.1` la verifica fallisce anche
  con la CA importata — sembrando un problema della CA (§D3).

---

## Fase 1 — Node ≥ 22.12, `sito/` e le versioni che si rifiutano di installare

**Perché esiste.** È il gradino 1, e **non produce una pagina**: produce una macchina su cui le due
generazioni successive di errori non possono nascere. Il criterio di successo della proposal — *"la
versione di Astro e quella di Node sono dichiarate, non implicite"* — non si soddisfa scrivendo un
numero in `engines`: si soddisfa quando la macchina sbagliata **si rifiuta di installare**. Tre dei
cinque task manuali una tantum dell'intero change vivono qui, e due di essi hanno bisogno di una
macchina che fra poche ore non esisterà più.

- [x] 1.1 🔴 🚧 **Verifica bloccante: `node -v` deve valere ≥ `v22.12.0`** — nient'altro di questo
  file può iniziare finché non lo è. L'aggiornamento richiede privilegi di amministratore e
  **lo esegue l'utente**, non l'apply.
  ⚠️ **Finestra irripetibile, da leggere prima di aggiornare.** La macchina è **adesso** su
  `v20.19.0`, ed è l'unica configurazione in cui i task 1.6 e 1.7 si eseguono senza attrezzatura
  aggiuntiva. I task 1.2 e 1.3 scrivono due file e **non richiedono alcun install**: si possono
  anticipare per eseguire subito 1.6 e 1.7 sulla macchina vera. Dopo l'aggiornamento serviranno
  `fnm`/`nvm` oppure `docker run --rm -v "$PWD/sito:/s" -w /s node:20-alpine npm install`, e la
  prova varrà un po' meno perché non sarà più *questa* macchina.
  *Verifica* (spec `sito-pubblico` → *La versione di Node ha una risposta nel repository*):
  `node -v` stampa `v22.12.0` o superiore. Se stampa `v20.x`, il task resta aperto e l'apply si
  ferma qui — non prosegue "intanto che".

- [x] 1.2 🔴 **`sito/package.json`** — `"private": true`, `"type": "module"`,
  `"engines": { "node": ">=22.12.0" }`, e le quattro dipendenze di §D1: `astro ~7.2.1`,
  `@astrojs/node ~11.1.1`, `tailwindcss ^4.2.2`, `@tailwindcss/vite ^4.2.2`.
  🔴 Il commento sopra i due Tailwind deve dire **perché il floor non è `^4.2.1` come `duedgusto`**:
  Astro 7 gira su Vite 8, `4.2.1` dichiara peer `vite ^5.2.0 || ^6 || ^7`, `4.2.2` è la prima che
  aggiunge la 8. Senza quella riga il prossimo che "riallinea le versioni del monorepo" rompe la
  build senza capire perché.
  Script: `dev`, `build`, `preview`, `start:prova`, `test` (`node --test test/`), `scarica-font`.
  ⚠️ **Nessuna `devDependencies` di test**: il runner è `node:test`, del runtime (§D14).
  *Verifica* (spec `sito-pubblico` → *Le versioni sono scritte e sono quelle decise*, *L'adapter è
  quello della generazione installata*, *La ragione è scritta accanto al numero*): i quattro numeri
  sono quelli sopra; `@astrojs/node` è `11.x` e non `10.x`; il commento sul floor esiste.

- [x] 1.3 🔴 **`sito/.npmrc` con `engine-strict=true`** — la riga che trasforma una dichiarazione in
  un vincolo. Senza, `engines` è **advisory**: npm avvisa e installa, e l'errore riappare più tardi
  e altrove, come un errore di sintassi dentro `node_modules`.
  *Verifica* (spec `sito-pubblico` → *🔴 `engine-strict` trasforma la dichiarazione in un
  vincolo*): il file esiste, contiene quella sola riga, ed è **in `sito/`** — non nella radice, dove
  cambierebbe il comportamento di `duedgusto` e del workspace.

- [x] 1.4 **`sito/.nvmrc` (`22`) e `sito/.gitignore`** (`node_modules`, `dist`, `.astro`, `.env`).
  *Verifica* (spec `sito-pubblico` → *La versione di Node ha una risposta nel repository*): la
  domanda "quale Node" ha una risposta **nel repository** e non nella memoria di chi ha configurato
  la macchina.

- [x] 1.5 **`sito/astro.config.mjs`** — `output: 'server'`, `adapter: node({ mode: 'standalone' })`,
  `server: { host: true, port: 4321 }`, `vite: { plugins: [tailwindcss()] }`.
  ⚠️ `env: { schema: … }` arriva nel task 3.1: qui il file nasce con i quattro pezzi che il gradino
  1 deve dimostrare, e nulla che non sia ancora esercitato.
  ⚠️ **Cosa NON entra, e va lasciato fuori deliberatamente**: `site:` (il dominio non esiste),
  `integrations: [react()]`, `sitemap()`, `routeRules`, `cache: { provider: memoryCache() }`,
  `logger: logHandlers.json()`. Le ultime tre sono **stabili nella 7** ed è il motivo per cui vanno
  nominate: sono scelte, non omissioni (§D1).
  *Verifica* (spec `sito-pubblico` → *La configurazione dichiara i quattro pezzi necessari*,
  *Nessuna dipendenza installata e non esercitata*, *Nessuna direttiva di prerendering*): i quattro
  pezzi ci sono; nessun `export const prerender` da nessuna parte; nessuna integrazione installata
  e non usata.

- [x] 1.6 🔴 🧪 **PROVA MANUALE UNA TANTUM — l'installazione su Node 20 fallisce dicendo perché.**
  Con `.npmrc` presente, su **Node `v20.19.0`**, esegui `npm install` in `sito/`.
  **Cosa eseguire**: `cd sito && npm install` (oppure, se Node è già stato aggiornato,
  `docker run --rm -v "$PWD/sito:/s" -w /s node:20-alpine npm install`).
  **Cosa documentare** nell'"Esito reale" della fase: il **codice di uscita** e il **testo esatto**
  dell'errore, che deve nominare `EBADENGINE`/`engine` e il minimo `>=22.12.0`. Se l'install
  **riesce**, `.npmrc` non sta facendo il suo lavoro e il task 1.3 non è chiuso.
  *Verifica* (spec `sito-pubblico` → *🔴 Installazione su una macchina con Node inferiore al
  minimo*): l'errore nomina la versione richiesta, non un file di `node_modules`.

- [x] 1.7 🔴 🧪 **CONTROPROVA MANUALE UNA TANTUM — senza `.npmrc` la macchina sbagliata
  installerebbe.** È ciò che dimostra che il file del task 1.3 non è decorativo.
  **Cosa eseguire**: rinomina `sito/.npmrc` in `.npmrc.off`, ripeti l'install **sulla stessa Node
  20**, poi **ripristina il nome**.
  **Cosa documentare**: che l'install **riesce** (o si limita a un `WARN EBADENGINE`), e che quindi
  il fallimento del task 1.6 è merito del file e non della versione di npm. Senza questa prova, 1.6
  è verde per costruzione: nessuno ha ancora dimostrato *cosa* lo fa fallire.
  *Verifica* (spec `sito-pubblico` → *Controprova — senza `.npmrc` la macchina sbagliata
  installerebbe*): l'esito è **opposto** a quello di 1.6, sulla stessa macchina, a un solo file di
  distanza. E `.npmrc` è tornato al suo nome.

- [x] 1.8 **Installazione sulla macchina conforme** — con Node ≥ 22.12, `cd sito && npm install`.
  *Verifica* (spec `sito-pubblico` → *Installazione su una macchina conforme*, *Il progetto non
  contiene residui di un template*): l'install completa senza errori di engine; `npx astro
  --version` stampa `7.2.1`; **non esiste** alcuna pagina, componente o foglio di stile di esempio —
  il progetto è nato a mano, non da `npm create astro@latest`.

- [x] 1.9 🔴 🧪 **MUTAZIONE MANUALE UNA TANTUM — il floor di `@tailwindcss/vite` protegge davvero.**
  **Cosa eseguire**: abbassa il floor a `^4.2.1` in `sito/package.json`, **forza la risoluzione
  all'estremo inferiore** (`npm install @tailwindcss/vite@4.2.1 --save-exact`), poi tenta
  `npm run build`. Infine **ripristina** `^4.2.2` e reinstalla.
  **Cosa documentare**: **dove** il guasto compare — all'install come `ERESOLVE`/peer conflict su
  `vite@8`, oppure alla build — e il **testo esatto**. Qualunque dei due sia, va scritto: è
  l'informazione che manca a chi un giorno vedrà quell'errore senza collegarlo a questa riga. Un
  test che si limitasse a verificare che la build passa con la risoluzione normale **resterebbe
  verde**, ed è il motivo per cui questa prova esiste.
  *Verifica* (spec `sito-pubblico` → *🔴 Il floor dichiarato è quello che garantisce Vite 8*,
  *🔴 Un riallineamento delle versioni del monorepo non può abbassarlo in silenzio*): il floor è
  tornato `^4.2.2`, il lockfile non contiene `4.2.1`, e `duedgusto/package.json` **non è stato
  toccato** per simmetria.

- [x] 1.10 **`sito/tsconfig.json`** — `extends: "astro/tsconfigs/strict"`.
  *Verifica*: il file esiste e non ridefinisce a mano opzioni che il preset già dà.

- [x] 1.11 🔴 ⚠️ **Il controllo dei tipi copre davvero l'uso nei template? Va deciso ora, non in
  Fase 7.** La spec `immagini-vetrina` pretende che **omettere `sizes` sia un errore di tipo**
  (§D12). Quell'obbligo vive nell'`interface Props` di un componente `.astro`, e **nessuno ha ancora
  dimostrato** che il controllo dei tipi di questo progetto lo veda quando il componente è *usato*
  in un template, invece che solo quando è definito.
  **Cosa eseguire**: crea un componente usa-e-getta con una prop obbligatoria, usalo in una pagina
  **senza** quella prop, esegui il controllo dei tipi, poi cancella entrambi i file.
  ⚠️ `astro check` richiede `@astrojs/check` e `typescript` fra le `devDependencies`. **Non** è il
  "tooling di Fase 7" che la spec vieta (browser, audit di accessibilità, DOM simulato): è un
  controllore di tipi, e sarà **esercitato** — ma è comunque una dipendenza, e la sua adozione va
  scritta qui invece che scoperta in Fase 7.
  **Cosa documentare**: se il controllo **nomina la prop mancante**, il task 7.3 si chiude con
  `npm run check`. Se **non la vede** (o se si decide di non installare il checker), la verifica di
  `sizes` **si sposta sul markup e sulla scansione dei sorgenti** — un test che pinna che ogni uso
  di `<Immagine` porta `sizes=` — e va scritto **qui** che è successo, perché la spec resta
  soddisfatta in un modo diverso da quello che il design immaginava.
  *Verifica* (spec `immagini-vetrina` → *🔴 Omettere la dimensione di resa è un errore di tipo*):
  la decisione è presa e scritta, e il task 7.3 sa già quale delle due forme userà.

**Uscita di fase.** `sito/` esiste con otto file e nessuna pagina, `npm install` completa sulla
macchina conforme, e **tre prove distruttive hanno dimostrato che le difese sanno fallire**: su Node
20 l'install si rifiuta, senza `.npmrc` riesce, e il floor di Tailwind abbassato rompe qualcosa di
nominabile. Nessuna riga di sito è stata ancora scritta — ed è corretto.

**Esito reale (apply del 2026-08-12).** `sito/` esiste con **otto** file versionati — `.gitignore`,
`.npmrc`, `.nvmrc`, `astro.config.mjs`, `package.json`, `package-lock.json`, `tsconfig.json` e
`test/vincolo-di-node.test.mjs` —, `npm install` completa su Node `v22.23.2`,
`npx astro --version` stampa **7.2.1**, e la prima suite del progetto è **2/2 verde**. Nessuna
pagina, nessun componente, nessun foglio di stile: i quattro file usa-e-getta creati per le prove
sono stati cancellati e `src/` è tornata a non esistere.

Delle tre prove distruttive previste, **una sola si è comportata come il design prevedeva**. Le
altre due hanno prodotto un risultato diverso, ed è la parte di questa fase che vale la pena
leggere.

- *Task 1.1 — chiuso prima dell'apply.* `npm version` riporta `node: '22.23.2'` (LTS *Jod*, la
  stessa linea della CI). L'aggiornamento l'ha eseguito l'utente il 12 agosto 2026, **al posto**
  della 20: su questa macchina non esiste più alcun Node 20.
- 🔁 *Task 1.6 e 1.7 — soddisfatti in forma diversa*, per decisione dell'utente
  ([autonomia.md §2.2](./autonomia.md)). La finestra si era chiusa con i due task ancora aperti, e
  **eseguirli oggi li farebbe riuscire entrambi** — cioè dimostrare l'opposto di ciò che devono
  dimostrare. La sostituzione conserva la logica discriminante (due esiti opposti a un solo file di
  distanza) e prova ciò che conta, perché il soggetto sotto esame non è Node 20, è `.npmrc`:
  `npm config get engine-strict` in `sito/` → **`true`**; rinominato il file in `.npmrc.off` →
  **`false`**; ripristinato → **`true`**. 🔴 **Promossa a test automatico**
  (`test/vincolo-di-node.test.mjs`, due casi, ripristino in `t.after()` così il nome torna anche se
  l'assert fallisce): 1.6 e 1.7 erano due prove che nessuno avrebbe più rieseguito, questa gira a
  ogni `npm test`. ⚠️ **Il limite, scritto e non nascosto**: il test verifica la *configurazione
  attiva*, non l'*install che aborta* — un anello più corto della catena. Se npm cambiasse il
  significato di `engine-strict`, questo resterebbe verde e l'originale no.
  🔴 **E il difetto che il task 1.7 esisteva per escludere è ricomparso da un'altra porta.** Il
  test scritto in modo ovvio passava lanciato con `node --test` e **falliva** con `npm test`
  (`'true' !== 'false'`): npm esporta la propria configurazione ai figli come
  `npm_config_engine_strict=true`, e per npm **l'ambiente batte il file** — il processo figlio
  rispondeva `true` anche con `.npmrc` rinominato, ereditandolo dal padre. Fosse successo al
  contrario (verde da `npm test`, che è come gira in CI) la prova sarebbe stata verde per
  costruzione e nessuno se ne sarebbe accorto. La funzione `ambientePulito()` cancella ogni
  `npm_config_*` prima di invocare il figlio; verificato **verde in entrambi i modi**.
- 🔴 *Mutazione 1.9 — il floor di `@tailwindcss/vite` **non** protegge da un guasto osservabile.*
  È il risultato opposto a quello che design.md §D1 prevedeva («rompe la build con un errore di
  peer dependency su `vite@8`»), ed è stato cercato per **due strade**:
  1. floor abbassato a `^4.2.1` e risoluzione inchiodata (`npm install @tailwindcss/vite@4.2.1
     --save-exact`): **l'install riesce**, exit 0, nessun `ERESOLVE`. npm soddisfa il peer
     **issando una seconda Vite** — `node_modules/vite@7.3.6` per il plugin, `astro/node_modules/
     vite@8.2.1` per Astro. Poi `npm run build` su una pagina che importa `@import "tailwindcss"`:
     **riesce**, e il CSS generato contiene `.text-2xl` (4556 byte).
  2. sospettando che il guasto si nascondesse dietro le due copie, ripetuto con
     `overrides: { "vite": "8.2.1" }` — **una sola Vite in albero**, la 8, usata anche dal plugin
     (`npm ls vite` → `vite@8.2.1 overridden`). Install: **riesce**. Build: **riesce**, e produce
     un CSS **identico byte per byte** (stesso hash di contenuto `C_RWu73V`, stessi 4556 byte).

  **Conclusione, che va scritta perché contraddice un artefatto**: il floor `^4.2.2` non è una
  difesa che si vede fallire, è una **dichiarazione onesta di compatibilità**. Il danno che evita è
  silenzioso — due copie di Vite in `node_modules` e un plugin che gira su un'istanza di bundler
  diversa da quella che costruisce il sito — non un errore rosso. La risoluzione n. 2 **resta
  valida** (il floor non si abbassa: `4.2.1` dichiara `peer vite ^5.2.0 || ^6 || ^7`, e dichiarare
  una compatibilità che non si ha è sbagliato comunque), ma il commento in `package.json` è stato
  riscritto: prometteva un errore che non arriva, e chi ci contasse verrebbe tradito. Ripristino
  verificato: floor `^4.2.2`, risoluzione **4.3.3**, `npm ls vite` → **una sola** `8.2.1`,
  `package-lock.json` senza alcuna occorrenza di `"4.2.1"`, `duedgusto/package.json` **non
  toccato**.
- ✅ *Task 1.11 — `astro check` vede la prop mancante nell'**uso**, non solo nella definizione.*
  Componente usa-e-getta con `interface Props { obbligatoria: string }`, usato in una pagina senza
  quella prop:
  ```
  src/pages/prova-tipi.astro:4:24 - error ts(2322): Type '{}' is not assignable to type
    'IntrinsicAttributes & Props'.
    Property 'obbligatoria' is missing in type '{}' but required in type 'Props'.
  ```
  Riga, colonna e **nome della prop**. Exit `1`. Quindi: `@astrojs/check` + `typescript` entrano
  nelle `devDependencies`, lo script è `npm run check`, e **il task 7.3 si chiude con quello** —
  non con una scansione del markup. Il checker non ricade nel divieto di tooling di Fase 7 (browser,
  audit di accessibilità, DOM simulato): è un controllore di tipi, e sarà esercitato. Da riportare
  in **12.12**.
- ⚠️ *Divergenza da 1.2 — lo script `test`.* `node --test test/` è la forma scritta nel task, e su
  Node 22.23.2 **non funziona**: un argomento posizionale è un *glob*, non una directory, e il
  comando muore con `Cannot find module 'C:\…\sito\test'` prima di eseguire alcunché (provate anche
  `./test` e `test`, stesso esito). Lo script è `node --test "test/**/*.test.mjs"`, che è anche più
  stretto di `node --test` senza argomenti — quello scandaglierebbe tutto il progetto, `src/`
  compresa.
- ⚠️ *Divergenza da 1.4 — `.gitignore` ha più righe delle quattro previste.* Alle quattro
  (`node_modules`, `dist`, `.astro`, `.env`) sono aggiunte `.env.*` con l'eccezione
  `!.env.esempio` (il file di esempio è documentazione e va versionato, §D2) e `*.pem` (il
  certificato esportato in Fase 2, che si rigenera e non è un segreto condiviso).

---

## Fase 2 — `scripts/dev.mjs`, il certificato, e i due prefissi che si annunciano

**Perché esiste.** È il gradino che rende possibile leggere il backend **senza abbassare una
difesa**, ed è anche il posto in cui nasce l'unico strumento che rende visibile il guasto centrale
del change: i due prefissi che in sviluppo coincidono. `dev.mjs` esiste per **una** ragione tecnica
— `NODE_EXTRA_CA_CERTS` va nell'ambiente *prima* che Node parta, e da un `.env` non funziona — e ne
sfrutta una seconda gratis: è l'unico punto che vede entrambi i valori all'avvio.

- [ ] 2.1 **Esporta il certificato di sviluppo** — da `backend/`:
  ```bash
  dotnet dev-certs https --export-path ./.certs/aspnet-dev.pem --format PEM --no-password
  ```
  *Verifica*: il PEM esiste e `openssl x509 -in backend/.certs/aspnet-dev.pem -noout -text` mostra
  `localhost` fra i SAN — che è la ragione per cui `API_INTERNA_URL` non può usare `127.0.0.1`.

- [ ] 2.2 ⚠️ **Il certificato non entra nel repository** — aggiungi `.certs/` a
  `backend/.gitignore`.
  ⚠️ **Da verificare invece che assumere**: la `.gitignore` di radice contiene già `*.pem`, quindi
  il file **potrebbe essere già ignorato** e la riga nuova essere solo documentazione. Se è così, va
  detto: la divergenza n. 15 del design (*"sono due file, non uno"*) andrebbe corretta, e il
  rollback tocca **un** file preesistente invece di due.
  *Verifica* (spec `sito-pubblico` → *Il certificato esportato non entra nel repository*):
  `git check-ignore -v backend/.certs/aspnet-dev.pem` nomina la regola che lo copre;
  `git status --porcelain backend/.certs/` è **vuoto**.

- [ ] 2.3 🔴 **`sito/.env.example` — i due prefissi, e la spiegazione dove si sceglie il valore.**
  `API_INTERNA_URL=https://localhost:4000` con il commento sul **SAN `localhost`**;
  `PUBLIC_MEDIA_ORIGINE=https://localhost:4000` con il commento che dice 🔴 **che in sviluppo
  coincidono ed è precisamente per questo che l'errore non si vede**, più l'esempio con l'IP di rete
  locale per provarli distinti; e `NODE_EXTRA_CA_CERTS` con il ⚠️ che dice che **da qui non viene
  letta** e che il file serve solo a dire dove va il PEM.
  *Verifica* (spec `consumo-api-pubblica` → *Il file di esempio spiega la differenza dove si sceglie
  il valore*; spec `sito-pubblico` → *L'host del prefisso API rispetta il SAN del certificato*,
  *⚠️ La variabile della CA non è letta da `.env`*): i tre commenti ci sono, e il secondo nomina il
  guasto invece del meccanismo.

- [ ] 2.4 🔴 **`sito/scripts/dev.mjs`** — ~30 righe, zero dipendenze, quattro responsabilità in
  quest'ordine: (1) risolve il percorso del PEM e, se manca, **stampa il comando `dotnet` esatto**
  invece di lasciare che il primo `fetch` fallisca con `fetch failed` e nient'altro; (2) imposta
  `process.env.NODE_EXTRA_CA_CERTS`; (3) 🔴 **confronta i due prefissi e stampa l'avviso di §D2 se
  coincidono**; (4) fa lo `spawn` di `astro dev` — o di `node dist/server/entry.mjs` quando è
  invocato come `start:prova`.
  *Verifica* (spec `consumo-api-pubblica` → *🔴 I due valori coincidono*, *L'avviso vale anche per
  il server di prova*): con i valori di `.env.example` l'avviso compare, nomina il valore condiviso
  e **suggerisce il comando** con l'IP di rete locale; compare anche avviando il bundle di prova,
  non solo il dev server.

- [ ] 2.5 **I due valori diversi non producono avviso** — controllo speculare del precedente.
  *Verifica* (spec `consumo-api-pubblica` → *I due valori sono diversi*): con
  `PUBLIC_MEDIA_ORIGINE` su un valore distinto, l'avviso **non** compare. Un avviso che compare
  sempre è rumore, e dopo due giorni nessuno lo legge più.

- [ ] 2.6 🔴 🧪 **PROVA MANUALE UNA TANTUM — `NODE_EXTRA_CA_CERTS` scritta solo in `.env` non
  funziona.** È l'unica dimostrazione del perché `dev.mjs` esiste; senza, il prossimo che
  "semplifica" spostando la variabile nel `.env` riporterà il guasto e non capirà.
  **Cosa eseguire**: scrivi `NODE_EXTRA_CA_CERTS=…` **solo** in `sito/.env`, disattiva il punto (2)
  di `dev.mjs`, avvia e fai una lettura verso `/api/public/site`. Poi **riattiva** il punto (2) e
  ripeti.
  **Cosa documentare**: l'errore esatto del primo giro — deve essere un fallimento TLS
  (`UNABLE_TO_VERIFY_LEAF_SIGNATURE` o il `fetch failed` che lo avvolge) — e il successo del
  secondo. La coppia dei due output è la prova; nessuno dei due da solo lo è.
  *Verifica* (spec `sito-pubblico` → *⚠️ La variabile della CA non è letta da `.env`*): due esiti
  opposti a parità di tutto tranne **dove** vive la variabile.

- [ ] 2.7 🔴 **Lettura reale con la verifica TLS attiva** — con `dev.mjs` al suo posto, una `fetch`
  verso `https://localhost:4000/api/public/site` **risponde**.
  🔧 Il backend dell'utente su `:4000` è già in esecuzione: **non va fermato né riavviato**, la
  rotta è una GET anonima.
  *Verifica* (spec `sito-pubblico` → *🔴 La lettura server-side funziona con la verifica TLS
  attiva*): la risposta arriva, e `NODE_TLS_REJECT_UNAUTHORIZED` **non compare** in alcun punto
  dell'ambiente né dei sorgenti.

- [ ] 2.8 **Il certificato mancante produce un'istruzione, non un errore muto** — rinomina
  temporaneamente il PEM e avvia.
  *Verifica* (spec `sito-pubblico` → *Il certificato mancante produce un'istruzione, non un errore
  muto*): l'output contiene il comando `dotnet dev-certs …` **copiabile così com'è**, e non un
  `fetch failed` senza causa. Poi il PEM torna al suo nome.

- [ ] 2.9 **Test di scansione: nessuna disattivazione della verifica** — un test in `sito/test/`
  che cerca `NODE_TLS_REJECT_UNAUTHORIZED` e `rejectUnauthorized` in tutti i sorgenti di `sito/`
  (e in `sito/scripts/`) e pretende **zero occorrenze**.
  ⚠️ **Fragilità nota, e la difesa**: la scansione va fatta **escludendo i commenti e la cartella
  `test/`**, altrimenti il test stesso — che contiene la stringa per cercarla — si trova da solo.
  Vale per tutti i test di scansione di questo change: vedi 3.9 e 4.9.
  *Verifica* (spec `sito-pubblico` → *🔴 Nessuna disattivazione della verifica nei sorgenti*):
  il test è verde, e **non** perché non guarda nulla — aggiungendo la stringa in un file
  applicativo diventa rosso (lo si prova qui, in dieci secondi, senza un task dedicato).

- [ ] 2.10 **`sito/README.md` — prima stesura: come si avvia, e la via d'uscita con il suo costo.**
  I due prefissi, il comando del certificato, `npm run dev`.
  ⚠️ La via d'uscita in chiaro (`dotnet run --launch-profile http`) va scritta **insieme al suo
  effetto collaterale**: il refresh token dell'admin è un cookie `Secure=true`, quindi in quella
  modalità **l'app di cassa non fa login**. È una sessione "solo vetrina", non una configurazione
  alternativa permanente.
  *Verifica* (spec `sito-pubblico` → *La via d'uscita è documentata con il suo effetto
  collaterale*): il costo è scritto accanto al comando, non in fondo alla pagina.

**Uscita di fase.** `npm run dev` parte, legge il backend reale **con la verifica dei certificati
attiva**, e stampa ogni giorno l'avviso che rende visibile il guasto invisibile. Il repository non
contiene certificati e non contiene una sola riga che spenga TLS.

---

## Fase 3 — `tipi.ts`, `api.ts`, `mediaUrl.ts` e i due test che leggono i sorgenti

**Perché esiste.** È il gradino in cui nasce il **confine dei due prefissi** — la trappola centrale
del change — e la forma della lettura che **non lancia mai**. Entrambi si dimostrano con
`npm test` **su una pagina sola e vuota**: nessun colore, nessun font, nessuna immagine. Se la
verifica di questo gradino avesse bisogno di una pagina vera, sarebbe la verifica del gradino 8.

- [ ] 3.1 🔴 **`env.schema` in `astro.config.mjs`** — due `envField.string`, due contesti:
  `API_INTERNA_URL` con `context: 'server'`, `PUBLIC_MEDIA_ORIGINE` con `context: 'client'`,
  entrambi `access: 'public'`.
  ⚠️ **I due nomi non condividono un solo morfema**: `API` ≠ `MEDIA`, `INTERNA` ≠ `PUBLIC`, `URL` ≠
  `ORIGINE`. Non è vezzo: `API_BASE_URL`/`MEDIA_BASE_URL` differiscono per **una** parola in mezzo,
  e una copia-incolla distratta le confonde. Qui non esiste una copia-incolla che produca l'altra.
  ⚠️ Il prefisso `PUBLIC_` si tiene **anche se lo schema dichiara già il contesto**: è la parola che
  qualcuno legge nel `.env` mentre decide quale valore mettere (Open Question n. 2).
  *Verifica* (spec `consumo-api-pubblica` → *Lo schema dichiara due variabili con due contesti*,
  *I due nomi non si trasformano l'uno nell'altro*): i due contesti sono diversi; nessuno dei due
  nomi si ottiene dall'altro cambiando una parola.

- [ ] 3.2 **`sito/src/lib/tipi.ts` — lo specchio dei DTO.** Le quattro interfacce di
  §"Interfaces / Contracts", con il commento di testa che dichiara la regola: *un campo qui che il
  DTO non ha sarà sempre `undefined`; un campo del DTO che manca qui è un dato che il sito ignora*.
  ⚠️ **`giorniOperativi` è `boolean[] | null`** e la nullabilità **va gestita**, non aggirata: il
  backend lo espone `null` quando il JSON persistito non è leggibile come sette booleani.
  ⚠️ `prezzo` è già risolto e **`0` è un omaggio, non un'assenza**; `geo` è **o entrambe le
  coordinate o niente**; `larghezzeDisponibili` **non si deduce mai**.
  *Verifica* (spec `consumo-api-pubblica` → *Giorni operativi nulli*, *Prezzo a zero*, *Coordinate
  assenti*, *Il modulo dei tipi non inventa campi*, *Il commento di testa dichiara la regola*): ogni
  campo ha un corrispondente in `backend/Controllers/Public/Dto/`, e nessun campo in più.

- [ ] 3.3 🔴 **`sito/src/lib/api.ts` — l'unico importatore di `astro:env/server`, e non lancia
  mai.** `Esito<T> = { stato:'ok'; dati:T } | { stato:'assente'; motivo:'timeout'|'rete'|'http'|'formato'; dettaglio:string }`,
  `leggiSito()`, `leggiMenu()`, `AbortSignal.timeout(3000)` con **una sola** costante di timeout in
  tutto il progetto, e una riga sullo stdout per ogni `assente`.
  🔴 **Proprietà che ne discende e va scritta nel commento**: poiché nessuna delle due rifiuta,
  `Promise.all([leggiSito(), leggiMenu()])` **non può cortocircuitare** — le due letture della home
  partono insieme senza bisogno di `allSettled`, e un fallimento parziale **resta parziale**.
  ⚠️ Il file si chiama `api.ts` e vive in `src/lib/`: **`src/fetch.ts` è un nome riservato** in
  Astro 7 (auto-importato per la configurazione di routing). Da sapere prima che a qualcuno venga in
  mente di "semplificare" spostandolo lì.
  *Verifica* (spec `consumo-api-pubblica` → *🔴 Il modulo di lettura restituisce un esito e non
  lancia mai*, *Un solo valore di timeout nel progetto*; spec `sito-pubblico` → *Il modulo API vive
  dove deve*, *Il nome riservato non è occupato*): `grep -rn "3000" sito/src/` mostra **una sola**
  definizione; `sito/src/fetch.ts` non esiste.

- [ ] 3.4 🔴 **`sito/src/lib/mediaUrl.ts` — l'unico compositore di URL di media.** Importa
  `PUBLIC_MEDIA_ORIGINE` da `astro:env/client` ed espone `mediaUrl(chiave, larghezza, formato)` e
  `srcSet(immagine, formato)`.
  🔴 Il commento deve dire **perché questo file non è condiviso** con
  `duedgusto/src/components/pages/sito/mediaUrl.tsx`: l'admin ha **un** prefisso perché è tutto
  browser, il sito ne ha **due**. Estrarre una utility comune imporrebbe al sito la forma che vale
  per l'admin, che è la forma sbagliata.
  🔴 **Origine assoluta sempre, mai vuota**, in ogni ambiente: `og:image` deve essere assoluta, e
  `""` è anche ciò che si ottiene **dimenticando** la variabile.
  *Verifica* (spec `consumo-api-pubblica` → *Il commento dice perché i due file non sono uno*,
  *Nessuna utility condivisa con l'app di cassa*, *Origine assoluta in sviluppo*, *Il backend non
  compone URL*): `duedgusto/` non è stato toccato; il DTO del backend continua a esporre la
  **chiave**, non un URL.

- [ ] 3.5 **`sito/src/lib/degradazione.ts`** — `ORA_TEMA_SERA_DI_RIPIEGO = "18:00"`, **con il
  commento che dice cos'è e cosa non è**: non una seconda sorgente di verità, ma un ripiego per un
  backend irraggiungibile, il cui unico effetto se sbagliato è spostare di qualche ora un tema
  automatico su una pagina che sta già **dichiarando** di essere incompleta.
  *Verifica* (spec `consumo-api-pubblica` → *Il commento dice cosa non è*, *Ripiego usato solo in
  assenza del dato*): il valore è letto **solo** nel ramo `assente`; nel ramo `ok` viene dall'API.

- [ ] 3.6 **Test unitari di `api.ts` — i quattro motivi.** Backend non in ascolto → `rete`; risposta
  oltre il timeout → `timeout`; codice di errore → `http`; corpo inatteso → `formato`. E un test che
  `Promise.all` di due letture di cui una fallisce **restituisce entrambi gli esiti**, invece di
  rifiutare.
  ⚠️ Per il caso "non in ascolto" si punta l'URL su una **porta libera** — non si spegne nulla.
  *Verifica* (spec `consumo-api-pubblica` → *🔴 Backend non in ascolto*, *Risposta lenta oltre il
  timeout*, *Risposta con codice di errore*, *Risposta con corpo inatteso*, *L'attesa parallela non
  cortocircuita*, *Ogni assenza lascia una riga nei log*): `npm test` passa; ogni caso produce
  **una riga di log** con il motivo.

- [ ] 3.7 **Test unitari di `mediaUrl` e `srcSet` — puri, senza rete.** Con
  `larghezzeDisponibili: [400, 800]` l'insieme delle sorgenti ha **due** voci e non quattro; con
  `[400,800,1200,1600]` ne ha quattro; con `[]` il markup degrada senza sorgenti multiple e **non
  solleva**; nessuna larghezza viene dedotta.
  *Verifica* (spec `immagini-vetrina` → *🔴 Immagine con meno varianti della costante*, *Immagine
  con tutte le varianti*, *Nessuna larghezza dedotta*, *Elenco di larghezze vuoto*, *Composizione di
  un URL di variante*): `npm test` passa, e i test usano **un'immagine piccola** — con la sola
  immagine grande resterebbero verdi anche con la regola rotta (è il punto del task 7.2).

- [ ] 3.8 🔴 **I due test che leggono i sorgenti.** In `sito/test/moduli.test.mjs`: `astro:env/server`
  compare **solo** in `src/lib/api.ts`; la stringa `"/media/"` compare **solo** in
  `src/lib/mediaUrl.ts`. Idioma verbatim di
  [`RegolaPubblicazioneUnicaTests`](../../../backend/DuedGusto.Tests/Unit/Common/RegolaPubblicazioneUnicaTests.cs).
  ⚠️ **Fragilità nota, e le tre difese.** Un test di scansione è fragile ai falsi positivi e va
  scritto così: (a) **esclude i commenti** — sia `//` sia `/* */` — perché il commento di 3.4 nomina
  proprio la stringa che cerca; (b) **esclude** `test/`, `node_modules/`, `dist/` e `.astro/`;
  (c) il messaggio di fallimento **nomina il file di troppo**, altrimenti il test dice che c'è un
  problema e non dove.
  *Verifica* (spec `consumo-api-pubblica` → *🔴 Il modulo dell'ambiente server compare in un file
  solo*, *🔴 Il percorso dei media si compone in un file solo*): entrambi verdi con l'albero reale,
  commenti compresi.

- [ ] 3.9 🔴 🧪 **VERIFICA PER MUTAZIONE dei due test di scansione.** Un test di unicità appena
  scritto è verde **per costruzione**: nessuno ha ancora provato che sappia fallire.
  **Cosa eseguire**: (1) **aggiungi** `import { API_INTERNA_URL } from 'astro:env/server';` in un
  secondo file applicativo, **esegui i test e vedi fallire** quello dell'ambiente server **con il
  file di troppo nominato nel messaggio**, poi **rimuovi** e vedilo tornare verde; (2) ripeti
  aggiungendo una seconda composizione di `` `${…}/media/${…}` `` in un altro file.
  **Cosa documentare**: **quale** test è diventato rosso e **quale è rimasto verde** in ciascuno dei
  due giri. Se diventano rossi entrambi, o nessuno, la scansione non sta discriminando ciò che
  crede.
  *Verifica* (spec `consumo-api-pubblica` → *🔴 Un secondo compositore fa fallire il test*): due
  mutazioni, due rossi mirati, due ripristini, e i test finali verdi.

- [ ] 3.10 **Una pagina sola e vuota, e la suite verde.** Crea la pagina minima che serve a far
  girare la build (nessun colore, nessun componente) ed esegui `npm test`.
  *Verifica* (gradino 3 di §"Migration / Rollout"): `npm test` è **verde con una pagina sola e
  vuota** — cioè il confine dei due prefissi è dimostrato **prima** che esista qualcosa da guardare.

**Uscita di fase.** I due prefissi vivono in due file, due moduli virtuali e due test che hanno
dimostrato di saper fallire nominando il colpevole; la lettura non lancia mai e il suo timeout è un
numero solo. Nessun pixel è stato ancora dipinto.

---

## Fase 4 — `global.css`: `@theme inline`, l'arancio che non può portare testo, e le prove sul CSS generato

**Perché esiste.** Due delle quattro classi di errore invisibili in sviluppo si chiudono qui, e
**nessuna delle due è visibile guardando una pagina**: `@theme` invece di `@theme inline` è
identico alla radice, e l'arancio su testo *si legge benissimo* — è solo 2.11. La verifica non è un
browser: è una **regex sul CSS generato**, e arriva prima che esista un colore in una pagina. È il
gradino che dimostra che il metodo funziona.

- [ ] 4.1 **I due registri come custom properties di runtime** — in `sito/src/styles/global.css`:
  `@import "tailwindcss"`, poi `:root, [data-tema="giorno"]` e `[data-tema="sera"]` con i sette
  token `--c-*` di §"Interfaces / Contracts", **i valori misurati** e non riscelti.
  ⚠️ Il fondo sera è **carboncino caldo `#251C19`**, non nero neutro; la crema `#F2EDE7` fa doppio
  lavoro ed è il gesso.
  *Verifica*: `npm run build` esce 0; i due blocchi definiscono **gli stessi sette nomi**, così che
  nessun token esista in un solo registro.

- [ ] 4.2 🔴 **`@theme inline` per i token che cambiano, `@theme` semplice per quelli che non
  cambiano mai.** I sette colori vanno in `@theme inline`; le quattro famiglie di font in `@theme`.
  ⚠️ **Mai `--font-display`**: `.font-display` sarebbe una utility e `font-display` è anche il
  descrittore di `@font-face` — chi cercasse l'uno troverebbe l'altro. I quattro ruoli si chiamano
  `--font-titolo`, `--font-firma`, `--font-insegna`, `--font-corpo`.
  ⚠️ **Conseguenza da conoscere prima di scrivere una riga di CSS a mano**: con `inline` il nome
  `--color-sfondo` non è più il canale attraverso cui passa il valore. Il CSS scritto a mano usa
  **`--c-sfondo`**, sempre.
  *Verifica* (spec `temi-e-identita` → *Il CSS scritto a mano usa il nome di runtime*):
  `grep -rn "var(--color-" sito/src/` non trova nulla.

- [ ] 4.3 🔴 **L'arancio esce dalla namespace del tema, e le sue tre sole forme.**
  `:root { --c-arancio: #FD8502; --logo-arancio: var(--c-arancio); }` **fuori** da `@theme`, con il
  commento che riporta **le due misure** (6.78 sulla lavagna, 2.11 sulla crema) e indirizza al token
  giusto: *"l'accento che porta testo esiste e si chiama `--c-accento`"*. Poi le tre sole utility:
  `@utility bg-arancio`, `@utility border-arancio`, `@utility fill-arancio`.
  🔴 **`text-arancio` non deve esistere.** Scriverla non genera CSS e il testo resta del colore
  ereditato — cioè leggibile: **il default del guasto è sicuro**. È l'unica difesa che funziona
  contro l'errore per analogia, che è il caso comune.
  *Verifica* (spec `temi-e-identita` → *🔴 La classe di testo arancione non esiste nel CSS
  generato*, *🔴 Scriverla non produce alcun effetto*, *Le tre utility ammesse esistono*,
  *Il commento indirizza al token giusto*): dopo la build, `.text-arancio` **non compare** nel CSS
  generato; le altre tre sì.

- [ ] 4.4 **`@custom-variant sera`** — `(&:where([data-tema="sera"], [data-tema="sera"] *))`, per i
  casi che i token non coprono. Il `:where()` tiene la specificità a zero.
  *Verifica* (spec `temi-e-identita` → *La variante del registro serale è legata a un attributo*):
  la variante è legata all'**attributo**, non a una classe `.dark`, coerentemente con
  `data-tema="sera"`.

- [ ] 4.5 **`html { font-synthesis: none; background-color: var(--c-sfondo); }`** e la regola
  anti-transizione `html:not([data-pronto]) *, html:not([data-pronto]) *::before { transition: none !important }`.
  🔴 `font-synthesis: none` **non è cosmesi**: senza, un `font-weight: 700` su Anton produce un
  grassetto **finto**, diverso fra Chrome, Safari e Firefox, che rovina proprio le aste che rendono
  Anton un carattere da insegna. Con la riga, `font-weight: 700` **non fa nulla** — e "non fa nulla"
  si vede subito, mentre un grassetto sintetizzato *sembra funzionare*.
  Il `background-color` su `html` fa sì che **il primissimo pixel dipinto sia già del tema giusto**.
  *Verifica*: `npm run build` esce 0.

- [ ] 4.6 🔴 **Test sul CSS generato: le utility inlinano il token di runtime.** In
  `sito/test/css-tema.test.mjs`, dopo la build, sul CSS di `dist/client/`:
  `assert.match(css, /\.bg-sfondo\s*\{[^}]*var\(--c-sfondo\)/)` **e**
  `assert.doesNotMatch(css, /\.bg-sfondo\s*\{[^}]*var\(--color-sfondo\)/)`.
  L'asserzione **negativa** è quella che porta l'informazione: con `@theme` semplice il valore
  passerebbe per `--color-sfondo`, e alla radice il risultato sarebbe **identico**.
  *Verifica* (spec `temi-e-identita` → *🔴 Le utility di colore inlinano il token di runtime*):
  entrambe le asserzioni passano.

- [ ] 4.7 **Test sul CSS generato: `font-synthesis: none` c'è.**
  *Verifica* (spec `temi-e-identita` → *🔴 La sintesi dei caratteri è disattivata nel CSS
  generato*): la dichiarazione compare nel CSS di `dist/`, non solo nel sorgente.

- [ ] 4.8 🔴 **Test di scansione: nessun testo arancione, in nessuna forma.** L'utility mancante
  non ferma i **valori arbitrari**: il test cerca
  `/text-\[?#?[Ff][Dd]8502|text-\[var\(--c-arancio\)\]|color:\s*var\(--c-arancio\)/` e pretende zero
  occorrenze.
  ⚠️ **Questo è IL caso di falso positivo del change**, e va gestito o il test nasce rosso: il
  commento del task 4.3 contiene **letteralmente** `#FD8502`, la parola `text-arancio` e la stringa
  `--c-arancio`. La scansione **deve escludere i commenti** (`/* */` nel CSS, `//` e `/* */` nel
  TS/JS) **e la cartella `test/`**. Escludere invece l'intero `global.css` sarebbe la soluzione
  sbagliata: è proprio il file in cui un `color: var(--c-arancio)` verrebbe scritto.
  *Verifica* (spec `temi-e-identita` → *🔴 Nessun testo arancione per valore arbitrario*): verde
  con il commento di §D7 presente nell'albero — cioè la difesa contro i falsi positivi è
  **esercitata**, non teorica.

- [ ] 4.9 🔴 🧪 **VERIFICA PER MUTAZIONE dell'arancio.** Un requisito che si limitasse a documentare
  il divieto non produrrebbe **alcuna differenza osservabile**.
  **Cosa eseguire**: **sposta** `--c-arancio` dentro `@theme` (diventando `--color-arancio`),
  esegui la build, **esegui i test e vedi comparire `.text-arancio` nel CSS generato** con il test
  di 4.3 rosso; poi **ripristina** e vedi il test tornare verde.
  **Cosa documentare**: che `.text-arancio` è **effettivamente comparsa** — è la dimostrazione che
  Tailwind genera le tre famiglie di utility **dalla stessa dichiarazione** e che non si può avere
  l'una senza l'altra, che è l'intero argomento di §D7.
  *Verifica* (spec `temi-e-identita`, §"Verifica per mutazione" del requisito dell'arancio): rosso
  con la mutazione, verde dopo il ripristino.

- [ ] 4.10 🔴 🧪 **VERIFICA PER MUTAZIONE di `@theme inline`.**
  **Cosa eseguire**: togli la parola `inline` dal blocco dei colori, ricostruisci, **esegui i test e
  vedi fallire** l'asserzione negativa di 4.6 (il CSS ora contiene `var(--color-sfondo)`), poi
  **rimetti `inline`**.
  **Cosa documentare**: che l'asserzione **positiva** è rimasta verde in entrambi i giri — cioè che
  un test scritto con la sola asserzione positiva **non avrebbe visto niente**. È la ragione per cui
  sono due.
  *Verifica* (spec `temi-e-identita` → *🔴 Le utility di colore inlinano il token di runtime*):
  rosso mirato con la mutazione, verde dopo il ripristino.

- [ ] 4.11 **Open Question n. 1 — `@theme inline` emette ancora `--color-*` su `:root`?** Va
  guardato al primo `npm run build`, e la risposta annotata in design.md.
  *Verifica* (design.md §"Open Questions"): se `--color-*` **c'è**, si aggiunge una riga al test di
  4.6 che ne pinna la presenza — perché una variabile che esiste ed è inutile è una **tentazione**.
  Se non c'è, si annota e basta. In nessuno dei due casi il design ci poggia sopra.

**Uscita di fase.** Il foglio di stile esiste, le due decisioni invisibili sono **provate sul CSS
generato**, e le due mutazioni hanno dimostrato che le prove sanno fallire. Nessuna pagina usa
ancora un colore — ed è esattamente il punto: la dimostrazione non ha avuto bisogno di guardare
nulla.

---

## Fase 5 — I tre font, serviti dal sito e non da un CDN

**Perché esiste.** È un gradino corto e completamente verificabile: tre file binari, la loro
licenza, la loro provenienza, e la prova che nessuna richiesta esce verso Google. Arriva prima di
`Base.astro` perché il preload è l'unica parte del `<head>` che dipende da **come la build nomina i
file**, e sbagliarla produce un font scaricato due volte senza che nulla sia rosso.

- [ ] 5.1 **`sito/scripts/scarica-font.mjs`** — zero dipendenze (`fetch` + `node:crypto`): scarica i
  tre `latin.woff2` dagli URL `gstatic` registrati e **verifica gli sha256** contro quelli in
  `PROVENIENZA.md`.
  *Verifica* (spec `temi-e-identita` → *Lo script di scarico verifica le impronte*, *Lo script non
  gira durante la build*): lo script **non** è invocato da `build`; è uno script a sé, e il suo
  output è riproducibile.

- [ ] 5.2 **I tre file, la licenza e la provenienza** — `Anton-latin.woff2` (18 612 B),
  `Allura-latin.woff2` (26 488 B), `PlayfairDisplay-900-latin.woff2` (22 372 B) in
  `sito/src/assets/fonts/`, più 🔴 **`OFL.txt`** (la licenza **richiede** che accompagni i file) e
  `PROVENIENZA.md` con famiglia, versione, URL gstatic esatta, sha256 e data.
  ⚠️ `PROVENIENZA.md` è ciò che rende l'operazione **rifacibile invece che da riscoprire**: il
  rollback (`rm -rf sito/`) porta via i binari, e con loro l'unica traccia di dove venivano.
  *Verifica* (spec `temi-e-identita` → *I tre file esistono con licenza e provenienza*): i tre file
  sono committati, gli sha256 nel documento corrispondono, il totale è ~67 kB.

- [ ] 5.3 **I tre `@font-face` scritti a mano, con l'`unicode-range` copiato verbatim** da Google, e
  `font-display: swap` — mai `block`: il titolo **è** il contenuto.
  ⚠️ Senza `unicode-range` il browser scarica il font anche per testo che non ha glifi in quel
  range — per esempio un nome di prodotto in cirillico.
  *Verifica* (spec `temi-e-identita` → *L'intervallo Unicode copre ciò che il sito scrive*): il
  range copre le accentate italiane, **€ (U+20AC — senza, sarebbero i prezzi)**, l'apostrofo
  tipografico, i trattini e il grado.

- [ ] 5.4 **Il corpo non scarica nulla** — `--font-corpo` è uno stack di sistema (con Roboto
  dentro, che su Android e ChromeOS dà proprio quel carattere, gratis).
  *Verifica* (spec `temi-e-identita` → *Il corpo non scarica alcun file*): nessun `@font-face` per
  il corpo, zero byte.

- [ ] 5.5 **`Base.astro`, prima stesura: solo il `<head>` e il preload.** Il layout nasce qui con
  `<meta charset>`, il titolo, il foglio di stile e il preload; lo script del tema e il toggle
  arrivano nella Fase 6. Nasce minimo perché il preload va provato **adesso**, mentre è l'unica cosa
  nel `<head>`.
  *Verifica*: una pagina che usa `Base.astro` si costruisce e si serve.

- [ ] 5.6 🔴 **Preload di Anton, con `crossorigin` e con l'URL prodotta dalla build.**
  `import antonUrl from '../assets/fonts/Anton-latin.woff2?url'` e
  `<link rel="preload" href={antonUrl} as="font" type="font/woff2" crossorigin />`.
  🔴 **Due trappole, entrambe silenziose.** (1) Vite riscrive l'`url()` del CSS in un percorso con
  **hash di contenuto**: un preload scritto a mano su `/fonts/Anton.woff2` punterebbe a un file
  **diverso** da quello che il CSS chiede, e il browser ne scaricherebbe due — comparendo come
  preload "inutile" invece che sbagliato. (2) `crossorigin` è **obbligatorio anche same-origin**: i
  font si recuperano in modalità CORS e senza l'attributo il preload **non viene riusato**.
  ⚠️ Il `<link>` va scritto **auto-chiuso**: nella 7 i void element non chiusi sono errori di build.
  Allura e Playfair **non** si preloadano: sono decorativi e non bloccano la lettura.
  *Verifica* (spec `temi-e-identita` → *Un solo preload di carattere*, *🔴 L'attributo crossorigin è
  presente*, *🔴 L'URL del preload è la stessa che il CSS richiede*): un test confronta l'`href` del
  preload nell'HTML servito con l'`url()` del CSS generato e pretende che siano **la stessa
  stringa**.

- [ ] 5.7 **Test: zero domini dei font esterni nei file generati.**
  *Verifica* (spec `temi-e-identita` → *I domini esterni non compaiono nei file generati*):
  `grep -r "fonts.gstatic.com\|fonts.googleapis.com" sito/dist/` non trova **nulla**, né nell'HTML
  né nel CSS.

- [ ] 5.8 🧪 **Prova manuale: la scheda di rete.** Apri la pagina, guarda la scheda di rete filtrata
  su `font`.
  **Cosa documentare**: quante richieste di font partono (devono essere **una**, quella di Anton, e
  le altre due solo quando compaiono in pagina), e che **nessuna** ha come host un dominio Google.
  *Verifica* (spec `temi-e-identita` → *Zero richieste verso i domini dei font esterni*): la scheda
  di rete lo mostra; il `grep` del task 5.7 lo conferma sui file. Sono due prove diverse dello
  stesso fatto, e servono entrambe — la prima vede il runtime, la seconda l'artefatto.

**Uscita di fase.** Tre file locali, 67 kB, una licenza, una provenienza rifacibile, un preload che
punta **esattamente** al file che il CSS chiede, e zero richieste verso Internet.

---

## Fase 6 — `Base.astro`: lo script del tema, il toggle, e l'identità byte per byte

**Perché esiste.** È la decisione che si sbaglia **senza accorgersene** — un tema calcolato
server-side funziona benissimo per un visitatore alla volta — e che si paga in Fase 6 del progetto,
quando il micro-cache servirà il tema di chi ha riempito la cache a metà dei visitatori. La verifica
è **su una pagina ancora priva di dati**, ed è composta da quattro asserzioni di cui **solo la
quarta** distingue davvero il giusto dallo sbagliato.

- [ ] 6.1 🔴 **Lo script `is:inline` con `define:vars`, primo nel `<head>` dopo `<meta charset>`.**
  Riceve `oraSera`, `oraApertura`, `oraChiusura`, `giorniOperativi` **come parametri** — non una
  decisione già presa.
  🔴 Il commento deve dire che **chi sposta il confronto sul server rompe il micro-cache di Fase 6
  senza che nulla diventi rosso** oltre alla prova 6.8.
  ⚠️ L'**ordine conta**: prima di qualunque `<link rel="stylesheet">`, così lo script gira senza
  nemmeno aspettare che la richiesta del CSS parta.
  ⚠️ `hourCycle: 'h23'` e **non** `hour12: false`: quest'ultimo restituisce `"24:00"` a mezzanotte
  in alcune versioni di ICU, e `"24:00" >= "18:00"` darebbe il tema sera all'ora sbagliata per
  sessanta minuti l'anno.
  ⚠️ `define:vars` implica **già** `is:inline`; si scrive comunque, perché chi rimuovesse
  `define:vars` in futuro non deve riportare il FOUC come effetto collaterale.
  *Verifica* (spec `temi-e-identita` → *Lo script è inline e viene prima del CSS*, *I parametri
  arrivano dall'API, non dal template*): l'HTML servito mostra lo script **prima** del foglio di
  stile, e i quattro valori vengono dall'esito di `leggiSito()`.

- [ ] 6.2 🔴 **Il confine del registro serale ha due estremi, entrambi dall'API.**
  `sera ⟺ ora >= oraInizioTemaSera ∨ ora < orari.apertura`. La sola prima metà dà il tema **giorno
  alle due di notte**. L'estremo di uscita **non è una costante inventata**: è l'orario di apertura,
  che l'API già espone — nessun secondo posto in cui un orario possa divergere dal database.
  La funzione va scritta in forma **estraibile e testabile**, non annegata nello script.
  *Verifica* (spec `temi-e-identita` → *🔴 Il confine del registro serale ha due estremi*): la
  formula compare **una volta sola** nel progetto.

- [ ] 6.3 **Test unitari del confine orario.** `"01:00"` con `oraSera="18:00"` e `apertura="07:00"`
  → **sera**; `"07:00"` → giorno; `"18:00"` → sera; `"17:59"` → giorno; e il caso di mezzanotte che
  **non** produce `"24:00"`.
  *Verifica* (spec `temi-e-identita` → *🔴 Le due di notte sono registro serale*, *Il registro
  serale finisce quando il locale apre*, *Dopo l'ora di inizio è sera*, *Mezzanotte non produce
  un'ora fuori scala*): `npm test` passa, e il caso delle due di notte è un test **a sé** — deve
  poter fallire da solo.

- [ ] 6.4 **`TemaSwitch.astro` — tre stati, vanilla, etichetta scritta dallo script.**
  `giorno → sera → auto`, chiave `tema` in `localStorage`. Il server rende un'etichetta **neutra**:
  un'etichetta renderizzata server-side **rivelerebbe lo stato**, e lo stato è client-side.
  *Verifica* (spec `temi-e-identita` → *L'etichetta servita è neutra*, *Nessun runtime di framework
  UI*): l'HTML servito non contiene la parola del tema corrente; `dist/client/` non contiene alcun
  runtime di framework.

- [ ] 6.5 🔴 **Lo stato "aperto ora" è client-side, per la stessa ragione del tema.** Gli **orari**
  sono dato e si renderizzano server-side; lo **stato** è orologio e si calcola nello stesso script,
  in un elemento reso `hidden` dal server e **svelato** dallo script — quindi senza salto di layout.
  ⚠️ **`giorniOperativi` può essere `null`**: in quel caso si mostrano apertura e chiusura **senza**
  i giorni, e il badge si limita al confronto orario.
  Senza JavaScript il visitatore vede **gli orari veri** e nessun badge: l'informazione c'è, manca
  la comodità.
  *Verifica* (spec `temi-e-identita` → *🔴 Lo stato di apertura non compare nell'HTML servito*,
  *Gli orari invece ci sono*, *Il badge compare nel browser*, *Senza JavaScript restano gli orari*):
  `curl` non trova "aperto"/"chiuso" nel corpo; trova gli orari.

- [ ] 6.6 **`data-pronto` non esiste nell'HTML servito** — lo aggiunge lo script al frame
  successivo, e serve solo a spegnere le transizioni fino al primo paint.
  *Verifica* (spec `temi-e-identita` → *L'attributo di pronto non è nell'HTML servito*): `curl` non
  lo trova; il browser sì, dopo il primo frame.

- [ ] 6.7 🔴 **Le quattro asserzioni di identità byte per byte.** In `sito/test/identita.test.mjs`,
  contro il server di prova: (1) due richieste alla stessa URL a **un minuto di distanza** →
  `Buffer.equals`; (2) `Cookie: tema=sera` vs `tema=giorno` → identici; (3)
  `Sec-CH-Prefers-Color-Scheme: dark` vs `light` → identici; (4) 🔴 la stringa `data-tema` compare
  **esattamente una volta** e quell'unica occorrenza è **dentro lo script**.
  ⚠️ Tutte e quattro sono **ricerche di sottostringa**, mai confronti su righe o indentazione: in
  Astro 7 `compressHTML: 'jsx'` è il default. La compressione è deterministica, quindi l'identità
  byte per byte regge — ma il markup non ha più l'indentazione su cui si sarebbe tentati di asserire.
  *Verifica* (spec `temi-e-identita` → *🔴 Il tag radice non porta l'attributo del tema*, *Due
  richieste a un minuto di distanza*, *Il cookie non cambia la risposta*, *L'header di preferenza
  non cambia la risposta*; spec `sito-pubblico` → *Le verifiche sull'HTML cercano sottostringhe*):
  tutte e quattro passano.

- [ ] 6.8 🔴 🧪 **CONTROPROVA MANUALE UNA TANTUM — le prime tre prove non bastano.** È la
  dimostrazione che la quarta asserzione è quella che porta l'informazione.
  **Cosa eseguire**: fai scrivere al server `data-tema="giorno"` sul tag `<html>` — cioè simula
  esattamente il guasto che il gradino esiste per escludere — ed esegui le quattro prove. Poi
  **rimuovi** la modifica.
  **Cosa documentare**: che le prime tre **restano verdi** (il server scrive *sempre* lo stesso
  tema, quindi i corpi restano identici) e che **solo la quarta** diventa rossa. Se anche la quarta
  restasse verde, non sta guardando il tag radice.
  *Verifica* (spec `temi-e-identita` → *🔴 Controprova — le prime tre prove non bastano*): tre verdi
  e un rosso, documentati per nome.

- [ ] 6.9 **Meta OG dai campi SEO, con il ripiego locale.** `seo.titoloDefault`,
  `seo.descrizioneDefault`, `seo.immagineOg` composta da `mediaUrl` (assoluta per costruzione); in
  assenza, `og-default.jpg` reso assoluto con `new URL('/og-default.jpg', Astro.url)`.
  ⚠️ `Astro.url.origin` dietro nginx dipenderà da `Host` e `X-Forwarded-Proto`: entrambi già
  inoltrati dalla configurazione esistente, ma **da riverificare in Fase 6** del progetto. Il
  sintomo di un guasto sarebbe un `og:image` in `http://` su un sito in `https://` (Open Question
  n. 3).
  ⚠️ `og:url` e `<link rel="canonical">` assoluti **non** si scrivono qui: sono Fase 3, insieme a
  `site:` e alla sitemap.
  *Verifica* (spec `temi-e-identita` → *Anteprima dall'API*, *Anteprima di ripiego*, *Nessun canonico
  assoluto in questa fase*): l'anteprima è assoluta in entrambi i rami; nessun canonical nel `<head>`.

**Uscita di fase.** Il server emette **una sola pagina, priva di tema**, e lo ha dimostrato con
quattro asserzioni di cui una — provata per mutazione — è l'unica che distingue davvero. Il toggle
funziona su una pagina che non ha ancora né dati né immagini.

---

## Fase 7 — `Immagine.astro` e `Logo.astro`

**Perché esiste.** Due componenti, due guasti che **non producono alcun errore**: un `srcset` dedotto
invece che letto emette URL che rispondono 404 in modo diverso da browser a browser, e un logo dentro
`<img>` **sparisce sul fondo lavagna** perché `currentColor` non attraversa il confine di un
documento isolato. Nessuno dei due rompe una build.

- [ ] 7.1 🔴 **`sito/src/components/Immagine.astro`** — `<picture>` con una `<source type="image/webp">`
  e un `<img>` di ripiego in `jpg`, i due formati che il backend **ha già generato**
  ([`ImmagineProcessor.cs:376-377`](../../../backend/Services/Media/ImmagineProcessor.cs)).
  ⚠️ `<source …/>` va scritto **auto-chiuso**: nella 7 il compilatore Rust è l'unico e i void element
  non chiusi sono **errori**, non più auto-corretti.
  *Verifica* (spec `immagini-vetrina` → *Due formati nel markup*, *Nessun formato inventato*, *Il
  markup compila con il compilatore severo*): la build riesce; `grep` sui sorgenti trova **solo** le
  due estensioni che il backend produce.

- [ ] 7.2 🔴 🧪 **VERIFICA PER MUTAZIONE — `srcset` solo da `larghezzeDisponibili`, mai dedotto.**
  **Cosa eseguire**: sostituisci l'elenco del DTO con la **costante** delle larghezze standard
  (`[400, 800, 1200, 1600]`), **esegui i test e vedi fallire** lo scenario dell'**immagine piccola**
  (quella con due sole varianti), poi **ripristina**.
  **Cosa documentare**: che il test dell'immagine **grande** è rimasto verde — perché le sue
  varianti coincidono con la costante. Un test scritto solo su un'immagine grande **non avrebbe
  visto niente**, ed è precisamente l'errore che questa prova esiste per escludere.
  *Verifica* (spec `immagini-vetrina` → *🔴 L'insieme delle sorgenti si costruisce solo dalle
  larghezze disponibili*, *Nessuna variante inesistente viene richiesta*): rosso mirato, ripristino,
  verde.

- [ ] 7.3 🔴 **`sizes` è una prop obbligatoria, senza alcun default.** Ometterla non è un errore per
  il browser: assume `100vw` e scarica la variante più grande **anche per una miniatura**.
  ⚠️ **La forma della verifica è quella decisa nel task 1.11**, non un'altra: `npm run check` se il
  controllo dei tipi nomina davvero la prop mancante **in un uso dentro un template**; altrimenti un
  test che pinna che ogni occorrenza di `<Immagine` nei sorgenti porta `sizes=`. Se si ripiega sulla
  seconda forma, va scritto **qui** perché.
  `sizes` va dichiarata su **entrambe** le sorgenti, `<source>` e `<img>`.
  *Verifica* (spec `immagini-vetrina` → *🔴 Omettere la dimensione di resa è un errore di tipo*,
  *Nessun default nel componente*, *La dimensione di resa compare su entrambe le sorgenti*): la
  verifica scelta fallisce davvero su un uso senza `sizes` — provato una volta, non assunto.

- [ ] 7.4 **Le quattro proprietà che azzerano lo spostamento del contenuto.** `width`/`height`
  **dall'originale** (il rapporto d'aspetto resta corretto anche se la variante servita ha larghezza
  diversa); `object-position` dal campo focale **verbatim** (`"50% 40%"`, già nella forma giusta) con
  `"50% 50%"` in assenza; `background-image` dal placeholder (data URI completo) con `cover`;
  `alt={testoAlternativo ?? ''}` — 🔴 **stringa vuota e non attributo assente**: la prima dichiara
  "decorativa" agli screen reader, il secondo li fa leggere l'URL. `loading`/`fetchpriority` legati
  a `priorita`, `decoding="async"`.
  *Verifica* (spec `immagini-vetrina` → *Dimensioni dichiarate*, *Punto focale applicato verbatim*,
  *Punto focale assente*, *Placeholder usato verbatim*, *Placeholder assente*, *Testo alternativo
  assente*, *Caricamento differito tranne la principale*): ogni caso di assenza ha il suo
  comportamento, e nessuno solleva.

- [ ] 7.5 🔴 **Test: il componente immagine del framework non compare, e `sharp` non è una
  dipendenza.** `<Image>` di `astro:assets` rifarebbe a runtime l'ottimizzazione che il backend ha
  già fatto, richiederebbe `image.domains`/`remotePatterns` per ogni origine, e porterebbe **sharp e
  i suoi binari nativi** nel container di Fase 6.
  ⚠️ Stessa cautela sui falsi positivi del task 3.8: escludere commenti e `test/`.
  🧪 **Verifica per mutazione**: introduci `<Image>` su un media remoto, **vedi il test rosso**,
  rimuovilo. È una regola che **nessun comportamento osservabile rivelerebbe** — la pagina
  funzionerebbe — ed è per questo che va pinnata invece che documentata.
  *Verifica* (spec `immagini-vetrina` → *🔴 Il componente immagine del framework non compare nei
  sorgenti*, *Nessuna autorizzazione di origini remote nella configurazione*, *Nessuna libreria di
  elaborazione immagini fra le dipendenze*): il test è verde e ha dimostrato di saper diventare
  rosso.

- [ ] 7.6 🔴 **`sito/src/components/Logo.astro` — l'SVG entra nel DOM come markup.**
  `import logo from '../assets/logo-2dgusto.svg?raw'` e
  `<span class="text-inchiostro" style="--logo-arancio: var(--c-arancio)" set:html={logo} />`.
  🔴 **Un `<img src={logo}>` qui è la riga che fa sparire il logo di sera**: un SVG dentro `<img>` è
  un documento isolato, `currentColor` si risolve al nero e il segno scompare sul fondo lavagna.
  Sbagliare cartella non produce un errore.
  ⚠️ `set:html` **non** è soggetto alla regola dei void element: l'SVG è una stringa di runtime, non
  markup compilato.
  *Verifica* (spec `temi-e-identita` → *🔴 Il logo è inline nel DOM*, *L'SVG inserito come stringa
  non è soggetto alla regola*): l'HTML servito contiene `<svg`, e **nessun** `<img` per il logo.

- [ ] 7.7 **Il sottoinsieme del master, nelle due cartelle giuste.** In `sito/public/`:
  `favicon.svg`, `apple-touch-icon.png`, `og-default.jpg`, `robots.txt` — serviti **verbatim** a URL
  fisse, perché il browser li cerca a percorsi precisi e un hash di contenuto li renderebbe
  introvabili. In `sito/src/assets/`: `logo-2dgusto.svg`, `monogramma-2d.svg` — perché vanno inline.
  ⚠️ **`robots.txt` nasce permissivo**: il `Disallow: /` va sull'host dell'**app**, non della
  vetrina, ed è Fase 6. Anticiparlo qui deindicizzerebbe il sito che stiamo costruendo.
  ⚠️ `docs/brand/` è **il master e resta invariato**: la copia è un **sottoinsieme**, ed è la ragione
  per cui `rm -rf sito/` non fa perdere alcun asset.
  *Verifica* (spec `temi-e-identita` → *I file serviti verbatim stanno ai loro percorsi*, *Solo un
  sottoinsieme del master è stato copiato*, *Il `robots.txt` è permissivo*; spec `sito-pubblico` →
  *Il master del marchio non viene modificato*): `git diff --stat docs/brand/` è **vuoto**.

- [ ] 7.8 🧪 **Prova visiva su una pagina di prova, con un'immagine reale.** Usa **uno dei due media
  in cartella `galleria`** già a database — non un file inventato — e il logo, nei due temi.
  **Cosa documentare**: che l'immagine risponde **`200`** nella scheda di rete (non l'`alt` di un
  404), che l'ispezione dell'elemento del logo mostra `<svg>` e **non** `<img>`, e che il segno
  resta leggibile su **entrambi** i fondi.
  *Verifica* (spec `temi-e-identita` → *🔴 Il logo resta leggibile nei due temi*; gradino 7 di
  §"Migration / Rollout"): la pagina di prova mostra una immagine reale e il logo che segue il tema.

**Uscita di fase.** I due componenti esistono e sono provati **su un dato reale**, con due mutazioni
che hanno dimostrato che le regole invisibili sono sorvegliate. Le pagine vere non esistono ancora.

---

## Fase 8 — `/menu`: il deliverable

**Perché esiste.** È **il deliverable della Fase 2 del piano, alla lettera**: il menu reale con le
foto reali, nei due temi. Arriva **prima della home** perché è la pagina che il piano nomina, e
perché è il primo markup con abbastanza immagini vere da rendere significativa la prova con l'host
sentinella — la prova che chiude il rischio centrale del change.

- [ ] 8.1 **`sito/src/components/SchedaProdotto.astro`** — nome, descrizione, prezzo, allergeni e i
  due marcatori (`novita`, `consigliato`).
  ⚠️ La descrizione è `descrizione` del DTO, che è `DescrizioneVetrina` **senza fallback** sulla
  descrizione contabile: un prodotto senza descrizione di vetrina non ne mostra alcuna.
  ⚠️ Il prezzo è **già risolto** dal backend: `0` è un omaggio e si stampa, non si nasconde.
  *Verifica*: la scheda si costruisce e rende un prodotto con e senza immagine.

- [ ] 8.2 **`sito/src/pages/menu.astro`** — categorie di vetrina nell'ordine in cui l'API le manda,
  ciascuna con i suoi prodotti, foto tramite `Immagine.astro` con un `sizes` **scritto per il
  layout reale** della griglia. `Cache-Control: public, max-age=60` nello stato normale.
  *Verifica* (spec `sito-pubblico` → *Un solo punto scrive l'header di cache*): l'header si scrive
  in **un solo punto** (`Astro.response.headers`), mai in due — niente `routeRules`, che è statica
  per rotta mentre questa cache è **condizionale sullo stato** (§D1).

- [ ] 8.3 🔴 **Il troncamento è dichiarato al visitatore.** Con `troncato === true`, in coda al
  listino: *"Sono mostrati i primi {limiteApplicato} prodotti di {totaleProdottiPubblicati}. Per il
  listino completo chiedi in cassa."* + una riga sullo stdout.
  🔴 **I due numeri vengono dal server e non sono costanti del sito**: il consumatore non li
  indovina. E l'avviso **non** sta dietro un flag di sviluppo e **non** è un `console.warn` — il
  visitatore è l'unico che può reagire.
  *Verifica* (spec `sito-pubblico` → *🔴 Menu troncato*, *I due numeri non sono costanti del sito*,
  *Menu non troncato*): `grep -rn "300" sito/src/` non trova il limite scritto a mano.

- [ ] 8.4 **`categorie` vuoto è uno stato legittimo, non un guasto.** Nessun prodotto pubblicato →
  messaggio dichiarato, **mai** una pagina bianca né un 503: è diverso dalla degradazione, dove il
  dato **non è arrivato**.
  *Verifica* (spec `sito-pubblico` → *Nessun prodotto pubblicato*): con una risposta a categorie
  vuote la pagina risponde `200` con un messaggio.

- [ ] 8.5 **Test del troncamento con risposta simulata.** `troncato: true` → l'avviso compare e
  contiene **i due numeri della risposta**; `troncato: false` → non compare.
  *Verifica* (spec `sito-pubblico` → *🔴 Menu troncato*): `npm test` passa senza bisogno di 301
  prodotti a database.

- [ ] 8.6 🔴 🧪 **IL DELIVERABLE — `/menu` nel browser, confrontata uno per uno con l'API.**
  **Cosa eseguire**: apri `http://localhost:4321/menu` nei **due temi**, e affianca
  `curl -sk https://localhost:4000/api/public/menu`.
  **Cosa documentare**: i **tre prodotti `VETR-F5-*`** confrontati **uno per uno** — nome, prezzo,
  descrizione, allergeni, marcatori — e lo stato di rete di **ogni immagine** (`200`, non l'`alt` di
  un 404). Non uno screenshot della home: è questa pagina, con questi dati.
  *Verifica* (spec `sito-pubblico` → *Il menu corrisponde uno per uno alla risposta dell'API*;
  proposal §Success Criteria, primo criterio): nessuna differenza fra ciò che l'API dice e ciò che
  la pagina mostra.

- [ ] 8.7 🔴 **Prova A automatizzata — l'host sentinella.** Build con
  `PUBLIC_MEDIA_ORIGINE=https://media.sentinella.invalid`, avvio del server di prova, richiesta a
  `/menu`: l'HTML contiene `media.sentinella.invalid` **e zero occorrenze** dell'host dell'API.
  ⚠️ La verifica **non richiede che l'host sentinella risolva**: è un'asserzione sul **markup**, non
  sul caricamento. Per questo è deterministica e gira senza rete.
  *Verifica* (spec `consumo-api-pubblica` → *🔴 Prova A — host sentinella nel markup*, *L'HTML
  servito non contiene mai l'host di lettura delle rotte*): il test è verde.

- [ ] 8.8 🔴 🧪 **CONTROPROVA MANUALE UNA TANTUM — con un prefisso solo l'asserzione trova l'host
  interno.** È ciò che **dimostra** che una prova ingenua (pagina che si renderizza, markup
  presente, nessun test rosso) sarebbe passata lo stesso.
  **Cosa eseguire**: modifica `mediaUrl.ts` per comporre gli URL delle immagini da `API_INTERNA_URL`
  — cioè da **un** prefisso solo — riesegui la prova A, poi **ripristina**.
  **Cosa documentare**: che la prova A **fallisce** trovando `localhost:4000` dentro il markup, e
  che **tutto il resto resta verde** — la pagina si renderizza, le immagini caricano (in sviluppo i
  due valori coincidono!), nessun altro test si accorge di nulla. È l'intero argomento di §D2 in una
  riga di output.
  *Verifica* (spec `consumo-api-pubblica` → *🔴 Controprova — con un prefisso solo l'asserzione
  trova l'host interno*): il fallimento è documentato con il testo esatto, e il ripristino verificato.

- [ ] 8.9 🧪 **Prova B — due valori diversi, entrambi funzionanti.** Avvia con
  `PUBLIC_MEDIA_ORIGINE` sull'**IP di rete locale** (es. `https://192.168.1.42:4000`) e
  `API_INTERNA_URL` su `localhost:4000`.
  ⚠️ Il certificato ha `localhost` come solo SAN: l'IP nel prefisso **media** va bene perché quel
  fetch lo fa il **browser** (che chiederà conferma), non Node.
  **Cosa documentare**: che la pagina si renderizza **e** che le immagini caricano davvero, con due
  valori diversi. È la prova umana che il codice regge quando i due prefissi divergono, che è ciò
  che accadrà in produzione.
  *Verifica* (spec `consumo-api-pubblica` → *Prova B — due valori diversi, entrambi funzionanti*):
  entrambe le metà osservate, non dedotte.

- [ ] 8.10 **Test: nessun campo contabile o interno nell'HTML servito.**
  *Verifica* (spec `sito-pubblico` → *Ricerca dei campi riservati nella pagina renderizzata*):
  `Codice`, `AliquotaIva`, `unitaDiMisura`, `Attivo`, `CreatedAt`, `UpdatedAt` non compaiono nella
  pagina renderizzata. Il contratto pubblico non li possiede: il test verifica che il sito **non li
  abbia presi da altrove**.

- [ ] 8.11 **Test: nessun orario scritto nei sorgenti.**
  *Verifica* (spec `sito-pubblico` → *Nessun orario nei sorgenti*): `grep -rn "20:00" sito/src/` non
  trova **nulla**. Gli orari vengono dall'API, non dai template. ⚠️ `"18:00"` è invece **atteso** in
  `degradazione.ts`, ed è l'unica occorrenza legittima di un orario: il test la nomina come
  eccezione o cerca il solo orario di chiusura.

**Uscita di fase.** 🎯 **Il deliverable del piano è chiuso**: il menu reale con le foto reali, nei
due temi, confrontato uno per uno con l'API. E il rischio centrale del change è chiuso con una
prova **e** la sua controprova. La home non esiste ancora.

---

## Fase 9 — `/`: la home, e la fascia che rende `@theme inline` load-bearing

**Perché esiste.** La home è la pagina che la gente digita, ma il motivo per cui questo gradino è
separato è un altro: contiene la **fascia in registro sera annidata in una pagina in tema giorno**,
che è l'unico posto in cui la differenza fra `@theme` e `@theme inline` diventa **visibile a occhio**.
La Fase 4 lo ha provato sul CSS generato; qui lo si guarda.

- [ ] 9.1 **`sito/src/pages/index.astro`** — hero con il logo, insegna stirata, slogan in Allura,
  orari con il badge client-side, striscia dei `consigliato`, fascia sera, striscia della galleria,
  contatti. `Cache-Control: public, max-age=60` nello stato normale.
  ⚠️ Le due letture partono con `Promise.all([leggiSito(), leggiMenu()])`, che **non può
  cortocircuitare** (task 3.3): dimezza la latenza senza `allSettled`.
  *Verifica* (spec `sito-pubblico` → *La home mostra una selezione viva, non una lista scritta a
  mano*): la striscia dei consigliati viene dal payload, non da un array nel template.

- [ ] 9.2 🔴 **L'insegna a tre parole: ×1.55, da un token solo, e la riserva che ne deriva.**
  `--stiramento-insegna: 1.55` in `:root`; `.insegna { transform: scaleX(var(--stiramento-insegna)) }`
  e `.insegna-riserva { padding-inline: calc((var(--stiramento-insegna) - 1) / 2 * 100%) }`.
  🔴 `transform` **non partecipa al layout**: l'elemento continua a occupare la sua larghezza non
  trasformata, quindi il testo stirato **sborda** sui vicini e non si centra da solo. La riserva
  **deve derivare dallo stesso numero**, altrimenti il giorno in cui il fattore cambia lo spazio
  resta quello vecchio e nessuno collega le due cose.
  ⚠️ Vale **1.55**, il numero misurato, non l'`1.5` che
  [`docs/brand/README.md:88-91`](../../../docs/brand/README.md) suggerisce nella stessa riga in cui
  dichiara ×1.55: è quel numero arrotondato. La correzione del README è **debito annotato**, non un
  task di questo change (`docs/brand/` è invariato).
  ⚠️ Le tre parole restano **testo selezionabile**, mai l'SVG dell'insegna: devono poter essere
  lette, tradotte e indicizzate.
  *Verifica* (spec `temi-e-identita` → *Il fattore è dichiarato una volta sola*, *🔴 La riserva di
  spazio deriva dal token*, *Cambiare il fattore sposta anche lo spazio*, *Le tre parole sono
  testo*): `grep -rn "1.55" sito/src/` trova **una** riga; cambiando il token a mano, la riserva si
  muove insieme al testo.

- [ ] 9.3 🔴 🧪 **La fascia "Aperitivo" in registro sera dentro la pagina in tema giorno.** Un
  `<section data-tema="sera">` con dentro utility di colore (`bg-sfondo`, `text-inchiostro`, …).
  **Cosa documentare**: che in **tema giorno** la fascia è **lavagna con gesso**, e non crema con
  oliva. Con `@theme` semplice sarebbe rimasta crema-e-oliva, **senza alcun errore da nessuna
  parte**: è la verifica visiva di ciò che il task 4.6 ha provato sul CSS.
  *Verifica* (spec `temi-e-identita` → *🔴 La fascia in registro serale dentro una pagina in tema
  giorno*, *Il caso resta riproducibile anche se la fascia cambiasse*): se la fascia venisse tolta
  per ragioni editoriali (Open Question n. 5), il caso va comunque riprodotto — anche in una pagina
  di prova non linkata — o la decisione fra `@theme` e `@theme inline` torna indistinguibile.

- [ ] 9.4 **La home non mostra l'avviso di troncamento.** Usa lo stesso payload di `/menu` per la
  striscia dei consigliati, ma **non promette completezza**: un avviso lì sarebbe rumore.
  ⚠️ **Conseguenza da conoscere**: con il menu troncato, un prodotto `consigliato` oltre il limite
  **non compare in home**. Il rimedio è `OrdinamentoVetrina`, che è la leva che l'admin già ha.
  *Verifica* (spec `sito-pubblico` → *La home non mostra l'avviso di troncamento*): con
  `troncato: true` simulato, `/menu` avvisa e `/` no.

- [ ] 9.5 **La striscia della galleria usa i media reali.** I due media in cartella `galleria` già a
  database.
  *Verifica*: le immagini caricano `200`; la striscia non è una lista di file scritti a mano.

- [ ] 9.6 🧪 **Prova dai dati vivi: un `consigliato` tolto dall'admin sparisce dalla home.**
  **Cosa eseguire**: dall'app di cassa su `:4001` (non dal database), togli il marcatore a un
  prodotto `VETR-F5-*`, ricarica la home dopo il tempo di cache, poi **rimetti il marcatore**.
  **Cosa documentare**: che il prodotto **sparisce** e poi **torna**. È la prova che la home legge
  dati vivi e non una lista scritta a mano.
  *Verifica* (proposal §Success Criteria): il giro si chiude **dall'interfaccia**, e il database
  torna com'era.

- [ ] 9.7 🧪 **Prova dai dati vivi: l'orario cambiato in cassa si riflette sul sito.**
  **Cosa eseguire**: modifica l'orario di chiusura dal **periodo di programmazione in corso** della
  cassa — ⚠️ non dalla pagina delle impostazioni, dove il campo non esiste: è la scoperta annotata
  nel change precedente (task 11.3) — attendi il tempo di cache, ricarica, poi **ripristina**.
  **Cosa documentare**: il valore prima, dopo e dopo il ripristino, letti **sul sito** e non su
  `curl`. È la dimostrazione, chiusa sul sito, che gli orari hanno **una sola sorgente**.
  *Verifica* (spec `sito-pubblico` → *Gli orari mostrati vengono dall'API*): il sito segue la cassa,
  e nessun orario è stato scritto in un template.

- [ ] 9.8 **Open Question n. 5 — la fascia "Aperitivo" affiancata alle locandine.** Guardala accanto
  al materiale di marca prima di chiudere il change, e annota la decisione in design.md.
  *Verifica* (design.md §"Open Questions"): la voce è spuntata con la scelta fatta e, se la fascia
  viene tolta, con **dove** il caso di §D6 è stato riprodotto.

**Uscita di fase.** Le due pagine esistono, leggono dati vivi, e la decisione più sottile del design
system è stata **guardata** oltre che testata.

---

## Fase 10 — Degradazione: `/` a 200, `/menu` a 503, e niente entra in cache

**Perché esiste.** In SSR una `fetch` che fallisce nel frontmatter **fa fallire la pagina**: Astro
risponde 500 e in sviluppo mostra il proprio overlay. È il comportamento peggiore possibile per una
vetrina, ed è il **default**. Questo gradino arriva per ultimo fra quelli funzionali perché ha
bisogno di due pagine vere da degradare.

- [ ] 10.1 **`sito/src/components/AvvisoDegradazione.astro`** — l'avviso **dichiarato** dello stato
  `assente`, leggibile da un visitatore e non da chi sviluppa.
  *Verifica*: il componente si rende in entrambe le pagine.

- [ ] 10.2 🔴 **Tre stati per pagina, non due, e due codici di stato diversi.**
  `/` con `site` ok e `menu` assente → identità, orari, contatti, **niente striscia consigliati** e
  un avviso al suo posto; `/` con `site` assente → marca, slogan, "Colazione Pranzo Aperitivo",
  **avviso in testa**, niente orari né "aperto ora". `/menu` → **`503` con `Retry-After: 120`** in
  entrambi i casi di assenza, con un corpo leggibile.
  🔴 Le due scelte hanno ragioni **diverse**: `/` è l'URL che la gente digita e che i motori tengono
  in indice, e la pagina degradata **ha contenuto vero** perché quegli asset sono locali; `/menu`
  esiste per un dato, e una pagina `200` vuota sarebbe **un menu vuoto indicizzabile** — la stessa
  classe di guasto silenzioso che il flag `troncato` esiste per evitare.
  *Verifica* (spec `sito-pubblico` → *🔴 Backend spento, apertura della home*, *🔴 Backend spento,
  apertura del menu*, *Fallimento parziale — il menu non risponde e il sito sì*): i tre stati sono
  distinti e osservabili.

- [ ] 10.3 🔴 **`Cache-Control: no-store` su ogni risposta degradata**, sia il `200` di `/` sia il
  `503` di `/menu`. Senza, il micro-cache di Fase 6 congelerebbe la pagina degradata per sessanta
  secondi **dopo** che il backend è tornato su.
  *Verifica* (spec `sito-pubblico` → *Cache dichiarata nello stato normale*, *🔴 Cache negata nello
  stato degradato*, *🔴 Cache negata sulla risposta di indisponibilità*): tre header, tre stati.

- [ ] 10.4 🔧 **Come si prova "il backend è giù" senza spegnere quello dell'utente** — da scrivere
  nel README, perché è la domanda che si ripresenta ogni volta.
  Due modi: (a) puntare `API_INTERNA_URL` su una **porta libera** (nessun ascoltatore → esito
  `rete`, che è lo stesso caso); (b) avviare una **seconda istanza**
  (`ASPNETCORE_URLS=https://localhost:4012 SEED_ON_STARTUP=false`), puntarci il sito, e spegnere
  **quella** — è l'unico modo di provare la transizione *su → giù → su* del task 10.7.
  ⚠️ Il backend dell'utente su `:4000` **non si ferma mai**, in nessuno dei due modi.
  *Verifica*: il README lo dice, e i test di 10.5 usano il modo (a), che è deterministico.

- [ ] 10.5 🔴 **Test automatici della degradazione.** Contro il server di prova: con l'API
  irraggiungibile, `/` risponde **200** con `no-store` e `/menu` risponde **503** con `no-store` e
  `Retry-After`; con l'API raggiungibile, entrambe rispondono `public, max-age=60`.
  ⚠️ L'header si **legge**, non si confronta con una stringa: le direttive possono essere emesse
  senza spazio dopo la virgola, ed è la stessa direttiva.
  *Verifica* (spec `sito-pubblico` → *🔴 `/` risponde `200` degradata, `/menu` risponde `503` con
  `Retry-After`*): `npm test` passa in entrambe le condizioni.

- [ ] 10.6 🔴 🧪 **VERIFICA PER MUTAZIONE del `no-store`.**
  **Cosa eseguire**: togli la scrittura di `no-store` dal ramo degradato, **esegui i test e vedi
  fallire** lo scenario che interroga l'header con il backend irraggiungibile, poi **ripristina**.
  **Cosa documentare**: che lo scenario del **caso felice è rimasto verde** — un test che verificasse
  solo quello non si sarebbe accorto di nulla, ed è la ragione per cui i casi sono tre e non uno.
  *Verifica* (spec `sito-pubblico`, §"Verifica per mutazione" del requisito della cache): rosso
  mirato, ripristino, verde.

- [ ] 10.7 🧪 **La pagina degradata non resta congelata dopo il ripristino.**
  **Cosa eseguire**: con il modo (b) del task 10.4 — seconda istanza su 4012 — apri le pagine con il
  backend **su**, spegnilo, ricarica, riaccendilo, ricarica.
  **Cosa documentare**: che al ritorno la pagina è **di nuovo completa**, senza attendere alcun TTL.
  È la proprietà che `no-store` esiste per garantire, e si vede solo facendo il giro completo.
  *Verifica* (spec `sito-pubblico` → *La pagina degradata non resta congelata dopo il ripristino*):
  il giro su → giù → su è stato fatto davvero.

- [ ] 10.8 **Nessun overlay del framework, e ogni assenza lascia una traccia.**
  *Verifica* (spec `sito-pubblico` → *Nessun overlay del framework*, *Ogni degradazione lascia una
  traccia nei log*): con il backend irraggiungibile **in modalità di sviluppo**, quel che si vede è
  la pagina degradata e **non** l'overlay di errore di Astro; e sullo stdout del processo Node
  compare una riga per ogni `assente`, con il motivo. **Chi guarda il sito vede meno; chi guarda i
  log sa perché.**

- [ ] 10.9 **L'ora del tema in stato degradato viene dal ripiego, e solo lì.**
  *Verifica* (spec `consumo-api-pubblica` → *Ripiego in stato degradato*, *Ripiego usato solo in
  assenza del dato*): con il backend irraggiungibile lo script riceve `"18:00"` da
  `degradazione.ts`; con il backend su riceve `oraInizioTemaSera` dall'API, anche se vale `"18:00"`
  — sono due percorsi diversi che oggi danno lo stesso numero, e il test li distingue **cambiando il
  valore a database**, non confrontando la stringa.

**Uscita di fase.** Il backend può cadere e il sito lo **dichiara** invece di rompersi, con due
codici di stato scelti per due ragioni diverse, e nulla di degradato può finire in una cache.

---

## Fase 11 — `dev:sito` nel `package.json` di radice

**Perché esiste.** È **l'unica modifica a un file preesistente** di tutto il change, e va per ultima
proprio per questo: isolata nel diff, dove chiunque la veda sappia che è tutta lì.

- [ ] 11.1 **`"dev:sito": "cd sito && npm run dev"`** in `package.json` di radice.
  *Verifica*: `npm run dev:sito` dalla radice avvia il sito su `:4321`.

- [ ] 11.2 **`dev:sito` dentro il `concurrently` di `dev`** — l'elenco dei nomi diventa
  `backend,frontend,sito` e quello dei colori acquista una terza voce.
  ⚠️ **Ordine di avvio**: i tre processi partono insieme, quindi il sito può fare la sua prima
  lettura **prima** che il backend sia in ascolto. Il risultato è una pagina degradata al primo
  colpo, che sparisce al primo reload: è **atteso**, è coperto dalla Fase 10, e va scritto nel README
  perché altrimenti sembra un difetto.
  *Verifica*: `npm run dev` dalla radice avvia **tre** processi etichettati.

- [ ] 11.3 🔴 **Il diff sui file preesistenti è quello dichiarato, e nient'altro.**
  *Verifica* (spec `sito-pubblico` → *La radice cambia di due righe e non di più*, *Il rollback è la
  rimozione di una cartella*): `git diff --stat` fuori da `sito/` tocca **`package.json` di radice**
  (due righe: una aggiunta, una modificata) e — se il task 2.2 ha concluso che serviva —
  **`backend/.gitignore`** (una riga). Nessun terzo file. Se `backend/.gitignore` è risultato
  superfluo perché `*.pem` già copriva il caso, **il rollback tocca un file solo** e la divergenza
  n. 15 del design va corretta.

**Uscita di fase.** Un comando solo avvia tutto, e il costo sul repository esistente è **due righe in
un file** (più eventualmente una riga in un secondo).

---

## Fase 12 — Chiusura: le prove che nessun test farà, e i criteri ripercorsi

**Perché esiste.** Cinque verifiche di questo change **richiedono un browser vero** e non si
automatizzano in questa fase — l'automazione dell'audit e della regressione visiva è Fase 7 del
progetto. Se non hanno un task proprio, non verranno fatte: verranno *dichiarate fatte* per
somiglianza, che è il modo in cui un criterio di successo smette di significare qualcosa.

- [ ] 12.1 **`sito/README.md` — stesura finale, con le cinque verifiche manuali e come eseguirle.**
  Assenza di FOUC, misura del contrasto, indipendenza dal fuso orario, immagini che caricano davvero,
  zero richieste ai domini dei font.
  *Verifica* (spec `sito-pubblico` → *L'elenco manuale è scritto*): il README elenca le cinque
  verifiche **con il modo di eseguirle**, non solo con il loro nome.

- [ ] 12.2 🔴 🧪 **Build SSR reale, non solo `npm run dev`.**
  **Cosa eseguire**: `cd sito && npm run build && node dist/server/entry.mjs`, poi apri **entrambe**
  le pagine.
  **Cosa documentare**: che il bundle serve `/` e `/menu`, e qualunque differenza rispetto al dev
  server. I due falliscono in modi diversi, e **la Fase 6 spedirà il secondo**.
  *Verifica* (spec `sito-pubblico` → *Build e avvio del bundle*; proposal §Success Criteria): le due
  pagine rispondono dal bundle di produzione.

- [ ] 12.3 🔴 🧪 **Nessun FOUC, in condizioni sfavorevoli.**
  **Cosa eseguire**: **dieci** hard reload con **cache disabilitata** e **throttling di rete**, su
  **entrambi** i temi, partendo da **ognuno dei tre stati** del toggle.
  **Cosa documentare**: il numero di reload fatti per combinazione e l'esito. 🔴 **Un solo lampo
  bianco all'apertura in tema sera fa fallire il criterio** — non "quasi mai" e non "solo la prima
  volta".
  *Verifica* (spec `temi-e-identita` → *🔴 Dieci hard reload in tema sera*, *Nessun lampo dai tre
  stati del selettore*): nessun lampo, in nessuna delle combinazioni.

- [ ] 12.4 🔴 🧪 **Contrasto misurato, non stimato, sui due temi.**
  **Cosa eseguire**: strumento di accessibilità del browser su `/` e `/menu`, in **entrambi** i temi.
  **Cosa documentare**: le coppie testo/sfondo misurate e i loro valori; nessuna sotto 4.5:1 (3:1 per
  il testo grande). 🔴 In particolare: **nessun testo arancione sul tema giorno**, verificato
  **ispezionando gli elementi** che usano quel token — non leggendo il CSS, che il task 4.8 ha già
  letto.
  *Verifica* (spec `temi-e-identita` → *Contrasto misurato sul rendering*, *Le chiamate all'azione
  passano in entrambi i registri*): le CTA passano in **entrambi** i registri — oliva pieno con testo
  crema di giorno, arancio o giallo pieno con testo lavagna di sera.

- [ ] 12.5 🧪 **Confronto visivo dei due temi, affiancati.** Le stesse due pagine, negli stessi punti,
  nei due registri.
  **Cosa documentare**: che i due registri sono **due momenti della giornata** e non due preferenze —
  cioè che la lavagna non è "la home in dark mode" — e qualunque punto in cui uno dei due si legge
  peggio dell'altro. È l'unico controllo che nessuna misura sostituisce.
  *Verifica* (proposal §Success Criteria; design.md §D6, §D7): il confronto è stato **guardato** e
  il suo esito scritto. Se un punto stona, va aperto un debito con il suo nome — non chiuso qui con
  un aggiustamento improvvisato, che sarebbe una decisione di design presa in fondo a un change.

- [ ] 12.6 🧪 **Il fuso del visitatore non cambia il tema.**
  **Cosa eseguire**: porta il fuso orario **di sistema** (o del profilo del browser) a un fuso
  lontano — es. `America/Los_Angeles` — e ricarica.
  **Cosa documentare**: che il tema **non cambia**. È l'unico modo di distinguere una lettura di
  `Europe/Rome` da un `new Date()` che **oggi darebbe lo stesso risultato**.
  *Verifica* (spec `temi-e-identita` → *Il fuso del visitatore non cambia il tema*).

- [ ] 12.7 🧪 **Il toggle sopravvive al reload — giro completo.** giorno → sera → auto, con **un
  reload dopo ogni stato**: la preferenza esplicita vince sull'ora, e "auto" vi ritorna.
  *Verifica* (spec `temi-e-identita` → *Giro completo dei tre stati con reload*): tre stati, tre
  reload, tre esiti corretti.

- [ ] 12.8 🧪 **Il logo segue il tema, e l'ispezione lo spiega.** Toggle con il logo visibile.
  **Cosa documentare**: che il segno resta leggibile su entrambi i fondi, e che l'ispezione mostra
  **`<svg>` e non `<img>`** — che è l'unica condizione in cui `currentColor` può funzionare, e quindi
  la **diagnosi** del perché funziona invece della sola constatazione.
  *Verifica* (spec `temi-e-identita` → *🔴 Il logo resta leggibile nei due temi*, *🔴 Il logo è
  inline nel DOM*; proposal §Success Criteria): entrambe le osservazioni sono state fatte nello
  **stesso** giro di toggle — la leggibilità senza l'ispezione non distingue un logo che funziona da
  uno che funziona per caso su un fondo che gli somiglia.

- [ ] 12.9 🔴 **Il backend e l'app di cassa sono invariati, alla lettera.**
  ```bash
  dotnet test backend/DuedGusto.Tests/DuedGusto.Tests.csproj -o /tmp/dued-test
  cd duedgusto && npm run ts:check && npm run lint && npm run test
  ```
  🔧 L'opzione `-o` serve perché il backend in esecuzione dell'utente tiene bloccata `bin/`.
  *Verifica* (spec `sito-pubblico` → *Il backend è invariato alla lettera*, *La suite del backend
  passa senza che un test sia stato toccato*, *L'app di cassa è invariata*): `git diff --stat
  0221ddf..HEAD -- backend/ duedgusto/` è **vuoto** salvo `backend/.gitignore`, se il task 2.2 lo ha
  toccato; le quattro suite passano **senza che un solo file di test sia stato modificato**.

- [ ] 12.10 🔴 **L'infrastruttura è invariata.**
  *Verifica* (spec `sito-pubblico` → *L'infrastruttura è invariata*): `git diff --stat 0221ddf..HEAD
  -- deploy/ docker-compose.yml .github/` è **vuoto**. ⚠️ Il confronto parte da **`0221ddf`**, la
  base di *questo* change: nella storia del progetto esiste già un commit di `deploy/` che non
  appartiene ad alcun change della vetrina, e far partire il confronto da più indietro produrrebbe
  una lettura sbagliata.

- [ ] 12.11 **Nessun modulo del repository importa `sito/`.**
  *Verifica* (spec `sito-pubblico` → *Nessun riferimento in ingresso*): `grep -rn "sito/"
  backend/ duedgusto/ deploy/ .github/` non trova alcun import né alcun percorso di build. Il
  rollback è `rm -rf sito/` **perché nulla ci punta**, non per intenzione.

- [ ] 12.12 **Le dieci verifiche automatiche esistono, e nessun tooling di Fase 7 è entrato.**
  *Verifica* (spec `sito-pubblico` → *La suite gira senza dipendenze aggiunte*, *Le dieci verifiche
  esistono*, *Nessun tooling di Fase 7 anticipato*): ognuna delle dieci voci della tabella ha almeno
  un test corrispondente; `sito/package.json` non contiene alcun runner di test, framework di
  asserzioni, DOM simulato, automatore di browser o motore di audit. ⚠️ L'eventuale `@astrojs/check`
  del task 1.11 va **nominato** qui con la ragione per cui non ricade nel divieto — o rimosso, se il
  task 7.3 ha ripiegato sulla scansione.

- [ ] 12.13 **Conferma delle cinque Open Questions.** Annota in design.md la decisione presa:
  `--color-*` (esito osservato al task 4.11); prefisso `PUBLIC_` **tenuto**; `Astro.url.origin`
  **usato** e da riverificare in Fase 6; ripiego `og-default.jpg` **tenuto**; fascia "Aperitivo"
  come deciso al task 9.8.
  *Verifica*: le cinque voci risultano spuntate con la decisione effettivamente presa e, dove
  pertinente, con il **numero del task** che l'ha chiusa.

- [ ] 12.14 **Checklist dei 17 Success Criteria della proposal.** Ripercorrili uno per uno.
  *Verifica*: ogni criterio ha **il numero del task** che lo chiude o una prova eseguita che lo
  dimostra; ciò che resta aperto porta il nome di ciò che lo chiuderà — un criterio chiuso per
  somiglianza è un criterio non chiuso.

- [ ] 12.15 **Riepilogo delle ventisei prove 🧪.** Raccogli in un punto solo l'esito delle prove
  manuali e delle mutazioni. Le **undici** che dopo l'apply non saranno più eseguibili nelle stesse
  condizioni: 1.6, 1.7, 1.9, 2.6, 3.9, 4.9, 4.10, 6.8, 7.2, 8.8, 10.6. Le **quindici** di browser e
  di dati vivi: 5.8, 7.8, 8.6, 8.9, 9.3, 9.6, 9.7, 10.7 e 12.2-12.8.
  *Verifica*: per ognuna è scritto **cosa è diventato rosso e cosa è rimasto verde**. Una mutazione
  di cui non si sa quale test ha fatto fallire non ha dimostrato nulla — e questo elenco è l'unica
  traccia che ne resterà, perché nessuna di queste prove verrà rieseguita.

**Uscita di fase.** Le prove che nessun test farà sono state **eseguite** invece che argomentate, le
cinque Open Questions sono confermate per iscritto, i 17 criteri sono ripercorsi uno per uno, e
`backend/` e `duedgusto/` sono **byte per byte** come prima.
