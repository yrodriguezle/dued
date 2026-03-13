# Tasks: Rinominazione Italiano Gestione Cassa

**Change**: rinominazione-italiano-gestione-cassa
**Date**: 2026-03-13
**Status**: Complete

---

> **Nota sullo scope**: Il design (documento piu recente) limita il rename a **Sales, CashManagement, Connection, ChiusureMensili**. Authentication, Settings e Suppliers restano invariati. Le specs includono anche Authentication/Settings ma il design le esclude esplicitamente. I task seguono il design.

> **Strategia di commit**: Tutta la Fase 1 backend (1A-1G) va eseguita come **un unico commit atomico** perche rinominare i Models rompe la compilazione fino a che tutti i riferimenti non sono aggiornati. L'ordine dei task e una checklist di completezza, non una sequenza di commit separati.

---

## Phase 1A: Models e Seed Data

- [x] 1A.1 **Rinomina `backend/Models/Product.cs` -> `backend/Models/Prodotto.cs`**
  - Classe: `Product` -> `Prodotto`
  - Proprieta: `ProductId` -> `ProdottoId`, `Code` -> `Codice`, `Name` -> `Nome`, `Description` -> `Descrizione`, `Price` -> `Prezzo`, `Category` -> `Categoria`, `UnitOfMeasure` -> `UnitaDiMisura`, `IsActive` -> `Attivo`, `CreatedAt` -> `CreatoIl`, `UpdatedAt` -> `AggiornatoIl`, `Sales` -> `Vendite` (collection nav property)
  - Tipo collection: `ICollection<Sale>` -> `ICollection<Vendita>`
  - **Deps**: Nessuna
  - **Verifica**: Il file compila isolatamente (ignorare errori da altri file)

- [x] 1A.2 **Rinomina `backend/Models/Sale.cs` -> `backend/Models/Vendita.cs`**
  - Classe: `Sale` -> `Vendita`
  - Proprieta: `SaleId` -> `VenditaId`, `ProductId` -> `ProdottoId`, `Quantity` -> `Quantita`, `UnitPrice` -> `PrezzoUnitario`, `TotalPrice` -> `PrezzoTotale`, `Notes` -> `Note`, `Timestamp` -> `DataOra`, `CreatedAt` -> `CreatoIl`, `UpdatedAt` -> `AggiornatoIl`, `Product` -> `Prodotto` (nav property)
  - `RegistroCassaId` e `RegistroCassa` restano invariati (gia italiano)
  - Tipi nav: `Product` -> `Prodotto`
  - **Deps**: 1A.1
  - **Verifica**: Il file compila isolatamente

- [x] 1A.3 **Aggiorna `backend/SeedData/SeedProducts.cs`**
  - Riferimenti: `Product` -> `Prodotto`, `Products` -> `Prodotti` (DbSet)
  - Proprieta usate nel seeding: `Code` -> `Codice`, `Name` -> `Nome`, `Description` -> `Descrizione`, `Price` -> `Prezzo`, `Category` -> `Categoria`, `UnitOfMeasure` -> `UnitaDiMisura`, `IsActive` -> `Attivo`
  - Il nome file puo restare `SeedProducts.cs` o essere rinominato a `SeedProdotti.cs` (opzionale)
  - **Deps**: 1A.1
  - **Verifica**: Riferimenti al nuovo modello Prodotto coerenti

---

## Phase 1B: DbContext — DbSets e Mapping Temporaneo

- [x] 1B.1 **Aggiorna DbSets in `backend/DataAccess/AppDbContext.cs`**
  - `DbSet<Product> Products` -> `DbSet<Prodotto> Prodotti`
  - `DbSet<Sale> Sales` -> `DbSet<Vendita> Vendite`
  - **Deps**: 1A.1, 1A.2
  - **Verifica**: I DbSet usano i nuovi tipi

- [x] 1B.2 **Aggiorna mapping EF Core fluent API per `Prodotto` in `AppDbContext.OnModelCreating()`**
  - Cambiare `modelBuilder.Entity<Product>(entity => ...)` in `modelBuilder.Entity<Prodotto>(entity => ...)`
  - Aggiungere `.ToTable("Products")` (mapping temporaneo alla vecchia tabella)
  - Aggiungere `.HasColumnName("ProductId")` per `ProdottoId`, `.HasColumnName("Code")` per `Codice`, ecc. per TUTTE le proprieta
  - Aggiornare `.HasMany(x => x.Sales)` -> `.HasMany(x => x.Vendite)`
  - Aggiornare riferimenti lambda: `x.ProductId` -> `x.ProdottoId`, `x.Code` -> `x.Codice`, ecc.
  - **Deps**: 1B.1
  - **Verifica**: La configurazione fluent API compila con i nuovi nomi proprieta

- [x] 1B.3 **Aggiorna mapping EF Core fluent API per `Vendita` in `AppDbContext.OnModelCreating()`**
  - Cambiare `modelBuilder.Entity<Sale>(entity => ...)` in `modelBuilder.Entity<Vendita>(entity => ...)`
  - Aggiungere `.ToTable("Sales")` (mapping temporaneo)
  - Aggiungere `.HasColumnName("SaleId")` per `VenditaId`, `.HasColumnName("ProductId")` per `ProdottoId`, `.HasColumnName("Quantity")` per `Quantita`, ecc.
  - Aggiornare `.WithOne(x => x.Product)` -> `.WithOne(x => x.Prodotto)`
  - Aggiornare `.HasForeignKey(x => x.ProductId)` -> `.HasForeignKey(x => x.ProdottoId)`
  - **Deps**: 1B.1
  - **Verifica**: La configurazione fluent API compila con i nuovi nomi proprieta

- [x] 1B.4 **Aggiorna riferimenti a `Sale`/`Product` nei mapping di altre entity in `AppDbContext.OnModelCreating()`**
  - Nella configurazione di `RegistroCassa`: aggiornare `.HasMany<Sale>()` -> `.HasMany<Vendita>()` e riferimenti `Sale.RegistroCassaId`
  - Verificare non ci siano altri riferimenti incrociati a `Product`/`Sale` nei mapping di altre entity
  - **Deps**: 1B.2, 1B.3
  - **Verifica**: `OnModelCreating` non contiene piu riferimenti a `Product`/`Sale`

---

## Phase 1C: GraphQL Sales -> Vendite (cartella + file)

- [x] 1C.1 **Rinomina cartella `backend/GraphQL/Sales/` -> `backend/GraphQL/Vendite/`**
  - Comando: `git mv backend/GraphQL/Sales backend/GraphQL/Vendite`
  - **Deps**: Nessuna (operazione filesystem)
  - **Verifica**: La cartella `Vendite/` esiste con tutti i file originali

- [x] 1C.2 **Rinomina e aggiorna `Vendite/Types/ProductType.cs` -> `Vendite/Types/ProdottoType.cs`**
  - File: `backend/GraphQL/Vendite/Types/ProdottoType.cs`
  - Classe: `ProductType` -> `ProdottoType`
  - Namespace: `duedgusto.GraphQL.Sales.Types` -> `duedgusto.GraphQL.Vendite.Types`
  - Field names GraphQL: `productId` -> `prodottoId`, `code` -> `codice`, `name` -> `nome`, `description` -> `descrizione`, `price` -> `prezzo`, `category` -> `categoria`, `unitOfMeasure` -> `unitaMisura`, `isActive` -> `attivo`, `createdAt` -> `creatoIl`, `updatedAt` -> `aggiornatoIl`
  - Tipo modello nel generic: `ObjectGraphType<Product>` -> `ObjectGraphType<Prodotto>`
  - **Deps**: 1C.1, 1A.1
  - **Verifica**: La classe compila con il nuovo modello

- [x] 1C.3 **Rinomina e aggiorna `Vendite/Types/SaleType.cs` -> `Vendite/Types/VenditaType.cs`**
  - File: `backend/GraphQL/Vendite/Types/VenditaType.cs`
  - Classe: `SaleType` -> `VenditaType`
  - Namespace: `duedgusto.GraphQL.Sales.Types` -> `duedgusto.GraphQL.Vendite.Types`
  - Field names GraphQL: `saleId` -> `venditaId`, `productId` -> `prodottoId`, `quantity` -> `quantita`, `unitPrice` -> `prezzoUnitario`, `totalPrice` -> `prezzoTotale`, `notes` -> `note`, `timestamp` -> `dataOra`, `createdAt` -> `creatoIl`, `updatedAt` -> `aggiornatoIl`, `product` -> `prodotto`
  - Field `product` resolve type: `ProductType` -> `ProdottoType`
  - Tipo modello: `ObjectGraphType<Sale>` -> `ObjectGraphType<Vendita>`
  - **Deps**: 1C.1, 1A.2, 1C.2
  - **Verifica**: La classe compila con il nuovo modello e tipo ProdottoType

- [x] 1C.4 **Rinomina e aggiorna `Vendite/Types/CreateSaleInputType.cs` -> `Vendite/Types/CreaVenditaInputType.cs`**
  - File: `backend/GraphQL/Vendite/Types/CreaVenditaInputType.cs`
  - Classe: `CreateSaleInputType` -> `CreaVenditaInputType` (e input class `CreateSaleInput` -> `CreaVenditaInput`)
  - Namespace: `duedgusto.GraphQL.Sales.Types` -> `duedgusto.GraphQL.Vendite.Types`
  - Field names: `registerId` -> `registroCassaId`, `productId` -> `prodottoId`, `quantity` -> `quantita`, `notes` -> `note`, `timestamp` -> `dataOra`
  - **Deps**: 1C.1
  - **Verifica**: La classe compila

- [x] 1C.5 **Rinomina e aggiorna `Vendite/Types/UpdateSaleInputType.cs` -> `Vendite/Types/AggiornaVenditaInputType.cs`**
  - File: `backend/GraphQL/Vendite/Types/AggiornaVenditaInputType.cs`
  - Classe: `UpdateSaleInputType` -> `AggiornaVenditaInputType` (e input class `UpdateSaleInput` -> `AggiornaVenditaInput`)
  - Namespace: `duedgusto.GraphQL.Sales.Types` -> `duedgusto.GraphQL.Vendite.Types`
  - Field names: `productId` -> `prodottoId`, `quantity` -> `quantita`, `notes` -> `note`
  - **Deps**: 1C.1
  - **Verifica**: La classe compila

- [x] 1C.6 **Rinomina e aggiorna `Vendite/SalesQueries.cs` -> `Vendite/VenditeQueries.cs`**
  - File: `backend/GraphQL/Vendite/VenditeQueries.cs`
  - Classe: `SalesQueries` -> `VenditeQueries`
  - Namespace: `duedgusto.GraphQL.Sales` -> `duedgusto.GraphQL.Vendite`
  - Using: `duedgusto.GraphQL.Sales.Types` -> `duedgusto.GraphQL.Vendite.Types`
  - Field names GraphQL: `products` -> `prodotti`, `product` -> `prodotto`, `sales` -> `vendite`, `sale` -> `vendita`, `productCategories` -> `categorieProdotto`
  - Argument names: `search` -> `ricerca`, `category` -> `categoria`, `limit` -> `limite`, `offset` -> `scostamento`, `registerId` -> `registroCassaId`, `dateFrom` -> `dataDa`, `dateTo` -> `dataA`
  - Riferimenti DbSet: `dbContext.Products` -> `dbContext.Prodotti`, `dbContext.Sales` -> `dbContext.Vendite`
  - Riferimenti tipo: `ProductType` -> `ProdottoType`, `SaleType` -> `VenditaType`
  - Riferimenti modello: `Product` -> `Prodotto`, `Sale` -> `Vendita`, proprieta rinominate
  - Le variabili locali restano in inglese
  - **Deps**: 1C.2, 1C.3, 1B.1
  - **Verifica**: La classe compila con nuovi tipi e DbSet

- [x] 1C.7 **Rinomina e aggiorna `Vendite/SalesMutations.cs` -> `Vendite/VenditeMutations.cs`**
  - File: `backend/GraphQL/Vendite/VenditeMutations.cs`
  - Classe: `SalesMutations` -> `VenditeMutations`
  - Namespace: `duedgusto.GraphQL.Sales` -> `duedgusto.GraphQL.Vendite`
  - Using: `duedgusto.GraphQL.Sales.Types` -> `duedgusto.GraphQL.Vendite.Types`
  - Field names GraphQL: `createSale` -> `creaVendita`, `updateSale` -> `aggiornaVendita`, `deleteSale` -> `eliminaVendita`
  - Riferimenti tipo input: `CreateSaleInputType` -> `CreaVenditaInputType`, `UpdateSaleInputType` -> `AggiornaVenditaInputType`, `CreateSaleInput` -> `CreaVenditaInput`, `UpdateSaleInput` -> `AggiornaVenditaInput`
  - Riferimenti DbSet: `dbContext.Products` -> `dbContext.Prodotti`, `dbContext.Sales` -> `dbContext.Vendite`
  - Riferimenti modello: `Sale` -> `Vendita`, `Product` -> `Prodotto`, proprieta rinominate (es. `sale.TotalPrice` -> `vendita.PrezzoTotale`)
  - Le variabili locali restano in inglese (ma i nomi delle variabili che rappresentano entity dovrebbero aggiornarsi se usano il vecchio nome tipo, es. `var sale` puo restare `var sale` essendo locale)
  - **Deps**: 1C.4, 1C.5, 1C.3, 1B.1
  - **Verifica**: La classe compila con nuovi tipi input e DbSet

---

## Phase 1D: GraphQL CashManagement -> GestioneCassa (cartella + file)

- [x] 1D.1 **Rinomina cartella `backend/GraphQL/CashManagement/` -> `backend/GraphQL/GestioneCassa/`**
  - Comando: `git mv backend/GraphQL/CashManagement backend/GraphQL/GestioneCassa`
  - **Deps**: Nessuna (operazione filesystem)
  - **Verifica**: La cartella `GestioneCassa/` esiste con `Types/` e tutti i file

- [x] 1D.2 **Aggiorna `GestioneCassa/CashManagementQueries.cs` -> `GestioneCassa/GestioneCassaQueries.cs`**
  - Classe: `CashManagementQueries` -> `GestioneCassaQueries`
  - Namespace: `duedgusto.GraphQL.CashManagement` -> `duedgusto.GraphQL.GestioneCassa`
  - Using: `duedgusto.GraphQL.CashManagement.Types` -> `duedgusto.GraphQL.GestioneCassa.Types`
  - I field names interni (`denominazioni`, `registroCassa`, `dashboardKPIs`, `monthlySummary`) restano invariati (gia in italiano)
  - Aggiornare eventuali riferimenti a `SaleType`/`ProductType` se presenti
  - **Deps**: 1D.1
  - **Verifica**: La classe compila con nuovo namespace

- [x] 1D.3 **Aggiorna `GestioneCassa/CashManagementMutations.cs` -> `GestioneCassa/GestioneCassaMutations.cs`**
  - Classe: `CashManagementMutations` -> `GestioneCassaMutations`
  - Namespace: `duedgusto.GraphQL.CashManagement` -> `duedgusto.GraphQL.GestioneCassa`
  - Using: `duedgusto.GraphQL.CashManagement.Types` -> `duedgusto.GraphQL.GestioneCassa.Types`
  - Aggiornare riferimenti a `Sale`/`Product` se presenti nei resolver (es. calcolo totale vendite)
  - DbSet: `dbContext.Sales` -> `dbContext.Vendite`, `dbContext.Products` -> `dbContext.Prodotti` (se usati)
  - **Deps**: 1D.1, 1A.1, 1A.2
  - **Verifica**: La classe compila

- [x] 1D.4 **Aggiorna namespace in tutti i file `GestioneCassa/Types/*.cs` (6 file)**
  - File interessati:
    - `backend/GraphQL/GestioneCassa/Types/ConteggioMonetaType.cs`
    - `backend/GraphQL/GestioneCassa/Types/DenominazioneMonetaType.cs`
    - `backend/GraphQL/GestioneCassa/Types/IncassoCassaType.cs`
    - `backend/GraphQL/GestioneCassa/Types/RegistroCassaInputType.cs`
    - `backend/GraphQL/GestioneCassa/Types/RegistroCassaType.cs`
    - `backend/GraphQL/GestioneCassa/Types/SpesaCassaType.cs`
  - Per ognuno: cambiare `namespace duedgusto.GraphQL.CashManagement.Types` -> `namespace duedgusto.GraphQL.GestioneCassa.Types`
  - `RegistroCassaType.cs` usa `using duedgusto.GraphQL.Authentication;` -> invariato (Auth fuori scope)
  - `RegistroCassaType.cs` potrebbe riferire a `SaleType` -> aggiornare a `VenditaType` e using `duedgusto.GraphQL.Vendite.Types`
  - `RegistroCassaInputType.cs` potrebbe riferire a tipi Sale -> aggiornare
  - I nomi delle classi restano invariati (gia in italiano)
  - **Deps**: 1D.1, 1C.3 (se RegistroCassaType usa VenditaType)
  - **Verifica**: Tutti i 6 file compilano con nuovo namespace

---

## Phase 1E: GraphQL Connection -> Connessione

- [x] 1E.1 **Rinomina cartella `backend/GraphQL/Connection/` -> `backend/GraphQL/Connessione/`**
  - Comando: `git mv backend/GraphQL/Connection backend/GraphQL/Connessione`
  - **Deps**: Nessuna (operazione filesystem)
  - **Verifica**: La cartella `Connessione/` esiste

- [x] 1E.2 **Aggiorna `Connessione/ConnectionQueries.cs` -> `Connessione/ConnessioneQueries.cs`**
  - Classe: `ConnectionQueries` -> `ConnessioneQueries`
  - Namespace: `duedgusto.GraphQL.Connection` -> `duedgusto.GraphQL.Connessione`
  - Using da aggiornare:
    - `duedgusto.GraphQL.CashManagement.Types` -> `duedgusto.GraphQL.GestioneCassa.Types`
    - `duedgusto.GraphQL.MonthlyClosures.Types` -> `duedgusto.GraphQL.ChiusureMensili.Types` (vedi 1F)
    - `duedgusto.GraphQL.Authentication` -> invariato (fuori scope)
  - I field names interni (`registriCassa`, `utenti`, `menus`, `ruoli`, ecc.) restano invariati (gia in italiano)
  - Riferimenti a tipi: `SaleType` -> `VenditaType`, `ProductType` -> `ProdottoType` se usati
  - **Deps**: 1E.1, 1D.4, 1F.3/1F.4 (per namespace MonthlyClosures.Types)
  - **Verifica**: La classe compila

---

## Phase 1F: GraphQL ChiusureMensili — Fix classi inglesi

- [x] 1F.1 **Rinomina `backend/GraphQL/ChiusureMensili/MonthlyClosuresMutations.cs` -> `ChiusureMensiliMutations.cs`**
  - Classe: `MonthlyClosuresMutations` -> `ChiusureMensiliMutations`
  - Namespace: `duedgusto.GraphQL.MonthlyClosures` -> `duedgusto.GraphQL.ChiusureMensili`
  - Aggiornare riferimenti interni a `Sale`/`Product` se presenti
  - **Deps**: Nessuna
  - **Verifica**: La classe compila con il nuovo namespace

- [x] 1F.2 **Aggiorna namespace in `backend/GraphQL/ChiusureMensili/MonthlyClosuresQueries.cs` (se necessario)**
  - Verificare se il namespace e gia `duedgusto.GraphQL.ChiusureMensili` (dal design risulta gia corretto)
  - Se la classe si chiama `MonthlyClosuresQueries` -> rinominarla in `ChiusureMensiliQueries`
  - File rename: `MonthlyClosuresQueries.cs` -> `ChiusureMensiliQueries.cs`
  - **Deps**: Nessuna
  - **Verifica**: Namespace e nome classe coerenti

- [x] 1F.3 **Rinomina `backend/GraphQL/ChiusureMensili/Types/MonthlyExpenseType.cs` -> `SpesaMensileType.cs`**
  - Classe: `MonthlyExpenseType` -> `SpesaMensileType`
  - Namespace: `duedgusto.GraphQL.MonthlyClosures.Types` -> `duedgusto.GraphQL.ChiusureMensili.Types`
  - **Deps**: Nessuna
  - **Verifica**: La classe compila con il nuovo namespace

- [x] 1F.4 **Rinomina `backend/GraphQL/ChiusureMensili/Types/MonthlyExpenseInputType.cs` -> `SpesaMensileInputType.cs`**
  - Classe: `MonthlyExpenseInputType` -> `SpesaMensileInputType`
  - Namespace: `duedgusto.GraphQL.MonthlyClosures.Types` -> `duedgusto.GraphQL.ChiusureMensili.Types`
  - **Deps**: Nessuna
  - **Verifica**: La classe compila con il nuovo namespace

- [x] 1F.5 **Aggiorna namespace nei file Types gia italiani di ChiusureMensili (se necessario)**
  - Verificare i seguenti file per namespace `MonthlyClosures.Types` vs `ChiusureMensili.Types`:
    - `backend/GraphQL/ChiusureMensili/Types/ChiusuraMensileType.cs`
    - `backend/GraphQL/ChiusureMensili/Types/ChiusuraMensileInputType.cs`
    - `backend/GraphQL/ChiusureMensili/Types/GiornoEsclusoInputType.cs`
    - `backend/GraphQL/ChiusureMensili/Types/PagamentoMensileFornitoriType.cs`
    - `backend/GraphQL/ChiusureMensili/Types/RegistroCassaMensileType.cs`
    - `backend/GraphQL/ChiusureMensili/Types/SpesaMensileTyperaInputType.cs`
    - `backend/GraphQL/ChiusureMensili/Types/SpesaMensileTyperaType.cs`
  - Se usano `duedgusto.GraphQL.MonthlyClosures.Types` correggerli a `duedgusto.GraphQL.ChiusureMensili.Types`
  - Se riferiscono a `CashManagement.Types`, aggiornare a `GestioneCassa.Types`
  - **Deps**: 1F.3, 1F.4
  - **Verifica**: Tutti i file nella cartella ChiusureMensili/Types compilano con namespace coerente

---

## Phase 1G: Root Schema e Program.cs

- [x] 1G.1 **Aggiorna `backend/GraphQL/GraphQLQueries.cs`**
  - Aggiornare using:
    - `duedgusto.GraphQL.Connection` -> `duedgusto.GraphQL.Connessione`
    - `duedgusto.GraphQL.CashManagement` -> `duedgusto.GraphQL.GestioneCassa`
    - Aggiungere `duedgusto.GraphQL.Vendite`
    - `duedgusto.GraphQL.Authentication` -> invariato (fuori scope)
    - `duedgusto.GraphQL.Settings` -> invariato (fuori scope)
  - Aggiornare field registrations:
    - `Field<CashManagementQueries>("cashManagement")` -> `Field<GestioneCassaQueries>("gestioneCassa")`
    - `Field<ConnectionQueries>("connection")` -> `Field<ConnessioneQueries>("connessione")`
    - Aggiungere `Field<VenditeQueries>("vendite")` se non esiste un root field per Sales queries
    - `chiusureMensili` -> verificare se usa `MonthlyClosuresQueries` o `ChiusureMensiliQueries` e aggiornare il tipo
  - **Deps**: 1C.6, 1D.2, 1E.2, 1F.2
  - **Verifica**: Il file compila con tutti i nuovi tipi importati

- [x] 1G.2 **Aggiorna `backend/GraphQL/GraphQLMutations.cs`**
  - Aggiornare using:
    - `duedgusto.GraphQL.CashManagement` -> `duedgusto.GraphQL.GestioneCassa`
    - `duedgusto.GraphQL.MonthlyClosures` -> `duedgusto.GraphQL.ChiusureMensili`
    - Aggiungere `duedgusto.GraphQL.Vendite`
    - `duedgusto.GraphQL.Authentication` -> invariato
    - `duedgusto.GraphQL.Settings` -> invariato
  - Aggiornare field registrations:
    - `Field<CashManagementMutations>("cashManagement")` -> `Field<GestioneCassaMutations>("gestioneCassa")`
    - `Field<MonthlyClosuresMutations>("monthlyClosures")` -> `Field<ChiusureMensiliMutations>("chiusureMensili")`
    - Aggiungere `Field<VenditeMutations>("vendite")` se non esiste un root field per Sales mutations
  - **Deps**: 1C.7, 1D.3, 1F.1
  - **Verifica**: Il file compila con tutti i nuovi tipi importati

- [x] 1G.3 **Verificare `backend/GraphQL/GraphQLSchema.cs`**
  - Il file usa solo `GraphQLQueries` e `GraphQLMutations` (gia verificato — non registra tipi esplicitamente)
  - Nessuna modifica necessaria
  - **Deps**: 1G.1, 1G.2
  - **Verifica**: Nessuna modifica richiesta

- [x] 1G.4 **Verificare `backend/Program.cs`**
  - Usa `using duedgusto.GraphQL.Authentication;` -> invariato (fuori scope)
  - Verificare se registra tipi GraphQL esplicitamente nel DI container
  - Se registra `SalesQueries`, `SalesMutations`, ecc. -> aggiornare a `VenditeQueries`, `VenditeMutations`
  - **Deps**: 1G.1, 1G.2
  - **Verifica**: `dotnet build` compila

---

## Phase 1H: Services (se impattati)

- [x] 1H.1 **Verificare e aggiornare `backend/Services/ChiusureMensili/ChiusuraMensileService.cs`**
  - Cercare riferimenti a `Sale`, `Product`, `Sales`, `Products` (da grep risulta che NON contiene riferimenti diretti)
  - Se presenti: aggiornare a `Vendita`, `Prodotto`, `Vendite`, `Prodotti`
  - **Deps**: 1A.1, 1A.2, 1B.1
  - **Verifica**: Il servizio compila

- [x] 1H.2 **Verificare `backend/Services/GraphQL/GraphQLService.cs` (se esiste)**
  - Cercare riferimenti a vecchi namespace/tipi
  - **Deps**: 1C, 1D
  - **Verifica**: Nessun riferimento ai vecchi nomi

---

## Phase 1I: Build Verification Backend

- [x] 1I.1 **Eseguire `dotnet build` nella cartella backend**
  - Correggere tutti gli errori di compilazione residui
  - Cercare sistematicamente con grep: `\bProduct\b`, `\bSale\b`, `CashManagement`, `ConnectionQueries`, `SalesQueries`, `SalesMutations`, `MonthlyClosures` nei file `.cs` (escluse Migrations/)
  - **Deps**: Tutti i task 1A-1H
  - **Verifica**: `dotnet build` termina con 0 errori e 0 warning (relativi ai rename)

---

## Phase 2: Frontend — Aggiornamento Query/Mutation GraphQL

- [x] 2.1 **Aggiorna `duedgusto/src/graphql/cashRegister/queries.tsx`** (cashManagement->gestioneCassa fatto; connection resta invariato per convenzione Relay)
  - `cashManagement` -> `gestioneCassa` in TUTTE le query gql template string (almeno 4 occorrenze)
  - `connection {` -> `connessione {` nelle query che usano paginazione Relay (almeno 1 occorrenza)
  - Aggiornare i tipi TypeScript di risposta: `cashManagement:` -> `gestioneCassa:` negli oggetti tipo
  - **Deps**: Nessuna (puo procedere in parallelo al backend se i nomi sono concordati)
  - **Verifica**: `npm run ts:check`

- [x] 2.2 **Aggiorna `duedgusto/src/graphql/cashRegister/mutations.tsx`**
  - `cashManagement` -> `gestioneCassa` in TUTTE le mutation gql template string (almeno 3 occorrenze)
  - Aggiornare i tipi TypeScript di risposta: `cashManagement:` -> `gestioneCassa:`
  - **Deps**: Nessuna
  - **Verifica**: `npm run ts:check`

- [x] 2.3 **Aggiorna `duedgusto/src/graphql/cashRegister/useQueryCashRegister.tsx`**
  - `data?.cashManagement?.registroCassa` -> `data?.gestioneCassa?.registroCassa`
  - **Deps**: 2.1
  - **Verifica**: `npm run ts:check`

- [x] 2.4 **Aggiorna `duedgusto/src/graphql/cashRegister/useQueryDenominations.tsx`**
  - `data?.cashManagement?.denominazioni` -> `data?.gestioneCassa?.denominazioni`
  - **Deps**: 2.1
  - **Verifica**: `npm run ts:check`

- [x] 2.5 **Aggiorna `duedgusto/src/graphql/cashRegister/useQueryDashboardKPIs.tsx`**
  - `data?.cashManagement?.dashboardKPIs` -> `data?.gestioneCassa?.dashboardKPIs`
  - **Deps**: 2.1
  - **Verifica**: `npm run ts:check`

- [x] 2.6 **Aggiorna `duedgusto/src/graphql/cashRegister/useSubmitCashRegister.tsx`**
  - `result.data?.cashManagement?.mutateRegistroCassa` -> `result.data?.gestioneCassa?.mutateRegistroCassa`
  - **Deps**: 2.2
  - **Verifica**: `npm run ts:check`

- [x] 2.7 **Aggiorna `duedgusto/src/graphql/cashRegister/useCloseCashRegister.tsx`**
  - `result.data?.cashManagement?.chiudiRegistroCassa` -> `result.data?.gestioneCassa?.chiudiRegistroCassa`
  - **Deps**: 2.2
  - **Verifica**: `npm run ts:check`

- [x] 2.8 **N/A** — `connection` non viene rinominato (pattern infrastrutturale Relay, vedi memory note)

- [x] 2.9 **N/A** — `connection` non viene rinominato (pattern infrastrutturale Relay)

- [x] 2.10 **Aggiorna `duedgusto/src/graphql/chiusureMensili/mutations.tsx`**
  - `monthlyClosures` -> `chiusureMensili` in TUTTE le mutation gql template string (almeno 9 occorrenze)
  - Aggiornare i tipi TypeScript: `monthlyClosures:` -> `chiusureMensili:`
  - **Deps**: Nessuna
  - **Verifica**: `npm run ts:check`

- [x] 2.11 **N/A** — `connection` non viene rinominato (pattern infrastrutturale Relay)

- [x] 2.12 **N/A** — `connection` non viene rinominato (pattern infrastrutturale Relay)

- [x] 2.13 **N/A** — `connection` non viene rinominato (pattern infrastrutturale Relay)

- [x] 2.14 **N/A** — `connection` non viene rinominato (pattern infrastrutturale Relay)

- [x] 2.15 **N/A** — `connection` non viene rinominato (pattern infrastrutturale Relay)

- [x] 2.16 **Aggiorna `duedgusto/src/graphql/configureClient.tsx`**
  - `cashManagement:` nella configurazione InMemoryCache typePolicies -> `gestioneCassa:`
  - Commento: `// Merge function for cashManagement field` -> aggiornare
  - `chiusureMensili:` -> gia corretto (invariato)
  - **Deps**: Nessuna
  - **Verifica**: `npm run ts:check`

- [x] 2.17 **Aggiorna `duedgusto/src/components/pages/registrazioneCassa/RegistroCassaDetails.tsx`**
  - `data?.cashManagement?.registroCassa` -> `data?.gestioneCassa?.registroCassa`
  - **Deps**: 2.1
  - **Verifica**: `npm run ts:check`

- [x] 2.18 **Aggiorna `duedgusto/src/components/pages/registrazioneCassa/MonthlyView.tsx`**
  - `data?.cashManagement?.monthlySummary` -> `data?.gestioneCassa?.monthlySummary`
  - **Deps**: 2.1
  - **Verifica**: `npm run ts:check`

- [x] 2.19 **Aggiorna `duedgusto/src/test/helpers/apolloTestWrapper.tsx`**
  - `chiusureMensili:` -> verificare, probabilmente gia corretto
  - Se contiene `cashManagement` o `connection` -> aggiornare
  - **Deps**: Nessuna
  - **Verifica**: `npm run ts:check`

---

## Phase 3: Frontend — Test Aggiornamento

- [x] 3.1 **Aggiorna `duedgusto/src/graphql/cashRegister/__tests__/useSubmitCashRegister.test.tsx`**
  - `cashManagement:` -> `gestioneCassa:` in tutti i mock data (almeno 3 occorrenze)
  - **Deps**: 2.6
  - **Verifica**: Test passa

- [x] 3.2 **Aggiorna `duedgusto/src/graphql/cashRegister/__tests__/useCloseCashRegister.test.tsx`**
  - `cashManagement:` -> `gestioneCassa:` in tutti i mock data (almeno 2 occorrenze)
  - **Deps**: 2.7
  - **Verifica**: Test passa

- [x] 3.3 **Aggiorna `duedgusto/src/graphql/cashRegister/__tests__/useQueryDashboardKPIs.test.tsx`**
  - `cashManagement:` -> `gestioneCassa:` in tutti i mock data (almeno 2 occorrenze)
  - **Deps**: 2.5
  - **Verifica**: Test passa

- [x] 3.4 **Aggiorna `duedgusto/src/graphql/cashRegister/__tests__/useQueryCashRegister.test.tsx`**
  - `cashManagement:` -> `gestioneCassa:` in tutti i mock data (almeno 2 occorrenze)
  - **Deps**: 2.3
  - **Verifica**: Test passa

- [x] 3.5 **N/A** — `connection` non viene rinominato (pattern infrastrutturale Relay)

- [x] 3.6 **N/A** — `connection` non viene rinominato (pattern infrastrutturale Relay)

- [x] 3.7 **Aggiorna `duedgusto/src/graphql/__tests__/configureClient.test.tsx`**
  - Commento/descrizione: `cashManagement` -> `gestioneCassa`
  - Mock/assertion su typePolicies -> aggiornare se testano le chiavi
  - **Deps**: 2.16
  - **Verifica**: Test passa

---

## Phase 4: Backend Tests

- [x] 4.1 **Aggiorna `backend/DuedGusto.Tests/Integration/GraphQL/SalesTests.cs`**
  - Riferimenti modello: `Product` -> `Prodotto`, `Sale` -> `Vendita`
  - Proprieta: `ProductId` -> `ProdottoId`, `Name` -> `Nome`, `Code` -> `Codice`, `Price` -> `Prezzo`, `Category` -> `Categoria`, `UnitOfMeasure` -> `UnitaDiMisura`, `IsActive` -> `Attivo`, `SaleId` -> `VenditaId`, `Quantity` -> `Quantita`, `UnitPrice` -> `PrezzoUnitario`, `TotalPrice` -> `PrezzoTotale`, ecc.
  - DbSet: `.Sales` -> `.Vendite`, `.Products` -> `.Prodotti`
  - Include: `.Include(s => s.Product)` -> `.Include(s => s.Prodotto)`
  - Assert: `persistedSale.Product.Name` -> `persistedSale.Prodotto.Nome`
  - Rinominare file opzionale: `SalesTests.cs` -> `VenditeTests.cs`
  - **Deps**: 1A.1, 1A.2, 1B.1
  - **Verifica**: `dotnet test` passa

- [x] 4.2 **Aggiorna `backend/DuedGusto.Tests/Integration/GraphQL/CashManagementQueriesTests.cs`**
  - Classe: `CashManagementQueriesTests` -> `GestioneCassaQueriesTests` (opzionale ma consigliato)
  - Verificare riferimenti a `Products`/`Sales` DbSet -> aggiornare a `Prodotti`/`Vendite`
  - Verificare using `duedgusto.GraphQL.CashManagement` -> `duedgusto.GraphQL.GestioneCassa`
  - Rinominare file opzionale
  - **Deps**: 1D, 1B.1
  - **Verifica**: `dotnet test` passa

- [x] 4.3 **Aggiorna `backend/DuedGusto.Tests/Integration/GraphQL/CashManagementMutationsTests.cs`**
  - Come 4.2: aggiornare riferimenti a modelli e DbSet rinominati
  - Verificare `Sale`/`Product` -> `Vendita`/`Prodotto`
  - **Deps**: 1D, 1A, 1B.1
  - **Verifica**: `dotnet test` passa

- [x] 4.4 **Aggiorna `backend/DuedGusto.Tests/Integration/GraphQL/MonthlyClosuresQueriesTests.cs`**
  - Classe: `MonthlyClosuresQueriesTests` -> opzionale rename
  - Verificare riferimenti a `MonthlyClosuresQueries` -> `ChiusureMensiliQueries`
  - Verificare namespace `MonthlyClosures` -> `ChiusureMensili`
  - **Deps**: 1F
  - **Verifica**: `dotnet test` passa

- [x] 4.5 **Verificare `backend/DuedGusto.Tests/Unit/Services/ChiusuraMensileServiceTests.cs`**
  - Verificare se usa `Sale`/`Product` -> aggiornare
  - **Deps**: 1H.1
  - **Verifica**: `dotnet test` passa

- [x] 4.6 **Verificare `backend/DuedGusto.Tests/Helpers/TestDbContextFactory.cs`**
  - Attualmente NON contiene riferimenti diretti a `Product`/`Sale` (verificato)
  - Ma se `EnsureCreated()` dipende dal modello -> funziona automaticamente
  - **Deps**: 1B
  - **Verifica**: Nessuna modifica necessaria

- [x] 4.7 **Eseguire `dotnet test` completo**
  - Tutti i test devono passare
  - **Deps**: 4.1-4.6
  - **Verifica**: `dotnet test` termina con 0 fallimenti

---

## Phase 5: Frontend Build Verification

- [x] 5.1 **Eseguire `npm run ts:check` nella cartella duedgusto**
  - Correggere tutti gli errori TypeScript residui
  - Cercare sistematicamente: `cashManagement`, `connection[`, `.connection.`, `monthlyClosures` nei file `.tsx`
  - **Deps**: Phase 2 + Phase 3
  - **Verifica**: 0 errori TypeScript

- [x] 5.2 (errori lint pre-esistenti, nessuno legato alla rinominazione) **Eseguire `npm run lint` nella cartella duedgusto**
  - Correggere eventuali errori di lint
  - **Deps**: 5.1
  - **Verifica**: 0 errori lint

---

## Phase 6: Migrazione Database (Fase 2 — separata)

> Questa fase va eseguita DOPO che la Fase 1 e stata deployata e stabilizzata.

- [x] 6.1 **Creare migrazione EF Core per rinominare tabelle e colonne**
  - Comando: `cd backend && dotnet ef migrations add RinominaTabelleItaliano`
  - Verificare il file generato: DEVE usare `RenameTable`/`RenameColumn`, NON `DropTable`/`CreateTable`
  - Se genera drop+create, scrivere la migrazione manualmente con:
    - `migrationBuilder.RenameTable("Products", newName: "Prodotti")`
    - `migrationBuilder.RenameColumn("Products", "ProductId", "ProdottoId")` ecc.
    - `migrationBuilder.RenameTable("Sales", newName: "Vendite")`
    - `migrationBuilder.RenameColumn("Sales", "SaleId", "VenditaId")` ecc.
  - **Deps**: Phase 1I (build backend OK)
  - **Verifica**: Il file di migrazione contiene solo Rename operations

- [x] 6.2 **Rimuovere mapping temporaneo da `backend/DataAccess/AppDbContext.cs`**
  - Rimuovere `.ToTable("Products")` -> EF Core usera il nome classe `Prodotti` (DbSet)
  - Rimuovere tutti i `.HasColumnName("vecchio_nome")` -> EF Core usera i nomi proprieta italiani
  - Rimuovere `.ToTable("Sales")` e relativi `.HasColumnName()`
  - **Deps**: 6.1
  - **Verifica**: `dotnet build` compila

- [x] 6.3 **Eseguire `dotnet build` e `dotnet test`**
  - **Deps**: 6.2
  - **Verifica**: 0 errori build, 0 test falliti

- [x] 6.4 **Testare migrazione su database di sviluppo**
  - Backup del database di sviluppo
  - Applicare migrazione (avviene automaticamente all'avvio con `MigrateAsync()`)
  - Verificare che le tabelle `Prodotti` e `Vendite` esistano con le colonne rinominate
  - Verificare rollback: `dotnet ef database update <migrazione-precedente>`
  - **Deps**: 6.3
  - **Verifica**: Le tabelle sono rinominate, i dati sono intatti, il rollback funziona

---

## Riepilogo File Impattati

### Backend — File da rinominare (git mv)

| # | Da | A |
|---|-----|-----|
| 1 | `backend/Models/Product.cs` | `backend/Models/Prodotto.cs` |
| 2 | `backend/Models/Sale.cs` | `backend/Models/Vendita.cs` |
| 3 | `backend/GraphQL/Sales/` (dir) | `backend/GraphQL/Vendite/` |
| 4 | `backend/GraphQL/Vendite/SalesQueries.cs` | `backend/GraphQL/Vendite/VenditeQueries.cs` |
| 5 | `backend/GraphQL/Vendite/SalesMutations.cs` | `backend/GraphQL/Vendite/VenditeMutations.cs` |
| 6 | `backend/GraphQL/Vendite/Types/ProductType.cs` | `backend/GraphQL/Vendite/Types/ProdottoType.cs` |
| 7 | `backend/GraphQL/Vendite/Types/SaleType.cs` | `backend/GraphQL/Vendite/Types/VenditaType.cs` |
| 8 | `backend/GraphQL/Vendite/Types/CreateSaleInputType.cs` | `backend/GraphQL/Vendite/Types/CreaVenditaInputType.cs` |
| 9 | `backend/GraphQL/Vendite/Types/UpdateSaleInputType.cs` | `backend/GraphQL/Vendite/Types/AggiornaVenditaInputType.cs` |
| 10 | `backend/GraphQL/CashManagement/` (dir) | `backend/GraphQL/GestioneCassa/` |
| 11 | `backend/GraphQL/GestioneCassa/CashManagementQueries.cs` | `backend/GraphQL/GestioneCassa/GestioneCassaQueries.cs` |
| 12 | `backend/GraphQL/GestioneCassa/CashManagementMutations.cs` | `backend/GraphQL/GestioneCassa/GestioneCassaMutations.cs` |
| 13 | `backend/GraphQL/Connection/` (dir) | `backend/GraphQL/Connessione/` |
| 14 | `backend/GraphQL/Connessione/ConnectionQueries.cs` | `backend/GraphQL/Connessione/ConnessioneQueries.cs` |
| 15 | `backend/GraphQL/ChiusureMensili/MonthlyClosuresMutations.cs` | `backend/GraphQL/ChiusureMensili/ChiusureMensiliMutations.cs` |
| 16 | `backend/GraphQL/ChiusureMensili/MonthlyClosuresQueries.cs` | `backend/GraphQL/ChiusureMensili/ChiusureMensiliQueries.cs` |
| 17 | `backend/GraphQL/ChiusureMensili/Types/MonthlyExpenseType.cs` | `backend/GraphQL/ChiusureMensili/Types/SpesaMensileType.cs` |
| 18 | `backend/GraphQL/ChiusureMensili/Types/MonthlyExpenseInputType.cs` | `backend/GraphQL/ChiusureMensili/Types/SpesaMensileInputType.cs` |

### Backend — File da modificare (contenuto)

| # | File | Motivo |
|---|------|--------|
| 19 | `backend/DataAccess/AppDbContext.cs` | DbSet rename + mapping temporaneo fluent API |
| 20 | `backend/SeedData/SeedProducts.cs` | Riferimenti Product -> Prodotto |
| 21 | `backend/GraphQL/GraphQLQueries.cs` | Using + field registrations |
| 22 | `backend/GraphQL/GraphQLMutations.cs` | Using + field registrations |
| 23 | `backend/GraphQL/GestioneCassa/Types/*.cs` (6 file) | Namespace CashManagement -> GestioneCassa |
| 24 | `backend/GraphQL/ChiusureMensili/Types/*.cs` (7 file) | Namespace MonthlyClosures -> ChiusureMensili (se necessario) |
| 25 | `backend/Services/ChiusureMensili/ChiusuraMensileService.cs` | Verificare riferimenti (probabilmente invariato) |

### Backend Tests — File da modificare

| # | File | Motivo |
|---|------|--------|
| 26 | `backend/DuedGusto.Tests/Integration/GraphQL/SalesTests.cs` | Product/Sale -> Prodotto/Vendita |
| 27 | `backend/DuedGusto.Tests/Integration/GraphQL/CashManagementQueriesTests.cs` | Namespace + eventuali ref modelli |
| 28 | `backend/DuedGusto.Tests/Integration/GraphQL/CashManagementMutationsTests.cs` | Namespace + eventuali ref modelli |
| 29 | `backend/DuedGusto.Tests/Integration/GraphQL/MonthlyClosuresQueriesTests.cs` | Classe/namespace rename |
| 30 | `backend/DuedGusto.Tests/Unit/Services/ChiusuraMensileServiceTests.cs` | Verificare ref |

### Frontend — File da modificare

| # | File | Motivo |
|---|------|--------|
| 31 | `duedgusto/src/graphql/cashRegister/queries.tsx` | cashManagement -> gestioneCassa, connection -> connessione |
| 32 | `duedgusto/src/graphql/cashRegister/mutations.tsx` | cashManagement -> gestioneCassa |
| 33 | `duedgusto/src/graphql/cashRegister/useQueryCashRegister.tsx` | .cashManagement. -> .gestioneCassa. |
| 34 | `duedgusto/src/graphql/cashRegister/useQueryDenominations.tsx` | .cashManagement. -> .gestioneCassa. |
| 35 | `duedgusto/src/graphql/cashRegister/useQueryDashboardKPIs.tsx` | .cashManagement. -> .gestioneCassa. |
| 36 | `duedgusto/src/graphql/cashRegister/useSubmitCashRegister.tsx` | .cashManagement. -> .gestioneCassa. |
| 37 | `duedgusto/src/graphql/cashRegister/useCloseCashRegister.tsx` | .cashManagement. -> .gestioneCassa. |
| 38 | `duedgusto/src/graphql/cashRegister/useQueryYearlySummary.tsx` | .connection. -> .connessione. |
| 39 | `duedgusto/src/graphql/cashRegister/useQueryCashRegistersByMonth.tsx` | .connection. -> .connessione. |
| 40 | `duedgusto/src/graphql/chiusureMensili/mutations.tsx` | monthlyClosures -> chiusureMensili |
| 41 | `duedgusto/src/graphql/suppliers/queries.tsx` | connection -> connessione |
| 42 | `duedgusto/src/graphql/common/useQueryParams.tsx` | connection -> connessione |
| 43 | `duedgusto/src/graphql/common/useFetchData.tsx` | .connection. -> .connessione. |
| 44 | `duedgusto/src/graphql/common/useGetAll.tsx` | .connection. -> .connessione. |
| 45 | `duedgusto/src/graphql/common/getQueryName.tsx` | connection -> connessione (commenti/logica) |
| 46 | `duedgusto/src/graphql/configureClient.tsx` | cashManagement -> gestioneCassa |
| 47 | `duedgusto/src/components/pages/registrazioneCassa/RegistroCassaDetails.tsx` | .cashManagement. -> .gestioneCassa. |
| 48 | `duedgusto/src/components/pages/registrazioneCassa/MonthlyView.tsx` | .cashManagement. -> .gestioneCassa. |
| 49 | `duedgusto/src/test/helpers/apolloTestWrapper.tsx` | Verificare ref |

### Frontend Tests — File da modificare

| # | File | Motivo |
|---|------|--------|
| 50 | `duedgusto/src/graphql/cashRegister/__tests__/useSubmitCashRegister.test.tsx` | cashManagement -> gestioneCassa |
| 51 | `duedgusto/src/graphql/cashRegister/__tests__/useCloseCashRegister.test.tsx` | cashManagement -> gestioneCassa |
| 52 | `duedgusto/src/graphql/cashRegister/__tests__/useQueryDashboardKPIs.test.tsx` | cashManagement -> gestioneCassa |
| 53 | `duedgusto/src/graphql/cashRegister/__tests__/useQueryCashRegister.test.tsx` | cashManagement -> gestioneCassa |
| 54 | `duedgusto/src/graphql/common/__tests__/getQueryName.test.tsx` | connection -> connessione |
| 55 | `duedgusto/src/graphql/common/__tests__/useFetchData.test.tsx` | connection -> connessione |
| 56 | `duedgusto/src/graphql/__tests__/configureClient.test.tsx` | cashManagement -> gestioneCassa |

**Totale file impattati: ~56 file** (18 rename + 7 modify backend + 5 tests backend + 19 modify frontend + 7 tests frontend)
