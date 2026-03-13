# Specifications: Rinominazione Italiano Gestione Cassa

**Change**: rinominazione-italiano-gestione-cassa
**Date**: 2026-03-13
**Status**: Draft

---

## 1. Purpose

Standardizzare la nomenclatura del modulo gestione cassa in italiano, eliminando l'incoerenza tra i layer gia italiani (modelli core, servizi) e quelli ancora in inglese (GraphQL folders/classi, modelli Sale/Product, DbSets). L'intervento e suddiviso in due fasi: Fase 1 (application layer) e Fase 2 (migrazione database).

---

## 2. Affected Domains

| Domain | Impact |
|--------|--------|
| GraphQL (cartelle, namespace, classi, campi) | Rinominazione completa |
| Models (Sale, Product) | Rinominazione classe e proprieta |
| DataAccess (DbSets, mapping EF Core) | Rinominazione DbSet + mapping temporaneo Fase 1 |
| SeedData | Rinominazione classi |
| Frontend (query/mutation Apollo) | Aggiornamento nomi campi GraphQL |
| Database (tabelle, colonne) | Migrazione Fase 2 |

---

## 3. Complete Rename Mapping Tables

### 3.1 Cartelle e Namespace GraphQL

| Attuale | Nuovo | Tipo |
|---------|-------|------|
| `GraphQL/CashManagement/` | `GraphQL/GestioneCassa/` | Cartella + namespace |
| `GraphQL/Sales/` | `GraphQL/Vendite/` | Cartella + namespace |
| `GraphQL/Connection/` | `GraphQL/Connessione/` | Cartella + namespace |
| `GraphQL/Settings/` | `GraphQL/Impostazioni/` | Cartella + namespace |
| `GraphQL/Authentication/` | `GraphQL/Autenticazione/` | Cartella + namespace |
| `GraphQL/MonthlyClosures/` (namespace in ChiusureMensili/) | `GraphQL/ChiusureMensili/` | Solo namespace (cartella gia corretta) |
| `GraphQL/Suppliers/` | Fuori scope (non gestione cassa) | Nessuna modifica |

### 3.2 Classi GraphQL

| Attuale | Nuovo |
|---------|-------|
| `CashManagementQueries` | `GestioneCassaQueries` |
| `CashManagementMutations` | `GestioneCassaMutations` |
| `SalesQueries` | `VenditeQueries` |
| `SalesMutations` | `VenditeMutations` |
| `ConnectionQueries` | `ConnessioneQueries` |
| `SettingsQueries` | `ImpostazioniQueries` |
| `SettingsMutations` | `ImpostazioniMutations` |
| `AuthQueries` | `AutenticazioneQueries` |
| `AuthMutations` | `AutenticazioneMutations` |
| `SaleType` | `VenditaType` |
| `ProductType` | `ProdottoType` |
| `CreateSaleInputType` | `CreaVenditaInputType` |
| `CreateSaleInput` | `CreaVenditaInput` |
| `UpdateSaleInputType` | `AggiornaVenditaInputType` |
| `UpdateSaleInput` | `AggiornaVenditaInput` |
| `BusinessSettingsType` | `ImpostazioniAttivitaType` |
| `BusinessSettingsInputType` | `ImpostazioniAttivitaInputType` |
| `BusinessSettingsInput` | `ImpostazioniAttivitaInput` |
| `GraphQLUserContext` | `ContestoUtenteGraphQL` |
| `TokenResponseType` | `RispostaTokenType` |
| `TokenResponse` | `RispostaToken` |
| `MonthlyClosuresMutations` | `ChiusureMensiliMutations` |
| `MonthlyExpenseType` | `SpesaMensileType` (se non gia rinominato) |
| `MonthlyExpenseInputType` | `SpesaMensileInputType` (se non gia rinominato) |

### 3.3 Campi GraphQL (Schema Esposto)

#### Root Query Fields

| Attuale | Nuovo |
|---------|-------|
| `cashManagement { ... }` | `gestioneCassa { ... }` |
| `connection { ... }` | `connessione { ... }` |
| `settings { ... }` | `impostazioni { ... }` |
| `authentication { ... }` | `autenticazione { ... }` |

#### Root Mutation Fields

| Attuale | Nuovo |
|---------|-------|
| `cashManagement { ... }` | `gestioneCassa { ... }` |
| `settings { ... }` | `impostazioni { ... }` |
| `authentication { ... }` | `autenticazione { ... }` |
| `monthlyClosures { ... }` | `chiusureMensili { ... }` |

#### CashManagement (ora GestioneCassa) Sub-fields — gia in italiano, nessuna modifica:
- `denominazioni` (invariato)
- `registroCassa` (invariato)
- `dashboardKPIs` (invariato)
- `mutateRegistroCassa` (invariato)
- `chiudiRegistroCassa` (invariato)
- `eliminaRegistroCassa` (invariato)

#### Sales (ora Vendite) Query Fields

| Attuale | Nuovo |
|---------|-------|
| `products` | `prodotti` |
| `product` | `prodotto` |
| `sales` | `vendite` |
| `sale` | `vendita` |
| `productCategories` | `categorieProdotto` |

#### Sales (ora Vendite) Mutation Fields

| Attuale | Nuovo |
|---------|-------|
| `createSale` | `creaVendita` |
| `updateSale` | `aggiornaVendita` |
| `deleteSale` | `eliminaVendita` |

#### Sales Query Argument Names

| Attuale | Nuovo |
|---------|-------|
| `search` | `ricerca` |
| `category` | `categoria` |
| `limit` | `limite` |
| `offset` | `scostamento` |
| `id` (in product/sale) | `id` (invariato) |
| `registerId` | `registroCassaId` |
| `dateFrom` | `dataDa` |
| `dateTo` | `dataA` |

#### Settings Query/Mutation Fields

| Attuale | Nuovo |
|---------|-------|
| `businessSettings` | `impostazioniAttivita` |
| `updateBusinessSettings` | `aggiornaImpostazioniAttivita` |

#### Connection Sub-fields (gia in italiano, invariati):
- `utenti`, `menus`, `ruoli`, `registriCassa` — invariati
- `suppliers` | `fornitori`
- `purchaseInvoices` | `fattureAcquisto`
- `deliveryNotes` | `documentiTrasporto`
- `supplierPayments` | `pagamentiFornitori`
- `monthlyClosures` | `chiusureMensili`
- `monthlyExpenses` | `speseMensili`

### 3.4 ProductType (ProdottoType) Field Names

| Attuale | Nuovo |
|---------|-------|
| `productId` | `prodottoId` |
| `code` | `codice` |
| `name` | `nome` |
| `description` | `descrizione` |
| `price` | `prezzo` |
| `category` | `categoria` |
| `unitOfMeasure` | `unitaMisura` |
| `isActive` | `attivo` |
| `createdAt` | `creatoIl` |
| `updatedAt` | `aggiornatoIl` |

### 3.5 SaleType (VenditaType) Field Names

| Attuale | Nuovo |
|---------|-------|
| `saleId` | `venditaId` |
| `registroCassaId` | `registroCassaId` (invariato, gia italiano) |
| `productId` | `prodottoId` |
| `quantity` | `quantita` |
| `unitPrice` | `prezzoUnitario` |
| `totalPrice` | `prezzoTotale` |
| `notes` | `note` |
| `timestamp` | `dataOra` |
| `createdAt` | `creatoIl` |
| `updatedAt` | `aggiornatoIl` |
| `product` | `prodotto` |

### 3.6 Modelli C# (Backend)

#### Product -> Prodotto

| Proprieta Attuale | Proprieta Nuova |
|-------------------|-----------------|
| `Product.ProductId` | `Prodotto.ProdottoId` |
| `Product.Code` | `Prodotto.Codice` |
| `Product.Name` | `Prodotto.Nome` |
| `Product.Description` | `Prodotto.Descrizione` |
| `Product.Price` | `Prodotto.Prezzo` |
| `Product.Category` | `Prodotto.Categoria` |
| `Product.UnitOfMeasure` | `Prodotto.UnitaMisura` |
| `Product.IsActive` | `Prodotto.Attivo` |
| `Product.CreatedAt` | `Prodotto.CreatoIl` |
| `Product.UpdatedAt` | `Prodotto.AggiornatoIl` |
| `Product.Sales` | `Prodotto.Vendite` |

#### Sale -> Vendita

| Proprieta Attuale | Proprieta Nuova |
|-------------------|-----------------|
| `Sale.SaleId` | `Vendita.VenditaId` |
| `Sale.RegistroCassaId` | `Vendita.RegistroCassaId` (invariato) |
| `Sale.ProductId` | `Vendita.ProdottoId` |
| `Sale.Quantity` | `Vendita.Quantita` |
| `Sale.UnitPrice` | `Vendita.PrezzoUnitario` |
| `Sale.TotalPrice` | `Vendita.PrezzoTotale` |
| `Sale.Notes` | `Vendita.Note` |
| `Sale.Timestamp` | `Vendita.DataOra` |
| `Sale.CreatedAt` | `Vendita.CreatoIl` |
| `Sale.UpdatedAt` | `Vendita.AggiornatoIl` |
| `Sale.RegistroCassa` | `Vendita.RegistroCassa` (invariato) |
| `Sale.Product` | `Vendita.Prodotto` |

#### CreateSaleInput -> CreaVenditaInput

| Attuale | Nuovo |
|---------|-------|
| `RegisterId` | `RegistroCassaId` |
| `ProductId` | `ProdottoId` |
| `Quantity` | `Quantita` |
| `Notes` | `Note` |
| `Timestamp` | `DataOra` |

#### UpdateSaleInput -> AggiornaVenditaInput

| Attuale | Nuovo |
|---------|-------|
| `ProductId` | `ProdottoId` |
| `Quantity` | `Quantita` |
| `Notes` | `Note` |

### 3.7 DbSets (AppDbContext)

| Attuale | Nuovo |
|---------|-------|
| `DbSet<Product> Products` | `DbSet<Prodotto> Prodotti` |
| `DbSet<Sale> Sales` | `DbSet<Vendita> Vendite` |

### 3.8 SeedData

| Attuale | Nuovo |
|---------|-------|
| `SeedProducts` | `SeedProdotti` |
| `SeedCashDenominations` | `SeedDenominazioniMoneta` |

### 3.9 File (Rename su Disco)

| File Attuale | File Nuovo |
|-------------|-----------|
| `Models/Product.cs` | `Models/Prodotto.cs` |
| `Models/Sale.cs` | `Models/Vendita.cs` |
| `SeedData/SeedProducts.cs` | `SeedData/SeedProdotti.cs` |
| `SeedData/SeedCashDenominations.cs` | `SeedData/SeedDenominazioniMoneta.cs` |
| `GraphQL/Sales/SalesQueries.cs` | `GraphQL/Vendite/VenditeQueries.cs` |
| `GraphQL/Sales/SalesMutations.cs` | `GraphQL/Vendite/VenditeMutations.cs` |
| `GraphQL/Sales/Types/SaleType.cs` | `GraphQL/Vendite/Types/VenditaType.cs` |
| `GraphQL/Sales/Types/ProductType.cs` | `GraphQL/Vendite/Types/ProdottoType.cs` |
| `GraphQL/Sales/Types/CreateSaleInputType.cs` | `GraphQL/Vendite/Types/CreaVenditaInputType.cs` |
| `GraphQL/Sales/Types/UpdateSaleInputType.cs` | `GraphQL/Vendite/Types/AggiornaVenditaInputType.cs` |
| `GraphQL/CashManagement/CashManagementQueries.cs` | `GraphQL/GestioneCassa/GestioneCassaQueries.cs` |
| `GraphQL/CashManagement/CashManagementMutations.cs` | `GraphQL/GestioneCassa/GestioneCassaMutations.cs` |
| `GraphQL/CashManagement/Types/*` | `GraphQL/GestioneCassa/Types/*` (invariati i nomi file, gia italiani) |
| `GraphQL/Connection/ConnectionQueries.cs` | `GraphQL/Connessione/ConnessioneQueries.cs` |
| `GraphQL/Settings/SettingsQueries.cs` | `GraphQL/Impostazioni/ImpostazioniQueries.cs` |
| `GraphQL/Settings/SettingsMutations.cs` | `GraphQL/Impostazioni/ImpostazioniMutations.cs` |
| `GraphQL/Settings/Types/BusinessSettingsType.cs` | `GraphQL/Impostazioni/Types/ImpostazioniAttivitaType.cs` |
| `GraphQL/Settings/Types/BusinessSettingsInputType.cs` | `GraphQL/Impostazioni/Types/ImpostazioniAttivitaInputType.cs` |
| `GraphQL/Authentication/AuthQueries.cs` | `GraphQL/Autenticazione/AutenticazioneQueries.cs` |
| `GraphQL/Authentication/AuthMutations.cs` | `GraphQL/Autenticazione/AutenticazioneMutations.cs` |
| `GraphQL/Authentication/GraphQLUserContext.cs` | `GraphQL/Autenticazione/ContestoUtenteGraphQL.cs` |
| `GraphQL/Authentication/TokenResponseType.cs` | `GraphQL/Autenticazione/RispostaTokenType.cs` |
| `GraphQL/Authentication/TokenResponse.cs` | `GraphQL/Autenticazione/RispostaToken.cs` |
| `GraphQL/Authentication/Types/*` | `GraphQL/Autenticazione/Types/*` (invariati, gia italiani) |

### 3.10 GraphQLQueries.cs e GraphQLMutations.cs (Root)

| Campo Attuale | Campo Nuovo |
|---------------|-------------|
| `Field<AuthQueries>("authentication")` | `Field<AutenticazioneQueries>("autenticazione")` |
| `Field<ConnectionQueries>("connection")` | `Field<ConnessioneQueries>("connessione")` |
| `Field<CashManagementQueries>("cashManagement")` | `Field<GestioneCassaQueries>("gestioneCassa")` |
| `Field<SettingsQueries>("settings")` | `Field<ImpostazioniQueries>("impostazioni")` |
| `Field<AuthMutations>("authentication")` | `Field<AutenticazioneMutations>("autenticazione")` |
| `Field<CashManagementMutations>("cashManagement")` | `Field<GestioneCassaMutations>("gestioneCassa")` |
| `Field<SettingsMutations>("settings")` | `Field<ImpostazioniMutations>("impostazioni")` |
| `Field<MonthlyClosuresMutations>("monthlyClosures")` | `Field<ChiusureMensiliMutations>("chiusureMensili")` |

### 3.11 Frontend GraphQL Queries/Mutations

Tutti i file frontend che referenziano `cashManagement` DEVONO essere aggiornati a `gestioneCassa`. Mapping specifico:

| File | Cambiamento |
|------|-------------|
| `duedgusto/src/graphql/cashRegister/queries.tsx` | `cashManagement` -> `gestioneCassa`; aggiungere campo vendite con nomi italiani |
| `duedgusto/src/graphql/cashRegister/mutations.tsx` | `cashManagement` -> `gestioneCassa` |
| `duedgusto/src/graphql/cashRegister/fragments.tsx` | Verificare e aggiornare nomi campi se necessario |
| Tutti i file che usano `connection { suppliers }` | -> `connessione { fornitori }` |
| Tutti i file che usano `settings { ... }` | -> `impostazioni { ... }` |
| Tutti i file che usano `authentication { ... }` | -> `autenticazione { ... }` |
| Tutti i file che usano `monthlyClosures` | -> `chiusureMensili` |

---

## 4. Requirements

### 4.1 MODIFIED Requirement: Naming Convention Gestione Cassa

Il sistema DEVE utilizzare nomenclatura italiana per tutte le classi, metodi, campi GraphQL, modelli e namespace del modulo gestione cassa.

(Precedentemente: nomenclatura mista italiano/inglese con layer GraphQL, modelli Sale/Product e alcuni servizi in inglese.)

#### Scenario: Query prodotti con nomi italiani

- GIVEN il backend e stato aggiornato con la rinominazione
- WHEN un client invia la query GraphQL `{ gestioneCassa { ... } }` oppure `{ connessione { prodotti { prodottoId codice nome prezzo } } }`
- THEN il server risponde con i dati corretti utilizzando i nuovi nomi campo italiani
- AND i vecchi nomi campo inglesi (`productId`, `code`, `name`, `price`) NON sono piu disponibili nello schema

#### Scenario: Creazione vendita con nomi italiani

- GIVEN il backend e stato aggiornato con la rinominazione
- WHEN un client invia la mutation `{ gestioneCassa { creaVendita(input: { registroCassaId: 1, prodottoId: 1, quantita: 2 }) { venditaId prezzoTotale prodotto { nome } } } }`
- THEN il server crea la vendita e risponde con i dati nei campi italiani
- AND il campo `prodotto` (navigation property) contiene il prodotto con campi italiani

#### Scenario: Aggiornamento vendita con nomi italiani

- GIVEN esiste una vendita con `venditaId: 5`
- WHEN un client invia la mutation `{ gestioneCassa { aggiornaVendita(id: 5, input: { quantita: 3 }) { venditaId prezzoTotale } } }`
- THEN la vendita viene aggiornata e il `prezzoTotale` viene ricalcolato
- AND il server risponde con i nuovi campi italiani

#### Scenario: Eliminazione vendita con nomi italiani

- GIVEN esiste una vendita con `venditaId: 5` il cui registro non appartiene a un mese chiuso
- WHEN un client invia la mutation `{ gestioneCassa { eliminaVendita(id: 5) } }`
- THEN la vendita viene eliminata e il totale del registro viene aggiornato
- AND la risposta e `true`

### 4.2 MODIFIED Requirement: Schema GraphQL Root Fields

I campi root dello schema GraphQL DEVONO utilizzare nomi italiani.

(Precedentemente: `cashManagement`, `connection`, `settings`, `authentication`, `monthlyClosures` come nomi root.)

#### Scenario: Navigazione schema root query

- GIVEN lo schema GraphQL aggiornato
- WHEN un client effettua introspezione dello schema
- THEN i campi root query includono: `autenticazione`, `connessione`, `gestioneCassa`, `impostazioni`, `suppliers` (fuori scope), `chiusureMensili`
- AND i vecchi nomi root (`cashManagement`, `connection`, `settings`, `authentication`) NON esistono piu

#### Scenario: Navigazione schema root mutation

- GIVEN lo schema GraphQL aggiornato
- WHEN un client effettua introspezione dello schema
- THEN i campi root mutation includono: `autenticazione`, `gestioneCassa`, `impostazioni`, `suppliers` (fuori scope), `chiusureMensili`
- AND i vecchi nomi root NON esistono piu

### 4.3 ADDED Requirement: Compatibilita Database Fase 1

Durante la Fase 1, il sistema DEVE mantenere la compatibilita con lo schema database esistente tramite mapping EF Core esplicito.

#### Scenario: Mapping temporaneo EF Core per tabella Products

- GIVEN la classe `Product` e stata rinominata in `Prodotto` con proprieta italiane
- WHEN EF Core costruisce le query SQL
- THEN le query usano il nome tabella `Products` e i nomi colonne originali (`ProductId`, `Code`, `Name`, `Price`, ecc.)
- AND il mapping e ottenuto tramite `ToTable("Products")` e `HasColumnName("...")` nella configurazione `OnModelCreating`

#### Scenario: Mapping temporaneo EF Core per tabella Sales

- GIVEN la classe `Sale` e stata rinominata in `Vendita` con proprieta italiane
- WHEN EF Core costruisce le query SQL
- THEN le query usano il nome tabella `Sales` e i nomi colonne originali (`SaleId`, `ProductId`, `Quantity`, `UnitPrice`, `TotalPrice`, `Notes`, `Timestamp`, ecc.)
- AND il mapping e ottenuto tramite `ToTable("Sales")` e `HasColumnName("...")`

#### Scenario: Lettura e scrittura dati invariata durante Fase 1

- GIVEN il mapping EF Core temporaneo e configurato
- WHEN l'applicazione legge/scrive prodotti e vendite
- THEN i dati sono letti/scritti correttamente dal/nel database esistente
- AND nessun dato viene perso o corrotto

### 4.4 ADDED Requirement: Migrazione Database Fase 2

Nella Fase 2, il sistema DEVE rinominare le tabelle e colonne del database tramite una migrazione EF Core.

#### Scenario: Rinominazione tabella Products

- GIVEN la Fase 1 e completata e stabile
- WHEN viene applicata la migrazione Fase 2
- THEN la tabella `Products` viene rinominata in `Prodotti`
- AND le colonne vengono rinominate: `ProductId` -> `ProdottoId`, `Code` -> `Codice`, `Name` -> `Nome`, `Price` -> `Prezzo`, `Category` -> `Categoria`, `UnitOfMeasure` -> `UnitaMisura`, `IsActive` -> `Attivo`, `CreatedAt` -> `CreatoIl`, `UpdatedAt` -> `AggiornatoIl`

#### Scenario: Rinominazione tabella Sales

- GIVEN la Fase 1 e completata e stabile
- WHEN viene applicata la migrazione Fase 2
- THEN la tabella `Sales` viene rinominata in `Vendite`
- AND le colonne vengono rinominate: `SaleId` -> `VenditaId`, `ProductId` -> `ProdottoId`, `Quantity` -> `Quantita`, `UnitPrice` -> `PrezzoUnitario`, `TotalPrice` -> `PrezzoTotale`, `Notes` -> `Note`, `Timestamp` -> `DataOra`, `CreatedAt` -> `CreatoIl`, `UpdatedAt` -> `AggiornatoIl`
- AND la migrazione usa `RenameTable` e `RenameColumn` (non drop+create)

#### Scenario: Rimozione mapping temporaneo

- GIVEN la migrazione Fase 2 e stata applicata con successo
- WHEN il mapping temporaneo `ToTable`/`HasColumnName` viene rimosso dal codice
- THEN EF Core usa la convenzione di default (nomi classe/proprieta = nomi tabella/colonna)
- AND l'applicazione continua a funzionare senza errori

#### Scenario: Rollback migrazione Fase 2

- GIVEN la migrazione Fase 2 e stata applicata
- WHEN si esegue `dotnet ef database update <migrazione-precedente>`
- THEN le tabelle e colonne tornano ai nomi originali
- AND nessun dato viene perso

### 4.5 MODIFIED Requirement: Frontend Allineato allo Schema GraphQL

Il frontend DEVE utilizzare i nuovi nomi campo GraphQL italiani in tutte le query e mutation Apollo Client.

(Precedentemente: le query usavano `cashManagement`, `createSale`, `products`, ecc.)

#### Scenario: Query denominazioni aggiornata

- GIVEN il frontend e stato aggiornato
- WHEN il componente carica le denominazioni
- THEN la query usa `gestioneCassa { denominazioni { ... } }` invece di `cashManagement { denominazioni { ... } }`
- AND i dati vengono ricevuti e renderizzati correttamente

#### Scenario: Mutation submit registro cassa aggiornata

- GIVEN il frontend e stato aggiornato
- WHEN l'utente salva un registro cassa
- THEN la mutation usa `gestioneCassa { mutateRegistroCassa(...) { ... } }` invece di `cashManagement { ... }`
- AND il salvataggio avviene correttamente

#### Scenario: Query connection aggiornata

- GIVEN il frontend e stato aggiornato
- WHEN un componente carica dati paginati (registri cassa, utenti, ecc.)
- THEN la query usa `connessione { registriCassa(...) { ... } }` invece di `connection { registriCassa(...) { ... } }`
- AND la paginazione funziona correttamente

#### Scenario: Query impostazioni aggiornata

- GIVEN il frontend e stato aggiornato
- WHEN il componente carica le impostazioni attivita
- THEN la query usa `impostazioni { impostazioniAttivita { ... } }` invece di `settings { businessSettings { ... } }`

#### Scenario: Cache Apollo Client invalidata

- GIVEN il frontend e stato deployato con i nuovi nomi
- WHEN un utente accede all'app per la prima volta dopo il deploy
- THEN la cache Apollo non causa errori per i vecchi nomi campo
- AND i dati vengono caricati correttamente dal server

### 4.6 MODIFIED Requirement: Compilazione e Test

Il sistema DEVE compilare senza errori e tutti i test DEVONO passare dopo entrambe le fasi.

#### Scenario: Build backend Fase 1

- GIVEN tutte le rinominazioni della Fase 1 sono state applicate (codice + mapping EF Core)
- WHEN si esegue `dotnet build` nella cartella backend
- THEN la build termina con successo senza errori
- AND non ci sono warning relativi a riferimenti mancanti

#### Scenario: Build backend Fase 2

- GIVEN la migrazione Fase 2 e stata creata e il mapping temporaneo rimosso
- WHEN si esegue `dotnet build` nella cartella backend
- THEN la build termina con successo senza errori

#### Scenario: Test backend dopo Fase 1

- GIVEN tutti i file test sono stati aggiornati con i nuovi nomi
- WHEN si eseguono i test del backend
- THEN tutti i test passano
- AND nessun test e stato rimosso (solo aggiornato)

#### Scenario: Check TypeScript frontend

- GIVEN il frontend e stato aggiornato con i nuovi nomi GraphQL
- WHEN si esegue `npm run ts:check` nella cartella duedgusto
- THEN il check termina senza errori di tipo

#### Scenario: Lint frontend

- GIVEN il frontend e stato aggiornato
- WHEN si esegue `npm run lint` nella cartella duedgusto
- THEN il lint termina senza errori

---

## 5. Constraints

### C1: Variabili Locali in Inglese
Le variabili locali, parametri di metodo e variabili temporanee all'interno dei metodi DEVONO restare in inglese. Solo classi, proprieta pubbliche, nomi GraphQL, namespace e cartelle vengono rinominati.

### C2: Approccio a Due Fasi
La Fase 1 (application layer) DEVE essere completata e verificata prima di procedere con la Fase 2 (database migration). Non e ammesso modificare lo schema database nella Fase 1.

### C3: Deploy Simultaneo Frontend/Backend
Il frontend aggiornato DEVE essere deployato contemporaneamente al backend della Fase 1. Un deploy parziale (solo backend o solo frontend) causa breaking change.

### C4: Solo Rinominazione
Questo change e di sola rinominazione. Non DEVONO essere introdotte modifiche logiche, nuove funzionalita o refactoring del comportamento. Il comportamento del sistema DEVE rimanere identico.

### C5: Moduli Fuori Scope
I moduli `Suppliers/` e `Management/` nel backend GraphQL NON rientrano in questo change. Solo i moduli elencati nella sezione 3.1 vengono rinominati.

### C6: Migrazione Reversibile
La migrazione database Fase 2 DEVE usare `RenameTable` e `RenameColumn` (non drop+create) per essere reversibile e preservare i dati.

---

## 6. Acceptance Criteria

- [ ] `dotnet build` compila senza errori dopo la Fase 1
- [ ] `dotnet build` compila senza errori dopo la Fase 2
- [ ] Tutti i test backend esistenti passano dopo entrambe le fasi
- [ ] `npm run ts:check` passa nel frontend
- [ ] `npm run lint` passa nel frontend
- [ ] Lo schema GraphQL espone solo nomi italiani per il modulo gestione cassa (verificabile via introspezione)
- [ ] Le variabili locali restano in inglese
- [ ] Il flusso completo di cassa funziona end-to-end: registrazione vendita, chiusura registro, dashboard KPI, chiusura mensile
- [ ] Le tabelle DB sono rinominate in italiano (Fase 2)
- [ ] Nessun mapping EF Core temporaneo residuo dopo la Fase 2
- [ ] Nessuna regressione funzionale: il comportamento del sistema e identico a prima della rinominazione
