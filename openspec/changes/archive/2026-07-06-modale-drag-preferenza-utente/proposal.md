# Proposal: Preferenza per-utente per la modalita' di drag della modale (free/elastic)

## Intent

La modale condivisa `AppDialog` e' gia' trascinabile dalla barra del titolo (mouse+touch) con due comportamenti al rilascio: `"free"` (resta dove viene lasciata, reset al centro alla riapertura) ed `"elastic"` (snap-back all'origine). Oggi la scelta e' fissata da una **costante hardcoded** (`DEFAULT_DRAG_MODE = "free"` in `AppDialog.tsx`), quindi e' identica per tutti gli utenti e non modificabile.

L'obiettivo (issue GitHub #4 arricchita) e' rendere la scelta `free`/`elastic` una **preferenza per-utente persistita nel backend** (GraphQL/DB), modificabile dalla pagina del profilo utente (`ProfilePage`) e valida su ogni dispositivo/sessione perche' viaggia col profilo. I nuovi utenti nascono con default `"free"`.

Questo introduce anche il **primo pattern di preferenza utente sincronizzata sul server** del progetto: oggi l'unica preferenza (tema) e' salvata solo in `localStorage`, quindi non c'e' precedente riusabile e va disegnato con cura.

## Scope

### In Scope
- Nuova colonna scalare **non-nullable** `PreferenzaDragModale` (string) sull'entita' `Utente`, default `"free"`, con validazione applicativa whitelist `"free"|"elastic"`.
- Migration EF Core `AddColumn<string>(..., nullable: false, defaultValue: "free")` cosi' gli utenti esistenti ereditano `"free"` senza backfill manuale.
- Esposizione del campo in output GraphQL (`UtenteType`) e in input (`UtenteInputType`), aggiunta al `UtenteFragment` (propaga a query `utenteCorrente`/`getUtentePerId` e a `mutateUtente`).
- Persistenza del campo nella mutation `mutateUtente` in **ENTRAMBI** i rami (update + create), con `ContainsKey` + fallback `"free"`.
- Selettore `free`/`elastic` in `ProfilePage` (nuova sezione "Preferenze": RadioGroup/Select MUI con etichette leggibili), integrato in schema Zod + form Formik + variables della mutation.
- Lettura della preferenza in `AppDialog` dallo `userStore` (Zustand) con fallback `"free"` quando l'utente non e' ancora caricato; sostituzione della sorgente del default oggi data da `DEFAULT_DRAG_MODE`.
- Aggiornamento del tipo dominio TS (`Utente.d.ts`) e dell'interfaccia `UtenteInput` TS.
- Aggiornamento dei test impattati (backend integrazione GraphQL su `mutateUtente`/`utenteCorrente`; frontend `ProfilePage.test.tsx` ed eventuali test di `AppDialog`/`userStore`).

### Out of Scope
- Migrazione della **preferenza tema** dal `localStorage` al backend (resta locale; da valutare in un change futuro per uniformita').
- Introduzione di un'entita' separata `PreferenzeUtente` (over-engineering per un singolo campo; valutabile in futuro se le preferenze server-side cresceranno).
- Modellazione con enum C# forte / `EnumerationGraphType` GraphQL (si preferisce string + validazione applicativa, coerente col pattern del progetto).
- Modifiche al **meccanismo di drag** vero e proprio (gia' implementato e funzionante): nessun cambio a pointer events, transizioni o UX del trascinamento.
- Aggiunta del selettore nella pagina Impostazioni generali (per decisione: va nel profilo utente).
- Nuovi endpoint REST o nuove mutation dedicate (si riusa l'infrastruttura `mutateUtente`).

## Approach

**Approccio 1** dell'esplorazione (raccomandato, rischio basso): riuso completo dell'infrastruttura utente/profilo esistente.

1. **Backend**: aggiungere `PreferenzaDragModale` (string) a `Utente`, configurabile con default in `AppDbContext`; migration con colonna non-nullable e `defaultValue: "free"`; esporre in `UtenteType`, accettare in `UtenteInputType`; in `mutateUtente` persistere il campo nei rami update e create leggendo dal `Dictionary<string, object>` con validazione whitelist e fallback `"free"`.
2. **GraphQL/TS shared**: aggiungere il campo a `UtenteFragment` (cosi' `utenteCorrente` lo restituisce e la mutation lo invia) e ai tipi TS `Utente` / `UtenteInput`.
3. **Frontend UI**: in `ProfilePage` aggiungere una sezione "Preferenze" con selettore `free`/`elastic` (etichette tipo `free` = "Resta dove la lasci", `elastic` = "Torna al centro"), incluso in schema Zod, form Formik e nelle variables inviate a `mutationSubmitUtente`; al salvataggio aggiornare lo store via `receiveUtente`.
4. **Frontend consumo**: in `AppDialog` derivare il default `dragMode` dalla preferenza utente nello `userStore` (via un piccolo hook dedicato, es. `useDragModePreference`, per non accoppiare direttamente il componente presentazionale allo store) con fallback `"free"`. I 6 consumatori esistenti non passano `dragMode` esplicito, quindi la modifica del default si propaga a tutte le modali.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/Models/Utente.cs` | Modified | Nuova proprieta' `PreferenzaDragModale` (string, default `"free"`) |
| `backend/DataAccess/AppDbContext.cs` (blocco `Utente`) | Modified | Config esplicita colonna: lunghezza/default `"free"`, non-nullable |
| `backend/GraphQL/Authentication/Types/UtenteType.cs` | Modified | Espone `preferenzaDragModale` in output |
| `backend/GraphQL/Authentication/Types/UtenteInputType.cs` | Modified | Accetta `preferenzaDragModale` in input |
| `backend/GraphQL/Authentication/AuthMutations.cs` (`mutateUtente`) | Modified | Persiste il campo nei rami update **e** create con whitelist + fallback |
| `backend/Migrations/` | New | Migration `AddColumn<string>(nullable:false, defaultValue:"free")` |
| `backend/SeedData/SeedTestUser.cs` | Modified (eventuale) | Valorizza `PreferenzaDragModale` nel seed |
| `duedgusto/src/@types/Utente.d.ts` | Modified | Campo `preferenzaDragModale` nel tipo dominio |
| `duedgusto/src/graphql/utente/fragment.tsx` | Modified | Campo nel `UtenteFragment` (propaga a query + mutation) |
| `duedgusto/src/graphql/utente/mutations.tsx` | Modified | Campo nell'interfaccia TS `UtenteInput` |
| `duedgusto/src/components/pages/profile/ProfilePage.tsx` | Modified | Sezione "Preferenze": selettore `free`/`elastic` (Zod + Formik + variables) |
| `duedgusto/src/components/common/dialog/AppDialog.tsx` | Modified | Default `dragMode` dallo `userStore` con fallback `"free"` |
| `duedgusto/src/components/common/dialog/` (nuovo hook) | New (eventuale) | `useDragModePreference` per disaccoppiare AppDialog dallo store |
| Test backend/frontend | Modified | Integrazione GraphQL (`mutateUtente`/`utenteCorrente`), `ProfilePage.test.tsx`, eventuali test `AppDialog`/`userStore` |

**Moduli impattati**: **both** (backend .NET + frontend React).

**Migration DB richiesta**: **SI** — nuova colonna non-nullable su tabella `Utenti` con `defaultValue: "free"` (senza default MySQL fallirebbe su tabella non vuota).

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Doppio ramo in `mutateUtente`: campo aggiunto solo in update o solo in create -> salvataggio silenziosamente ignorato | Med | Aggiungere il campo in ENTRAMBI i rami; test di integrazione che verifica il round-trip su create e update |
| `AppDialog` aperta prima del caricamento profilo (`utente` null durante bootstrap/logout) rompe le modali | Med | Fallback esplicito `"free"` quando `utente` e' `null`; hook `useDragModePreference` centralizza il fallback |
| Accoppiamento del componente presentazionale `AppDialog` allo store Zustand impatta i test esistenti che montano le modali | Med | Isolare l'accesso allo store in un hook dedicato; aggiornare/mockare nei test le modali |
| Migration su colonna non-nullable fallisce su tabella `Utenti` non vuota | Low | `AddColumn<string>(nullable:false, defaultValue:"free")`: gli utenti esistenti ereditano `"free"` |
| Valore fuori whitelist salvato in DB (input manuale/API) rende indefinito il comportamento drag | Low | Validazione whitelist `"free"|"elastic"` in `mutateUtente` + fallback `"free"` in lettura client |
| Cambio di `UtenteFragment` disallinea query/mutation e relativi test/cache Apollo | Low | Il fragment e' condiviso: una sola modifica propaga; aggiornare gli snapshot/test coinvolti |

## Rollback Plan

- **Frontend**: rimuovere il selettore da `ProfilePage`, ripristinare `AppDialog` all'uso della costante `DEFAULT_DRAG_MODE` e togliere il campo da fragment/tipi TS/hook. Nessun dato utente viene perso (il DB puo' conservare la colonna inutilizzata).
- **Backend applicativo**: rimuovere l'esposizione del campo da `UtenteType`/`UtenteInputType`/`mutateUtente`; la colonna DB puo' restare orfana senza impatto funzionale (default `"free"`).
- **Migration DB**: reversibile con `dotnet ef migrations remove` (se non ancora applicata in produzione) oppure con una migration inversa `DropColumn("PreferenzaDragModale")`. La colonna non-nullable con default e' droppabile senza perdita di dati identita' utente.
- **Deploy**: il change e' additivo e retrocompatibile; un rollback del deploy frontend precedente continua a funzionare anche con la colonna gia' presente (viene ignorata). Ordine sicuro: deploy backend (colonna+campo) prima del frontend.

## Dependencies

- Nessuna dipendenza esterna nuova. Riusa: query `utenteCorrente`, mutation `mutateUtente`, `ProfilePage`, `userStore`, `UtenteFragment` gia' esistenti.
- Prerequisito operativo: le migrazioni EF Core vengono applicate automaticamente all'avvio del backend (verificare che il default `"free"` sia applicato in ambienti con `Utenti` gia' popolata).

## Success Criteria

- [ ] Un utente puo' scegliere `free`/`elastic` dalla sezione "Preferenze" del proprio profilo e salvarla.
- [ ] La preferenza persiste nel DB (`Utenti.PreferenzaDragModale`) e viene restituita da `utenteCorrente`.
- [ ] La preferenza segue l'utente su un altro dispositivo/sessione (nessun uso di `localStorage`).
- [ ] Tutte le modali `AppDialog` rispettano la preferenza salvata; con `utente` non caricato usano fallback `"free"`.
- [ ] I nuovi utenti nascono con `"free"`; gli utenti esistenti (post-migration) hanno `"free"`.
- [ ] La mutation persiste il valore sia in create sia in update; valori fuori whitelist non corrompono il comportamento.
- [ ] `dotnet build` OK; `npm run ts:check` e `npm run lint` OK; test backend e frontend impattati aggiornati e verdi.
