# Specs: searchbox-filtering-bug

## Indice Specifiche

| Dominio | File | Tipo | Requisiti | Scenari |
|---------|------|------|-----------|---------|
| Searchbox | [specs/searchbox/spec.md](specs/searchbox/spec.md) | Nuovo (full spec) | 21 requisiti | 39 scenari |

## Riepilogo

Questa specifica copre l'intero comportamento del componente Searchbox, con focus particolare su:

1. **Fix bug OR -> AND** (REQ-SB-001): la clausola WHERE DEVE combinare `regularWhere` e `additionalWhere` con AND
2. **Filtraggio progressivo** (REQ-SB-002): parole multiple generano condizioni AND progressive
3. **Griglia vuota** (REQ-SB-005): messaggio "Nessun risultato trovato" per input > 2 caratteri senza match
4. **Scenari E2E** (REQ-E2E-001 a REQ-E2E-006): 6 requisiti E2E con 10 scenari testabili su pagine reali

## Copertura Mappa Funzionalita'

| # | Funzionalita' | Requisito Spec | Copertura |
|---|--------------|----------------|-----------|
| 1 | Ricerca con filtro progressivo server-side | REQ-SB-002 | Coperto |
| 2 | Combinazione AND tra parole multiple | REQ-SB-002 | Coperto |
| 3 | Combinazione AND tra regularWhere e additionalWhere | REQ-SB-001 | Coperto |
| 4 | Debounce 300ms sulle query | REQ-SB-012 | Coperto |
| 5 | Skip query quando input vuoto | REQ-SB-003 | Coperto |
| 6 | Rendering TextField con input controllato | REQ-SB-009 | Coperto |
| 7 | Dropdown risultati visibile durante digitazione | REQ-SB-004 | Coperto |
| 8 | Dropdown nascosto con input vuoto | REQ-SB-004 | Coperto |
| 9 | Messaggio "Nessun risultato" (input > 2 char, 0 items) | REQ-SB-005 | Coperto |
| 10 | Selezione elemento da dropdown (double-click) | REQ-SB-006 | Coperto |
| 11 | Selezione elemento da dropdown (Enter) | REQ-SB-006 | Coperto |
| 12 | Navigazione tastiera (ArrowDown -> focus griglia) | REQ-SB-007 | Coperto |
| 13 | Chiusura dropdown con Escape | REQ-SB-007 | Coperto |
| 14 | Chiusura dropdown con Tab | REQ-SB-007 | Coperto |
| 15 | Chiusura dropdown con click esterno | REQ-SB-008 | Coperto |
| 16 | Auto-selezione con Enter/Tab su match esatto | REQ-SB-006 | Coperto |
| 17 | Apertura modale con pulsante expand | REQ-SB-010 | Coperto |
| 18 | Modale carica tutti gli elementi (pageSize 100) | REQ-SB-013 | Coperto |
| 19 | Selezione da modale (double-click / doppio tap) | REQ-SB-010 | Coperto |
| 20 | Chiusura modale con Escape / pulsante X | REQ-SB-010 | Coperto |
| 21 | Container ridimensionabile con persistenza larghezza | REQ-SB-014 | Coperto |
| 22 | Integrazione Formik (valore, errori, disabled) | REQ-SB-015 | Coperto |
| 23 | Loading spinner durante fetch | REQ-SB-011 | Coperto |
| 24 | Flusso completo ricerca -> selezione su pagina reale | REQ-E2E-001 | Coperto (E2E) |
| 25 | Filtraggio progressivo end-to-end | REQ-E2E-002 | Coperto (E2E) |
| 26 | Griglia vuota end-to-end | REQ-E2E-003 | Coperto (E2E) |

**Copertura: 26/26 funzionalita' mappate (100%)**
