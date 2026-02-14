# CLAUDE.md

Questo file fornisce indicazioni a Claude Code (claude.ai/code) quando lavora con il codice in questo repository.

## Panoramica del Progetto

DuedGusto è un sistema full-stack per la gestione cassa e punto vendita composto da:
- **Backend**: .NET 8.0 ASP.NET Core con API GraphQL e autenticazione REST
- **Frontend**: React 19 + TypeScript + Vite con Material-UI e Apollo Client

## Avvio Rapido

### Prima Volta / Cambio Rete
```bash
npm run setup
```
Rileva l'IP locale e configura `duedgusto/public/config.json` per il test su più dispositivi.

### Avviare il Backend
```bash
cd backend && dotnet run
```
Si avvia su `https://0.0.0.0:4000` (tutte le interfacce di rete). Le migrazioni del database vengono eseguite automaticamente all'avvio.

### Avviare il Frontend
```bash
cd duedgusto && npm run dev
```
Si avvia su `http://0.0.0.0:4001`.

## Struttura del Progetto

```
dued/
├── backend/           # .NET 8.0 (GraphQL + REST)
│   └── CLAUDE.md      # Guida specifica per il backend
├── duedgusto/         # Frontend React
│   └── CLAUDE.md      # Guida specifica per il frontend
└── setup-dev-environment.js
```

**Importante**: Usa l'indirizzo IP (non localhost) per accedere all'app affinché i cookie funzionino correttamente.

## Riepilogo Architettura

### Backend (`backend/CLAUDE.md`)
- GraphQL.NET come API principale, REST solo per endpoint di autenticazione
- Entity Framework Core con MySQL 8.0+
- Autenticazione JWT con refresh token httpOnly
- Protezione CSRF tramite pattern double-submit cookie
- Architettura a livelli: Controllers → GraphQL → Services → DataAccess

### Frontend (`duedgusto/CLAUDE.md`)
- Routing dinamico basato sui permessi menu utente dal database
- Apollo Client con coda automatica per il refresh dei token
- Zustand per la gestione dello stato globale
- Configurazione runtime da `public/config.json` (non file .env)
- Tutti i file sorgente usano estensione `.tsx` (convenzione del progetto)

## Punti di Integrazione Chiave

**Flusso di Autenticazione**:
1. Il client invia POST a `/api/auth/signin` → riceve JWT + refresh token (cookie httpOnly)
2. Apollo Client inietta il JWT nell'header Authorization
3. In caso di 401/ACCESS_DENIED, l'error link attiva il refresh del token e mette in coda le richieste in sospeso

**Route Dinamiche**:
- I menu sono memorizzati nel database con campi `path` e `filePath`
- `ProtectedRoutes.tsx` carica i componenti dinamicamente tramite `loadDynamicComponent()`
- Per aggiungere nuove pagine: creare il componente + record menu nel database

**Endpoint GraphQL**: `/graphql`
- Paginazione stile Relay per le query di lista
- Autorizzazione a livello di campo tramite attributo `.Authorize()`

## Comandi di Sviluppo

| Operazione | Comando |
|------------|---------|
| Setup ambiente dev | `npm run setup` |
| Build backend | `cd backend && dotnet build` |
| Avvio backend | `cd backend && dotnet run` |
| Dev frontend | `cd duedgusto && npm run dev` |
| Build frontend | `cd duedgusto && npm run build` |
| Lint frontend | `cd duedgusto && npm run lint` |
| Controllo TypeScript | `cd duedgusto && npm run ts:check` |
| Creare migrazione | `cd backend && dotnet ef migrations add <Nome>` |

## Database

MySQL 8.0+ con migrazioni automatiche all'avvio.

Connessione: `server=localhost;database=duedgusto;user=root;password=root`

## Note

- Nessun test unitario nel codebase
- AG Grid Enterprise richiede licenza valida
- Il frontend usa una libreria utility personalizzata in `src/common/bones/` invece di lodash
- HTTPS richiesto per il backend; la configurazione frontend usa URL HTTPS di default
