# Tasks: API pubblica + impostazioni vetrina (vetrina-api-pubblica)

> Artefatti di riferimento: [proposal.md](./proposal.md), [design.md](./design.md) (§D1-D12),
> [specs/](./specs/) — 6 spec, 39 requirement, 178 scenari.
> Change precedente, completato: [`vetrina-fondamenta-media`](../vetrina-fondamenta-media/tasks.md).
>
> **Come leggere questo file.** Ogni task ha una *Verifica*: chi lo chiude deve poter dimostrare
> che è chiuso, con un comando o un'osservazione. Ogni fase si apre con la ragione per cui esiste
> e si chiude con lo stato in cui lascia l'albero.
>
> **Le fasi sono i dieci gradini di design.md §"Migration / Rollout"**, più una fase di chiusura.
> Sono ordinate perché ognuna sia **provabile da sola**: alla fine della Fase 1 lo schema GraphQL
> è invariato e la regola è già unica; alla fine della Fase 5 le tre rotte rispondono a `curl`
> senza una riga di frontend; alla fine della Fase 8 le impostazioni si scrivono da GraphiQL
> senza che una pagina esista.
>
> ⚠️ **I test non hanno una fase propria, a differenza del change precedente.** Vivono dentro la
> fase che pinnano, perché è la condizione perché ogni gradino sia verificabile senza il
> successivo: un `PublicController` senza i suoi test strutturali non è un gradino chiuso, è un
> gradino di cui ci si fida.

---

## Sette risoluzioni già decise, da non rimettere in discussione durante l'apply

1. 🔴 **Il divieto sulle colonne riservate riguarda la lista `SELECT`, non l'intera istruzione
   SQL.** Lo scenario *"La query non legge le colonne riservate"* (spec `api-pubblica`) elenca
   `Attivo` fra i nomi che non devono comparire, ma lo scenario *"Il filtro gira nel database"*
   (stessa spec) **richiede** che `Attivo` compaia nella `WHERE`. Non è una contraddizione: si
   verifica la **proiezione**, cioè cosa la query porta a casa. Un filtro che nomina una colonna
   non la espone a nessuno.
2. 🔴 **La regola condivisa contiene due regole, non tre.** `NomeVetrina ?? Nome` (il nome
   mostrato) **non** entra in `RegoleVetrina`: nessuna spec lo richiede e il test di unicità
   cerca `PrezzoVetrina ??`, non un `??` qualunque. Va però calcolato **una volta sola** nel
   mapping del menu, perché serve sia all'ordinamento sia al DTO (task 5.7).
3. **La descrizione pubblica è `DescrizioneVetrina` e basta.** `Descrizione` è un campo cassa e
   non ha alcun fallback: un prodotto senza descrizione di vetrina espone `null`, non la
   descrizione contabile.
4. **La categoria di menu si chiama `Nome`, il contenitore `Categorie`.** `Categoria` è nella
   lista dei nomi vietati di §D2 e il divieto vale anche per la categoria **di vetrina**, che è
   legittima. Un falso positivo si risolve con un rename, non con un'eccezione nel test.
5. **`SchemaEspone_TuttiIRamiRootAttesi` diventerà rosso e si aggiorna.** È la sveglia
   progettata (§D9, spec `sicurezza`): si aggiunge `"vetrina"` all'elenco **delle query**
   ([AutorizzazioneAnonimaTests.cs:100-102](../../../backend/DuedGusto.Tests/Integration/GraphQL/AutorizzazioneAnonimaTests.cs)),
   non si esclude il ramo dalle tre Theory enumerative, che devono continuare a coprirlo da sole.
6. **L'header di cache si legge, non si confronta con una stringa.** ASP.NET emette
   `public,max-age=300` **senza spazio** dopo la virgola; la proposal lo scrive con lo spazio.
   È la stessa direttiva (§D4).
7. **Le quattro Open Questions del design si chiudono con la raccomandazione già scritta**:
   `/api/public/site` risponde `200` con i default quando la riga manca; telefono ed email sono
   esposti; l'ordinamento delle categorie è quello di §D7; il singleton di `BusinessSettings`
   **non** si irrigidisce qui (debito annotato). Conferma formale nel task 11.5.

---

## Vincoli operativi dell'ambiente

Ripetuti dentro i task in cui mordono davvero — qui una volta sola per non doverli cercare.

- 🔧 **Il backend in esecuzione dell'utente tiene bloccata `bin/`.** Per compilare o testare
  mentre gira:
  ```bash
  dotnet build backend/duedgusto.csproj -o /tmp/dued-build
  dotnet test  backend/DuedGusto.Tests/DuedGusto.Tests.csproj -o /tmp/dued-test
  ```
- 🔧 **Per le prove end-to-end serve una seconda istanza** su porta libera, che non tocchi quella
  dell'utente:
  ```bash
  ASPNETCORE_URLS=https://localhost:4012 SEED_ON_STARTUP=false dotnet run --project backend
  ```
  `SEED_ON_STARTUP=false` **tranne** nei task che provano il seed (4.4, 10.4), dove è il punto.
- 🔧 **Il JWT scade in 5 minuti** e il signin è limitato a **5 tentativi ogni 15 minuti per IP**.
  Una tornata di prove manuali lo esaurisce: si rigenera il token, non si rifà il login a
  raffica. (In sviluppo `X-Forwarded-For` non è validato — è il rischio già annotato altrove, non
  una tecnica da adottare.)
- 🔧 **Le migrazioni** si creano con `EF_MIGRATIONS=1 dotnet ef migrations add <Nome>` da
  `backend/` e **si applicano da sole all'avvio**
  ([Program.cs:312](../../../backend/Program.cs)). Senza `EF_MIGRATIONS=1`,
  `ServerVersion.AutoDetect` apre una connessione e serve un MySQL in esecuzione.

---

## Fase 1 — La regola condivisa e le tre riscritture

**Perché esiste.** È il gradino che rende sensati tutti gli altri, e **da solo non aggiunge
alcuna superficie**: lo schema GraphQL resta identico carattere per carattere. Finché la regola
vive dentro `ProdottoType`, qualunque cosa il controller della Fase 5 scriva è per forza una
seconda copia. E la seconda copia **esiste già oggi** a
[`VetrinaMutations.cs:194`](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs): questa fase non
previene una duplicazione futura, ne risolve una presente.

- [x] 1.1 🔴 **`backend/Common/RegoleVetrina.cs`** — crea la classe statica di design.md §D1:
  `Expression<Func<Prodotto, bool>> Pubblicato`, `EPubblicato(Prodotto)`,
  `PrezzoEffettivo(decimal? prezzoVetrina, decimal prezzoListino) => prezzoVetrina ?? prezzoListino`
  e l'overload di comodo che **delega** invece di reimplementare. Vive in `Common/` per la stessa
  ragione di `CorsOriginPolicy`: logica pura, nessun `DbContext`, nessun GraphQL, nessun
  `HttpContext`.
  ⚠️ **Ordine testuale vincolante**: `private static readonly Func<> Compilato = Pubblicato.Compile();`
  **deve** stare dopo `Pubblicato` — gli inizializzatori di campo statici girano nell'ordine di
  dichiarazione e invertirli compila `null` senza alcun errore.
  🔴 Il commento su `PrezzoEffettivo` deve dire che **0 è un prezzo valido (omaggio) e solo `null`
  è assenza**: chi lo riscrive con `> 0` trasforma un omaggio nel prezzo pieno sul sito, senza
  errori, e nessuno se ne accorge finché non arriva il cliente.
  *Verifica*: `dotnet build backend/duedgusto.csproj -o /tmp/dued-build` esce 0 (🔧 il backend
  dell'utente blocca `bin/`); la firma a due valori esiste ed è quella che il controller userà
  dopo la proiezione.

- [x] 1.2 **`ProdottoType` chiama la regola invece di implementarla** — in
  `backend/GraphQL/Vendite/Types/ProdottoType.cs` (righe 49-61) i due `Resolve` diventano
  `RegoleVetrina.EPubblicato(ctx.Source)` e `RegoleVetrina.PrezzoEffettivo(ctx.Source)`.
  Le due `Description` restano **identiche carattere per carattere**: cambia chi calcola il
  valore, non ciò che il contratto promette.
  *Verifica* (spec `vetrina-prodotti` → *Le descrizioni dello schema restano identiche*):
  `git diff backend/GraphQL/Vendite/Types/ProdottoType.cs` tocca solo i due corpi di `Resolve`;
  l'introspezione dello schema restituisce le stesse due `description` di prima.

- [x] 1.3 🔴 **La seconda copia che esiste già** — in
  [`VetrinaMutations.cs:194`](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs),
  `.Where(p => p.ImmagineId == mediaAssetId && p.Attivo && p.VisibileSulSito)` diventa
  `.Where(p => p.ImmagineId == mediaAssetId).Where(RegoleVetrina.Pubblicato)`.
  *Verifica* (spec `vetrina-prodotti` → *Il comportamento del punto riscritto è invariato*): i
  test esistenti su `mutateMediaAsset` che ritira un media in uso passano **senza una sola
  modifica**, e il messaggio nomina gli stessi prodotti di prima.

- [x] 1.4 **Matrice comportamentale di `EPubblicato`** — crea
  `backend/DuedGusto.Tests/Unit/Common/RegoleVetrinaTests.cs` con i quattro stati della coppia
  `Attivo`/`VisibileSulSito`: vero **solo** per `true/true`, falso negli altri tre — compreso
  `Attivo = false, VisibileSulSito = true`, che è il caso che il change precedente ha reso
  possibile e diagnosticabile.
  *Verifica*: `dotnet test backend/DuedGusto.Tests/DuedGusto.Tests.csproj -o /tmp/dued-test --filter "RegoleVetrina"` passa.

- [x] 1.5 🔴 **Matrice del prezzo, con il caso che si dimentica** — stesso file: `null` + `1.20` →
  `1.20`; **`0` + `1.20` → `0`**; `0.90` + `1.20` → `0.90`. E un test che verifica che la forma
  di comodo (entità) e quella a due valori **coincidono** su tutta la matrice.
  *Verifica* (spec `vetrina-prodotti` → *Prezzo di vetrina pari a zero*): il test dello zero è
  un caso a sé e non una riga di una `Theory` insieme al `null` — devono poter fallire
  separatamente, ed è il punto del task 1.6.

- [x] 1.6 🔴 **Verifica per mutazione del fallback** — non basta che i test siano verdi: vanno
  provati rompendo la regola. **Riscrivi** `PrezzoEffettivo` come
  `prezzoVetrina is > 0 ? prezzoVetrina.Value : prezzoListino`, **esegui i test e vedi fallire**
  quello dello zero mentre quello del `null` **resta verde**, poi **rimuovi la modifica** e
  vedili tornare tutti verdi.
  *Verifica* (spec `vetrina-prodotti` → *Verifica per mutazione del caso omaggio*): annota
  nell'uscita di fase quale test è fallito e quali no. Se il test dello zero resta verde con la
  regola rotta, non sta proteggendo nulla.

- [x] 1.7 🔴 **Test strutturale di unicità** — crea
  `backend/DuedGusto.Tests/Unit/Common/RegolaPubblicazioneUnicaTests.cs` con i due `Fact` di
  design.md §D1: la congiunzione `Attivo\s*&&\s*\w*\.?VisibileSulSito` e il fallback
  `PrezzoVetrina\s*\?\?` compaiono **in un file solo**, `Common/RegoleVetrina.cs`. La radice del
  repository si risale con `[CallerFilePath]`: la directory di esecuzione è `bin/Debug/net8.0` e
  `AppContext.BaseDirectory` cambia fra `dotnet test`, l'IDE e la CI. La scansione **esclude**
  `bin/`, `obj/`, `Migrations/` (generate) e il progetto di test stesso.
  *Verifica* (spec `vetrina-prodotti` → *I file generati non producono falsi positivi*): il test
  è verde con le migrazioni presenti nell'albero, e il messaggio di fallimento **nomina il file
  di troppo**.

- [x] 1.8 🔴 **Verifica per mutazione dell'unicità** — **aggiungi** una seconda congiunzione
  `p.Attivo && p.VisibileSulSito` in un file applicativo qualsiasi del ramo vetrina, **esegui il
  test e vedilo fallire nominando quel file**, poi **rimuovila** e vedilo tornare verde.
  *Verifica* (spec `vetrina-prodotti` → *Verifica per mutazione dell'unicità*): senza questa
  prova il test è verde per costruzione, non per merito — nessuno ha ancora provato che sappia
  fallire.

- [x] 1.9 **La stessa regola in memoria e in SQL** — test che filtra un insieme di prodotti nei
  quattro stati con `.Where(RegoleVetrina.Pubblicato)` e poi valuta `EPubblicato` in memoria su
  ciascuno: i due risultati **coincidono prodotto per prodotto**. E un test che ispeziona
  l'istruzione generata: la condizione è nella `WHERE`, non applicata dopo la materializzazione.
  *Verifica* (spec `vetrina-prodotti` → *La stessa regola in memoria e in SQL*, *Il filtro viene
  tradotto in SQL*): `dotnet test --filter "RegoleVetrina"` passa.

- [x] 1.10 🔴 **Il ramo cassa non è stato toccato** — controllo esplicito di fine fase.
  *Verifica* (spec `gestione-cassa` → *Confronto testuale vuoto sui file della cassa*):
  `git diff --stat backend/GraphQL/Vendite/VenditeMutations.cs backend/GraphQL/Vendite/Types/ProdottoInputType.cs backend/GraphQL/Vendite/VenditeQueries.cs`
  è **vuoto**; i test strutturali del confine del change precedente passano **senza alcuna
  modifica**. (`ProdottoType.cs` è invece modificato, ed è previsto dal task 1.2.)

**Uscita di fase.** `dotnet test` verde con lo schema GraphQL **invariato**, la regola esiste in
un punto solo e i due test che lo pinnano hanno dimostrato di saper fallire. Nessuna superficie
nuova è stata aggiunta — ed è corretto.

**Esito reale (apply del 2026-08-11).** Baseline **487/487** → **500/500** (13 test nuovi).

- *Mutazione 1.6* (`PrezzoEffettivo` riscritto `prezzoVetrina is > 0 ? … : prezzoListino`):
  rossi **2 su 12**. Atteso: `PrezzoEffettivo_ConVetrinaAZero_ValeZeroENonIlListino`
  (`Expected 0m, found 1.20m`). **Inatteso e desiderabile**: anche
  `IlFallbackDelPrezzo_CompareInUnFileSolo` diventa rosso, perché riscrivere il fallback
  **rimuove** il `??` dalla sede unica e la scansione non trova più alcun file — il test di
  unicità sorveglia quindi anche la *scomparsa* della regola, non solo la sua duplicazione.
  Verdi come previsto: il caso `null` (`PrezzoEffettivo_ConVetrinaAssente_RicadeSulListino`) e
  il caso positivo. Verde anche il test di delega, correttamente: entrambe le forme delegano
  alla stessa implementazione rotta, e quel test misura la delega, non la correttezza.
  Dopo il ripristino: **12/12 verdi**.
- *Mutazione 1.8* (`internal static bool CopiaDellaRegola(Prodotto p) => p.Attivo && p.VisibileSulSito;`
  aggiunta a `GraphQL/Vetrina/Types/MediaAssetType.cs`): rosso il solo
  `LaCongiunzioneDellaRegola_CompareInUnFileSolo`, con il file di troppo **nominato** nel
  messaggio (`{"Common/RegoleVetrina.cs", "GraphQL/Vetrina/Types/MediaAssetType.cs"}`). Dopo la
  rimozione: **2/2 verdi**.
- *Scoperta durante 1.3*: la riga riscritta di `VetrinaMutations` (l'avviso di ritiro in
  `AggiornaMediaAssetAsync`) **non aveva alcun test**, quindi la verifica «i test esistenti
  passano senza modifiche» sarebbe stata vuota — `EliminaMediaAsset_InUso_…` copre un altro
  percorso, che filtra sul solo `ImmagineId`. È stato aggiunto
  `AggiornaMediaAsset_RitiroDiUnMediaInUso_AvvisaNominandoISoliProdottiPubblicati`, verificato
  per mutazione (togliendo `.Where(RegoleVetrina.Pubblicato)` diventa rosso).
- *Divergenza dal testo di 1.7*: le due regex sono applicate con `RegexOptions.IgnoreCase`. La
  sede unica scrive il fallback sul proprio parametro (`prezzoVetrina ?? prezzoListino`,
  camelCase): con il confronto sensibile alle maiuscole del testo il test avrebbe trovato
  **zero** file e sarebbe stato rosso per costruzione.

---

## Fase 2 — I due punti unici: `LarghezzeCsv` e `CartelleVetrina`

**Perché esiste.** Sono le due duplicazioni che la Fase 5 creerebbe scrivendo la sua prima riga.
`LarghezzeCsv` non è pulizia opportunistica: delle due conversioni esistenti una **solleva** su
input sporco ([`MediaController.cs:145`](../../../backend/Controllers/MediaController.cs),
`int.Parse`), e quella variante in una rotta anonima è un **500 servito a un visitatore**.
`CartelleVetrina` esiste perché la scelta dell'etichetta è gratuita **oggi** e non lo sarà più
dopo il primo caricamento in galleria.

- [x] 2.1 **`backend/Services/Media/LarghezzeCsv.cs`** — punto unico di conversione da CSV
  persistito a `int[]`, con semantica **tollerante**: stringa vuota o `null` → elenco vuoto,
  valori non numerici **scartati**, mai un'eccezione.
  *Verifica*: `dotnet build backend/duedgusto.csproj -o /tmp/dued-build` esce 0.

- [x] 2.2 🔴 **I due chiamanti delegano, e la variante che lancia non sopravvive** —
  `MediaController.LeggiLarghezze` (riga 145) e `MediaAssetType.LeggiLarghezze` (riga 52)
  diventano chiamate a `LarghezzeCsv`. La semantica adottata è quella **tollerante**: è la meno
  sorprendente per il consumatore GraphQL e l'unica sicura per la rotta anonima.
  *Verifica* (spec `media-assets` → *Una sola implementazione*): `grep -rn "Split(',')" backend/`
  trova la conversione **solo** in `LarghezzeCsv.cs`; `grep -rn "int.Parse" backend/Controllers/`
  non trova più la variante che solleva.

- [x] 2.3 **Test di `LarghezzeCsv`** — vuoto → `[]`, `"400,x,800"` → `[400, 800]`,
  `"400,800,1200,1600"` → i quattro numeri; nessun caso solleva. E un test che i due consumatori
  preesistenti restituiscono **gli stessi numeri di prima della change** su un valore regolare.
  *Verifica* (spec `media-assets` → *Il comportamento dei consumatori preesistenti non peggiora*):
  `dotnet test --filter "Larghezze"` passa e i test preesistenti di `MediaControllerTests` e
  `MediaAssetType` passano senza modifiche.

- [x] 2.4 **`backend/Services/Media/CartelleVetrina.cs`** — `Generale = "generale"`,
  `Galleria = "galleria"`, `Suggerite = [Generale, Galleria]` e
  `Normalizza(string?) => IsNullOrWhiteSpace ? Generale : valore.Trim().ToLowerInvariant()`.
  Il commento deve dire che `Suggerite` è un **elenco suggerito e non un insieme chiuso**: le
  fasi successive ne porteranno almeno tre (`eventi`, `promozioni`, `hero`) e una lista chiusa
  richiederebbe un deploy per ognuna.
  *Verifica*: `dotnet build` esce 0; l'etichetta è `"galleria"` in italiano minuscolo, mai
  `"gallery"` — sarebbe l'unico valore di dato in inglese del progetto, filtrato da una rotta
  italiana.

- [x] 2.5 🔴 **Normalizzazione in scrittura, nei due percorsi e mai in lettura** — sostituisci il
  `.Trim()` con fallback di [`VetrinaMutations.cs:203`](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs)
  con `CartelleVetrina.Normalizza`, e fai lo stesso nel percorso di caricamento
  (`ImmagineProcessor` / `MediaController`).
  ⚠️ **Non normalizzare in lettura**: `.Where(m => m.Cartella.ToLower() == …)` diventa
  `LOWER(Cartella) = …` in SQL, non sargabile, e l'indice `(Cartella, Ordinamento)` smette di
  essere utilizzabile per la selezione ordinata. ⚠️ E non affidarsi alla collation: MySQL usa
  `utf8mb4_unicode_ci` e confronta ignorando le maiuscole, il provider InMemory dei test confronta
  in modo **ordinale** — un test verde non direbbe nulla sulla produzione, e viceversa.
  *Verifica* (spec `media-assets` → *Normalizzazione in scrittura*, *Normalizzazione anche in
  caricamento*): dopo aver salvato `"  Galleria "` il valore persistito è `"galleria"`; dopo un
  upload con `cartella=GALLERIA` idem.

- [x] 2.6 **`CartelleSuggerite` nel DTO di configurazione** — aggiungi il campo a
  `MediaConfigurazioneDto` ([`MediaController.cs:12`](../../../backend/Controllers/MediaController.cs))
  leggendolo da `CartelleVetrina.Suggerite`. È lo stesso argomento dei limiti di upload: **il
  frontend non può divergere dal backend perché non ha un proprio valore da far divergere**.
  *Verifica* (spec `media-assets` → *Le costanti includono le cartelle suggerite*): la rotta
  risponde con `cartelleSuggerite` contenente sia `"generale"` sia `"galleria"`.

- [x] 2.7 **Test di `CartelleVetrina` e del DTO** — `"  Galleria "` → `"galleria"`, `null` e soli
  spazi → `"generale"`, `"eventi"` accettato e normalizzato (l'insieme resta aperto); il DTO di
  configurazione espone le due cartelle.
  *Verifica* (spec `media-assets` → *L'insieme delle cartelle resta aperto*): `dotnet test --filter "Cartelle"` passa.

- [x] 2.8 **Prova manuale sul campo** — su una **seconda istanza** (🔧 `ASPNETCORE_URLS=https://localhost:4012 SEED_ON_STARTUP=false`)
  chiama `GET /api/media/configurazione` con un token e carica un'immagine indicando
  `cartella=GALLERIA`.
  🔧 Il JWT scade in **5 minuti** e il signin è limitato a **5 tentativi ogni 15 minuti per IP**:
  prendi il token una volta e riusalo, non rifare il login a ogni comando.
  *Verifica*: la risposta di configurazione contiene `cartelleSuggerite`; a database la riga
  caricata ha `Cartella = 'galleria'`; `SELECT DISTINCT Cartella FROM MediaAssets` non mostra due
  grafie dello stesso raggruppamento.

**Uscita di fase.** Una sola conversione CSV nel backend, una sola forma canonica per la cartella,
e il frontend ha da dove leggere i suggerimenti. Nessuna rotta nuova, nessuna tabella nuova.

**Esito reale (apply del 2026-08-11).** **500/500** → **535/535** (35 test nuovi).

- *Divergenza dal testo di 2.2*: i due metodi `LeggiLarghezze` **non sono stati cancellati**, sono
  diventati corpi di una riga che delegano (`=> LarghezzeCsv.Leggi(csv)`), e quello di
  `MediaController` è passato da `private` a `internal`. La ragione è il task 2.3, che chiede di
  provare che *«i due consumatori preesistenti restituiscono gli stessi numeri di prima»*:
  cancellandoli, la prova sarebbe stata su `LarghezzeCsv` due volte invece che sui due
  consumatori. `MediaController.LeggiLarghezze` accetta ora `string?` invece di `string` — è
  l'allargamento che rende la firma compatibile con la semantica tollerante.
- *Verifica di 2.2*: la conversione delle larghezze compare in `LarghezzeCsv.cs` e in nessun
  altro file. `grep -rn "Split(','" backend/` mostra tre risultati, due dei quali non c'entrano
  con le larghezze (`CorsOriginPolicy` per le origini, `AuthRateLimitMiddleware` per
  `X-Forwarded-For`). `grep -rn "int.Parse" backend/Controllers/` trova **una sola** riga, ed è
  la **prosa** del commento che spiega perché quella variante non c'è più.
- *Prova 2.8 eseguita* su una seconda istanza (`ASPNETCORE_URLS=https://localhost:4012`,
  `SEED_ON_STARTUP=false`, dll compilata fuori da `bin/`), con l'utente `e2e-admin`:
  `GET /api/media/configurazione` → `"cartelleSuggerite":["generale","galleria"]`;
  `POST /api/media` con `cartella="  GALLERIA "` → `201`, e a database
  `MediaAssetId=25 … Cartella='galleria'`. `SELECT DISTINCT Cartella FROM MediaAssets` →
  `galleria, generale, Piatti, prova-e2e-…, verifica-fase2`: nessun raggruppamento in due
  grafie. ⚠️ `Piatti` è **anteriore** alla change e resta maiuscolo — la normalizzazione è in
  scrittura e non riscrive le righe già persistite; tornerà canonico alla prima modifica dei suoi
  metadati. Non è stata scritta alcuna migrazione di dati: nessuna cartella esiste oggi in due
  grafie, quindi non c'è nulla da riconciliare.

---

## Fase 3 — Modello `ImpostazioniVetrina` e migrazione

**Perché esiste.** L'entità sembra additiva e isolata, ma introduce una relazione verso una
tabella che **ha già una procedura di eliminazione scritta per un referente solo** (§D10, Fase 7).
E la migrazione è additiva solo se la relazione è dichiarata bene: una `WithMany()` dimenticata
produce una colonna che nessuno ha chiesto su una tabella che la change ha promesso di non
toccare.

**Task di migrazione database (3.4, 3.5, 3.6, 3.7) separati da quelli di codice applicativo**,
come da `openspec/config.yaml` → `rules.tasks`.

- [x] 3.1 **Entità `backend/Models/ImpostazioniVetrina.cs`** — i campi di design.md §"Interfaces /
  Contracts": `IdSingleton = 1`, `ImpostazioniVetrinaId` inizializzato a quella costante,
  `InsegnaPubblica`, indirizzo **scomposto** (`Via`, `Cap`, `Citta`, `Provincia`, `Paese`),
  `Latitudine`/`Longitudine` nullable, contatti, social come **URL completi**, meta SEO,
  `ImmagineOgId` + `ImmagineOg`, `OraInizioTemaSera = "18:00"`, i quattro ganci spenti di Fase 4
  (`PrenotazioniAttive`, `PrenotazioniPreavvisoOre = 2`, `PrenotazioniCopertiMax = 20`,
  `TurnstileSiteKey`), `CreatedAt`/`UpdatedAt`.
  🔴 **Nessun campo di orario**: apertura, chiusura, giorni operativi e fuso restano in
  `BusinessSettings` e hanno **una sola sorgente**. L'indirizzo è scomposto perché lo pretende
  `schema.org/PostalAddress`: un campo unico costringerebbe il JSON-LD di Fase 3 a spezzarlo con
  una regex.
  ⚠️ **I default significativi vanno nel modello, non solo nel seed** (task 4.3): il seed salta
  quando la riga esiste, quindi una colonna aggiunta in futuro non riceverà **mai** il valore del
  seed sulle installazioni già avviate.
  *Verifica* (spec `impostazioni-vetrina` → *Il modello non possiede gli orari*): `dotnet build`
  esce 0; nessuna proprietà di orario, giorni o fuso.

- [x] 3.2 🔴 **`DbSet` e configurazione del singleton** — in
  `backend/DataAccess/AppDbContext.cs`: `DbSet<ImpostazioniVetrina>`, `ToTable` con
  `HasCheckConstraint("CK_ImpostazioniVetrina_Singleton", "\`ImpostazioniVetrinaId\` = 1")`,
  charset/collation `utf8mb4`, `HasKey`, **`ValueGeneratedNever()`** sull'identificativo,
  `HasMaxLength` su ogni stringa, `decimal(9,6)` sulle coordinate (≈ 11 cm), `text` sulla meta
  descrizione, timestamp con `CURRENT_TIMESTAMP` / `ON UPDATE CURRENT_TIMESTAMP`.
  🔴 `ValueGeneratedNever` non è cosmesi: l'id è un valore di dominio ("la riga"), non un
  contatore, e con l'auto-increment un `INSERT` senza id creerebbe la riga 2 **in silenzio**. Il
  `CHECK` è l'unico strato che nessuno può saltare — vale anche per un `INSERT` scritto a mano in
  una sessione MySQL alle due di notte.
  *Verifica*: `dotnet build` esce 0.

- [x] 3.3 🔴 **FK dell'immagine OG con `WithMany()` esplicito e senza argomento** — sempre in
  `OnModelCreating`: `HasOne(x => x.ImmagineOg).WithMany().HasForeignKey(x => x.ImmagineOgId).OnDelete(DeleteBehavior.Restrict)`.
  ⚠️ `MediaAsset` ha **già** `ICollection<Prodotto> Prodotti`: se la seconda relazione non dichiara
  esplicitamente di non avere navigazione inversa, EF può tentare di riusare quella collezione o
  creare una FK ombra, e la migrazione produce una colonna su `MediaAssets` che nessuno ha
  chiesto. È la stessa trappola documentata nel change precedente per la navigazione inversa.
  *Verifica*: `dotnet build` esce 0; nessuna collezione inversa aggiunta a `MediaAsset`.

- [x] 3.4 🔴 **Scaffolding della migrazione** — da `backend/`:
  ```bash
  EF_MIGRATIONS=1 dotnet ef migrations add AddImpostazioniVetrina
  ```
  🔧 `EF_MIGRATIONS=1` è obbligatorio: senza, `ServerVersion.AutoDetect` apre una connessione e
  serve un MySQL in esecuzione ([Program.cs:96-98](../../../backend/Program.cs)).
  *Verifica*: il file generato contiene **una sola** `CreateTable("ImpostazioniVetrina")` con il
  suo `CONSTRAINT CK_`, la FK verso `MediaAssets` con `ReferentialAction.Restrict`, e **zero**
  `AddColumn`/`AlterColumn` su qualunque tabella esistente.

- [x] 3.5 **Ispezione dello script prima di fidarsi** — `EF_MIGRATIONS=1 dotnet ef migrations script`.
  ⚠️ Se compare un `ALTER TABLE Prodotti` o `ALTER TABLE MediaAssets`, la causa è quasi certamente
  la relazione del task 3.3 senza `WithMany()` esplicito: si corregge **il modello** e si
  rigenera (`dotnet ef migrations remove`), **mai** si edita la migrazione a mano.
  *Verifica* (spec `impostazioni-vetrina` → *Lo script contiene solo la creazione della tabella*):
  lo script mostra **solo** `CREATE TABLE` e il suo vincolo.

- [x] 3.6 **Applicazione su un database con dati reali** — `EF_MIGRATIONS=1 dotnet ef database update`
  su un database che contiene già prodotti, impostazioni operative e media.
  *Verifica* (spec `impostazioni-vetrina` → *Nessun dato perso su un database reale*, *Nessuna
  colonna ombra sull'entità dei media*): `SELECT COUNT(*)` su `Prodotti`, `BusinessSettings` e
  `MediaAssets` identico a prima; `SHOW CREATE TABLE MediaAssets` e `SHOW CREATE TABLE Prodotti`
  mostrano **esattamente** le colonne precedenti alla change.

- [x] 3.7 🔴 **Prova che il singleton lo impone il database** — con la riga presente, tenta
  `INSERT INTO ImpostazioniVetrina (ImpostazioniVetrinaId, …) VALUES (2, …)` direttamente da una
  sessione MySQL.
  *Verifica* (spec `impostazioni-vetrina` → *Una seconda riga è rifiutata dal database*,
  *L'identificativo non è generato dal database*): l'inserimento è rifiutato per violazione del
  `CHECK`; `SHOW CREATE TABLE ImpostazioniVetrina` mostra la colonna **senza** `AUTO_INCREMENT`.

- [x] 3.8 **`BusinessSettings` invariata, e il debito annotato** — nessuna colonna, nessun vincolo,
  nessuna modifica alla sua mutation. Annota nel commento della configurazione di
  `ImpostazioniVetrina` che l'irrigidimento del singleton di `BusinessSettings` è un **change
  dedicato**: una riga di configurazione, ma su una tabella che cassa e chiusure mensili leggono
  e scrivono.
  *Verifica* (spec `impostazioni-vetrina` → *Le impostazioni operative restano come sono*):
  `git diff backend/Models/BusinessSettings.cs backend/GraphQL/Settings/` è **vuoto**; il debito
  è scritto nel codice, non solo qui.

**Uscita di fase.** La tabella esiste, il vincolo funziona a database, e le tabelle preesistenti
sono byte per byte come prima. Nessun codice legge ancora la riga — ed è corretto.

**Esito reale (apply del 2026-08-11).** Migrazione `20260811205343_AddImpostazioniVetrina`.

- 🔧 **Come si è compilato con `bin/` bloccato.** `dotnet ef` non ha l'equivalente di `-o`: la
  compilazione va deviata con la variabile d'ambiente `OutputPath`, che MSBuild raccoglie come
  proprietà globale. La forma usata per tutti e tre i comandi di questa fase è
  `EF_MIGRATIONS=1 OutputPath="…/scratchpad/dued-ef/" dotnet ef …` da `backend/`. Senza,
  `dotnet ef` fallisce con `MSB3027` perché il backend dell'utente tiene aperto
  `bin/Debug/net8.0/duedgusto.dll` (verificato: una `cp` su quel file risponde
  *Device or resource busy*).
- *Verifica 3.4*: il file generato contiene **una sola** `CreateTable("ImpostazioniVetrina")`
  con il suo `CheckConstraint`, la FK verso `MediaAssets` con `ReferentialAction.Restrict` e un
  indice sulla FK. `grep -cE "AddColumn|AlterColumn|DropColumn|RenameColumn"` → **0**.
- *Verifica 3.5*: `dotnet ef migrations script <precedente> <nuova>` produce **solo**
  `CREATE TABLE`, `CREATE INDEX` e l'inserimento in `__EFMigrationsHistory`. Nessun
  `ALTER TABLE`, quindi la `WithMany()` esplicita del task 3.3 ha fatto il suo lavoro. Lo
  snapshot del modello cambia con **127 righe aggiunte e zero rimosse**.
- *Verifica 3.6*: applicata con `dotnet ef database update` sul database di sviluppo reale
  (21 media, 1 prodotto, 1 riga di impostazioni operative, 607 registri storici). `diff` fra i
  conteggi prima e dopo: **identici**. `diff` fra `SHOW CREATE TABLE` di `MediaAssets`,
  `Prodotti` e `BusinessSettings` prima e dopo: **identici byte per byte** — nessuna colonna
  ombra da nessuna parte.
- *Verifica 3.7*, da una sessione `mysql.exe` vera (MySQL **8.0.19**, quindi i `CHECK` sono
  applicati e non ignorati):
  - `INSERT … VALUES (2, …)` → **`ERROR 3819: Check constraint 'CK_ImpostazioniVetrina_Singleton'
    is violated.`**
  - `UPDATE … SET ImpostazioniVetrinaId = 2` → **stesso errore**: il vincolo copre anche lo
    spostamento della riga, non solo la nascita di una seconda.
  - `INSERT` **senza** id → `ERROR 1364: Field 'ImpostazioniVetrinaId' doesn't have a default
    value`. È la prova diretta di `ValueGeneratedNever`: con l'auto-increment questa istruzione
    avrebbe creato la riga 2 **in silenzio**. `SHOW CREATE TABLE` non contiene alcun
    `AUTO_INCREMENT` (0 occorrenze).
  - **Scoperta**: lo stesso `INSERT` a mano mostra che i default di `OnModelCreating` sono
    davvero **nel database** — la riga inserita senza `Paese`, `OraInizioTemaSera`,
    `PrenotazioniPreavvisoOre` e `PrenotazioniCopertiMax` li riporta valorizzati a
    `IT / 18:00 / 2 / 20`. È la verifica del task 4.3 ottenuta come effetto collaterale, e sul
    database reale invece che sul modello.
  - ⚠️ `PrenotazioniAttive` **non** ha un default a database (è un `bool` senza
    `HasDefaultValue`): un `INSERT` scritto a mano che lo ometta viene rifiutato con
    `ERROR 1364`. Non è un difetto — EF lo valorizza sempre — ma va saputo da chi scrive SQL a
    mano. Non è stato aggiunto un default perché il task 4.3 elenca esattamente i quattro campi
    di cui sopra, e il valore CLR (`false`) coincide comunque con quello che MySQL darebbe a una
    colonna aggiunta in futuro.
- *Verifica 3.8*: `git diff backend/Models/BusinessSettings.cs backend/GraphQL/Settings/` è
  **vuoto**. Il debito è scritto **nel codice**, in testa alla configurazione di
  `ImpostazioniVetrina` in `AppDbContext.OnModelCreating`, e dice perché irrigidire l'altro
  singleton è un change dedicato e non un'aggiunta a questa migrazione.

---

## Fase 4 — Seed dei dati del locale

**Perché esiste.** Il seed gira a **ogni avvio**. Un menu riallineato dal seed è desiderabile, un
indirizzo riscritto a ogni riavvio è **perdita di lavoro dell'utente**. La differenza fra le due
politiche va decisa adesso e provata riavviando, non argomentata.

- [x] 4.1 **`backend/SeedData/SeedImpostazioniVetrina.cs`** — sulla forma di `SeedBusinessSettings`:
  se non esiste **alcuna** riga, ne crea una con i dati reali del locale — insegna **2D Gusto
  Bar**, Via del Costo 99, 36016 Thiene (VI), Instagram `https://www.instagram.com/2dgusto/`.
  🔴 **Nessun `UpdateIfNeeded`**, deliberatamente e al contrario di `SeedMenus`.
  *Verifica* (spec `impostazioni-vetrina` → *Il seed crea e non aggiorna*): il metodo non contiene
  alcun ramo di aggiornamento; l'insegna pubblica è distinta da `BusinessSettings.BusinessName`,
  che resta il nome del gestionale.

- [x] 4.2 **Invocazione in `Program.cs`** — dentro `if (seedOnStartup)`, **dopo**
  `SeedMenusSito.Initialize`.
  *Verifica*: il backend si avvia e la riga esiste a database dopo il primo avvio su un database
  vuoto.

- [x] 4.3 ⚠️ **I default significativi vivono nel modello** — ripercorri i campi di
  `ImpostazioniVetrina` e verifica che ogni valore iniziale sensato (`OraInizioTemaSera = "18:00"`,
  `PrenotazioniPreavvisoOre = 2`, `PrenotazioniCopertiMax = 20`, `Paese = "IT"`) sia dichiarato
  **nel modello e in `OnModelCreating`**, non soltanto nel seed.
  *Verifica* (spec `impostazioni-vetrina` → *Un campo aggiunto in futuro prende il default del
  modello*): su un'installazione con la riga già presente, una colonna aggiunta da una migrazione
  successiva riporta il default dichiarato — il seed non verrà rieseguito su quella riga.

- [x] 4.4 🔴 **Prova di idempotenza con un campo editato a mano** — su una **seconda istanza**
  (🔧 porta 4012, ma qui `SEED_ON_STARTUP=true`, che è il punto del task): primo avvio, poi
  modifica a mano l'indirizzo e il link social a database, poi **riavvia altre due volte**.
  *Verifica* (spec `impostazioni-vetrina` → *Tre avvii consecutivi non sovrascrivono il lavoro
  dell'amministratore*): `SELECT COUNT(*) FROM ImpostazioniVetrina` vale **1** dopo ogni avvio, e
  i valori modificati a mano sono ancora quelli letti dopo il terzo.

- [x] 4.5 **Test di integrazione del seed** — `SeedImpostazioniVetrina.Initialize` invocato **tre
  volte** → una riga sola; con una riga già valorizzata diversamente → i valori **non** cambiano.
  ⚠️ Il `ServiceProvider` del test deve creare **un contesto nuovo per scope**, come il test del
  seed dei menu del change precedente: il seed dispone il proprio scope, e condividere una sola
  istanza fa fallire il secondo giro con `ObjectDisposedException` — in produzione ogni avvio ha
  un contesto nuovo.
  *Verifica*: `dotnet test --filter "SeedImpostazioni"` passa.

**Uscita di fase.** La riga esiste, contiene i dati veri del locale, e tre riavvii non la toccano.
Nessuno la legge ancora.

**Esito reale (apply del 2026-08-11).** Suite backend **500/500** → **545/545** (45 test nuovi
fra Fase 2, 3 e 4).

- *Prova 4.4 eseguita davvero*, su una seconda istanza (`ASPNETCORE_URLS=https://localhost:4012`,
  **`SEED_ON_STARTUP=true`**, dll compilata fuori da `bin/`), quattro avvii in tutto:
  1. tabella vuota → **primo avvio** → una riga con `InsegnaPubblica='2D Gusto Bar'`,
     `Via='Via del Costo 99'`, `Cap='36016'`, `Citta='Thiene'`, `Provincia='VI'`, `Paese='IT'`,
     `UrlInstagram='https://www.instagram.com/2dgusto/'`, `OraInizioTemaSera='18:00'`;
  2. modifica **a mano** a database di `Via`, `UrlInstagram` e `Telefono`;
  3. **tre riavvii consecutivi**: `SELECT COUNT(*)` vale **1** dopo ognuno, e dopo il terzo i tre
     valori modificati sono ancora quelli scritti a mano — mentre `InsegnaPubblica`, che nessuno
     aveva toccato, è rimasta `2D Gusto Bar` e **non** è stata riscritta dal seed.
  I valori di prova sono stati poi ripristinati a quelli reali: il database di sviluppo resta
  con l'indirizzo vero.
- 🔴 **Gli orari NON sono stati toccati, ed è la decisione.** Il piano elenca *"orari 7:00–21:00"*
  fra i dati reali del locale, ma il modello di questa change **non possiede alcun campo di
  orario** (§"Gli orari non si duplicano") e la sorgente unica è `BusinessSettings`, che nel
  database di sviluppo contiene già valori **scelti dall'amministratore**: `OpeningTime='07:00'`,
  `ClosingTime='20:00'`, `OperatingDays=[lun–sab]`. Scrivere `21:00` da un seed sarebbe stato
  esattamente il guasto che questa fase esiste per prevenire — sovrascrivere il lavoro
  dell'utente — e per giunta su un'entità che questa change ha promesso di non toccare.
  ⚠️ **Punto aperto per l'utente**: se la chiusura corretta è le 21:00, si corregge dalla pagina
  delle impostazioni della cassa, in un campo solo. La rotta pubblica di Fase 5 pubblicherà
  qualunque cosa ci sia lì dentro.
- *Divergenza dal testo di 4.1*: il seed valorizza insegna, indirizzo e Instagram, e **lascia
  vuoti** telefono, email, coordinate e meta di default. Un valore inventato dal seed è
  indistinguibile da un valore scelto e finirebbe sul sito e nei dati strutturati; mezza
  coordinata, in particolare, è un punto sull'equatore. Il seed **non ripete** i default già
  dichiarati nel modello (`Paese`, `OraInizioTemaSera`, `PrenotazioniPreavvisoOre`,
  `PrenotazioniCopertiMax`): ripeterli creerebbe una seconda scrittura dello stesso valore, e la
  copia del seed sarebbe proprio quella che non arriva mai sulle installazioni già avviate.
- *Nota su 4.5*: il test del vincolo `CHECK` ha richiesto **due** aggiustamenti che vale la pena
  scrivere. Il `CHECK` è metadato **relazionale**, quindi invisibile al provider InMemory; e non
  vive nemmeno nel modello di runtime, che EF ottimizza per la lettura scartando ciò che serve
  solo alle migrazioni — va letto da
  `dbContext.GetService<Microsoft.EntityFrameworkCore.Metadata.IDesignTimeModel>().Model`. Il
  `ServiceProvider` del test registra il contesto come **factory scoped** (`AddScoped`) e non
  come istanza singola: `Initialize` dispone il proprio scope, e condividere una sola istanza
  farebbe fallire il secondo giro con `ObjectDisposedException`.

---

## Fase 5 — `PublicController`, DTO e la superficie chiusa per costruzione

**Perché esiste.** È il gradino **verificabile interamente con `curl`**, senza una riga di
interfaccia, ed è quello dove il rischio principale della proposal si chiude o resta aperto: un
campo contabile in una risposta pubblica. La difesa non è un filtro da ricordarsi — sono quattro
strati che coprono guasti diversi: la proiezione protegge dal database, i DTO record dal
serializzatore, i test strutturali dal futuro, `ActionResult<TDto>` dal compilatore.

### DTO e limite

- [x] 5.1 **`backend/Services/Vetrina/MenuLimiti.cs`** — `MaxItem = 300`, costante del backend.
  🔴 **Non configurabile dall'amministratore**: un numero che protegge da un guasto non va messo
  dove chi subisce il guasto può alzarlo. Con un test che lo pinna.
  *Verifica* (spec `api-pubblica` → *Il limite è una costante pinnata*): `grep -rn "300" backend/Services/Vetrina/`
  mostra un'unica definizione; nessun percorso la legge da configurazione o da
  `ImpostazioniVetrina`.

- [x] 5.2 **`backend/Controllers/Public/Dto/ImmaginePubblicaDto.cs`** — `record` posizionale con
  `Chiave`, `LarghezzeDisponibili` (`IReadOnlyList<int>`, da `LarghezzeCsv`), `Larghezza`,
  `Altezza`, `TestoAlternativo`, `Didascalia`, `Focale`, `Placeholder`. **Una sola forma
  dell'immagine per tutta l'API pubblica**, condivisa da menu e galleria, così che il consumatore
  Astro abbia un tipo solo.
  🔴 **La chiave, non l'URL**: nessuno schema `http`, nessun host, nessun prefisso `/media`. Una
  risposta cacheata 300s che contenesse un hostname resterebbe sbagliata per cinque minuti dopo
  qualunque cambio di dominio.
  *Verifica* (spec `api-pubblica` → *Nessuna URL assoluta nella risposta*): il record non ha alcun
  campo di base URL, e i valori di `Chiave` sono nella forma `2026/08/caffe-a1b2c3`.

- [x] 5.3 **`MenuPubblicoDto` + `CategoriaMenuDto` + `ProdottoPubblicoDto`** — in
  `backend/Controllers/Public/Dto/MenuPubblicoDto.cs`, namespace
  `duedgusto.Controllers.Public.Dto` (la collocazione conta: è ciò su cui il test 5.10 fa la
  scoperta per riflessione). `MenuPubblicoDto(Categorie, TotaleProdottiPubblicati,
  LimiteApplicato, Troncato)`; `ProdottoPubblicoDto(Id, Nome, Descrizione, Prezzo, Allergeni,
  Novita, Consigliato, Immagine)`.
  ⚠️ **La categoria di menu si chiama `Nome`, non `Categoria`**: quel nome è vietato dal test 5.10
  anche per la categoria di vetrina, che è legittima. `Categorie` (plurale) non è vietato.
  ⚠️ `Descrizione` del DTO è `DescrizioneVetrina`, **senza fallback** sulla descrizione contabile.
  *Verifica*: `dotnet build` esce 0; nessun campo `Codice`, `AliquotaIva`, `UnitaDiMisura`,
  `Attivo`, `CreatedAt`, `UpdatedAt`.

- [x] 5.4 **`SitoPubblicoDto` e i suoi annidati** — `Insegna`, `Indirizzo`, `Geo` (nullable),
  `Contatti`, `Social`, `Orari`, `Seo`, `OraInizioTemaSera`, ciascun blocco come record dedicato.
  `Orari` porta `Apertura`, `Chiusura`, `GiorniOperativi` (`IReadOnlyList<bool>?`) e `Timezone`;
  `Seo` porta `TitoloDefault`, `DescrizioneDefault` e `ImmagineOg` (`ImmaginePubblicaDto?`).
  🔴 **Mai** `VatRate`, `GiornaleImportoSabato`, `GiornaleImportoFeriale`, `SettingsId`,
  `TurnstileSiteKey` né i campi `Prenotazioni*`: è **qui**, al punto di composizione fra
  `ImpostazioniVetrina` e `BusinessSettings`, che salirebbero a bordo senza che nessuno lo scriva.
  *Verifica*: `dotnet build` esce 0; nessun blocco espone un campo dell'elenco riservato.

- [x] 5.5 **`GalleriaPubblicaDto`** — `record GalleriaPubblicaDto(IReadOnlyList<ImmaginePubblicaDto> Immagini)`.
  `IReadOnlyList<T>` e non `T[]` (mutabile) né `IEnumerable<T>` (senza un `Count` deterministico
  da serializzare).
  *Verifica*: `dotnet build` esce 0.

### Controller

- [x] 5.6 **`backend/Controllers/PublicController.cs`** — `[AllowAnonymous]`, `[Route("api/public")]`,
  `[ApiController]`, **tre action e nient'altro**, ognuna con tipo di ritorno `ActionResult<TDto>`
  e **mai** `IActionResult`: il compilatore rifiuta `return Ok(entità)` prima che lo faccia un
  test. Nessuna action accetta parametri di query, filtri liberi o paginazione: il costo di ogni
  risposta è **fisso e indipendente dall'input del chiamante**.
  `[AllowAnonymous]` è oggi ridondante (nessun filtro globale, nessuna `FallbackPolicy`) e si
  scrive comunque: dichiara l'intenzione — il fratello `MediaController` porta `[Authorize]` sulla
  stessa riga, e il contrasto è l'informazione — e sopravvive al giorno in cui una policy di
  fallback chiuderà il resto dell'app.
  *Verifica* (spec `api-pubblica` → *Nessuna quarta rotta pubblica*): le action sono esattamente
  tre; non esiste alcuno stub per eventi, promozioni, contenuti o prenotazioni.

- [x] 5.7 🔴 **`GET /api/public/menu`** — la proiezione, il filtro condiviso e il raggruppamento:
  1. `.Where(RegoleVetrina.Pubblicato)` — la regola della Fase 1, **mai** una congiunzione scritta
     qui;
  2. ordinamento **totale**: `OrdinamentoVetrina`, poi il nome mostrato, poi `ProdottoId` — senza
     il terzo criterio due prodotti omonimi si scambiano fra due richieste e la cache di 60s serve
     pagine diverse a visitatori diversi;
  3. `.Take(MenuLimiti.MaxItem)` **prima** del raggruppamento: con 301 prodotti si perde l'ultimo
     per ordinamento, non un'intera categoria a caso;
  4. `.Select(new RigaMenu(...))` — forma intermedia privata che **non seleziona** `Codice`,
     `AliquotaIva`, `CreatedAt`, `UpdatedAt`, `Categoria`, `UnitaDiMisura`, `Attivo`; nessun
     `Include` serve, la proiezione attraversa `Immagine` ed EF genera il `LEFT JOIN`;
  5. `CountAsync()` separata **sullo stesso predicato** per il totale reale (non la lunghezza
     della lista);
  6. `RegoleVetrina.PrezzoEffettivo(riga.PrezzoVetrina, riga.Prezzo)` dopo la proiezione — è la
     ragione per cui quella firma a due valori esiste (task 1.1);
  7. raggruppamento per `CategoriaVetrina`, con `null`/vuoto/soli spazi → **un solo** gruppo
     `"Altro"`; 🔴 **mai** ricadere su `Categoria` (contabile);
  8. ordine delle categorie: minimo `OrdinamentoVetrina` dei prodotti contenuti, poi nome;
  9. `LogWarning` con il totale quando `Troncato`.
  ⚠️ Il nome mostrato (`NomeVetrina ?? Nome`) si calcola **una volta sola** nel mapping e si riusa
  per l'ordinamento e per il DTO.
  *Verifica*: il metodo si legge dall'alto nei nove passi; il comportamento è coperto dai test
  5.12-5.14.

- [x] 5.8 **`GET /api/public/site`** — composizione delle due sorgenti, con tre modi di **non
  fallire**:
  - `ImpostazioniVetrina` letta per `ImpostazioniVetrinaId == IdSingleton`, **mai** con un
    `FirstOrDefaultAsync()` senza criterio; riga assente → `200` con i valori di default
    dell'entità e un `LogWarning`. **Mai** un `404` (farebbe fallire l'intera home del sito) e
    **mai** un `500`;
  - `OperatingDays` è un JSON in stringa: parse **tollerante**, `null` se il risultato non è un
    array di sette booleani, con `LogWarning`. 🔴 **Non copiare il `!` di
    [`GestioneCassaGuards.cs:76`](../../../backend/GraphQL/GestioneCassa/GestioneCassaGuards.cs)**:
    in una rotta anonima quell'eccezione è un 500. *Omettere gli orari settimanali è meglio che
    dichiararne di sbagliati*;
  - geolocalizzazione non impostata → l'oggetto è `null`, **non** una coppia di zeri.
  *Verifica* (spec `api-pubblica` → *La rotta dell'identità non fallisce mai su dati incompleti o
  malformati*): coperto dai test 5.15.

- [x] 5.9 **`GET /api/public/galleria`** — `Cartella == CartelleVetrina.Galleria` **e**
  `Pubblicato == true`, con **uguaglianza secca** sulla colonna (nessuna funzione applicata: la
  normalizzazione è avvenuta in scrittura, task 2.5), ordinamento `(Ordinamento, MediaAssetId)`.
  Galleria vuota → `200` con elenco vuoto: è uno **stato legittimo**, non un errore.
  *Verifica* (spec `api-pubblica` → *La lettura non normalizza*): l'istruzione SQL generata
  confronta la colonna senza `LOWER(...)`.

### Test strutturali della superficie

- [x] 5.10 🔴 **`backend/DuedGusto.Tests/Unit/Controllers/SuperficiePubblicaTests.cs`** — file
  **nuovo** e distinto da `ConfineVetrinaCassaTests`, perché quello difende il confine *cassa ↔
  vetrina* e questo difende il confine *privato ↔ pubblico*: due confini, due file, ognuno con la
  sua ragione scritta in testa. Tre test:
  1. **ricorsivo** sui tipi annidati raggiungibili dalle firme delle action (BFS): nessuna
     property fra `Codice`, `AliquotaIva`, `Attivo`, `Categoria`, `UnitaDiMisura`, `CreatedAt`,
     `UpdatedAt`, `VatRate`, `GiornaleImportoSabato`, `GiornaleImportoFeriale`, `SettingsId`,
     `TurnstileSiteKey`, `Prenotazioni*`. 🔴 **Senza la ricorsione** `MenuPubblicoDto` passerebbe
     mentre `CategoriaMenuDto`, che è dentro di lui, porta il campo vietato;
  2. ogni action restituisce un tipo del namespace `duedgusto.Controllers.Public.Dto` e **mai**
     un'entità — il giorno in cui qualcuno passa da `ActionResult<T>` a `IActionResult` il
     compilatore smette di impedire `return Ok(prodotto)`, questo test no;
  3. l'elenco **esatto** delle property di ogni DTO: né un campo in più né uno in meno. Un campo
     tolto rompe il sito in silenzio (Astro legge `undefined`), uno aggiunto è la fuga che questo
     file previene.
  *Verifica*: `dotnet test --filter "SuperficiePubblica"` passa.

- [x] 5.11 🔴 **Verifica per mutazione del divieto** — **aggiungi** una property `AliquotaIva` a un
  tipo annidato **di secondo livello** (per esempio `CategoriaMenuDto`), **esegui i test e vedi
  fallire** almeno uno nominando il tipo e il campo, poi **rimuovila** e vedili tornare verdi.
  *Verifica* (spec `api-pubblica` → *Verifica per mutazione del divieto*): il secondo livello è il
  punto del task — una violazione al primo livello la coglierebbe anche un test non ricorsivo.

- [x] 5.12 **Comportamento del menu: il filtro** — in
  `backend/DuedGusto.Tests/Unit/Controllers/PublicControllerTests.cs` (istanziando il controller
  con `TestDbContextFactory.Create()`, come `MediaControllerTests`): attivo+visibile compare;
  visibile ma **non attivo** non compare **e non è conteggiato**; attivo ma non visibile non
  compare; prodotto senza categoria di vetrina → gruppo `"Altro"` **unico** e conteggiato; con
  categoria contabile `"BEVANDE"` e nessuna categoria di vetrina, **nessun** gruppo si chiama
  `"BEVANDE"`; categoria di soli spazi → `"Altro"` e nessun gruppo con nome vuoto; ordine dei
  prodotti e delle categorie, e stabilità fra due letture identiche.
  *Verifica* (spec `api-pubblica`, dominio menu): `dotnet test --filter "PublicController"` passa.

- [x] 5.13 🔴 **Comportamento del menu: il prezzo, e la verifica per mutazione** — `4.50` con
  prezzo di vetrina valorizzato; `3.80` con vetrina `null`; **`0.00` con vetrina `0.00`, e non
  `3.80`**. Poi **sostituisci** il fallback nel controller con una forma che tratti lo zero come
  assenza, **vedi fallire** il solo test dello zero (quello del `null` **resta verde**), e
  **ripristina**.
  *Verifica* (spec `api-pubblica` → *Verifica per mutazione del fallback*): è la seconda volta che
  questa prova si fa (la prima in 1.6, sulla regola) — qui si prova che il **controller** la usa
  davvero invece di riscriverla.

- [x] 5.14 **Comportamento del menu: il troncamento** — 301 prodotti pubblicati → la somma dei
  prodotti di tutte le categorie è **300**, il totale dichiarato **301**, il limite **300**,
  l'indicatore **vero**, e un avviso registrato con il totale; 87 prodotti → 87, indicatore falso,
  **nessun** avviso; con 301 distribuiti su più categorie, il prodotto assente è **l'ultimo per
  ordinamento** e nessuna categoria sparisce; parametri di query che suggeriscono un limite
  diverso non cambiano nulla.
  *Verifica* (spec `api-pubblica` → *Il limite di 300 elementi si dichiara nella risposta*):
  `dotnet test --filter "PublicController"` passa.

- [x] 5.15 **Comportamento di site e galleria** — `site`: orari, giorni e fuso arrivano da
  `BusinessSettings`; nessun campo contabile; i campi spenti (`turnstileSiteKey`,
  `prenotazioni*`) **non escono**; `OperatingDays` malformato → `null` + avviso, **nessuna
  eccezione**; riga assente → `200` con default + avviso; geo non impostata → oggetto `null`;
  immagine OG non impostata → campo `null` e risposta valida in ogni altra parte.
  `galleria`: filtra cartella **e** stato di pubblicazione; un media `"generale"` non compare; un
  media della galleria non pubblicato non compare; galleria vuota → `200`; ordine stabile.
  *Verifica* (spec `api-pubblica`, domini site e galleria): `dotnet test --filter "PublicController"` passa.

- [x] 5.16 **`PublicController_EAnonimoPerAttributi`** — il controller dichiara
  `[AllowAnonymous]` e **non** porta `[Authorize]`, né sulla classe né su alcuna action.
  🔴 **Con il commento che dichiara ciò che questo test NON prova**: un test unitario che istanzia
  il controller e chiama `Menu()` non passa mai da autenticazione e autorizzazione, quindi sarebbe
  verde anche con `[Authorize]` sulla classe. Prova che l'**intenzione** non è stata cancellata il
  giorno in cui qualcuno aggiunge un `[Authorize]` "per coerenza con `MediaController`"; l'unica
  prova vera dell'anonimato è il task 5.17.
  *Verifica* (spec `sicurezza` → *Il test strutturale da solo non prova l'anonimato*): il commento
  è nel file e nomina il task che copre il buco.

- [x] 5.17 🔴 **Prova manuale: `curl` anonimo sulle tre rotte** — su una **seconda istanza**
  (🔧 `ASPNETCORE_URLS=https://localhost:4012 SEED_ON_STARTUP=false dotnet run --project backend`),
  da una shell **senza** header `Authorization` e **senza** cookie:
  ```bash
  curl -sk https://localhost:4012/api/public/site
  curl -sk https://localhost:4012/api/public/menu
  curl -sk https://localhost:4012/api/public/galleria
  curl -sk https://localhost:4012/api/public/menu | jq 'paths | join(".")' | sort -u
  ```
  Poi ripeti `menu` **con** un token amministratore valido.
  *Verifica* (spec `api-pubblica` → *Lettura completamente anonima*, *Un token non cambia la
  risposta*, *Controprova sul JSON reale*): tutte e tre rispondono `200` con JSON valido; l'elenco
  dei percorsi non contiene alcuna chiave dell'elenco riservato; la risposta con token è identica
  a quella senza. 🔧 Il JWT scade in 5 minuti: prendine uno fresco per questa prova.

**Uscita di fase.** Le tre rotte esistono e rispondono a un client senza credenziali, la
superficie è chiusa da quattro strati, e il test che la pinna ha dimostrato di saper fallire.
Nessun header di cache, nessuna policy CORS dedicata: sono il gradino successivo.

**Esito reale (apply del 2026-08-11).** Suite backend **545/545** → **608/608** (63 test nuovi:
18 in `SuperficiePubblicaTests`, 45 in `PublicControllerTests`).

- 🔴 **Divergenza obbligata dal testo di 5.7, scoperta e corretta dentro la fase.** La prima
  scrittura ordinava la query **dopo** la proiezione (`.Select(new RigaMenu(…))
  .OrderBy(riga => riga.Ordinamento)`), che è la sola forma in cui il nome mostrato si scrive una
  volta sola. **EF Core non la traduce**: `OrderBy` che segue una proiezione costruita produce
  `InvalidOperationException: The LINQ expression … could not be translated`. Il provider InMemory
  la esegue senza battere ciglio, quindi **tutti i test comportamentali erano verdi** — a coglierla
  è stato il test che ispeziona l'SQL sul provider relazionale, e la conferma dal vivo è arrivata
  dal primo `curl`, che ha risposto **500** sulla sola rotta `/menu`. La forma finale è quella del
  §D2 di design.md:
  1. in SQL l'ordine del **troncamento**, `(OrdinamentoVetrina, ProdottoId)` — già totale, quindi
     con 301 prodotti si perde sempre lo stesso, l'ultimo per ordinamento;
  2. la proiezione calcola il nome mostrato (`COALESCE`), **unica scrittura**;
  3. in memoria, su 300 righe, l'ordine di **presentazione** `(Ordinamento, NomeMostrato,
     ProdottoId)`, che rilegge `RigaMenu.NomeMostrato` invece di ricalcolarlo.
  I due ordini sono cose diverse e ora il codice lo dice; entrambi sono totali, quindi entrambe le
  proprietà richieste (troncamento deterministico, ordine stabile fra due letture) restano.
- *SQL generato*, verificato con `ToQueryString()` sul provider MySQL senza connessione:
  ```sql
  SELECT `t`.`ProdottoId`, COALESCE(`t`.`NomeVetrina`, `t`.`Nome`), `t`.`DescrizioneVetrina`,
         `t`.`CategoriaVetrina`, `t`.`PrezzoVetrina`, `t`.`Prezzo`, `t`.`OrdinamentoVetrina`,
         `t`.`Allergeni`, `t`.`Novita`, `t`.`Consigliato`, `m`.`MediaAssetId` IS NULL, `m`.`Chiave`, …
  FROM (SELECT `p`.`ProdottoId`, `p`.`Allergeni`, `p`.`CategoriaVetrina`, `p`.`Consigliato`,
               `p`.`DescrizioneVetrina`, `p`.`ImmagineId`, `p`.`Nome`, `p`.`NomeVetrina`,
               `p`.`Novita`, `p`.`OrdinamentoVetrina`, `p`.`Prezzo`, `p`.`PrezzoVetrina`
        FROM `Prodotti` AS `p`
        WHERE `p`.`Attivo` AND `p`.`VisibileSulSito`
        ORDER BY `p`.`OrdinamentoVetrina`, `p`.`ProdottoId` LIMIT 300) AS `t`
  LEFT JOIN `MediaAssets` AS `m` ON `t`.`ImmagineId` = `m`.`MediaAssetId`
  ```
  Nessuna delle due liste `SELECT` nomina `Codice`, `AliquotaIva`, `CreatedAt`, `UpdatedAt`,
  `Categoria`, `UnitaDiMisura`, `Attivo`; `Attivo` compare **solo** nella `WHERE`, che è la
  risoluzione n. 1 applicata alla lettera. Il test la formula così: si rimuovono le righe che
  cominciano con `WHERE` e si asserisce sul resto, con una controprova che l'istruzione residua
  non sia vuota.
- *Mutazione 5.11* (`public decimal AliquotaIva { get; init; }` aggiunta a `CategoriaMenuDto`,
  annidato di **secondo** livello dentro `MenuPubblicoDto`): rossi **2 su 18**.
  `NessunTipoRaggiungibile_PossiedeUnCampoVietato` nomina `{"CategoriaMenuDto.AliquotaIva"}` — è
  il test ricorsivo, e senza la ricorsione sarebbe rimasto verde perché `MenuPubblicoDto` non
  possiede alcun campo vietato. Rosso anche il pin esatto della forma
  (`{"Nome", "Prodotti", "AliquotaIva"}`). Dopo la rimozione: **18/18 verdi**.
- *Mutazione 5.13* (fallback riscritto **nel controller** come
  `riga.PrezzoVetrina is > 0 ? riga.PrezzoVetrina.Value : riga.Prezzo`): rosso **1 solo** test,
  `Menu_ConPrezzoDiVetrinaAZero_EsponeZeroENonIlListino`
  (`Expected 0M, but found 3.80M`). Verde, come previsto,
  `Menu_ConPrezzoDiVetrinaAssente_RicadeSulListino`: da solo non coprirebbe nulla.
  🔴 **Scoperta che vale la pena scrivere**: verdi anche i due test di
  `RegolaPubblicazioneUnicaTests`. La scansione dei sorgenti cerca `PrezzoVetrina\s*\?\?` e quella
  riscrittura non contiene alcun `??` — quindi **il test strutturale di unicità non protegge da
  questa mutazione**, ed è esattamente la ragione per cui il task 5.13 esiste come prova separata
  dal 1.6. Dopo il ripristino: **47/47 verdi**.
- *Prova 5.17 eseguita davvero*, su una seconda istanza
  (`ASPNETCORE_URLS=https://localhost:4012`, `SEED_ON_STARTUP=false`, dll compilata fuori da
  `bin/`, content root `backend/` perché `Env.Load()` legge `.env` dalla directory corrente), da
  una shell **senza** `Authorization` e **senza** cookie: `site` **200**, `menu` **200**,
  `galleria` **200**. `jq` non è installato sulla macchina: l'enumerazione delle chiavi è stata
  fatta con `ConvertFrom-Json` in PowerShell, che produce lo stesso elenco di `jq 'paths'`.
  Nessuna delle 54 chiavi delle tre risposte appartiene all'elenco riservato.
  Le tre risposte con un token amministratore valido sono **identiche byte per byte** (`cmp`) a
  quelle anonime; `?limite=1000&take=5&page=2&categoria=BEVANDE` sul menu produce una risposta
  **identica**; **nessuna** delle tre porta `Set-Cookie`; `/api/public/business-name` risponde
  ancora `{"businessName":"duedgusto"}`.
- *Il menu reale come controprova del dominio*, non solo della forma: il prodotto `VETR-PROVA` ha
  `PrezzoVetrina = 0.00` e `Prezzo = 8.00` e la risposta espone **`"prezzo":0.00`** — l'omaggio
  sopravvive al percorso completo. Ha `Categoria = 'Cocktail'` (contabile) e nessuna categoria di
  vetrina: finisce in `"Altro"` e **nessun gruppo si chiama "Cocktail"**. Il prodotto disattivato
  in cassa non compare e **non è conteggiato** (`totaleProdottiPubblicati: 3` su 4 righe marcate
  visibili).
- *Divergenza dal testo di 5.4, dichiarata*: il DTO non espone `BusinessName`. Il requisito della
  spec `api-pubblica` cita *«il nome dell'attività … dalle impostazioni operative»* fra le due
  sorgenti, ma il contratto JSON della stessa spec e l'elenco di campi del task 5.4 non lo
  contengono, e `InsegnaPubblica` esiste proprio per essere il nome che legge il cliente
  (`BusinessName` resta il nome del gestionale, "duedgusto"). Aggiungerlo avrebbe fatto fallire il
  pin esatto della forma; il valore è comunque già raggiungibile da `/api/public/business-name`.
- *Due metodi `internal static`* (`QueryDelMenu`, `QueryDellaGalleria`) espongono le query ai soli
  test perché le garanzie «non legge le colonne riservate» e «non normalizza in lettura» si
  verificano sull'**istruzione**, non sul risultato. Restituiscono `IQueryable` non generico:
  `RigaMenu` resta privata e non può uscire dal controller.
- *Lasciato a database di sviluppo* (dichiarato, non ripulito): tre prodotti di prova con codice
  `VETR-F5-*` — `900` (Caffetteria, con immagine), `901` (Aperitivi, prezzo di vetrina 4.00),
  `902` (`Attivo = 0`, che serve a provare il filtro sulla rotta viva). Si rimuovono con
  `DELETE FROM Prodotti WHERE Codice LIKE 'VETR-F5-%';`.

---

## Fase 6 — CORS dedicata, header di cache e il criterio del rate limiting

**Perché esiste.** È il gradino che rende **corretto per default** il micro-cache di Fase 6 del
piano: nginx onora il `Cache-Control` dell'upstream, quindi emetterlo oggi significa che domani
basta aggiungere `proxy_cache_path` e ogni rotta si comporta come deve. Ometterlo significa
scoprire fra sei mesi che il TTL va deciso in un secondo posto, dove nessuno lo collegherà più
alla natura del dato. E la policy CORS dedicata non è una questione di accesso — `localhost:4321`
è **già** ammesso, la allowlist ignora la porta — è la proprietà di **cache a variante unica**.

- [ ] 6.1 **Policy `PubblicaSenzaCredenziali`** — in `Program.cs`, accanto ad
  `AllowSpecificOrigins`: `AllowAnyOrigin()`, `WithMethods("GET")`, `AllowAnyHeader()`.
  🔴 **Niente `AllowCredentials()`**: `"*"` e le credenziali sono mutuamente esclusivi per
  specifica, e qui è una virtù — questa famiglia di rotte non può diventare un vettore credenziale
  nemmeno per un errore di configurazione futuro.
  *Verifica* (spec `sicurezza` → *Le rotte pubbliche non possono diventare un vettore
  credenziale*): la policy globale con allowlist e credenziali resta **invariata** e continua ad
  applicarsi a `/graphql` e `/api/auth/*`.

- [ ] 6.2 ⚠️ **`[EnableCors("PubblicaSenzaCredenziali")]` sul controller, e il commento che
  protegge l'ordine** — l'attributo funziona perché il middleware CORS legge i **metadati
  dell'endpoint già selezionato**: `WebApplication` inserisce `UseRouting` all'inizio della
  pipeline quando non è chiamato esplicitamente, quindi `app.UseCors(…)` gira **dopo** la
  selezione. Il giorno in cui qualcuno aggiungesse un `app.UseRouting()` esplicito **dopo**
  `UseCors`, l'attributo smetterebbe di avere effetto **in silenzio** e le rotte pubbliche
  tornerebbero sotto la policy credenziale. Scrivi il commento accanto a `UseCors` in `Program.cs`.
  *Verifica* (spec `api-pubblica` → requisito CORS, nota ⚠️): il commento è nel file e nomina la
  conseguenza, non solo la regola.

- [ ] 6.3 **`[ResponseCache]` sulle tre action** — `site` e `galleria` `Duration = 300`, `menu`
  `Duration = 60`, tutte `Location = ResponseCacheLocation.Any`. `ResponseCacheAttribute` è un
  **filtro che scrive header**: non richiede il middleware di response caching, che infatti **non**
  si registra. Il `60` di `menu` è lo stesso numero del `proxy_cache_valid 200 60s` previsto per
  la Fase 6 del piano: sono la stessa decisione, scritta due volte di proposito.
  *Verifica*: `dotnet build` esce 0; l'attributo è nella **firma** dell'action, dove un lettore lo
  vede insieme alla rotta.

- [ ] 6.4 **Test riflessivo `OgniRotta_DichiaraLaSuaCache`** — `Theory` sulle tre action che legge
  `ResponseCacheAttribute` per riflessione e asserisce `Duration` e `Location.Any`.
  🔴 **Mai** confrontare una stringa letterale: ASP.NET emette `public,max-age=300` **senza spazio**
  dopo la virgola, la proposal lo scrive con lo spazio, ed è la stessa direttiva.
  *Verifica* (spec `api-pubblica` → *Durata dichiarata per ogni rotta*): `dotnet test --filter "Cache"` passa.

- [ ] 6.5 **Nessuna cache lato server** — verifica che `Program.cs` non registri
  `AddResponseCaching` né `AddOutputCache` e che nessun middleware di caching sia in pipeline.
  *Verifica* (spec `api-pubblica` → *Nessuna cache lato server*): `grep -rn "AddResponseCaching\|AddOutputCache\|UseResponseCaching\|UseOutputCache" backend/`
  non trova nulla; due richieste consecutive alla stessa rotta producono **due** query a database
  (osservabile dai log EF).

- [ ] 6.6 **Il criterio del rate limiting, scritto dove servirà** — in
  `backend/Middleware/AuthRateLimitMiddleware.cs`, **solo un commento** accanto a
  `RateLimitedPaths`: le tre GET pubbliche **non** ci sono, e il criterio è **"lettura cacheabile a
  costo fisso: no; scrittura che persiste dati o invia email: sì"**. Con le tre ragioni verificate:
  la chiave è falsificabile (`X-Forwarded-For` non validato, quindi si frenerebbe solo chi non sta
  abusando); il dizionario non viene mai ripulito (`CleanupOldEntries` non è invocata da alcun
  servizio, e agganciarvi la rotta più fetchata di un sito è una perdita di memoria proporzionale
  al traffico anonimo); la protezione vera è il costo fisso più il micro-cache di Fase 6.
  ⚠️ Il commento deve dire anche che la Fase 4 farà la scelta **opposta** su
  `/api/public/prenotazioni`, e **perché** non è una contraddizione.
  *Verifica* (spec `sicurezza` → *Le rotte pubbliche non sono nel dizionario*): il dizionario
  contiene **esattamente** le due voci di autenticazione preesistenti, e il criterio è accanto.

- [ ] 6.7 🔴 **Prova manuale: leggere l'header vero** — sulla seconda istanza:
  ```bash
  curl -skI https://localhost:4012/api/public/site     | grep -i "cache-control\|set-cookie"
  curl -skI https://localhost:4012/api/public/menu     | grep -i "cache-control\|set-cookie"
  curl -skI https://localhost:4012/api/public/galleria | grep -i "cache-control\|set-cookie"
  curl -skI -H "Origin: http://localhost:4321" https://localhost:4012/api/public/menu \
    | grep -i "access-control-allow\|vary"
  ```
  *Verifica* (spec `api-pubblica` → *Header letto dalla risposta reale*; spec `sicurezza` → *Le
  rotte pubbliche non ammettono credenziali*): `max-age=300`/`60`/`300` con cache **pubblica**;
  **nessun** `Set-Cookie` su nessuna delle tre; `Access-Control-Allow-Origin: *` e **nessun**
  `Access-Control-Allow-Credentials`. Un test unitario non vede i middleware: questa prova non è
  sostituibile.

- [ ] 6.8 **Il costo per richiesta non è amplificabile** — richiedi le tre rotte con parametri di
  query arbitrari e ripetutamente.
  *Verifica* (spec `sicurezza` → *Il costo per richiesta non è amplificabile*, *Molte richieste
  consecutive non vengono rifiutate*): la risposta con parametri è identica a quella senza; il
  numero di righe lette dal database non cambia; nessuna richiesta viene rifiutata per limite; e
  `POST /api/auth/signin` continua a essere limitato **esattamente come prima**.

**Uscita di fase.** Le tre rotte portano gli header che il reverse proxy di Fase 6 onorerà, la
policy credenziale è intatta dove serve, e la decisione sul rate limiting è scritta dove la
leggerà chi dovrà prenderne una opposta. `deploy/` non è stato toccato.

---

## Fase 7 — `EliminaMediaAssetAsync`: il secondo referente

**Perché esiste.** È il guasto che questa change **introdurrebbe senza accorgersene**.
[`EliminaMediaAssetAsync`](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs) (righe 226-255)
verifica i riferimenti solo su `Prodotti`, poi ① cancella i file dal disco e ② solo dopo salva.
L'ordine è deliberato e giusto per il caso previsto — *se la cancellazione dei file fallisce, la
riga resta e l'operazione è ripetibile*. Ma con `ImmagineOgId` e `DeleteBehavior.Restrict` il ②
solleva un errore grezzo di chiave esterna **dopo** che ① ha già cancellato gli otto file: riga
presente, file spariti, immagine OG rotta su ogni condivisione social, e un messaggio MySQL
incomprensibile nell'interfaccia.

- [ ] 7.1 🔴 **Il controllo del secondo referente, prima di toccare il disco** — in
  `EliminaMediaAssetAsync`, accanto alla lettura dei prodotti che lo usano e **prima** di
  `storage.EliminaAsync`:
  `bool usataComeOg = await dbContext.ImpostazioniVetrina.AnyAsync(i => i.ImmagineOgId == mediaAssetId);`
  con un `ExecutionError` che **nomina il media** e indica l'azione correttiva — *sostituiscila o
  rimuovila dalle impostazioni del sito, poi riprova* — con la stessa leggibilità del messaggio
  usato per i prodotti.
  *Verifica* (spec `media-assets` → requisito modificato): l'ordine è leggibile nel metodo
  dall'alto: **entrambe** le verifiche precedono qualunque scrittura su disco.

- [ ] 7.2 **Il caso preesistente resta identico** — il rifiuto per prodotti referenzianti e il suo
  messaggio non cambiano di un carattere.
  *Verifica* (spec `media-assets` → *Il caso preesistente resta invariato*): i test esistenti su
  `eliminaMediaAsset` con media assegnato a due prodotti passano **senza modifiche**.

- [ ] 7.3 🔴 **Test: il rifiuto lascia i file sul disco** — media assegnato come immagine OG →
  eliminazione rifiutata **e**:
  - il record del media è ancora presente;
  - 🔴 **tutti i file delle sue varianti sono ancora sul filesystem** (è l'asserzione che conta e
    quella che si dimentica);
  - il riferimento in `ImpostazioniVetrina.ImmagineOgId` è invariato.
  *Verifica*: `dotnet test --filter "MediaAsset"` passa; l'asserzione sui file conta gli stessi
  file di prima, non solo che la cartella esista.

- [ ] 7.4 🔴 **Verifica per mutazione dell'ordine dei controlli** — **rimuovi** il controllo del
  task 7.1, **esegui il test e osserva quale asserzione fallisce**: deve fallire quella sui **file
  su disco**, mentre quella sul rifiuto può restare verde (la FK rifiuta comunque, solo troppo
  tardi). Poi **ripristina** il controllo e vedi il test tornare verde.
  *Verifica* (spec `media-assets` → *Verifica per mutazione dell'ordine dei controlli*): un test
  che verificasse solo il rifiuto resterebbe verde **con i file già cancellati** — è esattamente
  ciò che questa prova dimostra, e va annotato nell'uscita di fase.

- [ ] 7.5 **Gli altri casi del referente doppio** — media assegnato a un prodotto **e** come
  immagine OG → rifiuto, record e file intatti; riferimento OG azzerato e poi eliminazione →
  riesce, rimuovendo record **e tutti** i file; tentativo di cancellare la riga direttamente a
  database con il riferimento presente → bloccato dal vincolo `Restrict`.
  *Verifica* (spec `media-assets`, scenari del requisito modificato): `dotnet test --filter "MediaAsset"`
  passa; la prova del vincolo a database si esegue da una sessione MySQL, non da un test.

**Uscita di fase.** L'eliminazione di un media conosce entrambi i suoi referenti e verifica
entrambi **prima** di toccare il disco, e la prova che il test sappia cogliere il guasto è stata
eseguita, non argomentata.

---

## Fase 8 — Ramo GraphQL admin: `vetrina { impostazioni }` e la mutation

**Perché esiste.** È il gradino **verificabile da GraphiQL da solo**, prima che una pagina esista.
E porta la divergenza deliberata più importante di questo change: `updateBusinessSettings` assegna
sotto condizione `if (!string.IsNullOrEmpty(...))`, quindi **un campo non si può svuotare**.
Copiare quello stile qui lo importerebbe in un'entità dove i campi opzionali sono la maggioranza.

- [ ] 8.1 **`backend/GraphQL/Vetrina/Types/ImpostazioniVetrinaType.cs`** — output admin con tutti i
  campi del contratto di design.md §"Contratto GraphQL", inclusi i ganci spenti e
  `immagineOg: MediaAsset`.
  *Verifica*: `dotnet build` esce 0; l'introspezione mostra i campi attesi.

- [ ] 8.2 **`ImpostazioniVetrinaInput` + `ImpostazioniVetrinaInputType`** — POCO e tipo GraphQL con
  **esattamente** i campi scrivibili. 🔴 **Nessun identificativo** (c'è una riga sola e il resolver
  sa quale: accettare un id sarebbe invitare qualcuno a passarne un altro), **nessuna marca
  temporale**, **nessun campo di orario**.
  *Verifica* (spec `impostazioni-vetrina` → *L'input non accetta un identificativo*, *Nemmeno
  l'input li accetta*): una mutation che tenta di passare `impostazioniVetrinaId` o `openingTime`
  è rifiutata dalla **validazione dello schema**, non dal resolver.

- [ ] 8.3 🔴 **`backend/GraphQL/Vetrina/VetrinaQueries.cs`** — `this.Authorize()` a livello di tipo
  e `Field<ImpostazioniVetrinaType>("impostazioni")` con `GuardAmministratore` come **prima
  istruzione del resolver, anche in lettura**, poi lettura per
  `ImpostazioniVetrinaId == ImpostazioniVetrina.IdSingleton` (mai `FirstOrDefaultAsync()` senza
  criterio) con `Include(x => x.ImmagineOg)`.
  🔴 Il guard in lettura serve perché **non sono gli stessi dati** che escono da
  `/api/public/site`: il tipo admin espone `turnstileSiteKey`, i tre campi prenotazione e tutto
  ciò che le Fasi 3-5 aggiungeranno. È il precedente già stabilito per
  `connection { mediaAssets }`: *aprirla dopo è una riga; accorgersi che era aperta è un
  incidente*.
  *Verifica* (spec `sicurezza` → *Le impostazioni della vetrina sono riservate agli amministratori
  anche in lettura*): coperto dal test 8.10; con la riga assente la query restituisce un risultato
  gestibile dal client e non un errore di infrastruttura.

- [ ] 8.4 **Registrazione del ramo root** — in `backend/GraphQL/GraphQLQueries.cs`:
  `Field<VetrinaQueries>("vetrina").Resolve(context => new { })`.
  *Verifica*: l'introspezione mostra otto rami di query; le tre `Theory` enumerative di
  `AutorizzazioneAnonimaTests` coprono `vetrina` **da sole**, senza alcuna allowlist.

- [ ] 8.5 ⚠️ **`SchemaEspone_TuttiIRamiRootAttesi` si aggiorna, non si aggira** — aggiungi
  `"vetrina"` all'elenco **delle query** ([riga 100-102](../../../backend/DuedGusto.Tests/Integration/GraphQL/AutorizzazioneAnonimaTests.cs)).
  È la sveglia progettata: *"è nato un ramo root, hai verificato che sia autorizzato?"*.
  *Verifica* (spec `sicurezza` → *L'elenco atteso dei rami root viene aggiornato, non aggirato*):
  il ramo **non** viene escluso da alcuna verifica enumerativa; la modifica al test è **solo**
  l'aggiunta del nome.

- [ ] 8.6 🔴 **`mutateImpostazioniVetrina` ad assegnazione totale** — nel `VetrinaMutations`
  esistente: `GuardAmministratore` come **prima istruzione**, come le altre tre; upsert su
  `IdSingleton` (crea la riga se manca, per l'installazione con `SEED_ON_STARTUP=false`);
  **assegnazione totale** di tutti i campi dell'input sul modello di `ApplicaCampiVetrinaAsync`
  (righe 144-156), con `NullSeVuoto` (riga 265) per una sola rappresentazione dell'assenza; più
  `UpdatedAt`.
  🔴 **Mai** la forma `if (!string.IsNullOrEmpty(input.X))` di
  [`SettingsMutations.cs:46-80`](../../../backend/GraphQL/Settings/SettingsMutations.cs): è un
  difetto reale del codice esistente e non si importa.
  *Verifica* (spec `impostazioni-vetrina` → *Scrittura ad assegnazione totale*): coperto dai test
  8.8; l'input possiede **esattamente** i campi scrivibili, quindi non c'è nulla da ricordarsi di
  preservare.

- [ ] 8.7 **Validazioni prima della scrittura, in italiano** — `OraInizioTemaSera` formato `HH:mm`
  (lo stesso di `OpeningTime`/`ClosingTime`); `Latitudine ∈ [-90, 90]` e
  `Longitudine ∈ [-180, 180]` quando valorizzate, e valorizzate **insieme o nessuna delle due**
  (mezza coordinata è un punto sull'equatore, cioè un dato peggiore di un dato mancante); URL
  social **assoluti** `http(s)` e non handle; `ImmagineOgId` valorizzato deve **esistere ed essere
  `Pubblicato`**, con **lo stesso identico messaggio** già usato da `ApplicaCampiVetrinaAsync`
  (righe 120-135) — due formulazioni diverse per la stessa regola sono due regole, agli occhi di
  chi legge il messaggio. Nessun rifiuto lascia una scrittura parziale.
  *Verifica*: coperto dai test 8.9.

- [ ] 8.8 🔴 **Test dello svuotamento e verifica per mutazione** — impostazioni con
  `urlFacebook` valorizzato → mutation con quel campo vuoto → il valore persistito è **nullo** e la
  rilettura restituisce nullo; telefono di **soli spazi** → nullo. Poi **sostituisci**
  l'assegnazione di un campo opzionale con la forma condizionata al valore non vuoto, **vedi
  fallire** lo scenario di svuotamento, e **ripristina**.
  *Verifica* (spec `impostazioni-vetrina` → *Verifica per mutazione dell'assegnazione totale*):
  senza questa prova, un `if` reintrodotto per distrazione passerebbe la CI.

- [ ] 8.9 **Test delle validazioni e del round-trip** — `"18.00"` rifiutato e nessun campo
  modificato; sola latitudine rifiutata con messaggio che spiega che vanno insieme; latitudine
  `120` rifiutata; **entrambe azzerate** → successo con geolocalizzazione assente; `"@2dgusto"`
  rifiutato con richiesta di indirizzo completo; `immagineOgId` inesistente → errore esplicito e
  valore invariato; `immagineOgId` non pubblicato → errore **con lo stesso messaggio** del caso
  prodotto; riferimento OG azzerato → successo e il media resta in libreria; round-trip completo
  (valorizza tutto, rileggi, ogni valore identico); riga assente → **creazione implicita** con
  l'identificativo fisso.
  *Verifica* (spec `impostazioni-vetrina`, dominio amministrazione): `dotnet test --filter "ImpostazioniVetrina"` passa.

- [ ] 8.10 🔴 **Privilegi su tutta la nuova superficie** — in
  `backend/DuedGusto.Tests/Integration/GraphQL/PrivilegiAmministrativiTests.cs`: un utente
  autenticato con `Amministratore = false` è rifiutato **sia** su `vetrina { impostazioni }`
  (lettura!) **sia** su `mutateImpostazioniVetrina`, con errore esplicito di privilegi
  insufficienti; **nessuna** riga creata o modificata in nessuno dei due casi. E un anonimo è
  rifiutato come non autenticato, senza che alcuna verifica di ruolo o scrittura venga eseguita.
  *Verifica* (spec `sicurezza`, scenari di rifiuto): `dotnet test --filter "Privilegi"` passa; il
  caso della **lettura** è quello che si dimentica — se manca, il task 8.3 non è chiuso.

- [ ] 8.11 **Prova manuale da GraphiQL** — sulla seconda istanza (🔧 porta 4012): leggi
  `vetrina { impostazioni { … } }`, scrivi `mutateImpostazioniVetrina` con tutti i campi, rileggi;
  poi svuota `urlFacebook` e rileggi; poi assegna un `immagineOgId` reale.
  🔧 Il JWT scade in **5 minuti** e il signin è limitato a **5 tentativi ogni 15 minuti per IP**:
  una tornata di prove lo esaurisce.
  *Verifica*: il ciclo funziona interamente da GraphiQL, **senza una riga di frontend**, e i valori
  salvati compaiono in `/api/public/site` (che li legge dalla stessa riga).

**Uscita di fase.** Le impostazioni si leggono e si scrivono da GraphiQL, solo da un
amministratore, e un campo si può svuotare. Nessuna pagina esiste ancora.

---

## Fase 9 — Frontend: `MediaLibrary` con l'`Autocomplete` e `ImpostazioniVetrinaPage`

**Perché esiste.** Finché la cartella si digita in un campo di testo nudo, **nessuno popolerà mai
la galleria**: la rotta pubblica risponderebbe `[]` per sempre e non ci sarebbe alcun errore da
nessuna parte. E la pagina delle impostazioni è ciò che rende i dati del locale modificabili da
chi li possiede, invece che da chi sa scrivere una mutation.

- [ ] 9.1 **Tipi TypeScript** — in `duedgusto/src/@types/vetrina.d.ts`: `ImpostazioniVetrina`
  allineata al contratto GraphQL e `cartelleSuggerite: string[]` su `MediaConfigurazione`.
  *Verifica*: `cd duedgusto && npm run ts:check` passa.

- [ ] 9.2 **Operazioni GraphQL** — in `duedgusto/src/graphql/vetrina/`:
  `impostazioniVetrinaFragment` in `fragments.tsx` (**template string**, non `gql` — convenzione
  del progetto), `getImpostazioniVetrina` in `queries.tsx`,
  `mutationMutateImpostazioniVetrina` in `mutations.tsx`.
  *Verifica*: `npm run ts:check` e `npm run lint` passano.

- [ ] 9.3 **`MediaLibrary`: i due campi cartella diventano `Autocomplete freeSolo`** — righe
  206-210 (caricamento) e 265-268 (dialog di modifica) di
  [`MediaLibrary.tsx`](../../../duedgusto/src/components/pages/sito/MediaLibrary.tsx). Opzioni =
  `cartelleSuggerite` **dal server** (già letto al mount da `/api/media/configurazione`) ∪ cartelle
  già presenti fra gli asset caricati. È il pattern **già usato nella stessa feature**
  ([`VetrinaProdottiList.tsx:66`](../../../duedgusto/src/components/pages/sito/VetrinaProdottiList.tsx)
  costruisce così i valori di `categoriaVetrina`): nessun modello mentale nuovo.
  🔴 `freeSolo` e non una tendina chiusa: l'insieme delle cartelle è **aperto**.
  *Verifica* (spec `media-assets` → *Il frontend non ha una propria copia*):
  `grep -rn "\"galleria\"\|'galleria'\|\"generale\"\|'generale'" duedgusto/src` non trova **alcun**
  elenco di cartelle nel frontend; e `MediaCard` continua a mostrare la cartella su ogni card
  ([riga 70](../../../duedgusto/src/components/pages/sito/MediaCard.tsx)), che è la diagnosi della
  galleria vuota.

- [ ] 9.4 **`ImpostazioniVetrinaPage.tsx` — struttura** — crea
  `duedgusto/src/components/pages/sito/ImpostazioniVetrinaPage.tsx` sul pattern **verbatim** di
  [`settings/SettingsDetails.tsx`](../../../duedgusto/src/components/pages/settings/SettingsDetails.tsx):
  `Formik` + `FormikProps` ref + schema Zod + `FormikToolbar` + `useConfirm` + toast, con
  `refetchQueries` e `awaitRefetchQueries` sulla mutation, dentro `SitoGuard`.
  Sezioni **nell'ordine in cui un proprietario le compila**: identità, indirizzo, posizione,
  contatti e social, SEO, aspetto, prenotazioni.
  *Verifica*: `npm run ts:check` passa; la pagina è dentro `SitoGuard` e non reinventa il layout.

- [ ] 9.5 **Validazione Zod, incrociata sulle coordinate** — `HH:mm` sull'ora del tema sera,
  `z.string().url()` sui social, e il controllo **incrociato** lat/long (entrambe o nessuna).
  ⚠️ La validazione client **non sostituisce** quella del backend (task 8.7): le stesse regole
  valgono per una chiamata GraphQL diretta.
  *Verifica* (spec `impostazioni-vetrina` → *Coordinate incoerenti bloccate prima dell'invio*, *La
  validazione del client non è l'unico controllo*): compilando la sola latitudine la pagina segnala
  e **nessuna mutation parte** (pannello Network vuoto).

- [ ] 9.6 🔴 **La sezione prenotazioni si dichiara inattiva** — `Alert severity="info"`: *"Le
  prenotazioni non sono ancora attive sul sito: questi valori vengono salvati e verranno usati
  quando la funzione sarà disponibile."* Un campo che si compila e non fa niente, senza
  spiegazione, è un bug segnalato.
  *Verifica* (spec `impostazioni-vetrina` → *La sezione prenotazioni si dichiara inattiva*):
  l'avviso è visibile senza aprire nulla.

- [ ] 9.7 **Gli orari non si modificano da qui** — nessun campo di apertura/chiusura/giorni/fuso, e
  una riga con link alla pagina Impostazioni della cassa che lo spiega. È §2 della proposal reso
  visibile all'utente invece che solo scritto nel design.
  *Verifica* (spec `impostazioni-vetrina` → *Gli orari non si modificano da qui*): la pagina non
  ha alcun campo di orario e indica dove si modificano.

- [ ] 9.8 **Immagine OG dal `MediaPickerDialog` esistente** — nessun secondo percorso di scelta
  delle immagini, nessun caricamento aggiuntivo dentro questa pagina.
  *Verifica*: il selettore aperto è lo stesso della griglia prodotti; la scelta valorizza
  `immagineOgId`.

- [ ] 9.9 **Test React** — `ImpostazioniVetrinaPage`: Zod incrociata su lat/long, `HH:mm`, URL;
  `MediaLibrary`: l'`Autocomplete` propone `galleria` fra le opzioni **provenienti dal server** e
  accetta un valore digitato non presente fra le opzioni.
  *Verifica* (spec `media-assets` → *La cartella della galleria è selezionabile*, *Un valore
  digitato resta accettato*): `npm run test -- ImpostazioniVetrinaPage` e `npm run test -- MediaLibrary`
  passano.

- [ ] 9.10 **Prova manuale nell'app vera** — con il dev server e la seconda istanza del backend:
  carica un'immagine scegliendo `galleria` dalla tendina e verifica che compaia in
  `/api/public/galleria`; compila indirizzo, social e ora del tema sera, salva, e verifica che i
  valori compaiano in `/api/public/site`.
  🔧 Il backend dell'utente su 4000 può essere più vecchio del ramo: se le pagine si vedono vuote
  o lo schema non espone `vetrina { impostazioni }`, è quello, non la pagina. Le prove girano
  sulla seconda istanza.
  *Verifica* (spec `api-pubblica` → *Un'immagine appena etichettata compare*; spec
  `impostazioni-vetrina` → *Salvataggio completo dalla pagina*): il giro si chiude **dall'interfaccia
  e non dal database**.

**Uscita di fase.** Un amministratore etichetta un'immagine come galleria e compila i dati del
locale dall'interfaccia, e le due cose compaiono nelle rotte pubbliche. La voce di menu che porta
alla pagina non esiste ancora: ci si arriva dall'URL.

---

## Fase 10 — Terza voce di menu e gating

**Perché esiste.** Le route del frontend sono generate dai record di menu del database: senza il
seed, la pagina della Fase 9 è raggiungibile solo digitando l'URL. E il gating va seminato insieme
alla voce, non dopo.

- [ ] 10.1 **Icona `Store` in `iconMapping.tsx`** — aggiungi `Store` al `Record` di
  `duedgusto/src/components/layout/sideBar/iconMapping.tsx` (verificato assente; `lucide-react` è
  già dipendenza).
  ⚠️ **`Settings` non si riusa**: è già la sezione Impostazioni della cassa, e le due voci
  sarebbero indistinguibili nella barra di navigazione.
  *Verifica* (spec `impostazioni-vetrina` → *Icona distinta*): la nuova voce mostra l'icona invece
  del fallback, e le due sezioni si distinguono a colpo d'occhio.

- [ ] 10.2 **Terza voce in `SeedMenusSito.cs`** — sul pattern esatto delle due esistenti
  (lookup per `Percorso`, righe 85 e 119):

  | Voce | Titolo | Percorso | Icona | Pos. | `NomeVista` | `PercorsoFile` |
  |---|---|---|---|---|---|---|
  | Figlio 3 | `Impostazioni sito` | `/gestionale/sito/impostazioni` | `Store` | 3 | `ImpostazioniVetrinaPage` | `sito/ImpostazioniVetrinaPage.tsx` |

  ⚠️ `PercorsoFile` è **relativo a `src/components/pages/`**, come le due voci esistenti. Il padre
  "Sito" **non** si ricrea: è già seedato e si cerca per `Titolo == "Sito" && Percorso == string.Empty`.
  *Verifica*: `dotnet build` esce 0; le due voci preesistenti non sono toccate.

- [ ] 10.3 **Gating della voce** — `AssegnaRuoli` filtrando `.Where(r => r.Amministratore || r.Nome == "SuperAdmin")`,
  come le due voci esistenti.
  *Verifica* (spec `sicurezza` → *La voce di menu è riservata*): le righe di `ruolomenu` per la
  terza voce nominano **solo** i ruoli con flag amministrativo e il superadmin; un ruolo con
  `Amministratore = 0` non ha alcuna assegnazione (query di controllo: 0 righe). ⚠️ E **non è
  l'unico controllo**: la chiamata GraphQL diretta resta rifiutata dal backend (task 8.10).

- [ ] 10.4 **Prova di idempotenza** — su una **seconda istanza** con 🔧 `SEED_ON_STARTUP=true`,
  riavvia **tre volte**.
  *Verifica* (spec `impostazioni-vetrina` → *Tre avvii consecutivi*): i figli di "Sito" sono
  **esattamente tre**, non sei o nove; le due voci preesistenti hanno percorso, titolo e posizione
  invariati; il padre resta uno.

- [ ] 10.5 **Test di integrazione del seed dei menu** — `SeedMenusSito.Initialize` invocato tre
  volte → un padre e **tre** figli.
  *Verifica*: `dotnet test --filter "SeedMenus"` passa, e il test preesistente sulle due voci non
  è stato modificato ma solo esteso.

- [ ] 10.6 **Prova manuale della navigazione** — da amministratore, la voce compare in terza
  posizione nella sezione "Sito" e apre la pagina; da un utente non amministratore la sezione non
  mostra la voce.
  *Verifica* (spec `impostazioni-vetrina` → *La voce apre la pagina*): il caricamento dinamico del
  componente funziona con il `PercorsoFile` seminato — è l'errore classico di questo seed.

**Uscita di fase.** La sezione "Sito" ha tre voci, la terza è riservata agli amministratori e apre
la pagina delle impostazioni.

---

## Fase 11 — Chiusura: prove che non si possono automatizzare, e la suite

**Perché esiste.** Tre criteri della proposal non sono verificabili da alcun test unitario — la
raggiungibilità anonima vera, il bootstrap dell'app e il giro completo admin → sito — e quattro
decisioni sono state prese con una raccomandazione già scritta ma lasciate aperte nel design:
vanno confermate esplicitamente, non ereditate per silenzio.

- [ ] 11.1 🔴 **`curl` anonimo in produzione** 🔒 — la stessa prova del task 5.17, ripetuta contro
  l'ambiente reale dopo il deploy.
  *Verifica* (spec `sicurezza` → *Prova manuale dell'accesso anonimo*, che dice esplicitamente *"in
  sviluppo **e** in produzione"*): le tre rotte rispondono `200` a una shell senza credenziali.
  🔒 Richiede il deploy: finché non è stato fatto, questo task resta **aperto e dichiarato tale**,
  non chiuso per analogia con il task 5.17.

- [ ] 11.2 🔴 **`/api/public/business-name` e il bootstrap dell'app** — la minimal API di
  [`Program.cs:358`](../../../backend/Program.cs) è **invariata** e non è stata spostata dentro
  `PublicController`. Prova **dall'interfaccia**, non solo con `curl`: apri l'app, completa il
  login, osserva l'intestazione.
  *Verifica* (spec `sicurezza` → *Il bootstrap dell'applicazione resta intatto*): il titolo
  dell'attività è visibile in header. Il suo fallimento non rompe una pagina, rompe **l'avvio**
  ([main.tsx:43](../../../duedgusto/src/main.tsx), prima del login), ed è irraggiungibile da un
  test unitario: è una minimal API nei top-level statements.

- [ ] 11.3 **Giro completo: admin salva → il sito lo mostra** — dall'interfaccia modifica
  l'indirizzo, salva, e dopo il tempo di cache richiedi `/api/public/site`. Poi modifica l'orario
  di **chiusura** dalle impostazioni della **cassa** e verifica che il sito lo riporti, senza che
  alcun dato delle impostazioni della vetrina sia cambiato.
  *Verifica* (spec `api-pubblica` → *Un amministratore compila e il sito lo mostra*, *Un cambio di
  orario in cassa si riflette sul sito*): entrambe le prove si chiudono **dall'interfaccia e dalla
  rotta pubblica**, mai leggendo il database. È la dimostrazione che gli orari hanno **una sola
  sorgente**.

- [ ] 11.4 🔴 **La cassa e il deploy sono invariati alla lettera** — controllo finale.
  *Verifica* (spec `gestione-cassa` → *Confronto testuale vuoto sui file della cassa*; proposal
  §Success Criteria): `git diff --stat` **vuoto** su
  `backend/GraphQL/Vendite/VenditeMutations.cs`, `backend/GraphQL/Vendite/Types/ProdottoInputType.cs`
  e `backend/GraphQL/Vendite/VenditeQueries.cs`; `git diff --stat deploy/ docker-compose.yml`
  **vuoto**; i test strutturali del confine del change precedente passano **senza essere stati
  toccati** — un test del confine che va adattato per far passare una change è un confine che è
  stato spostato.

- [ ] 11.5 **Conferma delle quattro Open Questions** — annota in design.md §"Open Questions" la
  decisione presa: `/api/public/site` con la tabella vuota → **`200` con i default e un warning**;
  telefono ed email → **esposti** (dati di un'attività commerciale, già stampati sulle locandine);
  ordinamento delle categorie → **confermato** quello di §D7; irrigidimento del singleton di
  `BusinessSettings` → **fuori scope, change dedicato**, annotato come debito noto (task 3.8).
  *Verifica*: le quattro voci risultano spuntate con la decisione confermata, e la quarta ha un
  riferimento al punto del codice in cui il debito è scritto.

- [ ] 11.6 **Checklist dei Success Criteria della proposal** — ripercorri i 16 criteri di
  [proposal.md](./proposal.md) §"Success Criteria" uno per uno, con la precisazione di §D4 già
  dichiarata: `public,max-age=300` **senza spazio** è la stessa direttiva di
  `public, max-age=300`, e il criterio si verifica leggendo l'header (task 6.7), non confrontando
  una stringa.
  *Verifica*: ogni criterio ha **il numero del task** che lo chiude o una prova eseguita che lo
  dimostra; ciò che resta aperto porta il nome del task che lo chiuderà invece di essere dichiarato
  raggiunto per somiglianza.

- [ ] 11.7 **Suite completa verde e nessun test preesistente sacrificato** —
  ```bash
  dotnet test backend/DuedGusto.Tests/DuedGusto.Tests.csproj -o /tmp/dued-test
  cd duedgusto && npm run ts:check && npm run lint && npm run test
  ```
  🔧 L'opzione `-o` serve perché il backend in esecuzione dell'utente tiene bloccata `bin/`.
  *Verifica* (spec `gestione-cassa` → *Nessun conteggio di test preesistenti diminuisce*; proposal
  §Success Criteria): tutti e quattro escono 0; i conteggi si confrontano con il baseline della
  Fase 1 — **487 backend e 755 frontend** — e nessun test preesistente risulta rimosso o
  modificato per farlo passare. Le uniche modifiche ammesse a test esistenti sono l'aggiunta di
  `"vetrina"` in `SchemaEspone_TuttiIRamiRootAttesi` (task 8.5) e i nuovi casi in
  `PrivilegiAmministrativiTests` (task 8.10).

**Uscita di fase.** Le tre prove non automatizzabili sono state eseguite invece che argomentate, le
quattro decisioni aperte sono confermate per iscritto, e la suite è verde con i conteggi
confrontati con il baseline.
