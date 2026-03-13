# Technical Design: TDD Test Coverage

## 1. Backend Test Infrastructure

### 1.1 Project Structure

Creare un nuovo progetto xUnit sotto `backend/DuedGusto.Tests/`:

```
backend/
├── duedgusto.sln                 # Aggiungere riferimento al test project
├── duedgusto.csproj              # Progetto principale (invariato)
└── DuedGusto.Tests/
    ├── DuedGusto.Tests.csproj
    ├── GlobalUsings.cs
    ├── Helpers/
    │   ├── TestDbContextFactory.cs
    │   ├── JwtTestHelper.cs
    │   ├── MockHttpContextFactory.cs
    │   └── TestFixtures.cs
    ├── Unit/
    │   ├── Services/
    │   │   ├── JwtHelperTests.cs
    │   │   ├── PasswordServiceTests.cs
    │   │   └── ChiusuraMensileServiceTests.cs
    │   ├── Controllers/
    │   │   └── AuthControllerTests.cs
    │   └── Middleware/
    │       └── AuthRateLimitMiddlewareTests.cs
    └── Integration/
        ├── GraphQL/
        │   ├── AuthMutationsTests.cs
        │   ├── CashManagementMutationsTests.cs
        │   └── CashManagementQueriesTests.cs
        └── Controllers/
            └── AuthControllerIntegrationTests.cs
```

### 1.2 Project File (`DuedGusto.Tests.csproj`)

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.12.0" />
    <PackageReference Include="xunit" Version="2.9.3" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2" />
    <PackageReference Include="Moq" Version="4.20.72" />
    <PackageReference Include="FluentAssertions" Version="7.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="8.0.13" />
    <PackageReference Include="coverlet.collector" Version="6.0.4" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\duedgusto.csproj" />
  </ItemGroup>
</Project>
```

### 1.3 Solution File Update

Aggiungere il test project al file `duedgusto.sln` con un nuovo GUID progetto e le configurazioni Debug/Release.

### 1.4 Global Usings (`GlobalUsings.cs`)

```csharp
global using Xunit;
global using Moq;
global using FluentAssertions;
global using Microsoft.EntityFrameworkCore;
global using duedgusto.DataAccess;
global using duedgusto.Models;
```

### 1.5 Shared Test Helpers

#### `TestDbContextFactory.cs`

Il `AppDbContext` accetta `DbContextOptions<AppDbContext>` e `IConfiguration`. Per i test usiamo InMemory provider con una configurazione mock.

```csharp
using Microsoft.Extensions.Configuration;

namespace DuedGusto.Tests.Helpers;

public static class TestDbContextFactory
{
    /// <summary>
    /// Crea un AppDbContext con InMemory database.
    /// Ogni test usa un databaseName univoco per l'isolamento.
    /// </summary>
    public static AppDbContext Create(string? databaseName = null)
    {
        databaseName ??= Guid.NewGuid().ToString();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName)
            .Options;

        // IConfiguration mock minimale
        var configMock = new Mock<IConfiguration>();
        configMock.Setup(c => c.GetConnectionString("Default"))
            .Returns("Server=test;Database=test");

        var context = new AppDbContext(options, configMock.Object);
        context.Database.EnsureCreated();
        return context;
    }

    /// <summary>
    /// Crea un contesto e lo popola con dati seed.
    /// </summary>
    public static AppDbContext CreateWithSeed(Action<AppDbContext> seedAction, string? databaseName = null)
    {
        var context = Create(databaseName);
        seedAction(context);
        context.SaveChanges();
        return context;
    }
}
```

**Nota su `OnConfiguring`**: Il metodo `AppDbContext.OnConfiguring` ha un guard `if (!optionsBuilder.IsConfigured)`, quindi quando passiamo le opzioni InMemory dal test il guard impedisce di sovrascrivere con MySQL. Questo rende il contesto perfettamente testabile senza modifiche al codice di produzione.

#### `JwtTestHelper.cs`

```csharp
using duedgusto.Services.Jwt;
using System.Security.Claims;

namespace DuedGusto.Tests.Helpers;

public static class JwtTestHelper
{
    public const string TestSymmetricKey = "TestSecretKeyForUnitTests_MustBe32+Chars!";

    public static JwtHelper CreateJwtHelper()
    {
        return new JwtHelper(TestSymmetricKey, SecurityKeyType.SymmetricSecurityKey);
    }

    /// <summary>
    /// Genera un token JWT valido per un utente di test.
    /// </summary>
    public static (string RefreshToken, string Token) CreateTestToken(
        int userId = 1,
        string userName = "testuser")
    {
        var jwtHelper = CreateJwtHelper();
        var claims = new[]
        {
            new Claim(ClaimTypes.Name, userName),
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim("UserId", userId.ToString()),
        };
        return jwtHelper.CreateSignedToken(claims);
    }

    /// <summary>
    /// Crea un utente di test con hash/salt del password.
    /// </summary>
    public static Utente CreateTestUtente(
        int id = 1,
        string username = "testuser",
        string password = "TestPassword123!")
    {
        duedgusto.Services.HashPassword.PasswordService.HashPassword(
            password, out byte[] hash, out byte[] salt);

        return new Utente
        {
            Id = id,
            NomeUtente = username,
            Hash = hash,
            Salt = salt,
            Disabilitato = false,
            ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(7),
        };
    }
}
```

#### `MockHttpContextFactory.cs`

```csharp
using Microsoft.AspNetCore.Http;

namespace DuedGusto.Tests.Helpers;

public static class MockHttpContextFactory
{
    public static HttpContext Create(string? remoteIp = "127.0.0.1", string path = "/")
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = System.Net.IPAddress.Parse(remoteIp ?? "127.0.0.1");
        context.Request.Path = path;
        context.Response.Body = new MemoryStream();
        return context;
    }

    public static HttpContext CreateWithBody<T>(T body, string path = "/") where T : class
    {
        var context = Create(path: path);
        var json = System.Text.Json.JsonSerializer.Serialize(body);
        context.Request.Body = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(json));
        context.Request.ContentType = "application/json";
        return context;
    }
}
```

### 1.6 Running Backend Tests

```bash
# Tutti i test
cd backend && dotnet test

# Con coverage report
cd backend && dotnet test --collect:"XPlat Code Coverage"

# Filtra per namespace
cd backend && dotnet test --filter "FullyQualifiedName~Unit.Services"

# Verbose output
cd backend && dotnet test --verbosity normal
```

---

## 2. Frontend Test Infrastructure

### 2.1 Existing Setup

Il progetto ha gia un setup funzionante:
- **`vitest.config.ts`**: configurato con jsdom, globals, setupFiles
- **`src/test/setup.ts`**: localStorage mock, BroadcastChannel mock, variabili globali (API_ENDPOINT, GRAPHQL_ENDPOINT)
- **10 file di test esistenti**, 103 test passanti
- **Pacchetti gia installati**: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`

### 2.2 Test File Organization

Convenzione gia adottata dal progetto: cartella `__tests__/` adiacente al codice sorgente.

```
src/
├── api/
│   └── __tests__/
│       ├── makeRequest.test.tsx        # esistente
│       └── refreshToken.test.tsx       # esistente
├── common/
│   ├── authentication/
│   │   └── __tests__/
│   │       ├── auth.test.tsx           # esistente
│   │       ├── onRefreshFails.test.tsx # esistente
│   │       ├── tokenRefreshManager.test.tsx # esistente
│   │       └── useSignOut.test.tsx     # esistente
│   └── bones/
│       └── __tests__/
│           ├── flatMap.test.tsx        # esistente
│           ├── capitalize.test.tsx     # nuovo
│           ├── formatCurrency.test.tsx # nuovo
│           ├── isEmpty.test.tsx        # nuovo
│           ├── isEqual.test.tsx        # nuovo
│           └── ...                     # altri 14 file nuovi
├── store/
│   └── __tests__/
│       ├── userStore.test.tsx          # nuovo
│       ├── themeStore.test.tsx         # nuovo
│       ├── confirmDialogStore.test.tsx # nuovo
│       ├── inProgressStore.test.tsx    # nuovo
│       ├── serverStatusStore.test.tsx  # nuovo
│       ├── businessSettingsStore.test.tsx # nuovo
│       └── useStore.test.tsx           # nuovo (composizione)
├── graphql/
│   └── __tests__/
│       └── configureClient.test.tsx    # esistente
├── routes/
│   └── __tests__/
│       ├── ProtectedRoutes.test.tsx    # nuovo
│       └── dynamicComponentLoader.test.tsx # nuovo
└── components/
    ├── common/
    │   └── form/
    │       └── __tests__/
    │           └── TextField.test.tsx  # esistente
    └── pages/
        └── registrazioneCassa/
            └── __tests__/
                └── SummaryDataGrid.test.tsx # esistente
```

### 2.3 New Test Helpers

#### `src/test/helpers/zustandTestWrapper.tsx`

```tsx
import { ReactNode } from "react";
import { create } from "zustand";

/**
 * Crea una copia isolata di uno store Zustand per i test.
 * Evita che i test si influenzino a vicenda tramite stato condiviso.
 */
export function createTestStore<T>(storeFactory: (set: any, get?: any) => T) {
  return create<T>((set, get) => storeFactory(set, get));
}

/**
 * Resetta lo store globale useStore tra i test.
 * Usa con beforeEach per isolamento.
 */
export function resetStoreState(store: ReturnType<typeof create>) {
  const initialState = store.getInitialState();
  store.setState(initialState, true);
}
```

#### `src/test/helpers/apolloTestWrapper.tsx`

```tsx
import { ReactNode } from "react";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { InMemoryCache } from "@apollo/client";

interface ApolloTestWrapperProps {
  children: ReactNode;
  mocks?: MockedResponse[];
  addTypename?: boolean;
}

/**
 * Wrapper per testare componenti che usano Apollo hooks.
 * Fornisce un MockedProvider con cache InMemory pre-configurata.
 */
export function ApolloTestWrapper({
  children,
  mocks = [],
  addTypename = false,
}: ApolloTestWrapperProps) {
  return (
    <MockedProvider
      mocks={mocks}
      addTypename={addTypename}
      cache={new InMemoryCache()}
    >
      {children}
    </MockedProvider>
  );
}

/**
 * Crea un mock response per una query GraphQL.
 * Utility per ridurre il boilerplate nei test.
 */
export function createMockResponse<TData>(
  query: any,
  variables: Record<string, any>,
  data: TData
): MockedResponse {
  return {
    request: { query, variables },
    result: { data },
  };
}

/**
 * Crea un mock response con errore GraphQL.
 */
export function createMockErrorResponse(
  query: any,
  variables: Record<string, any>,
  errorMessage: string
): MockedResponse {
  return {
    request: { query, variables },
    error: new Error(errorMessage),
  };
}
```

#### `src/test/helpers/formikTestWrapper.tsx`

```tsx
import { ReactNode } from "react";
import { Formik, FormikValues } from "formik";

interface FormikTestWrapperProps<T extends FormikValues> {
  children: ReactNode;
  initialValues: T;
  onSubmit?: (values: T) => void;
  validationSchema?: any;
}

/**
 * Wrapper per testare componenti form che dipendono da Formik context.
 * Es: FormTextField, FormSelect, FormAutocomplete.
 */
export function FormikTestWrapper<T extends FormikValues>({
  children,
  initialValues,
  onSubmit = vi.fn(),
  validationSchema,
}: FormikTestWrapperProps<T>) {
  return (
    <Formik
      initialValues={initialValues}
      onSubmit={onSubmit}
      validationSchema={validationSchema}
    >
      {children}
    </Formik>
  );
}
```

#### `src/test/helpers/routerTestWrapper.tsx`

```tsx
import { ReactNode } from "react";
import { MemoryRouter } from "react-router";

interface RouterTestWrapperProps {
  children: ReactNode;
  initialEntries?: string[];
}

/**
 * Wrapper per testare componenti che usano React Router hooks.
 */
export function RouterTestWrapper({
  children,
  initialEntries = ["/"],
}: RouterTestWrapperProps) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      {children}
    </MemoryRouter>
  );
}
```

### 2.4 Vitest Configuration Updates

Aggiungere coverage thresholds e reporter a `vitest.config.ts`:

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.tsx", "src/**/*.ts"],
      exclude: [
        "src/test/**",
        "src/**/*.test.tsx",
        "src/**/__tests__/**",
        "src/vite-env.d.ts",
        "src/types.d.ts",
      ],
      thresholds: {
        // Phase 1 target (auth): file-level enforcement
        // Global targets saranno incrementati fase per fase
        statements: 40,
        branches: 35,
        functions: 35,
        lines: 40,
      },
    },
  },
});
```

### 2.5 Mock Patterns

**Module mocking** (pattern gia usato nel progetto):
```tsx
vi.mock("../../api/refreshToken", () => ({
  default: vi.fn(),
}));
```

**Fetch mocking** (preferito rispetto a MSW per semplicita, dato che le API REST sono solo auth):
```tsx
const fetchMock = vi.fn();
global.fetch = fetchMock;

fetchMock.mockResolvedValueOnce({
  ok: true,
  json: () => Promise.resolve({ Token: "new-token", RefreshToken: "new-refresh" }),
});
```

**MSW non e necessario**: il progetto usa Apollo MockedProvider per GraphQL e ha solo 3 endpoint REST (signin, refresh, logout). Il mocking diretto di `fetch` e sufficiente.

---

## 3. Architecture Decisions

### 3.1 Backend: InMemory vs TestContainers

| Criterio | InMemory Provider | TestContainers (MySQL) |
|----------|-------------------|------------------------|
| Velocita | ~1ms per test | ~500ms+ (container lifecycle) |
| Fedelta | Media (no trigger, no collation, no cascade differences) | Alta (MySQL reale) |
| Setup | Zero config | Richiede Docker |
| CI | Nessuna dipendenza | Docker-in-Docker necessario |

**Decisione**: **InMemory per unit test, nessun TestContainers nella Phase 1-4**.

Ragioni:
- Il `AppDbContext` ha gia il guard `if (!optionsBuilder.IsConfigured)` che abilita InMemory senza modifiche
- I servizi principali (`ChiusuraMensileService`, `AuthController`) usano LINQ standard che funziona identicamente con InMemory
- Non ci sono stored procedure, trigger, o query SQL raw (la vecchia `GetConnectionAsync` usava raw SQL ma e stata riscritta in LINQ)
- I test di integrazione con MySQL reale sono esplicitamente fuori scope nella proposal

**Divergenze note InMemory vs MySQL da documentare nei test**:
- InMemory non supporta transazioni reali (`SaveChangesAsync` e atomico)
- InMemory non applica `[MaxLength]` o vincoli di unicita tramite indice
- InMemory non fa cascade delete automatico come MySQL
- `.Include()` funziona ma i lazy-loading proxy non sono supportati

### 3.2 Frontend: Zustand Store Testing Strategy

**Decisione**: **Test diretti sullo store (senza componenti)**.

Zustand stores in questo progetto sono pure functions che accettano `set` e `get`. Sono perfettamente testabili senza React:

```tsx
// Lo store e una funzione pura
function userStore(set: StoreSet) {
  return {
    utente: null,
    receiveUtente: (payload: Utente) => set(() => ({ utente: payload })),
  };
}
```

Per stores con logica complessa (es. `businessSettingsStore` con `isOpen`, `getNextOperatingDate`), testiamo direttamente le funzioni creando uno store Zustand isolato.

Per i componenti che leggono dallo store (es. `ProtectedRoutes`), usiamo `useStore.setState()` per iniettare stato di test prima del render.

### 3.3 GraphQL Testing Strategy

**Decisione**: **Non testare i resolver GraphQL.NET direttamente** per la Phase 1-2. Testare la business logic nei service layer.

Ragioni:
- I resolver usano `GraphQLService.GetService<T>(context)` che crea un `IServiceScope` dal `IResolveFieldContext` — mockare questo richiede setup complesso
- La logica di business vera e nei metodi del resolver (inline) o nei service (`ChiusuraMensileService`)
- Per i resolver semplici (CRUD via `GetConnectionAsync`), il valore del test unitario e basso

Per Phase 2+ (integration tests), consideriamo di creare un helper che esegue query GraphQL contro lo schema in-memory:

```csharp
// Possibile helper futuro per Phase 2
public static class GraphQLTestHelper
{
    public static async Task<ExecutionResult> ExecuteQuery(
        IServiceProvider services, string query, string? variables = null)
    {
        var schema = services.GetRequiredService<ISchema>();
        var executer = new DocumentExecuter();
        return await executer.ExecuteAsync(options =>
        {
            options.Schema = schema;
            options.Query = query;
            options.RequestServices = services;
        });
    }
}
```

### 3.4 Auth Middleware Chain Testing

**Decisione**: **Test unitari isolati per ogni middleware/servizio**.

La catena di autenticazione nel backend e:
```
Request → AuthRateLimitMiddleware → JWT Bearer Auth → [Authorize] → Controller/GraphQL
```

- `AuthRateLimitMiddleware`: testabile con mock `HttpContext` e `RequestDelegate`
- `JwtHelper`: testabile direttamente (classe pura, no DI)
- `PasswordService`: testabile direttamente (metodi statici, no DI)
- `AuthController`: testabile con InMemory `AppDbContext` + `JwtHelper` reale + mock `IWebHostEnvironment`

Non serve testare il pipeline ASP.NET Core (JWT Bearer validation) perche e codice di framework. Testiamo le nostre componenti.

---

## 4. Test Patterns con Esempi Concreti

### 4.1 Backend: Testing JwtHelper

```csharp
namespace DuedGusto.Tests.Unit.Services;

public class JwtHelperTests
{
    private readonly JwtHelper _jwtHelper;

    public JwtHelperTests()
    {
        _jwtHelper = JwtTestHelper.CreateJwtHelper();
    }

    [Fact]
    public void CreateSignedToken_ShouldReturnValidTokenAndRefreshToken()
    {
        // Arrange
        var claims = new[]
        {
            new Claim(ClaimTypes.Name, "testuser"),
            new Claim("UserId", "42"),
        };

        // Act
        var (refreshToken, token) = _jwtHelper.CreateSignedToken(claims);

        // Assert
        refreshToken.Should().NotBeNullOrEmpty();
        token.Should().NotBeNullOrEmpty();
        token.Split('.').Should().HaveCount(3, "un JWT ha 3 segmenti separati da '.'");
    }

    [Fact]
    public void GetPrincipalFromExpiredToken_WithValidToken_ShouldReturnPrincipal()
    {
        // Arrange
        var (_, token) = _jwtHelper.CreateSignedToken(
            new Claim(ClaimTypes.Name, "testuser"),
            new Claim("UserId", "1")
        );

        // Act
        var principal = _jwtHelper.GetPrincipalFromExpiredToken(token);

        // Assert
        principal.Should().NotBeNull();
        principal!.Identity!.Name.Should().Be("testuser");
    }

    [Fact]
    public void GetPrincipalFromExpiredToken_WithInvalidToken_ShouldReturnNull()
    {
        // Act
        var principal = _jwtHelper.GetPrincipalFromExpiredToken("invalid.token.here");

        // Assert
        principal.Should().BeNull();
    }

    [Fact]
    public void GetUserID_ShouldExtractUserIdFromClaims()
    {
        // Arrange
        var (_, token) = _jwtHelper.CreateSignedToken(
            new Claim("UserId", "42"),
            new Claim(ClaimTypes.Name, "test")
        );
        var principal = _jwtHelper.GetPrincipalFromExpiredToken(token)!;

        // Act
        var userId = _jwtHelper.GetUserID(principal);

        // Assert
        userId.Should().Be(42);
    }

    [Fact]
    public void GenerateRefreshToken_ShouldReturnUniqueTokens()
    {
        // Act
        var token1 = _jwtHelper.GenerateRefreshToken();
        var token2 = _jwtHelper.GenerateRefreshToken();

        // Assert
        token1.Should().NotBe(token2);
        Convert.FromBase64String(token1).Should().HaveCount(32);
    }

    [Fact]
    public void TokenValidationParameters_ShouldBeConfiguredCorrectly()
    {
        // Assert
        var tvp = _jwtHelper.TokenValidationParameters;
        tvp.ValidateIssuer.Should().BeTrue();
        tvp.ValidIssuer.Should().Be("duedgusto-api");
        tvp.ValidateAudience.Should().BeTrue();
        tvp.ValidAudience.Should().Be("duedgusto-clients");
        tvp.ValidateLifetime.Should().BeTrue();
        tvp.RequireExpirationTime.Should().BeTrue();
        tvp.RequireSignedTokens.Should().BeTrue();
        tvp.ValidateIssuerSigningKey.Should().BeTrue();
    }

    [Theory]
    [InlineData(SecurityKeyType.SymmetricSecurityKey)]
    public void Constructor_WithValidKey_ShouldNotThrow(SecurityKeyType keyType)
    {
        // Act & Assert
        var action = () => new JwtHelper(JwtTestHelper.TestSymmetricKey, keyType);
        action.Should().NotThrow();
    }
}
```

### 4.2 Backend: Testing PasswordService

```csharp
namespace DuedGusto.Tests.Unit.Services;

public class PasswordServiceTests
{
    [Fact]
    public void HashPassword_ShouldProduceHashAndSalt()
    {
        // Act
        PasswordService.HashPassword("MySecurePassword", out byte[] hash, out byte[] salt);

        // Assert
        hash.Should().NotBeEmpty();
        salt.Should().NotBeEmpty();
        hash.Should().HaveCount(32, "HMACSHA256 produce hash di 32 byte");
    }

    [Fact]
    public void VerifyPassword_WithCorrectPassword_ShouldReturnTrue()
    {
        // Arrange
        PasswordService.HashPassword("MyPassword", out byte[] hash, out byte[] salt);

        // Act
        var result = PasswordService.VerifyPassword("MyPassword", hash, salt);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void VerifyPassword_WithWrongPassword_ShouldReturnFalse()
    {
        // Arrange
        PasswordService.HashPassword("MyPassword", out byte[] hash, out byte[] salt);

        // Act
        var result = PasswordService.VerifyPassword("WrongPassword", hash, salt);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void HashPassword_SamePasswordTwice_ShouldProduceDifferentSalts()
    {
        // Act
        PasswordService.HashPassword("SamePassword", out byte[] hash1, out byte[] salt1);
        PasswordService.HashPassword("SamePassword", out byte[] hash2, out byte[] salt2);

        // Assert
        salt1.Should().NotEqual(salt2, "ogni hash deve avere un salt unico");
        hash1.Should().NotEqual(hash2, "salt diversi producono hash diversi");
    }
}
```

### 4.3 Backend: Testing AuthController con InMemory DB

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using duedgusto.Controllers;

namespace DuedGusto.Tests.Unit.Controllers;

public class AuthControllerTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly JwtHelper _jwtHelper;
    private readonly AuthController _controller;

    public AuthControllerTests()
    {
        _dbContext = TestDbContextFactory.Create();
        _jwtHelper = JwtTestHelper.CreateJwtHelper();

        var envMock = new Mock<IWebHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Development");

        _controller = new AuthController(_dbContext, _jwtHelper, envMock.Object);

        // Setup ControllerContext con HttpContext per Response.Cookies
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    [Fact]
    public async Task SignIn_WithValidCredentials_ShouldReturnToken()
    {
        // Arrange
        var testUser = JwtTestHelper.CreateTestUtente(
            id: 1, username: "admin", password: "Password123!");
        _dbContext.Utenti.Add(testUser);
        await _dbContext.SaveChangesAsync();

        var request = new SignInRequest("admin", "Password123!");

        // Act
        var result = await _controller.SignIn(request);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result;
        var value = okResult.Value!;
        // Verifica che il response contenga Token e RefreshToken
        value.GetType().GetProperty("Token")!.GetValue(value).Should().NotBeNull();
        value.GetType().GetProperty("RefreshToken")!.GetValue(value).Should().NotBeNull();
    }

    [Fact]
    public async Task SignIn_WithInvalidPassword_ShouldReturnUnauthorized()
    {
        // Arrange
        var testUser = JwtTestHelper.CreateTestUtente(
            id: 1, username: "admin", password: "CorrectPassword");
        _dbContext.Utenti.Add(testUser);
        await _dbContext.SaveChangesAsync();

        var request = new SignInRequest("admin", "WrongPassword");

        // Act
        var result = await _controller.SignIn(request);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task SignIn_WithNonExistentUser_ShouldReturnUnauthorized()
    {
        // Arrange
        var request = new SignInRequest("nonexistent", "Password123!");

        // Act
        var result = await _controller.SignIn(request);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task SignIn_WithDisabledAccount_ShouldReturnUnauthorized()
    {
        // Arrange
        var testUser = JwtTestHelper.CreateTestUtente(
            id: 1, username: "disabled", password: "Password123!");
        testUser.Disabilitato = true;
        _dbContext.Utenti.Add(testUser);
        await _dbContext.SaveChangesAsync();

        var request = new SignInRequest("disabled", "Password123!");

        // Act
        var result = await _controller.SignIn(request);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task RefreshToken_WithValidRefreshToken_ShouldRotateTokens()
    {
        // Arrange
        var testUser = JwtTestHelper.CreateTestUtente();
        testUser.TokenAggiornamento = "valid-refresh-token";
        testUser.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(7);
        _dbContext.Utenti.Add(testUser);
        await _dbContext.SaveChangesAsync();

        var request = new TokenResponse("valid-refresh-token");

        // Act
        var result = await _controller.RefreshToken(request);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        // Il refresh token nel DB dovrebbe essere cambiato (rotation)
        var updatedUser = await _dbContext.Utenti.FindAsync(testUser.Id);
        updatedUser!.TokenAggiornamento.Should().NotBe("valid-refresh-token");
    }

    [Fact]
    public async Task RefreshToken_WithExpiredRefreshToken_ShouldReturnUnauthorized()
    {
        // Arrange
        var testUser = JwtTestHelper.CreateTestUtente();
        testUser.TokenAggiornamento = "expired-refresh-token";
        testUser.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(-1); // scaduto
        _dbContext.Utenti.Add(testUser);
        await _dbContext.SaveChangesAsync();

        var request = new TokenResponse("expired-refresh-token");

        // Act
        var result = await _controller.RefreshToken(request);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
        // Il refresh token dovrebbe essere stato nullificato
        var updatedUser = await _dbContext.Utenti.FindAsync(testUser.Id);
        updatedUser!.TokenAggiornamento.Should().BeNull();
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
```

### 4.4 Backend: Testing AuthRateLimitMiddleware

```csharp
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using duedgusto.Middleware;

namespace DuedGusto.Tests.Unit.Middleware;

public class AuthRateLimitMiddlewareTests
{
    private readonly Mock<ILogger<AuthRateLimitMiddleware>> _loggerMock;
    private bool _nextDelegateCalled;

    public AuthRateLimitMiddlewareTests()
    {
        _loggerMock = new Mock<ILogger<AuthRateLimitMiddleware>>();
        _nextDelegateCalled = false;

        // Pulisci lo stato statico del rate limiter tra i test
        AuthRateLimitMiddleware.CleanupOldEntries();
    }

    private AuthRateLimitMiddleware CreateMiddleware()
    {
        RequestDelegate next = (context) =>
        {
            _nextDelegateCalled = true;
            return Task.CompletedTask;
        };
        return new AuthRateLimitMiddleware(next, _loggerMock.Object);
    }

    [Fact]
    public async Task InvokeAsync_NonRateLimitedPath_ShouldPassThrough()
    {
        // Arrange
        var middleware = CreateMiddleware();
        var context = MockHttpContextFactory.Create(path: "/graphql");

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        _nextDelegateCalled.Should().BeTrue();
        context.Response.StatusCode.Should().NotBe(429);
    }

    [Fact]
    public async Task InvokeAsync_SignInWithinLimit_ShouldPassThrough()
    {
        // Arrange
        var middleware = CreateMiddleware();
        var context = MockHttpContextFactory.Create(
            remoteIp: "192.168.1.100",
            path: "/api/auth/signin");

        // Act - 5 richieste (il limite e 5)
        for (int i = 0; i < 5; i++)
        {
            _nextDelegateCalled = false;
            await middleware.InvokeAsync(context);
            _nextDelegateCalled.Should().BeTrue($"richiesta {i + 1} dovrebbe passare");
        }
    }

    [Fact]
    public async Task InvokeAsync_SignInExceedsLimit_ShouldReturn429()
    {
        // Arrange
        var middleware = CreateMiddleware();

        // Esauriamo il rate limit (5 richieste)
        for (int i = 0; i < 5; i++)
        {
            var ctx = MockHttpContextFactory.Create(
                remoteIp: "10.0.0.50",
                path: "/api/auth/signin");
            await middleware.InvokeAsync(ctx);
        }

        // Act - La sesta richiesta dovrebbe essere bloccata
        _nextDelegateCalled = false;
        var blockedContext = MockHttpContextFactory.Create(
            remoteIp: "10.0.0.50",
            path: "/api/auth/signin");
        await middleware.InvokeAsync(blockedContext);

        // Assert
        _nextDelegateCalled.Should().BeFalse();
        blockedContext.Response.StatusCode.Should().Be(429);
    }

    [Fact]
    public async Task InvokeAsync_DifferentIPs_ShouldHaveIndependentLimits()
    {
        // Arrange
        var middleware = CreateMiddleware();

        // Esauriamo il rate limit per IP 1
        for (int i = 0; i < 5; i++)
        {
            var ctx = MockHttpContextFactory.Create(
                remoteIp: "172.16.0.1",
                path: "/api/auth/signin");
            await middleware.InvokeAsync(ctx);
        }

        // Act - IP 2 dovrebbe ancora passare
        _nextDelegateCalled = false;
        var differentIpContext = MockHttpContextFactory.Create(
            remoteIp: "172.16.0.2",
            path: "/api/auth/signin");
        await middleware.InvokeAsync(differentIpContext);

        // Assert
        _nextDelegateCalled.Should().BeTrue();
    }
}
```

### 4.5 Frontend: Testing Zustand Stores

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import businessSettingsStore from "../../store/businessSettingsStore";

// Crea uno store isolato per i test
function createTestBusinessStore() {
  return create<any>((set, get) => ({
    ...businessSettingsStore(set, get),
  }));
}

describe("businessSettingsStore", () => {
  let store: ReturnType<typeof createTestBusinessStore>;

  beforeEach(() => {
    store = createTestBusinessStore();
  });

  describe("setSettings", () => {
    it("dovrebbe salvare le impostazioni nello store", () => {
      const settings = {
        operatingDays: [true, true, true, true, true, false, false],
        openingTime: "08:00",
        closingTime: "22:00",
      };

      store.getState().setSettings(settings);

      expect(store.getState().settings).toEqual(settings);
    });
  });

  describe("isOpen", () => {
    it("dovrebbe restituire true per giorni operativi", () => {
      store.getState().setSettings({
        operatingDays: [true, true, true, true, true, false, false],
        openingTime: "08:00",
        closingTime: "22:00",
      });

      // Lunedi = getDay() 1 = operatingDays[0] = true
      const monday = new Date("2026-03-16"); // lunedi
      expect(store.getState().isOpen(monday)).toBe(true);
    });

    it("dovrebbe restituire false per giorni di chiusura", () => {
      store.getState().setSettings({
        operatingDays: [true, true, true, true, true, false, false],
        openingTime: "08:00",
        closingTime: "22:00",
      });

      // Sabato = getDay() 6 = operatingDays[5] = false
      const saturday = new Date("2026-03-14"); // sabato
      expect(store.getState().isOpen(saturday)).toBe(false);
    });

    it("dovrebbe restituire true se non ci sono settings (default aperto)", () => {
      expect(store.getState().isOpen(new Date())).toBe(true);
    });
  });

  describe("getNextOperatingDate", () => {
    it("dovrebbe restituire la stessa data se e un giorno operativo", () => {
      store.getState().setSettings({
        operatingDays: [true, true, true, true, true, false, false],
        openingTime: "08:00",
        closingTime: "22:00",
      });

      const monday = new Date("2026-03-16");
      const result = store.getState().getNextOperatingDate(monday);
      expect(result.toDateString()).toBe(monday.toDateString());
    });

    it("dovrebbe trovare il prossimo giorno operativo", () => {
      store.getState().setSettings({
        operatingDays: [true, true, true, true, true, false, false],
        openingTime: "08:00",
        closingTime: "22:00",
      });

      const saturday = new Date("2026-03-14"); // sabato
      const result = store.getState().getNextOperatingDate(saturday);
      // Prossimo lunedi = 16 marzo
      expect(result.getDay()).toBe(1); // lunedi
    });
  });
});
```

### 4.6 Frontend: Testing Apollo Hooks con MockedProvider

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import { gql } from "@apollo/client";

// Esempio di test per un componente che usa una query GraphQL
// (adattare al componente reale del progetto)

const MOCK_QUERY = gql`
  query GetBusinessSettings {
    settings {
      businessSettings {
        businessName
        openingTime
        closingTime
      }
    }
  }
`;

describe("Apollo hook integration pattern", () => {
  it("dovrebbe renderizzare i dati dalla query GraphQL", async () => {
    const mocks = [
      {
        request: { query: MOCK_QUERY },
        result: {
          data: {
            settings: {
              businessSettings: {
                businessName: "DuedGusto Test",
                openingTime: "08:00",
                closingTime: "22:00",
              },
            },
          },
        },
      },
    ];

    // Pattern: wrappare il componente con MockedProvider
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        {/* <ComponenteCheUsaQuery /> */}
        <div>placeholder</div>
      </MockedProvider>
    );

    // waitFor per attendere il completamento della query
    await waitFor(() => {
      // assertions sui dati renderizzati
    });
  });

  it("dovrebbe gestire errori GraphQL", async () => {
    const errorMocks = [
      {
        request: { query: MOCK_QUERY },
        error: new Error("Network error"),
      },
    ];

    render(
      <MockedProvider mocks={errorMocks} addTypename={false}>
        {/* <ComponenteCheUsaQuery /> */}
        <div>placeholder</div>
      </MockedProvider>
    );

    await waitFor(() => {
      // assertions sullo stato di errore
    });
  });
});
```

### 4.7 Frontend: Testing ProtectedRoutes

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// Mock dei moduli necessari
vi.mock("../../common/authentication/auth", () => ({
  isAuthenticated: vi.fn(),
}));

vi.mock("../../store/useStore", () => ({
  default: vi.fn(),
}));

vi.mock("../../routes/dynamicComponentLoader", () => ({
  loadDynamicComponent: vi.fn(),
}));

import { isAuthenticated } from "../../common/authentication/auth";
import useStore from "../../store/useStore";

describe("ProtectedRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dovrebbe redirigere a /signin se non autenticato", async () => {
    vi.mocked(isAuthenticated).mockReturnValue(false);

    // Importo ProtectedRoutes dopo i mock
    const { default: ProtectedRoutes } = await import(
      "../../routes/ProtectedRoutes"
    );

    render(
      <MemoryRouter initialEntries={["/gestionale/dashboard"]}>
        <ProtectedRoutes />
      </MemoryRouter>
    );

    // Verifica redirect (il componente non renderizza il layout)
    expect(isAuthenticated).toHaveBeenCalled();
  });

  it("dovrebbe mostrare fallback durante il caricamento utente", async () => {
    vi.mocked(isAuthenticated).mockReturnValue(true);
    vi.mocked(useStore).mockImplementation((selector: any) => {
      const state = {
        utente: null,
        inProgress: { global: true },
        getNextOperatingDate: () => new Date(),
      };
      return selector(state);
    });

    const { default: ProtectedRoutes } = await import(
      "../../routes/ProtectedRoutes"
    );

    render(
      <MemoryRouter initialEntries={["/gestionale/dashboard"]}>
        <ProtectedRoutes />
      </MemoryRouter>
    );

    // Dovrebbe mostrare il fallback, non il contenuto
    // (la verifica dipende dal componente Fallback effettivo)
  });
});
```

### 4.8 Frontend: Testing `loadDynamicComponent`

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadDynamicComponent,
  clearComponentCache,
  getAvailableComponents,
} from "../../routes/dynamicComponentLoader";

describe("dynamicComponentLoader", () => {
  beforeEach(() => {
    clearComponentCache();
  });

  it("dovrebbe normalizzare percorsi con prefisso ../components/pages/", () => {
    const component = loadDynamicComponent(
      "../components/pages/users/UserList.tsx"
    );
    expect(component).toBeDefined();
    // Il componente ritornato e un React.lazy — verifichiamo che sia un oggetto
    expect(typeof component).toBe("object");
  });

  it("dovrebbe usare la cache per componenti gia caricati", () => {
    const component1 = loadDynamicComponent("users/UserList.tsx");
    const component2 = loadDynamicComponent("users/UserList.tsx");
    expect(component1).toBe(component2); // stessa reference
  });

  it("dovrebbe ritornare un fallback per percorsi non validi", () => {
    const component = loadDynamicComponent("nonexistent/Page.tsx");
    expect(component).toBeDefined();
    // Verifichiamo che il componente esista (sara il fallback con errore)
  });

  it("clearComponentCache dovrebbe svuotare la cache", () => {
    loadDynamicComponent("test/Page.tsx");
    clearComponentCache();
    // Dopo il clear, un nuovo caricamento dovrebbe creare un nuovo lazy component
    const component = loadDynamicComponent("test/Page.tsx");
    expect(component).toBeDefined();
  });

  it("getAvailableComponents dovrebbe ritornare un array di percorsi", () => {
    const components = getAvailableComponents();
    expect(Array.isArray(components)).toBe(true);
    // In test environment, import.meta.glob potrebbe essere vuoto
  });
});
```

---

## 5. ChiusuraMensileService Test Pattern (Phase 2)

Questo service e il piu complesso del backend e rappresenta il pattern per tutti i service test:

```csharp
using duedgusto.Services.ChiusureMensili;

namespace DuedGusto.Tests.Unit.Services;

public class ChiusuraMensileServiceTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly ChiusuraMensileService _service;
    private readonly string _dbName;

    public ChiusuraMensileServiceTests()
    {
        _dbName = Guid.NewGuid().ToString();
        _dbContext = TestDbContextFactory.Create(_dbName);
        _service = new ChiusuraMensileService(_dbContext);
    }

    [Fact]
    public async Task CreaChiusuraAsync_WithValidMonth_ShouldCreateClosure()
    {
        // Arrange - aggiungi registri cassa chiusi per il mese
        _dbContext.RegistriCassa.Add(new RegistroCassa
        {
            Data = new DateTime(2026, 3, 5),
            Stato = "CLOSED",
        });
        await _dbContext.SaveChangesAsync();

        // Act
        var chiusura = await _service.CreaChiusuraAsync(2026, 3);

        // Assert
        chiusura.Should().NotBeNull();
        chiusura.Anno.Should().Be(2026);
        chiusura.Mese.Should().Be(3);
        chiusura.Stato.Should().Be("BOZZA");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(13)]
    [InlineData(-1)]
    public async Task CreaChiusuraAsync_WithInvalidMonth_ShouldThrow(int mese)
    {
        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(
            () => _service.CreaChiusuraAsync(2026, mese));
    }

    [Fact]
    public async Task CreaChiusuraAsync_WhenAlreadyExists_ShouldThrow()
    {
        // Arrange
        _dbContext.ChiusureMensili.Add(new ChiusuraMensile
        {
            Anno = 2026,
            Mese = 3,
            Stato = "BOZZA",
            CreatoIl = DateTime.UtcNow,
            AggiornatoIl = DateTime.UtcNow,
        });
        await _dbContext.SaveChangesAsync();

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => _service.CreaChiusuraAsync(2026, 3));
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
```

---

## 6. Coverage Configuration

### 6.1 Backend Coverage (coverlet)

Coverlet e incluso nel template del progetto di test (`coverlet.collector`). Per generare il report:

```bash
cd backend && dotnet test --collect:"XPlat Code Coverage" --results-directory ./TestResults

# Per report HTML (installare reportgenerator come tool globale)
dotnet tool install -g dotnet-reportgenerator-globaltool
reportgenerator -reports:./TestResults/**/coverage.cobertura.xml -targetdir:./TestResults/CoverageReport -reporttypes:Html
```

### 6.2 Frontend Coverage (v8 via Vitest)

```bash
cd duedgusto && npx vitest run --coverage
```

Il report sara generato in `duedgusto/coverage/`.

### 6.3 CI Integration

Aggiungere al pipeline CI esistente:

```yaml
# Backend tests
- name: Backend Tests
  run: cd backend && dotnet test --collect:"XPlat Code Coverage"

# Frontend tests
- name: Frontend Tests
  run: cd duedgusto && npx vitest run --coverage
```

---

## 7. Phase Execution Order

| Phase | Focus | Backend Tests | Frontend Tests | Target |
|-------|-------|---------------|----------------|--------|
| 1 | Auth & Security | JwtHelper, PasswordService, AuthController, RateLimitMiddleware | auth.tsx, tokenRefreshManager, configureClient (gia esistenti, ampliare) | 90%+ sui target |
| 2 | Business Logic | ChiusuraMensileService, CashManagement service logic | GraphQL hooks, cash register components | 70%+ sui target |
| 3 | Navigation & State | — | 7 Zustand stores, ProtectedRoutes, dynamicComponentLoader, Form components | 70% stores, 50% UI |
| 4 | Data Layer | Remaining resolvers, edge cases | 19 bones/ utilities, AG Grid wrappers, common components | 50%+ sui target |

---

## 8. Known Limitations & Mitigations

| Limitazione | Impatto | Mitigazione |
|-------------|---------|-------------|
| `AuthRateLimitMiddleware` usa stato statico (`ConcurrentDictionary`) | I test devono chiamare `CleanupOldEntries()` nel `beforeEach` oppure usare IP diversi | Usare IP univoci per ogni test + cleanup |
| `AuthController.SignIn` ha `Task.Delay(50-200ms)` anti-timing | I test di signin sono lenti (~100ms ciascuno) | Accettabile; non e possibile mockare senza modifiche al codice |
| `GraphQLService.GetService<T>` crea scope da `IResolveFieldContext` | I resolver GraphQL non sono testabili con unit test semplici | Testare la logica business nei service, non nei resolver |
| `import.meta.glob` non funziona in test environment | `loadDynamicComponent` potrebbe avere mappa moduli vuota | Testare la logica di normalizzazione percorsi e cache, non il glob |
| InMemory provider non supporta vincoli di unicita | Duplicati non generano eccezione come in MySQL | Documentare nei test; per validazioni critiche, aggiungere check esplicito nel service |
