# Tasks: Searchbox UX Improvements

## Phase 1: Foundation — Type System Cleanup

- [x] 1.1 In `src/@types/searchbox.d.ts`: rinominare `DatagridColDef<T>` in `SearchboxColDef<T>` (mantiene `extends ColDef<T>` con campi `graphField` e `action`). Rimuovere l'export del vecchio nome.
- [x] 1.2 In `src/@types/searchbox.d.ts`: aggiornare `SearchboxOptions<T>` per usare `SearchboxColDef<T>` sia per `items` che per `modal.items`.
- [x] 1.3 Aggiornare `src/components/common/form/searchbox/searchboxOptions/fornitoreSearchboxOptions.tsx`: import `SearchboxColDef` al posto di `DatagridColDef`, aggiornare il tipo dell'array `items`.
- [x] 1.4 Aggiornare `src/components/common/form/searchbox/searchboxOptions/utenteSearchboxOptions.tsx`: import `SearchboxColDef` al posto di `DatagridColDef`, aggiornare il tipo dell'array `items`.
- [x] 1.5 Aggiornare `src/components/common/form/searchbox/searchboxOptions/ruoloSearchboxOptions.tsx`: import `SearchboxColDef` al posto di `DatagridColDef`, aggiornare il tipo dell'array `items`.
- [x] 1.6 Aggiornare `src/components/common/form/searchbox/searchboxOptions/menuSearchboxOptions.tsx`: import `SearchboxColDef` al posto di `DatagridColDef`, aggiornare il tipo dell'array `items`.
- [x] 1.7 Aggiornare `src/components/common/form/searchbox/searchboxOptions/fatturaAcquistoSearchboxOptions.tsx`: import `SearchboxColDef` al posto di `DatagridColDef`, aggiornare il tipo dell'array `items`.

## Phase 2: Core Implementation — Type Flow Fix

- [x] 2.1 In `src/components/common/form/searchbox/GridResults.tsx`: cambiare la prop `columnDefs` da `ColDef<T>[]` a `SearchboxColDef<T>[]` nell'interfaccia `GridResultsProps`. Aggiornare `wrappedColumnDefs` per mappare correttamente `SearchboxColDef<T>` a `ColDef<DatagridData<T>>` senza `as any` — estrarre `graphField` e `action` dal destructuring e costruire l'oggetto `ColDef` pulito. Eliminare il cast `as any` a riga 37 (`field: col.field as any`) e il cast `as any` a riga 114 (`columnDefs={wrappedColumnDefs as any}`).
- [x] 2.2 In `src/components/common/form/searchbox/SearchboxModal.tsx`: cambiare la prop `columnDefs` da `DatagridColDef<T>[]` (importato da Datagrid) a `SearchboxColDef<T>[]` (importato da searchbox.d.ts). Mappare internamente `SearchboxColDef<T>` a `DatagridColDef<DatagridData<T>>` per passare a `<Datagrid>` senza cast. Rimuovere l'import di `DatagridColDef` da `../../datagrid/@types/Datagrid`.
- [x] 2.3 In `src/components/common/form/searchbox/Searchbox.tsx` riga 252: rimuovere il cast `options.modal.items as any` — dopo le modifiche ai tipi, `SearchboxColDef<T>` sara' accettato direttamente da `SearchboxModal`. Rimuovere il commento eslint-disable associato.
- [x] 2.4 Verificare: eseguire `npm run ts:check` e confermare 0 errori nei file modificati. Eseguire `npm run lint` e confermare 0 warning `@typescript-eslint/no-explicit-any` nei file searchbox.

## Phase 3: Core Implementation — Grid Always Visible + Arrow Up

- [ ] 3.1 In `src/components/common/form/searchbox/Searchbox.tsx`: rimuovere il branch condizionale a righe 214-234 (il blocco `{!loading && ... ? <Paper>...</Paper> : <ContainerGridResults>}`). Rendere sempre `<ContainerGridResults>` quando `resultsVisible` e' true. Rimuovere l'import di `Typography` se non piu' usato.
- [ ] 3.2 In `src/components/common/form/searchbox/GridResults.tsx`: aggiungere la prop `overlayNoRowsTemplate` con valore `"Nessun risultato trovato"` al componente `<AgGrid>` per gestire lo stato vuoto nativamente in AG Grid.
- [ ] 3.3 In `src/components/common/form/searchbox/GridResults.tsx`: aggiungere la prop `onNavigateBack?: () => void` all'interfaccia `GridResultsProps<T>`. Nel handler `handleCellKeyDown`, aggiungere un check: se `keyboardEvent.key === "ArrowUp"` e `params.rowIndex === 0`, chiamare `event.preventDefault()` sul keyboardEvent, deselezionare tutte le righe tramite `params.api.deselectAll()`, e invocare `onNavigateBack?.()`.
- [ ] 3.4 In `src/components/common/form/searchbox/ContainerGridResults.tsx`: aggiungere la prop `onNavigateBack?: () => void` all'interfaccia `ContainerGridResultsProps<T>`. Passarla a `<GridResults onNavigateBack={onNavigateBack} />`.
- [ ] 3.5 In `src/components/common/form/searchbox/Searchbox.tsx`: creare un callback `handleNavigateBack` che chiama `inputRef.current?.focus()`. Passarlo a `<ContainerGridResults onNavigateBack={handleNavigateBack} />`.

## Phase 4: Testing — Debounce Verification

- [ ] 4.1 Creare `src/graphql/common/__tests__/useFetchData.test.tsx`. Setup: mockare `@apollo/client` con `useApolloClient` che restituisce un mock `client` con `watchQuery` e `query`. Usare `vi.useFakeTimers()` per controllare il tempo.
- [ ] 4.2 Test: "non esegue la query prima di 300ms" — renderizzare `useFetchData` con variabili valide, verificare che `client.watchQuery` non venga chiamato prima di `vi.advanceTimersByTime(299)`, poi verificare che venga chiamato dopo `vi.advanceTimersByTime(1)`.
- [ ] 4.3 Test: "cancella il timer precedente su cambio variabili" — renderizzare, cambiare variabili a 200ms, avanzare di altri 300ms, verificare che `client.watchQuery` venga chiamato solo 1 volta (con le ultime variabili).
- [ ] 4.4 Test: "non esegue la query quando skip e' true" — renderizzare con `skip: true`, avanzare di 500ms, verificare che `client.watchQuery` non venga mai chiamato.
- [ ] 4.5 Test: "pulisce il timeout su unmount" — renderizzare, unmountare prima di 300ms, avanzare di 500ms, verificare che `client.watchQuery` non venga chiamato.
- [ ] 4.6 Test: "annulla la subscription precedente quando le variabili cambiano" — renderizzare, far partire il fetch, cambiare variabili, verificare che `unsubscribe` venga chiamato sulla subscription precedente.

## Phase 5: Testing — E2E Searchbox UX

- [ ] 5.1 In `e2e/functional/searchbox-features.spec.ts` (o nuovo file `e2e/functional/searchbox-ux.spec.ts`): aggiungere test "mostra messaggio vuoto nella griglia quando non ci sono risultati" — digitare una stringa senza match (es. "ZZZZZ"), attendere il dropdown, verificare che il messaggio "Nessun risultato trovato" sia visibile dentro la griglia (non in un Paper separato).
- [ ] 5.2 Aggiungere test "Arrow Up dalla prima riga torna focus al textfield" — digitare un termine con risultati, premere ArrowDown per entrare nella griglia, verificare che una riga sia selezionata, premere ArrowUp, verificare che il focus torni al textfield (l'input ha focus).
- [ ] 5.3 Aggiungere test "digitazione rapida non genera query eccessive" — digitare 5 caratteri velocemente (intervallo <100ms tra caratteri), misurare il numero di richieste GraphQL intercettate, verificare che siano <= 2 (debounce 300ms raggruppa i caratteri).

## Phase 6: Cleanup

- [ ] 6.1 In `src/components/common/form/searchbox/Searchbox.tsx`: rimuovere l'import di `Paper` se non piu' utilizzato dopo la rimozione del branch vuoto (riga 5).
- [ ] 6.2 Grep nel modulo searchbox per `as any`, `as unknown`, `eslint-disable.*no-explicit-any` — verificare che siano rimasti solo i cast strettamente necessari nel boundary con `DatagridData<T>` (wrapping/unwrapping status).
- [ ] 6.3 Eseguire `npm run ts:check` e `npm run lint` — confermare 0 errori e 0 warning nuovi.
