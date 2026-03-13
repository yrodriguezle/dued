# Proposal: Rinominazione Italiano Gestione Cassa

## Intent

Il codebase backend presenta una nomenclatura mista italiano/inglese nel modulo gestione cassa. I modelli core (RegistroCassa, SpesaCassa, IncassoCassa, ChiusuraMensile) e i servizi sono gia in italiano, ma il layer GraphQL (cartelle, classi, nomi campi) e i modelli Sales/Product sono ancora in inglese. Questa incoerenza rende il codice meno leggibile e non allineato alla convenzione del progetto che prevede naming italiano.

L'obiettivo e standardizzare **tutto** il modulo gestione cassa backend in italiano: classi, metodi, campi GraphQL, modelli, namespace. Le variabili locali/di supporto possono restare in inglese.

## Scope

### In Scope

- Rinominazione cartelle/namespace GraphQL: `CashManagement/`, `Sales/`, `Connection/`, `MonthlyClosures/`, `Settings/`, `Authentication/` verso nomi italiani
- Rinominazione classi GraphQL (Queries, Mutations, Types, InputTypes)
- Rinominazione campi GraphQL esposti (field names nelle query/mutation)
- Rinominazione modelli `Sale` → `Vendita`, `Product` → `Prodotto` e relative proprieta
- Rinominazione metodi C# dei servizi (`CreateSaleAsync` → `CreaVenditaAsync`, ecc.)
- Rinominazione DbSet (`Products` → `Prodotti`, `Sales` → `Vendite`)
- Migrazione database per rinominare tabelle e colonne
- Aggiornamento di tutti i file di test impattati
- Aggiornamento coordinato del frontend (query/mutation GraphQL)

### Out of Scope

- Rinominazione variabili locali e parametri interni ai metodi
- Rinominazione di moduli non appartenenti alla gestione cassa (es. Identity, infrastruttura)
- Refactoring logico o funzionale — solo rinominazione
- Modifiche alla UI/UX del frontend (solo aggiornamento nomi GraphQL nelle query)

## Approach

Approccio in **due fasi** per minimizzare il rischio:

### Fase 1 — Application Layer (no breaking DB changes)
Rinominare tutto il codice C#: cartelle, namespace, classi, metodi, campi GraphQL, proprieta modelli. In questa fase le tabelle/colonne DB restano invariate e si usa il mapping EF Core (`ToTable("vecchio_nome")`, `HasColumnName("vecchio_nome")`) per mantenere la compatibilita col DB esistente.

### Fase 2 — Migrazione Database
Creare una migrazione EF Core che rinomina le tabelle `Products` → `Prodotti`, `Sales` → `Vendite` e le relative colonne. Rimuovere i mapping temporanei della Fase 1.

### Coordinamento Frontend
Il frontend deve essere aggiornato **simultaneamente** alla Fase 1 perche i nomi dei campi GraphQL cambiano. Tutte le query/mutation Apollo Client che usano i vecchi nomi devono essere aggiornate.

## Affected Areas

| Area | Impact | Descrizione |
|------|--------|-------------|
| `backend/GraphQL/CashManagement/` | Rinominato → `GestioneCassa/` | Cartella e namespace |
| `backend/GraphQL/Sales/` | Rinominato → `Vendite/` | Cartella, namespace, classi Query/Mutation/Types |
| `backend/GraphQL/Connection/` | Rinominato → `Connessione/` | Cartella e namespace |
| `backend/GraphQL/MonthlyClosures/` | Rinominato → `ChiusureMensili/` | Cartella e namespace |
| `backend/GraphQL/Settings/` | Rinominato → `Impostazioni/` | Cartella e namespace |
| `backend/GraphQL/Authentication/` | Rinominato → `Autenticazione/` | Cartella e namespace |
| `backend/Models/Sale.cs` | Rinominato → `Vendita.cs` | Classe e proprieta |
| `backend/Models/Product.cs` | Rinominato → `Prodotto.cs` | Classe e proprieta |
| `backend/DataAccess/AppDbContext.cs` | Modificato | DbSet rinominati, mapping temporaneo Fase 1 |
| `backend/Services/` | Modificato | Metodi rinominati |
| `backend/Data/SeedCashDenominations.cs` | Rinominato | Classe → `SeedDenominazioniMoneta` |
| `backend/Migrations/` | Nuovo | Migrazione Fase 2 per rename tabelle/colonne |
| `backend.Tests/` | Modificato | 7+ file test da aggiornare |
| `duedgusto/src/` | Modificato | Query/mutation GraphQL nel frontend |

## Risks

| Rischio | Probabilita | Mitigazione |
|---------|-------------|-------------|
| Breaking change frontend: i nomi GraphQL cambiano e le query Apollo smettono di funzionare | Alta (certa se non coordinato) | Deploy simultaneo frontend+backend; aggiornare tutte le query in un unico batch |
| Errori di compilazione per riferimenti mancati dopo rename massivo (~30+ file) | Media | Usare `dotnet build` dopo ogni sotto-fase; procedere cartella per cartella |
| Migrazione DB fallita o dati persi durante rename tabelle/colonne | Bassa | Usare `RenameTable`/`RenameColumn` di EF Core (non drop+create); backup DB prima della migrazione |
| Cache Apollo Client con vecchi nomi causa errori runtime nel frontend | Media | Invalidare la cache Apollo al deploy; testare manualmente il flusso completo |
| Conflitti merge se altri branch modificano gli stessi file | Media | Eseguire il rename su un branch dedicato, merge rapido |
| Mapping EF Core temporaneo (Fase 1) introduce complessita transitoria | Bassa | Documentare chiaramente; rimuovere nella Fase 2 immediatamente successiva |

## Rollback Plan

### Fase 1 (Application Layer)
- Il branch dedicato permette un semplice `git revert` del merge commit
- Nessuna modifica al database in Fase 1, quindi rollback senza rischi per i dati
- Il frontend deve essere revertato insieme al backend

### Fase 2 (Database Migration)
- Creare un backup completo del database **prima** di applicare la migrazione
- La migrazione usa `RenameTable`/`RenameColumn` che sono reversibili con `dotnet ef migrations revert`
- In caso di emergenza: ripristinare il backup DB + revert del codice a pre-Fase 2

## Dependencies

- Il frontend **deve** essere aggiornato in sincrono con la Fase 1 (stesso deploy)
- La Fase 2 (DB migration) dipende dal completamento e stabilizzazione della Fase 1
- Nessuna dipendenza esterna su librerie o servizi terzi

## Success Criteria

- [ ] `dotnet build` compila senza errori dopo la Fase 1
- [ ] `dotnet build` compila senza errori dopo la Fase 2
- [ ] Tutti i test esistenti passano dopo entrambe le fasi
- [ ] `npm run ts:check` e `npm run lint` passano nel frontend
- [ ] Nessun nome inglese residuo nelle classi/metodi/campi GraphQL del modulo gestione cassa
- [ ] Le variabili locali restano in inglese (non rinominate)
- [ ] Il flusso completo di cassa funziona end-to-end (registrazione vendita, chiusura mensile, gestione spese/incassi)
- [ ] Le tabelle DB sono rinominate in italiano (Fase 2)
- [ ] Nessun mapping EF Core temporaneo residuo dopo la Fase 2
