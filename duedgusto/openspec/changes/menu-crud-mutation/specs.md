# Specs: menu-crud-mutation

## Overview

Queste specifiche definiscono il comportamento atteso per le mutation GraphQL di CRUD dei menu (batch upsert e batch delete), inclusa l'integrazione frontend con Apollo Client, il tracking delle righe cancellate e il refetch post-salvataggio.

---

## SPEC-01: Backend — MenuInputType

### Descrizione
Il sistema DEVE esporre un input type GraphQL `MenuInput` che mappa tutti i campi editabili del modello `Menu`.

### Scenario 01.1: Definizione dei campi
**Given** il backend GraphQL è configurato
**When** viene registrato `MenuInputType`
**Then** lo schema DEVE includere un tipo `MenuInput` con i seguenti campi:
- `id` (Int!, obbligatorio)
- `titolo` (String!, obbligatorio)
- `percorso` (String!, obbligatorio)
- `icona` (String!, obbligatorio)
- `visibile` (Boolean!, obbligatorio)
- `posizione` (Int!, obbligatorio)
- `percorsoFile` (String!, obbligatorio)
- `nomeVista` (String!, obbligatorio)
- `menuPadreId` (Int, nullable)

### Vincoli
- `MenuInputType` DEVE estendere `InputObjectGraphType<Menu>` seguendo il pattern di `RuoloInputType`.
- Il file DEVE risiedere in `backend/GraphQL/Authentication/Types/MenuInputType.cs`.

---

## SPEC-02: Backend — Mutation mutateMenus (batch upsert)

### Descrizione
Il sistema DEVE esporre una mutation `mutateMenus` che riceve una lista di `MenuInput` e esegue batch upsert (insert per id=0, update per id>0).

### Scenario 02.1: Upsert di menu esistenti (update)
**Given** il database contiene menu con id 1, 2, 3
**When** il client invia `mutateMenus(menus: [{id: 1, titolo: "Home Mod", ...}, {id: 2, titolo: "Settings Mod", ...}])`
**Then** i menu con id 1 e 2 DEVONO essere aggiornati con i nuovi valori
**And** la mutation DEVE ritornare la lista dei menu aggiornati con tutti i campi del `MenuFragment`

### Scenario 02.2: Insert di nuovi menu (id=0)
**Given** il database contiene menu esistenti
**When** il client invia `mutateMenus(menus: [{id: 0, titolo: "Nuovo", percorso: "/gestionale/nuovo", ...}])`
**Then** il sistema DEVE creare un nuovo record `Menu` nel database
**And** il menu ritornato DEVE avere un `id` generato dal database (id > 0)
**And** tutti gli altri campi DEVONO corrispondere ai valori inviati

### Scenario 02.3: Batch misto (insert + update)
**Given** il database contiene menu con id 1 e 2
**When** il client invia `mutateMenus(menus: [{id: 1, titolo: "Mod"}, {id: 0, titolo: "Nuovo"}])`
**Then** il menu con id=1 DEVE essere aggiornato
**And** un nuovo menu DEVE essere creato con id assegnato dal database
**And** la lista ritornata DEVE contenere entrambi i menu

### Scenario 02.4: Menu non trovato per update
**Given** il database NON contiene un menu con id=999
**When** il client invia `mutateMenus(menus: [{id: 999, titolo: "Fantasma", ...}])`
**Then** il sistema DEVE trattare l'id inesistente come un insert (crea un nuovo record)
**Or** il sistema PUÒ lanciare un `ExecutionError` indicando che il menu non è stato trovato

> **Nota di design**: L'implementazione DOVREBBE seguire il pattern upsert (id=0 → insert, id>0 → cerca e aggiorna, se non trovato → insert). Questo allinea al comportamento delle griglie AG Grid dove le nuove righe hanno id=0.

### Scenario 02.5: Aggiornamento del campo menuPadreId (riorganizzazione gerarchia)
**Given** un menu con id=5 ha `menuPadreId=null` (root)
**When** il client invia `mutateMenus(menus: [{id: 5, menuPadreId: 2, ...}])`
**Then** il menu con id=5 DEVE avere `menuPadreId=2` nel database
**And** la gerarchia dei menu DEVE riflettere il nuovo parent

### Vincoli
- La mutation DEVE essere registrata in `AuthMutations.cs` con firma: `mutateMenus(menus: [MenuInput!]!): [Menu]`
- DEVE usare `ListGraphType<NonNullGraphType<MenuInputType>>` come tipo argomento
- DEVE ritornare `ListGraphType<MenuType>` con i dati aggiornati inclusi gli id generati
- DEVE usare `AppDbContext` tramite `GraphQLService.GetService<AppDbContext>(context)`
- DEVE chiamare `SaveChangesAsync()` una sola volta dopo tutte le operazioni di upsert

---

## SPEC-03: Backend — Mutation deleteMenus (batch delete)

### Descrizione
Il sistema DEVE esporre una mutation `deleteMenus` che riceve una lista di ID interi e rimuove i menu corrispondenti.

### Scenario 03.1: Delete di menu senza figli
**Given** il database contiene menu con id 10, 11 senza figli
**When** il client invia `deleteMenus(ids: [10, 11])`
**Then** i menu con id 10 e 11 DEVONO essere rimossi dal database
**And** la mutation DEVE ritornare `true`

### Scenario 03.2: Delete di menu con figli (cascade)
**Given** il menu con id=3 ha figli con id=4 e id=5 (menuPadreId=3)
**And** il database ha la relazione `OnDelete: Cascade` configurata su `MenuPadreId`
**When** il client invia `deleteMenus(ids: [3])`
**Then** il menu con id=3 DEVE essere rimosso
**And** i menu figli (id=4, id=5) DEVONO essere rimossi automaticamente dalla cascade di EF Core
**And** la mutation DEVE ritornare `true`

### Scenario 03.3: Delete di ID inesistente
**Given** il database NON contiene un menu con id=999
**When** il client invia `deleteMenus(ids: [999])`
**Then** il sistema DOVREBBE ignorare silenziosamente gli ID non trovati
**And** la mutation DEVE ritornare `true` se non ci sono errori

### Scenario 03.4: Lista vuota di ID
**Given** qualsiasi stato del database
**When** il client invia `deleteMenus(ids: [])`
**Then** la mutation DEVE ritornare `true` senza eseguire operazioni

### Vincoli
- La mutation DEVE essere registrata in `AuthMutations.cs` con firma: `deleteMenus(ids: [Int!]!): Boolean`
- DEVE usare `ListGraphType<NonNullGraphType<IntGraphType>>` come tipo argomento
- DEVE ritornare `BooleanGraphType`
- DEVE chiamare `SaveChangesAsync()` dopo la rimozione

---

## SPEC-04: Frontend — mutations.tsx (documenti GraphQL)

### Descrizione
Il frontend DEVE definire i documenti GraphQL tipizzati per le mutation di menu.

### Scenario 04.1: Definizione mutationSubmitMenus
**Given** il file `src/graphql/menus/mutations.tsx` esiste
**When** viene importato `mutationSubmitMenus`
**Then** DEVE essere un `TypedDocumentNode` che mappa:
- **Variables**: `{ menus: MenuInput[] }` dove `MenuInput` include tutti i campi del menu
- **Data**: `{ authentication: { mutateMenus: Menu[] } }`
- DEVE includere il `menuFragment` per i campi di ritorno

### Scenario 04.2: Definizione mutationDeleteMenus
**Given** il file `src/graphql/menus/mutations.tsx` esiste
**When** viene importato `mutationDeleteMenus`
**Then** DEVE essere un `TypedDocumentNode` che mappa:
- **Variables**: `{ ids: number[] }`
- **Data**: `{ authentication: { deleteMenus: boolean } }`

### Vincoli
- Il file DEVE seguire lo stesso pattern di `src/graphql/ruolo/mutations.tsx`
- DEVE usare estensione `.tsx` (convenzione progetto)
- Le interfacce TypeScript per i tipi di input e risposta DEVONO essere esportate
- DEVE importare e usare `menuFragment` da `./fragments`

---

## SPEC-05: Frontend — useSubmitMenu.tsx (riscrittura)

### Descrizione
L'hook `useSubmitMenu` DEVE essere riscritto per usare `useMutation` di Apollo Client con la mutation reale.

### Scenario 05.1: Invocazione con successo
**Given** il componente usa `useSubmitMenu()`
**When** viene chiamato `submitMenus(menus)`
**Then** DEVE invocare la mutation `mutationSubmitMenus` con le variabili fornite
**And** DEVE ritornare la lista di menu aggiornati dalla risposta del server

### Scenario 05.2: Errore del server
**Given** il server ritorna un errore GraphQL
**When** viene chiamato `submitMenus(menus)`
**Then** DEVE propagare l'errore al chiamante (via throw o return null)

### Vincoli
- DEVE seguire lo stesso pattern di `src/graphql/ruolo/useSubmitRole.tsx`
- DEVE esportare `submitMenus` (nome al plurale, dato che è batch)
- DEVE esporre `loading` e `error` dallo stato della mutation
- Il file DEVE mantenere il path `src/graphql/menus/useSubmitMenu.tsx`

---

## SPEC-06: Frontend — useDeleteMenus.tsx (nuovo hook)

### Descrizione
Il frontend DEVE fornire un hook `useDeleteMenus` per invocare la mutation batch delete.

### Scenario 06.1: Invocazione con successo
**Given** il componente usa `useDeleteMenus()`
**When** viene chiamato `deleteMenus([10, 11])`
**Then** DEVE invocare la mutation `mutationDeleteMenus` con `{ ids: [10, 11] }`
**And** DEVE ritornare `true` in caso di successo

### Scenario 06.2: Lista vuota
**Given** il componente usa `useDeleteMenus()`
**When** viene chiamato `deleteMenus([])`
**Then** NON DEVE invocare la mutation (skip per ottimizzazione)
**And** DEVE ritornare `true`

### Vincoli
- DEVE seguire lo stesso pattern di `src/graphql/ruolo/useDeleteRuolo.tsx`
- Il file DEVE risiedere in `src/graphql/menus/useDeleteMenus.tsx`
- DEVE usare estensione `.tsx`
- DEVE esporre `deleteMenus` e `loading`

---

## SPEC-07: Frontend — MenuForm: tracking righe cancellate

### Descrizione
`MenuForm` DEVE tracciare le righe cancellate dalla griglia tramite un ref, per consentire l'invio degli ID al backend al momento del salvataggio.

### Scenario 07.1: Registrazione righe cancellate
**Given** la griglia contiene menu con id 1, 2, 3, 4
**And** il form è in modalità edit (non readOnly)
**When** l'utente seleziona e cancella le righe con id 2 e 4
**Then** il ref `deletedRowIds` DEVE contenere `[2, 4]`
**And** solo righe con id > 0 DEVONO essere tracciate (le nuove righe con id=0 non servono)

### Scenario 07.2: Accesso al ref dal componente padre
**Given** `MenuForm` espone `deletedRowIds` e `getGridData` al padre
**When** `MenuDetails` accede a questi valori durante il submit
**Then** DEVE poter leggere la lista di ID cancellati e i dati correnti della griglia

### Vincoli
- DEVE usare `useRef<number[]>` per tracciare gli ID cancellati
- DEVE sfruttare la callback `onRowsDeleted` già esposta dal componente `Datagrid`
- Le nuove righe (id=0) cancellate dalla griglia NON DEVONO essere aggiunte al ref
- Il ref DEVE essere resettato dopo un salvataggio riuscito
- L'accesso dal padre DEVE avvenire tramite `useImperativeHandle` + `forwardRef` oppure tramite callback props

---

## SPEC-08: Frontend — MenuDetails.onSubmit: orchestrazione salvataggio

### Descrizione
`MenuDetails.onSubmit` DEVE orchestrare il salvataggio completo: prima le delete, poi le upsert, poi il refetch.

### Scenario 08.1: Salvataggio con sole modifiche (no delete)
**Given** l'utente ha modificato/aggiunto righe nella griglia
**And** nessuna riga è stata cancellata
**When** l'utente clicca "Salva"
**Then** DEVE essere chiamato `submitMenus` con le righe che hanno status `Modified` o `Added`
**And** NON DEVE essere chiamato `deleteMenus`
**And** dopo il successo, DEVE mostrare un toast di successo
**And** DEVE eseguire refetch dei menu con `fetchPolicy: "network-only"` per sincronizzare gli ID

### Scenario 08.2: Salvataggio con sole cancellazioni
**Given** l'utente ha cancellato righe dalla griglia
**And** nessuna riga è stata modificata o aggiunta
**When** l'utente clicca "Salva"
**Then** DEVE essere chiamato `deleteMenus` con gli ID delle righe cancellate
**And** NON DEVE essere chiamato `submitMenus`
**And** dopo il successo, DEVE mostrare un toast di successo
**And** DEVE eseguire refetch dei menu

### Scenario 08.3: Salvataggio misto (modifiche + cancellazioni)
**Given** l'utente ha modificato righe e cancellato altre
**When** l'utente clicca "Salva"
**Then** DEVE eseguire prima `deleteMenus` e poi `submitMenus`
**And** l'ordine DEVE essere: delete → upsert (per evitare conflitti su menuPadreId)
**And** dopo il successo di entrambe le operazioni, DEVE mostrare un toast di successo
**And** DEVE eseguire refetch dei menu

### Scenario 08.4: Errore durante il salvataggio
**Given** l'utente clicca "Salva"
**When** una delle mutation fallisce con un errore
**Then** DEVE mostrare un toast di errore con il messaggio dell'errore
**And** NON DEVE resettare i dati nella griglia (l'utente non perde le modifiche)
**And** NON DEVE resettare il ref delle righe cancellate

### Scenario 08.5: Salvataggio senza modifiche
**Given** nessuna riga è stata modificata, aggiunta o cancellata
**And** `gridDirty` è `false`
**When** l'utente clicca "Salva"
**Then** NON DEVE chiamare nessuna mutation
**And** PUÒ mostrare un messaggio informativo oppure non fare nulla

### Scenario 08.6: Refetch post-salvataggio sincronizza ID nuove righe
**Given** l'utente ha aggiunto righe nuove (id=0) e salvato
**When** il refetch completa con successo
**Then** la griglia DEVE visualizzare gli ID reali assegnati dal database
**And** il ref `deletedRowIds` DEVE essere resettato a `[]`
**And** il campo `gridDirty` DEVE essere reimpostato a `false`

### Vincoli
- DEVE raccogliere i dati della griglia tramite `getGridData()` dal contesto/ref della griglia
- DEVE filtrare solo le righe con `status === DatagridStatus.Modified || status === DatagridStatus.Added`
- DEVE rimuovere il campo `status` e `__typename` dai dati prima di inviarli alla mutation
- I campi inviati alla mutation DEVONO corrispondere esattamente ai campi di `MenuInput`
- L'ordine di esecuzione DEVE essere: delete (se ci sono ID) → upsert (se ci sono righe modificate) → refetch
- DEVE gestire il loading state tramite `onInProgress`/`offInProgress` durante il salvataggio

---

## SPEC-09: Compilazione e compatibilità tipi

### Scenario 09.1: TypeScript compila senza errori
**Given** tutte le modifiche sono state applicate
**When** viene eseguito `npm run ts:check`
**Then** il comando DEVE completare senza errori di tipo

### Scenario 09.2: Backend compila senza errori
**Given** tutte le modifiche backend sono state applicate
**When** viene eseguito `dotnet build` nella directory `backend/`
**Then** il comando DEVE completare senza errori di compilazione

### Scenario 09.3: ESLint passa senza errori
**Given** tutte le modifiche frontend sono state applicate
**When** viene eseguito `npm run lint`
**Then** il comando DEVE completare senza errori (warning accettabili)

---

## Riepilogo Copertura

| Spec | Area | Tipo |
|------|------|------|
| SPEC-01 | Backend InputType | Struttura |
| SPEC-02 | Backend mutateMenus | Comportamento (5 scenari) |
| SPEC-03 | Backend deleteMenus | Comportamento (4 scenari) |
| SPEC-04 | Frontend mutations.tsx | Struttura |
| SPEC-05 | Frontend useSubmitMenu | Comportamento (2 scenari) |
| SPEC-06 | Frontend useDeleteMenus | Comportamento (2 scenari) |
| SPEC-07 | Frontend tracking delete | Comportamento (2 scenari) |
| SPEC-08 | Frontend orchestrazione submit | Comportamento (6 scenari) |
| SPEC-09 | Compilazione | Validazione (3 scenari) |

**Totale**: 9 spec, 24 scenari
