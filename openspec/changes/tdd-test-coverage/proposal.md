# Proposal: TDD Test Coverage

## Intent

DuedGusto is a full-stack POS and cash management system handling financial transactions, authentication, and sensitive business data. Despite this, the project has near-zero backend test coverage (no test project exists) and only ~103 frontend tests spread across 10 files — leaving critical paths like JWT authentication, CSRF protection, cash register operations, and monthly closure completely untested.

This proposal introduces a structured, 4-phase TDD strategy to bring meaningful test coverage to both the .NET backend and the React frontend, prioritizing security-critical and business-critical code paths first.

## Scope

### In Scope

- **Backend test project**: Create `backend/DuedGusto.Tests/` using xUnit + Moq + EF Core InMemory provider
- **Phase 1 — Auth & Security tests**: JWT token generation/validation, password hashing/verification, refresh token flow, CSRF double-submit cookie middleware, rate-limiting middleware, frontend auth hooks and token queue
- **Phase 2 — Core Business Logic tests**: Cash register open/close/transaction logic, monthly closure calculations, key GraphQL query/mutation resolvers (menu, products, orders, users), frontend GraphQL hook integration tests
- **Phase 3 — Navigation & State tests**: All 7 Zustand stores, `ProtectedRoutes` dynamic loading, `loadDynamicComponent`, form components (`FormTextField`, `FormSelect`, `FormAutocomplete`, etc.)
- **Phase 4 — Data Layer & Edge Cases tests**: Remaining GraphQL resolvers, AG Grid datagrid editing/validation, `bones/` utility functions (19 untested), common shared components, error boundaries and edge cases
- **CI integration**: Ensure all tests run in existing CI pipeline
- **Coverage reporting**: Configure coverage collection for both stacks

### Out of Scope

- End-to-end (E2E) / integration tests with real browser (Playwright/Cypress)
- Performance or load testing
- Visual regression testing
- Database integration tests against real MySQL (tests use in-memory provider)
- Tests for third-party library internals (AG Grid Enterprise, Apollo internals)
- Refactoring production code solely for testability (minor dependency injection adjustments are acceptable)

## Approach

### Framework Choices

| Stack | Framework | Rationale |
|-------|-----------|-----------|
| Frontend | **Vitest + React Testing Library** | Already configured in the project (`vitest.config.ts` exists, 103 tests passing). Consistent with existing patterns. |
| Backend | **xUnit + Moq + EF Core InMemory** | Standard .NET 8 testing stack. xUnit is the most widely adopted test framework for .NET. Moq handles service mocking. InMemory provider avoids MySQL dependency. |

### Phase 1 — Auth & Security (Highest Priority)

**Target coverage: 90%+**

**Backend:**
- `JwtService`: Token generation, validation, expiry, claims extraction, invalid token handling
- `PasswordService`: Hashing, verification, salt handling, edge cases (empty/null passwords)
- `AuthController`: Sign-in flow, refresh token rotation, sign-out, invalid credentials
- `CsrfMiddleware`: Double-submit cookie validation, missing token rejection, header/cookie mismatch
- `RateLimitMiddleware`: Request counting, window expiry, limit enforcement

**Frontend:**
- `useAuth` hook: Login/logout flows, token storage, error handling
- `authLink` (Apollo): Authorization header injection, token refresh queue, concurrent request handling
- `csrf.ts` utilities: Token extraction, header attachment
- Auth-related Zustand store slices

### Phase 2 — Core Business Logic

**Target coverage: 70%+**

**Backend:**
- Cash register service: Open register, close register with reconciliation, transaction recording, balance calculations
- Monthly closure service: Period calculation, report generation, data aggregation
- Key GraphQL resolvers: CRUD for products, orders, menus, users, categories
- Service layer: Business rule validation, data transformation

**Frontend:**
- GraphQL hooks: Query/mutation behavior with mocked Apollo provider
- Order management components: State transitions, calculations
- Product management: CRUD form validation

### Phase 3 — Navigation & State

**Target coverage: 70%+ for stores, 50%+ for UI**

**Frontend:**
- All 7 Zustand stores: State initialization, actions, selectors, persistence
- `ProtectedRoutes.tsx`: Route generation from menu data, unauthorized redirect, dynamic component loading
- `loadDynamicComponent()`: Lazy loading, error fallback, missing component handling
- Form components: Validation, controlled input behavior, error display, cursor position preservation (recent fix in commit `e3a4472`)

### Phase 4 — Data Layer & Edge Cases

**Target coverage: 50%+**

**Backend:**
- Remaining GraphQL resolvers and mutations
- Data access layer edge cases
- Error handling and exception flows

**Frontend:**
- `bones/` utilities (19 untested functions): Type checking, formatting, array/object helpers
- AG Grid datagrid: Cell editing, validation, row operations
- Common shared components: Rendering, prop handling, accessibility
- Error boundaries and fallback UI

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/` | High | New test project (`DuedGusto.Tests/`) added alongside main project. Solution file updated. |
| `backend/DuedGusto.Tests/` | New | ~150+ test files covering services, controllers, middleware, resolvers |
| `duedgusto/src/__tests__/` | Medium | Expanded from 10 to ~60+ test files |
| `duedgusto/vitest.config.ts` | Low | Coverage thresholds and reporter configuration added |
| `backend/DuedGusto.sln` | Low | Test project reference added |
| CI/CD pipeline | Low | Test execution step added or verified for both stacks |
| `duedgusto/package.json` | Low | Possible new dev dependencies for mocking (msw, etc.) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Backend services tightly coupled, hard to unit test | Medium | Introduce minimal interface extraction where needed; prefer integration-style tests with InMemory DB over heavy mocking |
| Large scope causes stalled progress | Medium | Strict phase boundaries; each phase is independently valuable and mergeable |
| Tests become brittle due to implementation coupling | Medium | Test behavior not implementation; use black-box patterns; avoid testing private methods |
| InMemory provider behavior differs from MySQL | Low | Document known divergences (e.g., cascade delete, collation); add integration test notes for critical paths |
| Vitest configuration conflicts with existing setup | Low | Extend existing config incrementally; run existing tests first to verify no regression |
| AG Grid Enterprise mocking complexity | Medium | Focus on wrapper component behavior, not AG Grid internals; use shallow rendering where appropriate |

## Rollback Plan

All test code lives in dedicated directories separate from production code:
- **Backend**: Delete `backend/DuedGusto.Tests/` project and remove from solution file
- **Frontend**: Delete new test files from `duedgusto/src/__tests__/`; revert `vitest.config.ts` changes

No production code changes are expected beyond minor dependency injection adjustments. Any such changes will be backward-compatible and independently reviewable.

## Dependencies

- .NET 8 SDK (already present for backend development)
- Node.js + npm (already present for frontend development)
- NuGet packages: `xunit`, `xunit.runner.visualstudio`, `Moq`, `Microsoft.EntityFrameworkCore.InMemory`, `Microsoft.NET.Test.Sdk`, `coverlet.collector`
- npm packages (if not already present): `@testing-library/user-event`, `msw` (Mock Service Worker for API mocking)
- Existing Vitest + React Testing Library setup (already configured and working)

## Success Criteria

- [ ] Backend test project created and compiles successfully
- [ ] All Phase 1 auth/security tests pass with 90%+ coverage on target files
- [ ] All Phase 2 business logic tests pass with 70%+ coverage on target files
- [ ] All Phase 3 store/navigation tests pass with 70%+ coverage for stores, 50%+ for UI
- [ ] All Phase 4 data layer tests pass with 50%+ coverage on target files
- [ ] Zero existing tests broken by new additions
- [ ] CI pipeline runs all tests (both stacks) on every PR
- [ ] Coverage reports generated and accessible for both frontend and backend
- [ ] Total project coverage: backend 60%+ overall, frontend 55%+ overall
