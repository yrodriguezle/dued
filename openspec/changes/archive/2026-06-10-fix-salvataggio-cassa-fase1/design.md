# Design: Fix Salvataggio Cassa — Fase 1

## Technical Approach

La causa radice del mancato salvataggio è la ricreazione di documenti (DDT e fatture acquisto) che violano gli indici UNIQUE `IX_DocumentiTrasporto_FornitoreId_NumeroDdt` e `IX_FattureAcquisto_FornitoreId_NumeroFattura` durante la riscrittura del registro. La strategia è a tre livelli, tutti applicativi (nessuna migrazione DB):

1. **Backend — idempotenza documenti**: `CreaDocumentoTrasporto` e `CreaFatturaAcquisto` in `MutateRegistroCassaOrchestrator.cs` diventano *lookup-or-create* sulla stessa chiave dell'indice UNIQUE, con normalizzazione del numero vuoto tramite placeholder deterministico. Il blocco "doppia registrazione" resta solo quando la fattura ha pagamenti di **un altro** registro.
2. **Frontend — sync ID post-submit**: dopo mutation riuscita, le righe spesa della griglia vengono aggiornate con `pagamentoId`/`fatturaId`/`ddtId` restituiti da `mutateRegistroCassa` (il type `PagamentoFornitore` li espone già: **nessuna estensione dello schema GraphQL necessaria**), così un risalvataggio immediato percorre il ramo UPDATE invece di ricreare documenti.
3. **Correzioni collaterali**: formula `ContanteAtteso` in `CalcolaTotali`, dettagli errori GraphQL solo in Development, secrets fuori da `appsettings.json` versionato, totali frontend dal server.

Verifiche fatte sul codice reale che vincolano il design:
- `PagamentoFornitoreType` (`backend/GraphQL/Fornitori/Types/PagamentoFornitoreType.cs`) espone già `pagamentoId`, `fatturaId`, `ddtId` e i nested `fattura { numeroFattura, fornitore { fornitoreId } }` / `ddt { numeroDdt, fornitore { fornitoreId } }`; il `RegistroCassaFragment` frontend (`duedgusto/src/graphql/cashRegister/fragments.tsx`) li seleziona già nella response della mutation.
- `Program.cs` legge **già** `CONNECTION_STRING` (riga 78) e `JWT_SECRET_KEY` (riga 144) da variabili d'ambiente con fallback su `appsettings.json`, e carica `backend/.env` via DotNetEnv (`Env.Load()`, riga 35). Il lavoro residuo è rimuovere i valori dal file versionato e rendere il fallback sicuro per ambiente.
- `CashSummary.tsx` **non è montato da nessun componente** (nessun import nel codebase): è dead code; `SummaryDataGrid.tsx` è l'unico riepilogo renderizzato (da `CashRegisterFormDataGrid.tsx:111`).
- MySQL non supporta indici parziali/filtrati: l'opzione "indice filtrato per escludere stringa vuota" richiederebbe colonne generate + migrazione, quindi è esclusa.

## Architecture Decisions

### Decision 1: Riuso DDT — lookup-or-create + placeholder deterministico per numero vuoto

**Choice**: `CreaDocumentoTrasporto` esegue lookup per `(FornitoreId, NumeroDdt)` e riusa il record esistente (aggiornando `DataDdt` e `Importo`). Per `NumeroDdt` vuoto/whitespace, il numero viene normalizzato in un placeholder deterministico `SN-{dataRegistro:yyyyMMdd}-{seq}` prima del lookup, dove `seq` è il primo progressivo "libero" per quel fornitore in quella data. Un DDT con placeholder è "libero" se non ha pagamenti oppure ha solo pagamenti del registro corrente, e non è già stato consumato da un'altra riga della stessa richiesta.

**Alternatives considered**:
- *Consentire duplicati su numero vuoto (riusare sempre lo stesso DDT con `NumeroDdt=""`)*: l'indice UNIQUE ammette UN solo DDT per fornitore con numero vuoto in assoluto; tutte le spese senza numero dello stesso fornitore (anche di giorni diversi) finirebbero sullo stesso record, corrompendo la semantica documentale (una sola `DataDdt`).
- *Indice filtrato che esclude la stringa vuota*: non supportato da MySQL senza colonna generata + migrazione; il proposal richiede zero migrazioni.
- *Placeholder casuale (GUID/timestamp)*: rompe l'idempotenza — ogni risalvataggio senza ID genererebbe un placeholder diverso e quindi un duplicato logico.

**Rationale**: la chiave di riuso coincide esattamente con quella dell'indice UNIQUE, quindi se il DB li considera lo stesso documento il riuso è semanticamente corretto. Il placeholder deterministico per data+fornitore rende il salvataggio idempotente (risalvare lo stesso registro ritrova gli stessi placeholder) e supporta N righe senza numero per lo stesso fornitore nello stesso giorno (`seq` crescente). Prefisso `SN-` ("senza numero") riconoscibile, lunghezza ≤ 50 (`MaxLength(50)` su `NumeroDdt`).

**Sketch implementativo** (dentro la transazione esistente):

```csharp
// firma estesa: serve l'Id del registro e lo stato di richiesta per i placeholder
private static async Task<int> CreaODedupDocumentoTrasporto(
    AppDbContext db,
    PagamentoFornitoreRegistroInput pagInput,
    DateTime dataRegistro,
    int registroCassaId,
    HashSet<int> ddtConsumatiNellaRichiesta)
{
    string numero = (pagInput.NumeroDdt ?? "").Trim();

    if (numero.Length > 0)
    {
        DocumentoTrasporto? existing = await db.DocumentiTrasporto
            .FirstOrDefaultAsync(d => d.FornitoreId == pagInput.FornitoreId && d.NumeroDdt == numero);
        if (existing != null)
        {
            existing.DataDdt = pagInput.DataDdt ?? dataRegistro;
            existing.Importo = pagInput.Importo;
            existing.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return existing.DdtId;
        }
        // create con numero originale (vedi sotto)
    }
    else
    {
        string prefix = $"SN-{dataRegistro:yyyyMMdd}-";
        List<DocumentoTrasporto> candidati = await db.DocumentiTrasporto
            .Include(d => d.Pagamenti)
            .Where(d => d.FornitoreId == pagInput.FornitoreId && d.NumeroDdt.StartsWith(prefix))
            .ToListAsync();

        DocumentoTrasporto? libero = candidati
            .Where(d => !ddtConsumatiNellaRichiesta.Contains(d.DdtId))
            .FirstOrDefault(d => d.Pagamenti.All(p => p.RegistroCassaId == registroCassaId));
        if (libero != null)
        {
            ddtConsumatiNellaRichiesta.Add(libero.DdtId);
            libero.Importo = pagInput.Importo;
            libero.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return libero.DdtId;
        }
        int seq = candidati.Count + 1;          // primo progressivo non occupato
        numero = $"{prefix}{seq}";
    }
    // ... creazione nuova come oggi, con NumeroDdt = numero; aggiungere il nuovo DdtId
    // a ddtConsumatiNellaRichiesta
}
```

Nota: se `DocumentoTrasporto` non ha la navigation `Pagamenti`, il check si fa con una sub-query su `db.PagamentiFornitori` (`!await db.PagamentiFornitori.AnyAsync(p => p.DdtId == d.DdtId && p.RegistroCassaId != registroCassaId)`); **nessuna modifica al modello EF** richiesta.

### Decision 2: Dedup fatture — estesa al numero vuoto, blocco solo per pagamenti di altri registri

**Choice**: in `CreaFatturaAcquisto`:
1. Normalizzare il numero vuoto con lo **stesso meccanismo placeholder** `SN-{yyyyMMdd}-{seq}` (riuso del helper della Decision 1, parametrizzato sull'entità).
2. Eseguire **sempre** il lookup `(FornitoreId, NumeroFattura)` (oggi saltato se `IsNullOrEmpty`, riga ~333).
3. Se la fattura esiste: bloccare con `InvalidOperationException` (messaggio chiaro già presente) **solo se** `existing.Pagamenti.Any(p => p.RegistroCassaId != registroCassaId)`; altrimenti riusarla aggiornando `Imponibile`/`ImportoIva`/`TotaleConIva`/`DataFattura` con i valori ricalcolati dall'input (stessa logica di scorporo già usata in `UpdatePagamentiEsistenti`).

Firma estesa: `CreaFatturaAcquisto(db, pagInput, dataRegistro, registroCassaId, fattureConsumateNellaRichiesta)` — `registroCassa.Id` è già disponibile nel chiamante `CreaPagamentiNuovi`.

**Alternatives considered**:
- *Bloccare sempre quando esistono pagamenti* (comportamento attuale, commit 2244171): falso positivo in riscrittura del registro quando una riga mantenuta e una nuova puntano alla stessa fattura, o in scenari multi-client; il salvataggio legittimo fallisce.
- *Riusare sempre senza blocco*: perderebbe la protezione contro la vera doppia registrazione IVA (stessa fattura pagata da due registri diversi), che è un requisito esplicito (Success Criteria 5).

**Rationale**: la discriminante `RegistroCassaId` è l'unico dato che distingue "riscrittura dello stesso registro" (legittima) da "doppia registrazione" (errore). Nota di coerenza temporale: `DeletePagamenti` (STEP 4) esegue `SaveChangesAsync` prima di STEP 6, quindi i pagamenti rimossi del registro corrente non figurano più nel `Include(f => f.Pagamenti)` al momento del check — il check vede lo stato corretto dentro la transazione.

### Decision 3: Sync ID frontend — mapping per chiave fornitore+documento, mai per indice

**Choice**: in `RegistroCassaDetails.onSubmit`, dopo `submitRegistroCassa` riuscito, mappare `result.pagamentiFornitori` sulle righe spesa con matching a due passate:

1. **Passata 1 (chiave esatta)**: chiave `${fornitoreId}|${tipoDocumento}|${numeroDocumento}` dove per il server la chiave è `p.fattura ? `${p.fattura.fornitore.fornitoreId}|FA|${p.fattura.numeroFattura}` : `${p.ddt.fornitore.fornitoreId}|DDT|${p.ddt.numeroDdt}``, e per la riga griglia `${row.fornitoreId}|${row.documentType}|${row.invoiceNumber || row.ddtNumber || ""}`.
2. **Passata 2 (righe senza numero)**: le righe con numero vuoto (il server ha assegnato un placeholder `SN-...`, quindi la chiave esatta non matcha) si abbinano ai pagamenti server **non ancora abbinati** dello stesso `fornitoreId` + `tipoDocumento`, preferendo l'`importo` uguale, in ordine.
3. Per ogni match: aggiornare la riga con `pagamentoId`, `fatturaId`, `ddtId` **e** `ddtNumber`/`invoiceNumber` con il valore server (incluso l'eventuale placeholder), così al salvataggio successivo la chiave esatta matcha (passata 1) e l'idempotenza è completa.
4. **Mismatch** (pagamenti server non abbinabili o righe rimaste senza ID): non fare nulla di parziale — il `refetchQueries` su `getRegistroCassa` già presente in `useSubmitCashRegister` riallinea tutto; opzionale `awaitRefetchQueries: true` come fallback solo in questo caso non serve, basta loggare con `logger.warn`.

L'aggiornamento delle righe avviene tramite `expensesGridRef.current.api.applyTransaction({ update: righeAggiornate })` (o tramite il context della griglia secondo il pattern della skill datagrid del progetto), senza toccare `initialExpenses` né `gridDirty`.

**Alternatives considered**:
- *Mapping per indice array*: fragile — il backend ricostruisce i pagamenti in ordine non garantito rispetto all'input (delete/update/create) e la griglia mescola spese normali e pagamenti fornitore.
- *`awaitRefetchQueries: true` al posto del sync*: chiude la finestra di race ma rallenta ogni salvataggio e non protegge da un secondo click prima del re-render; il sync immediato dal risultato della mutation è deterministico.

**Rationale**: la chiave fornitore+tipo+numero è la stessa identità usata dagli indici UNIQUE lato DB, quindi il matching è coerente con la semantica backend (richiesta esplicita del proposal, riga "Mappare per chiave... non per indice"). La riscrittura di `ddtNumber`/`invoiceNumber` con il placeholder server è necessaria per la stabilità della chiave ai salvataggi successivi (consapevolmente l'utente vedrà `DDT SN-20260609-1` al posto del numero vuoto: comportamento accettato e informativo, già visibile comunque dopo il refetch).

### Decision 4: Formula ContanteAtteso

**Choice**: in `CalcolaTotali` (righe ~402-423) sostituire

```csharp
registroCassa.ContanteAtteso = registroCassa.VenditeContanti   // forzato a 0 due righe sopra
    - registroCassa.SpeseFornitori
    - registroCassa.SpeseGiornaliere;
```

con

```csharp
registroCassa.ContanteAtteso = registroCassa.IncassoContanteTracciato
    - registroCassa.SpeseFornitori
    - registroCassa.SpeseGiornaliere;
```

Restano invariati: `VenditeContanti = 0` (campo legacy), `TotaleVendite` (somma dei canali di incasso — già corretta), `Differenza = (TotaleChiusura - TotaleApertura) - ContanteAtteso`, `ContanteNetto` e lo scorporo IVA.

**Alternatives considered**: rimuovere del tutto `VenditeContanti` — fuori scope (richiederebbe migrazione/pulizia schema, Fase 4).

**Rationale / verifica di coerenza**: con la formula corretta, `Differenza = incassoFisico - (contanteTracciato - speseTotali)`. È esattamente la formula del frontend `CashSummary` (`difference = dailyIncome - expectedCash` con `expectedCash = incassoContanteTracciato - totalExpenses`, dove `totalExpenses` = spese fornitori + giornaliere): backend e frontend convergono senza modifiche alla semantica di `Differenza`. Nessun ricalcolo retroattivo dei registri già salvati (come da proposal); il valore si corregge al prossimo salvataggio.

### Decision 5: Dettagli errori GraphQL solo in Development

**Choice**: in `Program.cs`:
- `AddErrorInfoProvider`: `opt.ExposeExceptionDetails = builder.Environment.IsDevelopment();` (idem per `ExposeData` e `ExposeExtensions`).
- Nel `UnhandledExceptionDelegate` (righe ~179-197): il logging server-side (`logger.LogError(...)`) resta **sempre attivo**; il blocco che riscrive `exception.ErrorMessage` con tipo/inner/stack trace viene eseguito solo se `env.IsDevelopment()` — la variabile `env` (`IWebHostEnvironment`) è **già risolta** a riga 173, basta usarla.

**Alternatives considered**: variabile di configurazione dedicata (`ExposeGraphQLErrors`) per abilitare i dettagli in staging — scartata: aggiunge superficie di configurazione e il commit `18d9803` era dichiaratamente temporaneo ("fase di test").

**Rationale**: `IHostEnvironment`/`IWebHostEnvironment` è il meccanismo idiomatico ASP.NET già usato nel file (righe 219, 263). In produzione il client riceve il messaggio dell'eccezione applicativa (es. il messaggio di doppia registrazione, che è un `InvalidOperationException` intenzionale e deve restare leggibile) senza stack trace; i dettagli completi restano nei log.

> Nota implementativa: i messaggi delle eccezioni di business (`InvalidOperationException` della Decision 2, `ExecutionError` dei guard) devono continuare ad arrivare al client anche in produzione. Con GraphQL.NET, `ExecutionError` passa sempre; per le eccezioni generiche con `ExposeExceptionDetails=false` il messaggio viene mascherato. Quindi la doppia registrazione va lanciata come `GraphQL.ExecutionError` (o sottoclasse) invece di `InvalidOperationException`, oppure convertita nel delegate. Scelta: **lanciare `ExecutionError`** in `CreaFatturaAcquisto`, pattern già usato altrove (`DocumentoTrasportoService.cs:25`).

### Decision 6: Secrets fuori dal repository, fallback solo in Development

**Choice**:
- `backend/appsettings.json` (versionato): rimuovere il valore di `ConnectionStrings:Default` e di `Jwt:Key` (l'intera sezione `ConnectionStrings` e la chiave `Key`; restano `Jwt:Issuer` e `Jwt:Audience` che non sono segreti).
- `Program.cs`: la catena di risoluzione esistente (`env var → configuration`) acquisisce un terzo gradino attivo **solo in Development**:

```csharp
string connectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING")
    ?? builder.Configuration.GetConnectionString("Default")
    ?? (builder.Environment.IsDevelopment()
        ? "server=localhost;database=duedgusto;user=root;password=root"
        : throw new InvalidOperationException(
            "CONNECTION_STRING non impostata. In produzione impostare la variabile d'ambiente CONNECTION_STRING."));
```

  Stesso pattern per la JWT key, con un valore di sviluppo dichiaratamente insicuro (es. `"dev-only-insecure-jwt-key-do-not-use-in-production"`) **diverso** dalla chiave storica già esposta, così la chiave compromessa smette di funzionare ovunque tranne dove esplicitamente configurata.
- `backend/.env.example`: correggere `DB_CONNECTION_STRING` → `CONNECTION_STRING` (**bug trovato durante il design**: l'esempio documenta una variabile che `Program.cs` non legge) e documentare `JWT_SECRET_KEY`, `SUPERADMIN_PASSWORD`, `SEED_ON_STARTUP`.
- Variabili richieste in produzione (impostabili anche via `backend/.env`, già caricato da DotNetEnv ed escluso da git): `CONNECTION_STRING`, `JWT_SECRET_KEY`.

**Alternatives considered**:
- *Spostare i valori dev in `appsettings.Development.json` e de-tracciarlo (`git rm --cached`)*: il file è oggi tracciato (il pattern `.gitignore` `appsettings.*.json` non rimuove file già tracciati); dopo il de-track, un clone fresco non avrebbe il file e `dotnet run` fallirebbe — viola il Success Criterion "dotnet run locale funziona senza configurazione aggiuntiva".
- *User Secrets (`dotnet user-secrets`)*: pulito ma richiede setup manuale per ogni sviluppatore — stesso problema.

**Rationale**: fallback hardcoded guardato da `IsDevelopment()` è l'unica opzione che soddisfa contemporaneamente "niente secrets utilizzabili in produzione nel repo" e "clone fresco avviabile senza configurazione". `root/root` su localhost non è un segreto reale; la nuova dev JWT key non è mai usata in produzione (fail-fast all'avvio se manca la env var). La rotazione della chiave/password già esposte nella history resta follow-up esplicito fuori scope.

### Decision 7: Totali frontend dal server

**Choice**: la fonte dei valori server è la query `getRegistroCassa` (hook `useQueryCashRegister`, già in `RegistroCassaDetails`) il cui `RegistroCassaFragment` espone già `importoIva`, `totaleVendite`, `contanteAtteso`, `differenza`. Il dato è mantenuto fresco da: refetch post-mutation (`useSubmitCashRegister.refetchQueries`) + subscription `onRegistroCassaUpdated` già attiva. **Nessuna nuova query o estensione di fragment necessaria.**

- `SummaryDataGrid.tsx` (unico riepilogo montato): riceve nuova prop opzionale `registroCassa?: RegistroCassa` (passata da `RegistroCassaDetails` → `CashRegisterFormDataGrid`). Il KPI "Totale Vendite" usa `registroCassa?.totaleVendite` quando disponibile; il fallback locale (registro non ancora salvato) viene **allineato alla formula backend**: `cash + electronic + invoice` invece dell'attuale `movement + electronic + invoice` (riga ~74). Gli altri KPI di editing live (movimento, resto, ecc.) restano calcolati dalle griglie.
- `CashSummary.tsx`: è dead code (nessun import). Per rispettare il proposal viene comunque corretto a costo minimo: la riga `const vatAmount = totalSales * 0.1` (riga 59) diventa scorporo coerente col backend usando `vatRate` dai `BusinessSettings` dello store Zustand (`useStore(s => s.settings)`, popolato in `useBootstrap`): `totalSales * (vatRate / (1 + vatRate))`, con etichetta dinamica; `expectedCash`/`difference` sono già coerenti con la formula backend corretta (Decision 4). La rimozione del componente è proposta per la Fase 4.
- Da segnalare (non in scope, stessa famiglia di divergenza): `VistaMensile.tsx:78` replica le formule di `SummaryDataGrid` — va verificato in fase di verify che non diverga dopo l'allineamento.

**Alternatives considered**:
- *Usare i valori server per tutti i KPI*: durante l'editing i valori resterebbero "congelati" all'ultimo salvataggio, degradando il feedback live che è la funzione primaria del riepilogo.
- *Query dedicata `businessSettings.vatRate` per ricalcolo locale dell'IVA in SummaryDataGrid*: l'IVA non è oggi mostrata in `SummaryDataGrid`; non si aggiunge.

**Rationale**: il backend resta l'unica fonte di verità per i valori persistiti; il fallback locale allineato serve solo come anteprima pre-salvataggio e usa la stessa formula, quindi non può più divergere.

## Data Flow

Flusso di salvataggio (scenario riscrittura, post-fix):

```
RegistroCassaDetails.onSubmit
  │  righe spesa (con pagamentoId/fatturaId/ddtId se già sincronizzati)
  ▼
mutation mutateRegistroCassa(registroCassa)
  │
  ▼
MutateRegistroCassaOrchestrator.ExecuteAsync          [transazione]
  ├─ UpsertRegistroBase / Conteggi / Spese
  ├─ ProcessaPagamentiFornitori
  │    ├─ STEP 3 diff: toDelete / toUpdate / inputNew
  │    ├─ STEP 4 DeletePagamenti (+SaveChanges: libera fatture/DDT del registro)
  │    ├─ STEP 5 UpdatePagamentiEsistenti
  │    └─ STEP 6 CreaPagamentiNuovi
  │         ├─ FA:  CreaFatturaAcquisto  ── lookup (FornitoreId, Numero*) ─┐
  │         └─ DDT: CreaODedupDocTrasporto ─ lookup (FornitoreId, Numero*) ┤
  │              * numero vuoto → placeholder "SN-{yyyyMMdd}-{seq}"        │
  │              riuso se trovato; blocco (ExecutionError) solo se         │
  │              fattura ha pagamenti con RegistroCassaId ≠ corrente ◄─────┘
  ├─ CalcolaTotali (ContanteAtteso = IncassoContanteTracciato − SpeseForn − SpeseGiorn)
  └─ Commit → evento RegistroCassaUpdated
  │
  ▼
response: RegistroCassaFragment (pagamentiFornitori con pagamentoId/fatturaId/ddtId,
          ddt.numeroDdt / fattura.numeroFattura inclusi i placeholder)
  │
  ├─ onSubmit: sync ID → applyTransaction sulle righe spesa
  │            (chiave fornitoreId|tipo|numero, 2 passate)        ← chiude la race
  └─ refetchQueries getRegistroCassa (await=false)                ← riallineamento completo
       │
       ▼
     useQueryCashRegister.cashRegister ──► SummaryDataGrid (totaleVendite server)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/GraphQL/GestioneCassa/MutateRegistroCassaOrchestrator.cs` | Modify | Lookup-or-create DDT con placeholder (Dec. 1); dedup fatture estesa a numero vuoto + blocco solo per altri registri, `ExecutionError` al posto di `InvalidOperationException` (Dec. 2, 5); firma di `CreaFatturaAcquisto`/`CreaDocumentoTrasporto` estesa con `registroCassaId` e set dei documenti consumati; fix `ContanteAtteso` in `CalcolaTotali` (Dec. 4) |
| `backend/Program.cs` | Modify | `ExposeExceptionDetails/Data/Extensions = IsDevelopment()`; dettaglio errori nel delegate solo se `env.IsDevelopment()` (Dec. 5); fallback connection string/JWT key hardcoded solo in Development con fail-fast in produzione (Dec. 6) |
| `backend/appsettings.json` | Modify | Rimozione `ConnectionStrings:Default` e `Jwt:Key`; restano Logging, AllowedHosts, `Jwt:Issuer/Audience` |
| `backend/.env.example` | Modify | `DB_CONNECTION_STRING` → `CONNECTION_STRING` (nome variabile realmente letto da Program.cs); documentazione variabili produzione |
| `duedgusto/src/components/pages/registrazioneCassa/RegistroCassaDetails.tsx` | Modify | In `onSubmit`: matching a due passate e aggiornamento righe spesa con `pagamentoId`/`fatturaId`/`ddtId` + numeri documento dal risultato mutation (Dec. 3); passaggio prop `cashRegister` a `CashRegisterFormDataGrid` (Dec. 7) |
| `duedgusto/src/components/pages/registrazioneCassa/CashRegisterFormDataGrid.tsx` | Modify | Inoltro prop `registroCassa` a `SummaryDataGrid` |
| `duedgusto/src/components/pages/registrazioneCassa/SummaryDataGrid.tsx` | Modify | Prop `registroCassa?`; "Totale Vendite" dal server con fallback formula allineata al backend (Dec. 7) |
| `duedgusto/src/components/pages/registrazioneCassa/CashSummary.tsx` | Modify | IVA da scorporo con `vatRate` dello store (niente 0.1 hardcoded); nota dead-code per Fase 4 (Dec. 7) |
| `duedgusto/src/components/pages/registrazioneCassa/__tests__/SummaryDataGrid.test.tsx` | Modify | Aggiornare le aspettative del KPI Totale Vendite alla nuova formula/prop |

Nessun file eliminato. **Nessuna modifica ai modelli EF Core, nessuna migrazione**: gli indici UNIQUE esistenti (`AppDbContext.cs` righe 668, 722) restano invariati.

## Interfaces / Contracts

**Schema GraphQL**: invariato. Verificato che `PagamentoFornitoreType` espone già `pagamentoId`, `fatturaId`, `ddtId`, `fattura.numeroFattura`, `ddt.numeroDdt` e i `fornitore` annidati; il `RegistroCassaFragment` li seleziona già nella mutation. Nessuna estensione necessaria.

**Convenzione placeholder numero documento** (nuovo contratto applicativo, condiviso FA/DDT):

```
SN-{dataRegistro:yyyyMMdd}-{seq}     es. SN-20260609-1
```

- generato solo quando il numero documento in input è vuoto/whitespace;
- `seq` ≥ 1, primo progressivo libero per (fornitore, prefisso data);
- il frontend lo tratta come un numero qualsiasi (lo riscrive nella riga dopo il sync ID).

**Prop frontend**:

```tsx
// SummaryDataGrid.tsx / CashRegisterFormDataGrid.tsx
interface SummaryDataGridProps {
  summaryData: SummaryData;
  registroCassa?: RegistroCassa | null;   // valori server (totaleVendite, ...)
}
```

**Firma backend** (privata, stesso file):

```csharp
private static async Task<int> CreaFatturaAcquisto(
    AppDbContext db, PagamentoFornitoreRegistroInput pagInput,
    DateTime dataRegistro, int registroCassaId, HashSet<int> fattureConsumate);

private static async Task<int> CreaDocumentoTrasporto(
    AppDbContext db, PagamentoFornitoreRegistroInput pagInput,
    DateTime dataRegistro, int registroCassaId, HashSet<int> ddtConsumati);
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Backend (manuale — nessuna infra test backend nel progetto) | Tutti i Success Criteria del proposal: salvataggio con totale negativo + documenti; risalvataggio multiplo pre-refetch; 2 DDT senza numero stesso fornitore; fattura numero vuoto; blocco doppia registrazione cross-registro; formula `ContanteAtteso`/`Differenza` | `dotnet build` + scenario manuale via app (skill `verify`/`run`); verifica record su MySQL (nessun duplicato, placeholder `SN-...` corretti) |
| Unit frontend (Vitest) | `SummaryDataGrid`: Totale Vendite da prop server e fallback formula allineata | Aggiornare `__tests__/SummaryDataGrid.test.tsx` esistente |
| Unit frontend (Vitest) | Funzione di matching sync ID (estraibile come helper puro): chiave esatta, passata ordinale senza numero, mismatch → no-op | Nuovo test colocato, se il matching viene estratto in helper |
| Integration/E2E (Playwright) | Doppio salvataggio consecutivo senza errori; toast successo; nessun `Duplicate entry` | Estendere e2e cassa esistenti se presenti, altrimenti scenario manuale |
| Statico | Regressioni di tipo/lint | `npm run ts:check`, `npm run lint`, `dotnet build` |
| Sicurezza (manuale) | Produzione: errore GraphQL generico senza stack; avvio fail-fast senza env var; Development: `dotnet run` senza configurazione | Avvio con `ASPNETCORE_ENVIRONMENT=Production` senza/with env var |

## Migration / Rollout

- **Database**: nessuna migrazione. I documenti duplicati pre-esistenti non vengono toccati (il lookup-or-create trova il primo match per chiave UNIQUE, che per definizione è unico).
- **Deploy backend**: PRIMA del deploy in produzione impostare `CONNECTION_STRING` e `JWT_SECRET_KEY` (env var di sistema, unit systemd o `backend/.env` sul server). L'app fa fail-fast all'avvio con messaggio esplicito se mancano. ATTENZIONE: la nuova JWT key invalida i token emessi con la chiave vecchia → gli utenti devono rifare login (refresh token inclusi se firmati/validati con la stessa chiave). Comunicarlo come parte del rilascio.
- **Ordine di rilascio**: backend e frontend possono uscire insieme (stesso deploy); il fix backend è efficace anche con frontend vecchio (il dedup server-side copre il caso `pagamentoId=null`), il sync ID frontend è efficace solo con backend nuovo ma è innocuo con backend vecchio.
- **Rollback**: revert applicativo puro (vedi proposal); i documenti con numero placeholder `SN-...` restano validi anche col codice precedente.
- **Follow-up obbligatorio (fuori scope)**: rotazione password MySQL e della JWT key storica esposte nella history git.

## Open Questions

- [ ] UX placeholder: confermare con l'utente che vedere `DDT SN-20260609-1` nelle righe spesa (al posto del numero vuoto) è accettabile. Alternativa di sola presentazione: il frontend può mostrare "(senza numero)" quando il numero inizia con `SN-`. Non blocca l'implementazione.
- [ ] `CashSummary.tsx` è dead code: confermare in Fase 4 se rimuoverlo invece di mantenerlo corretto.
- [ ] Registri storici con `ContanteAtteso` errato: serve uno script una tantum di ricalcolo? (dichiarato fuori scope nel proposal, decisione utente).
