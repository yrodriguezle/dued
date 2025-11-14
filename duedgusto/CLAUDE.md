# CLAUDE.md

Questo file fornisce indicazioni a Claude Code (claude.ai/code) quando lavora con il codice in questo repository.

## Panoramica del Progetto

Un'applicazione di gestione basata su React ("duedgusto") costruita con TypeScript, Material-UI, Apollo Client (GraphQL) e Vite. L'applicazione dispone di autenticazione, routing dinamico basato sui
permessi utente e un'architettura modulare per la gestione di utenti, ruoli e menu.

## Comandi

### Sviluppo

- `npm run dev` - Avvia il server di sviluppo (Vite) sulla porta 4001
- `npm run build` - Compila per la produzione (esegue il compilatore TypeScript e la build di Vite)
- `npm run preview` - Anteprima della build di produzione
- `npm run ts:check` - Esegue il controllo dei tipi TypeScript senza emettere file

### Linting

- `npm run lint` - Esegue ESLint sulla codebase

### Configurazione Ambiente

- `npm run env:development` - Configura l'ambiente di sviluppo
- `npm run env:staging` - Configura l'ambiente di staging
- `npm run clear` - Pulisce cache/artefatti di build

### Post-Installazione

- `npm run postinstall` - Applica patch tramite patch-package (si esegue automaticamente dopo l'installazione)

## Architettura

### Flusso Principale dell'Applicazione

1. **Processo di Bootstrap** (`src/main.tsx`)

   - Recupera la configurazione runtime da `public/config.json` (endpoint API, endpoint GraphQL, URL WebSocket)
   - Inietta la configurazione nell'oggetto globale window come interfaccia `Global`
   - Inizializza Apollo Client con autenticazione e gestione errori
   - Avvolge l'app in BrowserRouter e ApolloProvider

2. **Struttura del Routing** (`src/App.tsx`, `src/routes/`)

   - La route radice "/" contiene due rami principali:
     - `/signin` - Pagina pubblica di accesso
     - `/gestionale/*` - Route protette che richiedono autenticazione
   - Le route protette sono generate dinamicamente in base ai permessi menu dell'utente autenticato
   - Le definizioni delle route si trovano in `src/routes/routesMapping.tsx` con componenti caricati in modo lazy

3. **Sistema di Autenticazione** (`src/common/authentication/`, `src/graphql/configureClient.tsx`)

   - Autenticazione basata su JWT memorizzata in localStorage
   - Meccanismo automatico di refresh del token con coda di richieste in sospeso
   - L'error link di Apollo Client intercetta gli errori `ACCESS_DENIED` (HTTP 401) e attiva il refresh del token
   - Le route protette verificano lo stato di autenticazione tramite `isAuthenticated()` prima del rendering
   - L'hook di bootstrap (`src/components/authentication/useBootstrap.tsx`) inizializza lo stato utente al caricamento dell'app

4. **Gestione dello Stato** (`src/store/`)

   - Store globale basato su Zustand (`src/store/useStore.tsx`)
   - Composto da multiple slice dello store:
     - `userStore` - Dati e permessi dell'utente corrente
     - `inProgressStore` - Stati di caricamento per le operazioni
     - `themeStore` - Preferenze tema utente (modalità chiara/scura)
     - `confirmDialogStore` - Stato del dialog di conferma
     - `serverStatusStore` - Stato della connessione backend

5. **Integrazione GraphQL** (`src/graphql/`)

   - Apollo Client configurato con tre catene di link:
     - `errorLink` - Gestisce gli errori GraphQL e attiva il refresh del token
     - `authLink` - Inietta il token JWT negli header delle richieste
     - `httpLink` - Connessione HTTP all'endpoint GraphQL
   - Operazioni GraphQL organizzate per dominio (user, roles, menus)
   - Policy di cache personalizzate per campi di connessione/paginazione
   - Frammenti definiti per dominio per riutilizzabilità

6. **Architettura del Layout** (`src/components/layout/`)
   - Layout annidato con barra superiore e sidebar comprimibile
   - Navigazione sidebar costruita dinamicamente dai permessi menu dell'utente
   - Design responsive con comportamento drawer su mobile
   - Toggle tema integrato nell'header
   - Sistema di mappatura icone per icone menu dinamiche (`src/components/layout/sideBar/iconMapping.tsx`)

### Directory Principali

- `src/api/` - Helper API REST (recupero configurazione, refresh token, utility makeRequest)
- `src/common/` - Utility condivise organizzate per ambito:
  - `authentication/` - Helper autenticazione, sign-out, recupero utente
  - `bones/` - Funzioni utility stile Lodash (implementazioni personalizzate)
  - `toast/` - Wrapper notifiche toast
  - `ui/` - Utility UI (colori, modal, drawer)
  - `date/` - Utility manipolazione date
  - `form/` - Helper form (merge defaults)
- `src/components/` - Componenti React organizzati per:
  - `pages/` - Componenti pagina di primo livello (users, roles, menus, settings)
  - `layout/` - Componenti layout (HeaderBar, Sidebar)
  - `common/` - Componenti riutilizzabili (forms, datagrids, toolbar, dialog di conferma)
  - `authentication/` - Componenti relativi all'autenticazione (form sign-in, bootstrap)
  - `theme/` - Configurazione tema e hooks
- `src/graphql/` - Query GraphQL, mutation, frammenti, hooks per dominio
- `src/routes/` - Configurazione route e wrapper route protette
- `src/store/` - Slice store Zustand
- `src/@types/` - Definizioni tipi TypeScript per modelli di dominio
- `src/types.d.ts` - Definizioni tipi globali (Store, Global, AuthToken, ecc.)

### Pattern Importanti

**Generazione Route Dinamiche**: Le route non sono definite staticamente. Invece, vengono generate a runtime in base ai permessi menu dell'utente (memorizzati in `user.menus`). Il componente
`ProtectedRoutes` filtra i menu con percorsi e li mappa a componenti caricati in modo lazy da `routesMapping`.

**Coda Refresh Token**: Quando si verifica un errore `ACCESS_DENIED`, l'error link di Apollo Client previene richieste di refresh duplicate usando un flag `isRefreshing` e mette in coda le richieste
in sospeso in `pendingRequests`. Dopo il successo del refresh, tutte le richieste in coda vengono risolte con header aggiornati.

**Libreria Utility Personalizzata**: La directory `src/common/bones/` contiene implementazioni personalizzate di funzioni utility comuni (come lodash) per evitare dipendenze esterne. Queste includono
`flatMap`, `keyBy`, `omitDeep`, `isEmpty`, ecc.

**Guidato dalla Configurazione**: L'applicazione legge la configurazione runtime da `public/config.json` piuttosto che da variabili d'ambiente, permettendo allo stesso build di essere deployato su più
ambienti senza ricompilare.

**Integrazione Formik + Material-UI**: I form usano Formik con componenti campo Material-UI personalizzati (`FormikTextField`, `FormikCheckbox`, `FormikSearchbox`) che connettono lo stato campo di
Formik ai componenti MUI.

**Integrazione AG Grid**: Le tabelle dati usano AG Grid Enterprise (`ag-grid-react`, `ag-grid-enterprise`) con localizzazione personalizzata (traduzioni italiane in
`src/components/common/datagrid/i18n/`).

## Configurazione TypeScript

Il progetto usa i riferimenti di progetto TypeScript:

- `tsconfig.json` - Configurazione radice (fa riferimento a configurazioni app e node)
- `tsconfig.app.json` - Configurazione codice sorgente applicazione
- `tsconfig.node.json` - Configurazione Node/strumenti build

Tutti i file sorgente usano l'estensione `.tsx` anche per file TypeScript non-JSX (decisione architetturale).

## Configurazione Ambiente

La configurazione runtime viene caricata da `public/config.json` (non file `.env`). Questo file definisce:

- `API_ENDPOINT` - URL base API REST
- `GRAPHQL_ENDPOINT` - URL endpoint GraphQL
- `GRAPHQL_WEBSOCKET` - Endpoint WebSocket per sottoscrizioni GraphQL
- `COPYRIGHT` - Testo copyright per il footer
- `CONNECTION_INTERVAL_UPDATE_TIME` - Intervallo controllo salute connessione

## Regole ESLint

Regole ESLint personalizzate applicate:

- `no-console: warn` - Avviso sull'uso di console
- `object-shorthand: ["error", "always"]` - Richiede sintassi object shorthand
- Regole React Hooks applicate tramite `eslint-plugin-react-hooks`

## Dipendenze

**Framework Core**: React 19, React Router 7, TypeScript 5.7

**Libreria UI**: Material-UI v6 (@mui/material, @emotion/react, @emotion/styled)

**Recupero Dati**: Apollo Client 3 con GraphQL

**Gestione Stato**: Zustand 5

**Form**: Formik 2 con validazione Zod

**Data Grid**: AG Grid Enterprise (richiede licenza)

**Strumento Build**: Vite 6 con plugin SWC per fast refresh

## Problemi Comuni

**Licenza AG Grid**: Questo progetto usa `ag-grid-enterprise` che richiede una chiave di licenza valida. Se incontri avvisi di licenza, la chiave deve essere configurata.

**Errori TypeScript**: Esegui `npm run ts:check` per verificare errori di tipo senza compilare. I commit recenti mostrano correzioni di errori TypeScript in corso, quindi potrebbero ancora esistere
alcuni problemi di tipo.

**Conflitti Porta**: Il server dev gira sulla porta 4001. Se questa porta è in uso, modifica `vite.config.ts`.

**HTTPS in Sviluppo**: Il `config.json` predefinito usa URL HTTPS (`https://localhost:4000`). Assicurati che l'API backend supporti HTTPS o aggiorna la configurazione per HTTP.
