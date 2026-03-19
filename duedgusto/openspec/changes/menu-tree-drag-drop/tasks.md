# Tasks: Menu Tree Always-On + Drag & Drop tra Rami

## Phase 1: Infrastructure — Funzioni Helper

- [x] 1.1 Aggiungere la funzione `buildNodesMap(api: GridApi): Map<number, MenuNonNull>` in `src/components/pages/menu/MenuForm.tsx`, definita fuori dal componente. Usa `api.forEachNode()` per costruire una mappa id -> dati nodo. Tipizzare correttamente con i tipi `MenuNonNull` esistenti.

- [x] 1.2 Aggiungere la funzione `isDescendantOf(nodeId: number, potentialParentId: number, nodesMap: Map<number, MenuNonNull>): boolean` in `src/components/pages/menu/MenuForm.tsx`, definita fuori dal componente. Risale l'albero da `potentialParentId` seguendo `menuPadreId` e restituisce `true` se incontra `nodeId`.

## Phase 2: Core Implementation — Tree Always-On e Drag & Drop

- [x] 2.1 In `src/components/pages/menu/MenuForm.tsx`, cambiare la prop `treeData={readOnly}` in `treeData` (sempre true) sul componente Datagrid, in modo che la struttura gerarchica sia visibile sia in modalita bloccata che in modalita modifica.

- [x] 2.2 In `src/components/pages/menu/MenuForm.tsx`, aggiungere `rowDrag: !readOnly` nell'oggetto `autoGroupColumnDef` per mostrare il drag handle nella colonna gruppo solo in modalita modifica.

- [x] 2.3 In `src/components/pages/menu/MenuForm.tsx`, aggiungere le props `rowDragManaged={!readOnly}` e `onRowDragEnd={handleRowDragEnd}` al componente Datagrid (passano via `gridProps` ad AG Grid).

- [x] 2.4 In `src/components/pages/menu/MenuForm.tsx`, implementare l'handler `handleRowDragEnd` come `useCallback` che:
  - Estrae `node` e `overNode` dall'evento `RowDragEndEvent`
  - Se `overNode` e null, imposta `newParentId = null` (spostamento a root)
  - Se `overNode` esiste, `newParentId = overNode.data.id`
  - Early return se il nodo viene droppato su se stesso (`node.data.id === overNode?.data?.id`)
  - Early return se `menuPadreId` non cambia (`node.data.menuPadreId === newParentId`)
  - Chiama `buildNodesMap` e `isDescendantOf` per validare anti-ciclo; se ciclo rilevato, mostra toast warning (`showToast`) e return
  - Aggiorna `node.data.menuPadreId = newParentId`
  - Marca `node.data.status = DatagridStatus.Modified`
  - Chiama `api.applyTransaction({ update: [node.data] })`
  - Chiama `setFieldValue("gridDirty", true)`

## Phase 3: Verification — TypeScript e Lint

- [ ] 3.1 Eseguire `npm run ts:check` in `duedgusto/` e verificare che la compilazione TypeScript passi senza errori. Correggere eventuali errori di tipo introdotti dalle modifiche.

- [ ] 3.2 Eseguire `npm run lint` in `duedgusto/` e verificare che non ci siano violazioni ESLint introdotte dalle modifiche (in particolare: no `for` loops nelle funzioni helper, uso di `object-shorthand`).

- [ ] 3.3 Verificare manualmente che le funzioni helper (`isDescendantOf`, `buildNodesMap`) non usino cicli `for`/`for...of`/`for...in` ma metodi funzionali, in accordo con le regole di codice del progetto.

## Phase 4: Validazione Manuale — Scenari Specs

- [ ] 4.1 Verificare scenario S-01 e S-02: albero visibile in entrambe le modalita (bloccata e modifica), drag handle visibile solo in modifica.

- [ ] 4.2 Verificare scenario S-03: drag di un nodo su un altro nodo valido aggiorna `menuPadreId`, marca Modified, abilita Salva.

- [ ] 4.3 Verificare scenario S-04: drag su area vuota riporta il nodo a root (`menuPadreId = null`).

- [ ] 4.4 Verificare scenari S-05 e S-06: drop su se stesso o su un discendente viene ignorato con toast warning.

- [ ] 4.5 Verificare scenario S-07: drop sullo stesso parent attuale non cambia nulla (no dirty state).

- [ ] 4.6 Verificare scenario S-09: editing inline celle funziona correttamente con tree data attivo.

- [ ] 4.7 Verificare scenario S-10: aggiunta nuova riga inserisce a root level con tree data attivo.
