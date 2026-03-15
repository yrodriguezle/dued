# Proposal: Fix filtraggio Searchbox e copertura test completa

## Intent

Il componente Searchbox mostra risultati irrilevanti durante la digitazione. I risultati dovrebbero restringersi progressivamente man mano che l'utente digita piu' caratteri, e se non ci sono corrispondenze la griglia dovrebbe risultare vuota. La causa principale e' un operatore logico errato (`OR` invece di `AND`) nella costruzione della clausola WHERE in `useSearchboxQueryParams.tsx`. Inoltre, il componente non ha test unitari dedicati (solo FormikSearchbox ha test base) e manca completamente di test E2E.

## Scope

### In Scope
- Correzione del bug OR -> AND in `useSearchboxQueryParams.tsx`
- Test unitari per `useSearchboxQueryParams.tsx` (logica WHERE clause)
- Test unitari per `Searchbox.tsx` (comportamento componente)
- Test E2E Playwright per verificare il filtraggio progressivo
- Test E2E per verificare griglia vuota quando non ci sono match
- Test E2E per tutte le funzionalita' principali della Searchbox

### Out of Scope
- Aggiunta di operatore configurabile AND/OR (futuro, se necessario)
- Refactoring dell'architettura Searchbox
- Ottimizzazione del debounce (300ms e' ragionevole)
- Test per SearchboxModal (componente separato, funziona correttamente)

## Approach

### Fix del Bug
Modifica di una sola riga in `useSearchboxQueryParams.tsx`: cambiare `.join(" OR ")` in `.join(" AND ")` alla riga 33. Questo assicura che quando esiste un `additionalWhere`, i risultati devono soddisfare **sia** il filtro di ricerca **che** la condizione aggiuntiva.

### Strategia di Testing

#### Test unitari (Vitest)

**1. `useSearchboxQueryParams.test.tsx`** -- Logica di costruzione WHERE
- Verifica che una ricerca con singola parola generi `tableName.field LIKE "%parola%"`
- Verifica che parole multiple generino condizioni AND: `field LIKE "%a%" AND field LIKE "%b%"`
- Verifica che input vuoto generi WHERE vuoto
- Verifica che `additionalWhere` sia combinato con AND (non OR)
- Verifica che senza `additionalWhere` la clausola sia solo il regularWhere
- Verifica che spazi extra vengano trimmati correttamente
- Verifica che il body contenga i campi corretti (modalita' dropdown vs modale)

**2. `Searchbox.test.tsx`** -- Comportamento componente
- Rendering con valore iniziale
- Aggiornamento input alla digitazione
- Visualizzazione risultati quando si digita (resultsVisible = true)
- Nascondimento risultati quando input vuoto
- Messaggio "Nessun risultato trovato" quando items vuoto e input > 2 caratteri
- Apertura modale al click del pulsante expand
- Chiusura risultati con Escape
- Chiusura risultati con Tab
- Selezione elemento con Enter
- Navigazione con ArrowDown nella griglia
- Click esterno chiude i risultati
- Sincronizzazione con prop value esterna

#### Test E2E (Playwright)

**3. Test E2E su una pagina reale** (es. Fornitori)
- Digitare nel searchbox e verificare che i risultati appaiano
- Digitare progressivamente e verificare che i risultati si restringano
- Digitare testo senza match e verificare messaggio "Nessun risultato trovato"
- Selezionare un elemento dal dropdown e verificare che il campo si popoli
- Aprire la modale e selezionare un elemento
- Verificare navigazione tastiera (ArrowDown, Enter, Escape)

## Mappa Funzionalita' Searchbox

| # | Funzionalita' | Componente | Tipo Test |
|---|--------------|------------|-----------|
| 1 | Ricerca con filtro progressivo server-side | useSearchboxQueryParams | Unit |
| 2 | Combinazione AND tra parole multiple | useSearchboxQueryParams | Unit |
| 3 | Combinazione AND tra regularWhere e additionalWhere | useSearchboxQueryParams | Unit |
| 4 | Debounce 300ms sulle query | useFetchData | Unit |
| 5 | Skip query quando input vuoto | Searchbox (skip prop) | Unit |
| 6 | Rendering TextField con input controllato | Searchbox | Unit |
| 7 | Dropdown risultati visibile durante digitazione | Searchbox | Unit |
| 8 | Dropdown nascosto con input vuoto | Searchbox | Unit |
| 9 | Messaggio "Nessun risultato" (input > 2 char, 0 items) | Searchbox | Unit |
| 10 | Selezione elemento da dropdown (double-click) | GridResults | Unit |
| 11 | Selezione elemento da dropdown (Enter) | GridResults | Unit |
| 12 | Navigazione tastiera (ArrowDown -> focus griglia) | Searchbox | Unit |
| 13 | Chiusura dropdown con Escape | Searchbox | Unit |
| 14 | Chiusura dropdown con Tab | Searchbox | Unit |
| 15 | Chiusura dropdown con click esterno | Searchbox | Unit |
| 16 | Auto-selezione con Enter/Tab su match esatto | Searchbox | Unit |
| 17 | Apertura modale con pulsante expand | Searchbox | Unit |
| 18 | Modale carica tutti gli elementi (pageSize 100) | Searchbox + useFetchData | Unit |
| 19 | Selezione da modale (double-click / doppio tap) | SearchboxModal | Unit |
| 20 | Chiusura modale con Escape / pulsante X | SearchboxModal | Unit |
| 21 | Container ridimensionabile con persistenza larghezza | ContainerGridResults | Unit |
| 22 | Integrazione Formik (valore, errori, disabled) | FormikSearchbox | Unit (esistente) |
| 23 | Loading spinner durante fetch | Searchbox | Unit |
| 24 | Flusso completo ricerca -> selezione su pagina reale | Pagina Fornitori | E2E |
| 25 | Filtraggio progressivo end-to-end | Pagina Fornitori | E2E |
| 26 | Griglia vuota end-to-end | Pagina Fornitori | E2E |

## Affected Areas

| Area | Impatto | Descrizione |
|------|---------|-------------|
| `src/components/common/form/searchbox/useSearchboxQueryParams.tsx` | Modificato | Fix OR -> AND (riga 33) |
| `src/components/common/form/searchbox/__tests__/useSearchboxQueryParams.test.tsx` | Nuovo | Test unitari logica WHERE |
| `src/components/common/form/searchbox/__tests__/Searchbox.test.tsx` | Nuovo | Test unitari componente |
| `tests/e2e/searchbox.spec.ts` | Nuovo | Test E2E Playwright |

## Risks

| Rischio | Probabilita' | Mitigazione |
|---------|-------------|-------------|
| Il fix non altera comportamento esistente (nessuno usa additionalWhere) | Bassa | Verificato: nessuna searchboxOptions usa il campo. Il fix previene bug futuri |
| Test E2E dipendono da dati nel database | Media | Usare dati seed o creare fixture prima del test |
| AG Grid rende difficile il testing unitario | Media | Mockare AG Grid nei test unitari, testare l'integrazione reale negli E2E |

## Rollback Plan

Il fix e' di una sola riga. In caso di problemi:
1. Revertire il commit con `git revert <hash>`
2. Il cambio da AND a OR non impatta nessun Searchbox attualmente in produzione (nessuno usa `additionalWhere`)
3. I test aggiunti non hanno effetti collaterali e possono rimanere anche dopo il revert

## Dependencies

- Nessuna dipendenza esterna
- Vitest gia' configurato nel progetto
- Playwright gia' configurato nel progetto (da verificare setup E2E)

## Success Criteria

- [ ] Il `.join(" OR ")` e' stato cambiato in `.join(" AND ")` in `useSearchboxQueryParams.tsx`
- [ ] I test unitari per `useSearchboxQueryParams` passano e coprono tutti i casi di costruzione WHERE
- [ ] I test unitari per `Searchbox` coprono almeno 15 delle 23 funzionalita' mappate
- [ ] I test E2E verificano il filtraggio progressivo (i risultati diminuiscono digitando)
- [ ] I test E2E verificano la griglia vuota quando non ci sono match
- [ ] `npm run ts:check` passa senza errori
- [ ] `npm run lint` passa senza errori
