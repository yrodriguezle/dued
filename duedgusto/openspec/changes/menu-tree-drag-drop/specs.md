# Specs: Menu Tree Always-On + Drag & Drop tra Rami

## Change

**Name**: menu-tree-drag-drop
**Status**: specs
**Date**: 2026-03-19

## Overview

Questa specifica definisce i requisiti comportamentali per due feature correlate nella pagina "Gestione voci di menu":
1. La vista ad albero (tree data) DEVE essere sempre attiva, indipendentemente dalla modalita (bloccata o modifica)
2. Il drag & drop DEVE permettere di spostare voci menu tra rami diversi dell'albero, aggiornando `menuPadreId`

## Functional Requirements

### FR-1: Tree Data Always Active

La griglia menu DEVE mostrare la struttura gerarchica ad albero in entrambe le modalita (bloccata e modifica).

**Attualmente**: `treeData={readOnly}` — l'albero si disattiva in modalita modifica.
**Target**: `treeData` sempre true — l'albero rimane visibile in entrambe le modalita.

### FR-2: Drag Handle in Edit Mode

In modalita modifica, ogni riga della griglia DEVE mostrare un drag handle nella colonna gruppo (autoGroupColumnDef) per consentire il riordinamento gerarchico.

### FR-3: Row Drag Re-parenting

L'utente DEVE poter trascinare una voce menu su un altro nodo per cambiarne il parent. Il sistema DEVE aggiornare il campo `menuPadreId` del nodo spostato.

### FR-4: Cycle Prevention

Il sistema DEVE impedire la creazione di cicli gerarchici (un nodo non puo diventare figlio di se stesso o di un proprio discendente).

### FR-5: Dirty State dopo Drag

Dopo un'operazione di drag & drop, il sistema DEVE marcare la riga spostata come `DatagridStatus.Modified` e DEVE triggerare il dirty check di Formik (`gridDirty = true`).

### FR-6: New Rows in Tree Mode

L'aggiunta di nuove righe DEVE funzionare correttamente con tree data attivo. Le nuove righe DEVONO essere inserite con `menuPadreId: null` (root level).

### FR-7: Inline Editing Compatibility

L'editing inline delle celle DEVE continuare a funzionare correttamente con tree data sempre attivo. Il drag handle NON DEVE interferire con il `singleClickEdit`.

---

## Scenarios

### S-01: Visualizzazione albero in modalita bloccata

```gherkin
GIVEN la pagina "Gestione voci di menu" e caricata
AND la griglia e in modalita bloccata (isFormLocked = true)
WHEN l'utente visualizza la griglia
THEN la struttura ad albero MUST essere visibile
AND i nodi con figli MUST mostrare l'icona di espansione/compressione
AND tutti i livelli MUST essere espansi di default (groupDefaultExpanded = -1)
AND MUST NOT essere visibile alcun drag handle
```

### S-02: Visualizzazione albero in modalita modifica

```gherkin
GIVEN la pagina "Gestione voci di menu" e caricata
AND l'utente ha sbloccato il form (isFormLocked = false)
WHEN l'utente visualizza la griglia
THEN la struttura ad albero MUST rimanere visibile
AND i nodi con figli MUST mostrare l'icona di espansione/compressione
AND ogni riga MUST mostrare un drag handle nella colonna gruppo
```

### S-03: Drag & drop — spostamento su un nodo valido

```gherkin
GIVEN la griglia e in modalita modifica
AND esiste un nodo "A" con menuPadreId = null (root)
AND esiste un nodo "B" con menuPadreId = null (root)
AND il nodo "A" non e un discendente del nodo "B"
WHEN l'utente trascina il nodo "A" sul nodo "B"
THEN il campo menuPadreId del nodo "A" MUST essere aggiornato al valore di B.id
AND il nodo "A" MUST apparire come figlio del nodo "B" nell'albero
AND la riga del nodo "A" MUST avere status = DatagridStatus.Modified
AND il campo Formik gridDirty MUST essere true
AND il tasto Salva MUST essere abilitato
```

### S-04: Drag & drop — spostamento su root (area vuota)

```gherkin
GIVEN la griglia e in modalita modifica
AND esiste un nodo "C" con menuPadreId = X (figlio di un altro nodo)
WHEN l'utente trascina il nodo "C" su un'area vuota della griglia (nessun overNode)
THEN il campo menuPadreId del nodo "C" MUST essere aggiornato a null
AND il nodo "C" MUST apparire come nodo root nell'albero
AND la riga del nodo "C" MUST avere status = DatagridStatus.Modified
AND il campo Formik gridDirty MUST essere true
```

### S-05: Drag & drop — prevenzione ciclo diretto (su se stesso)

```gherkin
GIVEN la griglia e in modalita modifica
AND esiste un nodo "D"
WHEN l'utente trascina il nodo "D" su se stesso
THEN il drop MUST essere ignorato (nessuna modifica)
AND il campo menuPadreId del nodo "D" MUST NOT cambiare
AND lo status della riga MUST NOT cambiare
AND SHOULD essere mostrato un feedback visivo (toast warning) che informa dell'operazione non valida
```

### S-06: Drag & drop — prevenzione ciclo indiretto (su un discendente)

```gherkin
GIVEN la griglia e in modalita modifica
AND esiste un nodo "E" (root)
AND esiste un nodo "F" con menuPadreId = E.id (figlio di E)
AND esiste un nodo "G" con menuPadreId = F.id (nipote di E)
WHEN l'utente trascina il nodo "E" sul nodo "G"
THEN il drop MUST essere ignorato (nessuna modifica)
AND il campo menuPadreId del nodo "E" MUST NOT cambiare
AND SHOULD essere mostrato un feedback visivo (toast warning) che informa del tentativo di creare un ciclo
```

### S-07: Drag & drop — nodo gia figlio dello stesso parent

```gherkin
GIVEN la griglia e in modalita modifica
AND esiste un nodo "H" con menuPadreId = X
WHEN l'utente trascina il nodo "H" su un nodo con id = X (stesso parent attuale)
THEN il drop MUST essere ignorato (nessuna modifica)
AND il campo menuPadreId MUST NOT cambiare
AND lo status della riga MUST NOT cambiare
AND il dirty state MUST NOT essere triggerato
```

### S-08: Drag handle non visibile in modalita bloccata

```gherkin
GIVEN la griglia e in modalita bloccata (isFormLocked = true)
WHEN l'utente visualizza la colonna gruppo
THEN MUST NOT essere visibile alcun drag handle
AND l'utente MUST NOT poter trascinare righe
```

### S-09: Editing inline con tree data attivo

```gherkin
GIVEN la griglia e in modalita modifica
AND tree data e attivo
WHEN l'utente clicca su una cella editabile (es. "Titolo", "Percorso")
THEN la cella MUST entrare in modalita editing (singleClickEdit)
AND l'utente MUST poter modificare il valore
AND il salvataggio della modifica MUST marcare la riga come Modified
```

### S-10: Aggiunta nuova riga con tree data attivo

```gherkin
GIVEN la griglia e in modalita modifica
AND tree data e attivo
WHEN l'utente clicca il pulsante "Aggiungi" nella toolbar
THEN una nuova riga MUST essere aggiunta alla griglia
AND la nuova riga MUST avere menuPadreId = null (root level)
AND la nuova riga MUST apparire come nodo root nell'albero
AND il focus MUST spostarsi sulla prima cella editabile della nuova riga
```

### S-11: Eliminazione riga con tree data attivo

```gherkin
GIVEN la griglia e in modalita modifica
AND tree data e attivo
AND l'utente ha selezionato una riga
WHEN l'utente clicca il pulsante "Elimina" nella toolbar
THEN la riga selezionata MUST essere rimossa dalla griglia
AND i figli della riga eliminata SHOULD rimanere nell'albero (diventando potenzialmente orfani, gestione a carico del salvataggio backend)
AND il dirty state MUST essere triggerato
```

### S-12: Drag & drop non attivo in modalita presentazione

```gherkin
GIVEN il Datagrid e usato in modalita presentazione (presentation = true)
WHEN l'utente interagisce con la griglia
THEN MUST NOT essere visibile alcun drag handle
AND l'utente MUST NOT poter trascinare righe
```

---

## Non-Functional Requirements

### NFR-1: Performance

Il drag & drop SHOULD completarsi in meno di 100ms per alberi con fino a 200 nodi.

### NFR-2: Retrocompatibilita

Le modifiche MUST NOT alterare il comportamento del componente Datagrid generico. Tutte le props drag (`rowDragManaged`, `onRowDragEnd`) passano via `...gridProps` senza modifiche al Datagrid.

### NFR-3: Type Safety

L'handler `onRowDragEnd` e la funzione `isDescendantOf` MUST essere tipizzati correttamente con TypeScript. La compilazione (`npm run ts:check`) MUST passare senza errori.

### NFR-4: Localizzazione

Eventuali messaggi toast di warning (ciclo gerarchico) SHOULD essere in italiano, coerenti con il resto dell'applicazione.

---

## Technical Notes

### Props AG Grid coinvolte

| Prop | Valore | Dove |
|------|--------|------|
| `treeData` | `true` (sempre) | MenuForm → Datagrid → AgGrid |
| `rowDrag` | `!readOnly` | autoGroupColumnDef in MenuForm |
| `rowDragManaged` | `!readOnly` | gridProps in MenuForm → Datagrid → AgGrid |
| `onRowDragEnd` | handler | gridProps in MenuForm → Datagrid → AgGrid |

### Helper Function: isDescendantOf

```
isDescendantOf(nodeId: number, potentialParentId: number, allNodes: MenuNonNull[]): boolean
```

Percorre l'albero verso l'alto partendo da `potentialParentId`, seguendo la catena `menuPadreId`, e restituisce `true` se incontra `nodeId` (indicando che il potenziale parent e un discendente del nodo che stiamo spostando).

### Impatto sui file

| File | Tipo modifica |
|------|---------------|
| `src/components/pages/menu/MenuForm.tsx` | Modificato — tree always-on, drag props, handler, validazione |
| `src/components/common/datagrid/Datagrid.tsx` | Nessuna modifica — props passano via `...gridProps` |
| `src/components/common/datagrid/AgGrid.tsx` | Nessuna modifica — moduli gia registrati |
| `src/components/common/datagrid/@types/Datagrid.d.ts` | Nessuna modifica — tipi RowDragEnd gia definiti |

---

## Acceptance Criteria Summary

| ID | Criterio | Priority |
|----|----------|----------|
| AC-1 | Tree data visibile in entrambe le modalita | MUST |
| AC-2 | Drag handle visibile solo in modalita modifica | MUST |
| AC-3 | Re-parenting funzionante con aggiornamento menuPadreId | MUST |
| AC-4 | Prevenzione cicli gerarchici (diretti e indiretti) | MUST |
| AC-5 | Dirty state corretto dopo drag | MUST |
| AC-6 | Nuove righe inserite a root level | MUST |
| AC-7 | Editing inline funzionante con tree data | MUST |
| AC-8 | Drop su area vuota riporta a root | SHOULD |
| AC-9 | Toast warning per operazioni non valide | SHOULD |
| AC-10 | Nessuna modifica al Datagrid generico | MUST |
| AC-11 | TypeScript compila senza errori | MUST |
