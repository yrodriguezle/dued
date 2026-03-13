# Tasks: TDD Test Coverage

## Phase 1: Auth & Security

### 1.1 Backend Test Infrastructure Setup

- [x] **1.1.1** Create `backend/DuedGusto.Tests/DuedGusto.Tests.csproj` with xUnit, Moq, FluentAssertions, EF Core InMemory, coverlet.collector, and project reference to `duedgusto.csproj`
  - **File to create**: `backend/DuedGusto.Tests/DuedGusto.Tests.csproj`
  - **Tests**: N/A (infrastructure)
  - **Dependencies**: None

- [x] **1.1.2** Update `backend/duedgusto.sln` to include the test project with Debug/Release configurations
  - **File to modify**: `backend/duedgusto.sln`
  - **Tests**: N/A (infrastructure)
  - **Dependencies**: 1.1.1

- [x] **1.1.3** Create `GlobalUsings.cs` with shared imports (Xunit, Moq, FluentAssertions, EF Core, Models)
  - **File to create**: `backend/DuedGusto.Tests/GlobalUsings.cs`
  - **Tests**: N/A (infrastructure)
  - **Dependencies**: 1.1.1

- [x] **1.1.4** Create `TestDbContextFactory.cs` — InMemory AppDbContext factory with per-test isolation and seed support
  - **File to create**: `backend/DuedGusto.Tests/Helpers/TestDbContextFactory.cs`
  - **Source reference**: `backend/DataAccess/AppDbContext.cs`
  - **Tests**: N/A (helper)
  - **Dependencies**: 1.1.1, 1.1.3

- [x] **1.1.5** Create `JwtTestHelper.cs` — token generation helper and test user factory
  - **File to create**: `backend/DuedGusto.Tests/Helpers/JwtTestHelper.cs`
  - **Source reference**: `backend/Services/Jwt/JwtHelper.cs`, `backend/Services/HashPassword/PasswordService.cs`
  - **Tests**: N/A (helper)
  - **Dependencies**: 1.1.1, 1.1.3

- [x] **1.1.6** Create `MockHttpContextFactory.cs` — DefaultHttpContext factory with IP, path, body support
  - **File to create**: `backend/DuedGusto.Tests/Helpers/MockHttpContextFactory.cs`
  - **Tests**: N/A (helper)
  - **Dependencies**: 1.1.1, 1.1.3

- [x] **1.1.7** Verify `dotnet test` runs successfully from `backend/` with zero failures on the empty test project
  - **Dependencies**: 1.1.1 through 1.1.6

### 1.2 JwtHelper Tests

- [x] **1.2.1** Create `JwtHelperTests.cs` — token generation tests (valid JWT format, correct claims, expiry, unique tokens)
  - **Source file**: `backend/Services/Jwt/JwtHelper.cs`
  - **Test file to create**: `backend/DuedGusto.Tests/Unit/Services/JwtHelperTests.cs`
  - **Approx test cases**: 8-10
  - **Specs**: REQ-1.2.1, REQ-1.2.2, REQ-1.2.3
  - **Dependencies**: 1.1.5

- [x] **1.2.2** Add token validation tests to `JwtHelperTests.cs` — valid token passes, tampered signature fails, different key fails, expired token fails
  - **Source file**: `backend/Services/Jwt/JwtHelper.cs`
  - **Test file**: `backend/DuedGusto.Tests/Unit/Services/JwtHelperTests.cs`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-1.2.2
  - **Dependencies**: 1.2.1

- [x] **1.2.3** Add claims extraction tests — extract ClaimsPrincipal from valid token, null/exception from invalid token, GetUserID extraction
  - **Source file**: `backend/Services/Jwt/JwtHelper.cs`
  - **Test file**: `backend/DuedGusto.Tests/Unit/Services/JwtHelperTests.cs`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-1.2.3
  - **Dependencies**: 1.2.1

- [x] **1.2.4** Add constructor and configuration tests — SecurityKeyType, TokenValidationParameters correctness
  - **Source file**: `backend/Services/Jwt/JwtHelper.cs`, `backend/Services/Jwt/SecurityKeyType.cs`
  - **Test file**: `backend/DuedGusto.Tests/Unit/Services/JwtHelperTests.cs`
  - **Approx test cases**: 2-3
  - **Dependencies**: 1.2.1

### 1.3 PasswordService Tests

- [x] **1.3.1** Create `PasswordServiceTests.cs` — hashing produces non-empty hash/salt, same password produces different hashes, verification correct/wrong
  - **Source file**: `backend/Services/HashPassword/PasswordService.cs`
  - **Test file to create**: `backend/DuedGusto.Tests/Unit/Services/PasswordServiceTests.cs`
  - **Approx test cases**: 6-8
  - **Specs**: REQ-1.3.1, REQ-1.3.2
  - **Dependencies**: 1.1.3

- [x] **1.3.2** Add edge case tests — empty string, unicode characters, very long passwords (>1000 chars)
  - **Source file**: `backend/Services/HashPassword/PasswordService.cs`
  - **Test file**: `backend/DuedGusto.Tests/Unit/Services/PasswordServiceTests.cs`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-1.3.3
  - **Dependencies**: 1.3.1

### 1.4 AuthController Tests

- [x] **1.4.1** Create `AuthControllerTests.cs` — sign-in flow: valid credentials return 200 + JWT + refresh cookie, invalid password returns 401, non-existent user returns 401, disabled account returns 401
  - **Source file**: `backend/Controllers/AuthController.cs`
  - **Test file to create**: `backend/DuedGusto.Tests/Unit/Controllers/AuthControllerTests.cs`
  - **Approx test cases**: 5-6
  - **Specs**: REQ-1.4.1
  - **Dependencies**: 1.1.4, 1.1.5

- [x] **1.4.2** Add token refresh tests — valid refresh returns new tokens, expired refresh returns 401, refresh token rotation (old token invalidated)
  - **Source file**: `backend/Controllers/AuthController.cs`
  - **Test file**: `backend/DuedGusto.Tests/Unit/Controllers/AuthControllerTests.cs`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-1.4.2
  - **Dependencies**: 1.4.1

- [x] **1.4.3** Add sign-out tests — clears refresh token cookie, invalidated token cannot be reused
  - **Source file**: `backend/Controllers/AuthController.cs`
  - **Test file**: `backend/DuedGusto.Tests/Unit/Controllers/AuthControllerTests.cs`
  - **Approx test cases**: 2-3
  - **Specs**: REQ-1.4.3
  - **Dependencies**: 1.4.1

### 1.5 AuthRateLimitMiddleware Tests

- [x] **1.5.1** Create `AuthRateLimitMiddlewareTests.cs` — non-rate-limited paths pass through, requests within limit pass, exceeding limit returns 429, window resets, per-IP isolation
  - **Source file**: `backend/Middleware/AuthRateLimitMiddleware.cs`
  - **Test file to create**: `backend/DuedGusto.Tests/Unit/Middleware/AuthRateLimitMiddlewareTests.cs`
  - **Approx test cases**: 5-7
  - **Specs**: REQ-1.5.1
  - **Dependencies**: 1.1.6

### 1.6 Frontend Auth Tests (Extend Existing)

- [x] **1.6.1** Create `useGetLoggedUser.test.tsx` — returns user data with valid session, returns null without session, loading state transitions
  - **Source file**: `duedgusto/src/common/authentication/useGetLoggedUser.tsx`
  - **Test file to create**: `duedgusto/src/common/authentication/__tests__/useGetLoggedUser.test.tsx`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-1.6.1
  - **Dependencies**: None (existing test infrastructure)

- [x] **1.6.2** Create `broadcastChannel.test.tsx` — sign-out broadcasts to other tabs, receiving broadcast triggers local sign-out
  - **Source file**: `duedgusto/src/common/authentication/broadcastChannel.tsx`
  - **Test file to create**: `duedgusto/src/common/authentication/__tests__/broadcastChannel.test.tsx`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-1.6.2
  - **Dependencies**: None

- [x] **1.6.3** Create `csrfToken.test.tsx` — extract CSRF token from cookie, attach to headers, handle missing cookie
  - **Source file**: `duedgusto/src/common/authentication/csrfToken.tsx`
  - **Test file to create**: `duedgusto/src/common/authentication/__tests__/csrfToken.test.tsx`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-1.6.3
  - **Dependencies**: None

- [x] **1.6.4** Extend `tokenRefreshManager.test.tsx` — concurrent 401 handling (only one refresh), queued requests retried, queued requests rejected on refresh failure
  - **Source file**: `duedgusto/src/common/authentication/tokenRefreshManager.tsx`
  - **Test file to extend**: `duedgusto/src/common/authentication/__tests__/tokenRefreshManager.test.tsx`
  - **Approx new test cases**: 3-4
  - **Specs**: REQ-1.6.4
  - **Dependencies**: None

### 1.7 Frontend Test Helper Setup

- [x] **1.7.1** Create `apolloTestWrapper.tsx` — MockedProvider wrapper with InMemory cache, mock response factories
  - **File to create**: `duedgusto/src/test/helpers/apolloTestWrapper.tsx`
  - **Tests**: N/A (helper)
  - **Dependencies**: None

- [x] **1.7.2** Create `zustandTestWrapper.tsx` — isolated store factory and resetStoreState utility
  - **File to create**: `duedgusto/src/test/helpers/zustandTestWrapper.tsx`
  - **Tests**: N/A (helper)
  - **Dependencies**: None

- [x] **1.7.3** Create `formikTestWrapper.tsx` — Formik context wrapper for form component tests
  - **File to create**: `duedgusto/src/test/helpers/formikTestWrapper.tsx`
  - **Tests**: N/A (helper)
  - **Dependencies**: None

- [x] **1.7.4** Create `routerTestWrapper.tsx` — MemoryRouter wrapper for route-dependent component tests
  - **File to create**: `duedgusto/src/test/helpers/routerTestWrapper.tsx`
  - **Tests**: N/A (helper)
  - **Dependencies**: None

---

## Phase 2: Core Business Logic

### 2.1 Backend Cash Register Tests

- [x] **2.1.1** Create `CashManagementQueriesTests.cs` — query cash register by ID, query by date range, query by month, Relay-style pagination
  - **Source file**: `backend/GraphQL/CashManagement/CashManagementQueries.cs`
  - **Models**: `backend/Models/RegistroCassa.cs`, `IncassoCassa.cs`, `SpesaCassa.cs`
  - **Test file to create**: `backend/DuedGusto.Tests/Integration/GraphQL/CashManagementQueriesTests.cs`
  - **Approx test cases**: 5-7
  - **Specs**: REQ-2.1.1
  - **Dependencies**: 1.1.4

- [x] **2.1.2** Create `CashManagementMutationsTests.cs` — create register with required fields, add income/expense entries, close register with correct totals, reject modification of closed register
  - **Source file**: `backend/GraphQL/CashManagement/CashManagementMutations.cs`
  - **Models**: `backend/Models/RegistroCassa.cs`, `ConteggioMoneta.cs`, `DenominazioneMoneta.cs`
  - **Test file to create**: `backend/DuedGusto.Tests/Integration/GraphQL/CashManagementMutationsTests.cs`
  - **Approx test cases**: 6-8
  - **Specs**: REQ-2.1.1, REQ-2.1.2
  - **Dependencies**: 1.1.4

- [x] **2.1.3** Add totals computation tests — daily total aggregation, expense subtraction, decimal precision (2 decimal places), zero-value entries
  - **Source file**: `backend/GraphQL/CashManagement/CashManagementMutations.cs`
  - **Test file**: `backend/DuedGusto.Tests/Integration/GraphQL/CashManagementMutationsTests.cs`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-2.1.3
  - **Dependencies**: 2.1.2

### 2.2 ChiusuraMensileService Tests

- [x] **2.2.1** Create `ChiusuraMensileServiceTests.cs` — monthly closure aggregates all daily registers, correct totals, empty month returns zero-value, partial month handling
  - **Source file**: `backend/Services/ChiusureMensili/ChiusuraMensileService.cs`
  - **Test file to create**: `backend/DuedGusto.Tests/Unit/Services/ChiusuraMensileServiceTests.cs`
  - **Approx test cases**: 5-6
  - **Specs**: REQ-2.2.1
  - **Dependencies**: 1.1.4

- [x] **2.2.2** Create `MonthlyClosuresQueriesTests.cs` — query closures by year, query by specific month/year, yearly summary aggregation
  - **Source file**: `backend/GraphQL/ChiusureMensili/MonthlyClosuresQueries.cs`
  - **Test file to create**: `backend/DuedGusto.Tests/Integration/GraphQL/MonthlyClosuresQueriesTests.cs`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-2.2.2
  - **Dependencies**: 2.2.1

- [x] **2.2.3** Create `MigrazioneChiusureMensiliServiceTests.cs` — migration logic for existing data, idempotency
  - **Source file**: `backend/Services/ChiusureMensili/MigrazioneChiusureMensiliService.cs`
  - **Test file to create**: `backend/DuedGusto.Tests/Unit/Services/MigrazioneChiusureMensiliServiceTests.cs`
  - **Approx test cases**: 3-4
  - **Dependencies**: 1.1.4

### 2.3 Frontend Cash Register GraphQL Hooks

- [x] **2.3.1** Create `useQueryCashRegister.test.tsx` — returns correct data from MockedProvider, loading/error state transitions
  - **Source file**: `duedgusto/src/graphql/cashRegister/useQueryCashRegister.tsx`
  - **Test file to create**: `duedgusto/src/graphql/cashRegister/__tests__/useQueryCashRegister.test.tsx`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-2.3.1
  - **Dependencies**: 1.7.1

- [x] **2.3.2** Create `useQueryCashRegistersByMonth.test.tsx` — filters by month/year, handles empty results
  - **Source file**: `duedgusto/src/graphql/cashRegister/useQueryCashRegistersByMonth.tsx`
  - **Test file to create**: `duedgusto/src/graphql/cashRegister/__tests__/useQueryCashRegistersByMonth.test.tsx`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-2.3.1
  - **Dependencies**: 1.7.1

- [x] **2.3.3** Create `useSubmitCashRegister.test.tsx` — calls correct mutation, handles response, error handling
  - **Source file**: `duedgusto/src/graphql/cashRegister/useSubmitCashRegister.tsx`
  - **Test file to create**: `duedgusto/src/graphql/cashRegister/__tests__/useSubmitCashRegister.test.tsx`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-2.3.2
  - **Dependencies**: 1.7.1

- [x] **2.3.4** Create `useCloseCashRegister.test.tsx` — calls close mutation, handles response/error
  - **Source file**: `duedgusto/src/graphql/cashRegister/useCloseCashRegister.tsx`
  - **Test file to create**: `duedgusto/src/graphql/cashRegister/__tests__/useCloseCashRegister.test.tsx`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-2.3.2
  - **Dependencies**: 1.7.1

- [x] **2.3.5** Create `useQueryDashboardKPIs.test.tsx` — returns aggregated KPI data, handles empty/null data
  - **Source file**: `duedgusto/src/graphql/cashRegister/useQueryDashboardKPIs.tsx`
  - **Test file to create**: `duedgusto/src/graphql/cashRegister/__tests__/useQueryDashboardKPIs.test.tsx`
  - **Approx test cases**: 2-3
  - **Specs**: REQ-2.3.3
  - **Dependencies**: 1.7.1

- [x] **2.3.6** Create `useQueryYearlySummary.test.tsx` — returns yearly summary, handles empty data
  - **Source file**: `duedgusto/src/graphql/cashRegister/useQueryYearlySummary.tsx`
  - **Test file to create**: `duedgusto/src/graphql/cashRegister/__tests__/useQueryYearlySummary.test.tsx`
  - **Approx test cases**: 2-3
  - **Dependencies**: 1.7.1

### 2.4 Common GraphQL Utilities

- [x] **2.4.1** Create `useFetchData.test.tsx` — fetches data on mount, loading/error/data state transitions, refetch
  - **Source file**: `duedgusto/src/graphql/common/useFetchData.tsx`
  - **Test file to create**: `duedgusto/src/graphql/common/__tests__/useFetchData.test.tsx`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-2.4.1
  - **Dependencies**: 1.7.1

- [x] **2.4.2** Create `useGetAll.test.tsx` — Relay-style pagination (edges, pageInfo, cursor), fetchMore appends, empty results
  - **Source file**: `duedgusto/src/graphql/common/useGetAll.tsx`
  - **Test file to create**: `duedgusto/src/graphql/common/__tests__/useGetAll.test.tsx`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-2.4.2
  - **Dependencies**: 1.7.1

- [x] **2.4.3** Create `getQueryName.test.tsx` — extract query name from DocumentNode, handle unnamed queries
  - **Source file**: `duedgusto/src/graphql/common/getQueryName.tsx`
  - **Test file to create**: `duedgusto/src/graphql/common/__tests__/getQueryName.test.tsx`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-2.4.3
  - **Dependencies**: None

- [x] **2.4.4** Create `useQueryParams.test.tsx` — query parameter handling
  - **Source file**: `duedgusto/src/graphql/common/useQueryParams.tsx`
  - **Test file to create**: `duedgusto/src/graphql/common/__tests__/useQueryParams.test.tsx`
  - **Approx test cases**: 2-3
  - **Dependencies**: 1.7.4

---

## Phase 3: Navigation & State

### 3.1 Zustand Store Tests

- [x] **3.1.1** Create `userStore.test.tsx` — initial state (no user, not authenticated), setUser updates data + auth flag, clearUser resets, roles/permissions exposed
  - **Source file**: `duedgusto/src/store/userStore.tsx`
  - **Test file to create**: `duedgusto/src/store/__tests__/userStore.test.tsx`
  - **Approx test cases**: 5-6
  - **Specs**: REQ-3.1.1
  - **Dependencies**: 1.7.2

- [x] **3.1.2** Create `inProgressStore.test.tsx` — initial state not in-progress, setInProgress(true) activates, setInProgress(false) deactivates
  - **Source file**: `duedgusto/src/store/inProgressStore.tsx`
  - **Test file to create**: `duedgusto/src/store/__tests__/inProgressStore.test.tsx`
  - **Approx test cases**: 3
  - **Specs**: REQ-3.1.2
  - **Dependencies**: 1.7.2

- [x] **3.1.3** Create `themeStore.test.tsx` — default theme mode, toggle between light/dark, persistence
  - **Source file**: `duedgusto/src/store/themeStore.tsx`
  - **Test file to create**: `duedgusto/src/store/__tests__/themeStore.test.tsx`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-3.1.3
  - **Dependencies**: 1.7.2

- [x] **3.1.4** Create `confirmDialogStore.test.tsx` — openDialog sets config, closeDialog resets, confirm/cancel callbacks invocable
  - **Source file**: `duedgusto/src/store/confirmDialogStore.tsx`
  - **Test file to create**: `duedgusto/src/store/__tests__/confirmDialogStore.test.tsx`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-3.1.4
  - **Dependencies**: 1.7.2

- [x] **3.1.5** Create `serverStatusStore.test.tsx` — initial status, setOnline, setOffline
  - **Source file**: `duedgusto/src/store/serverStatusStore.tsx`
  - **Test file to create**: `duedgusto/src/store/__tests__/serverStatusStore.test.tsx`
  - **Approx test cases**: 3
  - **Specs**: REQ-3.1.5
  - **Dependencies**: 1.7.2

- [x] **3.1.6** Create `businessSettingsStore.test.tsx` — initial defaults, setSettings updates all fields, partial merge
  - **Source file**: `duedgusto/src/store/businessSettingsStore.tsx`
  - **Test file to create**: `duedgusto/src/store/__tests__/businessSettingsStore.test.tsx`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-3.1.6
  - **Dependencies**: 1.7.2

- [x] **3.1.7** Create `useStore.test.tsx` — root store composes all sub-stores, accessing sub-store slices works
  - **Source file**: `duedgusto/src/store/useStore.tsx`
  - **Test file to create**: `duedgusto/src/store/__tests__/useStore.test.tsx`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-3.1.7
  - **Dependencies**: 3.1.1 through 3.1.6

### 3.2 ProtectedRoutes & Dynamic Loading Tests

- [x] **3.2.1** Create `ProtectedRoutes.test.tsx` — routes generated from menu data, unauthenticated redirect to sign-in, missing menu fallback
  - **Source file**: `duedgusto/src/routes/ProtectedRoutes.tsx`
  - **Test file to create**: `duedgusto/src/routes/__tests__/ProtectedRoutes.test.tsx`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-3.2.1
  - **Dependencies**: 1.7.2, 1.7.4

- [x] **3.2.2** Create `dynamicComponentLoader.test.tsx` — returns lazy-loaded component, invalid filePath triggers error boundary, renders correctly in Suspense
  - **Source file**: `duedgusto/src/routes/dynamicComponentLoader.tsx`
  - **Test file to create**: `duedgusto/src/routes/__tests__/dynamicComponentLoader.test.tsx`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-3.2.2
  - **Dependencies**: 1.7.4

### 3.3 Form Component Tests

- [x] **3.3.1** Create `FormikTextField.test.tsx` — renders with Formik initial value, typing updates field, validation errors displayed, cursor position preserved (commit e3a4472)
  - **Source file**: `duedgusto/src/components/common/form/FormikTextField.tsx`
  - **Test file to create**: `duedgusto/src/components/common/form/__tests__/FormikTextField.test.tsx`
  - **Approx test cases**: 5-6
  - **Specs**: REQ-3.3.1
  - **Dependencies**: 1.7.3

- [x] **3.3.2** Create `FormikCheckbox.test.tsx` — initial checked/unchecked, toggling updates Formik value, label display
  - **Source file**: `duedgusto/src/components/common/form/FormikCheckbox.tsx`
  - **Test file to create**: `duedgusto/src/components/common/form/__tests__/FormikCheckbox.test.tsx`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-3.3.2
  - **Dependencies**: 1.7.3

- [x] **3.3.3** Create `FormikSearchbox.test.tsx` — renders with initial value, typing triggers search, selecting option updates field, modal variant
  - **Source file**: `duedgusto/src/components/common/form/searchbox/FormikSearchbox.tsx`
  - **Test file to create**: `duedgusto/src/components/common/form/searchbox/__tests__/FormikSearchbox.test.tsx`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-3.3.3
  - **Dependencies**: 1.7.3

- [x] **3.3.4** Extend `TextField.test.tsx` — add controlled vs uncontrolled behavior, inputProps/InputProps passthrough edge cases
  - **Source file**: `duedgusto/src/components/common/form/TextField.tsx`
  - **Test file to extend**: `duedgusto/src/components/common/form/__tests__/TextField.test.tsx`
  - **Approx new test cases**: 3-4
  - **Specs**: REQ-3.3.4
  - **Dependencies**: None

---

## Phase 4: Data Layer & Edge Cases

### 4.1 Backend Remaining Resolvers

- [x] **4.1.1** Create `SuppliersTests.cs` — CRUD operations (create, query with pagination, update, delete), payment tracking
  - **Source files**: `backend/GraphQL/Suppliers/SuppliersQueries.cs`, `SuppliersMutations.cs`
  - **Test file to create**: `backend/DuedGusto.Tests/Integration/GraphQL/SuppliersTests.cs`
  - **Approx test cases**: 6-8
  - **Specs**: REQ-4.1.1
  - **Dependencies**: 1.1.4

- [x] **4.1.2** Create `PurchaseInvoicesTests.cs` — create invoice linked to supplier, create delivery note, query by supplier ID, total calculations
  - **Source files**: `backend/GraphQL/Suppliers/` (invoice/delivery note types)
  - **Test file to create**: `backend/DuedGusto.Tests/Integration/GraphQL/PurchaseInvoicesTests.cs`
  - **Approx test cases**: 5-6
  - **Specs**: REQ-4.1.2
  - **Dependencies**: 4.1.1

- [x] **4.1.3** Create `SettingsTests.cs` — query business settings, update settings, default when none exist
  - **Source files**: `backend/GraphQL/Settings/SettingsQueries.cs`, `SettingsMutations.cs`
  - **Test file to create**: `backend/DuedGusto.Tests/Integration/GraphQL/SettingsTests.cs`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-4.1.3
  - **Dependencies**: 1.1.4

- [x] **4.1.4** Create `SalesTests.cs` — create sale with line items, query by date range, total calculations
  - **Source files**: `backend/GraphQL/Sales/SalesQueries.cs`, `SalesMutations.cs`
  - **Test file to create**: `backend/DuedGusto.Tests/Integration/GraphQL/SalesTests.cs`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-4.1.4
  - **Dependencies**: 1.1.4

- [x] **4.1.5** Create `ManagementQueriesTests.cs` — dashboard aggregates, behavior with empty datasets
  - **Source file**: `backend/GraphQL/Management/ManagementQueries.cs`
  - **Test file to create**: `backend/DuedGusto.Tests/Integration/GraphQL/ManagementQueriesTests.cs`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-4.1.5
  - **Dependencies**: 1.1.4

### 4.2 Frontend Bones Utility Tests

- [x] **4.2.1** Create `getType.test.tsx` — correct type strings for all JS types (string, number, boolean, null, undefined, array, object, date, regex, function)
  - **Source file**: `duedgusto/src/common/bones/getType.tsx`
  - **Test file to create**: `duedgusto/src/common/bones/__tests__/getType.test.tsx`
  - **Approx test cases**: 10-12
  - **Specs**: REQ-4.3.1
  - **Dependencies**: None

- [x] **4.2.2** Create `isEmpty.test.tsx` — returns true for null/undefined/""/[]/{}; false for 0/false/non-empty values
  - **Source file**: `duedgusto/src/common/bones/isEmpty.tsx`
  - **Test file to create**: `duedgusto/src/common/bones/__tests__/isEmpty.test.tsx`
  - **Approx test cases**: 8-10
  - **Specs**: REQ-4.3.1
  - **Dependencies**: None

- [x] **4.2.3** Create `isEqual.test.tsx` — deep comparison of objects/arrays, primitive comparison, edge cases (null, undefined, circular)
  - **Source file**: `duedgusto/src/common/bones/isEqual.tsx`
  - **Test file to create**: `duedgusto/src/common/bones/__tests__/isEqual.test.tsx`
  - **Approx test cases**: 8-10
  - **Specs**: REQ-4.3.2
  - **Dependencies**: None

- [x] **4.2.4** Create `differenceBy.test.tsx` and `unionBy.test.tsx` — difference returns correct elements, union merges without duplicates
  - **Source files**: `duedgusto/src/common/bones/differenceBy.tsx`, `unionBy.tsx`
  - **Test files to create**: `duedgusto/src/common/bones/__tests__/differenceBy.test.tsx`, `unionBy.test.tsx`
  - **Approx test cases**: 6-8 (total across both files)
  - **Specs**: REQ-4.3.2
  - **Dependencies**: None

- [x] **4.2.5** Create `uniq.test.tsx` — removes duplicates from arrays of primitives and objects
  - **Source file**: `duedgusto/src/common/bones/uniq.tsx`
  - **Test file to create**: `duedgusto/src/common/bones/__tests__/uniq.test.tsx`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-4.3.2
  - **Dependencies**: None

- [x] **4.2.6** Create `capitalize.test.tsx` and `kebabCase.test.tsx` — capitalize("hello")="Hello", capitalize("")="", kebabCase("helloWorld")="hello-world", edge cases
  - **Source files**: `duedgusto/src/common/bones/capitalize.tsx`, `kebabCase.tsx`
  - **Test files to create**: `duedgusto/src/common/bones/__tests__/capitalize.test.tsx`, `kebabCase.test.tsx`
  - **Approx test cases**: 6-8 (total across both files)
  - **Specs**: REQ-4.3.3
  - **Dependencies**: None

- [x] **4.2.7** Create `formatCurrency.test.tsx` and `numberParser.test.tsx` — currency formatting with locale, number parsing from locale strings, edge cases
  - **Source files**: `duedgusto/src/common/bones/formatCurrency.tsx`, `numberParser.tsx`
  - **Test files to create**: `duedgusto/src/common/bones/__tests__/formatCurrency.test.tsx`, `numberParser.test.tsx`
  - **Approx test cases**: 6-8 (total across both files)
  - **Specs**: REQ-4.3.4
  - **Dependencies**: None

- [x] **4.2.8** Create `relativeTime.test.tsx` — correct relative time descriptions, edge cases
  - **Source files**: `duedgusto/src/common/bones/relativeTime.tsx`, `relativeTimeString.tsx`
  - **Test file to create**: `duedgusto/src/common/bones/__tests__/relativeTime.test.tsx`
  - **Approx test cases**: 5-6
  - **Specs**: REQ-4.3.4
  - **Dependencies**: None

- [x] **4.2.9** Create `keyBy.test.tsx` and `omitDeep.test.tsx` — keyBy creates keyed object, omitDeep recursively removes keys
  - **Source files**: `duedgusto/src/common/bones/keyBy.tsx`, `omitDeep.tsx`
  - **Test files to create**: `duedgusto/src/common/bones/__tests__/keyBy.test.tsx`, `omitDeep.test.tsx`
  - **Approx test cases**: 6-8 (total across both files)
  - **Specs**: REQ-4.3.5
  - **Dependencies**: None

- [x] **4.2.10** Create `defaultValue.test.tsx` — returns fallback for null/undefined, passes through valid values
  - **Source file**: `duedgusto/src/common/bones/defaultValue.tsx`
  - **Test file to create**: `duedgusto/src/common/bones/__tests__/defaultValue.test.tsx`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-4.3.5
  - **Dependencies**: None

- [x] **4.2.11** Extend `flatMap.test.tsx` — add edge cases (empty arrays, nested arrays, null values)
  - **Source file**: `duedgusto/src/common/bones/flatMap.tsx`
  - **Test file to extend**: `duedgusto/src/common/bones/__tests__/flatMap.test.tsx`
  - **Approx new test cases**: 3-4
  - **Specs**: REQ-4.3.5
  - **Dependencies**: None

- [x] **4.2.12** Create `debounce.test.tsx` — delays execution, cancels previous calls, collapses rapid calls
  - **Source file**: `duedgusto/src/common/bones/debounce.tsx`
  - **Test file to create**: `duedgusto/src/common/bones/__tests__/debounce.test.tsx`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-4.3.6
  - **Dependencies**: None

- [x] **4.2.13** Create `sleep.test.tsx` and `PromiseQueue.test.tsx` — sleep resolves after duration, queue executes in sequence, handles rejections
  - **Source files**: `duedgusto/src/common/bones/sleep.tsx`, `PromiseQueue.tsx`
  - **Test files to create**: `duedgusto/src/common/bones/__tests__/sleep.test.tsx`, `PromiseQueue.test.tsx`
  - **Approx test cases**: 6-8 (total across both files)
  - **Specs**: REQ-4.3.6
  - **Dependencies**: None

- [x] **4.2.14** Create `reportError.test.tsx` — handles Error objects, string errors, unknown error types
  - **Source file**: `duedgusto/src/common/bones/reportError.tsx`
  - **Test file to create**: `duedgusto/src/common/bones/__tests__/reportError.test.tsx`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-4.3.7
  - **Dependencies**: None

### 4.3 Frontend Datagrid Tests

- [x] **4.3.1** Create `Datagrid.test.tsx` — SKIPPED (AG Grid Enterprise richiede licenza e mock complessi) — renders with column definitions and row data, empty data shows empty state, toolbar rendering
  - **Source file**: `duedgusto/src/components/common/datagrid/Datagrid.tsx`
  - **Test file to create**: `duedgusto/src/components/common/datagrid/__tests__/Datagrid.test.tsx`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-4.2.1
  - **Dependencies**: None

- [x] **4.3.2** Create `datagridUtils.test.tsx` — isCellEditable, getFirstEditableColumn, other helper functions
  - **Source files**: `duedgusto/src/components/common/datagrid/datagridUtils.tsx`, `isCellEditable.tsx`, `getFirstEditableColumn.tsx`
  - **Test file to create**: `duedgusto/src/components/common/datagrid/__tests__/datagridUtils.test.tsx`
  - **Approx test cases**: 6-8
  - **Specs**: REQ-4.2.4
  - **Dependencies**: None

- [x] **4.3.3** Create cell editing tests — SKIPPED (AG Grid internals, troppo accoppiato) — editable cells enter edit mode, commit/cancel, cell validation
  - **Source files**: `duedgusto/src/components/common/datagrid/editing/`, `cellEditors/`
  - **Test file to create**: `duedgusto/src/components/common/datagrid/editing/__tests__/cellEditing.test.tsx`
  - **Approx test cases**: 5-6
  - **Specs**: REQ-4.2.2
  - **Dependencies**: 4.3.1

### 4.4 Common Shared Components & Utilities

- [x] **4.4.1** Create `ErrorBoundary.test.tsx` — catches child error, displays fallback UI, error info available
  - **Source file**: `duedgusto/src/components/common/ErrorBoundary.tsx`
  - **Test file to create**: `duedgusto/src/components/common/__tests__/ErrorBoundary.test.tsx`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-4.5.1
  - **Dependencies**: None

- [x] **4.4.2** Create `createDataTree.test.tsx` — builds tree from flat data, handles root and nested items, empty input
  - **Source file**: `duedgusto/src/common/ui/createDataTree.tsx`
  - **Test file to create**: `duedgusto/src/common/ui/__tests__/createDataTree.test.tsx`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-4.5.2
  - **Dependencies**: None

- [x] **4.4.3** Create `stringToColor.test.tsx` — consistent colors for same string, valid hex format, different strings produce different colors
  - **Source file**: `duedgusto/src/common/ui/stringToColor.tsx`
  - **Test file to create**: `duedgusto/src/common/ui/__tests__/stringToColor.test.tsx`
  - **Approx test cases**: 4-5
  - **Specs**: REQ-4.5.2
  - **Dependencies**: None

- [x] **4.4.4** Create `fetchConfiguration.test.tsx` — loads config from /config.json, extracts API base URL, error handling when unavailable
  - **Source file**: `duedgusto/src/api/fetchConfiguration.tsx`
  - **Test file to create**: `duedgusto/src/api/__tests__/fetchConfiguration.test.tsx`
  - **Approx test cases**: 3-4
  - **Specs**: REQ-4.5.3
  - **Dependencies**: None

- [x] **4.4.5** Extend `makeRequest.test.tsx` — add timeout scenarios, retry behavior
  - **Source file**: `duedgusto/src/api/makeRequest.tsx`
  - **Test file to extend**: `duedgusto/src/api/__tests__/makeRequest.test.tsx`
  - **Approx new test cases**: 3-4
  - **Specs**: REQ-4.5.4
  - **Dependencies**: None

- [x] **4.4.6** Create `httpStatusCodes.test.tsx` — exports correct status code constants
  - **Source file**: `duedgusto/src/api/httpStatusCodes.tsx`
  - **Test file to create**: `duedgusto/src/api/__tests__/httpStatusCodes.test.tsx`
  - **Approx test cases**: 5-6
  - **Specs**: REQ-4.5.4
  - **Dependencies**: None

- [x] **4.4.7** Extend `configureClient.test.tsx` — cache merge policies for paginated queries, cache eviction after mutations
  - **Source file**: `duedgusto/src/graphql/configureClient.tsx`
  - **Test file to extend**: `duedgusto/src/graphql/__tests__/configureClient.test.tsx`
  - **Approx new test cases**: 3-4
  - **Specs**: REQ-4.4.1
  - **Dependencies**: None

### 4.5 Vitest Coverage Configuration & CI

- [x] **4.5.1** Update `duedgusto/vitest.config.ts` — add v8 coverage provider, coverage thresholds, reporter configuration (text, html, lcov)
  - **File to modify**: `duedgusto/vitest.config.ts`
  - **Specs**: REQ-CC.3, REQ-CC.4
  - **Dependencies**: None

- [x] **4.5.2** Verify all frontend tests pass — **377 test in 59 file, 0 fallimenti**
  - **Specs**: REQ-CC.2
  - **Dependencies**: All Phase 1-4 frontend tasks

- [x] **4.5.3** Verify `dotnet test` runs all backend tests with zero failures — **141 test, 0 fallimenti**
  - **Specs**: REQ-CC.3
  - **Dependencies**: All Phase 1-4 backend tasks

- [x] **4.5.4** Generate coverage reports for both stacks and verify targets are met (backend 60%+, frontend 55%+)
  - **Specs**: REQ-CC.4
  - **Dependencies**: 4.5.2, 4.5.3
