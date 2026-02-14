# CLAUDE.md

Questo file fornisce indicazioni a Claude Code (claude.ai/code) quando lavora con il codice in questo repository.

## Panoramica del Progetto

DuedGusto è un backend .NET 8.0 ASP.NET Core per un sistema di gestione cassa e punto vendita. Utilizza GraphQL come API principale, con endpoint REST per l'autenticazione. L'architettura combina Entity Framework Core (MySQL 8.0+), autenticazione JWT, protezione CSRF e controllo degli accessi basato sui ruoli.

## Comandi di Build e Sviluppo

### Prerequisiti

- .NET 8.0 SDK
- MySQL 8.0+ (stringa di connessione: `server=localhost;database=duedgusto;user=root;password=root`)

### Build e Avvio

```bash
# Build del progetto
dotnet build

# Avvio dell'applicazione (si avvia su https://localhost:5001 e http://localhost:5000)
dotnet run

# Build versione release
dotnet build --configuration Release
```

### Setup del Database

**Migrazione Automatica all'Avvio** ✅
L'applicazione applica automaticamente tutte le migrazioni in sospeso quando il progetto si avvia. Non sono necessari comandi manuali di migrazione - basta eseguire:

```bash
dotnet run
```

Il `Program.cs` include `await dbContext.Database.MigrateAsync()` che esegue tutte le migrazioni in sospeso prima del seeding dei dati. Questo assicura che lo schema del database sia sempre sincronizzato, anche al primo deploy su una nuova macchina.

**Comandi di Migrazione Manuali** (se necessario):

```bash
# Creare una nuova migrazione dopo modifiche ai modelli
dotnet ef migrations add <NomeMigrazione>

# Ripristinare alla migrazione precedente (solo manuale)
dotnet ef database update <NomeMigrazionePrecedente>
```

### Organizzazione del Codice

Il codebase segue un pattern di architettura a livelli senza progetti di test unitari.

## Architettura di Alto Livello

### Struttura a Livelli

**Controllers** (`/Controllers`)

- Endpoint API REST solo per l'autenticazione
- `AuthController`: login, refresh token, get utente corrente, logout
- Restituisce JWT access token e imposta cookie httpOnly per il refresh token

**GraphQL** (`/GraphQL`) - Livello API Principale

- Implementazione GraphQL.NET (usando GraphQL.Types)
- Organizzato in moduli per funzionalità: Authentication, Sales, Cash Management, Connection
- Composizione dello schema root in `GraphQLSchema.cs` con `GraphQLQueries.cs` e `GraphQLMutations.cs`
- Paginazione cursor stile Relay per le query dei registri di cassa
- Autorizzazione a livello di campo tramite attributo `.Authorize()`
- Iniezione dei servizi tramite context nei resolver: `AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context)`

**Models** (`/Models`)

- Entità di dominio: User, Role, Menu, Product, Sale, CashRegister, CashDenomination, CashCount
- Relazione many-to-many: Role ↔ Menu (navigata tramite RoleMenu)
- Workflow Registro di Cassa: DRAFT → CLOSED → RECONCILED
- Le vendite aggiornano automaticamente i totali del CashRegister alla creazione/eliminazione

**DataAccess** (`/DataAccess`)

- `AppDbContext`: DbContext EF Core con provider MySQL
- Configurazione in `OnModelCreating()`: charset UTF8MB4, decimal(10,2) per valute, policy di eliminazione cascade/restrict
- Indici chiave: Product.Code (unique), Sales.RegisterId, Sales.Timestamp
- Lazy loading disabilitato; richiesto `Include()` esplicito per proprietà di navigazione

**Services** (`/Services`)

- **Jwt**: Generazione/validazione token, gestione refresh token, estrazione claim
- **Csrf**: Pattern double-submit cookie (stateless, ruotato al login/refresh)
- **HashPassword**: Hashing password HMACSHA256 con salt
- **GraphQL**: Helper service locator per accedere ai servizi nei resolver

**Middleware** (`/Middleware`)

- `CsrfProtectionMiddleware`: Valida i token CSRF sulle richieste che modificano lo stato (POST, PUT, DELETE, PATCH)
  - Esclude `/api/auth/signin` e `/graphql`
  - Restituisce 403 Forbidden in caso di fallimento della validazione

**Helpers** (`/Helpers`)

- `EntityFrameworkHelper.UpsertEntityGraphAsync()`: Deep merge/upsert con sincronizzazione delle proprietà di navigazione
- Gestisce operazioni bulk: add, update, delete, con confronto delle chiavi primarie

**SeedData** (`/SeedData`)

- Eseguito all'avvio dell'app tramite Program.cs
- Inizializza: utente superadmin, navigazione menu, denominazioni di cassa, prodotti di esempio

### File di Configurazione Chiave

**Program.cs**

- Registra tutti i servizi: JWT (singleton), CSRF (scoped), Password, DbContext
- Configura GraphQL con tipi Relay, regole di autorizzazione, user context builder
- Imposta CORS (AllowAllDev: qualsiasi origine, credenziali abilitate)
- Pipeline middleware: HTTPS → CORS → Authentication → Authorization → CSRF → GraphQL
- Seeding del database all'avvio dell'app

**appsettings.json**

```json
{
  "ConnectionStrings": {
    "Default": "server=localhost;database=duedgusto;user=root;password=root"
  },
  "Jwt": {
    "Key": "====*-o-*-dued-json-web-key-*-o-*====",
    "Issuer": "duedgusto-api",
    "Audience": "duedgusto-clients"
  }
}
```

**duedgusto.csproj**

- Target: .NET 8.0, nullable reference types abilitati
- Pacchetti NuGet chiave: GraphQL 8.4.1, EF Core 8.0.13, Pomelo.EntityFrameworkCore.MySql, JwtBearer, ClosedXML (export Excel)

## Autenticazione e Sicurezza

### Flusso JWT

1. Il client invia POST a `/api/auth/signin` con username/password
2. Il server verifica le credenziali tramite `PasswordService` (HMACSHA256 con salt)
3. `JwtHelper` genera JWT firmato (scadenza 5 minuti) e refresh token (32-byte random)
4. Refresh token memorizzato nel campo `User.RefreshToken` nel DB
5. Token CSRF generato in cookie non-httpOnly
6. La risposta contiene solo l'access token; refresh token in cookie httpOnly

### Validazione Token

- JWT: Valida firma, issuer, audience, scadenza (tolleranza clock skew di 6 secondi)
- Refresh token: Validato sull'endpoint `/api/auth/refresh`

### Protezione CSRF

- Pattern double-submit cookie (nessuno storage lato server)
- Token in cookie non-httpOnly `csrfToken` (leggibile da JavaScript)
- Il client include il token nell'header `X-CSRF-Token`
- Il middleware valida che il token dell'header corrisponda al token del cookie
- Token ruotato ad ogni chiamata di login/refresh

### Impostazioni di Sicurezza dei Cookie

- **Token CSRF**: HttpOnly=false, Secure=true, SameSite=Strict, MaxAge=7 giorni
- **Refresh Token**: HttpOnly=true, Secure=true, SameSite=Strict, Path=/api/auth, MaxAge=7 giorni

### Autorizzazione in GraphQL

- I campi usano l'attributo `.Authorize()` per auth dichiarativa
- Campi protetti: query `currentUser`, la maggior parte delle mutation
- Utente autenticato accessibile tramite `GraphQLUserContext` nel context del resolver

## Struttura API GraphQL

### Query Root

- **currentUser**: Utente autenticato con ruoli e permessi menu
- **cashRegister(registerId)**: Singolo registro giornaliero con dettagli
- **cashRegistersConnection**: Registri paginati stile Relay con KPI (cursor=RegisterId)
- **dashboardKPIs**: Analytics vendite giornaliere/settimanali/mensili
- **denominations**: Denominazioni di cassa (monete/banconote)

### Mutation Root

- **signIn(username, password)**: Restituisce access token + refresh token
- **mutateCashRegister(cashRegister)**: Crea/aggiorna registro con conteggi apertura/chiusura
- **closeCashRegister(registerId)**: Transizione del registro allo stato CLOSED
- **deleteCashRegister(registerId)**: Elimina solo registri in stato DRAFT
- **mutateRole(role, menuIds)**: Crea/aggiorna ruolo con permessi menu
- **mutateUser(user)**: Crea/aggiorna utente

### Type Safety

- Tipi input: CreateSaleInputType, UpdateSaleInputType, CashRegisterInputType
- Tipi output: User, Role, Product, Sale, CashRegister, CashDenomination, CashCount, TokenResponse
- Tipi Relay: CashRegisterConnection, CashPageInfo (per paginazione cursor)

## Schema Database ed Entità

### Entità Core

- **User**: username, password (hash+salt), firstName, lastName, role, refreshToken
- **Role**: name, description, many-to-many con Menu tramite tabella join RoleMenu
- **Menu**: title, path, icon, gerarchia parent-child, permessi ruolo
- **Product**: code, name, price, category, unit, isActive
- **Sale**: product, register, quantity, unitPrice, total, timestamp (indici: RegisterId, Timestamp)
- **CashRegister**: conteggi apertura/chiusura per denominazione, totale vendite, spese, IVA, status (DRAFT/CLOSED/RECONCILED)
- **CashDenomination**: valori monete/banconote con ordine di visualizzazione
- **CashCount**: conteggio fisico delle denominazioni (apertura/chiusura per registro)

### Vincoli Chiave

- Decimal(10,2) per tutti i campi valuta (max: 99.999.999,99)
- Charset UTF8MB4 con collation unicode_ci (supporto caratteri internazionali)
- Policy eliminazione cascade con foreign key: User→Role, CashCount→CashRegister
- Policy eliminazione restrict con foreign key: Sale→Product, CashCount→CashDenomination
- Product.Code ha indice unique per lookup veloci

## Dipendenze dei Servizi e Scope

| Servizio           | Scope                | Metodi Chiave                                            |
| ------------------ | -------------------- | -------------------------------------------------------- |
| JwtHelper          | Singleton            | GenerateToken(), ValidateToken(), GenerateRefreshToken() |
| CsrfTokenGenerator | Scoped               | GenerateToken(), ValidateToken()                         |
| PasswordService    | Transient            | HashPassword(), VerifyPassword()                         |
| AppDbContext       | Scoped (per-request) | SaveChangesAsync(), DbSets per tutte le entità           |
| GraphQLService     | Helper               | GetService<T>() per accedere ai servizi nei resolver     |

## Operazioni di Sviluppo Comuni

### Aggiungere una Nuova Mutation GraphQL

1. Creare il tipo input nel modulo appropriato (es. `/GraphQL/CashManagement`)
2. Aggiungere metodo resolver alla classe mutations (es. `CashManagementMutations`)
3. Estrarre DbContext e servizi tramite `GraphQLService.GetService<T>()`
4. Chiamare `dbContext.SaveChangesAsync()` per persistere le modifiche
5. Restituire l'entità mappata come tipo output
6. Pattern di esempio in `CashManagementMutations.mutateCashRegister()`

### Aggiungere un Nuovo Modello ed Entità

1. Creare la classe modello in `/Models` con proprietà corrispondenti ai requisiti del database
2. Aggiungere DbSet<NomeModello> a `AppDbContext`
3. Configurare in `OnModelCreating()`: chiave primaria, relazioni, indici, vincoli
4. Creare migrazione: `dotnet ef migrations add AddNomeModello`
5. Applicare: `dotnet ef database update`

### Query con EF Core

- Usare sempre `.AsAsyncEnumerable()` o `.ToListAsync()` per query async
- Usare `.Include()` per proprietà di navigazione (lazy loading disabilitato)
- Usare filtri `.Where()` prima di `.ToListAsync()` per le performance
- Esempio: `await dbContext.Products.Where(p => p.IsActive).ToListAsync()`

### Gestione Password

- Hash alla creazione utente: `PasswordService.HashPassword(plaintext)` restituisce (hash, salt)
- Verifica al login: `PasswordService.VerifyPassword(plaintext, storedHash, storedSalt)`

### Gestione Token CSRF

- Generare al login: `CsrfTokenGenerator.GenerateToken(context)` (HttpContext disponibile)
- Validare nel middleware: Automatico tramite `CsrfProtectionMiddleware`
- Ruotare al refresh: Automatico tramite `CsrfTokenGenerator.RotateToken(context)`

## Note Importanti

- **Nessun progetto di test**: Questo codebase non ha test unitari; test manuali o test di integrazione dovrebbero essere aggiunti
- **Service location in GraphQL**: I resolver usano `GraphQLService.GetService<T>(context)` invece dell'iniezione nel costruttore; questo è intenzionale per l'attivazione dei tipi GraphQL
- **Navigazione basata sui ruoli**: I menu vengono recuperati per l'utente autenticato tramite le relazioni dei ruoli; usare Role.Menus per popolare la navigazione
- **Workflow registro di cassa**: Creare un CashRegister con conteggi apertura/chiusura persiste le entità CashCount; la chiusura transiziona lo stato a CLOSED; la riconciliazione è manuale tramite mutation successive
- **Encoding caratteri database**: Tutte le tabelle usano UTF8MB4 per supporto caratteri internazionali; assicurarsi che il server MySQL abbia UTF8MB4 disponibile
