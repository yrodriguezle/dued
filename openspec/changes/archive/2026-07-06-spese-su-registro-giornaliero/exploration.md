# Exploration: spese-su-registro-giornaliero

**Change**: spese-su-registro-giornaliero
**Riferimento**: GitHub issue #8
**Decisione utente**: la chiusura mensile torna a essere PURA AGGREGAZIONE; le spese
appartengono sempre a un registro giornaliero. Modello scelto = **OPZIONE B**: estendere
`SpesaCassa` sul registro con `Categoria` (enum `CategoriaSpesa`) + `MetodoPagamento`
(Contanti vs Banca/Altro), assorbendo le `SpesaMensileLibera`. `PagamentoFornitore` resta
separato perché porta fattura/DDT.

---

## Current State

### Modello dati spese (oggi le spese vivono in 4 posti)
- `SpesaCassa` (tabella `SpeseCassa`) → legata a `RegistroCassa` giornaliero. Campi:
  `Id, RegistroCassaId, Descrizione, Importo`. Nessuna categoria, nessun metodo pagamento.
  (`backend/Models/SpesaCassa.cs`)
- `PagamentoFornitore` (tabella `PagamentiFornitori`) → ha `RegistroCassaId?` **nullable**
  (`backend/Models/PagamentoFornitore.cs:41`), `MetodoPagamento` (string 50),
  `FatturaId?`/`DdtId?`. Può appartenere a un registro (origine-cassa) **o** a una chiusura
  (origine-chiusura, `RegistroCassaId == null`) via join `PagamentiMensiliFornitori`.
- `SpesaMensileLibera` (tabella `SpeseMensiliLibere`) → appesa direttamente a
  `ChiusuraMensile` via `ChiusuraId`. Campi: `SpesaId, ChiusuraId, Descrizione, Importo,
  Categoria (enum CategoriaSpesa = Affitto/Utenze/Stipendi/Altro), Data (date, nullable)`.
  Il campo `Data` è stato aggiunto in migration `20260705164940_AddDataToSpesaMensileLibera`
  con backfill al 1° del mese della chiusura. (`backend/Models/SpesaMensileLibera.cs`)
- `SpesaMensile` (tabella `SpeseMensili`) → **legacy MORTO**. Ancora agganciato a
  `ConnectionQueries.speseMensili` (`ConnectionQueries.cs:237`) e a
  `PagamentoFornitoreType.cs:37` (`Field speseMensili`). `MigrazioneChiusureMensiliService`
  è un **no-op** (`MigrazioneChiusureMensiliService.cs:25`, restituisce solo un errore).

### Riconciliazione cassa del giorno (CRITICO per sub-nodo 3a)
Formula unica, calcolata in **due** punti coerenti:
- `MutateRegistroCassaOrchestrator.CalcolaTotali` (`:336-346`):
  ```
  ContanteAtteso  = IncassoContanteTracciato - SpeseFornitori - SpeseGiornaliere
  incassoGiorno   = TotaleChiusura - TotaleApertura
  Differenza      = incassoGiorno - ContanteAtteso
  ```
- `RegistroCassaSyncService.RecalculateSpeseFornitoriAsync` (`:60-63`): stessa formula
  (variante che usa `VenditeContanti`).

`SpeseGiornaliere` = Σ `SpesaCassa.Importo` del registro (`AggiungiSpese` `:162-175`).
`SpeseFornitori` = Σ `PagamentoFornitore.Importo` linkati al registro (`:218-222`).

**Conseguenza contabile**: OGGI **tutte** le spese (SpeseCassa E pagamenti fornitori)
sottraggono dal contante atteso, cioè sono trattate come uscite di cassa in contanti. Il
campo `MetodoPagamento` di `PagamentoFornitore` **NON influisce** sulla riconciliazione:
anche un pagamento bonifico riduce oggi il contante atteso. Questo è un pre-esistente
over-subtracting da tenere presente nel design.

### KPI speciali della chiusura (da eliminare)
Tutti `[NotMapped]` in `backend/Models/ChiusuraMensile.cs`, esposti in
`ChiusuraMensileType.cs` e consumati dal frontend:
- `SpeseAggiuntiveCalcolate` (`:96`) + `SpeseAggiuntiveNonDuplicateCalcolate` (`:160-177`)
  → gestiscono il caso speciale "spese fuori registro" e l'anti-doppio-conteggio dei
  pagamenti già presenti nei registri (PR #7).
- `TotaleSpeseCalcolato` (`:187-191`), `DifferenzaCalcolata` (`:198`).
- Navigation da rimuovere: `SpeseLibere` (`:52`), `PagamentiInclusi` (`:57`).
  Da MANTENERE: `RegistriInclusi` (`RegistriCassaMensili`) — unica join legittima.

### Vincoli RegistroCassa (per sub-nodo 3b)
- Indice **UNIQUE su `Data`** (`AppDbContext.cs:162`): un solo registro per data → utile per
  find-or-create idempotente.
- `Data` `IsRequired`, tipo `date`. `UtenteId` int (FK Restrict). Tutti i decimali
  (vendite, spese, quadratura) hanno default 0 e non sono NOT NULL bloccanti.
- **Non esiste vincolo che impedisca un registro a sole spese** (senza vendite): infatti
  `RegistroCassaSyncService.FindOrCreateRegistroCassaAsync` (`:25-43`) crea già registri
  `DRAFT` con solo `Data` + `UtenteId` quando si paga una fattura dalla pagina fatture.
- **Ostacolo reale**: `GestioneCassaGuards.GuardGiornoOperativoConPeriodi`
  (`GestioneCassaGuards.cs:49-86`) blocca `mutateRegistroCassa` per un **giorno di chiusura**
  (non operativo) → un affitto pagato in un giorno di chiusura NON può passare dalla mutation
  standard. `GuardMeseChiuso` (`:21`) blocca inoltre le date di un mese già chiuso.
  N.B. il path `FindOrCreateRegistroCassaAsync` (fatture) **non** applica questi guard.

---

## Affected Areas

### Backend — Models / DataAccess
- `backend/Models/SpesaCassa.cs` — aggiungere `Categoria` (enum) + `MetodoPagamento`.
- `backend/Models/ChiusuraMensile.cs` — rimuovere nav `SpeseLibere`, `PagamentiInclusi` e i
  `[NotMapped]` speciali (`SpeseAggiuntive*`, `TotaleSpeseCalcolato`, `DifferenzaCalcolata`).
- `backend/Models/SpesaMensileLibera.cs`, `PagamentoMensileFornitori.cs`, `SpesaMensile.cs`
  — da eliminare (entità + DbSet + config).
- `backend/DataAccess/AppDbContext.cs` — DbSet `SpeseMensiliLibere` (`:47`),
  `PagamentiMensiliFornitori` (`:48`), `SpeseMensili`; config `SpesaMensileLibera`
  (`:985-1031`) e `PagamentoMensileFornitori` (`:1033-1059`); estendere config `SpesaCassa`
  (`:303-325`).
- Nuove migration EF: (1) `AddCategoriaMetodoToSpesaCassa`, (2) data-migration
  `SpeseMensiliLibere → SpeseCassa`, (3) `DropSpeseMensiliLibere/PagamentiMensiliFornitori/SpeseMensili`.

### Backend — GraphQL
- `backend/GraphQL/GestioneCassa/Types/SpesaCassaType.cs` — estendere `SpesaCassaType`,
  `SpesaCassaInput`, `SpesaCassaInputType` con categoria + metodo.
- `backend/GraphQL/GestioneCassa/MutateRegistroCassaOrchestrator.cs` — `AggiungiSpese`
  (`:162-175`) mappare i nuovi campi; `CalcolaTotali` (`:336-346`) rivedere la formula per
  contare solo le spese in contanti nel contante atteso.
- `backend/Services/Fornitori/RegistroCassaSyncService.cs` — `RecalculateSpeseFornitoriAsync`
  (`:60-63`) allineare alla nuova regola contanti/non-contanti.
- `backend/GraphQL/ChiusureMensili/ChiusureMensiliMutations.cs` — rimuovere
  `aggiungiSpesaLibera`/`modificaSpesaLibera`/`eliminaSpesaLibera`,
  `aggiungi/modifica/eliminaPagamentoFornitoreInChiusura`, `includiPagamentoFornitore`,
  `migraChiusureMensiliVecchioModello`.
- `backend/GraphQL/ChiusureMensili/Types/` — rimuovere `SpesaMensileType`,
  `SpesaMensileInputType`, `SpesaMensileTyperaType`, `SpesaMensileTyperaInputType`,
  `PagamentoMensileFornitoriType`; ripulire `ChiusuraMensileType`/`ChiusuraMensileInputType`.
- `backend/GraphQL/Connection/ConnectionQueries.cs:237` — rimuovere query `speseMensili` e gli
  `Include(SpeseLibere/PagamentiInclusi)` (`:230-231`).
- `backend/GraphQL/Fornitori/Types/PagamentoFornitoreType.cs:37` — rimuovere field `speseMensili`.
- `backend/Services/ChiusureMensili/ChiusuraMensileService.cs` — rimuovere
  `AggiungiSpesaLiberaAsync`/`Modifica`/`Elimina` (`:228,:622,:673`),
  `AggiungiPagamentoFornitoreInChiusuraAsync`/`Modifica`/`Elimina` (`:366,:467,:556`),
  `IncludiPagamentoFornitoreAsync` (`:288`); rivedere `GetChiusuraConRelazioniAsync` (`:900`)
  e la valorizzazione degli avvisi/KPI.
- `backend/Services/ChiusureMensili/MigrazioneChiusureMensiliService.cs` — eliminare o
  riconvertire nel nuovo migratore dati.

### Frontend (`duedgusto/src`)
- Pagina principale: `components/pages/registrazioneCassa/MonthlyClosureDetails.tsx`
  (routing in `routes/ProtectedRoutes.tsx:11,76-93`). Grid condivisa `SpeseDataGrid.tsx`,
  report `MonthlyClosureReport.tsx`, dialog `PagamentoFornitoreDialog.tsx`.
- Mutation da rimuovere: `graphql/chiusureMensili/mutations.tsx` (`aggiungiSpesaLibera`
  `:44`, `modificaSpesaLibera` `:71`, `eliminaSpesaLibera` `:94`, `includiPagamentoFornitore`
  `:115` [già dead], `aggiungiPagamentoFornitoreInChiusura` `:176`,
  `modificaPagamentoFornitoreInChiusura` `:206`, `eliminaPagamentoFornitoreInChiusura` `:244`).
  Wiring `useMutation` in `MonthlyClosureDetails.tsx:90-95`, chiamate `:194,:208,:221,:239`.
- KPI/fragment: `graphql/chiusureMensili/fragments.tsx` (`speseLibere` `:95-97`,
  `pagamentiInclusi` `:99-100`, `speseAggiuntiveCalcolate` `:65`,
  `speseAggiuntiveNonDuplicateCalcolate` `:73`, `totaleSpeseCalcolato` `:74`,
  `differenzaCalcolata` `:75`). Tipi `@types/MonthlyClosure.d.ts` (`SpesaMensileLibera` `:17`,
  `PagamentoMensileFornitori` `:57`, `CategoriaSpesa` `:13`, KPI `:85,94-96`, `speseLibere`
  `:102`, `pagamentiInclusi` `:103`).
- Consumo KPI in pagina: `MonthlyClosureDetails.tsx:426,431-435,572-574`; report `:78,92,182`.
- Destinazione (registro giornaliero): `RegistroCassaDetails.tsx`,
  `@types/RegistroCassa.d.ts`, `graphql/registroCassa/*`, `SpeseDataGrid` (già distingue le
  righe con `isPagamentoFornitore` e `registroCassaId`).
- `CategoriaSpesa`/`categoriaOptions` già presenti in `SpeseDataGrid.tsx:72,257` e
  `MonthlyClosureDetails.tsx:689` → riusabili sul registro giornaliero.
- Test da aggiornare: `__tests__/MonthlyClosureDetails.test.tsx`, `__tests__/SpeseDataGrid.test.tsx`,
  backend `DuedGusto.Tests/Unit/Services/ChiusuraMensileServiceTests.cs`,
  `Integration/GraphQL/MonthlyClosuresQueriesTests.cs`.
- Componenti chiusura già morti (candidati cleanup): `MonthlyClosureList.tsx`,
  `MonthlyClosureForm.tsx`, `MonthlySummaryView.tsx` (non importati).

---

## Sub-nodi OPZIONE B — analisi

### 3a. SpesaCassa acquisisce Categoria + MetodoPagamento; effetto sulla riconciliazione
- **Oggi**: `SpeseGiornaliere` e `SpeseFornitori` sottraggono **entrambe** dal `ContanteAtteso`
  (tutte trattate come uscite contanti). `MetodoPagamento` è puramente informativo.
- **Target**: la spesa deve incidere sul contante del cassetto **solo se pagata in contanti**.
  - Contanti → riduce `ContanteAtteso` (esce dal cassetto).
  - Banca/Altro (bonifico, carta, RID…) → è un **costo del business** ma NON tocca la
    riconciliazione cassa del giorno.
- **Implicazione formula**: serve separare le spese in due aggregati:
  `SpeseGiornaliereContanti` (nel `ContanteAtteso`) e `SpeseGiornaliereNonContanti` (fuori
  cassa, usate solo per costi/KPI). Da decidere se persistere due colonne aggregate su
  `RegistroCassa` o calcolarle dalle righe `SpesaCassa`.
- **Nota coerenza**: la stessa logica dovrebbe applicarsi anche ai `PagamentoFornitore`
  (un pagamento bonifico non dovrebbe ridurre il contante atteso). Oggi non è così →
  decisione di design: allineare anche i pagamenti fornitori alla regola contanti/non-contanti,
  oppure limitarsi a `SpesaCassa` in questa change (rischio incoerenza). **Raccomandato**:
  allineare entrambi con un unico concetto di "metodo pagamento" che decide l'impatto cassa.
- **Enum metodo**: valutare enum tipizzato (`MetodoPagamentoSpesa = Contanti | Banca | Altro`)
  vs riuso della stringa `MetodoPagamento` già presente su `PagamentoFornitore`. Per
  riconciliazione conta solo il flag booleano "è contanti".

### 3b. Giorno senza registro (es. affitto in giorno di chiusura)
- Nessun vincolo NOT NULL impedisce un registro a sole spese; l'indice UNIQUE su `Data`
  garantisce un registro per data.
- L'unico blocco è `GuardGiornoOperativoConPeriodi` (giorno non operativo) e `GuardMeseChiuso`.
- **Opzioni**:
  1. **Registro leggero find-or-create** alla data di pagamento, sul modello di
     `FindOrCreateRegistroCassaAsync`, **bypassando** il guard giorno-operativo per le spese
     (una spesa non è un'operazione di vendita). Richiede una mutation dedicata
     (es. `aggiungiSpesaSuGiorno(data, ...)`) che crea il registro `DRAFT` se assente.
  2. Agganciare al registro operativo più vicino (meno intuitivo, sporca la data di competenza).
- **Raccomandato**: opzione 1 (registro leggero al volo). Da decidere in design: se il
  `GuardMeseChiuso` deve continuare a bloccare (sì: non si tocca un mese chiuso) e se un
  registro a sole spese deve poter restare `DRAFT` senza conteggi moneta.

### 3c. Migrazione dati `SpeseMensiliLibere` → `SpesaCassa`
- Ogni riga `SpeseMensiliLibere` ha già `Data` (post migration `20260705164940`, con backfill
  al 1° del mese). Regola: find-or-create `RegistroCassa` per `Data`, poi inserire `SpesaCassa`
  con `Descrizione`, `Importo`, `Categoria` (mappata 1:1).
- **Idempotenza**: `SpesaCassa` non ha una chiave naturale che la leghi alla riga originale.
  Serve un marcatore anti-duplicazione (es. prefisso in `Descrizione` tipo
  `"[mensile] ..."`, o una colonna temporanea `MigratoDaSpesaMensileLiberaId`, oppure eseguire
  la data-migration in un unico step EF non ri-eseguibile). La find-or-create per data è già
  idempotente lato registro (UNIQUE su Data).
- **MetodoPagamento per righe storiche**: le spese libere storiche NON erano nel cassetto di
  alcun registro. Migrarle come **Contanti** creerebbe retroattivamente `Differenza` sui
  registri esistenti (anche chiusi). **Raccomandato default = Banca/Altro (non contanti)** per
  preservare la quadratura storica; l'affitto/utenze/stipendi sono realisticamente non-cash.
- **Registri creati dalla migrazione**: potrebbero cadere in giorni non operativi (backfill al
  1° del mese) → la data-migration SQL bypassa i guard applicativi, quindi ok, ma occhio a non
  invalidare chiusure già `CHIUSA`/`RICONCILIATA` (le spese aggiunte cambierebbero i KPI
  aggregati anche di mesi chiusi — vedi rischio sotto).
- Test su restore prod→locale come da criterio di accettazione issue #8.

---

## Approaches

1. **Estendere SpesaCassa (OPZIONE B, decisa)** — `SpesaCassa` diventa la sede unica delle
   spese non-documentali (assorbe `SpesaMensileLibera`); `PagamentoFornitore` resta per le
   spese con fattura/DDT; chiusura = pura aggregazione dei registri.
   - Pros: allineato alla decisione issue #8; una sola sede per le spese del giorno; KPI
     tracciato/non-tracciato quadrano dai soli registri; elimina legacy e residuo PR #7.
   - Cons: tocca modello + 3 migration + riconciliazione cassa (rischio contabile); data-migration
     con idempotenza non banale.
   - Effort: **High**.

2. **Entità spesa unica tipizzata** (follow-up citato in issue #8 punto 3) — un'unica entità
   `Spesa` sul registro con `tipo` (cassa / costo fisso / documento).
   - Pros: massima uniformità futura.
   - Cons: fuori scope per questa change; refactor più invasivo. Effort: Very High.
   → Rimandare a follow-up; non in questa change.

---

## Recommendation
Procedere con **OPZIONE B** in tre blocchi: (1) estendere `SpesaCassa` con `Categoria` +
`MetodoPagamento` e rivedere `CalcolaTotali`/`RecalculateSpeseFornitori` per contare in cassa
solo le spese in contanti; (2) data-migration idempotente `SpeseMensiliLibere → SpesaCassa`
(find-or-create registro per `Data`, metodo default **non contanti**); (3) rimozione di
`SpesaMensileLibera`, `PagamentoMensileFornitori`, `SpesaMensile` legacy, mutation di chiusura
e KPI speciali, con la chiusura ridotta alla sola aggregazione via `RegistriCassaMensili`.
Le decisioni contabili (regola contanti/non-contanti anche sui pagamenti fornitori; gestione
dei mesi già chiusi) vanno fissate in design, preferibilmente con validazione dall'agente
contabile.

## Risks
- **Riconciliazione cassa**: cambiare la formula `ContanteAtteso` è ad alto impatto; test di
  quadratura backend e frontend (`aggregaRegistri`) da riverificare. Rischio regressione su
  registri esistenti.
- **Incoerenza contanti/non-contanti**: se si applica la regola solo a `SpesaCassa` e non ai
  `PagamentoFornitore`, resta un doppio standard confuso.
- **Mesi già CHIUSI/RICONCILIATI**: la migrazione aggiunge `SpesaCassa` a registri di mesi
  chiusi → gli aggregati della chiusura cambiano a runtime (KPI `[NotMapped]`). Serve decidere
  se accettabile (come già fatto per `ricavoNettoCalcolato`) o se congelare i mesi chiusi.
- **Idempotenza migrazione**: senza marcatore, ri-esecuzioni duplicano le `SpesaCassa`.
- **Perdita dato**: `CreatedAt/UpdatedAt` e categoria delle spese libere vanno preservati.
- **Frontend condiviso**: `SpeseDataGrid` è usata sia da chiusura sia da registro; il refactor
  deve non rompere il flusso del registro giornaliero.
- **Guard giorno operativo**: spesa in giorno di chiusura richiede un percorso che bypassa
  `GuardGiornoOperativoConPeriodi` senza aprire buchi (es. creare registri di vendita in
  giorni non operativi dalla UI normale).

## Decisioni aperte per il design
1. Enum dedicato `MetodoPagamentoSpesa` vs riuso stringa `MetodoPagamento`; il flag rilevante
   per la cassa è solo "contanti sì/no".
2. Aggregati `SpeseGiornaliereContanti`/`NonContanti` persistiti su `RegistroCassa` o calcolati
   dalle righe.
3. Applicare la regola contanti/non-contanti anche ai `PagamentoFornitore` (allineamento) o no.
4. Mutation dedicata `aggiungiSpesaSuGiorno(data)` con registro leggero find-or-create vs
   estensione della mutation `mutateRegistroCassa`.
5. Default `MetodoPagamento` per le righe storiche migrate (raccomandato: non contanti).
6. Strategia di idempotenza della data-migration (marcatore vs one-shot).
7. Comportamento per i mesi già chiusi toccati dalla migrazione.
8. `SpesaMensile` legacy: rimozione tabella `SpeseMensili` + eventuale FK residua verso
   `PagamentoFornitore.SpeseMensili`.

## Chiarimenti (feedback utente — 2ª iterazione)

Correzione della premessa: **nessuna chiusura mensile è mai stata eseguita**; "chiudere un
GIORNO" blinda le vendite ma le SPESE restano ammesse. La verità sulle formule sta nella
**chiusura giornaliera** (`RegistroCassa`). Verifiche nel codice reale:

### 1a. Semantica `RegistroCassa.Stato` e cosa blocca
Flusso `DRAFT → CLOSED → RECONCILED`.
- **`mutateRegistroCassa`** (`MutateRegistroCassaOrchestrator.cs:44-46`): applica SOLO
  `GuardMeseChiuso` + `GuardGiornoOperativoConPeriodi`. **NON controlla `Stato == CLOSED`** →
  un registro CLOSED può essere ri-mutato per intero, spese incluse (le `SpesaCassa` vengono
  `RemoveRange` + re-inserite in `UpsertRegistroBase:111-112`). Conferma: chiudere il giorno
  NON blocca le spese.
- **Frontend** (`RegistroCassaDetails.tsx:543-545`): `disableSave = isReconciled || ...` → il
  salvataggio è disabilitato SOLO in `RECONCILED`. In `CLOSED` il form resta editabile (chip
  "Giorno chiuso" solo informativo, `:608-617`). Quindi solo **RECONCILED** blinda davvero.
- **`chiudiRegistroCassa`** (`ChiudiRegistroCassaOrchestrator.cs:36-40`): blocca la ri-chiusura
  se già CLOSED/RECONCILED; stessi due guard.
- **`eliminaRegistroCassa`** (`EliminaRegistroCassaOrchestrator.cs:33`): solo `DRAFT`.
- **`GuardGiornoOperativoConPeriodi`** (`GestioneCassaGuards.cs:49-86`): blocca
  creare/chiudere un registro in un **giorno non operativo** (giorno di chiusura settimanale)
  secondo i periodi di programmazione, con fallback su `BusinessSettings.OperatingDays`.
- **`GuardMeseChiuso`** (`:21-28`): blocca le date di un mese con `ChiusuraMensile`
  `CHIUSA`/`RICONCILIATA` (oggi irrilevante: nessuna chiusura esiste).
- `RECONCILED` è escluso anche dal ricalcolo IVA (`RicalcoloIvaStimaService.cs:65`).

### 1b. Formula riconciliazione (fonte: chiusura giornaliera)
`MutateRegistroCassaOrchestrator.CalcolaTotali` (`:336-346`), riga per riga:
```
SpeseGiornaliere = Σ SpesaCassa.Importo            (AggiungiSpese :162-175 → :338)
ContanteAtteso   = IncassoContanteTracciato − SpeseFornitori − SpeseGiornaliere   (:340-342)
incassoGiorno    = TotaleChiusura − TotaleApertura                               (:344)
Differenza       = incassoGiorno − ContanteAtteso                                (:345)
ContanteNetto    = incassoGiorno                                                 (:346)
```
- `SpeseFornitori` e `SpeseGiornaliere` entrano in modo **identico** (entrambe sottratte, come
  uscite di cassa): **nessuna distinzione** oggi.
- `IncassiElettronici` e `IncassiFattura` **NON** entrano in `ContanteAtteso`/`Differenza`
  (incassi non-contanti; confluiscono solo in `TotaleVendite` via `BreakdownIvaApplier`).
- Variante gemella `RegistroCassaSyncService.RecalculateSpeseFornitoriAsync:60-63`: stessa
  formula ma usa `VenditeContanti` invece di `IncassoContanteTracciato` → **piccola
  discrepanza** tra i due punti di calcolo, da uniformare in design.

### 1c. Popolamento `SpeseFornitori` / `SpeseGiornaliere` (cruciale)
Gli input `input.SpeseFornitori`/`input.SpeseGiornaliere` vengono impostati in
`UpsertRegistroBase:126-127` ma poi **SOVRASCRITTI** da somme derivate dalle righe:
- `SpeseGiornaliere = Σ SpesaCassa.Importo` del giorno (`:338`).
- `SpeseFornitori = Σ PagamentoFornitore.Importo` linkati al registro (`:218-222`).
Sono quindi **totali derivati, non campi manuali**. → Aggiungere `Categoria`/`MetodoPagamento`
a `SpesaCassa` e filtrare i non-contanti nella somma cambia **direttamente** la riconciliazione,
toccando solo `AggiungiSpese`/`CalcolaTotali` (e, per coerenza, la somma dei pagamenti fornitori).

### 2. `ChiusuraMensile.Stato` — mai usato
`SeedData/` non contiene alcun seed di `ChiusuraMensile`/`SpesaMensileLibera` (grep vuoto);
il flusso esiste ma non risulta esercitato. Semantica prevista: `BOZZA → CHIUSA → RICONCILIATA`
(`CHIUSA` blinda il mese via `GuardMeseChiuso`; `RICONCILIATA` stato finale). Non serve query DB:
l'assenza di seed/fixture conferma che la premessa "mesi già chiusi toccati dalla migrazione" è
**irrilevante** → rischio declassato.

### 3. `PagamentoFornitore.MetodoPagamento` — già esistente, riusabile
- Backend: `string?` `MaxLength(50)` (`PagamentoFornitore.cs:26`) — **stringa libera, non enum**.
- Frontend: select a 2 valori **"Contanti" / "Bonifico"** (`PagamentoFornitoreDialog.tsx:478-479`),
  default **"Contanti"** (`:235`). Mappato in `MonthlyClosureDetails.tsx:180,233`.
- `SpesaCassa` oggi NON ha il campo.
- **Uso nella riconciliazione: NESSUNO** — `SpeseFornitori = Σ Importo` a prescindere dal metodo
  (`MutateRegistroCassaOrchestrator.cs:218-222`, `RegistroCassaSyncService.cs:56-58`). Anche un
  "Bonifico" riduce oggi il `ContanteAtteso` → over-subtracting pre-esistente.
- **Fattibile** riusare questa stringa ("Contanti" = cassa; qualsiasi altro = non-cash) per la
  regola contanti/non-contanti ed estenderla a `SpesaCassa`. In design valutare enum tipizzato
  vs stringa condivisa; il flag rilevante è solo booleano "è contanti".

## Ready for Proposal
**Sì.** L'ambito è chiaro e i punti di design sono circoscritti. L'orchestrator dovrebbe
proporre la change `spese-su-registro-giornaliero` e, in fase di design, far validare dal
profilo contabile la regola contanti/non-contanti (estesa anche ai `PagamentoFornitore`) e
l'uniformazione dei due punti di calcolo della riconciliazione.
