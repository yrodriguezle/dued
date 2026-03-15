# Exploration: searchbox-filtering-bug

## Stato Attuale

Il componente Searchbox e' un widget di ricerca generico usato in tutto il progetto per selezionare entita' (fornitori, utenti, ruoli, menu, fatture acquisto). L'architettura e' la seguente:

### Flusso di Ricerca
1. L'utente digita nel `TextField` di `Searchbox.tsx`
2. `handleInputChange` aggiorna `innerValue` e mostra i risultati se il testo non e' vuoto
3. `useSearchboxQueryParams` costruisce la query GraphQL con clausola WHERE dinamica
4. `useFetchData` esegue la query con debounce di 300ms
5. I risultati vengono visualizzati in `ContainerGridResults` / `GridResults` (AG Grid)
6. Se non ci sono risultati e l'input ha piu' di 2 caratteri, appare "Nessun risultato trovato"

### Componenti del Sistema

| File | Ruolo |
|------|-------|
| `Searchbox.tsx` | Componente principale: TextField + dropdown risultati + modale |
| `FormikSearchbox.tsx` | Wrapper Formik con FastField |
| `useSearchboxQueryParams.tsx` | Costruzione WHERE clause e body della query GraphQL |
| `useFetchData.tsx` | Hook generico per fetch dati GraphQL con debounce 300ms |
| `useQueryParams.tsx` | Hook che genera la query GQL dinamica e le variables |
| `ContainerGridResults.tsx` | Container Paper ridimensionabile per la griglia risultati |
| `GridResults.tsx` | Rendering AG Grid con selezione singola e keyboard navigation |
| `SearchboxModal.tsx` | Modale fullscreen con tutti gli elementi (senza filtro) |
| `BasicModal.tsx` | Componente demo/esempio, non usato nel flusso Searchbox |
| `searchbox.d.ts` | Tipo `SearchboxOptions<T>` con campi `additionalWhere`, `tableName`, etc. |
| `searchboxOptions/*.tsx` | Configurazioni per dominio (fornitore, utente, ruolo, menu, fatturaAcquisto) |

### Il Bug: OR invece di AND

In `useSearchboxQueryParams.tsx`, riga 30-33:

```typescript
return [regularWhere, additionalWhere]
  .filter(Boolean)
  .map((statement, _, array) => (array.length > 1 ? `(${statement})` : statement))
  .join(" OR ");
```

Quando `additionalWhere` e' presente, il filtro di ricerca (`regularWhere`) e la condizione aggiuntiva vengono combinati con **OR** anziche' **AND**. Questo significa:

- **Comportamento atteso**: mostra righe che corrispondono al testo digitato **E** soddisfano la condizione aggiuntiva
- **Comportamento attuale**: mostra righe che corrispondono al testo digitato **OPPURE** soddisfano la condizione aggiuntiva

Il risultato e' che digitando, se esiste un `additionalWhere`, i risultati non si restringono progressivamente perche' vengono incluse anche tutte le righe che soddisfano `additionalWhere` indipendentemente dal testo.

### Nota Importante
Attualmente **nessuna** delle configurazioni searchboxOptions usa `additionalWhere`. Il campo e' definito nel tipo `SearchboxOptions<T>` ma non viene valorizzato in nessuna opzione. Tuttavia, il bug e' nel codice condiviso e impatta qualsiasi uso futuro (o eventuale uso dinamico non ancora tracciato).

## Aree Impattate

- `src/components/common/form/searchbox/useSearchboxQueryParams.tsx` -- Contiene il bug OR vs AND
- `src/@types/searchbox.d.ts` -- Definizione tipo con `additionalWhere`
- Tutti i consumatori della Searchbox (fornitori, utenti, ruoli, menu, fatture) -- potenzialmente impattati se aggiungono additionalWhere

## Approcci

### 1. Fix minimale: OR -> AND (Raccomandato)
Cambiare `.join(" OR ")` in `.join(" AND ")` in `useSearchboxQueryParams.tsx`.

- Pro: Fix di una sola riga, zero rischio di regressione sui consumatori attuali (nessuno usa additionalWhere)
- Contro: Nessuno
- Effort: Basso

### 2. Fix con supporto operatore configurabile
Aggiungere un campo `additionalWhereOperator: "AND" | "OR"` al tipo `SearchboxOptions`, con default `AND`.

- Pro: Massima flessibilita' per casi d'uso futuri
- Contro: Over-engineering per il bug attuale
- Effort: Basso-Medio

## Raccomandazione

Approccio 1: fix minimale OR -> AND. E' la soluzione corretta e sicura. Se in futuro serve OR, si puo' aggiungere l'operatore configurabile.

## Rischi

- **Basso**: Nessuna configurazione attuale usa `additionalWhere`, quindi il fix non altera il comportamento di nessun Searchbox esistente
- **Basso**: Il fix potrebbe non risolvere completamente il problema se il bug percepito dall'utente ha anche altre cause (es. debounce troppo largo)

## Pronto per la Proposta

Si -- procedere con la creazione della proposta formale.
