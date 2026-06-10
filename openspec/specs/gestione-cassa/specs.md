# Gestione Cassa Specification

**Domain**: gestione-cassa
**Status**: Active
**Ultimo aggiornamento**: 2026-06-10

Change incorporate in questa spec:

| Change | Archiviata il | Sezioni |
|--------|---------------|---------|
| rinominazione-italiano-gestione-cassa | 2026-03-13 | 1–6 (nomenclatura italiana) |
| fix-salvataggio-cassa-fase1 | 2026-06-10 | 7 (salvataggio registro, dedup documenti, totali e riepilogo) |
| coerenza-calcoli-fase2 | 2026-06-10 | 8 (KPI dashboard, guard giorno operativo, vista mensile); riformulazione requirement IVA in sez. 7 |
| iva-multialiquota-fase3 | 2026-06-10 | 9 (aliquota IVA prodotto, snapshot vendita, breakdown IVA registro) |

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

---

## 7. Requirements: Salvataggio Registro Cassa (fix-salvataggio-cassa-fase1)

> Nota sullo schema GraphQL: questi requirement NON hanno richiesto modifiche allo schema GraphQL.
> La mutation `gestioneCassa.mutateRegistroCassa` restituisce `pagamentiFornitori`
> con `pagamentoId`, `fattura.fatturaId`, `ddt.ddtId` e i campi identificativi
> (`fornitore.fornitoreId`, `numeroFattura`, `numeroDdt`) tramite `RegistroCassaFragment`.
> Anche `importoIva` e `totaleVendite` sono esposti sul tipo `RegistroCassa`.

### Requirement: Riuso DocumentoTrasporto esistente in salvataggio registro

Quando il salvataggio del registro cassa crea un pagamento fornitore di tipo DDT senza
`ddtId`, il sistema MUST cercare un `DocumentoTrasporto` esistente per la coppia
`(FornitoreId, NumeroDdt)` — la stessa chiave dell'indice UNIQUE
`IX_DocumentiTrasporto_FornitoreId_NumeroDdt` — e, se trovato, MUST riusarne l'ID invece
di creare un nuovo record. Il confronto MUST trattare il numero DDT vuoto/null in modo
normalizzato e coerente con la creazione: ogni riga con numero vuoto risolve a un
documento con numero placeholder deterministico `SN-{yyyyMMdd}-{seq}` (data del registro,
progressivo per fornitore), riusabile in modo idempotente ai salvataggi successivi.
Il sistema MUST NOT sollevare violazioni dell'indice UNIQUE durante il salvataggio del
registro per DDT già esistenti.

#### Scenario: Riscrittura registro con DDT già registrato

- GIVEN un registro cassa salvato in precedenza con un pagamento collegato al DDT n. "123" del fornitore F
- AND il client reinvia la riga spesa senza `ddtId` (es. prima del refetch)
- WHEN viene eseguita la mutation `mutateRegistroCassa` con la riga DDT n. "123" del fornitore F
- THEN il sistema riusa il `DocumentoTrasporto` esistente `(F, "123")` senza crearne uno nuovo
- AND il salvataggio completa con successo senza errori `Duplicate entry`
- AND nel database esiste un solo DDT con quella coppia fornitore/numero

#### Scenario: Due righe DDT senza numero per lo stesso fornitore

- GIVEN un registro cassa in compilazione con due righe spesa di tipo DDT per lo stesso fornitore F, entrambe con numero DDT vuoto
- WHEN l'utente salva il registro
- THEN il salvataggio completa con successo senza violazione dell'indice UNIQUE
- AND il comportamento è deterministico e documentato: ogni riga senza numero risolve a un documento placeholder distinto `SN-{yyyyMMdd}-{seq}` (es. `SN-20260609-1` e `SN-20260609-2`)
- AND un risalvataggio del registro riusa gli stessi documenti placeholder in modo idempotente, senza crearne di nuovi

#### Scenario: DDT nuovo (nessun documento esistente)

- GIVEN nessun `DocumentoTrasporto` esiste per la coppia `(fornitore F, numero "456")`
- WHEN l'utente salva il registro con una riga spesa DDT n. "456" del fornitore F
- THEN il sistema crea un nuovo `DocumentoTrasporto` con fornitore F, numero "456", data e importo della riga
- AND il pagamento fornitore creato referenzia il nuovo `ddtId`

### Requirement: Deduplicazione fatture acquisto estesa al numero vuoto

La deduplicazione delle fatture acquisto in salvataggio registro MUST essere applicata
anche quando `NumeroFattura` è vuoto o null, usando la stessa normalizzazione del valore
persistito (la chiave di ricerca MUST coincidere con quella dell'indice UNIQUE
`IX_FattureAcquisto_FornitoreId_NumeroFattura`). Il sistema MUST NOT creare una seconda
fattura con la stessa coppia `(FornitoreId, NumeroFattura)`.

#### Scenario: Fattura con numero vuoto già esistente

- GIVEN esiste una `FatturaAcquisto` del fornitore F con `NumeroFattura` vuoto (creata da un salvataggio precedente)
- WHEN l'utente risalva il registro con una riga spesa fattura del fornitore F senza numero fattura e senza `fatturaId`
- THEN il sistema trova la fattura esistente con la chiave normalizzata `(F, "")` e la riusa
- AND il salvataggio completa senza errori `Duplicate entry`

#### Scenario: Riuso fattura orfana (senza pagamenti)

- GIVEN esiste una `FatturaAcquisto` `(F, "789")` senza alcun pagamento collegato
- WHEN l'utente salva un registro con una riga spesa fattura n. "789" del fornitore F
- THEN il sistema riusa la fattura esistente collegandovi il nuovo pagamento
- AND non viene creata una seconda fattura `(F, "789")`

### Requirement: Distinzione tra riscrittura dello stesso registro e doppia registrazione fattura

Quando la dedup trova una fattura esistente che ha già pagamenti collegati, il sistema
MUST distinguere i due casi: se tutti i pagamenti esistenti appartengono al registro
cassa in corso di salvataggio (riscrittura legittima), il sistema MUST riusare la fattura
senza errore; se almeno un pagamento appartiene a un ALTRO registro cassa, il sistema
MUST rifiutare l'operazione con un errore esplicito di doppia registrazione che
identifichi fattura e fornitore. L'errore MUST provocare il rollback dell'intera
transazione (nessun salvataggio parziale).

#### Scenario: Riscrittura del registro con fattura già pagata dallo stesso registro

- GIVEN il registro R è stato salvato con una riga spesa fattura n. "100" del fornitore F (pagamento P collegato alla fattura, `RegistroCassaId = R`)
- AND il client reinvia la riga con `pagamentoId = null` (es. risalvataggio prima del refetch)
- WHEN viene eseguita la mutation `mutateRegistroCassa` per il registro R con la riga fattura n. "100" del fornitore F
- THEN il sistema riusa la fattura esistente senza sollevare l'errore di doppia registrazione
- AND il salvataggio completa con successo
- AND la fattura n. "100" del fornitore F resta unica nel database

#### Scenario: Vera doppia registrazione (pagamenti di un altro registro)

- GIVEN la fattura n. "200" del fornitore F ha un pagamento collegato al registro R1
- WHEN l'utente tenta di salvare il registro R2 (giorno diverso) con una riga spesa fattura n. "200" del fornitore F senza `fatturaId`/`pagamentoId`
- THEN il sistema rifiuta il salvataggio con un errore che indica che la fattura è già registrata (numero fattura e fornitore nel messaggio)
- AND l'intera transazione viene annullata: il registro R2 non viene salvato né parzialmente modificato

### Requirement: Salvataggio registro con saldo di giornata negativo

Il sistema MUST salvare correttamente un registro cassa il cui risultato di giornata è
negativo (spese superiori agli incassi), inclusi DDT e fatture allegati. I campi
`ContanteAtteso`, `Differenza` e i totali MUST accettare e persistere valori negativi.
Il valore negativo MUST NOT essere causa di errore o di rollback.

#### Scenario: Spese fornitori superiori agli incassi con documenti allegati

- GIVEN un registro cassa con incasso contante tracciato 100€, incassi elettronici 0€, incassi fattura 0€
- AND righe spesa per 250€ totali che includono una fattura acquisto e un DDT
- WHEN l'utente salva il registro
- THEN la mutation completa con successo e il registro viene persistito
- AND `ContanteAtteso` risulta negativo (100 − spese) e viene salvato con il segno corretto
- AND i documenti (fattura e DDT) risultano creati o riusati senza duplicati

#### Scenario: Risalvataggio consecutivo di un registro con saldo negativo

- GIVEN il registro con saldo negativo dello scenario precedente è stato appena salvato
- WHEN l'utente preme di nuovo Salva senza che sia avvenuto il refetch
- THEN il salvataggio completa di nuovo con successo
- AND non vengono creati pagamenti, fatture o DDT duplicati

### Requirement: Formula ContanteAtteso corretta

Il calcolo dei totali del registro cassa MUST applicare la formula
`ContanteAtteso = IncassoContanteTracciato − SpeseFornitori − SpeseGiornaliere`.
Il sistema MUST NOT azzerare o ignorare la componente di incasso contante nel calcolo.
`Differenza` MUST restare derivata come
`(TotaleChiusura − TotaleApertura) − ContanteAtteso`.

#### Scenario: Calcolo ContanteAtteso con incassi e spese

- GIVEN un registro con incasso contante tracciato 500€, spese fornitori 120€, spese giornaliere 30€
- AND totale apertura 200€ e totale chiusura 550€
- WHEN il registro viene salvato
- THEN `ContanteAtteso` persistito vale 350€ (500 − 120 − 30)
- AND `Differenza` vale 0€ ((550 − 200) − 350)

#### Scenario: ContanteAtteso negativo

- GIVEN un registro con incasso contante tracciato 50€, spese fornitori 200€, spese giornaliere 0€
- WHEN il registro viene salvato
- THEN `ContanteAtteso` persistito vale −150€
- AND il salvataggio completa senza errori

### Requirement: Sincronizzazione ID documenti sulle righe spese dopo il submit

Dopo un submit riuscito della mutation `mutateRegistroCassa`, il frontend MUST aggiornare
le righe spese di tipo pagamento fornitore con gli identificativi restituiti dal server
(`pagamentoId`, `fatturaId`, `ddtId` da `result.pagamentiFornitori`), così che un
risalvataggio immediato invii aggiornamenti (`pagamentoId` valorizzato) e non nuovi
inserimenti. L'associazione riga-pagamento restituito MUST avvenire per chiave di
business (fornitore + tipo documento + numero documento), NOT per posizione/indice.
Se l'associazione per chiave non è possibile (mismatch tra righe inviate e pagamenti
restituiti), il frontend MUST riallineare lo stato con un refetch completo del registro
invece di lasciare righe con ID mancanti o errati.

#### Scenario: Risalvataggio immediato prima del refetch

- GIVEN l'utente ha salvato con successo un registro con una riga spesa DDT n. "123" del fornitore F (prima volta, senza ID)
- AND la mutation ha restituito `pagamentiFornitori` con `pagamentoId`, `ddtId` per quella riga
- WHEN l'utente preme di nuovo Salva senza ricaricare la pagina e senza refetch
- THEN la riga spesa viene inviata con `pagamentoId` e `ddtId` valorizzati (update, non insert)
- AND il backend aggiorna il pagamento esistente senza cancellarlo e ricrearlo
- AND il salvataggio completa senza errori `Duplicate entry`

#### Scenario: Aggiornamento righe miste fattura e DDT

- GIVEN un submit riuscito con due righe spesa: una fattura n. "10" del fornitore A e un DDT n. "20" del fornitore B
- WHEN il frontend elabora `result.pagamentiFornitori`
- THEN la riga fattura riceve `pagamentoId` e `fatturaId` del pagamento con fornitore A e numero fattura "10"
- AND la riga DDT riceve `pagamentoId` e `ddtId` del pagamento con fornitore B e numero DDT "20"
- AND nessuna riga riceve gli ID dell'altra (match per chiave, non per indice)

#### Scenario: Mismatch tra righe inviate e pagamenti restituiti

- GIVEN un submit riuscito in cui il numero o le chiavi dei `pagamentiFornitori` restituiti non corrispondono alle righe spese in griglia
- WHEN il frontend tenta la mappatura per chiave e rileva il mismatch
- THEN il frontend esegue un refetch completo del registro dal server
- AND la griglia spese viene ripopolata con i dati e gli ID del server

### Requirement: IVA visualizzata dal backend

Il riepilogo cassa attivo (`SummaryDataGrid`) MUST mostrare l'IVA usando il valore
`importoIva` calcolato e restituito dal backend. Il frontend MUST NOT calcolare l'IVA con
un'aliquota hardcoded (es. `totalSales * 0.1`). Il backend resta l'unica fonte di verità
per l'aliquota (da `BusinessSettings.VatRate`) e per lo scorporo.

> Nota (coerenza-calcoli-fase2): il requirement era originariamente formulato sul
> componente `CashSummary`, rimosso in Fase 2 perché dead code (nessun import nel
> codebase). Il requisito sostanziale resta in vigore sul riepilogo attivo
> `SummaryDataGrid`, già allineato in Fase 1.

#### Scenario: Visualizzazione IVA su registro salvato

- GIVEN un registro cassa salvato per cui il backend ha calcolato `importoIva`
- WHEN l'utente apre la pagina di gestione cassa di quel giorno
- THEN il riepilogo mostra l'IVA pari al campo `importoIva` del server
- AND nessun ricalcolo locale con aliquota fissa al 10% viene applicato

#### Scenario: Registro nuovo non ancora salvato

- GIVEN l'utente sta compilando un registro nuovo non ancora salvato (nessun `importoIva` dal server)
- WHEN il riepilogo viene renderizzato
- THEN l'IVA MUST NOT essere calcolata con l'aliquota 10% hardcoded
- AND il riepilogo mostra un valore neutro definito (0 o assente) finché il dato del server non è disponibile, oppure dopo il salvataggio mostra l'`importoIva` restituito dalla mutation

### Requirement: Totale Vendite frontend allineato al backend

Il valore "Totale Vendite" visualizzato dal frontend (`SummaryDataGrid`) MUST coincidere
con il `totaleVendite` calcolato dal backend, definito come somma dei canali di incasso
(`incassoContanteTracciato + incassiElettronici + incassiFattura`). Il frontend MUST NOT
derivarlo dal movimento fisico di cassa
(attuale `(chiusura − apertura) + elettronico + fattura`). In presenza del dato del
server il frontend SHOULD usarlo direttamente.

#### Scenario: Totale Vendite coerente tra riepilogo e backend

- GIVEN un registro con incasso contante tracciato 300€, incassi elettronici 150€, incassi fattura 50€
- AND conteggi fisici con chiusura − apertura = 280€ (diverso dal contante tracciato)
- WHEN il riepilogo viene visualizzato
- THEN il Totale Vendite mostrato vale 500€ (300 + 150 + 50)
- AND coincide con il campo `totaleVendite` restituito dal backend
- AND il movimento fisico (280€) non altera il Totale Vendite

---

## 8. Requirements: Coerenza Calcoli e KPI (coerenza-calcoli-fase2)

> Nota sullo schema GraphQL: questi requirement NON hanno modificato lo schema GraphQL
> del modulo gestione cassa. I campi del tipo `RegistroCassaKPI` (`venditeOggi`,
> `differenzaOggi`, `venditeMese`, `mediaMese`, `trendSettimana`) restano invariati nel
> nome e nel tipo; sono cambiati i criteri di calcolo di `mediaMese` e `trendSettimana`.
>
> Nota: la Fase 2 ha inoltre rimosso il componente `CashSummary.tsx` (dead code, nessun
> import nel codebase); il riepilogo attivo è `SummaryDataGrid.tsx` (vedi requirement
> "IVA visualizzata dal backend" in sezione 7, riformulato di conseguenza).

### Requirement: MediaMese calcolata solo sui registri chiusi

Il KPI `mediaMese` MUST essere la media di `TotaleVendite` dei soli registri cassa del
mese corrente (dal primo del mese a oggi incluso) con stato `CLOSED` o `RECONCILED`.
I registri `DRAFT` MUST NOT concorrere alla media. Se nel mese non esiste alcun registro
`CLOSED`/`RECONCILED`, `mediaMese` MUST valere 0 (nessuna divisione per zero).
I KPI `venditeOggi` e `differenzaOggi` MUST continuare a riflettere il registro del
giorno corrente qualunque sia il suo stato (incluso `DRAFT`: è il dato live di oggi);
`venditeMese` resta invariato.

(Precedentemente: la media includeva tutti i registri del mese, e i DRAFT — che valgono
0 € — abbassavano artificialmente il valore.)

#### Scenario: Mese con registri chiusi e bozze

- GIVEN un mese corrente con 10 registri `CLOSED` per un totale vendite di 5.000 €
- AND 2 registri `DRAFT` con `TotaleVendite = 0`
- WHEN viene eseguita la query `dashboardKPIs`
- THEN `mediaMese` vale 500 € (5.000 / 10)
- AND i 2 DRAFT non entrano né al numeratore né al denominatore

#### Scenario: Mese senza registri chiusi

- GIVEN un mese corrente che contiene solo registri `DRAFT` (o nessun registro)
- WHEN viene eseguita la query `dashboardKPIs`
- THEN `mediaMese` vale 0
- AND la query completa senza errori

### Requirement: TrendSettimana su settimane lunedì-based con porzione equivalente

Il KPI `trendSettimana` MUST confrontare le vendite della **settimana corrente da lunedì
a oggi incluso** con le vendite della **porzione equivalente della settimana precedente**
(dal lunedì precedente allo stesso giorno della settimana, cioè ogni data spostata di
−7 giorni). La settimana MUST iniziare di lunedì, coerentemente con la convenzione
`operatingDayIndex` (0 = lunedì) usata dai guard e dalle chiusure mensili.
Solo i registri con stato `CLOSED` o `RECONCILED` MUST concorrere a entrambe le somme.
La formula MUST essere `trend = (correnteParziale − precedenteEquivalente) / precedenteEquivalente × 100`;
se `precedenteEquivalente` vale 0, `trendSettimana` MUST valere 0 (guardia divisione per zero).

(Precedentemente: confronto arbitrario `TakeLast(3)` contro il resto dei registri caricati,
con settimana che partiva di domenica e senza filtro sullo stato.)

#### Scenario: Trend positivo su porzione equivalente

- GIVEN oggi è mercoledì e i registri `CLOSED` da lunedì a mercoledì della settimana
  corrente totalizzano 1.100 €
- AND i registri `CLOSED` da lunedì a mercoledì della settimana precedente totalizzano 1.000 €
- AND giovedì-domenica della settimana precedente hanno altri registri chiusi (esclusi dal confronto)
- WHEN viene eseguita la query `dashboardKPIs`
- THEN `trendSettimana` vale +10 (%)
- AND i giorni della settimana precedente successivi a mercoledì non entrano nella base di confronto

#### Scenario: Settimana precedente con base zero

- GIVEN la porzione equivalente della settimana precedente non contiene registri
  `CLOSED`/`RECONCILED` (somma 0)
- WHEN viene eseguita la query `dashboardKPIs`
- THEN `trendSettimana` vale 0
- AND la query completa senza errori di divisione per zero

#### Scenario: Settimana corrente con 0 registri chiusi

- GIVEN la settimana corrente (lunedì → oggi) contiene solo registri `DRAFT` o nessun registro
- AND la porzione equivalente della settimana precedente totalizza 800 € di registri chiusi
- WHEN viene eseguita la query `dashboardKPIs`
- THEN `trendSettimana` vale −100 (%) ((0 − 800) / 800 × 100)
- AND i registri `DRAFT` della settimana corrente non vengono sommati

#### Scenario: Domenica appartiene alla settimana iniziata il lunedì precedente

- GIVEN oggi è domenica
- WHEN viene calcolato l'inizio della settimana corrente
- THEN la settimana corrente è iniziata il lunedì di 6 giorni prima (non oggi né il giorno dopo)
- AND il confronto copre lunedì→domenica corrente vs lunedì→domenica della settimana precedente

### Requirement: Guard giorno operativo simmetrico tra creazione e chiusura registro

La chiusura del registro cassa (`chiudiRegistroCassa`) MUST validare il giorno operativo
con la stessa logica della creazione: periodi di programmazione
(`PeriodiProgrammazione`) quando esistono, con fallback alle impostazioni globali
(`BusinessSettings.OperatingDays`) quando non esiste alcun periodo. Un registro creato in
un giorno operativo MUST risultare sempre chiudibile rispetto al guard del giorno
operativo (guard simmetrici). I messaggi d'errore MUST essere declinati per l'operazione
("Impossibile chiudere...") mantenendo giorno e data nel testo. La logica condivisa di
valutazione del giorno operativo MUST essere unica (nessuna duplicazione tra i due guard).

(Precedentemente: la chiusura usava `GuardGiornoOperativoSoloGlobale`, che ignora i
periodi di programmazione → un registro creato in un giorno operativo di periodo ma non
operativo nel calendario globale risultava non chiudibile.)

#### Scenario: Registro creato in giorno operativo di periodo è chiudibile

- GIVEN un periodo di programmazione attivo che include il martedì come giorno operativo
- AND le impostazioni globali (`OperatingDays`) marcano il martedì come giorno di chiusura
- AND un registro cassa creato di martedì (la creazione è stata permessa dal guard con periodi)
- WHEN l'utente esegue `chiudiRegistroCassa` su quel registro
- THEN il guard del giorno operativo passa e il registro transita a `CLOSED`

#### Scenario: Chiusura rifiutata in giorno non operativo del periodo

- GIVEN un periodo di programmazione attivo che marca la domenica come giorno di chiusura
- AND un registro cassa con data domenica
- WHEN l'utente esegue `chiudiRegistroCassa` su quel registro
- THEN l'operazione fallisce con un errore che inizia con "Impossibile chiudere"
  e contiene il nome del giorno e la data
- AND lo stato del registro resta invariato

#### Scenario: Nessun periodo configurato — fallback globale invariato

- GIVEN nessun `PeriodoProgrammazione` configurato
- AND le impostazioni globali marcano il lunedì come giorno operativo
- WHEN l'utente chiude un registro con data lunedì
- THEN il guard usa le impostazioni globali e la chiusura procede
- AND il comportamento è identico a quello precedente alla modifica

### Requirement: Totale Vendite mensile allineato al backend (VistaMensile)

Le metriche mensili di `VistaMensile` MUST calcolare `totaleVendite` sommando il campo
`totaleVendite` restituito dal server per ciascun registro; in assenza del dato del
server la somma di fallback MUST usare i canali di incasso
(`incassoContanteTracciato + incassiElettronici + incassiFattura`), cioè la stessa
formula del backend. Il movimento fisico di cassa (`totaleChiusura − totaleApertura`)
MUST NOT concorrere al Totale Vendite mensile. Anche il `revenue` degli eventi del
calendario MUST usare lo stesso valore/formula del server, NOT il movimento fisico.

(Precedentemente: `VistaMensile.tsx` sommava `movimento + elettronici + fatture` e
calcolava `revenue = (chiusura − apertura) + elettronici` — formule già corrette in
Fase 1 su `SummaryDataGrid.tsx` ma rimaste nella vista mensile.)

#### Scenario: Totale Vendite mensile coerente con il server

- GIVEN un mese con due registri: R1 con `totaleVendite = 500 €` (movimento fisico 480 €)
  e R2 con `totaleVendite = 300 €` (movimento fisico 320 €)
- WHEN la vista mensile calcola le metriche
- THEN il Totale Vendite mensile vale 800 € (500 + 300)
- AND il valore coincide con la somma dei `totaleVendite` del server, non con la somma
  dei movimenti fisici

#### Scenario: Evento calendario con revenue dal valore server

- GIVEN un registro con `totaleVendite = 500 €`, `totaleChiusura − totaleApertura = 480 €`
  e `incassiElettronici = 150 €`
- WHEN la vista mensile genera l'evento calendario di quel giorno
- THEN il `revenue` mostrato nel titolo dell'evento vale 500 €
- AND non vale 630 € (movimento + elettronici, formula precedente)

---

## 9. Requirements: IVA Multialiquota (iva-multialiquota-fase3)

Convenzioni trasversali (vincolanti per tutti i requirement di questa sezione):

- L'aliquota persistita è SEMPRE in **percentuale** (`22.00`), come `Fornitore.AliquotaIva`; la conversione a frazione avviene esclusivamente via `IvaCalculator.AliquotaDaPercentuale` nei punti di calcolo.
- Tutti gli scorpori/applicazioni IVA passano da `IvaCalculator` (invariante: `Imponibile + Iva == Totale` al centesimo, vedi spec `calcoli-iva`). I requirement sotto riusano questa invariante senza ridefinirla.
- Le aliquote ammesse sono il set chiuso `{0, 4, 5, 10, 22}` (percentuali), definito come costante centralizzata unica.
- Decisioni vincolanti: residuo negativo → clamp a 0 + log warning (mai bloccare il salvataggio); calcolo breakdown in helper puro (senza accesso DB); pagina amministrativa Prodotti fuori scope; snapshot IVA vendita immutabile salvo cambio prodotto/prezzo; backfill registri storici tutto `stimato = true`; eventi subscription invariati.

### Requirement: Aliquota IVA del prodotto

Ogni prodotto DEVE avere un'aliquota IVA persistita (`Prodotto.AliquotaIva`, percentuale, `decimal(5,2) NOT NULL`). I prodotti creati senza aliquota esplicita DEVONO ricevere il default `22.00` (default applicativo e di colonna DB). I prodotti seed DEVONO dichiarare aliquote esplicite.

#### Scenario: Backfill dei prodotti esistenti dalla configurazione

- GIVEN un database con prodotti preesistenti privi di aliquota e `BusinessSettings.VatRate = 0.10` (frazione)
- WHEN viene applicata la migrazione che introduce `Prodotto.AliquotaIva`
- THEN ogni prodotto preesistente ha `AliquotaIva = 10.00` (conversione frazione → percentuale: `VatRate × 100`)
- AND nessun altro dato dei prodotti viene modificato

#### Scenario: Backfill senza riga BusinessSettings

- GIVEN un database con prodotti preesistenti e nessuna riga in `BusinessSettings`
- WHEN viene applicata la migrazione che introduce `Prodotto.AliquotaIva`
- THEN ogni prodotto preesistente ha `AliquotaIva = 22.00` (fallback)

#### Scenario: Default per nuovo prodotto

- GIVEN il sistema migrato
- WHEN viene creato un prodotto senza specificare l'aliquota
- THEN il prodotto persiste `AliquotaIva = 22.00`

### Requirement: Validazione delle aliquote ammesse

Il sistema DEVE rifiutare, nelle mutation che accettano un'aliquota prodotto, qualunque valore fuori dal set `{0, 4, 5, 10, 22}`, con un errore GraphQL esplicito che indichi i valori ammessi. La validazione DEVE usare un'unica costante centralizzata (nessuna duplicazione del set nei call site).

#### Scenario: Aliquota valida

- GIVEN il set di aliquote ammesse `{0, 4, 5, 10, 22}`
- WHEN un client invia `mutateProdotto` con `aliquotaIva: 10`
- THEN la mutation viene eseguita e il prodotto persiste `AliquotaIva = 10.00`

#### Scenario: Aliquota fuori set

- GIVEN il set di aliquote ammesse `{0, 4, 5, 10, 22}`
- WHEN un client invia `mutateProdotto` con `aliquotaIva: 7`
- THEN la mutation fallisce con un errore GraphQL esplicito che elenca le aliquote ammesse
- AND nessun prodotto viene creato o modificato

#### Scenario: Aliquota zero ammessa

- GIVEN il set di aliquote ammesse include `0`
- WHEN un client invia `mutateProdotto` con `aliquotaIva: 0`
- THEN la mutation viene eseguita e il prodotto persiste `AliquotaIva = 0.00`

### Requirement: Mutation mutateProdotto

Il sistema DEVE esporre una mutation GraphQL `mutateProdotto` (modulo Vendite) per creare o aggiornare un prodotto, inclusa l'aliquota IVA. La mutation DEVE essere protetta da autorizzazione (`.Authorize()`), DEVE applicare la validazione delle aliquote ammesse e DEVE restituire il prodotto risultante come `ProdottoType`. La gestione prodotti da interfaccia utente NON è in scope (la mutation è l'unico punto di amministrazione).

Schema GraphQL (additivo):

```graphql
type VenditeMutation {
  mutateProdotto(prodotto: ProdottoInput!): Prodotto
}

input ProdottoInput {
  prodottoId: Int        # assente/null = creazione
  codice: String!
  nome: String!
  descrizione: String
  prezzo: Decimal!
  categoria: String
  unitaDiMisura: String
  attivo: Boolean
  aliquotaIva: Decimal   # default 22 se omessa in creazione
}
```

#### Scenario: Creazione prodotto

- GIVEN un client autenticato e nessun prodotto con codice `CAFFE01`
- WHEN il client invia `mutateProdotto` con `{ codice: "CAFFE01", nome: "Caffè", prezzo: 1.20, aliquotaIva: 10 }`
- THEN viene creato un prodotto con `AliquotaIva = 10.00`
- AND la risposta contiene `prodottoId` valorizzato e `aliquotaIva: 10`

#### Scenario: Aggiornamento aliquota di un prodotto esistente

- GIVEN un prodotto esistente con `prodottoId: 5` e `AliquotaIva = 22.00`
- WHEN il client invia `mutateProdotto` con `{ prodottoId: 5, ..., aliquotaIva: 4 }`
- THEN il prodotto 5 persiste `AliquotaIva = 4.00`
- AND gli snapshot IVA delle vendite già registrate per il prodotto 5 NON vengono modificati

#### Scenario: Aggiornamento di un prodotto inesistente

- GIVEN nessun prodotto con `prodottoId: 999`
- WHEN il client invia `mutateProdotto` con `{ prodottoId: 999, ... }`
- THEN la mutation fallisce con errore esplicito "Prodotto non trovato" (o equivalente)

### Requirement: Snapshot IVA sulla vendita alla creazione

Ogni vendita creata DEVE persistere lo snapshot IVA al momento della creazione: `AliquotaIva` (percentuale, copiata dal prodotto), `Imponibile` e `ImportoIva` (`decimal(10,2)`), calcolati per scorporo dal `PrezzoTotale` (prezzi IVA inclusa) tramite `IvaCalculator.ScorporaDaLordo`. L'invariante `Imponibile + ImportoIva == PrezzoTotale` DEVE valere al centesimo per ogni riga.

#### Scenario: Creazione vendita con scorporo per riga

- GIVEN un prodotto con `Prezzo = 1.20` e `AliquotaIva = 10.00`
- WHEN un client invia `creaVendita` con `quantita: 3` (PrezzoTotale = 3.60)
- THEN la vendita persiste `AliquotaIva = 10.00`, `Imponibile = 3.27`, `ImportoIva = 0.33`
- AND `Imponibile + ImportoIva == PrezzoTotale` al centesimo

#### Scenario: Creazione vendita con aliquota zero

- GIVEN un prodotto con `AliquotaIva = 0.00`
- WHEN un client invia `creaVendita` per quel prodotto con `PrezzoTotale = 5.00`
- THEN la vendita persiste `AliquotaIva = 0.00`, `Imponibile = 5.00`, `ImportoIva = 0.00`

#### Scenario: Backfill delle vendite esistenti

- GIVEN vendite preesistenti senza snapshot IVA e prodotti già backfillati con `AliquotaIva`
- WHEN viene applicata la migrazione che introduce lo snapshot su `Vendite`
- THEN ogni vendita preesistente ha `AliquotaIva` = aliquota corrente del suo prodotto, `Imponibile = ROUND(PrezzoTotale / (1 + AliquotaIva/100), 2)` e `ImportoIva = PrezzoTotale − Imponibile`
- AND per ogni vendita backfillata vale `Imponibile + ImportoIva == PrezzoTotale` al centesimo
- AND i valori coincidono con quelli che `IvaCalculator.ScorporaDaLordo` produrrebbe per gli stessi input (nessun midpoint per le aliquote ammesse su lordi a 2 decimali)

### Requirement: Immutabilità dello snapshot IVA in aggiornamento vendita

In `aggiornaVendita`, lo snapshot `AliquotaIva` DEVE restare immutato salvo cambio prodotto: se `ProdottoId` cambia, l'aliquota snapshot DEVE essere ripresa dall'aliquota corrente del nuovo prodotto (coerentemente con la ripresa del prezzo corrente). `Imponibile` e `ImportoIva` DEVONO essere ricalcolati (con l'aliquota snapshot vigente) solo quando cambia il `PrezzoTotale` o l'aliquota snapshot, preservando l'invariante al centesimo. Un aggiornamento che non tocca né prodotto né prezzo NON DEVE alterare lo snapshot.

#### Scenario: Aggiornamento solo note

- GIVEN una vendita con snapshot `AliquotaIva = 10.00`, `Imponibile = 3.27`, `ImportoIva = 0.33`
- WHEN un client invia `aggiornaVendita` modificando solo `note`
- THEN `AliquotaIva`, `Imponibile` e `ImportoIva` restano invariati
- AND l'aliquota NON viene riletta dal prodotto (anche se nel frattempo l'aliquota del prodotto è cambiata)

#### Scenario: Aggiornamento quantità senza cambio prodotto

- GIVEN una vendita con `AliquotaIva = 10.00` snapshot e prodotto la cui aliquota corrente è nel frattempo diventata `22.00`
- WHEN un client invia `aggiornaVendita` con `quantita: 5` (il `PrezzoTotale` cambia)
- THEN `Imponibile` e `ImportoIva` vengono ricalcolati per scorporo dal nuovo `PrezzoTotale` usando l'aliquota snapshot `10.00`
- AND `AliquotaIva` resta `10.00` (immutabilità dello storico)

#### Scenario: Cambio prodotto

- GIVEN una vendita sul prodotto A (`AliquotaIva` snapshot `22.00`) e un prodotto B con aliquota corrente `4.00`
- WHEN un client invia `aggiornaVendita` con `prodottoId` = B
- THEN la vendita riprende prezzo unitario e aliquota correnti di B: `AliquotaIva = 4.00`
- AND `Imponibile` e `ImportoIva` vengono ricalcolati per scorporo dal nuovo `PrezzoTotale` con aliquota `4.00`

### Requirement: Breakdown IVA per aliquota del registro cassa

Ogni registro cassa DEVE avere un breakdown IVA per aliquota persistito nella tabella figlia `RegistroCassaIva` (`RegistroCassaId` FK cascade, `Aliquota` decimal(5,2) percentuale, `Imponibile` decimal(10,2), `Imposta` decimal(10,2), `Stimato` bool; unique `(RegistroCassaId, Aliquota, Stimato)`). Il breakdown DEVE essere composto da:

- una riga **esatta** (`Stimato = false`) per ogni aliquota presente tra le Vendite del registro, con `Imponibile = Σ Vendita.Imponibile` e `Imposta = Σ Vendita.ImportoIva` degli snapshot di riga (somma degli scorpori di riga, MAI scorporo della somma);
- al più una riga **stimata** (`Stimato = true`) per il residuo non itemizzato (vedi requirement dedicato).

Per ogni registro DEVE valere `Σ (Imponibile + Imposta) == TotaleVendite` al centesimo.

#### Scenario: Registro con vendite ad aliquote miste

- GIVEN un registro con `TotaleVendite = 100.00` e vendite itemizzate: 36.60 con aliquota 22 (`Imponibile 30.00`, `ImportoIva 6.60`) e 22.00 con aliquota 10 (`Imponibile 20.00`, `ImportoIva 2.00`)
- WHEN il registro viene salvato e i totali ricalcolati
- THEN il breakdown contiene una riga `(22.00, 30.00, 6.60, stimato: false)` e una riga `(10.00, 20.00, 2.00, stimato: false)`
- AND una riga stimata per il residuo `100.00 − 58.60 = 41.40` scorporato all'aliquota di default
- AND `Σ (imponibile + imposta)` di tutte le righe `== 100.00` al centesimo

#### Scenario: Vendite ad aliquota zero

- GIVEN un registro con una vendita di `PrezzoTotale = 5.00` e snapshot `AliquotaIva = 0.00`
- WHEN i totali vengono ricalcolati
- THEN il breakdown contiene la riga `(0.00, 5.00, 0.00, stimato: false)`

#### Scenario: Coerenza al centesimo tra dettaglio e breakdown

- GIVEN un registro con più vendite alla stessa aliquota i cui scorpori di riga, sommati, divergono di un centesimo dallo scorporo del totale
- WHEN i totali vengono ricalcolati
- THEN la riga esatta dell'aliquota riporta la SOMMA degli `Imponibile`/`ImportoIva` di riga (non lo scorporo della somma)
- AND `imponibile + imposta` della riga `== Σ PrezzoTotale` delle vendite di quell'aliquota al centesimo

### Requirement: Residuo non itemizzato stimato all'aliquota di default

Il residuo `TotaleVendite − Σ Vendita.PrezzoTotale` rappresenta i canali dichiarati manualmente (incassi elettronici, contante tracciato, fatture) non legati a vendite. Se il residuo è positivo, il sistema DEVE generare una sola riga di breakdown scorporata all'aliquota di default (`BusinessSettings.VatRate`, frazione, convertita in percentuale per la persistenza) con `Stimato = true`. Se il residuo è zero, NON DEVE esistere alcuna riga stimata. Se il residuo è negativo (dati storici incoerenti), il sistema DEVE fare clamp a 0 e registrare un log di warning con gli importi coinvolti; il salvataggio del registro NON DEVE MAI essere bloccato per questo motivo.

#### Scenario: Registro senza vendite itemizzate (flusso operativo attuale)

- GIVEN un registro senza alcuna Vendita, con `TotaleVendite = 80.00` e `VatRate = 0.10`
- WHEN i totali vengono ricalcolati
- THEN il breakdown contiene un'unica riga stimata `(10.00, 72.73, 7.27, stimato: true)` (scorporo di 80.00 al 10%)
- AND `ImportoIva` del registro coincide al centesimo con il valore che il calcolo single-rate pre-change avrebbe prodotto

#### Scenario: Registro interamente itemizzato

- GIVEN un registro in cui `Σ Vendita.PrezzoTotale == TotaleVendite`
- WHEN i totali vengono ricalcolati
- THEN il breakdown contiene solo righe esatte (`stimato: false`)
- AND nessuna riga stimata viene creata

#### Scenario: Residuo negativo da dati storici incoerenti

- GIVEN un registro storico con `TotaleVendite = 50.00` e vendite persistite per `Σ PrezzoTotale = 60.00`
- WHEN i totali vengono ricalcolati
- THEN il residuo viene portato a 0 (clamp): nessuna riga stimata viene creata
- AND viene emesso un log di warning che riporta registro, totale e somma vendite
- AND il salvataggio del registro completa con successo (nessuna eccezione)

### Requirement: ImportoIva come somma del breakdown (retrocompatibilità)

`RegistroCassa.ImportoIva` DEVE essere valorizzato come `Σ Imposta` delle righe del breakdown (esatte + stimata), non ricalcolato indipendentemente. Per i registri senza vendite itemizzate il valore DEVE coincidere al centesimo con il calcolo single-rate pre-change. La chiusura mensile (`TotaleIvaCalcolato`) e il riepilogo annuale, che aggregano `ImportoIva`, NON DEVONO richiedere modifiche e DEVONO restituire valori invariati per i dati esistenti.

#### Scenario: Equivalenza con il calcolo pre-change

- GIVEN un registro senza vendite itemizzate con `TotaleVendite = 123.45` e `VatRate = 0.10`
- WHEN i totali vengono ricalcolati dopo la change
- THEN `ImportoIva == IvaCalculator.ScorporaDaLordo(123.45, 0.10).Iva` (identico al valore pre-change)

#### Scenario: Chiusura mensile invariata

- GIVEN un mese con registri il cui `ImportoIva` è la somma dei rispettivi breakdown
- WHEN viene calcolato `TotaleIvaCalcolato` della chiusura mensile
- THEN il valore è `Σ ImportoIva` dei registri del mese, identico nella semantica e nei valori pre-change per i dati esistenti

### Requirement: Rigenerazione del breakdown a ogni ricalcolo dei totali

Il breakdown DEVE essere rigenerato integralmente (delete + reinsert delle righe figlie, come per conteggi e spese) a ogni esecuzione del ricalcolo totali del registro: salvataggio del registro (`mutateRegistroCassa`) e mutation vendite che alterano i totali (`creaVendita`, `aggiornaVendita`, `eliminaVendita`). La rigenerazione DEVE essere idempotente: ricalcoli ripetuti sugli stessi dati DEVONO produrre lo stesso insieme di righe, senza duplicati (garantito anche dal vincolo unique `(RegistroCassaId, Aliquota, Stimato)`).

#### Scenario: Risalvataggio idempotente

- GIVEN un registro già salvato con un breakdown di N righe
- WHEN il registro viene risalvato senza alcuna modifica ai dati
- THEN il breakdown risultante contiene esattamente le stesse N righe (stessi valori di aliquota, imponibile, imposta, stimato)
- AND non esistono righe duplicate per la stessa coppia `(aliquota, stimato)`

#### Scenario: Ricalcolo su eliminazione vendita

- GIVEN un registro con breakdown comprendente una riga esatta all'aliquota 10
- WHEN l'unica vendita ad aliquota 10 viene eliminata con `eliminaVendita`
- THEN il breakdown rigenerato non contiene più la riga esatta all'aliquota 10
- AND `ImportoIva` e i totali del registro riflettono il nuovo stato

### Requirement: Normalizzazione di VenditeContanti nel ricalcolo totali

Nel ricalcolo dei totali del registro, `VenditeContanti` DEVE essere ricalcolato come `Σ PrezzoTotale` delle Vendite persistite del registro, invece di essere azzerato (comportamento precedente: `VenditeContanti = 0` ad ogni salvataggio, che perdeva il totale itemizzato e renderebbe negativo il residuo). Per i registri senza vendite il valore risultante DEVE essere 0, identico al comportamento precedente.

#### Scenario: Registro con vendite risalvato

- GIVEN un registro con vendite persistite per `Σ PrezzoTotale = 60.00`
- WHEN il registro viene risalvato con `mutateRegistroCassa`
- THEN `VenditeContanti == 60.00` (non azzerato)
- AND `TotaleVendite == VenditeContanti + IncassiElettronici + IncassoContanteTracciato + IncassiFattura`
- AND il residuo del breakdown è `TotaleVendite − 60.00` (mai negativo a regime)

#### Scenario: Registro senza vendite (comportamento invariato)

- GIVEN un registro senza alcuna Vendita
- WHEN il registro viene risalvato
- THEN `VenditeContanti == 0` e tutti i totali coincidono con il comportamento pre-change

### Requirement: Backfill dei registri storici

La migrazione che introduce `RegistroCassaIva` DEVE backfillare ogni registro esistente con una sola riga: `Aliquota = VatRate × 100` (fallback `22.00` senza riga settings), `Imposta = ImportoIva` esistente, `Imponibile = TotaleVendite − ImportoIva`, `Stimato = true`. Il backfill NON DEVE modificare alcun valore esistente del registro (`ImportoIva` preservato bit a bit) e NON DEVE tentare di ricostruire la parte esatta dalle vendite storiche (decisione vincolante: tutto `stimato = true`; il raffinamento avviene al primo ricalcolo naturale).

#### Scenario: Backfill registro storico

- GIVEN un registro pre-change con `TotaleVendite = 100.00` e `ImportoIva = 9.09`
- WHEN viene applicata la migrazione `RegistroCassaIva`
- THEN il registro ha una sola riga di breakdown `(aliquota default, 90.91, 9.09, stimato: true)`
- AND `ImportoIva` del registro resta `9.09` (nessuna riscrittura)

#### Scenario: Registro storico con vendite itemizzate

- GIVEN un registro pre-change che possiede Vendite (già backfillate con snapshot IVA)
- WHEN viene applicata la migrazione `RegistroCassaIva`
- THEN anche questo registro riceve la sola riga stimata aggregata (nessuna ricostruzione esatta in migrazione)
- AND al primo risalvataggio del registro il breakdown viene rigenerato con le righe esatte dalle vendite

#### Scenario: Rollback della migrazione

- GIVEN le tre migrazioni della change applicate
- WHEN si esegue `dotnet ef database update <migrazione-precedente>` a ritroso
- THEN colonne e tabella nuove vengono rimosse senza alterare i dati preesistenti
- AND il calcolo single-rate pre-change torna a produrre gli stessi valori di prima

### Requirement: Esposizione GraphQL additiva del dato IVA

Lo schema GraphQL DEVE esporre il nuovo dato IVA esclusivamente con campi additivi; nessun campo esistente DEVE essere rinominato, rimosso o cambiato di tipo. Le query e i fragment esistenti DEVONO continuare a funzionare senza modifiche.

Schema (additivo):

```graphql
type Prodotto {
  aliquotaIva: Decimal!      # percentuale
}

type Vendita {
  aliquotaIva: Decimal!      # snapshot, percentuale
  imponibile: Decimal!
  importoIva: Decimal!
}

type RegistroCassa {
  breakdownIva: [RegistroCassaIva]   # risolto con DataLoader batch per registroCassaId
}

type RegistroCassaIva {
  aliquota: Decimal!
  imponibile: Decimal!
  imposta: Decimal!
  stimato: Boolean!
}
```

#### Scenario: Query del breakdown sul registro

- GIVEN un registro salvato con breakdown a più aliquote
- WHEN un client interroga `registroCassa { importoIva breakdownIva { aliquota imponibile imposta stimato } }`
- THEN la risposta contiene la lista delle righe di breakdown
- AND `Σ imposta` delle righe `== importoIva`

#### Scenario: Caricamento batch del breakdown su lista registri

- GIVEN una query di lista che richiede `breakdownIva` per N registri
- WHEN la query viene risolta
- THEN le righe di breakdown sono caricate con un DataLoader batch per `registroCassaId` (pattern dei figli esistenti del registro), senza una query per registro

#### Scenario: Query e fragment esistenti invariati

- GIVEN i fragment frontend esistenti (`RegistroCassaFragment` senza `breakdownIva`, query prodotti/vendite correnti)
- WHEN vengono eseguiti contro lo schema aggiornato
- THEN eseguono senza errori e con gli stessi risultati semantici di prima

### Requirement: Eventi subscription invariati

I payload degli eventi di subscription esistenti (`RegistroCassaUpdatedEvent`, `VenditaCreatedEvent`) NON DEVONO essere estesi con dati IVA in questa change (decisione vincolante): il client ottiene il breakdown tramite refetch.

#### Scenario: Evento dopo salvataggio registro

- GIVEN un client sottoscritto agli aggiornamenti del registro cassa
- WHEN un registro con breakdown multialiquota viene salvato
- THEN l'evento pubblicato contiene esattamente i campi odierni (nessun campo IVA aggiunto)

### Requirement: Visualizzazione del breakdown IVA nel dettaglio registro (frontend)

Il dettaglio del registro cassa (`RegistroCassaDetails`) DEVE mostrare il breakdown IVA del registro come elenco/tabella con colonne aliquota, imponibile e imposta. Le righe stimate (`stimato = true`) DEVONO essere visivamente distinte dalle righe esatte (es. badge/etichetta "stimato"), per non presentare la stima come dato fiscale esatto. Il tipo `RegistroCassa` frontend e il fragment del registro DEVONO includere `breakdownIva`.

#### Scenario: Dettaglio registro con breakdown misto

- GIVEN un registro con due righe esatte (22%, 10%) e una riga stimata all'aliquota di default
- WHEN l'utente apre il dettaglio del registro
- THEN vede una tabella con tre righe: aliquota, imponibile, imposta
- AND la riga stimata è marcata visivamente come "stimato"
- AND le righe esatte non riportano alcuna marcatura di stima

#### Scenario: Dettaglio registro storico (tutto stimato)

- GIVEN un registro storico backfillato con la sola riga stimata aggregata
- WHEN l'utente apre il dettaglio del registro
- THEN vede un'unica riga di breakdown marcata "stimato"

#### Scenario: Test e controlli statici frontend

- GIVEN i mock dei test GraphQL aggiornati con `breakdownIva`
- WHEN si eseguono `npm run ts:check`, `npm run lint` e `npm run test`
- THEN tutti i controlli passano senza errori
