# Tasks: menu-crud-mutation

## Phase 1: Backend — Infrastructure (MenuInputType)

- [ ] 1.1 Creare il file `backend/GraphQL/Authentication/Types/MenuInputType.cs` con la classe `MenuInputType : InputObjectGraphType<Menu>`. Definire i campi: `Id` (NonNull Int), `Titolo` (NonNull String), `Percorso` (String), `Icona` (String), `Visibile` (Boolean), `Posizione` (Int), `PercorsoFile` (String), `NomeVista` (String), `MenuPadreId` (Int nullable). Seguire il pattern di `RuoloInputType.cs`. (SPEC-01)

## Phase 2: Backend — Mutations (AuthMutations.cs)

- [ ] 2.1 Aggiungere la mutation `mutateMenus` in `backend/GraphQL/Authentication/AuthMutations.cs`. Firma: `Field<ListGraphType<MenuType>, List<Menu>>("mutateMenus")` con argomento `menus: [MenuInput!]!`. Logica upsert: `id == 0` → `Add()`, `id > 0` → `FindAsync()` e aggiorna campi. Un solo `SaveChangesAsync()` alla fine. Ritorna la lista dei menu processati. (SPEC-02, scenari 02.1–02.5)

- [ ] 2.2 Aggiungere la mutation `deleteMenus` in `backend/GraphQL/Authentication/AuthMutations.cs`. Firma: `Field<BooleanGraphType, bool>("deleteMenus")` con argomento `ids: [Int!]!`. Logica: caricare i menu con `Where(m => ids.Contains(m.Id))`, `RemoveRange()`, `SaveChangesAsync()`, ritornare `true`. (SPEC-03, scenari 03.1–03.4)

- [ ] 2.3 Verificare che il backend compili senza errori: eseguire `dotnet build` nella directory `backend/`. (SPEC-09, scenario 09.2)

## Phase 3: Frontend — GraphQL Layer (mutations, hooks)

- [x] 3.1 Creare il file `duedgusto/src/graphql/menus/mutations.tsx`. Definire le interfacce `MenuInput`, `SubmitMenusValues`, `SubmitMenusData`, `DeleteMenusData`. Definire i documenti `mutationSubmitMenus` (con `menuFragment`) e `mutationDeleteMenus`. Seguire il pattern di `src/graphql/ruolo/mutations.tsx`. (SPEC-04, scenari 04.1–04.2)

- [x] 3.2 Riscrivere `duedgusto/src/graphql/menus/useSubmitMenu.tsx`. Rimuovere lo stub con `setTimeout`. Usare `useMutation(mutationSubmitMenus)`. Esportare `submitMenus`, `data`, `error`, `loading`. Seguire il pattern di `src/graphql/ruolo/useSubmitRole.tsx`. (SPEC-05, scenari 05.1–05.2)

- [x] 3.3 Creare il file `duedgusto/src/graphql/menus/useDeleteMenus.tsx`. Usare `useMutation(mutationDeleteMenus)`. Esportare `deleteMenus` e `loading`. Skip della mutation se la lista di ID è vuota. Seguire il pattern di `src/graphql/ruolo/useDeleteRuolo.tsx`. (SPEC-06, scenari 06.1–06.2)

## Phase 4: Frontend — Integration (MenuForm + MenuDetails)

- [x] 4.1 Modificare `duedgusto/src/components/pages/menu/MenuForm.tsx`: accettare le nuove props `deletedRowIdsRef: React.MutableRefObject<number[]>` e `gridApiRef: React.MutableRefObject<GridReadyEvent | null>`. Implementare il callback `onRowsDeleted` per popolare `deletedRowIdsRef` (solo `id > 0`). Collegare `onGridReady` per salvare l'API reference in `gridApiRef`. (SPEC-07, scenari 07.1–07.2)

- [x] 4.2 Modificare `duedgusto/src/components/pages/menu/MenuDetails.tsx`: creare `deletedRowIdsRef = useRef<number[]>([])` e `gridApiRef = useRef<GridReadyEvent | null>(null)`. Passare entrambi come props a `MenuForm`. (SPEC-07, scenario 07.2; preparazione per SPEC-08)

- [x] 4.3 Riscrivere `onSubmit` in `duedgusto/src/components/pages/menu/MenuDetails.tsx`: leggere i dati della griglia da `gridApiRef` con `forEachNode`, filtrare righe `Modified`/`Added`, rimuovere `__typename` e `status`, mappare a `MenuInput`. Leggere `deletedRowIdsRef.current`. Eseguire nell'ordine: `deleteMenus(ids)` (se ids.length > 0) → `submitMenus({menus})` (se menus.length > 0) → `refetch()`. Gestire errori con toast. Resettare `deletedRowIdsRef` e `gridDirty` dopo il successo. (SPEC-08, scenari 08.1–08.6)

## Phase 5: Verification

- [ ] 5.1 Eseguire `dotnet build` nella directory `backend/` e verificare zero errori di compilazione. (SPEC-09, scenario 09.2)

- [ ] 5.2 Eseguire `npm run ts:check` nella directory `duedgusto/` e verificare zero errori TypeScript. (SPEC-09, scenario 09.1)

- [ ] 5.3 Eseguire `npm run lint` nella directory `duedgusto/` e verificare zero errori ESLint (warning accettabili). (SPEC-09, scenario 09.3)

- [ ] 5.4 Test manuale: modificare un campo di un menu esistente, salvare, ricaricare la pagina, verificare che la modifica sia persistita. (Proposal: Success Criteria 1)

- [ ] 5.5 Test manuale: aggiungere una nuova voce menu (id=0), salvare, ricaricare la pagina, verificare che la voce esista con ID reale. (Proposal: Success Criteria 2)

- [ ] 5.6 Test manuale: cancellare una voce menu dalla griglia, salvare, ricaricare la pagina, verificare che sia sparita. (Proposal: Success Criteria 3)

- [ ] 5.7 Test manuale: verificare che in caso di errore del server, il toast di errore venga mostrato e i dati nella griglia non vengano persi. (Proposal: Success Criteria 6)
