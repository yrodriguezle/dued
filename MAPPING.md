# Mappatura Modelli: da Inglese a Italiano

Questo documento definisce la mappatura ufficiale per la ridenominazione di modelli, tabelle, colonne e campi GraphQL dal corrente sistema ibrido inglese/italiano a un sistema completamente in italiano.

---

## 1. Modelli Principali

| Nome Inglese Attuale | Nome Italiano Proposto | Tabella Database Proposta | Note |
| :--- | :--- | :--- | :--- |
| `User` | `Utente` | `Utenti` | |
| `Role` | `Ruolo` | `Ruoli` | |
| `Product` | `Prodotto` | `Prodotti` | |
| `Sale` | `Vendita` | `Vendite` | |
| `Menu` | `Menu` | `Menu` | Invariato |
| `BusinessSettings` | `ImpostazioniAzienda` | `ImpostazioniAzienda` | |
| `CashRegister` | `RegistroCassa` | `RegistriCassa` | |
| `CashIncome` | `IncassoCassa` | `IncassiCassa` | |
| `CashExpense` | `SpesaCassa` | `SpeseCassa` | |
| `CashDenomination`| `DenominazioneMoneta` | `DenominazioniMoneta` | |
| `CashCount` | `ConteggioMoneta` | `ConteggiMoneta` | |

---

## 2. Mappatura Dettagliata delle Proprietà

### 2.1. `User` -> `Utente`

| Campo Attuale (C#) | Campo Proposto (C#) | Colonna DB Proposta |
| :--- | :--- | :--- |
| `UserId` | `Id` | `Id` |
| `UserName` | `NomeUtente` | `NomeUtente` |
| `FirstName` | `Nome` | `Nome` |
| `LastName` | `Cognome` | `Cognome` |
| `Description` | `Descrizione` | `Descrizione` |
| `Disabled` | `Disabilitato` | `Disabilitato` |
| `RefreshToken` | `TokenAggiornamento`| `TokenAggiornamento` |
| `RefreshTokenExpiresAt` | `ScadenzaTokenAggiornamento`| `ScadenzaTokenAggiornamento`|
| `Hash` | `Hash` | `Hash` |
| `Salt` | `Salt` | `Salt` |
| `RoleId` | `RuoloId` | `RuoloId` |
| `Role` | `Ruolo` | `Ruolo` |

### 2.2. `Role` -> `Ruolo`

| Campo Attuale (C#) | Campo Proposto (C#) | Colonna DB Proposta |
| :--- | :--- | :--- |
| `RoleId` | `Id` | `Id` |
| `RoleName` | `Nome` | `Nome` |
| `RoleDescription` | `Descrizione` | `Descrizione` |
| `Users` | `Utenti` | `Utenti` |
| `Menus` | `Menu` | `Menu` |

### 2.3. `Product` -> `Prodotto`

| Campo Attuale (C#) | Campo Proposto (C#) | Colonna DB Proposta |
| :--- | :--- | :--- |
| `ProductId` | `Id` | `Id` |
| `Code` | `Codice` | `Codice` |
| `Name` | `Nome` | `Nome` |
| `Description` | `Descrizione` | `Descrizione` |
| `Price` | `Prezzo` | `Prezzo` |
| `Category` | `Categoria` | `Categoria` |
| `UnitOfMeasure` | `UnitaDiMisura` | `UnitaDiMisura` |
| `IsActive` | `Attivo` | `Attivo` |
| `CreatedAt` | `CreatoIl` | `CreatoIl` |
| `UpdatedAt` | `AggiornatoIl` | `AggiornatoIl` |
| `Sales` | `Vendite` | `Vendite` |

### 2.4. `Sale` -> `Vendita`

| Campo Attuale (C#) | Campo Proposto (C#) | Colonna DB Proposta |
| :--- | :--- | :--- |
| `SaleId` | `Id` | `Id` |
| `RegisterId` | `RegistroCassaId` | `RegistroCassaId` |
| `ProductId` | `ProdottoId` | `ProdottoId` |
| `Quantity` | `Quantita` | `Quantita` |
| `UnitPrice` | `PrezzoUnitario` | `PrezzoUnitario` |
| `TotalPrice` | `PrezzoTotale` | `PrezzoTotale` |
| `Notes` | `Note` | `Note` |
| `Timestamp` | `DataOra` | `DataOra` |
| `CreatedAt` | `CreatoIl` | `CreatoIl` |
| `UpdatedAt` | `AggiornatoIl` | `AggiornatoIl` |
| `CashRegister` | `RegistroCassa` | `RegistroCassa` |
| `Product` | `Prodotto` | `Prodotto` |

### 2.5. `BusinessSettings` -> `ImpostazioniAzienda`

| Campo Attuale (C#) | Campo Proposto (C#) | Colonna DB Proposta |
| :--- | :--- | :--- |
| `SettingsId` | `Id` | `Id` |
| `BusinessName` | `RagioneSociale` | `RagioneSociale` |
| `OpeningTime` | `OrarioApertura` | `OrarioApertura` |
| `ClosingTime` | `OrarioChiusura` | `OrarioChiusura` |
| `OperatingDays` | `GiorniOperativi` | `GiorniOperativi` |
| `Timezone` | `FusoOrario` | `FusoOrario` |
| `Currency` | `Valuta` | `Valuta` |
| `VatRate` | `AliquotaIva` | `AliquotaIva` |
| `CreatedAt` | `CreatoIl` | `CreatoIl` |
| `UpdatedAt` | `AggiornatoIl` | `AggiornatoIl` |

### 2.6. `CashRegister` -> `RegistroCassa`

| Campo Attuale (C#) | Campo Proposto (C#) | Colonna DB Proposta |
| :--- | :--- | :--- |
| `RegisterId` | `Id` | `Id` |
| `Date` | `Data` | `Data` |
| `UserId` | `UtenteId` | `UtenteId` |
| `OpeningTotal` | `TotaleApertura` | `TotaleApertura` |
| `ClosingTotal` | `TotaleChiusura` | `TotaleChiusura` |
| `CashSales` | `VenditeContanti` | `VenditeContanti` |
| `CashInWhite` | `IncassoContanteTracciato` | `IncassoContanteTracciato` |
| `ElectronicPayments` | `IncassiElettronici` | `IncassiElettronici` |
| `InvoicePayments` | `IncassiFattura` | `IncassiFattura` |
| `TotalSales` | `TotaleVendite` | `TotaleVendite` |
| `SupplierExpenses` | `SpeseFornitori` | `SpeseFornitori` |
| `DailyExpenses` | `SpeseGiornaliere` | `SpeseGiornaliere` |
| `ExpectedCash` | `ContanteAtteso` | `ContanteAtteso` |
| `Difference` | `Differenza` | `Differenza` |
| `NetCash` | `ContanteNetto` | `ContanteNetto` |
| `VatAmount` | `ImportoIva` | `ImportoIva` |
| `Notes` | `Note` | `Note` |
| `Status` | `Stato` | `Stato` |
| `CreatedAt` | `CreatoIl` | `CreatoIl` |
| `UpdatedAt` | `AggiornatoIl` | `AggiornatoIl` |
| `User` | `Utente` | `Utente` |
| `CashCounts` | `ConteggiMoneta` | `ConteggiMoneta` |
| `CashIncomes` | `IncassiCassa` | `IncassiCassa` |
| `CashExpenses` | `SpeseCassa` | `SpeseCassa` |

### 2.7. `CashIncome` -> `IncassoCassa`

| Campo Attuale (C#) | Campo Proposto (C#) | Colonna DB Proposta |
| :--- | :--- | :--- |
| `IncomeId` | `Id` | `Id` |
| `RegisterId` | `RegistroCassaId` | `RegistroCassaId` |
| `Type` | `Tipo` | `Tipo` |
| `Amount` | `Importo` | `Importo` |
| `CashRegister` | `RegistroCassa` | `RegistroCassa` |

### 2.8. `CashExpense` -> `SpesaCassa`

| Campo Attuale (C#) | Campo Proposto (C#) | Colonna DB Proposta |
| :--- | :--- | :--- |
| `ExpenseId` | `Id` | `Id` |
| `RegisterId` | `RegistroCassaId` | `RegistroCassaId` |
| `Description` | `Descrizione` | `Descrizione` |
| `Amount` | `Importo` | `Importo` |
| `CashRegister` | `RegistroCassa` | `RegistroCassa` |

### 2.9. `CashDenomination` -> `DenominazioneMoneta`

| Campo Attuale (C#) | Campo Proposto (C#) | Colonna DB Proposta |
| :--- | :--- | :--- |
| `DenominationId` | `Id` | `Id` |
| `Value` | `Valore` | `Valore` |
| `Type` | `Tipo` | `Tipo` |
| `DisplayOrder` | `OrdineVisualizzazione` | `OrdineVisualizzazione` |
| `CashCounts` | `ConteggiMoneta` | `ConteggiMoneta` |

### 2.10. `CashCount` -> `ConteggioMoneta`

| Campo Attuale (C#) | Campo Proposto (C#) | Colonna DB Proposta |
| :--- | :--- | :--- |
| `CountId` | `Id` | `Id` |
| `RegisterId` | `RegistroCassaId` | `RegistroCassaId` |
| `DenominationId` | `DenominazioneMonetaId` | `DenominazioneMonetaId` |
| `Quantity` | `Quantita` | `Quantita` |
| `Total` | `Totale` | `Totale` |
| `IsOpening` | `IsApertura` | `IsApertura` |
| `CashRegister` | `RegistroCassa` | `RegistroCassa` |
| `Denomination` | `Denominazione` | `Denominazione` |
