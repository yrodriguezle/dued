# Sicurezza Specification

**Change**: fix-salvataggio-cassa-fase1
**Date**: 2026-06-09
**Status**: Draft

> Spec NUOVA: non esiste una spec `sicurezza` in `openspec/specs/`. Questa è una spec
> completa per il dominio, limitata ai requisiti introdotti dalla change.
> Nessuna modifica allo schema GraphQL: cambia solo il contenuto degli errori esposti.

## Purpose

Definire il comportamento del backend riguardo all'esposizione dei dettagli degli errori
GraphQL verso i client e alla gestione dei secrets di configurazione (connection string
MySQL e chiave JWT), in funzione dell'ambiente di esecuzione (Development vs produzione).

## Requirements

### Requirement: Dettagli errori GraphQL esposti solo in Development

Il backend MUST esporre i dettagli delle eccezioni nelle risposte GraphQL
(`ExposeExceptionDetails`, tipo eccezione, messaggi inner exception, stack trace) SOLO
quando l'ambiente di esecuzione è Development. In ogni altro ambiente la risposta GraphQL
per un'eccezione non gestita MUST contenere un messaggio generico senza tipo eccezione,
senza inner exception e senza stack trace. I dettagli completi dell'eccezione MUST essere
sempre registrati nei log del server in tutti gli ambienti. Le eccezioni di dominio
lanciate intenzionalmente con messaggio per l'utente (es. errore di doppia registrazione
fattura) SHOULD continuare a recapitare il loro messaggio al client in tutti gli ambienti.

(Comportamento attuale da rimuovere: `ExposeExceptionDetails = true` incondizionato e
`UnhandledExceptionDelegate` che concatena tipo, inner exception e stack trace nel
messaggio di errore anche in produzione — flag di test del commit 18d9803 in
`backend/Program.cs`.)

#### Scenario: Eccezione non gestita in produzione

- GIVEN il backend in esecuzione con ambiente diverso da Development (es. Production)
- WHEN una mutation GraphQL solleva un'eccezione non gestita (es. `DbUpdateException`)
- THEN la risposta GraphQL contiene un messaggio di errore generico
- AND la risposta non contiene tipo dell'eccezione, messaggi delle inner exception né stack trace
- AND i dettagli completi dell'eccezione sono presenti nei log del server

#### Scenario: Eccezione non gestita in Development

- GIVEN il backend in esecuzione con ambiente Development
- WHEN una query o mutation GraphQL solleva un'eccezione non gestita
- THEN la risposta GraphQL contiene i dettagli dell'eccezione utili al debug (tipo, messaggio, inner exception)
- AND i dettagli sono presenti anche nei log del server

#### Scenario: Errore di dominio con messaggio per l'utente in produzione

- GIVEN il backend in produzione
- WHEN il salvataggio del registro viene rifiutato per vera doppia registrazione di una fattura
- THEN il client riceve il messaggio applicativo esplicito previsto dal requisito di dedup (fattura e fornitore)
- AND nessuno stack trace viene incluso nella risposta

### Requirement: Secrets fuori dal repository versionato

Il file `backend/appsettings.json` versionato MUST NOT contenere secrets: né la
connection string con credenziali del database né la chiave di firma JWT. Il backend MUST
leggere connection string e chiave JWT da variabili d'ambiente (convenzione .NET, es.
`ConnectionStrings__Default`; per la chiave JWT è già supportata `JWT_SECRET_KEY`).
Un fallback con valori di sviluppo MAY esistere SOLO per l'ambiente Development (es.
`appsettings.Development.json` NON versionato ed escluso via `.gitignore`); il fallback
MUST NOT essere attivo negli altri ambienti. In ambiente non-Development, se un secret
richiesto non è configurato, l'avvio MUST fallire in modo esplicito con un messaggio che
indica la variabile mancante (fail-fast, nessun valore di default silenzioso).

#### Scenario: Repository senza secrets

- GIVEN la change applicata
- WHEN si ispeziona `backend/appsettings.json` versionato
- THEN il file non contiene la password del database (`password=root`) né la chiave JWT
- AND il file di sviluppo contenente i valori locali è elencato in `.gitignore` e non risulta tracciato da git

#### Scenario: Avvio locale in Development senza configurazione aggiuntiva

- GIVEN una macchina di sviluppo con MySQL locale standard e ambiente Development
- AND nessuna variabile d'ambiente di secrets impostata
- WHEN si esegue `cd backend && dotnet run`
- THEN l'applicazione si avvia correttamente usando il fallback di sviluppo (connection string e chiave JWT locali)
- AND le migrazioni automatiche e il login funzionano come prima della change

#### Scenario: Avvio in produzione con variabili d'ambiente

- GIVEN ambiente non-Development con `ConnectionStrings__Default` e `JWT_SECRET_KEY` impostate
- WHEN l'applicazione viene avviata
- THEN connection string e chiave JWT usate sono quelle delle variabili d'ambiente
- AND nessun valore di fallback di sviluppo viene utilizzato

#### Scenario: Secret mancante in produzione

- GIVEN ambiente non-Development senza `JWT_SECRET_KEY` (o senza connection string) configurata
- WHEN l'applicazione viene avviata
- THEN l'avvio fallisce immediatamente con un errore che indica quale configurazione manca
- AND l'applicazione non si avvia con secrets di default hardcoded
