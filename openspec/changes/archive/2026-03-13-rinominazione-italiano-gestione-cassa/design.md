# Design: Rinominazione Italiano Gestione Cassa

## Technical Approach

Rinominazione progressiva in due fasi del modulo gestione cassa da nomenclatura mista inglese/italiano a italiano completo. La Fase 1 opera esclusivamente sull'application layer (C# + GraphQL + frontend) mantenendo compatibilita DB tramite fluent API EF Core. La Fase 2 esegue una migrazione DB per allineare tabelle e colonne ai nuovi nomi italiani.

L'approccio segue un ordine bottom-up: Models → DbContext mapping → Services → GraphQL Types → GraphQL Queries/Mutations → Root Schema → Frontend.

## Architecture Decisions

### Decision: Fluent API per mapping DB temporaneo (Fase 1)

**Choice**: Usare la fluent API gia esistente in `OnModelCreating()` per mantenere i vecchi nomi tabella/colonna durante la Fase 1.
**Alternatives considered**: (a) Attributi `[Table]`/`[Column]` sulle classi model; (b) Rinominare DB e codice insieme.
**Rationale**: Il progetto usa GIA la fluent API per tutte le configurazioni EF Core (vedi `AppDbContext.cs` linee 57-923). Aggiungere attributi creerebbe un approccio misto incoerente. Rinominare DB e codice insieme aumenta il rischio di downtime. Con la fluent API, il mapping `.ToTable("Products")` e `.HasColumnName("ProductId")` resta nella stessa posizione dove sono gia configurate le entity — zero overhead concettuale.

### Decision: Rinominazione fisica delle cartelle (non solo namespace)

**Choice**: Rinominare fisicamente le cartelle (`Sales/` → `Vendite/`, `CashManagement/` → `GestioneCassa/`, ecc.) oltre ai namespace.
**Alternatives considered**: Cambiare solo i namespace lasciando le cartelle invariate.
**Rationale**: In .NET la convenzione standard allinea cartelle e namespace. Il progetto segue gia questa convenzione (es. `GraphQL/CashManagement/` → `namespace duedgusto.GraphQL.CashManagement`). Lasciare cartelle disallineate creerebbe confusione.

### Decision: Ordine bottom-up (Models → GraphQL → Frontend)

**Choice**: Rinominare partendo dai Models, poi DbContext, poi Services, poi GraphQL Types, poi Queries/Mutations, infine root schema e frontend.
**Alternatives considered**: (a) Top-down (schema → types → models); (b) Per-modulo completo (tutto Sales, poi tutto CashManagement).
**Rationale**: Bottom-up minimizza gli errori di compilazione intermedi. Rinominando i Models prima, ogni layer successivo puo riferirsi ai nuovi nomi. Con top-down, i resolver non compilerebbero finche i models non vengono rinominati. L'approccio per-modulo e valido ma crea piu passaggi di compilazione parziale.

### Decision: Deploy simultaneo frontend + backend per Fase 1

**Choice**: Il frontend e il backend devono essere deployati nello stesso momento.
**Alternatives considered**: (a) Periodo di transizione con alias GraphQL (vecchi + nuovi nomi); (b) Feature flag.
**Rationale**: Il progetto non ha infrastruttura per alias GraphQL ne feature flags. I campi GraphQL esposti cambiano nome (es. `cashManagement` → `gestioneCassa`, `createSale` → `creaVendita`), quindi il frontend smetterebbe di funzionare immediatamente. Dato che e un progetto single-team con deploy manuale, il deploy simultaneo e la soluzione piu semplice e a basso rischio.

### Decision: Non rinominare Suppliers/Authentication/Settings in questa fase

**Choice**: Limitare il rename a Sales, CashManagement, Connection e i nomi di classe in ChiusureMensili. NON rinominare Suppliers, Authentication e Settings.
**Alternatives considered**: Rinominare tutto in un colpo solo.
**Rationale**: La proposal definisce lo scope come "modulo gestione cassa". Suppliers (Fornitori), Authentication e Settings hanno gia un naming parzialmente misto ma sono moduli separati. Includerli aumenterebbe la complessita senza beneficio immediato. Nota: la cartella `ChiusureMensili/` ha gia il nome italiano ma contiene classi con nome inglese (`MonthlyClosuresMutations`, `MonthlyClosuresQueries`, `MonthlyExpenseType`, `MonthlyExpenseInputType`) — queste VANNO rinominate. La cartella `Connection/` va rinominata in `Connessione/` perche contiene le query paginate Relay usate dal modulo cassa.

## Data Flow

Il flusso dati non cambia funzionalmente. Cambiano solo i nomi attraverso i layer:

```
Frontend (Apollo Client)
  │
  │  gql query: gestioneCassa { registroCassa(...) }     ← era: cashManagement
  │  gql query: vendite { prodotti(...) }                 ← era: sales.products (nota 1)
  │  gql mutation: gestioneCassa { mutateRegistroCassa }  ← invariato
  │  gql mutation: vendite { creaVendita }                ← era: sales.createSale
  │
  ▼
GraphQL Root (GraphQLQueries.cs / GraphQLMutations.cs)
  │
  │  Field<VenditeQueries>("vendite")                     ← era: SalesQueries, no root rename needed (nota 2)
  │  Field<GestioneCassaQueries>("gestioneCassa")         ← era: CashManagementQueries
  │
  ▼
GraphQL Module (Queries/Mutations/Types)
  │
  │  VenditeQueries → field "prodotti" → dbContext.Prodotti  ← era: SalesQueries → "products"
  │  VenditeMutations → field "creaVendita"                  ← era: SalesMutations → "createSale"
  │
  ▼
Services / DbContext
  │
  │  AppDbContext.Prodotti → .ToTable("Products")         ← Fase 1: mapping temporaneo
  │  AppDbContext.Vendite  → .ToTable("Sales")            ← Fase 1: mapping temporaneo
  │
  ▼
Database MySQL
  │
  │  Tabella "Products" / "Sales"                         ← Fase 1: invariata
  │  Tabella "Prodotti" / "Vendite"                       ← Fase 2: rinominata
```

**Nota 1**: Attualmente il root field per Sales non esiste in `GraphQLQueries.cs` — le SalesQueries sono registrate solo nel root mutations via `SalesMutations`. Le queries Sales (`products`, `sales`, `productCategories`) sono iniettate direttamente nel `SalesQueries` che viene istanziato come sub-field. Il field root per Sales va aggiunto come `vendite`.

**Nota 2**: I field root in `GraphQLQueries.cs` attualmente sono: `authentication`, `connection`, `cashManagement`, `settings`, `suppliers`, `chiusureMensili`. Il campo `cashManagement` diventa `gestioneCassa`. Il campo `connection` diventa `connessione`. Il campo `chiusureMensili` resta invariato (gia italiano). Manca un field root per Sales queries — va aggiunto come `vendite`.

## File Changes

### Fase 1A — Models e DbContext

| File | Action | Description |
|------|--------|-------------|
| `backend/Models/Product.cs` | Rename → `Prodotto.cs` | Classe `Product` → `Prodotto`, proprieta: `ProductId` → `ProdottoId`, `Code` → `Codice`, `Name` → `Nome`, `Description` → `Descrizione`, `Price` → `Prezzo`, `Category` → `Categoria`, `UnitOfMeasure` → `UnitaDiMisura`, `IsActive` → `Attivo`, `CreatedAt` → `CreatoIl`, `UpdatedAt` → `AggiornatoIl`, `Sales` → `Vendite` |
| `backend/Models/Sale.cs` | Rename → `Vendita.cs` | Classe `Sale` → `Vendita`, proprieta: `SaleId` → `VenditaId`, `ProductId` → `ProdottoId`, `Quantity` → `Quantita`, `UnitPrice` → `PrezzoUnitario`, `TotalPrice` → `PrezzoTotale`, `Notes` → `Note`, `Timestamp` → `DataOra`, `CreatedAt` → `CreatoIl`, `UpdatedAt` → `AggiornatoIl`, `Product` → `Prodotto` |
| `backend/DataAccess/AppDbContext.cs` | Modify | DbSet: `Products` → `Prodotti`, `Sales` → `Vendite`. Aggiungere mapping temporaneo: `.ToTable("Products")`, `.HasColumnName("ProductId")` ecc. per mantenere compatibilita DB |

### Fase 1B — Services

| File | Action | Description |
|------|--------|-------------|
| `backend/Services/ChiusureMensili/ChiusuraMensileService.cs` | Modify | Aggiornare riferimenti a `Sale` → `Vendita`, `Product` → `Prodotto` se presenti |

### Fase 1C — GraphQL Types (Sales → Vendite)

| File | Action | Description |
|------|--------|-------------|
| `backend/GraphQL/Sales/` | Rename dir → `Vendite/` | Cartella rinominata |
| `backend/GraphQL/Sales/Types/ProductType.cs` | Rename → `Vendite/Types/ProdottoType.cs` | Classe `ProductType` → `ProdottoType`, namespace `duedgusto.GraphQL.Vendite.Types`, field names in italiano |
| `backend/GraphQL/Sales/Types/SaleType.cs` | Rename → `Vendite/Types/VenditaType.cs` | Classe `SaleType` → `VenditaType`, field "product" → "prodotto" |
| `backend/GraphQL/Sales/Types/CreateSaleInputType.cs` | Rename → `Vendite/Types/CreaVenditaInputType.cs` | Classe e field rinominati in italiano |
| `backend/GraphQL/Sales/Types/UpdateSaleInputType.cs` | Rename → `Vendite/Types/AggiornaVenditaInputType.cs` | Classe e field rinominati in italiano |
| `backend/GraphQL/Sales/SalesQueries.cs` | Rename → `Vendite/VenditeQueries.cs` | Classe `SalesQueries` → `VenditeQueries`, field: `products` → `prodotti`, `product` → `prodotto`, `sales` → `vendite`, `sale` → `vendita`, `productCategories` → `categorieProdotto` |
| `backend/GraphQL/Sales/SalesMutations.cs` | Rename → `Vendite/VenditeMutations.cs` | Classe `SalesMutations` → `VenditeMutations`, field: `createSale` → `creaVendita`, `updateSale` → `aggiornaVendita`, `deleteSale` → `eliminaVendita`. Metodi: `CreateSaleAsync` → `CreaVenditaAsync`, ecc. |

### Fase 1D — GraphQL Types (CashManagement → GestioneCassa)

| File | Action | Description |
|------|--------|-------------|
| `backend/GraphQL/CashManagement/` | Rename dir → `GestioneCassa/` | Cartella rinominata |
| `backend/GraphQL/CashManagement/CashManagementQueries.cs` | Rename → `GestioneCassa/GestioneCassaQueries.cs` | Classe rinominata, namespace aggiornato |
| `backend/GraphQL/CashManagement/CashManagementMutations.cs` | Rename → `GestioneCassa/GestioneCassaMutations.cs` | Classe rinominata, namespace aggiornato |
| `backend/GraphQL/CashManagement/Types/*.cs` (6 file) | Move → `GestioneCassa/Types/*.cs` | Namespace aggiornato a `duedgusto.GraphQL.GestioneCassa.Types`, nomi classi invariati (sono gia in italiano: `RegistroCassaType`, `SpesaCassaType`, ecc.) |

### Fase 1E — GraphQL (Connection → Connessione)

| File | Action | Description |
|------|--------|-------------|
| `backend/GraphQL/Connection/` | Rename dir → `Connessione/` | Cartella rinominata |
| `backend/GraphQL/Connection/ConnectionQueries.cs` | Rename → `Connessione/ConnessioneQueries.cs` | Classe `ConnectionQueries` → `ConnessioneQueries`, namespace aggiornato |

### Fase 1F — GraphQL (ChiusureMensili — fix classi inglesi)

| File | Action | Description |
|------|--------|-------------|
| `backend/GraphQL/ChiusureMensili/MonthlyClosuresMutations.cs` | Rename → `ChiusureMensiliMutations.cs` | Classe `MonthlyClosuresMutations` → `ChiusureMensiliMutations`, namespace: `duedgusto.GraphQL.MonthlyClosures` → `duedgusto.GraphQL.ChiusureMensili` |
| `backend/GraphQL/ChiusureMensili/MonthlyClosuresQueries.cs` | Rename → `ChiusureMensiliQueries.cs` | Classe `MonthlyClosuresQueries` → `ChiusureMensiliQueries`, namespace unificato |
| `backend/GraphQL/ChiusureMensili/Types/MonthlyExpenseType.cs` | Rename → `SpesaMensileType.cs` | Classe e namespace rinominati, fix namespace `MonthlyClosures.Types` → `ChiusureMensili.Types` |
| `backend/GraphQL/ChiusureMensili/Types/MonthlyExpenseInputType.cs` | Rename → `SpesaMensileInputType.cs` | Classe e namespace rinominati |

### Fase 1G — Root Schema e Program.cs

| File | Action | Description |
|------|--------|-------------|
| `backend/GraphQL/GraphQLQueries.cs` | Modify | Import nuovi namespace, field: `cashManagement` → `gestioneCassa`, `connection` → `connessione`, aggiungere `vendite`, aggiornare tipi classe |
| `backend/GraphQL/GraphQLMutations.cs` | Modify | Import nuovi namespace, aggiungere `vendite`, `monthlyClosures` → `chiusureMensili`, aggiornare tipi classe |
| `backend/GraphQL/GraphQLSchema.cs` | Modify | Se registra tipi esplicitamente, aggiornare i nomi |

### Fase 1H — SeedData

| File | Action | Description |
|------|--------|-------------|
| `backend/SeedData/SeedProducts.cs` | Modify | Riferimenti `Product` → `Prodotto`, `Products` → `Prodotti`, proprieta rinominate |
| `backend/SeedData/SeedCashDenominations.cs` | Verify | Probabilmente invariato (usa gia modelli italiani), verificare |

### Fase 1I — Frontend

| File | Action | Description |
|------|--------|-------------|
| `duedgusto/src/graphql/cashRegister/queries.tsx` | Modify | `cashManagement` → `gestioneCassa` nei template gql, `connection` → `connessione` |
| `duedgusto/src/graphql/cashRegister/mutations.tsx` | Modify | `cashManagement` → `gestioneCassa` nei template gql |
| `duedgusto/src/graphql/cashRegister/fragments.tsx` | Modify | Aggiornare field names se cambiano nei types GraphQL (verificare) |
| `duedgusto/src/graphql/cashRegister/useQueryCashRegister.tsx` | Verify | Potrebbe riferire a field name vecchi |
| `duedgusto/src/graphql/cashRegister/useQueryDenominations.tsx` | Verify | Aggiornare se usa `cashManagement` |
| `duedgusto/src/graphql/cashRegister/useQueryDashboardKPIs.tsx` | Verify | Aggiornare se usa `cashManagement` |
| `duedgusto/src/graphql/cashRegister/useSubmitCashRegister.tsx` | Verify | Aggiornare se usa `cashManagement` |
| `duedgusto/src/graphql/cashRegister/useCloseCashRegister.tsx` | Verify | Aggiornare se usa `cashManagement` |
| `duedgusto/src/components/pages/registrazioneCassa/RegistroCassaDetails.tsx` | Verify | Potrebbe accedere a result data con path `cashManagement` |
| `duedgusto/src/components/pages/registrazioneCassa/MonthlyView.tsx` | Verify | Potrebbe accedere a dati con vecchi nomi |
| `duedgusto/src/@types/*.d.ts` | Verify | Interfacce TypeScript che modellano i tipi GraphQL |
| Test frontend (`__tests__/*.test.tsx`) | Modify | 5+ file test da aggiornare con nuovi nomi field |

### Fase 1J — Backend Tests

| File | Action | Description |
|------|--------|-------------|
| `backend.Tests/Helpers/TestDbContextFactory.cs` | Modify | Se riferisce a `Products`/`Sales` DbSet |
| `backend.Tests/Services/` | Verify | I test attuali coprono solo JWT e Password, probabilmente non impattati |

### Fase 2 — Database Migration

| File | Action | Description |
|------|--------|-------------|
| `backend/Migrations/XXXXXXXX_RinominaTabelleItaliano.cs` | Create | Migrazione EF Core con `RenameTable` e `RenameColumn` |
| `backend/DataAccess/AppDbContext.cs` | Modify | Rimuovere mapping temporanei `.ToTable("Products")` ecc., aggiornare `.ToTable("Prodotti")` |

## Interfaces / Contracts

### Modello Prodotto (nuovo)

```csharp
namespace duedgusto.Models;

public class Prodotto
{
    public int ProdottoId { get; set; }
    public string Codice { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string? Descrizione { get; set; }
    public decimal Prezzo { get; set; }
    public string? Categoria { get; set; }
    public string? UnitaDiMisura { get; set; } = "pz";
    public bool Attivo { get; set; } = true;
    public DateTime CreatoIl { get; set; } = DateTime.UtcNow;
    public DateTime AggiornatoIl { get; set; } = DateTime.UtcNow;
    public ICollection<Vendita> Vendite { get; set; } = new List<Vendita>();
}
```

### Modello Vendita (nuovo)

```csharp
namespace duedgusto.Models;

public class Vendita
{
    public int VenditaId { get; set; }
    public int RegistroCassaId { get; set; }
    public int ProdottoId { get; set; }
    public decimal Quantita { get; set; }
    public decimal PrezzoUnitario { get; set; }
    public decimal PrezzoTotale { get; set; }
    public string? Note { get; set; }
    public DateTime DataOra { get; set; } = DateTime.UtcNow;
    public DateTime CreatoIl { get; set; } = DateTime.UtcNow;
    public DateTime AggiornatoIl { get; set; } = DateTime.UtcNow;
    public RegistroCassa RegistroCassa { get; set; } = null!;
    public Prodotto Prodotto { get; set; } = null!;
}
```

### DbContext mapping temporaneo Fase 1 (esempio)

```csharp
// Product → Prodotto (mantieni tabella DB "Products")
modelBuilder.Entity<Prodotto>(entity =>
{
    entity.ToTable("Products")  // ← mapping temporaneo Fase 1
        .HasCharSet("utf8mb4")
        .UseCollation("utf8mb4_unicode_ci")
        .HasKey(x => x.ProdottoId);

    entity.Property(x => x.ProdottoId)
        .HasColumnName("ProductId")  // ← mapping temporaneo
        .ValueGeneratedOnAdd();

    entity.Property(x => x.Codice).HasColumnName("Code").HasMaxLength(50).IsRequired();
    entity.Property(x => x.Nome).HasColumnName("Name").HasMaxLength(255).IsRequired();
    entity.Property(x => x.Descrizione).HasColumnName("Description").HasColumnType("text");
    entity.Property(x => x.Prezzo).HasColumnName("Price").HasColumnType("decimal(10,2)").IsRequired();
    entity.Property(x => x.Categoria).HasColumnName("Category").HasMaxLength(100);
    entity.Property(x => x.UnitaDiMisura).HasColumnName("UnitOfMeasure").HasMaxLength(20).HasDefaultValue("pz");
    entity.Property(x => x.Attivo).HasColumnName("IsActive").HasDefaultValue(true);
    entity.Property(x => x.CreatoIl).HasColumnName("CreatedAt").HasColumnType("datetime").HasDefaultValueSql("CURRENT_TIMESTAMP");
    entity.Property(x => x.AggiornatoIl).HasColumnName("UpdatedAt").HasColumnType("datetime").HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

    entity.HasMany(x => x.Vendite).WithOne(x => x.Prodotto).HasForeignKey(x => x.ProdottoId).OnDelete(DeleteBehavior.Restrict);
    entity.HasIndex(x => x.Codice).IsUnique();
});
```

### GraphQL Root Queries (nuovo)

```csharp
public class GraphQLQueries : ObjectGraphType
{
    public GraphQLQueries()
    {
        Field<AuthQueries>("authentication").Resolve(context => new { });
        Field<ConnessioneQueries>("connessione").Resolve(context => new { });
        Field<GestioneCassaQueries>("gestioneCassa").Resolve(context => new { });
        Field<VenditeQueries>("vendite").Resolve(context => new { });
        Field<SettingsQueries>("settings").Resolve(context => new { });
        Field<SuppliersQueries>("suppliers").Resolve(context => new { });
        Field<ChiusureMensiliQueries>("chiusureMensili").Resolve(context => new { });
    }
}
```

### Frontend GraphQL query (esempio cambiamento)

```typescript
// Prima
cashManagement { denominazioni { ... } }
// Dopo
gestioneCassa { denominazioni { ... } }

// Prima (non esisteva root field)
// Dopo
vendite { prodotti { ... } }
vendite { creaVendita(input: ...) { ... } }
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Build | Compilazione backend senza errori | `dotnet build` dopo ogni sotto-fase (1A, 1B, 1C, ecc.) |
| Build | Compilazione frontend senza errori | `npm run ts:check` e `npm run lint` dopo Fase 1I |
| Backend Tests | Test esistenti passano | `dotnet test` nel progetto `backend.Tests` — attualmente coprono Auth, JWT, Password (probabilmente non impattati dal rename, ma verificare `TestDbContextFactory`) |
| Frontend Tests | Test esistenti passano | Eseguire suite test frontend se presente |
| Integration | Flusso completo registrazione cassa | Test manuale end-to-end: creare registro, aggiungere vendite, chiudere cassa |
| Integration | Query paginate Relay | Verificare che `connessione { registriCassa(...) }` funzioni |
| Integration | Dashboard KPIs | Verificare che `gestioneCassa { dashboardKPIs }` restituisca dati |
| Migration | Fase 2 rollback | Testare `dotnet ef database update <previous-migration>` su DB di test prima di applicare in produzione |

## Migration / Rollout

### Fase 1 — Application Layer (no DB changes)

1. Creare branch `feature/rinominazione-italiano-gestione-cassa`
2. Eseguire sotto-fasi 1A → 1J in ordine, con `dotnet build` dopo ogni sotto-fase
3. Eseguire `dotnet test` alla fine
4. Eseguire `npm run ts:check && npm run lint` nel frontend
5. Test manuale end-to-end
6. Deploy simultaneo backend + frontend
7. Verificare in produzione

### Fase 2 — Database Migration

1. Backup completo del database MySQL prima di iniziare
2. Creare migrazione: `dotnet ef migrations add RinominaTabelleItaliano`
3. Verificare il file di migrazione generato — deve usare `RenameTable` e `RenameColumn`, NON `DropTable`/`CreateTable`
4. Se EF Core genera drop+create invece di rename, scrivere la migrazione manualmente
5. Testare su database di staging/sviluppo
6. Rimuovere i mapping temporanei `HasColumnName("vecchio_nome")` da `AppDbContext.cs`
7. `dotnet build` + `dotnet test`
8. Deploy
9. Applicare migrazione (avviene automaticamente all'avvio grazie a `MigrateAsync()`)

### Rollback Plan

**Fase 1**: `git revert` del merge commit. Nessuna modifica DB, rollback pulito. Il frontend deve essere revertato insieme.

**Fase 2**:
- Opzione A: `dotnet ef database update <migrazione-precedente>` (usa il metodo `Down()` della migrazione)
- Opzione B: Ripristino backup DB + revert codice a post-Fase-1
- CRITICO: Creare backup DB PRIMA di applicare la Fase 2

## Git Branching Strategy

```
main
 └── feature/rinominazione-italiano-gestione-cassa
      ├── commit 1: Fase 1A — Models (Prodotto, Vendita)
      ├── commit 2: Fase 1A — DbContext mapping temporaneo
      ├── commit 3: Fase 1B — Services update
      ├── commit 4: Fase 1C — GraphQL Vendite (dir + files)
      ├── commit 5: Fase 1D — GraphQL GestioneCassa (dir + files)
      ├── commit 6: Fase 1E — GraphQL Connessione (dir + files)
      ├── commit 7: Fase 1F — GraphQL ChiusureMensili fix classi inglesi
      ├── commit 8: Fase 1G — Root schema + SeedData
      ├── commit 9: Fase 1H — Frontend queries/mutations update
      ├── commit 10: Fase 1I — Frontend tests update
      ├── commit 11: Fase 1J — Backend tests update
      └── commit 12: Fase 2 — DB migration + rimozione mapping temporanei
```

Ogni commit deve compilare (`dotnet build` / `npm run ts:check`). Se un commit non compila, aggregare con il precedente.

## Batch Grouping (ordine di esecuzione)

### Batch 1: Models + DbContext (MUST compile)
- Rinomina `Product.cs` → `Prodotto.cs`, `Sale.cs` → `Vendita.cs`
- Aggiorna `AppDbContext.cs`: DbSet rinominati + mapping temporaneo colonne
- `dotnet build` — deve compilare (gli altri file avranno errori ma il core e coerente)

**ATTENZIONE**: Questo batch ROMPERA la compilazione perche tutti i file che usano `Product`/`Sale` falliranno. E necessario procedere rapidamente ai batch successivi o fare tutti i rename in un unico commit.

**Strategia alternativa consigliata**: Fare un mega-commit atomico per tutta la Fase 1 backend (batch 1-6) usando find-and-replace sistematico. L'ordine descritto serve come checklist per verificare completezza, non come sequenza di commit separati.

### Batch 2: GraphQL Types Vendite
- Rinomina directory `Sales/` → `Vendite/`
- Rinomina e modifica tutti i file in `Vendite/` e `Vendite/Types/`

### Batch 3: GraphQL CashManagement + Connection
- Rinomina directory `CashManagement/` → `GestioneCassa/`
- Rinomina directory `Connection/` → `Connessione/`
- Aggiorna classi e namespace

### Batch 4: GraphQL ChiusureMensili fix
- Rinomina classi `Monthly*` → `ChiusureMensili*` / `SpesaMensile*`
- Unifica namespace

### Batch 5: Root Schema + Services + SeedData
- Aggiorna `GraphQLQueries.cs`, `GraphQLMutations.cs`
- Aggiorna Services se necessario
- Aggiorna SeedData

### Batch 6: `dotnet build` → fix residui

### Batch 7: Frontend
- Aggiorna tutti i file in `duedgusto/src/graphql/cashRegister/`
- Aggiorna test frontend
- `npm run ts:check && npm run lint`

### Batch 8: Backend Tests
- Aggiorna `backend.Tests/`
- `dotnet test`

### Batch 9: Fase 2 (separato, dopo stabilizzazione Fase 1)
- Crea migrazione DB
- Rimuovi mapping temporanei

## Analisi Namespace Inconsistenti Esistenti

Il codebase presenta gia inconsistenze di namespace nella cartella `ChiusureMensili/`:

| File | Namespace attuale | Namespace corretto |
|------|------------------|-------------------|
| `MonthlyClosuresMutations.cs` | `duedgusto.GraphQL.MonthlyClosures` | `duedgusto.GraphQL.ChiusureMensili` |
| `MonthlyClosuresQueries.cs` | `duedgusto.GraphQL.ChiusureMensili` | OK |
| `MonthlyExpenseType.cs` | `duedgusto.GraphQL.MonthlyClosures.Types` | `duedgusto.GraphQL.ChiusureMensili.Types` |
| `MonthlyExpenseInputType.cs` | `duedgusto.GraphQL.MonthlyClosures.Types` | `duedgusto.GraphQL.ChiusureMensili.Types` |

Questi vanno corretti nella Fase 1F.

Inoltre, `GraphQLMutations.cs` importa `duedgusto.GraphQL.MonthlyClosures` (riga 7) che e inconsistente con la cartella fisica `ChiusureMensili/`. Questo va unificato.

## Open Questions

- [ ] Il `GraphQLSchema.cs` registra tipi esplicitamente o li scopre automaticamente? Se li registra esplicitamente, vanno aggiornati i nomi. (Da verificare durante l'implementazione)
- [ ] Esistono query GraphQL nel frontend per Sales (prodotti/vendite) oltre al test `getQueryName.test.tsx`? La ricerca ha trovato solo un riferimento in un test. Se non ci sono pagine frontend che usano le Sales queries, il frontend non necessita di aggiornamento per quella parte.
- [ ] La Fase 2 (migrazione DB) deve essere nello stesso branch o in un branch separato? Consiglio: stesso branch ma commit separato, per permettere un deploy in due step se necessario.
