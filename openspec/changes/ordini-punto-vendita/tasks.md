# Tasks: Ordini al punto vendita, gruppi di prodotti, voce in sidebar

**Change**: ordini-punto-vendita
**Riferimenti**: `proposal.md`, `design.md`, `specs/`, GitHub issue #24 (segue #19)

Convenzioni vincolanti: le `Vendita` nascono **solo** dentro `ChiudiOrdineOrchestrator`, ed è l'unico
punto del backend in cui si muove un secchio; `SecchiIncassiApplier` va sempre invocato **prima** di
`BreakdownIvaApplier`, con un `SaveChangesAsync()` obbligatorio fra la creazione delle vendite e il
breakdown; nessun campo nuovo si chiama `Resto` (il nome è già preso e significa un'altra cosa); la
guardia sulle transizioni sta nella macchina a stati, non nel chiamante.

Ordine di lavoro dalla issue: **C** (indipendente) → **infrastruttura di test** → **A** (cambio
strutturale) → **B** (dipende da A e da decisioni di listino).

---

> ### ✅ Riconciliazione con `design.md` — eseguita
>
> Questo breakdown era stato scritto quando il design integrale non era leggibile (engram troncava a
> ~2000 caratteri) e conteneva **due punti inferiti** dalle issue #24 e #19 invece che letti.
> `design.md` è ora integrale (1360 righe) ed è stato riscontrato. **Entrambe le inferenze sono
> confermate**; il design aggiunge però dettagli che i task non riportavano e che sono stati recepiti:
>
> 1. **La sorte delle `Vendita` allo storno** (task 5.7, test 9.5) — **CONFERMATO**.
>    `design.md` §«`stornaOrdine` CANCELLA le `Vendita`, non le marca» sceglie la cancellazione, con
>    la stessa motivazione dell'inferenza vista da un'altra angolazione: `BreakdownIvaApplier` fa
>    `registro.VenditeContanti = vendite.Sum(v => v.PrezzoTotale)` sulle `Vendita` **persistite**, e
>    un flag `Stornata` obbligherebbe ad aggiungere un `Where(v => !v.Stornata)` negli applier — cioè
>    «stato su `Vendita` + filtro negli applier», l'alternativa già scartata altrove, rientrata dalla
>    finestra su un percorso meno battuto.
>    **Recepito in più**: (a) le `RigaOrdine` **non si cancellano mai** — il libro mastro è l'`Ordine`;
>    (b) la traccia sta su `Ordine.StornatoDa` / `StornatoIl` / `MotivoStorno` (aggiunti a 3.1);
>    (c) `stornaOrdine` su un ordine `SPLITTATO` si **rifiuta** — si stornano i figli uno per uno, e
>    da qui lo stato `SPLITTATO` aggiunto a 3.3; (d) lo storno richiede il **ruolo amministratore**
>    (`GestioneCassaGuards.GuardUtenteAmministratore`, già esistente e usato da
>    `RiapriRegistroCassaOrchestrator`), mentre l'annullo no.
> 2. **Lo snapshot del prezzo al momento del tocco** (task 3.2, usato da 5.3) — **CONFERMATO**.
>    `design.md` §«il prezzo si congela quando la voce viene battuta, non alla chiusura» dice
>    esattamente questo: `RigaOrdine.PrezzoUnitario` e `AliquotaIva` sono presi *quando la voce entra
>    nell'ordine*, perché è il prezzo detto al cliente; la `Vendita` li eredita alla chiusura e
>    `RicalcolaImportiSnapshot` non cambia semantica. L'alternativa «prezzo corrente alla chiusura» è
>    scartata esplicitamente. **Nessuna modifica necessaria a 3.2 e 5.3.**
>
> ℹ️ La vecchia nota citava i task come 4.7 / 8.5 / 4.3: numerazione di una stesura precedente. I
> riferimenti corretti sono 5.7 / 9.5 / 5.3 e sono stati sistemati anche nelle Fasi 0 e 10.
>
> ⚠️ **Divergenze di nomenclatura residue** fra questo file e `design.md`, non sciolte qui perché non
> sono decisioni ma nomi: il design chiama `TotaleOrdine` ciò che 3.1 chiama `Totale`, `ApertoDa` /
> `ChiusoDa` ciò che 3.1 chiama `UtenteId` / `ChiusoDaUtenteId`, e colloca lo storno in un
> `StornaOrdineOrchestrator.cs` separato invece che dentro `ChiudiOrdineOrchestrator`. **Vale
> `design.md`**: in fase di apply si seguono i suoi nomi.

---

## Phase 0: Decisioni utente (nessun codice)

Nessuno di questi è un task di implementazione: sono le cinque domande poste all'utente. **Quattro su
cinque sono chiuse**; resta aperta solo 0.1, che l'utente produrrà più avanti. Ogni task marcato
**[BLOCCATO]** nelle fasi successive cita qui la decisione che lo ferma — dopo questa chiusura ne
restano **due**, entrambi in Fase 10 ed entrambi fermi sulla sola 0.1.

- [ ] 0.1 **[BLOCCATO — unica decisione ancora aperta]** Lista esatta delle varianti (~147 voci):
  nomi, codici, prezzi. **RIMANDATA dall'utente**: la produrrà lui. È una decisione di listino, non
  tecnica, e la convenzione dei codici è già fissata da #19 D2 (`CATEGORIA-NOME`, es. `BIB-COCA-33`).
  🔴 Blocca **solo i dati**, non il meccanismo: schema, migrazione, seeder parametrico, pagina di
  gestione e UI si costruiscono senza conoscere le voci. → blocca 10.1, 10.2
- [x] 0.2 **CHIUSA — `GRAPPA` e le righe 49-50 del foglio ENTRANO ORA**, nello scope di questo change.
  Il seeder delle varianti è il posto giusto e non c'è motivo di rimandarle a un secondo passaggio.
  ⚠️ La decisione «entrano» **non scioglie i due problemi originali**, li sposta dentro:
  - `GRAPPA` porta **due importi in una cella** («€ 3 / 4»). Con la decisione «ogni variante è un
    articolo a sé» il caso si risolve da solo: diventano **due articoli distinti**, uno a 3,00 € e uno
    a 4,00 €, ciascuno col proprio codice. Nessuna cella da interpretare a runtime.
  - Le righe **49-50** hanno prezzo **2,50 €** e **nessun nome**. Il nome non si inventa qui: arriva
    con la lista di 0.1. Finché non c'è, quelle due righe restano senza identità e non sono
    seminabili — sono parte di ciò che 10.1 attende.
- [x] 0.3 **CHIUSA — molti-a-molti.** L'utente ha posto il criterio: «può essere in più gruppi *se non
  è complicato*, altrimenti uno solo». **Non è complicato in questo progetto**, e il molti-a-molti è
  già la scelta di `design.md` §«gruppi molti-a-molti con entità di join esplicita». Valutazione fatta
  sul codice, non in astratto:
  - **Il pattern è già in casa, due volte.** `AppDbContext.cs:104-118` configura `Ruolo` ↔ `Menu`
    molti-a-molti con tabella di join `RuoloMenu`; e — precedente più vicino perché l'appartenenza
    **porta un dato proprio** — `backend/Models/RegistroCassaMensile.cs` è un'entità di join esplicita
    con chiave composita `{ChiusuraId, RegistroId}` e payload `Incluso`, configurata in
    `AppDbContext.cs:~1318-1341`. `ProdottoGruppo` ha esattamente quella forma: chiave composita
    `{GruppoProdottiId, ProdottoId}` più il payload `Ordinamento`.
  - **La UI di gestione ha già uno stampo.** `duedgusto/src/components/pages/roles/RoleMenus.tsx` +
    `RoleDetails.tsx` sono una pagina che assegna un molti-a-molti con AG Grid a selezione multipla:
    la pagina gruppi di 10.8 la ricalca, non la inventa.
  - **Il seed lo sa già fare.** `SeedMenus.AssegnaRuoli` popola un molti-a-molti in modo additivo.
  - **Le query non peggiorano in modo apprezzabile.** L'unico punto che costa qualcosa è «prodotti non
    raggruppati» della griglia principale (10.9): con l'1:N sarebbe `p.GruppoId == null`, col
    molti-a-molti è `!p.Gruppi.Any()`. È una anti-join su ~147 righe già interamente in cache: costo
    reale nullo, complessità di lettura trascurabile.
  - **Il costo dell'errore è asimmetrico**, ed è ciò che decide il caso dubbio: passare da 1:N a N:N
    più avanti è una migrazione **con dati dentro**; il contrario non serve mai, perché un
    molti-a-molti usato con un gruppo solo per prodotto si comporta come un 1:N.
  Le altre due domande che questo task teneva insieme sono già chiuse in `design.md` e restano tali:
  prezzo del tastone **«da X €» derivato** da `Min(prezzo dei membri attivi)`, mai persistito; ordine
  dentro il gruppo **manuale** (`ProdottoGruppo.Ordinamento`), pareggio su `Prodotto.Codice`.
  → sblocca 10.3, 10.4, 10.8, 10.9
- [x] 0.4 **CHIUSA — la voce «Vendita» è per chiunque**, non più il solo SuperAdmin.
  🔴 **Che cosa significa davvero, verificato sul codice**: il menu governa **la sola visibilità della
  voce in sidebar**; l'autorizzazione delle operazioni è un meccanismo separato e resta invariata.
  `backend/GraphQL/Vendite/VenditeMutations.cs:26` e `VenditeQueries.cs:21` chiamano `this.Authorize()`
  **a livello di tipo**: richiedono un utente autenticato, non un ruolo specifico. Quindi «per
  chiunque» = **chiunque sia autenticato**, e non apre alcun accesso anonimo.
  ℹ️ Sweep di controllo su tutti i moduli GraphQL — in questo progetto un modulo senza
  `this.Authorize()` è **pubblico per default**, perché `/graphql` è montato con
  `AuthorizationRequired = false`. Tutti i rami montati in `GraphQLQueries.cs:18-25` /
  `GraphQLMutations.cs` hanno `this.Authorize()`. **Nessuna esposizione trovata.** L'unico file senza
  la chiamata è `backend/GraphQL/Management/ManagementQueries.cs`, che è un `ObjectGraphType` **vuoto e
  non montato** in nessun ramo root: codice morto, non una porta aperta.
  ⚠️ Resta valida l'asimmetria del seed: `SeedMenus.AssegnaRuoli` solo **aggiunge** ruoli, non li
  toglie mai. Allargare ora costa un riavvio; restringere in futuro richiederebbe SQL diretto sul VPS.
  → sblocca 1.6
- [x] 0.5 **CHIUSA — Sqlite si aggiunge** al progetto di test. Senza, la guardia della transizione — il
  pezzo più critico del change — resta scoperta e il verde della CI è fuorviante.
  → sblocca 2.1, 2.2, 2.3, e con esse 9.1, 9.3, 9.5, 9.7

---

## Phase 1: C — «Vendita» al primo livello della sidebar

Indipendente da tutto il resto, nessuna migrazione, si fa subito. Il design ha trovato **tre** guasti
qui, non uno: la voce non si sposta (1.1), non nasce se manca il padre (1.2), e finirebbe comunque
nel posto sbagliato (1.3).

- [x] 1.1 `backend/SeedData/SeedMenus.cs:20` — sostituire `menu.MenuPadre = menuPadre;` con
  `menu.MenuPadreId = menuPadre?.Id;`.
  **Guasto**: il menu è caricato con `.Include(m => m.Ruoli)` soltanto, quindi la navigazione
  `MenuPadre` non è caricata. Assegnarle `null` non è visto dal change tracker, che non ha il valore
  originale da confrontare: la FK resta agganciata a Cassa, `needsUpdate` vale `true` e parte una
  UPDATE che sembra riuscita. Il confronto sulla stessa riga legge già `menu.MenuPadreId` ed è
  corretto — sbagliata è solo la scrittura.
  **Impatto sugli altri chiamanti**: nullo. Le righe 137/230/323/456 passano `null` per voci nate già
  a primo livello (FK già `null`, il ramo non si attiva); tutte le altre passano un padre tracciato,
  dove assegnare la navigazione funziona.
  **Verifica**: test 1.4, che deve essere rosso prima di questa modifica.
- [x] 1.2 `backend/SeedData/SeedMenusVendita.cs` — eliminare la lookup di `cassaMenu` e il
  `if (cassaMenu == null) return;`. Senza padre quella query non serve più, e la guardia impedirebbe
  la creazione della voce su un database in cui «Cassa» non esiste.
  **Verifica**: test 1.5, caso B.
- [x] 1.3 `backend/SeedData/SeedMenusVendita.cs` — `Posizione = 1` diventa `Posizione = 0`; togliere
  `MenuPadre = cassaMenu` dal ramo di creazione; nel ramo di aggiornamento passare `0` e `null` a
  `UpdateMenuIfNeeded`. Aggiornare il commento XML in testa al file, che oggi descrive la voce come
  figlia di Cassa in posizione 1 e diventerebbe una bugia.
  **Perché 0 e non 1**: a primo livello `SeedMenus` occupa già Dashboard=1, Cassa=2, Fornitori=3,
  Utenti=4, Ruoli=5, Menù=6, Impostazioni=7, (8), Sito=9. `AuthenticationDataLoaders.cs:123` ordina
  con `OrderBy(m => m.Posizione)` **senza tie-break**: a parità con Dashboard l'ordine sarebbe
  incidentale, non «in alto». 0 è l'unico posto libero sopra.
  **Verifica**: test 1.5, caso C.
- [x] 1.4 Nuovo `backend/DuedGusto.Tests/Integration/SeedMenusVenditaTests.cs` — test di regressione
  del padre: voce «Vendita» preesistente con `MenuPadreId = idCassa` e `Posizione = 1`; dopo il seed,
  rileggendo da un **DbContext nuovo** (o dopo `ChangeTracker.Clear()`), `MenuPadreId == null` e
  `Posizione == 0`.
  ⚠️ Senza il contesto nuovo la identity map maschera il no-op e il test passa anche **prima** della
  correzione 1.1, cioè non prova nulla.
  **Verifica**: eseguire il test contro `SeedMenus.cs` non ancora corretto e constatare che è rosso;
  poi applicare 1.1 e constatare che diventa verde.
- [x] 1.5 Stesso file — due casi ulteriori: **B)** su un database privo del menu «Cassa» la voce viene
  creata comunque (copre 1.2); **C)** nessun'altra voce di primo livello ha `Posizione == 0`, e
  «Vendita» è la prima in `OrderBy(m => m.Posizione)` (copre 1.3).
  InMemory basta per tutta la fase: nessuna transazione, nessun token di concorrenza, nessun indice
  unico in gioco.
  **Verifica**: `cd backend && dotnet test --filter SeedMenusVendita`.
- [x] 1.6 **[SBLOCCATO da 0.4 — «per chiunque»]** `backend/SeedData/SeedMenusVendita.cs` — ruoli della
  voce. Oggi `Ruoli = [superAdminRuolo]`: va allargata a **tutti i ruoli**, perché la vendita non è
  amministrativa (#19 Fase 8) e la voce sta in cima alla sidebar.
  Usare `SeedMenus.AssegnaRuoli` — è l'helper che lo fa già, ed è additivo — su **tutti** i ruoli
  esistenti, non sul solo sottoinsieme con flag `Ruolo.Amministratore` (quello è il criterio di
  `SeedMenusSito`, che è una sezione amministrativa: qui sarebbe la restrizione che 0.4 toglie).
  🔴 **Il menu è visibilità, non autorizzazione**: allargare la voce non allarga nulla lato dati.
  `VenditeMutations` e `VenditeQueries` hanno `this.Authorize()` a livello di tipo e continuano a
  richiedere un utente autenticato. Non aggiungere né togliere `Authorize` qui.
  ⚠️ Irreversibile a buon mercato: `AssegnaRuoli` non toglie mai un ruolo, quindi un restringimento
  futuro richiede SQL diretto sul VPS.
  **Verifica**: test che, dato un utente con un ruolo **non** amministrativo, la voce «Vendita»
  compare fra i suoi menu; e che un ruolo creato dopo il seed non la perde al riavvio successivo.
- [x] 1.7 Verifica in esecuzione: `cd backend && dotnet run`, login, la voce «Vendita» è la prima
  della sidebar con icona `ShoppingCart`. Il seed gira all'avvio e `UpdateMenuIfNeeded` propaga la
  correzione senza toccare il database a mano.
  ⚠️ `ShoppingCart` è già in `duedgusto/src/components/layout/sideBar/iconMapping.tsx:7,45`. Un'icona
  assente da quella lista non dà errore: la voce comparirebbe senza icona e ce ne si accorgerebbe
  solo guardando la barra.

---

## Phase 2: Infrastruttura di test — Sqlite per la guardia di transizione

Va prima di A, perché senza questa fase il pezzo più importante del change (la transizione che muove
i secchi una volta sola) resta **senza rete**.

- [x] 2.1 **[SBLOCCATO da 0.5 — Sqlite si aggiunge]** `backend/DuedGusto.Tests/DuedGusto.Tests.csproj` — aggiungere
  `Microsoft.EntityFrameworkCore.Sqlite`; `backend/DuedGusto.Tests/Helpers/TestDbContextFactory.cs` —
  aggiungere `CreateSqlite()` con una `SqliteConnection("DataSource=:memory:")` aperta e **tenuta
  viva** per la durata del test (se la connessione si chiude, il database sparisce), più
  `EnsureCreated()`. Riusare il mock di `IConfiguration` già presente nella factory, che aggira il
  guard `if (!optionsBuilder.IsConfigured)` di `AppDbContext.OnConfiguring`.
  **Perché serve**: `TestDbContextFactory.Create()` usa InMemory, che (a) rende
  `BeginTransactionAsync` un no-op — è soppresso esplicitamente con
  `InMemoryEventId.TransactionIgnoredWarning` — quindi «lo split è atomico» non è dimostrabile;
  (b) ~~**non applica i token di concorrenza**~~ → 🔴 **SMENTITO, misurato**: su EF Core 8.0.13
  InMemory **applica** i token dichiarati con `IsConcurrencyToken()` e lancia
  `DbUpdateConcurrencyException` esattamente come Sqlite (`InMemoryTable.Update`). La ragione vera è
  un'altra ed è più forte: **`ExecuteUpdateAsync` non è proprio supportata da InMemory**, quindi la
  guardia di 5.1 — che *conta le righe toccate* da una UPDATE condizionata — non sarebbe nemmeno
  eseguibile lì. Entrambi i fatti sono pinnati da un test, così che l'affermazione sbagliata non
  torni; (c) **non applica gli indici unici**, quindi anche la corsa sul numero d'ordine (5.4)
  resterebbe scoperta.
  ✅ **Fatto**: pacchetto `Microsoft.EntityFrameworkCore.Sqlite` 8.0.13 (stessa versione di InMemory,
  affiancato e non sostitutivo — i test esistenti restano su `Create()`); tre metodi nuovi in
  `TestDbContextFactory`: `CreateSqliteConnection()` (connessione aperta, di proprietà del test),
  `CreateSqlite(SqliteConnection)` (n contesti sullo stesso database, per i test di concorrenza) e
  `CreateSqlite()` (contesto proprietario della connessione, per il caso a contesto singolo). Il mock
  di `IConfiguration` è stato estratto in `CreateConfigurationMock()` e condiviso fra i due provider.
- [x] 2.2 **[SBLOCCATO da 0.5]** Neutralizzare le default MySQL-only, o `EnsureCreated()` non parte
  affatto. `backend/DataAccess/AppDbContext.cs` usa
  `HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")` su **14 entità** —
  `RegistroCassa` riga 228, `Vendita` riga 990, `Prodotto` riga 403, `MediaAsset`, `Fornitore`,
  `FatturaAcquisto`, `DocumentoTrasporto`, `PagamentoFornitore`, … — che è sintassi MySQL, e
  `EnsureCreated()` la emette dentro la `CREATE TABLE`: Sqlite la rifiuta.
  Due strade: un `IModelCustomizer` di test che azzeri `DefaultValueSql` su tutte le proprietà del
  modello, oppure un ramo condizionale sul provider in `OnModelCreating`. La prima non tocca il
  codice di produzione ed è preferibile.
  ℹ️ `HasCharSet("utf8mb4")` è invece un'annotazione Pomelo che il provider Sqlite ignora senza danni:
  non va toccata. **Confermato in esecuzione**: nessun intervento necessario, lo schema si costruisce.
  ✅ **Fatto — scelta la prima strada**, `backend/DuedGusto.Tests/Helpers/SqliteTestModelCustomizer.cs`
  (deriva da `RelationalModelCustomizer`, registrato con `.ReplaceService<IModelCustomizer, …>()`).
  La ragione che decide non è «non tocca la produzione» ma che **è generico invece che enumerativo**:
  spazza l'intero modello cercando `DefaultValueSql`, quindi copre da solo `Ordine`, `RigaOrdine` e
  `GruppoProdotti` quando arriveranno. Un ramo `if (Database.IsSqlite())` andrebbe esteso a mano a
  ogni entità nuova, e chi se ne dimenticasse scoprirebbe il guasto solo vedendo la factory smettere
  di partire.
  ⚠️ **Effetto collaterale recepito, non previsto dal task**: azzerare la sola `DefaultValueSql` non
  basta. `HasDefaultValueSql` impone anche `ValueGenerated`, e senza toglierlo EF continuerebbe a
  considerare `CreatedAt`/`UpdatedAt` generate dal database, omettendole dalla INSERT: su Sqlite,
  senza più una default, la colonna resterebbe NULL e la rilettura di un `DateTime` non nullable
  fallirebbe. Il customizer imposta quindi anche `ValueGenerated.Never`. **Conseguenza per chi scrive
  test Sqlite**: i timestamp valgono ciò che scrive l'applicazione, non vengono riempiti dal database.
- [x] 2.3 **[SBLOCCATO da 0.5]** Test di riscontro della factory in
  `backend/DuedGusto.Tests/Helpers/` o in un `Unit/Infrastructure/TestDbContextFactoryTests.cs`:
  `CreateSqlite()` costruisce lo schema senza eccezioni; inserire due `Prodotto` con lo stesso
  `Codice` fa fallire il secondo (l'indice unico di `AppDbContext.cs:411` viene davvero applicato);
  una transazione esplicita con rollback non lascia traccia.
  ⚠️ **Limite da accettare**: Sqlite non riproduce `SELECT … FOR UPDATE`. Se la guardia di 5.1
  finisce pessimistica invece che ottimistica, questa infrastruttura non la prova comunque — la forma
  della guardia decide se questa fase basta.
  ✅ **Fatto**: `backend/DuedGusto.Tests/Unit/Infrastructure/TestDbContextFactorySqliteTests.cs`,
  **10 test**, ciascuna capacità con accanto il suo contrasto su InMemory:
  schema costruito e riletto da un contesto nuovo · indice unico applicato **↔** InMemory accetta il
  duplicato · rollback senza traccia **↔** su InMemory il rollback non annulla nulla · UPDATE
  condizionata che tocca 1 riga la prima volta e 0 la seconda (la forma esatta della guardia di 5.1)
  **↔** `ExecuteUpdateAsync` non supportata da InMemory · token di concorrenza onorato, su un modello
  minimo di prova perché `Ordine.RowVersion` non esiste ancora **↔** InMemory lo onora anch'esso
  (la smentita di 2.1b, fissata da un test perché non torni).
  Il limite «righe toccate ≠ locking InnoDB sotto `REPEATABLE READ`» è scritto **dentro** il file,
  nel commento di testa e accanto al test della guardia: chi legge il verde sa cosa non copre.
  **Verifica eseguita**: `cd backend && dotnet build` → 0 errori, 0 warning;
  `cd backend && dotnet test` → **878/878 verdi** (868 preesistenti + 10 nuovi, nessuno rotto).
- [x] 2.4 **[AGGIUNTO DOPO IL FATTO — il guasto era già successo]** Rete che accorge la suite quando
  il **modello** e le **migrazioni** divergono:
  `backend/DuedGusto.Tests/Unit/Infrastructure/MigrazioniAllineateAlModelloTests.cs` (2 test) più
  `TestDbContextFactory.CreateMySqlSoloMetadati()`.
  **Perché serve — non è un'ipotesi, è la cronaca della Fase 3.** 3.x ha aggiunto
  `GestioneCassaGuards.GuardNessunOrdineSulRegistro`, che interroga la tabella `Ordini`, e la
  migrazione che quella tabella la crea è arrivata (correttamente) solo in Fase 4. Nel mezzo la suite
  era a **891 verdi** e `eliminaRegistroCassa` era rotta su **ogni** database reale con
  `MySqlException: Table 'duedgusto.ordini' doesn't exist`. Nessun test poteva accorgersene: tutta la
  suite costruisce lo schema con `EnsureCreated()` **dal modello**, che ignora del tutto
  `Migrations/`. `Migrate()` non è chiamato da nessuna parte — e non può esserlo su InMemory o
  Sqlite, perché le migrazioni sono MySQL-specifiche (Pomelo: `varchar(20)`, `MySql:CharSet`,
  `MySql:ValueGenerationStrategy`).
  **Strada scelta e perché.** Confronto **modello ↔ snapshot senza database**, con lo stesso servizio
  che `dotnet ef migrations add` usa per decidere cosa scrivere (`IMigrationsModelDiffer`; il comando
  `dotnet ef migrations has-pending-model-changes` esiste solo da EF 9, qui si è su 8.0.13). Il
  contesto è costruito **sul provider MySQL** ma non apre mai una connessione: il confronto è
  provider-specifico, e farlo con un modello finalizzato da InMemory o Sqlite produrrebbe differenze
  finte. La strada alternativa — `Migrate()` su MySQL vero — copre di più ma è **impraticabile in
  CI**: `.github/workflows/deploy.yml` esegue `dotnet test` su `ubuntu-latest` senza alcun servizio
  database, quindi renderebbe la pipeline rossa o andrebbe marcata skippabile, e un test che si salta
  da solo non protegge da niente.
  ✅ **Fatto**: (1) `IlModelloNonDeveAvereModificheSenzaMigrazione` — il modello di oggi non deve
  produrre altre operazioni rispetto allo snapshot; (2) `LoSnapshotDeveCorrispondereAllUltimaMigrazione`
  — intercetta il caso diverso di una migrazione persa in un merge o in un `migrations remove` a metà,
  dove modello e snapshot restano d'accordo fra loro e sbagliati entrambi. Il messaggio di fallimento
  dice **cosa fare** (`dotnet ef migrations add <Nome>`) ed elenca le operazioni mancanti in chiaro
  («colonna nuova: `Ordini.X`», «tabella nuova: `Ordini`»), non i nomi delle classi.
  **Provati rossi, non solo scritti**: (a) aggiunta una proprietà a `Ordine` senza migrazione → il
  test 1 fallisce con `colonna nuova: Ordini.ProvaGuastoMigrazioneMancante`, il test 2 resta verde
  (giustamente: lo snapshot non è stato toccato); (b) rimossa l'ultima migrazione lasciando lo
  snapshot → il test 2 fallisce elencando `tabella nuova: Ordini`, `RigheOrdine`, `colonna nuova:
  Vendite.OrdineId`, il test 1 resta verde. Entrambe le condizioni ripristinate.
  ⚠️ **Ritrovamento collaterale**: i modelli intermedi delle migrazioni **non si concatenano** in
  questo repository — il Designer di `20260813153823_AddMetodoPagamentoVendita` non conosce le colonne
  `ImmagineEroe*` introdotte da `20260813141525_SlotImmaginiPagineVetrina`, che ha id *precedente*
  (rami paralleli fusi in ordine). È innocuo in esecuzione, ma è il motivo per cui il test 2 confronta
  solo l'**ultima** migrazione con lo snapshot: un test sulla catena completa nascerebbe rosso su
  storia passata.
  🔴 **Cosa questa copertura NON intercetta** (scritto anche dentro il file, perché chi legge il verde
  lo sappia): prova che una migrazione *esista*, non che *funzioni*. Non applica lo SQL a un server,
  quindi non vede una `AddColumn NOT NULL` senza default su tabella piena, una FK verso righe orfane,
  un indice troppo lungo per il charset; non vede i dati; non vede viste, trigger o indici creati a
  mano fuori dal modello EF; non dice se la **produzione** è aggiornata, solo se il codice è coerente
  con sé stesso; ed è cieca al caso in cui modello *e* snapshot sbagliano allo stesso modo. Quella
  copertura richiede `Migrate()` su MySQL vero in CI, che oggi non c'è.

---

## Phase 3: A — Modello dati (entità e configurazione)

- [x] 3.1 Nuovo `backend/Models/Ordine.cs` — `Id`, `RegistroCassaId`, `Numero` (progressivo per
  registro), `SuffissoSplit` (`string.Empty` se non splittato, `"A"`/`"B"`/… per i figli), `Stato`,
  `MetodoPagamento` (`null` finché aperto), `ContanteRicevuto` (`decimal?`), `Totale` (snapshot alla
  chiusura), `UtenteId`, `ChiusoIl`/`ChiusoDaUtenteId`,
  `AnnullatoIl`/`AnnullatoDaUtenteId`/`MotivoAnnullamento`,
  **`StornatoIl`/`StornatoDaUtenteId`/`MotivoStorno`**, `OrdinePadreId` (self-FK, provenienza
  dello split), `CreatedAt`/`UpdatedAt`, `RowVersion` (token di concorrenza, vedi 5.1).
  ℹ️ **I tre campi di storno vengono dalla riconciliazione con `design.md`** (vedi la nota in testa):
  poiché lo storno **cancella** le `Vendita`, l'unica traccia dell'incasso disfatto vive qui e sulle
  `RigaOrdine`, che non si cancellano mai. Senza questi campi lo storno sarebbe muto.
  ⚠️ `design.md` usa i nomi `TotaleOrdine`, `ApertoDa`, `ChiusoDa`, `AnnullatoDa`, `StornatoDa`: in
  fase di apply valgono quelli.
  🔴 **Nome**: non chiamarlo `Resto`. `RegistroCassa.Resto` esiste già ed è la colonna AG del foglio
  («Ecc al netto delle spese con scontrino»), e `RiepilogoCards` è il riferimento vincolante per
  quelle formule. Si persiste `ContanteRicevuto`; il resto da dare è `ContanteRicevuto − Totale`,
  calcolato, mai persistito, e non tocca alcun secchio: è un aiuto all'operatore, non un dato
  contabile.
  `Numero` + `SuffissoSplit` è anche l'**identificativo stampabile** che la issue chiede di prevedere
  fin da subito, pur non implementando la stampa ora.
  **Verifica**: `dotnet build` pulito; XML doc su `ContanteRicevuto` che spiega perché non si chiama
  `Resto`.
  ✅ **Fatto** — nomi di `design.md`: `OrdineId`, `TotaleOrdine`, `ApertoDa`/`ApertoIl`,
  `ChiusoDa`/`ChiusoIl`, `AnnullatoDa`/`AnnullatoIl`/`MotivoAnnullamento`,
  `StornatoDa`/`StornatoIl`/`MotivoStorno`, più `Note` e le navigazioni
  `RegistroCassa`/`OrdinePadre`/`Figli`/`Righe`/`Vendite`.
  🔴 **`RowVersion` NON è stato aggiunto, e non è una dimenticanza.** `design.md` §«la guardia della
  transizione è `IsConcurrencyToken()` su `Ordine.Stato`» non usa affatto un `RowVersion`: il token è
  lo **stato stesso**, gestito dall'applicazione. È anche l'unica forma realizzabile qui — la Fase 2
  ha misurato che *nessuno* dei due motori genera un `rowversion` da sé (MySQL non ha il tipo, Sqlite
  nemmeno), quindi una colonna `RowVersion` sarebbe rimasta ferma al suo valore iniziale e la guardia
  avrebbe **finto** di funzionare. La scelta della Fase 5 resta libera: il token su `Stato` non
  esclude né la UPDATE condizionata con conteggio righe né altro.
  ⚠️ **`SuffissoSplit` è `string` NON nullable** (`string.Empty` di default), come dice questo task e
  **non** come lo dichiara `design.md` (`string?`). Non è un dettaglio di stile: in MySQL — e in
  Sqlite — più `NULL` sono **distinti** dentro un indice unico, quindi con la colonna nullable la
  terna `(RegistroCassaId, Numero, NULL)` sarebbe duplicabile in silenzio e l'indice di 3.4
  smetterebbe di proteggere proprio il caso normale, l'ordine non splittato. → `design.md` va
  corretto qui.
- [x] 3.2 Nuovo `backend/Models/RigaOrdine.cs` — `Id`, `OrdineId`, `ProdottoId`, `Quantita`,
  `PrezzoUnitario` (snapshot al tocco), `PrezzoTotale`, `AliquotaIva` (snapshot), `Note`,
  `CreatedAt`.
  **Non** portare `Imponibile`/`ImportoIva` sulla riga: lo scorporo resta in un punto solo,
  `VenditeMutations.RicalcolaImportiSnapshot`, e avviene sulla `Vendita` alla chiusura.
  ✅ **Riscontrato con `design.md`** (§«il prezzo si congela quando la voce viene battuta, non alla
  chiusura»): lo snapshot è preso **quando la voce entra nell'ordine**, perché è il prezzo detto al
  cliente; un ritocco di listino a ordine aperto non cambia il conto sotto al cliente. La `Vendita`
  eredita entrambi i valori alla chiusura. Non era un'inferenza sbagliata: **nessuna modifica**.
  ⚠️ `Quantita` è `decimal`, non `int`, come `Vendita.Quantita`.
  **Verifica**: `dotnet build` pulito; test che modificare `Prodotto.Prezzo` con l'ordine aperto non
  cambia il totale dell'ordine né l'importo della `Vendita` generata alla chiusura.
  ✅ **Fatto** — `RigaOrdineId`, `OrdineId`, `ProdottoId`, `Quantita` (`decimal`), `PrezzoUnitario`,
  `AliquotaIva`, `PrezzoTotale`, `Note`, `DataOra`, `CreatedAt`/`UpdatedAt`, navigazioni `Ordine` e
  `Prodotto`. Nessun `Imponibile`/`ImportoIva`, come richiesto.
  ⏳ Il test sullo snapshot del prezzo **non è scrivibile qui**: richiede la chiusura, cioè la Fase 5.
  Resta a carico di 9.2.
- [x] 3.3 Nuovo `backend/Common/StatiOrdine.cs` — costanti `Aperto`, `Chiuso`, `Annullato`,
  **`Splittato`**, `Stornato`, più `Ammessi` e `IsAmmesso`, sullo stampo esatto di
  `backend/Common/MetodiPagamentoVendita.cs`. Le transizioni ammesse vanno documentate qui in XML doc,
  perché è il posto dove le si cerca.
  ℹ️ **`SPLITTATO` viene dalla riconciliazione con `design.md`**: la macchina a stati è
  `APERTO → {CHIUSO | SPLITTATO | ANNULLATO}` e `CHIUSO → STORNATO`. Un padre `SPLITTATO` non muove
  secchi (li muovono i figli, che nascono `CHIUSO`) e **non è stornabile** — vedi 5.7.
  **Verifica**: test unitario che `IsAmmesso` rifiuta una stringa fuori insieme e accetta tutti e
  cinque gli stati.
  ✅ **Fatto**, con la macchina a stati in XML doc sulla classe (diagramma + tabella «quale stato ha
  mosso i secchi»), e il perché di `SPLITTATO` scritto sulla costante: senza, il padre di uno split
  resterebbe `APERTO` per sempre e bloccherebbe la chiusura di cassa su un incasso già dichiarato dai
  figli. Test in `backend/DuedGusto.Tests/Unit/Common/StatiOrdineTests.cs` (**13 casi**): i cinque
  stati accettati, sei stringhe fuori insieme rifiutate — compresi `null`, `"aperto"` minuscolo e
  `"DRAFT"`, che è uno stato del *registro* — e `Ammessi` pinnato a cinque voci senza duplicati.
- [x] 3.4 `backend/DataAccess/AppDbContext.cs` — `DbSet<Ordine> Ordini`,
  `DbSet<RigaOrdine> RigheOrdine`, e in `OnModelCreating`:
  `entity.HasIndex(x => new { x.RegistroCassaId, x.Numero, x.SuffissoSplit }).IsUnique();`
  — 🔴 è il meccanismo di **correttezza** del numero d'ordine, non un'ottimizzazione: vedi 5.4.
  `entity.HasIndex(x => new { x.Stato, x.RegistroCassaId });` per l'elenco degli aperti.
  FK `Ordine → RegistroCassa` con `DeleteBehavior.Restrict`, e `EliminaRegistroCassaOrchestrator`
  deve rifiutare un registro con ordini invece di portarseli via in cascata.
  `RowVersion` come token di concorrenza. Tipi decimal coerenti col resto del file.
  ⚠️ **Non** aggiungere `HasDefaultValueSql` MySQL-only su queste entità: peggiorerebbe 2.2.
  **Verifica**: `dotnet build`; il DDL della migrazione 4.1 riporta l'indice unico.
  ✅ **Fatto**, con quattro scostamenti da questa stesura, tutti verificati sullo schema realmente
  generato (`EnsureCreated()` su Sqlite, riletto da `sqlite_master`):
  1. **Il token di concorrenza è `Stato`**, non un `RowVersion`: `IsConcurrencyToken()` su
     `Ordine.Stato`, come vuole `design.md`. Vedi la nota di 3.1.
  2. **L'indice per l'elenco è `(RegistroCassaId, Stato)`** e non `(Stato, RegistroCassaId)`: è
     l'ordine scelto da `design.md`. ⚠️ Da rivedere in 6.5, che interroga gli aperti **su tutti i
     registri** (trappola mezzanotte): quella query non ha il prefisso dell'indice. Su questi volumi
     non costa nulla, ma è meglio deciderlo che scoprirlo.
  3. **`HasDefaultValueSql("CURRENT_TIMESTAMP …")` su `CreatedAt`/`UpdatedAt` è stato messo**, contro
     l'avvertenza qui sopra e in accordo con `design.md`. L'avvertenza era scritta prima che 2.2
     scegliesse la strada **generica**: `SqliteTestModelCustomizer` spazza l'intero modello cercando
     `DefaultValueSql` e copre da sé le entità nuove — è scritto nel suo commento di testa. Ometterle
     avrebbe reso queste due tabelle le uniche due su 16 senza default a livello di colonna, senza
     alcun guadagno. **Riscontrato**: la suite Sqlite resta verde e le tabelle si costruiscono.
  4. **`Vendita.OrdineId` (`int?`) + navigazione `Ordine` sono stati aggiunti qui**, con FK
     `Restrict` e indice. Non erano in questo task ma sono nella tabella «Modifiche a entità
     esistenti» di `design.md`, e senza di essi la navigazione `Ordine.Vendite` avrebbe comunque
     prodotto una FK **ombra** con lo stesso nome — cioè la stessa colonna, ma non configurabile e
     non leggibile dal codice. Lo storno (5.7) ne ha bisogno per ritrovare le vendite da cancellare.
     ⚠️ Ricade su 4.2: la migrazione **tocca** una tabella esistente (`ALTER TABLE Vendite ADD
     OrdineId`), come del resto prevede `design.md` §«Due migrazioni, non una». La formula «non tocca
     quelle esistenti» di 4.2 va letta come «nessuna riga esistente viene modificata».
  🔴 **Debito aperto fino alla Fase 4**: `GestioneCassaGuards.GuardNessunOrdineSulRegistro` —
  aggiunta come chiede questo task e invocata da `EliminaRegistroCassaOrchestrator` — **interroga
  `Ordini`**. Su un database il cui schema non ha ancora la tabella (cioè ogni database finché 4.1
  non è applicata) `eliminaRegistroCassa` fallisce. Non è una regressione da correggere: è la ragione
  per cui 4.1 va eseguita subito dopo, e il backend applica le migrazioni da solo all'avvio.

---

## Phase 4: A — Migrazione database

Separata dal codice applicativo, come richiede `openspec/config.yaml`.

- [x] 4.1 `cd backend && dotnet ef migrations add AddOrdiniPuntoVendita`.
  ⚠️ **Nome corretto in `AddOrdiniPuntoVendita`**, non `OrdiniPuntoVendita`: questa stesura divergeva
  da `design.md` §«Due migrazioni, non una» e dalla tabella dei file (`*_AddOrdiniPuntoVendita.cs`).
  Vale il design, come per ogni altra divergenza di nomenclatura di questo change.
  **Verifica**: il file generato crea le due tabelle nuove **e aggiunge `Vendite.OrdineId`** — vedi
  la correzione in 4.2.
  ✅ **Fatto**: `backend/Migrations/20260828173716_AddOrdiniPuntoVendita.cs` (+ `.Designer.cs`).
  `AppDbContextModelSnapshot.cs` aggiornato in modo **puramente additivo** (216 righe aggiunte, 0
  rimosse: nessuna entità preesistente è stata ridisegnata di rimbalzo).
  ℹ️ `dotnet ef` locale è **10.0.3** mentre il progetto gira su EF Core **8.0.13**: i tool guidano il
  provider dell'app, non lo sostituiscono. Riscontrato sull'annotazione `ProductVersion` del file
  generato, che è `8.0.13` come tutte le migrazioni precedenti.
- [x] 4.2 Riscontro a mano del DDL generato in `backend/Migrations/`: l'indice unico
  `(RegistroCassaId, Numero, SuffissoSplit)` è presente; la FK verso `RegistriCassa` è `RESTRICT` e
  non `CASCADE`; `Down()` è simmetrico e droppa entrambe le tabelle; **nessuna istruzione sui dati
  esistenti**, perché non c'è nulla da migrare.
  🔴 **Due correzioni a questa stesura, entrambe necessarie perché presa alla lettera farebbe passare
  una verifica sbagliata:**
  1. **«non tocca quelle esistenti» (4.1) va letto «nessuna riga esistente viene modificata».** La
     migrazione **tocca `Vendite`**: `ALTER TABLE Vendite ADD OrdineId int NULL`, più
     `IX_Vendite_OrdineId` e `FK_Vendite_Ordini_OrdineId`. È previsto da `design.md` §«Due
     migrazioni, non una» ed è già annotato nello scostamento 4 di 3.4. Chi verificasse «solo tabelle
     nuove» darebbe per buona una migrazione a cui manca metà del lavoro.
  2. **Il token di concorrenza non è una colonna `RowVersion`: è `Stato`.** `RowVersion` non esiste
     in `Ordine` e non è una dimenticanza — vedi la nota di 3.1: nessuno dei due motori genera un
     `rowversion` da sé, quindi la colonna sarebbe rimasta ferma e la guardia avrebbe **finto** di
     funzionare. Nel DDL il token si riconosce da `Stato varchar(20) NOT NULL DEFAULT 'APERTO'`.
  **Verifica eseguita — sullo schema reale, non sul solo file `.cs`:**
  - `dotnet build` → 0 errori, 0 warning.
  - Backend avviato: log `Applying migration '20260828173716_AddOrdiniPuntoVendita'`, seguito da
    `ALTER TABLE Vendite ADD OrdineId`, `CREATE TABLE Ordini`, `CREATE TABLE RigheOrdine`,
    `CREATE UNIQUE INDEX IX_Ordini_RegistroCassaId_Numero_SuffissoSplit`, e la riga in
    `__EFMigrationsHistory`. **Si applica da sola all'avvio**, come previsto.
  - `SHOW CREATE TABLE` su MySQL: `SuffissoSplit varchar(2) NOT NULL DEFAULT ''` (non nullable, come
    impone 3.1), `UNIQUE KEY IX_Ordini_RegistroCassaId_Numero_SuffissoSplit`, FK
    `Ordini→RegistriCassa` **RESTRICT**, `Ordini→Ordini` (padre) **RESTRICT**, `RigheOrdine→Ordini`
    **CASCADE**, `RigheOrdine→Prodotti` **RESTRICT**, `Vendite→Ordini` **RESTRICT**.
  - 🔴 **L'indice unico è stato provato, non dedotto**: due INSERT con la stessa terna e
    `SuffissoSplit` lasciato al default, dentro una transazione poi annullata → il secondo fallisce
    con `Duplicate entry '629-1-' for key 'IX_Ordini_RegistroCassaId_Numero_SuffissoSplit'`. La
    stringa vuota **entra nella chiave**: è esattamente ciò che con la colonna nullable non
    sarebbe successo, ed è il caso normale (ordine non splittato).
  - 🔴 **`eliminaRegistroCassa` è tornata a funzionare**, che è la ragione dell'urgenza di questa
    fase. Prima della migrazione la mutation rispondeva
    `MySqlException: Table 'duedgusto.ordini' doesn't exist` (il debito aperto in coda a 3.4); dopo,
    su un registro DRAFT senza ordini restituisce `true` e il registro sparisce, e su un registro con
    un ordine restituisce l'errore parlante di `GuardNessunOrdineSulRegistro` invece del 500 opaco
    del database.

---

## Phase 5: A — Chiusura dell'ordine, guardia, transizioni

Il cuore del change. Qui vive l'unica scrittura sui secchi di tutto il backend.

> ### ✅ Fase completata — 5.1-5.7, più i test 9.1-9.5 e 9.7
>
> **File nuovi**: `backend/GraphQL/Vendite/TransizioneOrdine.cs` (la guardia, punto unico),
> `ApriOrdineOrchestrator.cs`, `ChiudiOrdineOrchestrator.cs`, `AnnullaOrdineOrchestrator.cs`,
> `StornaOrdineOrchestrator.cs`, `Types/ChiudiOrdineInput.cs`. **Modificato**: `Program.cs` (DI).
> **Nessun cambio al modello dati**, quindi nessuna migrazione nuova.
>
> **La decisione aperta è chiusa**: la guardia è il **token di concorrenza su `Ordine.Stato`** — vedi
> 5.1 e `design.md` §«la guardia della transizione», entrambi aggiornati.
>
> 🔴 **Ogni protezione è stata vista fallire**, non solo scritta: token rimosso → la corsa incassa due
> volte; `SaveChanges` spostato dopo il breakdown → la ripartizione IVA resta indietro di un ordine in
> silenzio; transazione tolta → due figli orfani sopravvivono a uno split fallito; retry disattivato →
> l'apertura muore sulla collisione. Tutte ripristinate.
>
> **Verifica**: `dotnet build` → 0 errori, 0 warning; `dotnet test` → **933/933** (893 + 40 nuovi).

- [x] 5.1 Guardia di transizione, in `backend/GraphQL/Vendite/` accanto all'orchestrator.
  **Requisito**: due chiusure concorrenti sullo stesso ordine devono produrre **una** chiusura e un
  errore pulito, mai due delta. È il punto più importante del change, perché
  `SecchiIncassiApplier.ApplicaDelta` è dichiarato non idempotente per costruzione: applicarlo due
  volte raddoppia l'importo e nessun controllo a valle se ne accorge.
  🔴 Un read-then-write **non basta**: sotto REPEATABLE READ (isolamento di default di MySQL) leggere
  `Stato = APERTO` e poi scrivere non impedisce al secondo scrittore di fare lo stesso.
  La guardia sta nella **macchina a stati**, non nel chiamante — richiesta esplicita della issue #24 —
  e vale per tutte e tre le transizioni: chiusura, annullo, storno.
  ✅ **Fatto** — `backend/GraphQL/Vendite/TransizioneOrdine.cs`, punto unico attraversato da tutte e
  tre le transizioni: `GuardStatoAtteso` (diagnosi anticipata, parlante, **non** la guardia),
  `SalvaTransizioneAsync` (il `SaveChanges` che fa scattare il token e traduce il conflitto in
  `ExecutionError`), `Identificativo` (`{data:yyMMdd}-{numero:D3}[-{suffisso}]`, derivato).
  🔴 **La forma era la decisione aperta della fase, ed è chiusa: token di concorrenza su
  `Ordine.Stato`**, non `ExecuteUpdateAsync` con conteggio delle righe. La stesura qui sopra diceva
  «token di concorrenza (`RowVersion`) **più** UPDATE condizionata»: sono **due strade alternative**,
  non due pezzi dello stesso meccanismo, e `RowVersion` per giunta non esiste — vedi 3.1. Le ragioni
  per esteso sono in `design.md` §«la guardia della transizione», aggiornata; in breve: (a) il
  confronto avviene dentro un `SaveChanges` che **serve comunque**, quello che scrive metodo, totale,
  orario e crea le vendite; (b) `ExecuteUpdateAsync` **scavalca il change tracker** e lascerebbe
  l'ordine in memoria con lo stato vecchio, imponendo un `Reload()` che il prossimo bugfix dimentica;
  (c) il token gira su **entrambi** i provider, mentre `ExecuteUpdateAsync` non è supportata da
  InMemory; (d) il `WHERE` lo genera EF dal valore **effettivamente letto**, invece di farlo ridigitare
  in ognuna delle tre transizioni.
  **Verifica eseguita — provata rossa, non solo scritta**: rimuovendo `.IsConcurrencyToken()` da
  `AppDbContext`, `DueChiusureConcorrenti_UnaSolaVinceEIlSecchioSiMuoveUnaVolta` fallisce con «No
  exception was thrown» (il secondo dispositivo incassa una seconda volta). Annotazione ripristinata.
  ⚠️ **Ritrovamento**: `MigrazioniAllineateAlModelloTests` **resta verde** senza il token —
  `IsConcurrencyToken` non cambia il DDL, quindi il differ non produce operazioni. La rete che
  protegge l'annotazione è solo quel test di concorrenza. Annotato anche in `design.md`.
- [x] 5.2 Nuovo `backend/GraphQL/Vendite/ChiudiOrdineOrchestrator.cs` — scheletro, dipendenze
  (`IUnitOfWork`, `ChiusuraMensileService`, `IEventBus`, sullo stampo di
  `ChiudiRegistroCassaOrchestrator`), caricamento di ordine + righe + registro, guardia di 5.1,
  guardia del mese chiuso via `ChiusuraMensileService`, guardia «registro non già CLOSED»,
  transizione `APERTO → CHIUSO` con scrittura di `MetodoPagamento`, `ContanteRicevuto`, `Totale`.
  Registrazione in DI in `backend/Program.cs`.
  ✅ **Fatto**, più `ILogger<ChiudiOrdineOrchestrator>` fra le dipendenze — serve a
  `SecchiIncassiApplier` e a `BreakdownIvaApplier`, che lo pretendono per i loro warning di clamp.
  Input e output in `backend/GraphQL/Vendite/Types/ChiudiOrdineInput.cs`
  (`ChiudiOrdineInput`, `TaglioOrdineInput`, `EsitoChiusuraOrdine`) — le classi C# nude, senza gli
  `InputObjectGraphType`, che sono di 6.1.
  ⚠️ **Quattro orchestrator e non uno**, come vuole `design.md` §File Changes: `ApriOrdineOrchestrator`
  (5.4), `ChiudiOrdineOrchestrator` (5.3 e 5.5), `AnnullaOrdineOrchestrator` (5.6),
  `StornaOrdineOrchestrator` (5.7). Tutti `AddScoped` in `Program.cs`: condividono l'`IUnitOfWork`
  della richiesta, ed è ciò che rende una chiusura **una** transazione.
  **Verifica eseguita**: `dotnet build` → 0 errori, 0 warning.
- [x] 5.3 `ChiudiOrdineOrchestrator` — il corpo, dentro `_unitOfWork.ExecuteInTransactionAsync`, in
  **quest'ordine esatto**:
  1. una `Vendita` per ogni `RigaOrdine`, riusando `VenditeMutations.RicalcolaImportiSnapshot` — non
     riscrivere lo scorporo, che ha un solo posto in cui vive;
  2. `dbContext.Vendite.AddRange(...)` e poi **`await SaveChangesAsync()`** — obbligatorio;
  3. `SecchiIncassiApplier.ApplicaDelta(register, metodo, totale, logger)` — **una** chiamata per
     l'ordine intero, non una per riga;
  4. `await BreakdownIvaApplier.ApplicaAsync(db, register, settings.VatRate, logger)`;
  5. `await SaveChangesAsync()`, poi commit; eventi pubblicati **dopo** il commit, come fa
     `ChiudiRegistroCassaOrchestrator`.
  🔴 **Il passo 2 non è stile.** `BreakdownIvaApplier` apre con
  `await db.Vendite.Where(v => v.RegistroCassaId == registro.Id).ToListAsync()`: **rilegge dal
  database**. EF non applica gli insert pendenti a una query server-side, quindi le vendite aggiunte
  e non salvate sono invisibili e l'ordine intero finirebbe nel residuo «stimato» invece che nelle
  righe IVA esatte.
  🔴 **Il passo 3 precede il 4** perché il 4 calcola `TotaleVendite` a partire da
  `IncassiElettronici`: leggerlo prima del delta darebbe un totale vecchio di un ordine. È già
  scritto nel commento XML di `SecchiIncassiApplier`.
  ✅ **Fatto**, con **una fusione rispetto a questa stesura**: il `SaveChangesAsync()` del passo 2 e
  il salvataggio della transizione di stato **sono lo stesso salvataggio**, ed è deliberato. Il token
  di concorrenza sta su `Ordine.Stato`, quindi la guardia scatta esattamente lì: un solo `SaveChanges`
  scrive la transizione, crea le `Vendita` e verifica che nessun altro sia passato di qui — e lo fa
  **prima** di qualunque delta, che è la proprietà che conta. Sono quindi due salvataggi in tutto,
  come previsto, non tre.
  **Verifica eseguita — provata rossa, non solo scritta**: spostando quel salvataggio **dopo** il
  breakdown, `Chiusura_IlBreakdownVedeLeVenditeAppenaCreate_NessunResiduoStimato` fallisce con
  `VenditeContanti` a `0M` invece di `18.50M`, e cade anche
  `ChiusuraInContanteNonTracciato_NonMuoveAlcunSecchio_MaRaffinaLIva`. È esattamente il guasto
  silenzioso descritto in `design.md` §Discovery 1: mutation OK, ordine chiuso, secchi mossi, e la
  ripartizione IVA indietro di un ordine intero. Codice ripristinato.
- [x] 5.4 Assegnazione del `Numero` all'apertura dell'ordine: `MAX(Numero)+1` sul registro ha una
  **corsa** — due operatori che aprono un ordine nello stesso istante leggono lo stesso massimo.
  L'indice unico di 3.4 trasforma la corsa da duplicato silenzioso in `DbUpdateException`; qui si
  aggiunge il retry limitato (3 tentativi) perché l'operatore veda un ordine nuovo e non un 500.
  🔴 L'indice è la correttezza, il retry è l'ergonomia: non invertire i ruoli.
  ✅ **Fatto** — `backend/GraphQL/Vendite/ApriOrdineOrchestrator.cs`. Oltre alla numerazione porta le
  due guardie che chiudono la finestra a monte: mese chiuso e **registro non già `CLOSED`/`RECONCILED`**
  (`design.md` §«Chiusura di cassa bloccata dagli ordini aperti» ne chiede due, e questa è la prima —
  la seconda è il conteggio dentro la chiusura di cassa, che è 7.1).
  ⚠️ **I figli di uno split non consumano un numero**: ereditano quello del padre e si distinguono per
  suffisso, quindi `MAX(Numero)` li conta senza doverli escludere.
  **Verifica eseguita — provata rossa**: la corsa non è riproducibile chiamando due volte `apriOrdine`,
  perché la finestra sta **dentro** il metodo, fra la lettura del massimo e la scrittura. È aperta a
  comando con un `SaveChangesInterceptor` (`UnAltroOperatorePrendeIlNumero`) che, alla prima scrittura,
  fa inserire il numero 1 da un secondo contesto. Con `TentativiNumerazione = 1` il test fallisce; con
  3 l'apertura riesce con `Numero = 2` e l'asserzione `HaColpito` prova che la corsa è davvero
  avvenuta. Ha richiesto un parametro `params IInterceptor[]` opzionale su
  `TestDbContextFactory.CreateSqlite`, additivo e senza effetti sui chiamanti esistenti.
- [x] 5.5 Split — `ChiudiOrdineOrchestrator` accetta 2..n destinazioni
  `[{ metodo, righeIds, contanteRicevuto? }]` in **una sola** transazione. Il padre passa a `CHIUSO`,
  nascono n figli con `SuffissoSplit` e `OrdinePadreId`.
  Validare che l'unione delle `righeIds` sia **esattamente** l'insieme delle righe del padre, senza
  sovrapposizioni né omissioni: altrimenti una riga sparisce in silenzio.
  `ApplicaDelta` una volta per figlio (importi disgiunti, somma pari al totale del padre), ma
  `BreakdownIvaApplier` **una volta sola alla fine**: è un ricalcolo completo che rilegge tutto,
  chiamarlo n volte sono n−1 riletture inutili sugli stessi dati.
  ℹ️ Fuori perimetro, e va detto in pagina (7.8): lo split per **importo** sullo stesso insieme di
  righe.
  ✅ **Fatto**. Il padre passa a `SPLITTATO` con `MetodoPagamento` lasciato a **`null`** — non ha
  incassato con alcun metodo — e `TotaleOrdine` pari al totale intero: dice quanto valeva, non come è
  stato pagato. I figli ereditano `Numero` e prendono `SuffissoSplit` `"A"`, `"B"`, …; le righe sono
  **riassegnate** via navigazione (`riga.Ordine = figlio`), perché il figlio non ha ancora una chiave
  e la propaga EF al salvataggio.
  ⚠️ **La divisione per importo non è nemmeno esprimibile**: `TaglioOrdineInput` non ha un campo
  importo. Il tentativo arriva quindi al server come una parte **senza voci**, o come una voce
  assegnata **due volte**, e in entrambi i casi il messaggio dice *perché* — «il conto si divide per
  voci, non per importo» — invece del solo rifiuto.
  **Verifica eseguita — provata rossa**: sostituendo `ExecuteInTransactionAsync` con un passthrough,
  `SplitFallitoAMeta_NessunEffettoParziale` fallisce trovando **3 ordini invece di 1** (il padre più
  due figli orfani). Il guasto del test è piazzato **dopo** il primo salvataggio (`BusinessSettings`
  assente → il breakdown lancia), perché uno piazzato prima sarebbe stato coperto dalla transazione
  implicita di `SaveChanges` e non avrebbe provato nulla. Codice ripristinato.
- [x] 5.6 Annullo — `APERTO → ANNULLATO`, **nessun delta**, traccia di chi e quando in
  `AnnullatoDaUtenteId`/`AnnullatoIl`/`MotivoAnnullamento`. L'ordine non sparisce e resta
  consultabile: è la scappatoia per sbloccare la chiusura di cassa, e una scappatoia senza traccia
  non controlla niente. Stessa guardia di 5.1.
  ✅ **Fatto** — `backend/GraphQL/Vendite/AnnullaOrdineOrchestrator.cs` (nomi di `design.md`:
  `AnnullatoDa`, non `AnnullatoDaUtenteId`). Motivo **obbligatorio**, spazi soli non valgono: un
  motivo vuoto salvato somiglierebbe a una traccia senza esserlo. Nessun evento pubblicato — il
  registro non è cambiato di un centesimo, e annunciarne l'aggiornamento farebbe ricaricare la cassa
  per niente.
- [x] 5.7 Storno — `CHIUSO → STORNATO`, delta inverso, **cancellazione** delle `Vendita` generate, poi
  `SaveChangesAsync()`, poi `BreakdownIvaApplier` (stessa regola d'ordine di 5.3). È l'operazione
  pericolosa: il delta non è idempotente, e la guardia di 5.1 è ciò che la rende sicura.
  ✅ **Riscontrato con `design.md`** (§«`stornaOrdine` CANCELLA le `Vendita`, non le marca»):
  l'inferenza era corretta. La ragione del design è più forte di quella che avevo scritto:
  `BreakdownIvaApplier` fa `registro.VenditeContanti = vendite.Sum(v => v.PrezzoTotale)` sulle
  `Vendita` **persistite**, quindi un flag `Stornata` costringerebbe ad aggiungere
  `Where(v => !v.Stornata)` negli applier — cioè a reintrodurre «stato + filtro», l'accoppiata che
  questo change esiste per togliere. Cancellare tiene l'invariante: **una `Vendita` che esiste è una
  riga incassata adesso**.
  Quattro vincoli **da recepire dal design**, non presenti nella stesura precedente:
  1. Le **`RigaOrdine` non si cancellano mai**. Il libro mastro è l'`Ordine`, che conserva tutto:
     righe, importi, chi ha stornato e perché. Cancellare anche le righe renderebbe lo storno
     indistinguibile da un ordine mai esistito.
  2. La traccia è **obbligatoria**: `MotivoStorno` non vuoto, `StornatoDa`, `StornatoIl` (campi
     aggiunti a 3.1). Uno storno senza motivo va rifiutato, non salvato con motivo vuoto.
  3. **Solo amministratori**: `GestioneCassaGuards.GuardUtenteAmministratore` — esiste già ed è usata
     da `RiapriRegistroCassaOrchestrator.cs:39` e `AuthMutations.cs:55`. È l'asimmetria voluta con
     l'annullo (5.6), che invece è **per chiunque venda**: un annullo riservato all'amministratore
     spingerebbe l'operatore a non chiudere affatto gli ordini, che è peggio del rischio che evita.
  4. **Storno di un ordine `SPLITTATO`: rifiutato.** Si stornano i figli, uno per uno. Un solo gesto
     che applica n delta inversi trasformerebbe «una volta sola» in n ragionamenti da tenere insieme.
  ⚠️ `design.md` colloca questa logica in un `backend/GraphQL/Vendite/StornaOrdineOrchestrator.cs`
  separato, non dentro `ChiudiOrdineOrchestrator`. In fase di apply vale il design.
  ✅ **Fatto** — file separato come vuole il design. I quattro vincoli sono tutti in piedi: le
  `RigaOrdine` non si toccano, il motivo è obbligatorio, `GuardUtenteAmministratore` è la **prima**
  cosa che viene eseguita (chi non può stornare non deve sapere nemmeno se l'ordine esiste), e uno
  `SPLITTATO` è rifiutato **senza un controllo apposito**: `GuardStatoAtteso(ordine, CHIUSO, …)` lo
  copre da sé, e il messaggio rimanda alle singole parti.
  ⚠️ Il `SaveChangesAsync()` obbligatorio vale identico qui, e per la stessa ragione al contrario: il
  breakdown rilegge le vendite **dal database**, quindi senza salvare la `RemoveRange` le vedrebbe
  ancora tutte e ricostruirebbe un breakdown che comprende l'ordine appena stornato.

---

## Phase 6: A — Superficie GraphQL

> ### ✅ Fase completata — 6.1-6.6
>
> **File nuovi**: `Types/OrdineType.cs`, `Types/RigaOrdineType.cs`, `Types/ChiudiOrdineInputType.cs`
> (i due input insieme), `Types/EsitoChiusuraOrdineType.cs`, `DataLoaders/OrdiniDataLoaders.cs`,
> `DuedGusto.Tests/Integration/GraphQL/OrdiniQueriesTests.cs` (22 test),
> `Migrations/20260829070649_RiordinaIndiceOrdiniStato.cs`.
> **Modificati**: `VenditeMutations.cs`, `VenditeQueries.cs`, `Types/VenditaType.cs` (`+ ordineId`),
> `AppDbContext.cs` (ordine delle colonne dell'indice), due helper di test che usavano la factory
> ritirata. **Eliminato**: `Types/CreaVenditaInputType.cs`.
>
> **Verifica**: `dotnet build` → 0 errori, 0 warning; `dotnet test` → **955/955** (933 + 22).
> `npm run ts:check` → **verde**, e vedi 6.6: è un verde che non prova nulla.
>
> 🔴 **L'autorizzazione è stata vista fallire**, non dedotta: togliendo `this.Authorize()` da
> `VenditeMutations`, 7 dei 10 casi di `OgniCampoDOrdine_InAnonimo_NegaAccesso` diventano rossi (le
> 3 query restano coperte da `VenditeQueries`). Annotazione ripristinata.

- [x] 6.1 Nuovi type in `backend/GraphQL/Vendite/Types/`: `OrdineType`, `RigaOrdineType`, e gli input
  `ApriOrdineInput`, `AggiungiRigaOrdineInput`, `ChiudiOrdineInput`, `SplitOrdineInput`.
  **Verifica**: `dotnet build`; lo schema si costruisce in `GraphQLTestHost` senza eccezioni.
  ✅ **Fatto**, con **due scostamenti da questa stesura, entrambi presi da `design.md`**:
  1. **Niente `ApriOrdineInput` né `AggiungiRigaOrdineInput`**: `design.md` §Interfaces/Contracts
     dichiara quelle due mutation con **argomenti nudi** (`apriOrdine(registroCassaId: Int!)`,
     `aggiungiRigaOrdine(ordineId, prodottoId, quantita, note)`). Un input object per due o tre
     scalari sarebbe un tipo in più da tenere allineato senza nulla in cambio.
  2. **Niente `SplitOrdineInput`**: lo split *è* `chiudiOrdine` con più di un taglio — decisione
     «una sola mutation con i tagli in ingresso» — quindi un input dedicato aprirebbe la seconda
     strada verso la chiusura che quella decisione esiste per chiudere.
  I due input graph type stanno **nello stesso file** (`ChiudiOrdineInputType.cs`) invece che in due:
  sono le due metà di un contratto solo e cambiano insieme.
  ℹ️ `OrdineType` espone tre campi **derivati e mai persistiti** — `identificativo`, `dataRegistro`,
  `totaleCorrente` — sullo stampo di `prezzoEffettivoVetrina`. `dataRegistro` **non era in
  `design.md`** ed è stato aggiunto lì: è ciò che 6.5 chiede di mostrare su ogni riga.
  🔴 Tutti i subfield di navigazione passano da **DataLoader** (`OrdiniDataLoaders.cs`), mai da
  `context.Source.Navigazione`: il lazy loading è disabilitato in questo progetto, quindi la
  navigazione risponderebbe con una collezione **vuota** e non con un errore — e un ordine senza
  voci è uno stato legittimo, che nessuno metterebbe in dubbio.
- [x] 6.2 `backend/GraphQL/Vendite/VenditeMutations.cs` — mutation di **composizione**: `apriOrdine`,
  `aggiungiRigaOrdine`, `rimuoviRigaOrdine`. Nessuna di queste tocca i secchi né il breakdown: un
  ordine aperto è una pre-vendita, non un incasso.
  ℹ️ Il tipo ha già `this.Authorize()` in testa e copre da solo i campi nuovi.
  🔴 Se invece si crea un modulo `OrdiniMutations` separato, **deve** chiamare `this.Authorize()`:
  `/graphql` è montato con `AuthorizationRequired = false` e un modulo senza autorizzazione è
  pubblico per default. `AutorizzazioneAnonimaTests` enumera i rami root **dallo schema** e rompe la
  CI da solo — non aggiungere allowlist.
  **Verifica**: `dotnet test --filter AutorizzazioneAnonima` verde; test che aggiungere una riga a un
  ordine aperto lascia `IncassiElettronici` e `VenditeContanti` invariati.
  ✅ **Fatto**, **quattro** mutation e non tre: `aggiornaRigaOrdine(rigaOrdineId, quantita)` è in
  `design.md` ed è il gesto dello stepper di quantità della Fase 8. Restano tutte sotto `vendite`,
  quindi `this.Authorize()` a livello di tipo le copre da sé e nessun ramo root nuovo esiste.
  ⚠️ **Il prezzo non si riprende dal listino in `aggiornaRigaOrdine`**: resta quello del tocco.
  Rileggerlo lì farebbe cambiare il conto a un cliente che ha già sentito dire l'altro prezzo, ed è
  il modo più naturale di perdere lo snapshot senza accorgersene.
  ℹ️ Le tre guardie comuni stanno in un punto solo (`CaricaOrdineApertoAsync`): ordine esistente,
  **stato `APERTO`** e mese non chiuso. Lo stato si controlla anche qui benché nessuna riga muova un
  secchio — su un ordine già chiuso una voce in più cambierebbe il totale **dopo** che le `Vendita`
  sono nate, e il conto smetterebbe di corrispondere all'incasso senza che nulla lo dica.
  ⚠️ `rimuoviRigaOrdine` **non** contraddice «le `RigaOrdine` non si cancellano mai»: quella regola
  parla delle **transizioni** (lo storno conserva le righe). Togliere una voce da un conto ancora
  aperto è la correzione di un tocco sbagliato, prima che esista un incasso da spiegare — ed è la
  guardia di stato a tenere separati i due casi. Scritto nel codice, perché letto di fretta sembra
  una violazione.
- [x] 6.3 `VenditeMutations.cs` — mutation di **transizione**: `chiudiOrdine`,
  `chiudiOrdineConSplit`, `annullaOrdine`, `stornaOrdine`, che delegano interamente a
  `ChiudiOrdineOrchestrator` (fase 5) senza logica propria.
  **Verifica**: test 9.1–9.5.
  ✅ **Fatto** — ⚠️ **`chiudiOrdineConSplit` NON esiste**, ed è deliberato: `design.md` §«`chiudiOrdine`
  è una sola mutation con i tagli in ingresso» sceglie una mutation sola, perché un taglio è una
  chiusura semplice e n sono uno split, e in entrambi i casi è **una transizione, una transazione,
  un commit**. Una seconda mutation sarebbe una seconda strada verso un delta non idempotente. Vale
  `design.md`, come per ogni divergenza di questo change.
  I quattro resolver sono **tre righe l'uno**: risolvono l'orchestrator, leggono gli argomenti,
  delegano. L'unica cosa che fanno in proprio è leggere l'utente **dal JWT** e non da un argomento:
  un id passato dal client renderebbe la traccia dello storno un'informazione fornita da chi va
  tracciato.
- [x] 6.4 `backend/GraphQL/Vendite/VenditeQueries.cs` — `ordine(id)` e
  `ordini(registroCassaId, stato)`.
  **Verifica**: query di lettura su un ordine seminato restituisce righe e totale corretti.
  ✅ **Fatto** — nome e firma di `design.md`: `ordiniDelRegistro(registroCassaId: Int!, stati: [String!])`,
  al plurale e con la lista di stati, non `ordini(…, stato)`.
  🔴 Uno **stato fuori insieme è rifiutato** con un messaggio che elenca quelli ammessi, invece di
  restituire una lista vuota: il vuoto è una risposta legittima — «non ci sono ordini» — e nessuno
  la mette in dubbio, quindi un filtro sbagliato passerebbe per un dato.
  **Verifica eseguita**: `Ordine_RestituisceRigheTotaleCorrenteEIdentificativo` legge un ordine
  seminato con due voci **attraverso il motore GraphQL vero** e riscontra
  `identificativo == "260828-017"`, `suffissoSplit == ""` (non null), `totaleOrdine == 0`
  (lo snapshot si scrive alla chiusura) e `totaleCorrente == 5.90`.
- [x] 6.5 `VenditeQueries.cs` — `ordiniAperti`.
  🔴 **Non va filtrata sul registro di oggi.** Un ordine aperto alle 23:50 appartiene al registro di
  **ieri** — decisione della issue: finché la cassa non si chiude, tutto resta nel giorno di apertura.
  Alle 00:05 un filtro su `data == oggi` lo fa sparire: invisibile, non chiudibile, e la guardia di
  7.1 bloccherebbe la chiusura mostrando un elenco **vuoto**, che è il modo peggiore di bloccare.
  Filtrare su `Stato == APERTO` su tutti i registri, e restituire la data del registro su ogni riga
  perché l'operatore veda che è di ieri.
  **Verifica**: test 9.6.
  ✅ **Fatto**: `registroCassaId` è **opzionale**; omesso, la query interroga tutti i registri. Ogni
  riga porta `dataRegistro` (derivato dal registro, non da `ApertoIl`), che è ciò che permette di
  vedere che l'ordine è di ieri invece di cercarlo fra quelli di oggi.
  🔴 **L'opzionalità dell'argomento è essa stessa protetta da un test**
  (`OrdiniAperti_HaIlRegistroOpzionale`): renderlo obbligatorio costringerebbe ogni chiamante a
  scegliere un registro, e il chiamante naturale sceglierebbe quello di oggi — cioè la trappola
  della mezzanotte reintrodotta **dal contratto** invece che dal codice, dove nessuno la
  cercherebbe.
  ✅ **9.6 è di fatto anticipata qui** (lasciata comunque non spuntata, è di Fase 9):
  `OrdiniAperti_SenzaRegistro_ComprendeGliOrdiniDeiGiorniPrecedenti` semina un ordine aperto sul
  registro di ieri e uno su quello di oggi e riscontra che compaiono entrambi, con `dataRegistro`
  di ieri sul primo.
  ✅ **SCIOGLIMENTO DELLO SCOSTAMENTO APERTO IN 3.4 — l'indice è stato cambiato, non lasciato com'era.**
  L'indice secondario passa da `(RegistroCassaId, Stato)` a **`(Stato, RegistroCassaId)`**, con la
  migrazione `20260829070649_RiordinaIndiceOrdiniStato` (solo `DropIndex` + `CreateIndex`, `Down()`
  simmetrico, nessun dato toccato).
  **Perché questo e non «lasciare così» né «aggiungere un indice su `Stato`»**: le letture sugli
  ordini sono due — la guardia della chiusura di cassa (`RegistroCassaId` + `Stato`) e questa query
  (`Stato` soltanto, su tutti i registri). Con `RegistroCassaId` in testa la seconda non ha il
  prefisso e legge tutta la tabella; con `Stato` in testa **un solo indice le serve entrambe**,
  perché la prima confronta le due colonne per uguaglianza e a quella l'ordine è indifferente. Un
  secondo indice su `Stato` sarebbe stato costo di scrittura senza copertura nuova. Le letture per
  solo `RegistroCassaId` (`MAX(Numero)` dell'apertura, `GuardNessunOrdineSulRegistro`) non restano
  scoperte: hanno già il prefisso dell'indice unico.
  ⚠️ Si fa **ora** perché ora è gratis: in produzione `Ordini` è ancora vuota, quindi il rifacimento
  dell'indice non tocca alcuna riga. Motivato nel codice (`AppDbContext`), nella migrazione e in
  `design.md`, che è stato corretto in entrambi i punti in cui riportava il vecchio ordine.
- [x] 6.6 Ritiro della vecchia porta: `creaVendita` oggi crea una `Vendita` e muove i secchi
  direttamente, e con gli ordini diventa un secondo ingresso all'invariante.
  ⚠️ Va tolta **nella stessa release** in cui il frontend passa agli ordini (8.3), non prima:
  `PuntoVendita.tsx` la usa fino a quel momento. Coordinare con 11.2.
  ℹ️ `design.md` §«`creaVendita` viene RIMOSSA dallo schema, non deprecata» chiude anche la sorte delle
  altre due: `aggiornaVendita` / `eliminaVendita` **restano** ma rifiutano ogni `Vendita` con
  `OrdineId != null`, indicando `stornaOrdine`. Serve un test che pinni che `creaVendita` **non esiste
  più** nello schema, altrimenti qualcuno la rimetterà per comodità e nulla lo segnalerà.
  **Verifica**: `grep -rn "creaVendita" duedgusto/src backend/` non trova più occorrenze attive.
  ✅ **Fatto**: via il campo, via il resolver `CreaVenditaAsync`, e via anche
  `Types/CreaVenditaInputType.cs` con la factory `CostruisciVendita` — che dopo la rimozione **non
  aveva più alcun chiamante di produzione**: le `Vendita` nascono da `RigaOrdine` dentro
  `ChiudiOrdineOrchestrator`. Restavano solo due helper di test, riscritti per costruire la
  `Vendita` a mano e chiamare `RicalcolaImportiSnapshot`, che è il punto in cui lo scorporo vive
  davvero. Lasciare in piedi una factory usata dai soli test avrebbe tenuto viva una seconda
  descrizione di «come nasce una vendita».
  `aggiornaVendita`/`eliminaVendita` rifiutano ogni `Vendita` con `OrdineId != null` con un
  messaggio che indica **stornaOrdine** — la via d'uscita, non solo il rifiuto — e `VenditaType`
  espone `ordineId` perché il client sappia *prima* quali righe sono chiuse.
  🔴 **RISPOSTA ALLA DOMANDA APERTA — `npm run ts:check` è VERDE, e non prova nulla.** Il ritiro
  **non** rompe la compilazione del frontend, ma non perché il frontend sia a posto: le mutation
  sono stringhe `gql` e **non esiste alcun codegen contro lo schema** (nessuno script `graphql-codegen`
  in `package.json`), quindi `PuntoVendita.tsx` continua a compilare e si romperà **solo a runtime**,
  con un errore di validazione GraphQL al momento della conferma della vendita.
  ⚠️ **Conseguenza pratica**: nulla anticipa la Fase 8, ma nemmeno nulla la ricorda. Finché 8.3 non
  arriva, in sviluppo il tasto «conferma» del punto vendita è rotto, e la pipeline resta **verde**.
  Il vincolo «stessa release» di 11.2 va tenuto a mano: qui non c'è un test che lo faccia rispettare.
  ℹ️ Occorrenze residue di `creaVendita` nel repository: le sole di `duedgusto/src` (Fase 8) e i
  commenti di questo file. Nel backend non ne resta nessuna attiva.

---

## Phase 7: A — Guardia sulla chiusura di cassa

> ### ✅ Fase completata — 7.1 e 7.2, più il test 9.8 (anticipato qui)
>
> **File nuovi**: `backend/DuedGusto.Tests/Integration/GraphQL/ChiudiRegistroCassaOrdiniApertiTests.cs`
> (16 test). **Modificati**: `GestioneCassaGuards.cs`, `ChiudiRegistroCassaOrchestrator.cs`.
> **Nessun cambio al modello dati**, quindi nessuna migrazione nuova.
>
> 🔴 **Il rischio di questa fase non era la guardia: era la regressione silenziosa.** In produzione
> `Ordini` è vuota e ci sono 607 registri storici importati; la chiusura di cassa è oggi un gesto
> manuale su giornate **senza alcun ordine**. Una guardia larga le avrebbe bloccate tutte, e il
> guasto si sarebbe visto solo a fine turno. Per questo i casi «non blocca» sono più numerosi e più
> espliciti del caso «blocca», e **la larghezza della guardia è stata vista fallire**: sostituendo
> il filtro `Stato == APERTO` con «qualunque ordine», **7 dei 16 test diventano rossi**.
>
> **Verifica**: `dotnet build` → 0 errori, 0 warning; `dotnet test` → **971/971** (955 + 16).

- [x] 7.1 `backend/GraphQL/GestioneCassa/GestioneCassaGuards.cs` — nuova
  `GuardNessunOrdineAperto(AppDbContext dbContext, int registroCassaId)` che lancia un
  `ExecutionError` parlante con il numero di ordini aperti. Un ordine aperto è per definizione un
  incasso non dichiarato.
  **Verifica**: test 9.8.
  ✅ **Fatto**, firma esatta di `design.md` §«Chiusura di cassa bloccata dagli ordini aperti».
  Il messaggio porta **conteggio, importo e identificativi**: «Impossibile chiudere la cassa:
  2 ordini ancora aperti per 30,00 € (260826-001, 260826-002). Vanno incassati o annullati prima di
  chiudere la cassa.» La spec chiede quanti e quanto, il design chiede gli identificativi: ci stanno
  tutti e tre. Oltre il quinto identificativo si passa a «e altri N» — un elenco di venti codici non
  aiuta a decidere, e l'elenco completo con le sue due azioni per riga è la schermata di 8.11.
  🔴 **`WHERE Stato = 'APERTO'`, e il filtro è l'intera fase.** Zero ordini ⇒ nessun blocco; ordini
  presenti ma tutti in stato terminale ⇒ nessun blocco. `SPLITTATO` in particolare: bloccare sul
  padre di uno split fermerebbe la cassa su un incasso **già dichiarato dai figli** e **senza via
  d'uscita possibile**, perché quel padre non si può né chiudere né annullare.
  ⚠️ **L'importo si somma dalle `RigaOrdine`, non da `Ordine.TotaleOrdine`**: quello snapshot si
  scrive alla chiusura *dell'ordine* e su un ordine aperto vale ancora 0. Leggerlo avrebbe prodotto
  «2 ordini aperti per 0,00 €» proprio mentre l'operatore cerca di capire quanto gli manca. Il cast
  a `decimal?` sulla `Sum` regge l'ordine aperto e ancora **vuoto**, dove su SQL la somma è `NULL`.
  ℹ️ **La differenza con `GuardNessunOrdineSulRegistro` (3.4) è voluta, e ora è scritta in
  entrambe.** Quella conta **ogni** ordine perché **elimina** il registro: un ordine chiuso è la
  storia di un incasso, con le sue `Vendita` agganciate, e va tolto di mezzo consapevolmente prima
  di cancellare il giorno che lo contiene — la FK è `Restrict`, quindi senza il guard sarebbe un 500
  opaco. Questa ne conta uno solo di stato perché **chiude** il registro, e chiudere significa
  dichiarare ciò che è stato incassato: gli ordini già risolti *sono* ciò che si sta dichiarando.
  Criteri diversi per operazioni diverse, non una svista.
- [x] 7.2 `backend/GraphQL/GestioneCassa/ChiudiRegistroCassaOrchestrator.cs` — invocare la guardia
  accanto alle due esistenti (`GuardMeseChiuso`, `GuardGiornoOperativoConPeriodi`), **prima** della
  transazione.
  **Verifica**: test 9.8; chiudere una cassa con un ordine aperto restituisce l'errore e non cambia
  lo `Stato` del registro.
  ✅ **Fatto**, **in coda** alle due preesistenti e non davanti: l'ordine dei guard è l'ordine in cui
  l'operatore vede gli errori, e un mese chiuso o un giorno non operativo restano il motivo più forte
  per cui la giornata non si chiude — un ordine aperto è invece risolvibile sul momento. Invariato
  anche il rifiuto della richiusura su `CLOSED`/`RECONCILED`, che resta il primo di tutti.
  **Provato rosso**: spostando la guardia nuova **prima** delle due esistenti,
  `MeseChiuso_RestaLErroreCheSiVedePerPrimo` e `GiornoNonOperativo_RestaLErroreCheSiVedePerPrimo`
  falliscono. Ordine ripristinato.
  ✅ **Secondo controllo dentro la transazione**, come chiede `design.md` §«Due guardie e non una»:
  fra il guard e il commit c'è una finestra in cui un altro dispositivo può aprire un ordine, e il
  rifiuto di `ApriOrdineOrchestrator` su registro `CLOSED` copre solo ciò che accade **dopo** la
  scrittura dello stato. Costa una `COUNT` su indice.
  🔴 **Nessun test sorveglia quella seconda riga, ed è misurato**: togliendola la suite resta
  interamente verde, perché la corsa non è riproducibile su InMemory (transazioni no-op). Il fatto è
  scritto **dentro il codice**, accanto alla riga, perché chi la cancellasse per «duplicazione» non
  vedrebbe nulla diventare rosso.
  ⚠️ **`riapriRegistroCassa` NON acquisisce la guardia**, ed è una lettura della spec e non una
  deduzione: il requirement «La chiusura di cassa si blocca in presenza di ordini aperti» nomina
  `chiudiRegistroCassa` soltanto. Riaprire *allarga* ciò che si può fare sul registro invece di
  dichiarare una giornata, quindi un ordine aperto non è un motivo per impedirla — anzi, è spesso
  il motivo per cui la si vuole. Pinnato da `LaRiapertura_NonEBloccataDaUnOrdineAperto`.

---

## Phase 8: A — Frontend

> ### ✅ Fase completata — 8.1-8.12
>
> **File nuovi**: `graphql/ordini/{fragments,queries,mutations}.tsx`, `@types/ordine.d.ts`,
> `vendite/ChiusuraOrdine.tsx`, `vendite/OrdineCorrente.tsx`, `vendite/OrdiniAperti.tsx`,
> `vendite/SplitOrdine.tsx`, `vendite/DialogMotivo.tsx`, più cinque file di test.
> **Modificati**: `vendite/PuntoVendita.tsx`, `vendite/ScontrinoDelGiorno.tsx`,
> `vendite/metodiPagamento.tsx`, `graphql/vendite/{mutations,fragments}.tsx`, `@types/vendita.d.ts`,
> `registrazioneCassa/RegistroCassaDetails.tsx`.
> **Eliminati**: `vendite/SceltaMetodoPagamento.tsx` e il suo test (rinominati, vedi 8.5).
>
> 🔴 **Il punto vendita era rotto, e questa fase è ciò che lo rimette in piedi.** La Fase 6 ha
> ritirato `creaVendita` dallo schema, ma `PuntoVendita.tsx` continuava a chiamarla: le mutation
> sono stringhe `gql` senza codegen, quindi `ts:check` restava **verde** e il guasto si vedeva solo
> a runtime, alla conferma della vendita.
>
> 🔴 **E per la stessa ragione `ts:check` non è stata accettata come prova.** Ogni documento
> GraphQL scritto qui è stato eseguito **contro il backend vero** (8.12): è l'unica verifica che
> distingue un client che compila da un client che parla col server.
>
> **Verifica**: `npm run ts:check` → verde; `npm run lint` → verde; `npm run test` → **923/923**
> (888 preesistenti − 7 del test ritirato + 42 nuovi); `dotnet test` → **971/971**, invariati.
>
> ⚠️ **Una corsa della suite frontend su tre ha dato 1 rosso**, e va detto invece che nascosto: era
> la corsa lanciata **in parallelo** a `dotnet test`, e le due successive sono state verdi
> (923/923 e 115 file su 115). Il fallimento non è stato catturato — l'output era troncato — quindi
> **non è escluso** che sia un test intermittente preesistente sotto carico. Se la CI mostrasse un
> rosso solitario e irriproducibile, è questo il precedente da guardare per primo.

- [x] 8.1 Nuovi `duedgusto/src/graphql/ordini/queries.tsx`, `mutations.tsx`, `fragments.tsx`, sullo
  stampo di `duedgusto/src/graphql/vendite/`.
  ✅ **Fatto**: 3 query (`getOrdiniAperti`, `getOrdine`, `getOrdiniDelRegistro`) e 7 mutation
  (`apriOrdine`, `aggiungiRigaOrdine`, `aggiornaRigaOrdine`, `rimuoviRigaOrdine`, `chiudiOrdine`,
  `annullaOrdine`, `stornaOrdine`), tutte sotto il ramo esistente `vendite`.
  ℹ️ I fragment sono **due** (`rigaOrdineFragment`, `ordineFragment`) più un terzo export
  `ordineConRigheFragments` che li concatena nell'ordine giusto. Non è zucchero: `OrdineFragment`
  usa `RigaOrdineFragment`, e chi ne interpolasse uno solo otterrebbe un errore di validazione
  **a runtime** — cioè esattamente la classe di guasto che questa fase esiste per chiudere.
  ⚠️ `mutationCreaVendita` è stata **tolta** da `graphql/vendite/mutations.tsx`, e `CreaVenditaInput`
  da `@types/vendita.d.ts`: era la coda del ritiro di 6.6, che nel frontend era rimasta.
  ⚠️ `venditaFragment` guadagna `ordineId`, che serve a 8.9 per sapere quali righe sono ancora
  correggibili.

- [x] 8.2 Nuovo `duedgusto/src/@types/ordine.d.ts` — tipi di `Ordine`, `RigaOrdine`, stati e input.
  ⚠️ **`ordine.d.ts` minuscolo**, non `Ordine.d.ts`: è il nome di `design.md` §File Changes, ed è
  anche la convenzione dei due vicini di dominio (`vendita.d.ts`, `prodotto.d.ts`).
  ✅ **Fatto**: `StatoOrdine` (unione delle cinque stringhe del server), `RigaOrdine`, `Ordine`,
  `TaglioOrdineInput`, `ChiudiOrdineInput`, `EsitoChiusuraOrdine`.
  🔴 `Ordine` **non ha alcun campo `resto`**, e il commento dice perché: si legge
  `contanteRicevuto` e il resto è una sottrazione fatta dal client. `RegistroCassa.resto` è la
  colonna AG del foglio e significa un'altra cosa.

- [x] 8.3 `PuntoVendita.tsx` — il tocco aggiunge una riga all'ordine aperto, con apertura implicita
  al primo tocco.
  ✅ **Fatto**. Restano invariati `fetchPolicy: "cache-first"`, il filtro in memoria e — ciò che
  conta di più — gli indici colore calcolati sul listino **intero** e non su `prodottiVisibili`.
  🔴 **L'apertura implicita ha una corsa, ed è chiusa con una promessa condivisa in una `ref`.**
  Due tocchi ravvicinati arrivano prima che la prima risposta torni: senza `aperturaInVolo`
  nascerebbero **due** ordini, il secondo con dentro una sola voce, e il guasto si vedrebbe solo
  alla cassa. Una `ref` e non uno stato, perché il secondo tocco deve vedere il valore **prima**
  del prossimo render. Pinnato da «due tocchi ravvicinati non aprono due ordini».
  ⚠️ **Un ricaricamento della pagina non riadotta l'ordine da solo**, ed è deliberato: al banco
  possono esserci due dispositivi, e indovinare «l'ultimo aperto» li farebbe litigare sullo stesso
  conto. L'ordine si riprende dall'elenco (8.7), che è un gesto esplicito e mostra quale.
  ℹ️ Il tocco aggiunge sempre **quantità 1**: la stessa consumazione battuta due volte diventa due
  righe, e lo stepper del foglio delle voci le riunisce quando serve. Chiedere la quantità a ogni
  tocco rimetterebbe in mezzo la domanda che questo change ha tolto.

- [x] 8.4 `PuntoVendita.tsx` — barra in basso con il totale corrente, il numero di voci e «Chiudi
  ordine».
  ✅ **Fatto**, su **due righe** invece che una: sopra il conto (premibile, apre le voci) più i due
  badge — ordini aperti e scontrino —, sotto le due azioni «Annulla ordine» e «Chiudi ordine» a
  56 px. A 360 px cinque bersagli in fila sarebbero stati tutti troppo stretti, ed è la larghezza
  per cui questa pagina è disegnata.
  ⚠️ La barra non dice più «Battuto oggi». Il numero che serve mentre si batte è quello che il
  cliente sta per pagare; il totale del giorno resta a un tocco, nello scontrino.
  ℹ️ Nuovo `vendite/OrdineCorrente.tsx` (previsto da `design.md` §File Changes e non da questo
  task): le voci dell'ordine con stepper e rimozione per riga. Senza, l'operatore vedrebbe solo un
  totale e non avrebbe modo di correggere il tocco appena sbagliato. Il cestino sta **all'estremità
  opposta** dello stepper: è l'unica azione irreversibile del foglio.

- [x] 8.5 `SceltaMetodoPagamento.tsx` → **`ChiusuraOrdine.tsx`**: si sposta da riga a fine ordine.
  ⚠️ **Rinominato, come vuole `design.md`** §File Changes (`SceltaMetodoPagamento.tsx →
  ChiusuraOrdine.tsx`), contro la lettera di questo task e di 9.10, che citavano il vecchio nome.
  Vale il design, come per ogni divergenza di nomenclatura di questo change — e qui la ragione è
  anche di merito: il foglio non sceglie più solo un metodo, mostra il totale, il tastierino del
  contante, il resto e l'ingresso allo split. Il vecchio nome sarebbe diventato una bugia.
  ✅ **Il gesto è rimasto identico**, come chiede la issue: foglio dal basso, bersagli ≥ 56 px, una
  mano sola, nessuna azione distruttiva adiacente. Cambia solo *quando* si apre — una volta per
  ordine invece di una per voce.
  ⚠️ Il test è `__tests__/ChiusuraOrdine.test.tsx` e **sostituisce**
  `SceltaMetodoPagamento.test.tsx`, che è stato cancellato: pinnava props che non esistono più (un
  `ProdottoVendibile` e lo stepper di quantità, ora della riga). Riadattarlo avrebbe tenuto in vita
  un contratto morto. **13 test**, contro i 7 di prima.

- [x] 8.6 `ChiusuraOrdine.tsx` — tastierino «quanto ha dato il cliente», col resto mostrato.
  ✅ **Fatto**, con quattro scelte da annotare:
  1. **Etichetta «Resto da rendere»**, non «Resto da dare» come diceva questa stesura: è il nome di
     `design.md` §«`ContanteRicevuto` / `RestoDaRendere` — mai `Resto`», della spec e del campo
     GraphQL `restoDaRendere`. La regola vera — «mai `Resto` da solo» — è rispettata da entrambe le
     formulazioni; fra le due vince quella che coincide con lo schema. Un test pinna che la parola
     «Resto» nuda **non compare** in pagina.
  2. **Il foglio è a due passi, e solo per il contante.** Toccato `Elettronico` la chiusura parte
     subito e il campo del contante **non viene mai proposto** — il server lo rifiuterebbe insieme
     a quel metodo, e proporlo porterebbe a un errore col cliente davanti. Toccato un metodo in
     contanti il foglio passa al tastierino.
  3. **L'importo si accumula in centesimi**, non si scrive con la virgola: si digita «2 0 0 0» per
     venti euro senza mai cercare il separatore, che è il tasto che sul telefono si sbaglia. Tasti
     ≥ 56 px, più le quattro banconote (5/10/20/50) come scorciatoia.
  4. **Un ricevuto insufficiente non produce un resto negativo**: dice *quanto manca* e tiene
     spento «Incassa». Un numero negativo mostrato come se fosse valido è il modo più diretto di
     far rendere soldi che non si sono presi.
  ℹ️ «Importo esatto» invia `contanteRicevuto: null`, che è il caso normale: obbligare a digitare
  il totale sarebbe lavoro per niente.

- [x] 8.7 Nuovo `vendite/OrdiniAperti.tsx` — elenco con la **data del registro** su ogni riga e le
  due azioni: incassa, annulla.
  ✅ **Fatto come drawer autonomo**, non come pagina, e la ragione è pratica: una pagina nuova
  richiede un record `menus` nel database (`path` + `filePath`), quindi non sarebbe raggiungibile
  in produzione senza un seed nuovo — e soprattutto **non** dalla schermata di chiusura cassa, che
  è il posto in cui 8.11 la vuole. Il componente interroga da sé `ordiniAperti` e porta dentro le
  due mutation, così i due chiamanti non duplicano nulla.
  🔴 **Il registro è un filtro opzionale.** Dal punto vendita si passa senza registro — l'elenco
  mostra anche gli ordini di ieri —, dalla chiusura cassa si passa quello del giorno che si sta
  chiudendo. È la trappola della mezzanotte, e ogni riga porta `Cassa del gg/mm/aaaa` con un
  contrassegno quando non è oggi. Pinnato da «mostra un ordine del registro di ieri».
  ℹ️ «Riprendi» compare **solo** se il chiamante sa dove riprenderlo: dalla chiusura cassa non c'è
  un banco su cui rimettere l'ordine, e un pulsante che non porta da nessuna parte è peggio di uno
  assente.
  ℹ️ Il motivo dell'annullo passa da `vendite/DialogMotivo.tsx`, condiviso con l'annullo del punto
  vendita e con lo storno dello scontrino: sono le tre operazioni che cancellano qualcosa, ed è la
  stessa domanda. Il pulsante resta spento su un motivo di soli spazi — un motivo vuoto salvato
  **somiglierebbe** a una traccia senza esserlo, che è peggio di non averla.

- [x] 8.8 Nuovo `vendite/SplitOrdine.tsx` — si scelgono le righe per metodo.
  ✅ **Fatto**, con il limite dichiarato **in cima al foglio**: «Si divide per voci, non per
  importo», con l'esempio esplicito («20 € in contanti e 10 con carta») che è il modo in cui
  qualcuno ci proverà. Non è un messaggio d'errore: sta scritto prima che si cominci.
  ℹ️ La forma è «parte corrente + tocco sulla voce»: le parti sono chip in cima con il loro
  totale, la voce toccata va nella parte selezionata, e le voci non ancora assegnate hanno il
  bordo **tratteggiato** — si vedono senza leggere.
  🔴 **La conferma resta spenta in due casi**, entrambi pinnati: una voce non assegnata (sparirebbe
  dal conto) e una parte senza voci (taglio vuoto). Il server rifiuta entrambi, ma un rifiuto
  arriva sempre più tardi di un pulsante spento.
  ⚠️ Nello split **non si digita il contante ricevuto**: sarebbero n tastierini in fila, e il resto
  si fa comunque una volta sola alla fine. Ogni taglio parte con `contanteRicevuto` assente, che
  per il server significa «importo esatto».

- [x] 8.9 `ScontrinoDelGiorno.tsx` — verificato, e **NON è rimasto invariato**: la verifica ha
  trovato un guasto della stessa famiglia di quello di `creaVendita`.
  🔴 **Il guasto**: 6.6 ha ristretto `aggiornaVendita` ed `eliminaVendita`, che ora **rifiutano**
  ogni vendita con `ordineId != null`. Le due icone di riga di questo drawer chiamano proprio
  quelle due mutation: da qui in avanti avrebbero risposto solo con un errore, su **ogni** riga —
  perché da qui in avanti ogni vendita nasce da un ordine. `ts:check` non poteva vederlo, per la
  stessa ragione di 6.6.
  ✅ **Rimediato come vuole `design.md`** §File Changes: righe **raggruppate per ordine** con
  l'identificativo in testa al gruppo, le due icone di riga **solo** sulle righe senza ordine (le
  vendite di sviluppo nate col vecchio regime), e al loro posto **«Storna»** sul gruppo.
  🔴 **«Storna», non «annulla», e solo per amministratori**: sono due gesti diversi e non stanno
  mai sullo stesso pulsante. L'annullo vale su un ordine ancora aperto e non tocca nulla; lo storno
  disfa un incasso già dichiarato. Il server esige il ruolo: nascondere il pulsante a chi non può
  usarlo evita di far scoprire il divieto **dopo** aver scritto un motivo.
  ✅ **Verificato che gli ordini aperti non compaiono**: il drawer legge le `Vendita`, che esistono
  solo se qualcuno ha pagato. Il messaggio del caso vuoto lo dice a voce alta, perché è la
  proprietà che rende leggibile il totale.

- [x] 8.10 Identificativo dell'ordine in pagina.
  ✅ **Fatto in quattro punti**: la barra del punto vendita, il foglio delle voci, il foglio di
  chiusura e ogni riga dell'elenco degli aperti. Il gruppo dello scontrino porta lo stesso codice.
  ℹ️ Viene dal campo derivato `identificativo` del server (`{data:yyMMdd}-{numero:D3}[-{suffisso}]`),
  non ricomposto dal client: una seconda formula sarebbe una seconda verità da tenere allineata.
  **Riscontrato in esecuzione** (8.12): `260828-001` sul primo ordine del registro di ieri.

- [x] 8.11 Schermata di chiusura cassa — l'elenco degli ordini che bloccano la chiusura.
  ✅ **Fatto**: `RegistroCassaDetails.handleCloseCashRegister` riconosce il messaggio della guardia
  di 7.1 (`/ordin[ei] ancora apert[oi]/i`) e apre `OrdiniAperti` **filtrato su quel registro**, con
  titolo e spiegazione propri. Il messaggio del server resta visibile in un toast: è la diagnosi,
  l'elenco è il posto in cui si risolve.
  🔴 **Non è un abbellimento: è il completamento della Fase 7.** La guardia risponde «2 ordini
  ancora aperti per 30,00 €» e si ferma lì. Senza una schermata che li elenchi con le due azioni
  per riga, l'operatore legge il problema e non ha dove risolverlo — e la chiusura di cassa
  diventa un vicolo cieco.
  ⚠️ Il pannello si monta **solo** dopo il rifiuto (`{ordiniBloccantiVisibili && …}`). Montarlo
  sempre farebbe girare una query su ogni giorno aperto della storia, e — cosa che conta di più
  qui — farebbe partire quella query anche nello smoke test della pagina, che non ha un
  ApolloProvider e diventerebbe rosso per un motivo che non c'entra nulla.
  ⚠️ **`riapriRegistroCassa` non è toccata**: la guardia vale sulla chiusura soltanto (vedi 7.2).
  🔴 **Copertura mancante, dichiarata**: nessun test attraversa questo ramo. Provarlo richiede di
  montare `RegistroCassaDetails` con un Apollo vero e far fallire la chiusura, e il suo smoke test
  mocka gli hook uno per uno senza provider. Il riconoscimento del messaggio è quindi legato **al
  testo della guardia di 7.1**: chi lo riformulasse toglierebbe la via d'uscita senza vedere nulla
  diventare rosso. Il rischio è annotato qui e nel codice, accanto alla regex.

- [x] 8.12 Verifica in esecuzione dell'intero gesto.
  🔴 **Eseguita contro il backend vero, non simulata**, e con i **documenti `gql` veri** importati
  dai file di 8.1: è l'unica prova che il client parli davvero col server, che `ts:check` non dà.
  ⚠️ **Ritrovamento**: l'istanza già accesa su `:4000` era una build **precedente alla Fase 6** e
  rispondeva `Unknown type Ordine · Cannot query field 'apriOrdine'`. La verifica è stata rifatta
  su una seconda istanza avviata dalla build corrente (porta 4010, artifacts fuori dall'albero per
  non contendere i lock del backend acceso). **Chi rifà questa prova deve riavviare il backend**,
  o misurerà lo schema di ieri.
  ✅ **Esito, sul registro #628 del 28/08 in `DRAFT`** — che è anche il caso della mezzanotte, dato
  che «oggi» è il 29:
  - le 3 query e le 7 mutation **validano tutte** contro lo schema reale;
  - apertura → `260828-001`; tre voci battute, una portata a quantità 2, una tolta;
  - `totaleCorrente` 6,50 e `dataRegistro` **28/08**, non oggi;
  - 🔴 **con l'ordine aperto `incassoContanteTracciato` resta a 0**: un ordine aperto non è un
    incasso, ed è l'invariante centrale del change;
  - chiusura in contante tracciato con 20,00 € ricevuti → `restoDaRendere` **13,50**, esattamente
    la sottrazione che il tastierino mostra al cliente;
  - 🔴 `incassoContanteTracciato` passa da 0 a **6,50**: delta pari al totale, **una volta sola**;
  - storno → torna a **0**, e le vendite generate spariscono;
  - un secondo ordine aperto e **annullato**, per provare anche quella via d'uscita.
  ⚠️ Restano in dev sul registro #628 un ordine `STORNATO` e uno `ANNULLATO`, entrambi con motivo
  «Verifica in esecuzione della fase 8». Nessuno dei due muove un secchio, e la chiusura di cassa
  non è bloccata da stati terminali (7.1).

---

## Phase 9: Testing

In questa fase il test **è** la verifica: per ogni task il criterio è che il caso descritto passi, e
dove indicato che sia stato visto **fallire prima** sull'implementazione mancante. Il file toccato è
nominato in ogni task; il comando è `cd backend && dotnet test --filter <NomeClasse>` per il backend
e `cd duedgusto && npm run test -- <file>` per il frontend.

> ### ℹ️ 9.1–9.5 e 9.7 sono stati scritti **dentro la Fase 5**, non rimandati qui
>
> Un'implementazione non idempotente lasciata scoperta anche per una sola fase è esattamente il
> rischio che questo change esiste per togliere: i test della guardia sono nati insieme alla guardia,
> e ognuno di essi è stato **visto fallire** rimuovendo la protezione che sorveglia (le prove sono
> annotate sui rispettivi task 5.x). Restano da fare in questa fase 9.6 e 9.8 — che dipendono dalla
> superficie GraphQL (6.5) e dalla guardia della chiusura di cassa (7.1) — e i quattro task di
> frontend e di gate.
> **40 test nuovi**, suite da **893 a 933 verdi**.

- [x] 9.1 **[FATTO IN FASE 5]** Nuovo `backend/DuedGusto.Tests/Integration/OrdiniChiusuraTests.cs`, su
  `TestDbContextFactory.CreateSqlite()`: chiusura di un ordine → il secchio si muove **una volta**;
  una seconda chiusura lancia e lascia il secchio **invariato**.
- [x] 9.2 **[FATTO IN FASE 5]** `backend/DuedGusto.Tests/Integration/OrdiniChiusuraTests.cs`, su InMemory: chiusura con
  righe → `VenditeContanti` del registro pari al totale dell'ordine e **nessuna riga IVA `Stimato`**
  a coprirlo.
  🔴 È il test che va rosso se si toglie il `SaveChangesAsync()` del passo 2 di 5.3. Va scritto
  guardandolo fallire con quella riga commentata, altrimenti non si sa che cosa stia sorvegliando.
- [x] 9.3 **[FATTO IN FASE 5]** Nuovo `backend/DuedGusto.Tests/Integration/OrdiniSplitTests.cs`, su
  Sqlite: totale del padre pari alla somma dei figli; secchi mossi una volta **in totale**; uno split
  le cui righe non partizionano il padre viene rifiutato; un rollback a metà non lascia figli orfani.
- [x] 9.4 **[FATTO IN FASE 5]** `backend/DuedGusto.Tests/Integration/OrdiniTransizioniTests.cs` (nuovo), su InMemory —
  annullo: nessun movimento sui secchi, ordine ancora interrogabile con chi e quando.
- [x] 9.5 **[FATTO IN FASE 5]** `backend/DuedGusto.Tests/Integration/OrdiniTransizioniTests.cs`, su
  Sqlite — storno: delta inverso applicato una volta sola; una seconda richiesta di storno non muove
  nulla.
  ✅ Casi **aggiunti dalla riconciliazione con `design.md`** (vedi 5.7), tutti sullo stesso file:
  le `Vendita` dell'ordine **non esistono più** dopo lo storno; le `RigaOrdine` **ci sono ancora**,
  con gli stessi importi; `VenditeContanti` ricalcolato da `BreakdownIvaApplier` non le conta più;
  uno storno **senza motivo** viene rifiutato; uno storno chiesto da un utente **non amministratore**
  viene rifiutato senza toccare nulla; lo storno di un ordine in stato **`SPLITTATO` viene rifiutato**
  e i figli restano chiusi.
- [ ] 9.6 `backend/DuedGusto.Tests/Integration/GraphQL/OrdiniQueriesTests.cs` (nuovo), su InMemory —
  `ordiniAperti` a cavallo di mezzanotte: ordine sul registro di ieri, «oggi» è il giorno dopo →
  compare comunque, con la data del registro nella riga.
- [x] 9.7 **[FATTO IN FASE 5]** `backend/DuedGusto.Tests/Integration/OrdiniNumerazioneTests.cs`
  (nuovo), su Sqlite — indice unico: due ordini con la stessa terna
  `(RegistroCassaId, Numero, SuffissoSplit)` → il secondo fallisce; il retry di 5.4 ne assegna uno
  nuovo e l'apertura va a buon fine.
  🔴 InMemory non applica gli indici unici: senza 2.1 questo test passerebbe **verde senza provare
  nulla**, che è peggio di non averlo.
- [x] 9.8 **[FATTO IN FASE 7]** ~~`CashManagementMutationsTests.cs` (esistente, esteso)~~ → nuovo
  `backend/DuedGusto.Tests/Integration/GraphQL/ChiudiRegistroCassaOrdiniApertiTests.cs`, su InMemory
  — guardia chiusura cassa: registro con un ordine aperto → chiusura rifiutata con messaggio
  parlante e `Stato` del registro invariato; dopo l'annullo dell'ordine, chiusura riuscita.
  ⚠️ **File diverso da quello nominato qui, e la ragione è nell'intestazione di quel file**:
  `CashManagementMutationsTests` dichiara di testare «the underlying EF Core data operations
  directly, replicating the business logic» — cioè *ricopia* la logica invece di invocarla, e un
  test dell'ordine dei guard scritto lì proverebbe la copia, non l'orchestrator. Lo stampo giusto è
  `RiapriRegistroCassaTests.cs`, che l'orchestrator lo costruisce e lo chiama davvero.
  ✅ **16 test**, più larghi di quanto questo task chiedeva, perché il rischio della fase è la
  regressione e non la guardia: registro **senza alcun ordine** (il caso di tutta la produzione di
  oggi, 607 registri e `Ordini` vuota) · ordine aperto su un **altro** registro · uno scenario per
  **ciascuno** dei quattro stati terminali, più uno che li mette tutti insieme · un aperto fra
  cinque risolti, che blocca nominando **solo lui** · un aperto **senza voci**, che blocca a 0,00 €
  invece di far saltare la somma · il blocco con conteggio, importo e identificativi · la via
  d'uscita per annullo, con i secchi fermi · l'ordine dei guard (mese chiuso, giorno non operativo,
  registro già chiuso) · la riapertura non bloccata.
  🔴 **Provati rossi, tutti e tre i modi di sbagliare questa fase**: (a) guardia allargata a
  *qualunque* stato → **7 rossi**, ed è la regressione che avrebbe bloccato ogni registro storico;
  (b) guardia non invocata → **5 rossi**; (c) guardia messa **prima** delle due preesistenti →
  **2 rossi**, quelli sull'ordine degli errori. Tutte le condizioni ripristinate.
- [x] 9.9 **[FATTO IN FASE 8]** Nuovo `duedgusto/src/components/pages/vendite/__tests__/PuntoVendita.test.tsx`:
  il tocco aggiunge una riga senza aprire la modale; la barra mostra il totale corrente; il secondo
  tocco sullo stesso prodotto non apre un secondo ordine.
  ✅ **7 test.** Oltre ai tre chiesti: la cassa non aperta (che si gestisce *prima* della griglia),
  il **listino vuoto** — che in produzione è il caso di oggi, `Prodotti` è vuota — lo stato iniziale
  senza ordine, e la presenza delle due sole uscite «Annulla ordine» / «Chiudi ordine», con
  «Storna» **assente** perché è un altro gesto su un altro stato.
  ⚠️ Il file non usa `MockedProvider` ma un **doppio di `useQuery`/`useMutation`** che smista sul
  nome dell'operazione, con un mini-store che fa ri-renderizzare chi legge. Non è solo il
  precedente degli altri test di pagina: ciò che va provato qui è **il numero di chiamate a
  `apriOrdine` in una corsa fra due tocchi**, e con la cache di Apollo in mezzo si finirebbe a
  provare la cache.
  ℹ️ `vi.hoisted` installa `window.matchMedia`: `themeStore` legge la preferenza di sistema alla
  **creazione dello store**, cioè durante l'import, e senza quello nessun test parte.
- [x] 9.10 **[FATTO IN FASE 8]** ~~`__tests__/SceltaMetodoPagamento.test.tsx` (esistente, esteso)~~ →
  nuovo `duedgusto/src/components/pages/vendite/__tests__/ChiusuraOrdine.test.tsx`, **13 test**.
  ⚠️ **File diverso da quello nominato qui, e il vecchio è stato cancellato**: il componente si è
  rinominato in `ChiusuraOrdine.tsx` (vedi 8.5) e le props vecchie — un `ProdottoVendibile` e lo
  stepper di quantità — non esistono più. Estendere quel file avrebbe pinnato un contratto morto.
  ✅ Coperti tutti e tre i casi del resto (esatto, in eccesso, insufficiente), più: l'elettronico
  che conferma **senza** proporre il contante, il tastierino che compare solo sul contante,
  «Importo esatto» che invia `contanteRicevuto: null`, la cancellazione a una cifra per volta,
  l'ingresso allo split spento con una voce sola, e — 🔴 — che la parola **«Resto» nuda non compare
  mai** in pagina.
- [x] 9.13 **[AGGIUNTO IN FASE 8]** Tre file che questa stesura non prevedeva, per i tre componenti
  nuovi: `OrdiniAperti.test.tsx` (**7**, fra cui l'ordine del registro di **ieri** che compare
  comunque — la trappola della mezzanotte vista dal client — e il motivo obbligatorio
  dell'annullo), `SplitOrdine.test.tsx` (**6**: il limite per-importo dichiarato in pagina, la voce
  non assegnata, la parte vuota, la riassegnazione che sposta invece di duplicare) e
  `OrdineCorrente.test.tsx` (**4**). Più `ScontrinoDelGiorno.test.tsx` (**5**), che prima non
  esisteva affatto e che pinna la conseguenza di 6.6: **niente icone di correzione** sulle righe
  nate da un ordine, e lo storno visibile ai soli amministratori.
- [ ] 9.11 Gate di fase backend: `cd backend && dotnet build && dotnet test` verdi, zero warning.
- [ ] 9.12 Gate di fase frontend: `cd duedgusto && npm run ts:check && npm run lint && npm run test`
  verdi.

---

## Phase 10: B — Gruppi di prodotti e varianti

Dipende da A (i gruppi servono a riempire un ordine). Dopo la chiusura delle decisioni di Fase 0,
**tutta la fase è eseguibile tranne 10.1 e 10.2**, che aspettano la sola lista di listino (0.1), e
**10.14**, che aspetta una decisione di UI.

La fase tiene insieme **tre assi di ordinamento distinti**, che è bene non confondere:
`ProdottoGruppo.Ordinamento` (10.3) ordina le varianti **dentro un tastone di gruppo**;
`Prodotto.Ordinamento` (10.10) ordina le tessere **dentro la categoria** nella griglia principale;
`Prodotto.OrdinamentoVetrina`, che esiste già, ordina i piatti **sul sito** e non c'entra con la cassa.
🔴 La distinzione che regge questa fase: **il meccanismo non ha bisogno dei dati**. Schema, migrazione,
seeder parametrico, pagina di gestione e tastoni si costruiscono e si testano con gruppi e prodotti
inventati dal test; solo il *contenuto* del listino reale è fermo.

- [ ] 10.1 **[BLOCCATO da 0.1]** `backend/SeedData/SeedProdottiListino.cs` — caricare le ~147
  voci. Il listino vero è `2026ListinoPrezzi.xlsx`; la tabella `Prodotti` in produzione è vuota.
  Codici secondo la convenzione `CATEGORIA-NOME` (#19 D2).
  ℹ️ Per **decisione 0.2** il perimetro ora include anche `GRAPPA` — che diventa **due articoli**, uno
  a 3,00 € e uno a 4,00 €, perché ogni variante è un articolo a sé — e le **righe 49-50** a 2,50 €.
  ⚠️ Le righe 49-50 sono **senza nome** e il nome non si inventa: arriva con la lista di 0.1. È parte
  di ciò che tiene fermo questo task, non un motivo in più.
  🔴 I codici sono **irreversibili**: `eliminaProdotto` non esiste nell'API, un prodotto creato con il
  codice sbagliato resta in anagrafica per sempre e toglierlo richiede SQL diretto sul VPS.
  **Verifica**: conteggio dei prodotti attivi dopo il seed; nessun codice duplicato.
  ℹ️ La **struttura** del seeder (idempotenza, mondo produzione vs sviluppo, nessun prezzo esistente
  riscritto) è verificabile fin da ora con una tabella di voci fittizie: quei test non aspettano 0.1.
- [ ] 10.2 **[BLOCCATO da 0.1]** Disattivare (`Attivo = false`) le 14 voci accorpate vecchie. Restano
  in anagrafica per sempre: la tabella arriva a ~161 righe di cui 14 spente.
  **Verifica**: le 14 voci non compaiono più in `prodotti(ricerca, categoria)` ma esistono ancora a
  database.
- [x] 10.3 **FATTO** — Nuovo `backend/Models/GruppoProdotti.cs` più
  l'entità di appartenenza `ProdottoGruppo`: **join esplicita** con chiave composita
  `{GruppoProdottiId, ProdottoId}` e payload `Ordinamento` (ordine manuale dentro il gruppo, pareggio
  su `Prodotto.Codice`). Configurazione in `backend/DataAccess/AppDbContext.cs`.
  ℹ️ Lo stampo è `backend/Models/RegistroCassaMensile.cs` + la sua configurazione in
  `AppDbContext.cs:~1318-1341`: stessa forma, chiave composita e payload. **Non** usare
  `UsingEntity<Dictionary<string, object>>` come `RuoloMenu` (`AppDbContext.cs:107`): quel pattern non
  regge un payload in modo leggibile né tipizzato.
  🔴 **Nessun prezzo sul gruppo**: il tastone mostra «da X €» derivato da `Min(prezzo dei membri
  attivi)`, calcolato in lettura e **mai persistito** — un prezzo indicativo salvato invecchia in
  silenzio. Quando tutti i membri costano uguale si mostra il prezzo nudo, senza «da».
  ⚠️ **Nessun colore sulla riga di join**: il colore è del prodotto (10.5); `GruppoProdotti.Colore`
  esiste a parte per il tastone del gruppo. Vedi `design.md` §«il colore esplicito sta su `Prodotto`».
  **Verifica**: `dotnet build`; test che lo stesso prodotto può appartenere a due gruppi e comparire in
  entrambi con ordinamenti diversi.
- [x] 10.4 **FATTO** — migrazione `dotnet ef migrations add AddGruppiProdotti` e riscontro
  del DDL. Separata da 10.3 come richiede `config.yaml`.
  **Verifica**: la migrazione si applica all'avvio senza errori; il DDL contiene `CREATE TABLE
  GruppiProdotti`, l'indice unico su `Codice` e `CREATE TABLE ProdottiGruppi` con chiave composita.
- [x] 10.5 **FATTO** — `backend/Models/Prodotto.cs`: campo `Colore` (`string?`, nullable), il
  colore editoriale della bevanda (Liscio bianco, Aperol arancione, Campari rosso, Cynar viola), che
  quando è valorizzato **vince** sul colore generato dalla categoria. Configurazione in
  `AppDbContext.cs`; campo negli input e nei type di `mutateProdotto`.
  ℹ️ Il meccanismo è indipendente da *quali* prodotti esistano, quindi si può fare appena atterra A,
  senza attendere le decisioni di listino.
  ⚠️ Attenzione al confine di `UpsertProdottoAsync`, che assegna ogni campo esplicitamente: `Colore`
  appartiene alla cassa, non alla vetrina, quindi va in `ProdottoInput` — a differenza dei campi
  vetrina, che non devono mai comparirvi.
  **Verifica**: `dotnet build`; test che un upsert senza `Colore` non azzera quello esistente.
- [x] 10.6 **FATTO (accorpata in 10.4)** — colonna `Prodotti.Colore` — `varchar(20)` nullable, nessun backfill
  (l'assenza significa «usa il colore generato», che è il comportamento di oggi).
  ℹ️ `design.md` la **accorpa in `AddGruppiProdotti`** (10.4), non in una migrazione propria: sono la
  stessa fase B e la stessa finestra di deploy, e due migrazioni consecutive sulla stessa fase
  moltiplicano i `Down()` da tenere simmetrici senza guadagno. Se 10.4 è già stata generata, questa è
  una `dotnet ef migrations add AddColoreProdotto` a sé; altrimenti si genera una volta sola.
  **Verifica**: DDL con `AddColumn<string>` nullable (`maxLength: 20`) e `Down()` simmetrico.
- [x] 10.7 **FATTO** — `duedgusto/src/components/pages/vendite/coloriProdotto.tsx` — `coloreProdotto()` ritorna il
  colore esplicito quando presente, altrimenti quello generato dalla categoria come oggi.
  **Verifica**: `__tests__/coloriProdotto.test.tsx` esteso — colore esplicito vince, assenza ricade
  sul generato, il generato resta identico a prima per i prodotti senza colore.
- [x] 10.8 **FATTO** — pagina di gestione dei gruppi: si crea il gruppo e ci si mettono
  dentro i prodotti. È un raggruppamento libero, non per prezzo né per gusto.
  ℹ️ Lo stampo esiste: `duedgusto/src/components/pages/roles/RoleDetails.tsx` +
  `RoleMenus.tsx` assegnano già un molti-a-molti con AG Grid a selezione multipla. Qui AG Grid **sì**:
  è anagrafica, non bancone.
  ⚠️ Con il molti-a-molti la pagina deve reggere **lo stesso prodotto in più gruppi** senza trattarlo
  come un errore, e l'ordinamento (`ProdottoGruppo.Ordinamento`) è **per gruppo**, non per prodotto.
  **Verifica**: creare un gruppo, assegnarvi tre prodotti, riaprire la pagina e ritrovarli **nello
  stesso ordine**; assegnare uno di quei tre anche a un secondo gruppo e ritrovarlo in entrambi.
- [x] 10.9 **FATTO** — tastoni di gruppo in `PuntoVendita.tsx`: la griglia mostra i
  **gruppi** più i prodotti non raggruppati, non tutte le ~147 voci. Il tocco sul gruppo apre la
  griglia delle varianti — pulsanti, non AG Grid.
  ℹ️ «Non raggruppato» con il molti-a-molti è `!p.Gruppi.Any()`, non `p.GruppoId == null`: anti-join su
  un listino già interamente in cache, costo irrilevante.
  ⚠️ Un prodotto in due gruppi compare sotto **entrambi** i tastoni. È voluto, non un duplicato da
  deduplicare: è il motivo per cui il molti-a-molti esiste.
  **Verifica**: con un gruppo «Spritz» di 4 varianti, la griglia principale mostra un tastone invece
  di quattro.

### Ordinamento manuale dei prodotti dentro la categoria

Richiesta dell'utente (29 agosto 2026): «nella categoria CAFETERIA voglio che il caffè espresso
appaia per primo, poi x, poi y». È un asse **distinto** dall'ordinamento dentro il gruppo
(`ProdottoGruppo.Ordinamento`, 10.3): quello dice l'ordine delle varianti dentro un tastone, questo
dice l'ordine delle tessere nella griglia principale, filtrata per categoria.

🔴 **Oggi l'ordine è alfabetico per codice e non è governabile.**
`backend/GraphQL/Vendite/VenditeQueries.cs:55` fa `.OrderBy(p => p.Codice)`; il frontend non
riordina mai (`PuntoVendita.tsx:142`, filtra e basta). Quindi la posizione di un prodotto al bancone
è decisa dalla convenzione dei codici `CATEGORIA-NOME` (#19 D2) — cioè dall'alfabeto, non da quanto
spesso lo si batte. L'espresso, che è la voce più battuta della giornata, sta dove capita.

ℹ️ **Il precedente esiste già in casa**: `Prodotto.OrdinamentoVetrina` (int) fa esattamente questo
per il sito, ed è editabile in griglia da `duedgusto/src/components/pages/sito/VetrinaProdottiList.tsx:318`.
Qui serve il gemello di cassa. ⚠️ **Sono due campi distinti e devono restare tali**: l'ordine con cui
i piatti si presentano al cliente sul sito e l'ordine con cui la mano li trova al bancone non hanno
motivo di coincidere, e `OrdinamentoVetrina` è per costruzione fuori da `ProdottoInput` (§D8).

- [x] 10.10 **FATTO** — `backend/Models/Prodotto.cs` — campo `Ordinamento` (`int`,
  default `0`), l'ordine manuale della tessera **dentro la sua categoria**. Configurazione in
  `AppDbContext.cs`; campo in `ProdottoInput` e `ProdottoType`.
  🔴 **`Ordinamento` è di cassa, quindi va in `ProdottoInput`** — al contrario di `OrdinamentoVetrina`,
  che non deve mai comparirvi. Stesso confine già discusso per `Colore` in 10.5.
  ⚠️ **Trappola dell'`int` non nullable in `UpsertProdottoAsync`**: quel metodo assegna **ogni** campo
  esplicitamente, quindi un upsert che non invia `Ordinamento` lo riporterebbe a `0` — cioè
  rimescolerebbe la griglia a ogni salvataggio dell'anagrafica. Il campo va trattato come
  `Colore`: si scrive solo quando l'input lo porta.
  **Verifica**: `dotnet build`; test che un upsert senza `Ordinamento` **non azzera** quello esistente.
- [x] 10.11 **FATTO** — migrazione della colonna `Prodotti.Ordinamento` — `int NOT NULL DEFAULT 0`, **nessun
  backfill**.
  🔴 Lo zero universale è la scelta che rende il cambio invisibile il giorno del deploy: con tutti i
  prodotti a `0` il pareggio su `Codice` (10.12) riproduce **esattamente** l'ordine di oggi. Un
  backfill che numerasse le righe darebbe lo stesso ordine iniziale ma renderebbe indistinguibile
  «mai ordinato» da «ordinato apposta lì», e non si tornerebbe più indietro.
  ℹ️ Da accorpare in `AddGruppiProdotti` (10.4) insieme a `Prodotti.Colore` (10.6) se quella
  migrazione non è ancora stata generata: stessa fase, stessa finestra di deploy, un solo `Down()`
  da tenere simmetrico.
  **Verifica**: DDL con `AddColumn<int>(nullable: false, defaultValue: 0)` e `Down()` simmetrico.
- [x] 10.12 **FATTO** — `backend/GraphQL/Vendite/VenditeQueries.cs:55` — l'ordinamento della query `prodotti`
  passa da `.OrderBy(p => p.Codice)` a `.OrderBy(p => p.Ordinamento).ThenBy(p => p.Codice)`.
  🔴 **Il pareggio su `Codice` non è un dettaglio**: è ciò che tiene deterministico l'ordine fra i
  prodotti mai ordinati (tutti a `0`) e che rende il deploy un no-op visivo.
  ⚠️ L'ordinamento è **globale, non per categoria**, e va bene così: la griglia mostra una categoria
  per volta (`PuntoVendita.tsx:144`), quindi due prodotti di categorie diverse non si confrontano mai
  a schermo. Un `Ordinamento` scoped per categoria richiederebbe una chiave composita e una
  rinumerazione a ogni cambio di categoria di un prodotto, per un guadagno che nessuno vede.
  ℹ️ Sotto «Tutte» le categorie si intercalano secondo i numeri scelti. È l'unico punto in cui la
  scelta globale si nota, ed è un elenco di consultazione, non il gesto del bancone.
  **Verifica**: test di integrazione — tre prodotti della stessa categoria con `Ordinamento` 2/1/3
  tornano nell'ordine 1/2/3; tre prodotti tutti a `0` tornano in ordine di codice.
- [x] 10.13 **FATTO** — `duedgusto/src/components/pages/prodotti/ProdottiList.tsx`: colonna «Ordine»
  editabile e ordinabile, con lo stampo di `VetrinaProdottiList.tsx:318`, collocata dopo Categoria.
  ⚠️ **SCOSTAMENTO DAL PIANO, deliberato.** Il task chiedeva di riordinare la lista per `categoria`
  poi `ordinamento`; l'ordinamento di default **resta `codice ASC`**. Visto il codice, quel cambio
  peggiorava il caso d'uso principale della pagina — trovare un prodotto — per servirne uno raro, e
  AG Grid dà già il sorting per colonna: la colonna è `sortable`, chi vuole vedere l'effetto ordina
  di lì. 🔴 Il valore `0` **non si stampa**: è l'assenza di una scelta, e un listino di 147 zeri
  nasconderebbe le poche righe davvero disposte a mano.
  ℹ️ Il default a `0` è anche nella bozza di riga nuova (`nuovaBozza`): un prodotto appena creato non
  scavalca al bancone le tessere che qualcuno ha disposto.
- [ ] 10.14 **[DECISIONE APERTA — non implementare prima di scioglierla]** L'interazione fra
  l'ordinamento e il **colore** delle tessere.
  `coloriProdotto.tsx:130` assegna l'indice di luminosità ordinando per `codice`
  (`indiciPerCategoria`), quindi oggi la gradazione segue l'alfabeto — che è anche l'ordine a
  schermo. Introdotto `Ordinamento`, i due si separano e c'è da scegliere:
  - **Ancorare al codice** (nessuna modifica): il colore di una tessera **non cambia mai**, ma
    riordinando la griglia le gradazioni si mescolano e la fila non ha più una progressione leggibile.
  - **Ancorare all'`Ordinamento`**: la gradazione segue la fila, ma **ogni riordino ricolora** le
    tessere a valle — e il codice avverte esplicitamente che «la mano ha già imparato dov'era il
    pulsante» (`PuntoVendita.tsx:151`).
  ℹ️ Il riordino è raro e deliberato, la lettura della fila è quotidiana: è l'argomento a favore del
  secondo. Ma è una scelta di UI e la fa l'utente.
  **Verifica**: `__tests__/coloriProdotto.test.tsx` esteso secondo la decisione presa.

---

## Phase 11: Pulizia e documentazione

- [ ] 11.1 `openspec/specs/gestione-cassa/specs.md` — la #19 segnala che la formula di
  `TotaleVendite` alla riga 1204 diverge dal codice, e la spec delle vendite itemizzate diverge
  anch'essa. Va riallineata al codice **prima** di considerare chiuso il change, o si costruisce
  sopra una spec che mente.
  **Verifica**: la formula in spec coincide con quella di `BreakdownIvaApplier.ApplicaAsync`.
- [ ] 11.2 Rimozione del percorso a due tocchi: `creaVendita`, `aggiornaVendita` e `eliminaVendita`
  in `backend/GraphQL/Vendite/VenditeMutations.cs` non devono più essere la strada per far nascere
  una vendita. Coordinare con 6.6 e 8.3 — stessa release.
  **Verifica**: `dotnet test` verde dopo la rimozione; nessun riferimento residuo in
  `duedgusto/src`.
- [ ] 11.3 `backend/CLAUDE.md` e `duedgusto/CLAUDE.md` — documentare il confine nuovo: le `Vendita`
  nascono solo in `ChiudiOrdineOrchestrator`, e un ordine aperto non tocca né i secchi né il
  breakdown IVA. È l'invariante su cui poggia tutto il resto e va scritta dove la si cerca.
  **Verifica**: rilettura a mano.

---

## Phase 12: Ordini in parallelo e voce «Ordini» in sidebar

Richiesta dell'utente (29 agosto 2026), che **corregge la priorità** data nei commenti della #24:
«arrivano due ordini in contemporanea oppure a cavallo, non ho la possibilità di aprire il secondo
ordine senza aver chiuso il primo — per quello avevo chiesto la lista degli ordini».

🔴 **La lista non era la richiesta: era il rimedio a questa.** Nel commento della issue gli ordini
multipli erano stati archiviati come «comportamento attuale, coerente con la decisione *conto per
volta*, da riaprire nel prossimo giro **se** al banco serve». Non era un *se*: è il caso ordinario
del bancone, e senza di esso il secondo cliente aspetta che il primo paghi.

### Quanto è già in piedi — verificato sul codice, non assunto

| Pezzo | Stato |
|---|---|
| **Più ordini aperti insieme** | ✅ **già regge**, per costruzione: è la ragione per cui la guardia della chiusura di cassa esiste e per cui `ordiniAperti` non filtra sul registro di oggi |
| **Identificativo per distinguerli** | ✅ **già esiste**: `Ordine.Numero` progressivo per registro + `SuffissoSplit`, resi come `260828-017` (`OrdiniQueriesTests.cs:268`) |
| **Elenco degli aperti** | ✅ `OrdiniAperti.tsx`, con totale, data del registro e le due uscite (incassa / annulla) |
| **Riprendere un ordine dalla lista** | ✅ **già implementato**: `onRiprendi` → `handleRiprendi` (`PuntoVendita.tsx:305`) fa `setOrdineCorrenteId(ordine.ordineId)` |
| **Aprire un ordine NUOVO mentre uno è in corso** | 🔴 **manca, ed è l'unico vero blocco** |
| **Arrivarci di proposito** | 🔴 manca: `OrdiniAperti` è un componente, non una pagina |

🔴 **Dove sta esattamente il blocco.** `assicuraOrdine` (`PuntoVendita.tsx:181-183`) apre in
`ref` — non in stato — e **la prima cosa che fa è restituire `ordineCorrenteId` se c'è**. Quindi
finché un ordine è corrente, ogni tocco su un prodotto ci finisce dentro. L'unico modo di tornare a
`null` è `setOrdineCorrenteId(null)`, che compare in due soli punti: dopo l'incasso (riga 266) e dopo
l'annullo (riga 295). **Non esiste un gesto che apra un secondo ordine**, ed è precisamente il
sintomo descritto: per battere il secondo cliente bisogna prima chiudere il primo.

ℹ️ La `ref` di apertura in volo va lasciata com'è: serve a far attendere due tocchi ravvicinati sulla
**stessa** apertura. Il gesto nuovo le si affianca, non la sostituisce.

- [x] 12.1 **FATTO** — gesto **«nuovo ordine»** esplicito in `PuntoVendita.tsx`:
  mette `ordineCorrenteId` a `null` e lascia che il tocco successivo apra l'ordine, riusando
  `assicuraOrdine` così com'è. L'ordine lasciato indietro **resta aperto** e si ritrova nell'elenco.
  ⚠️ Il gesto va **confermato o reso evidente**, non silenzioso: un tocco che sposta il conto senza
  dirlo fa finire lo spritz del secondo cliente sull'ordine del primo, che è l'errore che questa
  fase esiste per togliere.
  ⚠️ Non azzerare `aperturaInVolo.current`: se un'apertura è in volo, il nuovo ordine si chiede
  **dopo** che è atterrata, o si aprono due ordini per un tocco solo.
  ✅ **Come è stato fatto**: `IconButton` «Nuovo ordine» (`PostAddIcon`) nella barra bassa, visibile
  **solo** con un ordine corrente — a pagina appena aperta il primo tocco apre già un ordine da sé, e
  un bersaglio in più a 360 px si paga in errori. `handleNuovoOrdine` azzera `ordineCorrenteId` e
  nient'altro: `assicuraOrdine` apre solo quando non c'è un corrente, quindi il gesto **riusa**
  l'apertura implicita invece di duplicarne una seconda che potrebbe divergerne.
  ✅ **Evidenza del gesto, senza un tocco in più**: nessuna conferma modale — la barra torna a
  «Nessun ordine aperto» e un toast dice *quale* conto è stato messo da parte. Senza il numero,
  «un altro ordine» non aiuta a ritrovarlo fra due minuti.
  ✅ `aperturaInVolo` **non** viene azzerata, come da avvertenza. Il pulsante compare solo con un
  ordine corrente già caricato, cioè quando nessuna apertura è più in volo.
  **Verifica**: ✅ tre test in `PuntoVendita.test.tsx` › «ordini in parallelo».
- [x] 12.2 **GIÀ IN PIEDI — nessun lavoro necessario.** La barra bassa mostra già
  «Ordine 260829-007 · 2 voci» e il totale corrente, ed è coperta da un test esistente. Il task era
  stato scritto senza averlo verificato: la pagina lo faceva già dalla Fase 8.
  🔴 Con un ordine solo l'indicatore è un lusso; con due in piedi è **la garanzia che serve prima di
  toccare un prodotto**. Il costo dell'ambiguità non è un fastidio: è una consumazione battuta sul
  conto sbagliato, che si scopre alla cassa.
  ℹ️ Da coordinare con 12.1: sono lo stesso gesto visto dai due lati — «su quale sto battendo» e
  «passa a un altro».
  **Verifica**: con due ordini aperti, l'identificativo a schermo cambia riprendendo l'altro.
- [ ] 12.3 **[DECISIONE APERTA — non implementare prima di scioglierla]** Basta il numero a
  distinguere due ordini **agli occhi dell'operatore**?
  `260828-017` individua l'ordine senza ambiguità per la macchina e per la stampa, ma non dice *di
  chi è*. Con due conti in piedi la domanda vera al bancone è «qual è quello dei due spritz al
  tavolo fuori», e un progressivo non risponde.
  - **Solo il numero** (nessun lavoro): zero campi nuovi; l'operatore si orienta sul contenuto delle
    righe, che l'elenco già mostra.
  - **Etichetta libera opzionale** su `Ordine` (`string?`, es. «tavolo fuori», «signora bionda»):
    un campo, una migrazione, un input alla nascita dell'ordine — che però **aggiunge un tocco
    davanti al gesto più frequente**, a meno di lasciarla vuota per default e modificabile dopo.
  ℹ️ 🔴 Se si sceglie l'etichetta, **non chiamarla `Tavolo`**: la decisione «si gestisce l'ordine, non
  il tavolo» è nella issue e un nome fa da promessa. Vale lo stesso avvertimento già speso su `Resto`.
  ℹ️ Con due o tre ordini il contenuto delle righe probabilmente basta; il numero non regge quando
  diventano cinque. Vale la pena partire dal numero e aggiungere l'etichetta se il banco la chiede.
  **Verifica**: dipende dalla decisione.
- [x] 12.4 **FATTO** — voce «Ordini» in sidebar — opzione B già scelta dall'utente** nei commenti della #24:
  `Vendita` e `Ordini` **sorelle**, entrambe `MenuPadreId = null`, entrambe in un tocco. Seed dedicato
  sullo stampo di `SeedMenusVendita.cs`, `Posizione` subito dopo `Vendita`.
  🔴 **La Fase 1 non si disfa**: `Vendita` resta a `Posizione = 0`. Ci si affianca, non la si annida.
  ⚠️ **Rinumerare le voci di primo livello successive** (oggi 0..9, tutte distinte):
  `AuthenticationDataLoaders` ordina per `Posizione` **senza tie-break**, quindi due voci a pari
  posizione cadrebbero sull'Id — un ordine che nessuno ha scelto.
  ⚠️ `SeedMenus.AssegnaRuoli` solo **aggiunge** ruoli e non li toglie mai: come «Vendita», la voce è
  per chiunque sia autenticato (decisione 0.4), e restringere in futuro costa SQL sul VPS.
  **Verifica**: dopo il riavvio la sidebar mostra `Ordini` accanto a `Vendita`; nessuna posizione
  duplicata fra le voci di primo livello.
- [x] 12.5 **FATTO — `ConciergeBell`.** Il test `iconeDelSeed` pretende ora l'**unicità
  globale** e nessuna icona già in `iconMapping.tsx` è libera: va aggiunta da `lucide-react`, come si
  è fatto con `HandCoins`. Candidati: `ReceiptText`, `ScrollText`, `NotepadText`, `ListChecks`.
  ⚠️ **Sceglierla guardando la forma accanto alle altre, non il nome**: `ListChecks` e `List` (Lista
  fornitori) sono due pile di righe e il test — che confronta i nomi — non se ne accorgerebbe.
  **Verifica**: `iconeDelSeed` verde; riscontro visivo della sidebar.
- [x] 12.6 **FATTO** — pagina che monta `OrdiniAperti` come vista di primo livello, **senza perdere i due usi
  attuali** (`PuntoVendita.tsx:603` e `RegistroCassaDetails.tsx:742`), che restano validi.
  ℹ️ Oggi il componente vive come modale (`Dialog` con `aperto` / `onChiudi`): come pagina non ha un
  «chiudi» né un chiamante a cui tornare. O si estrae il corpo dell'elenco dal guscio della modale, o
  la pagina si trova a montare una modale sempre aperta che non si può chiudere.
  ⚠️ `onRiprendi` è **opzionale** e dalla pagina non c'è un punto vendita a cui consegnare l'ordine:
  o la pagina naviga verso `Vendita` con l'ordine scelto, o lì l'azione non si offre. Scegliere, e
  non lasciare che il caso sia deciso da un `undefined`.
  **Verifica**: la pagina elenca gli stessi ordini della modale; i due usi esistenti continuano a
  funzionare.
- [x] 12.7 **FATTO** — route dinamica: la voce vive a database con `Percorso`, `NomeVista` e `PercorsoFile`,
  come tutte le altre (`ProtectedRoutes.tsx` → `loadDynamicComponent()`).
  **Verifica**: navigazione diretta all'URL della voce; nessun errore di caricamento dinamico.
- [x] 12.8 **FATTO** — test frontend degli ordini in parallelo, in `PuntoVendita.test.tsx`.
  🔴 **Il doppio di Apollo teneva UN ordine solo** (`let ordine`), quindi il caso vero del bancone
  era inesprimibile e un test sarebbe passato anche con una pagina che sovrascrive il primo ordine
  con il secondo — cioè proprio il guasto da escludere. Il doppio ora tiene una **lista**:
  `apriOrdine` conia un id e un numero nuovi a ogni chiamata, `GetOrdine` risponde **per id** e
  `AggiungiRigaOrdine` scrive sull'ordine che la pagina indica, non sull'ultimo aperto.
  ✅ Sei casi, due aggiunti con la pagina «Ordini»: la ripresa da lì non apre un ordine nuovo, e
  lo `state` della navigazione si consuma con un `replace` — senza, un ritorno indietro nel
  browser rimetterebbe la pagina su quell'ordine e la voce successiva finirebbe sul conto
  sbagliato.
  ✅ Quattro casi originari: il secondo ordine nasce senza chiudere il primo; il primo resta `APERTO` con la
  sua riga e il suo totale; le due voci finiscono su `ordineId` **diversi** (55 e 56); e senza un
  ordine in corso il pulsante non si offre.
  🔴 È l'invariante che questa fase introduce e l'unica che, se si rompe, produce **danno contabile
  silenzioso**: una consumazione sul conto sbagliato non lascia traccia di errore, chiude
  regolarmente e sposta soldi fra due incassi entrambi plausibili.
  **Verifica**: `cd duedgusto && npm run test` verde.


---

## Consuntivo delle fasi 10 e 12 — 29 agosto 2026

**Suite**: backend da 986 a **998** verdi, frontend da 934 a **943** verdi; `ts:check` e `lint`
puliti. Nulla committato.

### Scelte prese durante l'apply, che il piano non fissava

- 🔴 **`ConciergeBell` per «Ordini»**, e la scelta è di *forma* prima che di nome. I candidati che
  il piano suggeriva erano tutti pile di righe o fogli: `ListChecks` accanto a `List` (Lista
  fornitori), `ReceiptText` accanto a `Receipt` (Lista fatture), `NotepadText` accanto a
  `FileText`. `iconeDelSeed` confronta i **nomi** e non se ne sarebbe accorto, ma a cassetto
  chiuso `NestedList` mette `opacity: 0` sulle etichette e l'icona **è** la voce.
- 🔴 **`Layers` per «Gruppi prodotti»**, per la stessa ragione: `Boxes` e `Blocks` sarebbero stati
  il secondo pacco accanto a `PackageSearch` di «Prodotti», e le due voci stanno nello stesso
  cassetto una sotto l'altra.
- ⚠️ **La rinumerazione ha toccato tre file e due rami per voce.** Le posizioni di primo livello
  erano 0..9 senza buchi: «Ordini» in 1 ha spostato di uno le nove sotto, in `SeedMenus.cs`,
  `SeedMenusSito.cs` e su entrambi i rami dell'idempotenza (creazione + `UpdateMenuIfNeeded`).
  🔴 Il ramo di allineamento di «Sito» portava la posizione **hardcoded separatamente** dal ramo
  di creazione: correggerne uno solo avrebbe lasciato la voce a oscillare fra due posizioni a
  ogni riavvio. `LeVociDiPrimoLivello_NonCondividonoUnaPosizione` è il test che lo sorveglia.
- **`OrdiniAperti` si è spaccato in due**: `ElencoOrdiniAperti` (query, mutation, dialog) e il
  guscio `OrdiniAperti` (il `Drawer` più il pulsante «Chiudi»). I due usi storici non cambiano
  una riga. Il «Chiudi» sta nel guscio perché da una pagina non ha un chiamante a cui tornare.
- **«Riprendi» dalla pagina naviga al punto vendita** passando l'ordine nello `state`, invece di
  non offrire l'azione. Il punto vendita lo consuma con un `replace`.
- **Con una ricerca in corso i gruppi si sciolgono** e la griglia torna piatta: chi digita
  «campari» cerca *quella* variante, e un tastone che la contiene sarebbe un tocco in più
  proprio nel gesto che doveva essere più corto.
- **`prodottiNonRaggruppati` filtra sui gruppi ATTIVI**, non sull'appartenenza: spegnere un
  gruppo deve far **riapparire** i suoi membri come tessere sciolte, altrimenti sparirebbero
  dalla griglia senza che nessuno li abbia disattivati — invisibili e invendibili.
- **`ProdottoInput.Colore` ha tre valori e tre intenzioni**: `null` è «non toccare», una stringa
  è il colore, la **stringa vuota** è «togli il colore». Senza il terzo caso un colore messo per
  sbaglio non si potrebbe più rimuovere, perché `null` è già impegnato a non azzerarlo.
- **I membri di un gruppo sono una sostituzione totale**, ma solo quando l'input li porta:
  `null` significa «non toccare l'elenco», lista vuota «svuotalo». Appiattirle cancellerebbe la
  composizione a ogni rinomina, in silenzio — svuotare un gruppo non è un errore.

### Ciò che il piano dava per mancante ed era già in piedi

- **12.2 (indicatore dell'ordine corrente)**: la barra bassa mostrava già identificativo, voci e
  totale dalla Fase 8. Il task era stato scritto senza verificarlo.
- **`handleRiprendi`**: riprendere un ordine dall'elenco era già implementato. Il blocco vero era
  solo l'assenza di un gesto «nuovo ordine».

### Resta aperto

- **0.1** — la lista delle ~147 varianti, che blocca **solo i dati** (10.1, 10.2). Meccanismo,
  schema, pagina e tastoni sono in piedi e si provano con gruppi inventati.
- **10.14** — se il colore delle tessere debba seguire il codice o l'`Ordinamento`.
- **12.3** — se basti il numero a distinguere due ordini agli occhi dell'operatore.
- **Fase 11** — allineamento delle spec e documentazione dell'invariante nei due `CLAUDE.md`.
