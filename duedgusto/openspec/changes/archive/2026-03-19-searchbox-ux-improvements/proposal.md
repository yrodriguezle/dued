# Proposal: Searchbox UX Improvements

## Intent

Il componente Searchbox presenta 4 problemi che impattano UX e qualita' del codice:

1. **Debounce gia' presente ma non verificato**: `useFetchData` ha gia' un debounce di 300ms (riga 62-116), ma mancano test unitari e E2E che verifichino il comportamento e i tempi di risposta
2. **Griglia invisibile senza risultati**: quando non ci sono risultati viene mostrato un Paper statico invece della griglia AG Grid
3. **Navigazione tastiera incompleta**: Arrow Down dal textfield alla griglia funziona, ma Arrow Up dalla prima riga della griglia non torna al textfield
4. **Type-safety violata**: cast `as any` su `options.modal.items` (e altri punti) causati da conflitto di naming tra `DatagridColDef` in `searchbox.d.ts` e `Datagrid.d.ts`

## Scope

### In Scope
- Verificare con test unitari che il debounce esistente in `useFetchData` funzioni correttamente
- Verificare con test E2E che l'app risponda in tempi adeguati durante la digitazione
- Rendere `ContainerGridResults` sempre visibile quando `resultsVisible` e' true (anche con 0 risultati)
- Gestire Arrow Up dalla prima riga della griglia per tornare al textfield
- Risolvere il conflitto di tipi `DatagridColDef` eliminando tutti i cast `as any` nel modulo searchbox

### Out of Scope
- Modifiche al backend o al parser LIKE
- Modifiche al componente Datagrid base
- Aggiunta di un secondo debounce nel Searchbox (gia' presente in useFetchData)

## Approach

### 1. Verifica debounce esistente (test only)
- `useFetchData` ha gia' un `setTimeout` di 300ms (riga 62) con cleanup (riga 118) — nessun codice da aggiungere
- Scrivere test unitari per `useFetchData` che verifichino: query non parte prima di 300ms, cleanup su unmount, skip rispettato
- Scrivere test E2E che verifichino tempi di risposta adeguati durante digitazione rapida nel Searchbox

### 2. Griglia sempre visibile
- Rimuovere il branch condizionale a riga 214 di `Searchbox.tsx` che mostra il Paper "Nessun risultato"
- Renderizzare sempre `ContainerGridResults` — AG Grid gestisce lo stato vuoto con `overlayNoRowsTemplate`
- Configurare il messaggio "Nessun risultato trovato" come `noRowsOverlayComponent` o `overlayNoRowsTemplate`

### 3. Arrow Up → focus textfield
- In `GridResults.tsx`: nel handler `onCellKeyDown`, intercettare Arrow Up quando `rowIndex === 0`
- Invocare un nuovo callback `onNavigateBack` passato da Searchbox → ContainerGridResults → GridResults
- Il callback chiama `inputRef.current?.focus()` e deseleziona la riga

### 4. Type cleanup
- Rinominare `DatagridColDef` in `searchbox.d.ts` → `SearchboxColDef<T>` (basato su `ColDef<T>` raw, con `graphField` e `action`)
- `SearchboxOptions.items` e `SearchboxOptions.modal.items` usano `SearchboxColDef<T>`
- `GridResults` e `SearchboxModal` ricevono `SearchboxColDef<T>[]` e fanno internamente il wrapping a `ColDef<DatagridData<T>>` dove necessario
- Aggiornare tutti i file searchboxOptions (fornitore, utente, ruolo, menu, fatturaAcquisto)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/common/form/searchbox/Searchbox.tsx` | Modified | Rimozione branch vuoto, prop per navigazione |
| `src/components/common/form/searchbox/ContainerGridResults.tsx` | Modified | Passthrough callback navigazione |
| `src/components/common/form/searchbox/GridResults.tsx` | Modified | Arrow Up handler, type cleanup |
| `src/components/common/form/searchbox/SearchboxModal.tsx` | Modified | Type alignment |
| `src/@types/searchbox.d.ts` | Modified | Rename DatagridColDef → SearchboxColDef |
| `src/components/common/form/searchbox/searchboxOptions/*.tsx` | Modified | Import rename (5 file) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| AG Grid intercetta Arrow Up prima del nostro handler | Medium | Usare `onCellKeyDown` che riceve l'evento dopo AG Grid; verificare con `suppressKeyboardEvent` se necessario |
| Debounce 300ms insufficiente o eccessivo | Low | Verificare con E2E; il valore e' in useFetchData ed e' facilmente modificabile |
| Rename tipo rompe import esterni | Low | `DatagridColDef` di searchbox.d.ts e' usato solo nei file searchboxOptions — scope contenuto |
| overlayNoRowsTemplate non visibile con altezza fissa | Low | ContainerGridResults ha gia' `height: 30vh` — sufficiente per mostrare l'overlay |

## Rollback Plan

Tutte le modifiche sono nel modulo searchbox e nei tipi correlati. Rollback tramite `git revert` del commit. Nessun impatto su database, backend, o altri componenti.

## Dependencies

- Nessuna migrazione database
- Nessuna modifica backend

## Success Criteria

- [ ] Test unitari verificano che il debounce di useFetchData funziona (query non parte prima di 300ms)
- [ ] Test E2E verificano tempi di risposta adeguati durante digitazione rapida
- [ ] La griglia ContainerGridResults e' visibile anche quando non ci sono risultati (mostra messaggio empty state)
- [ ] Arrow Up dalla prima riga della griglia fa focus nel textfield
- [ ] Nessun cast `as any` rimasto nel modulo searchbox (0 occorrenze di `as any` nei file searchbox/)
- [ ] `npm run ts:check` passa senza errori nei file modificati
- [ ] `npm run lint` passa senza errori
