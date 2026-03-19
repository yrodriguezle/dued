# Proposal: Menu Tree Always-On + Drag & Drop tra Rami

## Intent

La pagina "Gestione voci di menu" (MenuDetails/MenuForm) attualmente disattiva la vista gerarchica (tree data) quando l'utente entra in modalità modifica. Questo rende impossibile comprendere la struttura menu durante l'editing. Inoltre, non esiste un meccanismo visuale per riorganizzare i menu tra rami diversi: l'utente dovrebbe editare manualmente il campo `menuPadreId` (un ID numerico), il che non e intuitivo.

L'obiettivo e:
1. Mantenere la vista ad albero sempre attiva, anche in modalita modifica
2. Permettere il drag & drop di voci menu tra rami diversi dell'albero, aggiornando automaticamente `menuPadreId`

## Scope

### In Scope
- Tree data sempre attivo in MenuForm (rimuovere condizione `treeData={readOnly}`)
- Drag handle sulla colonna gruppo (autoGroupColumnDef) abilitato solo in modalita modifica
- Handler `onRowDragEnd` per aggiornare `menuPadreId` del nodo spostato
- Validazione anti-ciclo (impedire che un nodo diventi figlio di se stesso o di un proprio discendente)
- Marcatura dirty della riga spostata (`DatagridStatus.Modified`) e trigger del dirty check Formik
- Aggiunta nuove righe in tree mode con `menuPadreId: null` (inserimento a root)

### Out of Scope
- Drag & drop per riordinare la `posizione` all'interno dello stesso livello (feature separata futura)
- Drag multiplo (spostare piu righe selezionate contemporaneamente)
- Persistenza backend (la mutation GraphQL per salvare i menu non e ancora implementata)
- Modifica al Datagrid generico per supporto drag built-in (le props AG Grid passano gia via `gridProps`)

## Approach

Sfruttare le API native di AG Grid Enterprise v33 con `TreeDataModule` gia registrato:

1. **Tree always-on**: cambiare `treeData={readOnly}` in `treeData` (sempre true) in MenuForm
2. **Drag handle**: aggiungere `rowDrag: !readOnly` nell'`autoGroupColumnDef` per mostrare l'icona di drag solo in edit mode
3. **Drag managed**: passare `rowDragManaged={!readOnly}` al Datagrid (passa via `gridProps` ad AG Grid)
4. **Re-parenting handler**: implementare `onRowDragEnd` in MenuForm che:
   - Legge il nodo target (overNode) per determinare il nuovo parent
   - Valida che non si crei un ciclo gerarchico
   - Aggiorna `data.menuPadreId` nel nodo spostato
   - Marca la riga come `DatagridStatus.Modified`
   - Triggera il dirty check via `setFieldValue("gridDirty", true)`
5. **Validazione anti-ciclo**: funzione helper `isDescendantOf(nodeId, potentialParentId, allNodes)` che percorre l'albero verso l'alto per verificare che il target non sia un discendente del nodo spostato

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/pages/menu/MenuForm.tsx` | Modified | Tree always-on, drag props, handler onRowDragEnd, validazione anti-ciclo |
| `src/components/common/datagrid/Datagrid.tsx` | None | Le props `rowDragManaged` e `onRowDragEnd` passano gia via `...gridProps` |
| `src/components/common/datagrid/AgGrid.tsx` | None | `TreeDataModule` e `AllCommunityModule` (include RowDrag) gia registrati |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cicli gerarchici (A figlio di B figlio di A) | Medium | Validazione `isDescendantOf` prima di confermare il drop |
| Nuove righe in tree mode con `applyTransaction` | Low | `menuPadreId: null` crea nodi a root level, gia gestito nel `getNewRow` |
| Conflitto drag con singleClickEdit | Low | AG Grid gestisce la priorita: drag handle ha precedenza sull'editing |
| Dirty state non triggerato dopo drag | Medium | Handler esplicito in `onRowDragEnd` che marca Modified e setta gridDirty |

## Rollback Plan

Le modifiche sono confinate a `MenuForm.tsx`. Per rollback:
1. Ripristinare `treeData={readOnly}` (una riga)
2. Rimuovere le props drag e l'handler `onRowDragEnd`
3. Nessuna modifica al Datagrid generico da revertire

## Dependencies

- AG Grid Enterprise v33 con `TreeDataModule` (gia installato e registrato)
- `RowDragModule` incluso in `AllCommunityModule` (gia registrato)

## Success Criteria

- [ ] La griglia menu mostra la struttura ad albero sia in modalita bloccata che in modalita modifica
- [ ] In modalita modifica, ogni riga ha un drag handle visibile nella colonna gruppo
- [ ] Trascinare una voce menu su un altro ramo aggiorna `menuPadreId` e l'albero si riorganizza
- [ ] Trascinare una voce su se stessa o su un proprio discendente viene impedito (no cicli)
- [ ] Dopo un drag, il tasto Salva si abilita (dirty state corretto)
- [ ] L'editing inline delle celle funziona correttamente anche con tree data attivo
- [ ] L'aggiunta di nuove righe funziona in tree mode (inserimento a root)
- [ ] TypeScript compila senza errori (`npm run ts:check`)
