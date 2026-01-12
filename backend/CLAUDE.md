# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DuedGusto is a .NET 8.0 ASP.NET Core backend for a cash management and point-of-sale system. It uses GraphQL as its primary API, with REST endpoints for authentication. The architecture combines Entity Framework Core (MySQL 8.0+), JWT authentication, CSRF protection, and role-based access control.

## Build and Development Commands

### Prerequisites

- .NET 8.0 SDK
- MySQL 8.0+ (connection string: `server=localhost;database=duedgusto;user=root;password=root`)

### Build and Run

```bash
# Build the project
dotnet build

# Run the application (starts on https://localhost:5001 and http://localhost:5000)
dotnet run

# Build release version
dotnet build --configuration Release
```

### Database Setup

**Automatic Migration on Startup** ✅
The application automatically applies all pending migrations when the project starts. No manual migration commands are needed - simply run:

```bash
dotnet run
```

The `Program.cs` includes `await dbContext.Database.MigrateAsync()` which executes all pending migrations before seeding data. This ensures the database schema is always in sync, even on first deployment to a new machine.

**Manual Migration Commands** (if needed):

```bash
# Create a new migration after model changes
dotnet ef migrations add <MigrationName>

# Revert to previous migration (manual only)
dotnet ef database update <PreviousMigrationName>
```

### Code Organization

The codebase follows a layered architecture pattern with no unit test projects present.

## High-Level Architecture

### Layered Structure

**Controllers** (`/Controllers`)

- REST API endpoints for authentication only
- `AuthController`: login, token refresh, get current user, logout
- Returns JWT access token and sets httpOnly refresh token cookie

**GraphQL** (`/GraphQL`) - Primary API Layer

- GraphQL.NET implementation (using GraphQL.Types)
- Organized into feature modules: Authentication, Sales, Cash Management, Connection
- Root schema composition in `GraphQLSchema.cs` with `GraphQLQueries.cs` and `GraphQLMutations.cs`
- Relay-style cursor pagination for cash register queries
- Field-level authorization via `.Authorize()` attribute
- Service injection via context in resolvers: `AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context)`

**Models** (`/Models`)

- Domain entities: User, Role, Menu, Product, Sale, CashRegister, CashDenomination, CashCount
- Many-to-many relationship: Role ↔ Menu (navigated via RoleMenu)
- Cash Register workflow: DRAFT → CLOSED → RECONCILED
- Sales automatically update CashRegister totals upon creation/deletion

**DataAccess** (`/DataAccess`)

- `AppDbContext`: EF Core DbContext with MySQL provider
- Configuration in `OnModelCreating()`: UTF8MB4 charset, decimal(10,2) for currency, cascade/restrict delete policies
- Key indexes: Product.Code (unique), Sales.RegisterId, Sales.Timestamp
- Lazy loading disabled; explicit `Include()` required for navigation properties

**Services** (`/Services`)

- **Jwt**: Token generation/validation, refresh token handling, claim extraction
- **Csrf**: Double-submit cookie pattern (stateless, rotated on login/refresh)
- **HashPassword**: HMACSHA256 password hashing with salt
- **GraphQL**: Service locator helper for accessing services in resolvers

**Middleware** (`/Middleware`)

- `CsrfProtectionMiddleware`: Validates CSRF tokens on state-changing requests (POST, PUT, DELETE, PATCH)
  - Exempts `/api/auth/signin` and `/graphql`
  - Returns 403 Forbidden on validation failure

**Helpers** (`/Helpers`)

- `EntityFrameworkHelper.UpsertEntityGraphAsync()`: Deep merge/upsert with navigation property synchronization
- Handles bulk operations: add, update, delete, with primary key comparison

**SeedData** (`/SeedData`)

- Runs on app startup via Program.cs
- Seeds: superadmin user, menu navigation, cash denominations, sample products

### Key Configuration Files

**Program.cs**

- Registers all services: JWT (singleton), CSRF (scoped), Password, DbContext
- Configures GraphQL with Relay types, authorization rules, user context builder
- Sets up CORS (AllowAllDev: any origin, credentials enabled)
- Middleware pipeline: HTTPS → CORS → Authentication → Authorization → CSRF → GraphQL
- Database seeding on app startup

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

- Target: .NET 8.0, nullable reference types enabled
- Key NuGet packages: GraphQL 8.4.1, EF Core 8.0.13, Pomelo.EntityFrameworkCore.MySql, JwtBearer, ClosedXML (Excel export)

## Authentication and Security

### JWT Flow

1. Client POSTs `/api/auth/signin` with username/password
2. Server verifies credentials via `PasswordService` (HMACSHA256 with salt)
3. `JwtHelper` generates signed JWT (5-minute expiration) and refresh token (32-byte random)
4. Refresh token stored in `User.RefreshToken` DB field
5. CSRF token generated in non-httpOnly cookie
6. Response contains only access token; refresh token in httpOnly cookie

### Token Validation

- JWT: Validates signature, issuer, audience, expiration (6-second clock skew tolerance)
- Refresh token: Validated on `/api/auth/refresh` endpoint

### CSRF Protection

- Double-submit cookie pattern (no server-side storage)
- Token in non-httpOnly `csrfToken` cookie (readable by JavaScript)
- Client includes token in `X-CSRF-Token` header
- Middleware validates header token matches cookie token
- Token rotated on every login/refresh call

### Cookie Security Settings

- **CSRF Token**: HttpOnly=false, Secure=true, SameSite=Strict, MaxAge=7 days
- **Refresh Token**: HttpOnly=true, Secure=true, SameSite=Strict, Path=/api/auth, MaxAge=7 days

### Authorization in GraphQL

- Fields use `.Authorize()` attribute for declarative auth
- Protected fields: `currentUser` query, most mutations
- Authenticated user accessible via `GraphQLUserContext` in resolver context

## GraphQL API Structure

### Root Query

- **currentUser**: Authenticated user with roles and menu permissions
- **cashRegister(registerId)**: Single daily register with details
- **cashRegistersConnection**: Relay-paginated registers with KPIs (cursor=RegisterId)
- **dashboardKPIs**: Daily/weekly/monthly sales analytics
- **denominations**: Cash denominations (coins/banknotes)

### Root Mutation

- **signIn(username, password)**: Returns access token + refresh token
- **mutateCashRegister(cashRegister)**: Create/update register with opening/closing counts
- **closeCashRegister(registerId)**: Transition register to CLOSED status
- **deleteCashRegister(registerId)**: Delete DRAFT registers only
- **mutateRole(role, menuIds)**: Create/update role with menu permissions
- **mutateUser(user)**: Create/update user

### Type Safety

- Input types: CreateSaleInputType, UpdateSaleInputType, CashRegisterInputType
- Output types: User, Role, Product, Sale, CashRegister, CashDenomination, CashCount, TokenResponse
- Relay types: CashRegisterConnection, CashPageInfo (for cursor pagination)

## Database Schema and Entities

### Core Entities

- **User**: username, password (hash+salt), firstName, lastName, role, refreshToken
- **Role**: name, description, many-to-many with Menu via RoleMenu join table
- **Menu**: title, path, icon, parent-child hierarchy, role permissions
- **Product**: code, name, price, category, unit, isActive
- **Sale**: product, register, quantity, unitPrice, total, timestamp (indexes: RegisterId, Timestamp)
- **CashRegister**: opening/closing counts by denomination, sales total, expenses, VAT, status (DRAFT/CLOSED/RECONCILED)
- **CashDenomination**: coin/banknote values with display order
- **CashCount**: physical count of denominations (opening/closing per register)

### Key Constraints

- Decimal(10,2) for all currency fields (max: 99,999,999.99)
- UTF8MB4 charset with unicode_ci collation (international character support)
- Foreign key cascade delete policies: User→Role, CashCount→CashRegister
- Foreign key restrict delete: Sale→Product, CashCount→CashDenomination
- Product.Code has unique index for fast lookups

## Service Dependencies and Scopes

| Service            | Scope                | Key Methods                                              |
| ------------------ | -------------------- | -------------------------------------------------------- |
| JwtHelper          | Singleton            | GenerateToken(), ValidateToken(), GenerateRefreshToken() |
| CsrfTokenGenerator | Scoped               | GenerateToken(), ValidateToken()                         |
| PasswordService    | Transient            | HashPassword(), VerifyPassword()                         |
| AppDbContext       | Scoped (per-request) | SaveChangesAsync(), DbSets for all entities              |
| GraphQLService     | Helper               | GetService<T>() for accessing services in resolvers      |

## Common Development Tasks

### Adding a New GraphQL Mutation

1. Create input type in appropriate module (e.g., `/GraphQL/CashManagement`)
2. Add resolver method to mutations class (e.g., `CashManagementMutations`)
3. Extract DbContext and services via `GraphQLService.GetService<T>()`
4. Call `dbContext.SaveChangesAsync()` to persist changes
5. Return mapped entity as output type
6. Example pattern in `CashManagementMutations.mutateCashRegister()`

### Adding a New Model and Entity

1. Create model class in `/Models` with properties matching database requirements
2. Add DbSet<ModelName> to `AppDbContext`
3. Configure in `OnModelCreating()`: primary key, relationships, indexes, constraints
4. Create migration: `dotnet ef migrations add AddModelName`
5. Apply: `dotnet ef database update`

### Querying with EF Core

- Always use `.AsAsyncEnumerable()` or `.ToListAsync()` for async queries
- Use `.Include()` for navigation properties (lazy loading disabled)
- Use `.Where()` filtering before `.ToListAsync()` for performance
- Example: `await dbContext.Products.Where(p => p.IsActive).ToListAsync()`

### Password Management

- Hash on user creation: `PasswordService.HashPassword(plaintext)` returns (hash, salt)
- Verify on login: `PasswordService.VerifyPassword(plaintext, storedHash, storedSalt)`

### CSRF Token Management

- Generate on login: `CsrfTokenGenerator.GenerateToken(context)` (HttpContext available)
- Validate in middleware: Automatic via `CsrfProtectionMiddleware`
- Rotate on refresh: Automatic via `CsrfTokenGenerator.RotateToken(context)`

## Important Notes

- **No test projects**: This codebase has no unit tests; manual testing or integration tests would need to be added
- **Service location in GraphQL**: Resolvers use `GraphQLService.GetService<T>(context)` instead of constructor injection; this is intentional for GraphQL type activation
- **Stateless CSRF**: CSRF tokens are not stored server-side; validation is token-in-header matches token-in-cookie
- **Role-based navigation**: Menus are fetched for authenticated user via role relationships; use Role.Menus to populate navigation
- **Cash register workflow**: Creating a CashRegister with opening/closing counts persists CashCount entities; closing transitions status to CLOSED; reconciliation is manual via subsequent mutations
- **Database character encoding**: All tables use UTF8MB4 for international character support; ensure MySQL server has UTF8MB4 available
