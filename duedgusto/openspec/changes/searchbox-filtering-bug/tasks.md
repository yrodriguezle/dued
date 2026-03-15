# Tasks: Fix filtraggio Searchbox e copertura test completa

## Phase 1: Fix del Bug (Core)

- [ ] 1.1 Modificare `.join(" OR ")` in `.join(" AND ")` alla riga 33 di `src/components/common/form/searchbox/useSearchboxQueryParams.tsx` (REQ-SB-001)
- [ ] 1.2 Eseguire `npm run ts:check` per verificare che la modifica non introduca errori di tipo
- [ ] 1.3 Eseguire `npm run lint` per verificare conformita' alle regole ESLint

## Phase 2: Test unitari per useSearchboxQueryParams

- [ ] 2.1 Creare il file `src/components/common/form/searchbox/__tests__/useSearchboxQueryParams.test.tsx` con setup iniziale: import di `renderHook`, mock di `useQueryParams` per catturare i parametri `where` e `body` passati (REQ-SB-001, REQ-SB-002, REQ-SB-003)
- [ ] 2.2 Scrivere test: ricerca con singola parola genera `tableName.field LIKE "%parola%"` (REQ-SB-002)
- [ ] 2.3 Scrivere test: ricerca con due parole genera condizioni AND progressive `field LIKE "%a%" AND field LIKE "%b%"` (REQ-SB-002)
- [ ] 2.4 Scrivere test: ricerca con tre parole genera tre condizioni AND (REQ-SB-002)
- [ ] 2.5 Scrivere test: `additionalWhere` presente viene combinato con AND e parenthesizzato `(regularWhere) AND (additionalWhere)` (REQ-SB-001)
- [ ] 2.6 Scrivere test: senza `additionalWhere` la clausola WHERE contiene solo `regularWhere` senza parentesi aggiuntive (REQ-SB-001)
- [ ] 2.7 Scrivere test: `additionalWhere` come stringa vuota viene trattato come assente (REQ-SB-001)
- [ ] 2.8 Scrivere test: input vuoto genera WHERE vuoto (REQ-SB-003)
- [ ] 2.9 Scrivere test: input con soli spazi genera WHERE vuoto (REQ-SB-003)
- [ ] 2.10 Scrivere test: input con spazi extra viene trimmato correttamente, generando la stessa clausola di input senza spazi (REQ-SB-002)
- [ ] 2.11 Scrivere test: modalita' dropdown (`modal=false`) genera body con campi da `options.items` (REQ-SB-013)
- [ ] 2.12 Scrivere test: modalita' modale (`modal=true`) genera body con campi da `options.modal.items` e `pageSize=100` (REQ-SB-013)
- [ ] 2.13 Eseguire i test con `npx vitest run src/components/common/form/searchbox/__tests__/useSearchboxQueryParams.test.tsx` e verificare che passino tutti

## Phase 3: Test unitari per Searchbox component

- [ ] 3.1 Creare il file `src/components/common/form/searchbox/__tests__/Searchbox.test.tsx` con setup iniziale: mock di `useFetchData`, `useSearchboxQueryParams`, `useQueryParams`, provider MUI (REQ-SB-004 a REQ-SB-015)
- [ ] 3.2 Scrivere test: rendering con valore iniziale mostra il valore nel TextField (REQ-SB-009)
- [ ] 3.3 Scrivere test: digitazione aggiorna il valore dell'input (REQ-SB-009)
- [ ] 3.4 Scrivere test: digitazione testo non vuoto rende visibile il dropdown risultati (REQ-SB-004)
- [ ] 3.5 Scrivere test: cancellazione del testo nasconde il dropdown risultati (REQ-SB-004)
- [ ] 3.6 Scrivere test: messaggio "Nessun risultato trovato" appare con input > 2 caratteri e 0 items (REQ-SB-005)
- [ ] 3.7 Scrivere test: messaggio "Nessun risultato trovato" NON appare con input <= 2 caratteri (REQ-SB-005)
- [ ] 3.8 Scrivere test: messaggio "Nessun risultato trovato" NON appare durante loading (REQ-SB-005)
- [ ] 3.9 Scrivere test: Escape chiude il dropdown (REQ-SB-007)
- [ ] 3.10 Scrivere test: Tab chiude il dropdown (REQ-SB-007)
- [ ] 3.11 Scrivere test: ArrowDown sposta focus alla griglia risultati (REQ-SB-007)
- [ ] 3.12 Scrivere test: click esterno chiude il dropdown (REQ-SB-008)
- [ ] 3.13 Scrivere test: click del pulsante expand apre la modale (REQ-SB-010)
- [ ] 3.14 Scrivere test: CircularProgress visibile durante loading al posto del pulsante expand (REQ-SB-011)
- [ ] 3.15 Scrivere test: sincronizzazione con prop `value` esterna che cambia (REQ-SB-009)
- [ ] 3.16 Eseguire i test con `npx vitest run src/components/common/form/searchbox/__tests__/Searchbox.test.tsx` e verificare che passino tutti

## Phase 4: Infrastruttura test E2E (Playwright)

- [ ] 4.1 Creare la directory `e2e/functional/` per i test E2E funzionali
- [ ] 4.2 Creare il file `e2e/functional/helpers.ts` con helper condivisi: costante `AUTH_STATE_PATH` (riusa lo stesso path di `e2e/visual-regression/helpers.ts`), utility per login e navigazione
- [ ] 4.3 Verificare che `playwright.config.ts` supporti un progetto separato per i test funzionali oppure che i test in `e2e/functional/` possano essere eseguiti con il config esistente. Se necessario, aggiornare la configurazione per includere la directory `e2e/functional/`
- [ ] 4.4 Verificare che l'auth setup (`e2e/visual-regression/auth.setup.ts`) sia riutilizzabile dai test funzionali o creare un `e2e/functional/auth.setup.ts` equivalente

## Phase 5: Test E2E per filtraggio progressivo

- [ ] 5.1 Creare il file `e2e/functional/searchbox.spec.ts` con setup iniziale: import Playwright, use storageState per autenticazione, navigazione a una pagina con Searchbox fornitore (REQ-E2E-001, REQ-E2E-002)
- [ ] 5.2 Scrivere test E2E: digitare nel searchbox e verificare che il dropdown appaia con risultati (REQ-E2E-001)
- [ ] 5.3 Scrivere test E2E: digitare progressivamente e verificare che il numero di risultati diminuisca o resti uguale (REQ-E2E-002)
- [ ] 5.4 Scrivere test E2E: aggiungere una seconda parola separata da spazio e verificare che i risultati siano un sottoinsieme (REQ-E2E-002)
- [ ] 5.5 Scrivere test E2E: ricerca e selezione con tastiera (ArrowDown + Enter) (REQ-E2E-001)

## Phase 6: Test E2E per griglia vuota e funzionalita' complete

- [ ] 6.1 Scrivere test E2E: digitare testo senza corrispondenze (> 2 caratteri) e verificare messaggio "Nessun risultato trovato" (REQ-E2E-003)
- [ ] 6.2 Scrivere test E2E: digitare testo corto senza corrispondenze (2 caratteri) e verificare che il messaggio NON appaia (REQ-E2E-003)
- [ ] 6.3 Scrivere test E2E: selezionare un elemento con doppio click dal dropdown e verificare che il campo si popoli (REQ-E2E-001)
- [ ] 6.4 Scrivere test E2E: Escape chiude il dropdown (REQ-E2E-005)
- [ ] 6.5 Scrivere test E2E: click esterno chiude il dropdown (REQ-E2E-005)
- [ ] 6.6 Scrivere test E2E: aprire modale con pulsante expand e selezionare un elemento (REQ-E2E-004)
- [ ] 6.7 Scrivere test E2E: verificare che lo spinner di loading appaia brevemente durante la digitazione (REQ-E2E-006)
- [ ] 6.8 Eseguire tutti i test E2E con `npx playwright test e2e/functional/` e verificare che passino

## Phase 7: Validazione finale

- [ ] 7.1 Eseguire `npm run ts:check` su tutto il progetto per verificare assenza di errori TypeScript
- [ ] 7.2 Eseguire `npm run lint` su tutto il progetto per verificare conformita' ESLint
- [ ] 7.3 Eseguire tutti i test unitari con `npx vitest run` per verificare che nessun test esistente sia rotto
- [ ] 7.4 Verificare che i test E2E visual-regression esistenti non siano impattati dalla modifica
