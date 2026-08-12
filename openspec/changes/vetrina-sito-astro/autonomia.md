# Autonomia: le regole della corsa senza l'utente (vetrina-sito-astro)

> **Chi legge questo file.** La sessione che esegue l'apply del change. Va letto **prima** del
> task 1.1 e riletto ogni volta che viene la tentazione di scrivere *"vuoi che proceda?"*.
>
> **Perché esiste.** `tasks.md` dice cosa fare e come dimostrarlo. Non dice cosa fare quando
> qualcosa non è scritto da nessuna parte — ed è lì che una corsa notturna si ferma a chiedere
> e perde otto ore. Questo file chiude quel buco: ogni domanda prevedibile ha già una risposta,
> e le domande imprevedibili hanno un protocollo che **non è fermarsi**.

---

## 1. Il mandato

Esegui le dodici fasi di `tasks.md` dalla 1 alla 12, in ordine, **senza chiedere conferma**.

"Senza conferma" ha un significato preciso, e sono tre divieti:

1. **Non chiedere il permesso di proseguire.** Non esiste un punto di questo change in cui la
   risposta giusta sia attendere. Se hai finito una fase, apri la successiva.
2. **Non chiedere di scegliere.** Ogni scelta prevedibile è già chiusa: nelle *otto risoluzioni*
   in cima a `tasks.md`, nelle *quindici divergenze* di `design.md`, nelle *cinque Open Questions*,
   e nel §2 qui sotto. Se credi di averne trovata una che manca, applica il §3 e vai avanti.
3. **Non chiedere se va bene così.** Il giudizio estetico è delegato a te (§2.6). Documenti e
   prosegui; l'utente guarda alla fine.

L'unica uscita legittima prima della fine è dichiarare un blocco (§4).

**Come si apre e si chiude la corsa.** L'hook `Stop` che impedisce l'uscita anticipata è inerte
finché non esiste il file `CORSA-ATTIVA` in questa cartella. Crealo come primo atto:

```bash
echo "avviata il $(date -I)" > openspec/changes/vetrina-sito-astro/CORSA-ATTIVA
```

Lo cancella l'hook stesso quando i task sono tutti spuntati, quando dichiari un blocco, o quando
tre turni consecutivi passano senza chiudere un solo task. L'utente può cancellarlo a mano in
qualunque momento: è il freno d'emergenza.

---

## 2. Le domande che non devi fare, e le loro risposte

### 2.1 Node ≥ 22.12 — il task 1.1 è chiuso

L'utente ha installato **Node 22.23.2** (LTS *Jod*, la stessa linea della CI:
`.github/workflows/deploy.yml` → `node-version: '22'`) dall'MSI ufficiale, **al posto** della 20.
`C:\Program Files\nodejs` contiene la 22, e sulla macchina non esiste più alcun Node 20.

Verificalo come primissima cosa, e non fidarti di `node -v` da solo:

```
npm version          # deve riportare  node: '22.23.2'
```

Se riportasse una 20.x, **non proseguire e non aggirarlo** abbassando `engines` o forzando
l'install: sarebbe un blocco vero, §4.

### 2.2 🔴 La finestra dei task 1.6 e 1.7 si è chiusa: NON eseguirli sul Node di sistema

`tasks.md` §1.1 avverte che le prove su Node 20 vanno fatte **prima** dell'aggiornamento. Non è
stato fatto: l'aggiornamento è avvenuto il 12 agosto 2026 con 1.6 e 1.7 ancora aperti. **Non c'è
più un Node 20 su questa macchina** — né in `C:\Program Files\nodejs`, né altrove.

🔴 **Il modo in cui questo ti farebbe sbagliare.** Il task 1.6 pretende che `npm install`
**fallisca**. Eseguito oggi con l'npm di sistema gira su Node 22 e **riesce** — e chi legge il
risultato senza rileggere questo paragrafo conclude che `.npmrc` non funziona, oppure spunta 1.6
per un successo che è la prova del contrario. Il task 1.7 è speculare e si sbaglia allo stesso modo.

**Decisione dell'utente, presa il 12 agosto 2026: i due task si soddisfano in forma diversa.**
Non si ricostruisce un Node 20 (né estratto accanto, né in Docker). Si esegue invece la
sostituzione qui sotto. La ragione è che **il soggetto sotto esame non è Node 20: è `.npmrc`.**

Che serva Node ≥ 22.12 è già stabilito e scritto in tre posti — `engines`, `.nvmrc`, `.npmrc`. La
domanda a cui 1.6 e 1.7 rispondevano è un'altra: *quella dichiarazione è un vincolo o un pio
desiderio?* E il modo realistico di sbagliare non è che `engine-strict` non funzioni — è
comportamento documentato di npm, non codice nostro — ma che **quel file sia nel posto sbagliato,
col nome sbagliato, o non venga letto**.

**La sostituzione**, da eseguire con la directory corrente in `sito/`:

```bash
cd sito
npm config get engine-strict     # -> true
# rinomina .npmrc in .npmrc.off
npm config get engine-strict     # -> false
# rimetti il nome
```

Conserva **esattamente la logica discriminante** dell'originale — due esiti opposti a un solo file
di distanza — e prova ciò che conta: che npm legge quel file, e che lo legge **perché sta in
`sito/`**. Non installa nulla, non richiede alcun runtime particolare, e non lascia residui.

✅ **I due esiti sono osservati, non ipotizzati**: provato il 12 agosto 2026 sull'albero reale,
`true` col file e `false` con il file rinominato. La sostituzione discrimina davvero — non è verde
per costruzione, che è precisamente il difetto che il task 1.7 esisteva per escludere.

🔴 **Va promossa a test automatico** in `sito/test/`, invece di restare una prova manuale. È il
guadagno che rende la sostituzione un miglioramento e non un ripiego: 1.6 e 1.7 erano due prove
🧪 che nessuno avrebbe mai più rieseguito; questa gira a ogni `npm test`, su qualunque macchina e
in CI. Il test deve ripristinare il nome del file anche se fallisce a metà.

**Il limite, da scrivere e non da nascondere.** La sostituzione **non osserva l'install abortire**:
verifica la configurazione attiva, non l'effetto finale. È un anello più corto della catena. Se un
giorno npm cambiasse il significato di `engine-strict`, questo test resterebbe verde e l'originale
no.

**Cosa documentare** nell'"Esito reale" della Fase 1: che la finestra si era chiusa prima che le
prove fossero eseguite, che la sostituzione è una decisione dell'utente e non una scorciatoia
dell'apply, i due output, e il limite qui sopra. E nel task **12.15**: le prove 🧪 diventano
**ventiquattro** eseguite più **due sostituite** (1.6 e 1.7), non ventisei — con il rimando a
questo paragrafo.

🔴 **Questo ragionamento non si estende a nessun'altra prova del change.** Vale qui perché il
guasto coperto, prima o poi, **si manifesta da solo**: chi installa su Node 20 vede comunque
qualcosa rompersi. Le mutazioni 3.9, 4.9 e 4.10 coprono guasti **invisibili** — `@theme` senza
`inline` produce un risultato identico alla radice, `.text-arancio` scritta per analogia non genera
CSS e il testo resta leggibile, un secondo compositore di URL non rompe niente finché i due
prefissi coincidono. Nessuno se ne accorgerebbe mai senza la mutazione. **Quelle si eseguono
tutte**, e chi le sostituisce con un ragionamento svuota il metodo del change.

### 2.3 Task 1.11 — `astro check` o scansione del markup?

**Decidi tu, con questo ordine di preferenza**: installa `@astrojs/check` + `typescript` in
`sito/devDependencies` ed esegui l'esperimento che il task descrive. Se il controllo **nomina la
prop mancante**, il task 7.3 si chiude con `npm run check` e in 12.12 scrivi perché il checker non
ricade nel divieto di tooling di Fase 7 (è un controllore di tipi, ed è esercitato). Se **non la
vede**, disinstalla il checker e ripiega sulla scansione dei sorgenti.

Non chiedere quale delle due: la spec resta soddisfatta in entrambi i modi, e il task ti chiede
solo di **scrivere quale hai usato**.

### 2.4 Task 2.2 — la `.gitignore` di radice copre già `*.pem`?

Verificalo con `git check-ignore -v`, non assumerlo. Se è già coperto: **non aggiungere la riga**,
correggi la divergenza n. 15 di `design.md` (*"sono due file, non uno"*) e scrivi che il rollback
tocca un file preesistente invece di due. Se non è coperto, aggiungi la riga a
`backend/.gitignore`. È l'**unico** file di `backend/` che ti è permesso toccare (§6).

### 2.5 Le cinque Open Questions

Chiuse dalla risoluzione n. 8 di `tasks.md` con la raccomandazione già scritta: non dipendere da
`--color-*`; tenere il prefisso `PUBLIC_`; usare `Astro.url.origin` e riverificarlo in Fase 6;
tenere il ripiego `og-default.jpg`; tenere la fascia "Aperitivo". Il task 12.13 è una **conferma
per iscritto**, non una decisione da prendere. L'unica che ha un esito osservato è la n. 1, al
task 4.11: guarda il CSS generato e annota cosa hai visto.

### 2.6 Il giudizio estetico — task 12.5, 9.8, e ogni «si vede bene?»

**È delegato a te.** Guarda, decidi, documenta. Le regole:

- Se un punto stona, **apri un debito con il suo nome** in `DEBITI.md` di questa cartella e
  prosegui. Non improvvisare un aggiustamento di design in fondo a un change: `tasks.md` 12.5 lo
  vieta esplicitamente, ed è la regola giusta.
- Non toccare i valori misurati della palette per farli "stare meglio". Sono campionati dalle
  locandine, non scelti.
- Salva sempre l'immagine che ti ha fatto decidere in `prove/` (§5). L'utente rivede le tue
  decisioni estetiche alla fine, guardando le stesse immagini che hai guardato tu.

### 2.7 I commit

**Uno per fase**, come il change precedente (`vetrina-api-pubblica`: dieci fasi, dieci commit).
Messaggio in italiano, nello stile della storia recente (`feat(vetrina): …`, `fix(vetrina): …`).
Committa **solo** dopo che l'uscita di fase è dimostrata, mai a metà.

🔴 **Non fare `push`.** È negato anche a livello di permessi. Il push è una decisione dell'utente,
e nella storia di questo progetto lo è sempre stata.

Resti su `main`, che è dove vivono tutti i commit della vetrina.

---

## 3. Quando due artefatti si contraddicono

In ordine, vince il primo che parla:

1. **le spec** (`specs/*/spec.md`) — le quindici divergenze del design sono **già recepite** lì
2. **`design.md`** — chiude le decisioni aperte della proposal
3. **`proposal.md`**
4. **il piano** in `~/.claude/plans/chiedevo-una-pianificazione-del-immutable-stream.md`

`tasks.md` non è in questa scala: è la traduzione operativa delle spec. Se `tasks.md` contraddice
una spec, **la spec vince** e tu annoti la discrepanza nell'"Esito reale" della fase.

Se la contraddizione è fra due spec, o dentro la stessa spec: è un blocco vero (§4).

---

## 4. Il protocollo di blocco — l'unica uscita legittima

Un blocco è **soltanto** una di queste tre cose:

- serve un privilegio che non hai (UAC, una credenziale, un accesso di rete)
- due spec si contraddicono in modo che nessuna scelta soddisfa entrambe
- una verifica fallisce e hai già provato **due** strade diverse per farla passare

Non sono blocchi: una decisione che ti sembra da confermare, un dubbio estetico, una dipendenza da
scegliere, un test che non hai ancora capito perché è rosso.

**Cosa fare quando è un blocco vero:**

1. **Prima finisci tutto il resto.** Un blocco alla Fase 5 non ferma le fasi che non ne dipendono.
   Percorri `tasks.md` fino in fondo e chiudi tutto ciò che è indipendente.
2. Scrivi in `BLOCCHI.md` di questa cartella, una voce per blocco:
   - il **numero del task**
   - cosa serve, in una riga
   - **le due strade che hai già provato** e come sono fallite, con l'output esatto
   - cosa resta bloccato a valle
3. Marca il task con 🚧 in `tasks.md`, senza spuntarlo.
4. Prosegui. Chiudi il turno solo quando non resta altro da fare.

`BLOCCHI.md` non vuoto autorizza l'hook a lasciarti uscire e fa partire la notifica all'utente.
**Non crearlo vuoto o preventivamente**: sarebbe il modo di aggirare il vincolo, e chiuderebbe la
corsa al primo turno.

---

## 5. Le prove che vogliono un browser

Delle ventisei prove 🧪, quindici vogliono un browser. Nessuna vuole l'utente.

**Lo strumento c'è già**: Playwright `1.58.2` in `duedgusto/node_modules`. 🔴 **Non installarlo in
`sito/`** — il task 12.12 pretende che `sito/package.json` non contenga alcun automatore di
browser, e la spec lo vieta. E 🔴 **non creare file in `duedgusto/`**: il task 12.9 pretende che
`git diff --stat 0221ddf..HEAD -- duedgusto/` sia **vuoto**, e i permessi te lo impediscono.

Gli script di prova vivono in `openspec/changes/vetrina-sito-astro/prove/`, che è fuori dal
perimetro di invarianza e viene archiviato insieme al change. Importa Playwright per percorso
esplicito, risalendo quattro livelli fino alla radice:

```js
import { chromium } from '../../../../duedgusto/node_modules/playwright/index.js';
```

Verificalo alla prima prova; se quel pacchetto non c'è, ripiega su `playwright-core`.

**Le ricette per le prove che altrimenti sembrano richiedere l'utente:**

| Prova | Come si fa senza toccare la macchina |
|---|---|
| 12.6 — il fuso non cambia il tema | `browser.newContext({ timezoneId: 'America/Los_Angeles' })`. È il fuso **del profilo del browser**, che è una delle due forme che il task ammette: non serve spostare l'orologio di sistema |
| 12.3 — nessun FOUC in dieci reload | `context.newPage()`, throttling via CDP (`Network.emulateNetworkConditions`), `page.goto(…, { waitUntil: 'commit' })` e uno screenshot ogni ~50 ms per i primi 400 ms; il lampo è un pixel chiaro in alto a sinistra mentre il tema è `sera`. Salva **la sequenza**, non solo l'esito |
| 12.4 — contrasto misurato | `page.evaluate` che legge `getComputedStyle` delle coppie testo/sfondo e calcola il rapporto WCAG in pagina. Niente axe-core: sarebbe una dipendenza esterna scaricata a runtime |
| 5.8 — la scheda di rete dei font | `page.on('request', r => r.resourceType() === 'font')`. Conta le richieste e i loro host |
| 12.8 — il logo è `<svg>` e non `<img>` | `page.$$eval` sul nodo del logo: verifica il tag **e** che segua il tema al toggle, nello stesso giro |
| 12.5 — confronto visivo dei due temi | Screenshot a piena pagina nei due registri, negli stessi punti. Poi guardali e scrivi (§2.6) |

**Dove finiscono le prove.** In `prove/`, con nomi che iniziano col numero del task
(`12.3-fouc-sera-reload-04.png`). Un `prove/README.md` fa da indice: una riga per prova, con il
numero del task, cosa mostra e l'esito. È ciò che l'utente aprirà per primo.

---

## 6. Il perimetro — e perché stavolta non è solo una promessa

I criteri 12.9, 12.10 e 12.11 pretendono che backend, app di cassa e infrastruttura restino
**invariati alla lettera**. Questa volta il divieto è nei permessi, non solo in questo documento:
`.claude/settings.local.json` **nega** la modifica di `duedgusto/**`, `deploy/**`, `.github/**` e
di ogni `.cs`, `.csproj` e `.json` sotto `backend/`. In Claude Code `deny` batte `allow` e non
ammette eccezioni: se ci provi, non è una domanda all'utente, è un rifiuto.

Puoi scrivere in: `sito/**`, `openspec/**`, e **solo** `backend/.gitignore`.

⚠️ Il divieto copre gli strumenti di modifica file e i comandi di shell riconosciuti — **non** uno
script che apra un file per conto suo. Non è una prigione, è una ringhiera: la disciplina resta tua.

🔴 **Il backend dell'utente su `:4000` non si ferma mai.** Non è nei permessi perché non è
esprimibile come regola. Per provare "il backend è giù" usa il modo (a) del task 10.4 — puntare
`API_INTERNA_URL` su una porta libera — che è deterministico e non spegne nulla. Se ti serve
davvero la transizione *su → giù → su*, avvia la **seconda** istanza e spegni quella:

```bash
ASPNETCORE_URLS=https://localhost:4012 SEED_ON_STARTUP=false dotnet run --project backend
```

---

## 7. Fatti d'ambiente che valgono più di una ricerca

- **Le porte**: sito `4321`, app di cassa `4001`, backend `4000`, seconda istanza `4012`.
  Le prime tre non si toccano. `localhost:4321` **è già ammesso** dalla policy CORS del backend,
  che confronta `uri.Host` ignorando la porta.
- **Il backend in esecuzione tiene bloccata `bin/`**: per compilare o testare mentre gira usa
  `dotnet build|test <csproj> -o <altra-cartella>`.
- **`API_INTERNA_URL` deve essere esattamente `https://localhost:4000`**: il certificato di
  sviluppo ASP.NET ha `localhost` come **solo** SAN, e con `127.0.0.1` la verifica fallisce
  sembrando un problema della CA.
- **A database ci sono i dati veri** su cui il change si vede: tre prodotti `VETR-F5-*` pubblicati
  e due media in cartella `galleria`. Non inventare dati di prova.
- **Residui noti da non scambiare per dati veri**: ~20 `MediaAssets` di prova (molti con anteprima
  rotta), il prodotto `VETR-PROVA` "Mojito Havana", le cartelle `prova-e2e-*`.
- **Orari `07:00–20:00`, lun–sab**, dal database (`BusinessSettings`), che è la **sorgente unica**.
  Non dal piano, che riportava un 21:00 vecchio.
- **`exiftool`** è in `%LOCALAPPDATA%\Programs\ExifTool\ExifTool.exe` e **non è nel PATH**.
- **MySQL**: `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe -u root -proot duedgusto`.
- **Il JWT scade in 5 minuti** e il signin è limitato a 5 tentativi ogni 15 minuti per IP. Per
  questo change non serve autenticarsi: le tre rotte pubbliche sono GET anonime.

---

## 8. Cosa deve esserci alla fine

1. `tasks.md` con ogni task spuntato o marcato 🚧, e un "Esito reale" per ogni fase.
2. `prove/` con le immagini e `prove/README.md` come indice.
3. `BLOCCHI.md` e `DEBITI.md` — anche assenti, se non ce n'è stato bisogno.
4. Dodici commit su `main`, nessun push.
5. `CORSA-ATTIVA` cancellato.
6. Un riepilogo finale che dica, in quest'ordine: cosa è chiuso, cosa è bloccato e perché, quali
   decisioni estetiche hai preso al posto dell'utente e dove guardarle.
