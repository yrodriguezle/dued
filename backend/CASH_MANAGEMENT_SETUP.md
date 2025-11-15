# Cash Management Setup Guide

## Implementazione Completata ✅

### Backend (.NET + GraphQL + Entity Framework Core)

**File Creati:**

#### 1. Models (Entity Framework CodeFirst)
- ✅ `Models/CashDenomination.cs` - Tagli di denaro (monete/banconote)
- ✅ `Models/CashRegister.cs` - Registro cassa giornaliero
- ✅ `Models/CashCount.cs` - Conteggio per taglio

#### 2. Database Configuration
- ✅ `DataAccess/AppDbContext.cs` - Configurazione EF Core con relazioni

#### 3. GraphQL Types
- ✅ `GraphQL/CashManagement/CashDenominationType.cs`
- ✅ `GraphQL/CashManagement/CashCountType.cs`
- ✅ `GraphQL/CashManagement/CashRegisterType.cs`
- ✅ `GraphQL/CashManagement/CashCountInputType.cs`
- ✅ `GraphQL/CashManagement/CashRegisterInputType.cs`

#### 4. GraphQL Queries & Mutations
- ✅ `GraphQL/CashManagement/CashManagementQueries.cs`
  - `denominations` - Lista tutti i tagli
  - `cashRegister(registerId)` - Singola cassa per ID
  - `cashRegistersConnection(first, where, order, after)` - Lista con paginazione
  - `dashboardKPIs` - KPI per dashboard

- ✅ `GraphQL/CashManagement/CashManagementMutations.cs`
  - `mutateCashRegister(cashRegister)` - Crea/aggiorna registro cassa
  - `closeCashRegister(registerId)` - Chiude cassa (status → CLOSED)
  - `deleteCashRegister(registerId)` - Elimina cassa (solo DRAFT)

#### 5. Schema Registration
- ✅ `GraphQL/GraphQLQueries.cs` - Aggiunto field `cashManagement`
- ✅ `GraphQL/GraphQLMutations.cs` - Aggiunto field `cashManagement`

#### 6. Seed Data
- ✅ `SeedData/SeedCashDenominations.cs` - 15 tagli (monete + banconote)
- ✅ `Program.cs` - Registrato seed data

---

## 🚀 PROSSIMI PASSI

### 1. FERMARE IL SERVER BACKEND

Il server backend è attualmente in esecuzione. **Fermarlo prima di procedere**:

- Se avviato da Visual Studio: Stop Debugging
- Se avviato da terminale: `Ctrl+C`
- Verificare che nessun processo blocchi `duedgusto.dll`

### 2. CREARE LA MIGRATION

```bash
cd backend
dotnet ef migrations add AddCashManagementTables --output-dir Migrations
```

### 3. APPLICARE LA MIGRATION AL DATABASE

```bash
dotnet ef database update
```

Questo creerà le seguenti tabelle:
- `CashDenominations` (15 tagli precaricati via seed)
- `CashRegisters`
- `CashCounts`

### 4. AGGIUNGERE MENU AL DATABASE

Eseguire questa query SQL sul database:

```sql
INSERT INTO Menus (MenuName, MenuPath, MenuIcon, MenuOrder, ParentMenuId) VALUES
('Cassa', '/gestionale/cassa', 'PointOfSale', 50, NULL);

INSERT INTO Menus (MenuName, MenuPath, MenuIcon, MenuOrder, ParentMenuId) VALUES
('Lista Cassa', '/gestionale/cassa/list', 'List', 51, (SELECT MenuId FROM Menus WHERE MenuPath = '/gestionale/cassa'));

INSERT INTO Menus (MenuName, MenuPath, MenuIcon, MenuOrder, ParentMenuId) VALUES
('Vista Mensile', '/gestionale/cassa/monthly', 'CalendarMonth', 52, (SELECT MenuId FROM Menus WHERE MenuPath = '/gestionale/cassa'));
```

### 5. ASSEGNARE PERMESSI AL RUOLO

Collegare i menu al ruolo SuperAdmin (o altro ruolo):

```sql
INSERT INTO RoleMenu (RoleId, MenuId)
SELECT
    (SELECT RoleId FROM Roles WHERE RoleName = 'SuperAdmin'),
    MenuId
FROM Menus
WHERE MenuPath LIKE '/gestionale/cassa%';
```

### 6. RIAVVIARE IL BACKEND

```bash
cd backend
dotnet run
```

Oppure avviare da Visual Studio.

### 7. AVVIARE IL FRONTEND

```bash
cd duedgusto
npm run dev
```

---

## 🧪 TESTING ENDPOINT GRAPHQL

### Test 1: Get Denominations

```graphql
query GetDenominations {
  cashManagement {
    denominations {
      denominationId
      value
      type
      displayOrder
    }
  }
}
```

### Test 2: Create Cash Register

```graphql
mutation CreateCashRegister {
  cashManagement {
    mutateCashRegister(cashRegister: {
      date: "2025-11-15"
      userId: 1
      openingCounts: [
        { denominationId: 3, quantity: 50 }
        { denominationId: 4, quantity: 20 }
        { denominationId: 9, quantity: 10 }
      ]
      closingCounts: [
        { denominationId: 3, quantity: 60 }
        { denominationId: 4, quantity: 30 }
        { denominationId: 9, quantity: 15 }
      ]
      supplierExpenses: 50.00
      dailyExpenses: 20.00
      notes: "Primo test cassa"
      status: "DRAFT"
    }) {
      registerId
      date
      openingTotal
      closingTotal
      difference
      status
    }
  }
}
```

### Test 3: Get Cash Registers List

```graphql
query GetCashRegisters {
  cashManagement {
    cashRegistersConnection(first: 10) {
      totalCount
      items {
        registerId
        date
        user {
          userName
          firstName
          lastName
        }
        openingTotal
        closingTotal
        totalSales
        difference
        status
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
```

### Test 4: Get Dashboard KPIs

```graphql
query GetDashboardKPIs {
  cashManagement {
    dashboardKPIs {
      todaySales
      todayDifference
      monthSales
      monthAverage
      weekTrend
    }
  }
}
```

### Test 5: Close Cash Register

```graphql
mutation CloseCashRegister {
  cashManagement {
    closeCashRegister(registerId: 1) {
      registerId
      status
      updatedAt
    }
  }
}
```

---

## 📊 SCHEMA DATABASE CREATO

### CashDenominations
- DenominationId (PK, auto-increment)
- Value (decimal 10,2)
- Type (varchar 10) - "COIN" | "BANKNOTE"
- DisplayOrder (int)

### CashRegisters
- RegisterId (PK, auto-increment)
- Date (date)
- UserId (FK → Users)
- OpeningTotal (decimal 10,2)
- ClosingTotal (decimal 10,2)
- CashSales (decimal 10,2)
- ElectronicPayments (decimal 10,2)
- TotalSales (decimal 10,2)
- SupplierExpenses (decimal 10,2)
- DailyExpenses (decimal 10,2)
- ExpectedCash (decimal 10,2)
- Difference (decimal 10,2)
- NetCash (decimal 10,2)
- VatAmount (decimal 10,2)
- Notes (text, nullable)
- Status (varchar 20) - "DRAFT" | "CLOSED" | "RECONCILED"
- CreatedAt (datetime)
- UpdatedAt (datetime)

### CashCounts
- CountId (PK, auto-increment)
- RegisterId (FK → CashRegisters, cascade delete)
- DenominationId (FK → CashDenominations)
- Quantity (int)
- Total (decimal 10,2)
- IsOpening (bool)

---

## ⚠️ NOTE IMPORTANTI

### Calcoli Automatici
Il backend calcola automaticamente:
- `OpeningTotal` = somma (quantity × value) per IsOpening = true
- `ClosingTotal` = somma (quantity × value) per IsOpening = false
- `ExpectedCash` = CashSales - SupplierExpenses - DailyExpenses
- `Difference` = (ClosingTotal - OpeningTotal) - ExpectedCash
- `VatAmount` = TotalSales × 0.1

### TODO: Integrazione Vendite
Attualmente `CashSales`, `ElectronicPayments` e `TotalSales` sono a 0.
Quando implementerete il modulo vendite, aggiornare il metodo `mutateCashRegister` per:
1. Query vendite del giorno dalla tabella vendite
2. Sommare vendite contanti
3. Sommare pagamenti elettronici
4. Calcolare totale vendite

### Permessi
Le query e mutations richiedono autenticazione (`this.Authorize()`).
Assicurarsi che l'utente sia loggato.

---

## ✅ CHECKLIST COMPLETAMENTO

Backend:
- [x] Entità EF Core create
- [x] DbContext configurato
- [ ] Migration creata (da fare dopo aver fermato il server)
- [ ] Database aggiornato
- [x] GraphQL Types implementati
- [x] Queries implementate
- [x] Mutations implementate
- [x] Seed data creato
- [ ] Menu aggiunti al database
- [ ] Permessi assegnati

Frontend:
- [x] Tipi TypeScript
- [x] GraphQL operations
- [x] Componenti UI
- [x] Route configurate
- [ ] Testing end-to-end

---

**Versione:** 1.0.0
**Data:** 15 Novembre 2025
**Autore:** Claude Code
