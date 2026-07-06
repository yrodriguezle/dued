# Exploration: Preferenza per-utente drag modale (free/elastic) persistita nel backend

## Current State

### Comportamento drag della modale (gia' implementato, lato client)
`AppDialog` e' la modale condivisa dell'app. Il drag da barra del titolo (pointer events, mouse+touch via `touchAction: none`) e' gia' implementato.
- `duedgusto/src/components/common/dialog/AppDialog.tsx`
  - `type DialogDragMode = "free" | "elastic"` (riga 8)
  - `export const DEFAULT_DRAG_MODE: DialogDragMode = "free"` (riga 11) — **costante hardcoded, questo e' il punto da rimuovere/sostituire con la preferenza utente**
  - prop `dragMode?: DialogDragMode` con default `= DEFAULT_DRAG_MODE` (riga 28)
  - `"free"`: al rilascio resta dove trascinata; reset a `{x:0,y:0}` (centro) ad ogni apertura (`useEffect` righe 34-40)
  - `"elastic"`: snap-back a origine al rilascio (`handlePointerUp` righe 74-77) con transizione CSS
- Nessuno dei 6 consumatori passa `dragMode` esplicitamente (tutti usano il default): `SearchboxModal.tsx`, `PeriodoProgrammazioneSection.tsx`, `GiorniNonLavorativiSection.tsx`, `MonthlyClosureDetails.tsx`, `PagamentoFornitoreDialog.tsx`, `CashRegisterMonthlyCalendar.tsx`, `PrelevaDdtDialog.tsx`. Quindi cambiare la sorgente del default propaga a tutte le modali.

### Modello utente backend — NON esistono preferenze utente persistite
- `backend/Models/Utente.cs`: entity con `Id, NomeUtente, Nome, Cognome, Descrizione, Disabilitato, TokenAggiornamento, ScadenzaTokenAggiornamento, Hash, Salt, RuoloId, Ruolo`. **Nessun campo di preferenza (no tema, no lingua, no drag).**
- `backend/DataAccess/AppDbContext.cs` righe 58-73: config `Utente` minimale (tabella `Utenti`, utf8mb4, PK, FK a Ruolo). Nessuna property configurata esplicitamente per i campi scalari (mapping per convenzione).
- Schema GraphQL utente:
  - `backend/GraphQL/Authentication/Types/UtenteType.cs` — output type `Utente` (id, nomeUtente, nome, cognome, descrizione, disabilitato, ruoloId, ruolo, menus)
  - `backend/GraphQL/Authentication/Types/UtenteInputType.cs` — input `UtenteInput` (id, nomeUtente, nome, cognome, descrizione, disabilitato, ruoloId, password)
  - Query `utenteCorrente` (l'equivalente di "me"/currentUser) in `backend/GraphQL/Authentication/AuthQueries.cs` righe 20-30 — risolve l'utente dal claim JWT. Namespace query: `authentication { utenteCorrente { ... } }`. La query `authentication` root e' `Authorize()`.
  - Mutation `mutateUtente` in `backend/GraphQL/Authentication/AuthMutations.cs` righe 138-197 — create/update. **Gotcha**: legge gli argomenti come `Dictionary<string, object>` e assegna campo per campo con `userArg.ContainsKey(...)` sia nel ramo update (150-169) sia create (171-196). Un nuovo campo va aggiunto in ENTRAMBI i rami.

### Frontend — lettura utente corrente e area profilo
- Store: `duedgusto/src/store/userStore.tsx` — slice Zustand `{ utente, receiveUtente }`. Tipo globale in `duedgusto/src/types.d.ts` righe 64-65.
- Tipo dominio: `duedgusto/src/@types/Utente.d.ts` — `type Utente = { __typename, id, nomeUtente, nome, cognome, descrizione, disabilitato, ruoloId, ruolo, menus } | null`.
- Bootstrap: `duedgusto/src/components/authentication/useBootstrap.tsx` righe 71-81 — carica l'utente via `fetchLoggedUser()` e lo mette nello store con `receiveUtente`.
- Operazioni GraphQL in `duedgusto/src/graphql/utente/`:
  - `fragment.tsx` — `UtenteFragment` (id, nomeUtente, nome, cognome, descrizione, disabilitato, ruoloId, ruolo, menus). E' il fragment condiviso da query e mutation.
  - `queries.tsx` — `getUtenteCorrente`, `getUtentePerId`.
  - `mutations.tsx` — `mutationSubmitUtente` + interfaccia TS `UtenteInput`.
  - `fetchLoggedUser.tsx`, `useQueryLoggedUser.tsx`, `useSubmitUser.tsx`, `useSignIn.tsx`.
- **ESISTE gia' una pagina profilo utente**: `duedgusto/src/components/pages/profile/ProfilePage.tsx`. Form Formik+Zod che legge `utente` dallo store, mostra dati personali + cambio password, e salva via `mutationSubmitUtente` -> `receiveUtente(updated)`. Titolo "Il mio profilo". Test: `.../profile/__tests__/ProfilePage.test.tsx`. **Questo e' il punto naturale dove aggiungere il selettore free/elastic.**

### Preferenza utente esistente: SOLO tema, e SOLO locale (localStorage)
- `duedgusto/src/store/themeStore.tsx` + `duedgusto/src/components/theme/theme.tsx` (righe 5-7): la modalita' tema e' persistita in `localStorage.getItem/setItem("theme")`. **NON e' persistita sul backend.** Quindi NON esiste ancora un pattern di preferenza utente sincronizzata sul server: quello del drag sarebbe il primo.

## Affected Areas

Backend (nuovo campo end-to-end):
- `backend/Models/Utente.cs` — aggiungere proprieta' preferenza drag
- `backend/DataAccess/AppDbContext.cs` (blocco `Utente` righe 58-73) — opzionale: config esplicita colonna (lunghezza/default)
- `backend/GraphQL/Authentication/Types/UtenteType.cs` — esporre il campo in output
- `backend/GraphQL/Authentication/Types/UtenteInputType.cs` — accettare il campo in input
- `backend/GraphQL/Authentication/AuthMutations.cs` (`mutateUtente`, rami update+create) — persistere il campo
- `backend/Migrations/` — nuova migration `AddColumn` (pattern: `20260322141031_AddAliquotaIvaToFornitore.cs`)
- Eventuale seed: `backend/SeedData/SeedTestUser.cs`

Frontend:
- `duedgusto/src/@types/Utente.d.ts` — aggiungere campo al tipo
- `duedgusto/src/graphql/utente/fragment.tsx` — aggiungere campo al `UtenteFragment` (propaga a query + mutation)
- `duedgusto/src/graphql/utente/mutations.tsx` — aggiungere campo a interfaccia `UtenteInput`
- `duedgusto/src/components/pages/profile/ProfilePage.tsx` — selettore free/elastic (schema Zod + campo form + variables della mutation)
- `duedgusto/src/components/common/dialog/AppDialog.tsx` — il default `dragMode` deve derivare dalla preferenza utente nello store invece che da `DEFAULT_DRAG_MODE`
- (eventuale) nuovo tipo enum/costante condivisa lato TS

## Approaches

1. **Nuovo campo scalare sull'entita' Utente + lettura in AppDialog dallo store** — Aggiungere `PreferenzaDragModale` (string "free"/"elastic") su `Utente`, esporlo nel fragment/currentUser, modificarlo da ProfilePage via `mutateUtente` (gia' esistente), e in `AppDialog` calcolare il default leggendo `useStore(s => s.utente?.preferenzaDragModale) ?? "free"`.
   - Pros: riusa completamente l'infrastruttura esistente (query `utenteCorrente`, mutation `mutateUtente`, ProfilePage, userStore); segue l'utente su ogni device perche' viaggia col profilo; nessun nuovo endpoint.
   - Cons: `AppDialog` diventa accoppiato allo store Zustand (oggi e' puramente presentazionale); serve fallback quando l'utente non e' ancora caricato (usare "free").
   - Effort: Low/Medium.

2. **Entita' separata `PreferenzeUtente` (1-a-1 con Utente)** — Tabella dedicata per preferenze future (tema, lingua, drag...).
   - Pros: estensibile per future preferenze; separa le preferenze dai dati identita'.
   - Cons: over-engineering per un singolo campo; nuova entita', DbSet, type/mutation GraphQL dedicati, join. Piu' lavoro.
   - Effort: Medium/High.

3. **Enum backend forte + campo tipizzato** (variante di 1) — Modellare `DragModePreference` come enum C# e `EnumerationGraphType` GraphQL invece di string libera.
   - Pros: validazione lato schema (solo free/elastic), type-safety.
   - Cons: piu' codice (enum type GraphQL); il pattern del progetto usa spesso string con validazione applicativa; `mutateUtente` legge `Dictionary<string,object>` quindi va gestita la conversione.
   - Effort: Medium.

## Recommendation

**Approccio 1**, con validazione dei valori ammessi (whitelist "free"/"elastic") a livello applicativo nella mutation e default `"free"`. Riusa al 100% l'infrastruttura utente/profilo gia' presente (ProfilePage + mutateUtente + utenteCorrente + userStore) ed e' il percorso a minor rischio. Il campo va come colonna **non-nullable con default `"free"`** (allineato al requisito "default nuovi utenti free"): la migration usa `AddColumn<string>(..., nullable: false, defaultValue: "free")` cosi' gli utenti esistenti ereditano "free" senza backfill manuale. Se in futuro si vorra' aggiungere il tema/lingua sul backend, si potra' valutare la migrazione all'approccio 2, ma non ora.

Punti da definire in fase di proposal/design:
- Nome del campo (proposta: `PreferenzaDragModale` backend / `preferenzaDragModale` GraphQL/TS).
- Tipo: string con whitelist applicativa (semplice, coerente col progetto) vs enum GraphQL (piu' robusto). Raccomando string + validazione.
- UI del selettore in ProfilePage: nuova sezione "Preferenze" con un RadioGroup/Select MUI (free = "Resta dove la lasci", elastic = "Torna al centro").

## Risks

- **Doppio ramo in `mutateUtente`**: il nuovo campo va aggiunto sia in update sia in create, altrimenti il salvataggio dal profilo lo ignora silenziosamente. La lettura via `Dictionary<string,object>` richiede `ContainsKey` + default "free".
- **AppDialog senza utente caricato**: durante bootstrap/logout `utente` puo' essere `null`; serve fallback "free" per non rompere le modali (es. la modale di login/searchbox potrebbe aprirsi prima del caricamento profilo).
- **Accoppiamento presentazionale**: introdurre `useStore` in `AppDialog` (oggi stateless) va fatto con attenzione ai test esistenti che montano le modali; valutare se leggere la preferenza nei consumatori o via un piccolo hook dedicato (`useDragModePreference`).
- **Migration su colonna non-nullable**: usare `defaultValue: "free"` per gli utenti esistenti; senza default MySQL fallirebbe su tabella non vuota.
- **Test da aggiornare**: `ProfilePage.test.tsx`, eventuali test di `userStore`/`AppDialog`, e i test di integrazione GraphQL backend su `mutateUtente`/`utenteCorrente` (fragment cambia).
- **Coerenza tema**: valutare se in futuro migrare anche la preferenza tema (oggi localStorage) sul backend per uniformita'; fuori scope ora.

## Ready for Proposal

Yes. Requisito chiaro, infrastruttura utente/profilo gia' presente e riusabile, rischio basso. L'orchestrator puo' procedere con `/sdd:new modale-drag-preferenza-utente` (proposal) usando l'Approccio 1: colonna non-nullable default "free" su `Utente`, esposizione via fragment/currentUser, modifica da ProfilePage tramite `mutateUtente`, lettura in `AppDialog` dallo `userStore` con fallback "free".
