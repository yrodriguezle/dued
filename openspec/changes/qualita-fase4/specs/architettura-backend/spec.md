# Delta for Architettura Backend

**Change**: qualita-fase4
**Date**: 2026-06-10
**Status**: Draft

> Nota: questa delta NON modifica lo schema GraphQL, i modelli EF Core o il database
> (nessuna migrazione). Refactor strutturali a comportamento invariato. Dominio nuovo:
> tutte le requirement sono ADDED.
>
> Stato attuale verificato nel codice:
> - `IUnitOfWork` espone già `BeginTransactionAsync` / `CommitTransactionAsync` /
>   `RollbackTransactionAsync` (implementati in `UnitOfWork` su `_context.Database`).
> - Boilerplate `BeginTransactionAsync / try / Commit / catch / Rollback / rethrow`
>   ripetuto nei call site: `MutateRegistroCassaOrchestrator`,
>   `ChiudiRegistroCassaOrchestrator`, `EliminaRegistroCassaOrchestrator`,
>   `FatturaAcquistoOrchestrator` (3 metodi), `PagamentoFornitoreOrchestrator` (2 metodi),
>   `DocumentoTrasportoService`, più `SettingsMutations.cs:148` che usa direttamente
>   `dbContext.Database.BeginTransactionAsync()`.
> - `ChiusuraMensileService.cs`: 662 righe, 13 metodi pubblici; la validazione
>   completezza registri (`ValidaCompletezzaRegistriAsync` + 2 helper privati di
>   calcolo giorni, righe 476-661) e i calcoli aggregati convivono col CRUD.

## ADDED Requirements

### Requirement: Punto unico di esecuzione transazionale su IUnitOfWork

`IUnitOfWork` MUST esporre un metodo `ExecuteInTransactionAsync` che incapsula in un
punto unico il ciclo di vita della transazione esplicita: begin → esecuzione del
lavoro delegato → commit; in caso di eccezione → rollback → rethrow. La semantica
MUST essere identica al boilerplate attuale:

- la transazione MUST essere avviata prima dell'esecuzione del delegato e committata solo se il delegato completa senza eccezioni;
- in caso di eccezione la transazione MUST essere rollbackata e l'eccezione originale MUST essere propagata invariata (stesso tipo, non wrappata);
- il metodo MUST supportare un valore di ritorno tipizzato (`Func<Task<T>>`) per restituire il risultato del delegato al chiamante.

#### Scenario: Commit al completamento del delegato

- GIVEN un delegato che esegue scritture multiple e completa senza eccezioni
- WHEN viene eseguito tramite `ExecuteInTransactionAsync`
- THEN la transazione viene committata
- AND tutte le scritture sono persistite
- AND il valore di ritorno del delegato è restituito al chiamante

#### Scenario: Rollback su eccezione con stato pulito

- GIVEN un delegato che esegue una prima scrittura con `SaveChangesAsync` e poi lancia un'eccezione
- WHEN viene eseguito tramite `ExecuteInTransactionAsync`
- THEN la transazione viene rollbackata
- AND nessuna delle scritture del delegato è persistita nel database (stato pulito)
- AND l'eccezione originale viene propagata al chiamante con tipo e messaggio invariati

### Requirement: Adozione dell'helper transazionale nei call site esistenti

I call site con boilerplate transazionale inline (`MutateRegistroCassaOrchestrator`,
`ChiudiRegistroCassaOrchestrator`, `EliminaRegistroCassaOrchestrator`,
`FatturaAcquistoOrchestrator`, `PagamentoFornitoreOrchestrator`,
`DocumentoTrasportoService`, `SettingsMutations`) MUST essere rifattorizzati per
passare da `ExecuteInTransactionAsync`, con comportamento identico: stesso ordine
delle operazioni, stesse eccezioni propagate, stessi dati persistiti. Al termine,
in questi file MUST NOT restare chiamate inline a `BeginTransactionAsync` /
`CommitTransactionAsync` / `RollbackTransactionAsync` (né a
`Database.BeginTransactionAsync`).

#### Scenario: Comportamento invariato del call site rifattorizzato

- GIVEN una mutation che prima del refactor committava al successo e rollbackava su errore
- WHEN la stessa operazione viene eseguita dopo il refactor
- THEN il risultato GraphQL, i dati persistiti e le eccezioni propagate sono identici a prima
- AND la suite di test backend esistente (≥234 test) resta verde

#### Scenario: Nessun boilerplate residuo

- GIVEN i file dei call site elencati dopo il refactor
- WHEN si cercano occorrenze inline di `BeginTransactionAsync`
- THEN non ne esiste alcuna fuori da `UnitOfWork`/`ExecuteInTransactionAsync` (e dai file dichiarati fuori scope)

### Requirement: ChiusuraMensileService delega validazione e calcoli a componenti estratti

La logica di validazione completezza registri (`ValidaCompletezzaRegistriAsync` e gli
helper privati di calcolo dei giorni mancanti) e i calcoli aggregati di
`ChiusuraMensileService` MUST essere estratti in componenti dedicati (validator e
calculator), con il service che delega. L'estrazione MUST essere uno spostamento di
codice a comportamento invariato, non una riscrittura.

#### Scenario: Validazione completezza con risultato identico

- GIVEN un mese con registri di cassa mancanti in alcune date operative
- WHEN viene invocata `ValidaCompletezzaRegistriAsync` per quel mese dopo l'estrazione
- THEN l'elenco delle date mancanti restituito è identico a quello pre-refactor
- AND tiene conto di giorni operativi, periodi di programmazione e giorni esclusi come prima

#### Scenario: Calcoli aggregati invariati

- GIVEN una chiusura mensile con registri, spese libere e pagamenti fornitori inclusi
- WHEN vengono calcolati gli aggregati della chiusura dopo l'estrazione del calculator
- THEN tutti i totali coincidono al centesimo con i valori pre-refactor

### Requirement: API pubblica di ChiusuraMensileService invariata

L'API pubblica di `ChiusuraMensileService` (firme e semantica dei 13 metodi pubblici
esistenti, inclusi `CreaChiusuraAsync`, `ChiudiMensileAsync`,
`ValidaCompletezzaRegistriAsync`, `DataAppartieneAMeseChiusoAsync`,
`RegistroAppartieneAMeseChiusoAsync`) MUST restare invariata: i resolver e gli
orchestrator GraphQL che la consumano MUST NOT richiedere modifiche.

#### Scenario: Call site GraphQL non toccati

- GIVEN i resolver/orchestrator che invocano `ChiusuraMensileService`
- WHEN il service viene rifattorizzato con validator e calculator estratti
- THEN i call site compilano e funzionano senza alcuna modifica
- AND `dotnet build` e `dotnet test` restano verdi
