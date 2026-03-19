# Proposal: Mutation GraphQL per CRUD Menu

## Intent

La pagina "Gestione voci di menu" permette di modificare, aggiungere e cancellare voci di menu nella griglia, ma il salvataggio non funziona: `onSubmit` mostra un toast di successo senza inviare nulla al backend. `useSubmitMenu` e uno stub con `setTimeout`. Non esiste nessuna mutation GraphQL per i menu nel backend.

L'utente modifica i dati, clicca Salva, vede "Operazione completata con successo" ma al reload i dati sono invariati.

## Scope

### In Scope
- **Backend**: creare `MenuInputType` (GraphQL input type per Menu)
- **Backend**: creare mutation `mutateMenus(menus: [MenuInput!]!)` — batch upsert (insert + update)
- **Backend**: creare mutation `deleteMenus(ids: [Int!]!)` — batch delete con validazione
- **Frontend**: creare `src/graphql/menus/mutations.tsx` con i documenti GraphQL tipizzati
- **Frontend**: riscrivere `useSubmitMenu.tsx` con `useMutation` reale
- **Frontend**: creare `useDeleteMenus.tsx` hook
- **Frontend**: collegare `MenuDetails.onSubmit` alle mutation reali
- **Frontend**: tracciare le righe cancellate in un ref per inviarle al backend al momento del salvataggio
- **Frontend**: refetch dei dati dopo salvataggio per sincronizzare gli ID delle nuove righe

### Out of Scope
- Gestione permessi/autorizzazione granulare sulle mutation menu
- Audit log delle modifiche ai menu
- Ordinamento drag & drop che aggiorna `posizione` automaticamente (feature separata futura)
- Validazione unicita percorso/nomeVista lato backend

## Approach

Seguire il pattern consolidato di `mutateRuolo`/`deleteRuolo`:

**Backend** (`AuthMutations.cs`):
1. Creare `MenuInputType` con tutti i campi del modello Menu (id, titolo, percorso, icona, visibile, posizione, percorsoFile, nomeVista, menuPadreId)
2. Aggiungere mutation `mutateMenus` che riceve una lista di `MenuInput`, fa upsert per ogni elemento (id=0 → insert, id>0 → update), e ritorna la lista aggiornata
3. Aggiungere mutation `deleteMenus` che riceve una lista di ID, valida che non ci siano figli orfani (cascade), e rimuove

**Frontend**:
1. Creare `mutations.tsx` con `mutationSubmitMenus` e `mutationDeleteMenus` (gql + TypedDocumentNode)
2. Riscrivere `useSubmitMenu.tsx` con `useMutation(mutationSubmitMenus)`
3. Creare `useDeleteMenus.tsx` con `useMutation(mutationDeleteMenus)`
4. In `MenuForm`: esporre i dati griglia tramite ref/callback per il submit
5. In `MenuDetails.onSubmit`: raccogliere righe Modified/Added dal grid, raccogliere ID cancellati dal ref, chiamare le mutation, refetch

**Tracking righe cancellate**:
- Aggiungere un `useRef<number[]>` in MenuForm per tracciare gli ID delle righe cancellate (aggiornato via `onRowsDeleted`)
- Al submit, leggere questo ref + i dati del grid per le righe modificate/aggiunte

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/GraphQL/Authentication/Types/MenuInputType.cs` | New | Input type GraphQL per Menu |
| `backend/GraphQL/Authentication/AuthMutations.cs` | Modified | Aggiungere mutateMenus e deleteMenus |
| `duedgusto/src/graphql/menus/mutations.tsx` | New | Documenti GraphQL per le mutation menu |
| `duedgusto/src/graphql/menus/useSubmitMenu.tsx` | Modified | Riscrivere con useMutation reale |
| `duedgusto/src/graphql/menus/useDeleteMenus.tsx` | New | Hook per delete batch |
| `duedgusto/src/components/pages/menu/MenuDetails.tsx` | Modified | Collegare onSubmit alle mutation |
| `duedgusto/src/components/pages/menu/MenuForm.tsx` | Modified | Esporre dati griglia, tracciare righe cancellate |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cascade delete cancella figli inaspettati | Medium | Il backend gia ha cascade su MenuPadreId; deleteMenus deve cancellare solo gli ID espliciti e lasciare la cascade di EF gestire i figli |
| ID nuove righe (id=0) non sincronizzati dopo insert | Medium | Refetch completo dei menu dopo il salvataggio con fetchPolicy network-only |
| Righe cancellate perse se l'utente annulla e riprende | Low | Il ref delle righe cancellate viene resettato solo al refetch post-salvataggio |
| Ordine di esecuzione: delete prima di upsert (o viceversa) | Medium | Eseguire prima le delete, poi le upsert, per evitare conflitti su menuPadreId |

## Rollback Plan

**Backend**: rimuovere le due mutation da `AuthMutations.cs` e il file `MenuInputType.cs`. Nessuna migrazione DB coinvolta.

**Frontend**: ripristinare `useSubmitMenu.tsx` allo stub originale, rimuovere `mutations.tsx` e `useDeleteMenus.tsx`, ripristinare `onSubmit` in MenuDetails al toast-only.

## Dependencies

- Backend .NET 8.0 con GraphQL.NET gia configurato
- Entity Framework Core con `DbSet<Menu>` e relazione ricorsiva MenuPadreId gia configurata
- Apollo Client 3 nel frontend con pattern `useMutation` consolidato

## Success Criteria

- [ ] Modificare campi di un menu esistente, salvare, e ritrovare le modifiche dopo reload
- [ ] Aggiungere una nuova voce menu, salvare, e vederla persistita con ID reale dopo reload
- [ ] Cancellare una voce menu, salvare, e verificare che sia sparita dopo reload
- [ ] Spostare una voce menu via drag & drop (cambia menuPadreId), salvare, e verificare la nuova gerarchia dopo reload
- [ ] Togglare il checkbox Visibile, salvare, e verificare il nuovo valore dopo reload
- [ ] In caso di errore del server, mostrare un toast di errore e non perdere i dati nella griglia
- [ ] TypeScript compila senza errori (`npm run ts:check`)
- [ ] Backend compila senza errori (`dotnet build`)
