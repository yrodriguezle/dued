# Searchbox Types Specification

## Purpose

Specifica i requisiti relativi al sistema di tipi TypeScript del modulo Searchbox, risolvendo il conflitto di naming tra `DatagridColDef` in `searchbox.d.ts` e `Datagrid.d.ts`.

## Requirements

### Requirement: Tipo SearchboxColDef dedicato

Il sistema DEVE definire un tipo `SearchboxColDef<T>` in `searchbox.d.ts` che estende `ColDef<T>` (da ag-grid-community) con i campi aggiuntivi `graphField` e `action`.

Il sistema DEVE NOT esportare un tipo chiamato `DatagridColDef` da `searchbox.d.ts`, per evitare ambiguita' con `DatagridColDef` definito in `Datagrid.d.ts` (che wrappa con `DatagridData<T>`).

Il tipo `SearchboxColDef<T>` DEVE essere parametrizzato su `T extends Record<string, unknown>` e basato su `ColDef<T>` raw (non `ColDef<DatagridData<T>>`).

#### Scenario: Definizione del tipo

- GIVEN il file `searchbox.d.ts`
- WHEN un developer importa `SearchboxColDef`
- THEN il tipo e' disponibile come `SearchboxColDef<T>` con le proprieta' di `ColDef<T>` piu' `graphField?: string` e `action?: ColumnAction`

#### Scenario: Nessuna ambiguita' con DatagridColDef

- GIVEN un file che importa sia da `searchbox.d.ts` che da `Datagrid.d.ts`
- WHEN il developer usa `DatagridColDef`
- THEN il tipo si riferisce univocamente a `ColDef<DatagridData<T>>` da `Datagrid.d.ts`
- AND `SearchboxColDef` si riferisce univocamente a `ColDef<T>` da `searchbox.d.ts`

---

### Requirement: SearchboxOptions usa SearchboxColDef

L'interfaccia `SearchboxOptions<T>` DEVE usare `SearchboxColDef<T>` per i campi `items` e `modal.items`.

Il sistema DEVE NOT richiedere cast `as any` quando si passa `SearchboxOptions.modal.items` al componente `SearchboxModal`.

#### Scenario: Configurazione searchboxOptions senza cast

- GIVEN un file searchboxOptions (es. `fornitoreSearchboxOptions.tsx`)
- WHEN il developer definisce le colonne con tipo `SearchboxColDef<FornitoreSearchbox>[]`
- THEN il tipo e' compatibile con `SearchboxOptions<FornitoreSearchbox>.items`
- AND il tipo e' compatibile con `SearchboxOptions<FornitoreSearchbox>.modal.items`
- AND nessun cast `as any` e' necessario

#### Scenario: Import aggiornato nei file searchboxOptions

- GIVEN i 5 file searchboxOptions esistenti (fornitore, utente, ruolo, menu, fatturaAcquisto)
- WHEN il developer aggiorna l'import da `DatagridColDef` a `SearchboxColDef`
- THEN il codice compila senza errori TypeScript
- AND nessun comportamento runtime cambia

---

### Requirement: Eliminazione di tutti i cast as any nel modulo Searchbox

Il sistema DEVE NOT contenere alcun cast `as any` nei file del modulo searchbox (`src/components/common/form/searchbox/`).

Il wrapping da `SearchboxColDef<T>` (basato su `ColDef<T>`) a `ColDef<DatagridData<T>>` DEVE avvenire internamente in `GridResults` tramite una mappatura type-safe.

Il componente `SearchboxModal` DEVE accettare `SearchboxColDef<T>[]` oppure un tipo compatibile che non richieda cast in `Searchbox.tsx`.

#### Scenario: Zero cast as any dopo il refactoring

- GIVEN il modulo searchbox completo (Searchbox.tsx, ContainerGridResults.tsx, GridResults.tsx, SearchboxModal.tsx)
- WHEN si esegue una ricerca per `as any` nei file del modulo
- THEN il conteggio e' 0

#### Scenario: Passaggio columnDefs da Searchbox a SearchboxModal

- GIVEN `options.modal.items` e' di tipo `SearchboxColDef<T>[]`
- WHEN Searchbox passa `options.modal.items` a `SearchboxModal` come prop `columnDefs`
- THEN il tipo e' compatibile senza cast
- AND `SearchboxModal` puo' usare le colonne internamente con il componente `Datagrid`

#### Scenario: Wrapping type-safe in GridResults

- GIVEN `GridResults` riceve `columnDefs` di tipo `SearchboxColDef<T>[]`
- WHEN GridResults mappa le colonne per creare `ColDef<DatagridData<T>>[]`
- THEN la mappatura avviene con type assertion minimale e giustificata (es. cast del campo `field`)
- AND il commento `eslint-disable @typescript-eslint/no-explicit-any` non e' presente

#### Scenario: Compilazione TypeScript senza errori

- GIVEN tutte le modifiche ai tipi sono state applicate
- WHEN si esegue `npm run ts:check`
- THEN non ci sono errori TypeScript nei file del modulo searchbox
- AND non ci sono errori TypeScript nei file searchboxOptions
