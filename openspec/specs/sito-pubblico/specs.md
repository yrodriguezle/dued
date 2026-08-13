# Sito Pubblico Specification

**Domain**: sito-pubblico
**Status**: Active
**Ultimo aggiornamento**: 2026-08-13

Change incorporate in questa spec:

| Change | Archiviata il | Contenuto |
|--------|---------------|-----------|
| vetrina-sito-astro | 2026-08-13 | Spec iniziale del dominio: `sito/` progetto indipendente che nessun altro modulo importa, versioni dichiarate e non ereditate, configurazione esercitata, degrado dichiarato (`/` 200 degradata, `/menu` 503 con `Retry-After`), una pagina degradata non entra in cache, ciò che resta manuale è dichiarato |

## Purpose

Definire **cosa è il progetto `sito/`**: le versioni con cui nasce, l'ambiente in cui si sviluppa,
il comportamento HTTP delle sue due pagine quando il backend risponde e quando **non** risponde, e
il confine — verificabile con `git diff` — che lo separa da ogni altro modulo del repository.

Il dominio esiste separato perché il criterio che lo governa non è funzionale ma **ambientale**: la
maggior parte dei requisiti qui dentro non descrive cosa vede un visitatore, ma **cosa deve
fallire, e dove, quando la configurazione è sbagliata**. Una versione dichiarata che non impedisce
l'installazione sbagliata, un `Cache-Control` corretto solo nel caso felice, un tag non chiuso che
il compilatore accetta: sono tutte forme dello stesso guasto — una dichiarazione che nessuno
applica.

Vale qui il principio che il design del change enuncia una volta per tutte
([design.md](../../changes/archive/2026-08-13-vetrina-sito-astro/design.md)):

> **Non basta che il codice sia giusto: deve esistere una configurazione in cui quello sbagliato
> fallisce.**

**Fuori scope in questa spec**: i due prefissi e il consumo delle rotte (spec
[`consumo-api-pubblica`](../consumo-api-pubblica/specs.md)); i due temi, i font e gli asset di marca
(spec [`temi-e-identita`](../temi-e-identita/specs.md)); il markup delle immagini (spec
[`immagini-vetrina`](../immagini-vetrina/specs.md)).

**Fuori scope in questa fase** (rinviato, non cancellato): contenuti editoriali da CMS e JSON-LD
completo, `@astrojs/sitemap`, canonical assoluti (Fase 3); prenotazioni (Fase 4); eventi e
promozioni (Fase 5); `Dockerfile`, servizio `sito` in `docker-compose.yml`, server block nginx,
micro-cache, CI e go-live (Fase 6); Lighthouse, audit AA completo e analytics (Fase 7).

**Stato verificato del repository prima della change**: `sito/` **non esiste** — la radice contiene
`backend/`, `duedgusto/`, `deploy/`, `docs/`, `openspec/` e nient'altro di eseguibile; il
`package.json` di radice ha `dev`, `dev:frontend` e `dev:backend`, e il `concurrently` di `dev`
lancia **due** processi; `duedgusto/package.json` dichiara `tailwindcss` e `@tailwindcss/vite`
entrambi `^4.2.1`; `backend/Properties/launchSettings.json` ha due profili sulla **stessa** porta
4000, `http` e `https`, e la radice lancia il secondo; le tre rotte pubbliche
(`/api/public/site`, `/menu`, `/galleria`) esistono, sono anonime e sono già provate con `curl`.

---

## Dominio: Il confine del progetto

### Requirement: 🔴 `sito/` è un progetto indipendente e nessun altro modulo cambia

Il change MUST creare `sito/` a pari livello di `backend/` e `duedgusto/`, con un `package.json`
**proprio** e senza introdurre workspaces.

Il change MUST NOT modificare alcun file sotto `backend/` — nessun controller, nessun DTO, nessuna
migrazione, nessun seed — con **la sola eccezione** di una riga di `.gitignore` per la cartella del
certificato di sviluppo esportato. Il contratto pubblico che il sito consuma è già completo e la
policy CORS dedicata al browser è già registrata e già applicata: non esiste alcuna riga di backend
che questo change abbia bisogno di scrivere.

Il change MUST NOT modificare alcun file sotto `duedgusto/`. In particolare MUST NOT estrarre in un
pacchetto condiviso la composizione degli URL dei media: l'admin ha **un** prefisso, il sito ne ha
**due**, e una utility comune imporrebbe al sito la forma che vale per l'admin — che è la forma
sbagliata (spec `consumo-api-pubblica`).

Il change MUST NOT modificare alcun file sotto `deploy/`, né `docker-compose.yml`, né `.github/`:
container, nginx, CI e versioning action sono Fase 6.

Il change MUST NOT modificare `docs/brand/**`, che è il **master** del marchio: il sito ne prende
copia di un sottoinsieme. È la ragione per cui rimuovere `sito/` non fa perdere alcun asset.

Le **sole** modifiche a file preesistenti MUST essere due: `dev:sito` nel `package.json` di radice
(con il suo inserimento nel `concurrently` di `dev`) e una riga di `.gitignore` per la cartella del
certificato.

⚠️ Il confronto `git diff` MUST partire dalla base **di questo change**, non dall'ultimo commit del
change precedente: nella storia del progetto esiste già un commit di `deploy/` che non appartiene ad
alcun change della vetrina, e farlo partire da lì produrrebbe una lettura sbagliata.

#### Scenario: Il backend è invariato alla lettera

- GIVEN il repository alla fine della change
- WHEN si esegue `git diff --stat` su `backend/` dalla base del change a `HEAD`
- THEN l'unico file elencato è quello di `.gitignore` che aggiunge la cartella del certificato
- AND nessun controller, DTO, modello, migrazione o file di test compare nel diff

#### Scenario: La suite del backend passa senza che un test sia stato toccato

- GIVEN il repository alla fine della change
- WHEN si esegue la suite di test del backend
- THEN passa
- AND `git diff` non elenca alcun file sotto la cartella dei test del backend

#### Scenario: L'app di cassa è invariata

- GIVEN il repository alla fine della change
- WHEN si esegue `git diff --stat` su `duedgusto/`
- THEN è vuoto
- AND il controllo dei tipi, il lint e i test del frontend passano

#### Scenario: L'infrastruttura è invariata

- GIVEN il repository alla fine della change
- WHEN si esegue `git diff --stat` su `deploy/`, `docker-compose.yml` e `.github/`
- THEN è vuoto

#### Scenario: Il master del marchio non viene modificato

- GIVEN gli asset di marca copiati in `sito/`
- WHEN si esegue `git diff --stat` su `docs/brand/`
- THEN è vuoto
- AND i file copiati in `sito/` esistono in entrambi i posti

#### Scenario: La radice cambia di due righe e non di più

- GIVEN il `package.json` di radice alla fine della change
- WHEN se ne ispezionano gli script
- THEN esiste `dev:sito`
- AND `dev` lo lancia insieme a backend e frontend
- AND nessun'altra voce del file è cambiata

#### Scenario: Il rollback è la rimozione di una cartella

- GIVEN il repository alla fine della change
- WHEN si rimuove `sito/`, si tolgono le due righe dal `package.json` di radice e la riga di
  `.gitignore`
- THEN backend, app di cassa, deploy e CI si comportano esattamente come prima della change
- AND nessun dato del database è stato scritto o alterato in alcun momento

### Requirement: Nessun modulo del repository importa `sito/`

Nessun file di `backend/`, `duedgusto/`, `deploy/` o `.github/` MUST fare riferimento a `sito/`.
La dipendenza è unidirezionale e **debole**: il sito conosce tre URL, e null'altro conosce il sito.

#### Scenario: Nessun riferimento in ingresso

- GIVEN il repository alla fine della change
- WHEN si cerca la stringa `sito/` fuori da `sito/`, dalla riga di `dev:sito` e dalla
  documentazione di questo change
- THEN non esiste alcun import, alcun percorso di build e alcuna configurazione che la nomini

---

## Dominio: Le versioni sono dichiarate, e la macchina sbagliata si rifiuta

### Requirement: 🔴 Le versioni di Astro e di Node sono dichiarate, non ereditate da un comando

`sito/package.json` MUST dichiarare `astro` a `~7.2.1` e `@astrojs/node` a `~11.1.1`, e MUST
dichiarare `engines.node` a `>=22.12.0`.

Le versioni MUST usare la tilde e non il caret: un minor di Astro può cambiare il comportamento del
dev server o dell'adapter, e in questa fase non esiste ancora una suite di regressione visiva che
raccolga il pezzo (è Fase 7). Un pin esatto MUST NOT essere usato: escluderebbe anche le patch di
sicurezza, che vanno prese.

L'adapter MUST essere quello **della 7** (`11.x`, che dichiara `astro ^7.0.0` fra le peer): il
`10.x` è l'adapter della 6 e non si installa insieme alla 7. È il primo errore che si incontra
copiando una configurazione trovata in rete, perché la maggior parte è ancora della generazione
precedente.

Il progetto MUST essere creato a mano e MUST NOT essere generato da `npm create astro@latest`, che
installerebbe la versione corrente **al momento del comando** — cioè un numero che nessuno ha
scelto — e porterebbe pagine e stili di esempio che nessuno rimuove mai del tutto.

`sito/.nvmrc` MUST esistere e MUST dichiarare `22`, perché "quale Node" sia una domanda con
risposta nel repository.

#### Scenario: Le versioni sono scritte e sono quelle decise

- GIVEN `sito/package.json`
- WHEN se ne leggono le dipendenze
- THEN `astro` è dichiarato con la tilde alla `7.2.1`
- AND `@astrojs/node` è dichiarato con la tilde alla `11.1.1`
- AND `engines.node` è `>=22.12.0`

#### Scenario: L'adapter è quello della generazione installata

- GIVEN le dipendenze di `sito/`
- WHEN si confrontano le peer dependency dell'adapter con la versione di Astro
- THEN l'adapter dichiara compatibilità con la generazione 7
- AND non è la versione `10.x`, che appartiene alla generazione precedente

#### Scenario: Il progetto non contiene residui di un template

- GIVEN `sito/` alla fine della change
- WHEN se ne enumerano i file
- THEN non esiste alcuna pagina, componente o foglio di stile di esempio non richiesto da questa
  spec

#### Scenario: La versione di Node ha una risposta nel repository

- GIVEN un nuovo sviluppatore che clona il repository
- WHEN apre `sito/.nvmrc`
- THEN vi legge `22`

### Requirement: 🔴 `engine-strict` trasforma la dichiarazione in un vincolo

`sito/.npmrc` MUST contenere `engine-strict=true`.

Senza quella riga il campo `engines` è **advisory**: npm avvisa e installa lo stesso, e il guasto si
manifesta più tardi e altrove — un errore di sintassi dentro `node_modules` durante `astro dev`,
che nessuno collega alla versione di Node. Il criterio non si soddisfa scrivendo un numero: si
soddisfa quando la macchina sbagliata **si rifiuta di installare**.

**Verifica per mutazione**: rimuovendo `.npmrc`, l'installazione su una macchina con Node 20 MUST
tornare a riuscire — ed è precisamente la dimostrazione che il file non è decorativo.

#### Scenario: 🔴 Installazione su una macchina con Node inferiore al minimo

- GIVEN una macchina con Node `20.19.0`
- WHEN si esegue l'installazione delle dipendenze in `sito/`
- THEN fallisce
- AND il messaggio di errore nomina la versione di Node richiesta

#### Scenario: Installazione su una macchina conforme

- GIVEN una macchina con Node `22.12.0` o superiore
- WHEN si esegue l'installazione delle dipendenze in `sito/`
- THEN completa senza errori di engine

#### Scenario: Controprova — senza `.npmrc` la macchina sbagliata installerebbe

- GIVEN `sito/` senza il file `.npmrc`
- WHEN si esegue l'installazione su una macchina con Node `20.19.0`
- THEN l'installazione riesce e stampa solo un avviso
- AND l'errore si manifesterebbe soltanto al primo avvio del dev server

### Requirement: 🔴 Il floor di `@tailwindcss/vite` è `^4.2.2` e non si abbassa

`sito/package.json` MUST dichiarare `tailwindcss` e `@tailwindcss/vite` con floor **`^4.2.2`**, e
MUST NOT dichiararli `^4.2.1` per simmetria con `duedgusto/`.

La ragione è misurabile e non estetica: la generazione 7 di Astro gira su **Vite 8**, e
`@tailwindcss/vite@4.2.1` dichiara fra le peer `vite ^5.2.0 || ^6 || ^7` — **senza Vite 8**. Il
range `^4.2.1` risolverebbe comunque a una versione buona, ma dichiarerebbe una compatibilità che
il suo estremo inferiore non ha: il giorno in cui un lockfile o un'installazione preferenzialmente
offline inchiodasse `4.2.1`, il guasto sarebbe un errore di peer dependency di Vite che nessuno
collegherebbe a quella riga.

Il `package.json` MUST portare, accanto alla dipendenza, il commento che dice **perché** il numero
è diverso da quello di `duedgusto/` e **cosa rompe** chi lo abbassa. `duedgusto/` gira su Vite 6 e
non ha alcun motivo di alzare il proprio floor: **stesso pacchetto, due minimi diversi, per due
ragioni entrambe corrette**.

È la trappola dei tre `package.json` senza workspaces — accettata come previsione dalla proposal —
che si avvera il **primo giorno**, con una causa precisa invece che come profezia.

**Verifica per mutazione**: abbassare il floor a `^4.2.1` e forzare la risoluzione all'estremo
inferiore MUST far fallire la build con un errore di peer dependency su Vite. Un test che si
limitasse a verificare che la build passa con la risoluzione normale resterebbe verde.

#### Scenario: 🔴 Il floor dichiarato è quello che garantisce Vite 8

- GIVEN `sito/package.json`
- WHEN si leggono le versioni di `tailwindcss` e `@tailwindcss/vite`
- THEN entrambe hanno floor `4.2.2` o superiore
- AND non sono `4.2.1`

#### Scenario: 🔴 Un riallineamento delle versioni del monorepo non può abbassarlo in silenzio

- GIVEN qualcuno che allinea "le versioni di Tailwind del monorepo" portando `sito/` a `^4.2.1`
- WHEN si esegue la verifica automatica del progetto
- THEN una verifica fallisce nominando il floor e la ragione (Vite 8)
- AND il guasto non si manifesta soltanto come un errore di peer dependency incomprensibile

#### Scenario: La ragione è scritta accanto al numero

- GIVEN la dipendenza di Tailwind in `sito/package.json`
- WHEN se ne legge il commento adiacente
- THEN dichiara che Astro 7 gira su Vite 8
- AND dichiara che `4.2.1` non lo supporta
- AND avverte esplicitamente chi volesse riallineare il monorepo

#### Scenario: `duedgusto/` non viene toccato per simmetria

- GIVEN `duedgusto/package.json`
- WHEN se ne leggono le versioni di Tailwind alla fine della change
- THEN sono ancora `^4.2.1`
- AND il file non compare nel diff della change

### Requirement: La configurazione di Astro contiene ciò che serve e nulla che non sia esercitato

`sito/astro.config.mjs` MUST dichiarare il rendering server-side, l'adapter Node in modalità
standalone, il plugin Vite di Tailwind, l'host di ascolto, la porta `4321` e lo schema delle
variabili d'ambiente (spec `consumo-api-pubblica`).

La configurazione MUST NOT dichiarare, in questa fase:

| Assente | Perché |
|---|---|
| l'URL del sito | Il dominio non esiste: un valore inventato produrrebbe canonical e anteprime social verso un host inesistente. Fase 3/6 |
| l'integrazione React | Nessuna isola in questo change. Una dipendenza installata e non usata è una dipendenza che nessuno verifica |
| l'integrazione sitemap | Ha bisogno dell'URL del sito, e la SEO è Fase 3 |
| regole di rotta dichiarative per la cache | La politica di cache di questo sito è **condizionale sullo stato**, e una forma statica per rotta creerebbe **due** posti che scrivono lo stesso header |
| una cache in memoria di piattaforma | Duplicherebbe il micro-cache che nascerà in Fase 6, in un processo che il deploy riavvia |
| un gestore di log strutturati | Candidato di Fase 6, quando i log saranno quelli di un container e non di un terminale |

Nessuna delle due pagine MUST dichiarare la direttiva di prerendering: con il rendering
server-side l'on-demand è già il default, ed entrambe leggono dati vivi. La direttiva nasce con la
prima pagina statica, che è Fase 3.

#### Scenario: La configurazione dichiara i quattro pezzi necessari

- GIVEN `sito/astro.config.mjs`
- WHEN se ne leggono le opzioni
- THEN dichiara il rendering server-side
- AND dichiara l'adapter Node in modalità standalone
- AND registra il plugin Vite di Tailwind
- AND dichiara lo schema delle variabili d'ambiente

#### Scenario: Nessuna dipendenza installata e non esercitata

- GIVEN le dipendenze di `sito/`
- WHEN se ne enumerano i pacchetti
- THEN non compaiono né l'integrazione React né quella della sitemap

#### Scenario: Un solo punto scrive l'header di cache

- GIVEN la configurazione e le due pagine
- WHEN si cercano i punti che impostano `Cache-Control`
- THEN esiste soltanto la scrittura imperativa nelle pagine
- AND non esiste alcuna regola di rotta dichiarativa che scriva lo stesso header

#### Scenario: Nessuna direttiva di prerendering

- GIVEN le due pagine consegnate dalla change
- WHEN se ne ispezionano i frontmatter
- THEN nessuna dichiara la direttiva di prerendering

### Requirement: Il bundle di produzione si costruisce e serve entrambe le pagine

`npm run build` MUST produrre un bundle server-side, e l'avvio dell'entrypoint prodotto MUST
servire entrambe le pagine. La verifica MUST NOT limitarsi al dev server: il server di sviluppo e
il bundle di produzione falliscono in modi diversi, e la Fase 6 spedirà il secondo.

#### Scenario: Build e avvio del bundle

- GIVEN il progetto con le dipendenze installate e il backend in ascolto
- WHEN si esegue la build e poi si avvia l'entrypoint prodotto
- THEN `/` risponde `200`
- AND `/menu` risponde `200`

---

## Dominio: Astro 7 — le tre conseguenze che toccano questo change

### Requirement: 🔴 Ogni void element è scritto auto-chiuso

Nella generazione 7 il compilatore è unico ed è più severo sull'HTML non valido: i tag non chiusi
sono **errori** di build e l'HTML semanticamente invalido non viene più auto-corretto.

Ogni void element scritto nei componenti — in particolare gli elementi `source` del `<picture>`
(spec `immagini-vetrina`) e gli elementi `link` del `<head>`, incluso il preload del font (spec
`temi-e-identita`) — MUST essere scritto in forma auto-chiusa.

È un miglioramento e va detto come tale: prima l'errore era **silenzioso**.

⚠️ L'inserimento di markup come **stringa di runtime** (il logo inline) non è toccato da questa
regola: non è markup compilato.

#### Scenario: 🔴 Un void element non chiuso fa fallire la build

- GIVEN un componente in cui un elemento `source` è scritto senza chiusura
- WHEN si esegue la build
- THEN fallisce con un errore che nomina il file e la posizione
- AND non produce un bundle

#### Scenario: Gli elementi del `<picture>` e del `<head>` sono auto-chiusi

- GIVEN i componenti dell'immagine e del layout di base
- WHEN se ne ispeziona il sorgente
- THEN ogni elemento `source`, `link`, `meta` e `img` è scritto in forma auto-chiusa

#### Scenario: L'SVG inserito come stringa non è soggetto alla regola

- GIVEN il componente che inserisce l'SVG del logo come contenuto di runtime
- WHEN si esegue la build
- THEN riesce
- AND il contenuto dell'SVG non viene validato dal compilatore dei template

### Requirement: `src/fetch.ts` è un nome riservato e non ospita il modulo API

Nella generazione 7 `src/fetch.ts` è un nome **riservato**: viene auto-importato come
configurazione del routing. Il modulo che legge le rotte pubbliche MUST vivere in `src/lib/api.ts`
e il progetto MUST NOT contenere un file `src/fetch.ts`.

Va scritto **prima** che a qualcuno venga in mente di "semplificare" spostandolo: il file non
darebbe un errore, diventerebbe un'altra cosa.

#### Scenario: Il modulo API vive dove deve

- GIVEN i sorgenti di `sito/`
- WHEN si cerca il modulo che legge le rotte pubbliche
- THEN si trova in `src/lib/api.ts`

#### Scenario: Il nome riservato non è occupato

- GIVEN i sorgenti di `sito/`
- WHEN si verifica l'esistenza di `src/fetch.ts`
- THEN il file non esiste

### Requirement: Le asserzioni sull'HTML servito sono ricerche di sottostringa

Nella generazione 7 la compressione dell'HTML in modalità JSX è il **default**. La compressione è
deterministica — quindi l'identità byte per byte fra due risposte regge (spec `temi-e-identita`) —
ma il markup servito non ha più l'indentazione su cui si sarebbe tentati di asserire.

Ogni verifica automatica sull'HTML servito MUST essere una **ricerca di sottostringa** o una
espressione regolare su di essa, e MUST NOT confrontare righe, indentazione o spaziatura.

Il progetto MUST NOT riconfigurare la compressione per rendere possibile un'asserzione: sarebbe
cambiare l'output per comodità del test.

#### Scenario: Le verifiche sull'HTML cercano sottostringhe

- GIVEN i test che ispezionano l'HTML servito
- WHEN se ne leggono le asserzioni
- THEN ciascuna cerca la presenza o l'assenza di una sottostringa
- AND nessuna confronta indentazione, numero di righe o spaziatura

#### Scenario: La compressione resta quella di default

- GIVEN `sito/astro.config.mjs`
- WHEN se ne leggono le opzioni
- THEN non contiene alcuna riconfigurazione della compressione dell'HTML

---

## Dominio: L'ambiente di sviluppo

### Requirement: 🔴 Il certificato del backend di sviluppo si accetta aggiungendo la CA, mai disattivando la verifica

Il backend di sviluppo ascolta in HTTPS con un certificato self-signed, che una `fetch` da Node
rifiuta. La lettura server-side delle rotte MUST funzionare **senza disattivare la verifica dei
certificati**: si aggiunge un'autorità di certificazione all'ambiente di sviluppo, che è
esattamente ciò che quel certificato è.

Il progetto MUST NOT contenere, in alcun file versionato e in alcun ramo condizionale:

- l'impostazione globale che disattiva il rifiuto dei certificati non autorizzati;
- un agente HTTP configurato per non verificare il certificato, nemmeno se limitato alla sola
  chiamata verso il backend e nemmeno se protetto da una condizione sull'ambiente di sviluppo.

La seconda forma è **migliore** della prima e va comunque rifiutata: resta codice versionato che
spegne TLS, e chi lo legge fra sei mesi vede la riga senza sapere più quale condizione la
protegga.

⚠️ La variabile che indica la CA aggiuntiva MUST essere impostata **nell'ambiente prima che Node
parta**, e MUST NOT essere scritta in un file `.env`: Node la legge all'avvio del processo, prima
che il framework carichi qualunque `.env`. Scriverla lì produce un file che sembra configurato e un
fallimento di `fetch` **senza causa**. È la ragione per cui `npm run dev` MUST passare per uno
script di avvio invece di invocare direttamente il dev server.

⚠️ Il certificato di sviluppo ha `localhost` come **solo** SAN: il prefisso con cui il server legge
le rotte MUST essere esattamente `https://localhost:4000`; con l'indirizzo numerico equivalente la
verifica fallisce lo stesso, e sembrerebbe che la CA non funzioni. Il vincolo MUST essere scritto
nel file di esempio delle variabili, accanto al valore.

La cartella del certificato esportato MUST essere ignorata dal controllo di versione: è un artefatto
**di macchina**, non del repository.

#### Scenario: 🔴 La lettura server-side funziona con la verifica TLS attiva

- GIVEN il backend di sviluppo in ascolto in HTTPS con il certificato di sviluppo e il PEM esportato
- WHEN si avvia il sito con lo script di avvio e si apre una pagina
- THEN la lettura delle rotte pubbliche riesce
- AND in nessun punto del processo la verifica dei certificati è disattivata

#### Scenario: 🔴 Nessuna disattivazione della verifica nei sorgenti

- GIVEN i sorgenti e i file di configurazione di `sito/`
- WHEN si cerca l'impostazione globale che disattiva il rifiuto dei certificati e la creazione di
  agenti HTTP che non verificano il certificato
- THEN non esiste alcuna occorrenza
- AND non ne esiste nemmeno una protetta da una condizione sull'ambiente di sviluppo

#### Scenario: ⚠️ La variabile della CA non è letta da `.env`

- GIVEN la variabile della CA aggiuntiva scritta **soltanto** in un file `.env`
- WHEN si avvia il sito e si apre una pagina
- THEN la lettura delle rotte fallisce
- AND è la ragione per cui la variabile viene impostata dallo script di avvio prima dello spawn

#### Scenario: Il certificato mancante produce un'istruzione, non un errore muto

- GIVEN una macchina su cui il certificato PEM non è stato ancora esportato
- WHEN si avvia il sito
- THEN lo script stampa il comando esatto da eseguire per esportarlo
- AND non lascia che il primo tentativo di lettura fallisca senza spiegazione

#### Scenario: L'host del prefisso API rispetta il SAN del certificato

- GIVEN il file di esempio delle variabili d'ambiente
- WHEN se ne legge il prefisso con cui il server legge le rotte
- THEN è l'host `localhost`
- AND accanto è scritto che l'indirizzo numerico equivalente farebbe fallire la verifica

#### Scenario: Il certificato esportato non entra nel repository

- GIVEN la cartella in cui viene esportato il PEM
- WHEN si verifica lo stato del controllo di versione
- THEN la cartella è ignorata
- AND nessun file di certificato compare fra quelli tracciati

### Requirement: La via d'uscita in chiaro è dichiarata insieme al suo costo

Se il certificato desse problemi (rinnovo, macchina nuova, ambiente virtualizzato), il repository
offre già un profilo di avvio del backend in chiaro sulla stessa porta, e il sito MAY essere
configurato per usarlo.

⚠️ Il costo MUST essere dichiarato dove la via d'uscita è documentata: in quella modalità il
refresh token dell'app di cassa è un cookie che richiede una connessione sicura, quindi **l'app di
cassa non fa login**. È una sessione "solo vetrina", non una configurazione alternativa permanente.

#### Scenario: La via d'uscita è documentata con il suo effetto collaterale

- GIVEN il README di `sito/`
- WHEN si legge la sezione sull'avvio del backend
- THEN descrive il profilo in chiaro come ripiego
- AND dichiara che in quella modalità l'app di cassa non completa il login

---

## Dominio: Le due pagine e i loro dati

### Requirement: Le due pagine leggono dati vivi e non contengono dati scritti a mano

`/` e `/menu` MUST leggere il proprio contenuto dalle rotte pubbliche a ogni richiesta.

Nessun orario, prezzo, nome di prodotto, indirizzo o recapito MUST essere scritto nei template. In
particolare l'orario di chiusura MUST NOT comparire in alcun sorgente di `sito/`: è la garanzia
strutturale già dimostrata dal change precedente, e il modo di verificarla è una ricerca testuale,
non una lettura.

I testi editoriali (slogan, titoli di sezione, microcopy) MAY essere scritti nei template in questa
fase: la loro migrazione a CMS è precisamente il lavoro della Fase 3.

#### Scenario: Nessun orario nei sorgenti

- GIVEN i sorgenti di `sito/`
- WHEN si cerca la stringa dell'orario di chiusura del locale
- THEN non esiste alcuna occorrenza

#### Scenario: Gli orari mostrati vengono dall'API

- GIVEN il locale con un orario di chiusura impostato dalle impostazioni della cassa
- WHEN si modifica quell'orario dall'admin e si ricarica la home dopo il tempo di cache
- THEN la home mostra il nuovo orario
- AND ripristinando il valore precedente la home torna a mostrare quello

#### Scenario: La home mostra una selezione viva, non una lista scritta a mano

- GIVEN un prodotto marcato come consigliato che compare nella striscia della home
- WHEN un amministratore toglie il marcatore dall'admin
- THEN entro il tempo di cache il prodotto sparisce dalla home

#### Scenario: Il menu corrisponde uno per uno alla risposta dell'API

- GIVEN il backend in ascolto con i prodotti reali del locale
- WHEN si confronta `/menu` renderizzata con la risposta della rotta del menu
- THEN ogni categoria e ogni prodotto della risposta compare nella pagina
- AND nessun prodotto compare nella pagina senza essere nella risposta

### Requirement: Nessun campo contabile o interno compare nell'HTML servito

L'HTML servito MUST NOT contenere codici articolo, aliquote IVA, categorie contabili, unità di
misura né alcun altro campo che il contratto pubblico non possiede.

Il contratto pubblico non li espone: il requisito verifica quindi che il sito non li abbia presi da
**altrove**.

#### Scenario: Ricerca dei campi riservati nella pagina renderizzata

- GIVEN `/` e `/menu` servite dal bundle di produzione
- WHEN si cercano nei loro corpi i nomi dei campi contabili e interni
- THEN nessuno compare

### Requirement: 🔴 Il troncamento del menu è dichiarato al visitatore

La rotta del menu espone il totale dei prodotti pubblicati, il limite applicato e il flag di
troncamento **proprio perché il consumatore possa reagire**. Ignorarli riporterebbe esattamente il
guasto silenzioso che il change precedente ha speso un criterio a evitare.

| Campo | Cosa ne fa il sito |
|---|---|
| flag di troncamento vero | `/menu` MUST mostrare, in coda al listino, un avviso leggibile al visitatore, e MUST scrivere una riga sullo stdout del processo |
| limite applicato | MUST comparire **nel testo dell'avviso**, letto dalla risposta e MUST NOT essere una costante del sito |
| totale dei prodotti pubblicati | Idem: è l'unico modo in cui il visitatore sa **quanto** manca |
| elenco delle categorie vuoto | Stato **legittimo** (nessun prodotto pubblicato): messaggio dichiarato, MUST NOT essere una pagina bianca e MUST NOT essere un `503` — è diverso dal dato non arrivato |

🔴 L'avviso MUST NOT stare dietro un flag di sviluppo e MUST NOT essere un solo messaggio di
console: il visitatore è l'unico che può reagire, chiedendo in cassa.

`/` MUST NOT mostrare l'avviso di troncamento: la home espone per natura una **selezione**, non un
listino, quindi non promette completezza e un avviso lì sarebbe rumore.

⚠️ Conseguenza da conoscere e da non correggere di nascosto: con il menu troncato, un prodotto
consigliato oltre il limite **non compare in home**. Il rimedio è l'ordinamento di vetrina, che
l'admin già possiede.

#### Scenario: 🔴 Menu troncato

- GIVEN una risposta del menu che dichiara il troncamento, con limite applicato e totale
- WHEN un visitatore apre `/menu`
- THEN in coda al listino compare un avviso leggibile
- AND l'avviso contiene sia il limite applicato sia il totale, letti dalla risposta
- AND una riga viene scritta sullo stdout del processo

#### Scenario: I due numeri non sono costanti del sito

- GIVEN i sorgenti di `sito/`
- WHEN si cerca il valore del limite applicato come costante
- THEN non esiste alcuna occorrenza
- AND il numero mostrato cambia se la risposta dichiara un limite diverso

#### Scenario: Menu non troncato

- GIVEN una risposta del menu che non dichiara il troncamento
- WHEN un visitatore apre `/menu`
- THEN nessun avviso di troncamento compare

#### Scenario: Nessun prodotto pubblicato

- GIVEN una risposta del menu con l'elenco delle categorie vuoto
- WHEN un visitatore apre `/menu`
- THEN la pagina risponde `200`
- AND mostra un messaggio dichiarato
- AND non è né una pagina bianca né un `503`

#### Scenario: La home non mostra l'avviso di troncamento

- GIVEN una risposta del menu che dichiara il troncamento
- WHEN un visitatore apre `/`
- THEN la striscia dei consigliati è mostrata
- AND nessun avviso di troncamento compare nella home

---

## Dominio: Degradazione quando il backend non risponde

### Requirement: 🔴 `/` risponde `200` degradata, `/menu` risponde `503` con `Retry-After`

In rendering server-side una lettura che fallisce nel frontmatter fa fallire la pagina: il
framework risponde `500` e in sviluppo mostra il proprio overlay di errore. È il comportamento
peggiore possibile per una vetrina, e la rete vera (riuso della risposta stantia dal proxy) arriva
solo in Fase 6.

Le due pagine MUST avere **tre** stati, non due:

| Pagina | dati del sito **e** menu presenti | sito presente, menu assente | sito assente |
|---|---|---|---|
| `/` | tutto | identità, orari e contatti; **niente striscia dei consigliati**, con un avviso al suo posto | marca, slogan e le tre parole dell'insegna; **avviso in testa**; niente orari, niente indirizzo, niente stato di apertura |
| `/menu` | tutto | **`503`** | **`503`** |

- `/` MUST rispondere **sempre** `200`. È l'URL che la gente digita e che i motori tengono in
  indice: un `5xx` sulla radice è un segnale forte e sproporzionato rispetto a un backend che non
  risponde per trenta secondi. E la pagina degradata **ha contenuto vero** — il marchio, lo slogan,
  le tre parole — perché quegli asset sono locali e non dipendono dall'API.
- `/menu` MUST rispondere **`503`** con header `Retry-After` e un corpo leggibile. La pagina esiste
  per un dato: senza quel dato una pagina `200` vuota sarebbe un **menu vuoto indicizzabile**,
  cioè la stessa classe di guasto silenzioso che il change precedente ha evitato.

Nessuna delle due pagine MUST mostrare la pagina di errore del framework né un `500` nudo.

#### Scenario: 🔴 Backend spento, apertura della home

- GIVEN il backend non in ascolto
- WHEN un visitatore apre `/`
- THEN la risposta è `200`
- AND la pagina mostra il marchio, lo slogan e le tre parole dell'insegna
- AND porta in testa un avviso dichiarato di contenuto incompleto
- AND non mostra orari, indirizzo né stato di apertura

#### Scenario: 🔴 Backend spento, apertura del menu

- GIVEN il backend non in ascolto
- WHEN un visitatore apre `/menu`
- THEN la risposta è `503`
- AND porta l'header `Retry-After`
- AND il corpo è una pagina leggibile e non l'errore del framework

#### Scenario: Fallimento parziale — il menu non risponde e il sito sì

- GIVEN la rotta del sito che risponde e quella del menu che fallisce
- WHEN un visitatore apre `/`
- THEN la risposta è `200`
- AND mostra orari, indirizzo e contatti veri
- AND al posto della striscia dei consigliati compare un avviso

#### Scenario: Nessun overlay del framework

- GIVEN il backend non in ascolto, in modalità di sviluppo
- WHEN si aprono `/` e `/menu`
- THEN nessuna delle due mostra l'overlay di errore del dev server

#### Scenario: Ogni degradazione lascia una traccia nei log

- GIVEN il backend non in ascolto
- WHEN si aprono le due pagine
- THEN per ogni lettura non riuscita una riga viene scritta sullo stdout del processo
- AND la riga nomina la rotta e il motivo

### Requirement: 🔴 Una pagina degradata non entra in cache

Le pagine MUST dichiarare la propria politica di cache **in funzione dello stato**:

| Stato | `Cache-Control` |
|---|---|
| dati presenti | `public, max-age=60` |
| home degradata (`200`) | `no-store` |
| menu non disponibile (`503`) | `no-store` |

Senza `no-store` il micro-cache di Fase 6 congelerebbe la pagina degradata per sessanta secondi
**dopo** che il backend è tornato su. Emettere l'header oggi è la stessa dottrina del change
precedente: dichiarare la politica dove nasce il dato, così che il proxy di domani sia corretto
senza una riga di configurazione per rotta.

**Verifica per mutazione**: togliere la scrittura di `no-store` dal ramo degradato MUST far fallire
lo scenario che interroga l'header con il backend spento. Un test che verificasse solo il caso
felice resterebbe verde.

#### Scenario: Cache dichiarata nello stato normale

- GIVEN il backend in ascolto
- WHEN si richiedono `/` e `/menu`
- THEN entrambe rispondono con `Cache-Control: public, max-age=60`

#### Scenario: 🔴 Cache negata nello stato degradato

- GIVEN il backend non in ascolto
- WHEN si richiede `/`
- THEN la risposta è `200`
- AND porta `Cache-Control: no-store`

#### Scenario: 🔴 Cache negata sulla risposta di indisponibilità

- GIVEN il backend non in ascolto
- WHEN si richiede `/menu`
- THEN la risposta è `503`
- AND porta `Cache-Control: no-store`

#### Scenario: La pagina degradata non resta congelata dopo il ripristino

- GIVEN una richiesta servita in stato degradato
- WHEN il backend torna in ascolto e si richiede di nuovo la stessa pagina
- THEN la risposta contiene i dati veri
- AND non è la copia della pagina degradata

---

## Dominio: Verifica

### Requirement: I test di `sito/` girano nel runtime, senza dipendenze nuove

Quattro decisioni di questo change si chiudono con "e un test lo scopre". Il progetto MUST quindi
avere test eseguibili con `npm test`, realizzati con il **runner e le asserzioni del runtime**, e
MUST NOT introdurre alcuna dipendenza di test.

Le verifiche automatiche MUST coprire almeno:

| Cosa | Come | Spec |
|---|---|---|
| Il modulo dell'ambiente server compare in un file solo | scansione dei sorgenti | `consumo-api-pubblica` |
| Il segmento del percorso dei media compare in un file solo | scansione dei sorgenti | `consumo-api-pubblica` |
| Nessun testo arancione, in nessuna forma | scansione dei sorgenti | `temi-e-identita` |
| Le utility di colore inlinano il token di runtime | espressione regolare sul CSS **generato** | `temi-e-identita` |
| La sintesi dei font è disattivata | idem | `temi-e-identita` |
| Il markup usa il prefisso media e mai quello API | build con host sentinella + richiesta al server di prova | `consumo-api-pubblica` |
| L'HTML non porta l'attributo di tema sul tag radice | richiesta + espressione regolare | `temi-e-identita` |
| Due richieste a distanza di un minuto → corpi identici | confronto binario | `temi-e-identita` |
| `Cache-Control` per stato, e i codici `200`/`503` | richieste con e senza backend | questa spec |
| Composizione dell'URL del media e dell'insieme di sorgenti | unitario puro | `immagini-vetrina` |

#### Scenario: La suite gira senza dipendenze aggiunte

- GIVEN `sito/package.json`
- WHEN se ne leggono le dipendenze di sviluppo
- THEN non contiene alcun runner di test, alcun framework di asserzioni e alcun DOM simulato
- AND `npm test` esegue comunque la suite

#### Scenario: Le dieci verifiche esistono

- GIVEN la cartella dei test di `sito/`
- WHEN si enumerano le verifiche
- THEN ognuna delle voci della tabella ha almeno un test corrispondente

### Requirement: Ciò che resta manuale è dichiarato, non dimenticato

Cinque verifiche richiedono un browser vero e MUST restare manuali in questa fase, dichiarate nel
README di `sito/`: assenza di FOUC, misura del contrasto, indipendenza dal fuso orario del
visitatore, immagini che caricano davvero, e assenza di richieste verso i domini dei font
esterni.

Il progetto MUST NOT introdurre in questa fase strumenti di automazione del browser, di audit di
accessibilità o di DOM simulato: l'automazione dell'audit e della regressione visiva è Fase 7, e
installarne il tooling ora significherebbe portarsi tre dipendenze pesanti esercitate da nessuno.

#### Scenario: L'elenco manuale è scritto

- GIVEN il README di `sito/`
- WHEN se ne legge la sezione di verifica
- THEN elenca le cinque verifiche manuali con il modo di eseguirle

#### Scenario: Nessun tooling di Fase 7 anticipato

- GIVEN le dipendenze di `sito/`
- WHEN se ne enumerano i pacchetti
- THEN non compare alcun automatore di browser, alcun motore di audit di accessibilità e alcun DOM
  simulato
