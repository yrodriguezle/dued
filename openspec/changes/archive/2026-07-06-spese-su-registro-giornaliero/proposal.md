# Proposal: Spese sul registro giornaliero (chiusura mensile = pura aggregazione)

**Change**: spese-su-registro-giornaliero
**Riferimento**: GitHub issue #8
**Esplorazione**: `openspec/changes/spese-su-registro-giornaliero/exploration.md`
**Moduli**: backend (.NET/GraphQL/EF) + frontend (React/Apollo) — modifica **fullstack**
**Migrazioni DB**: SÌ, ma **solo migrazioni di schema** (drop tabelle + add colonne). **NESSUNA migrazione dati** (vedi `Approccio`).

## Intent

Oggi le spese vivono in **quattro** posti diversi (`SpesaCassa` sul registro, `PagamentoFornitore`,
`SpesaMensileLibera` appesa alla `ChiusuraMensile`, e `SpesaMensile` legacy morto). Questo ha
costretto la chiusura mensile ad accumulare logica speciale (KPI `[NotMapped]` anti-doppio-conteggio
introdotti nella PR #7, mutation per gestire spese "fuori registro", un servizio di migrazione no-op)
solo per riconciliare fonti di spesa eterogenee.

La decisione (issue #8) è riportare la **chiusura mensile a pura aggregazione dai registri
giornalieri**: nessuna spesa appesa direttamente a `ChiusuraMensile`. Tutte le spese vivono su un
registro giornaliero (**OPZIONE B**). Questo elimina il codice legacy, rende i KPI
tracciato/non-tracciato quadranti per costruzione (sono somme dei soli registri inclusi) e dà una
sola sede coerente per ogni spesa.

## Scope

### In Scope

**Asse contabile = TRACCIATO / NON-TRACCIATO** (non "contanti / non-contanti"):
- **`SpesaCassa`** = spese **NON tracciate**, sempre in contanti. Acquisisce **solo** il campo
  `Categoria` (enum `CategoriaSpesa`: `Affitto | Utenze | Stipendi | Altro`).
  **NON** riceve un campo `MetodoPagamento`.
- **`PagamentoFornitore`** = spese **TRACCIATE** (metodo `Contanti` o `Bonifico`, campo
  `MetodoPagamento string?` **già esistente**). Acquisisce il campo `Categoria` per ospitare le
  **spese fisse pagate in modo tracciato** (affitto/utenze/stipendi via bonifico). `FatturaId`/`DdtId`
  sono **già nullable** → una spesa tracciata **senza documento** è già ammessa dal modello.
- **Spese fisse**: se pagate in contanti → `SpesaCassa` + `Categoria`; se pagate in modo tracciato
  (bonifico/altro) → `PagamentoFornitore` + `Categoria`.

**Rimozioni (legacy + residuo PR #7)**:
- Entità + tabelle: `SpesaMensile` (`SpeseMensili`), `SpesaMensileLibera` (`SpeseMensiliLibere`),
  `PagamentoMensileFornitori` (`PagamentiMensiliFornitori`).
- Tipi GraphQL: `SpesaMensileType`, `SpesaMensileInputType`, `SpesaMensileTyperaType`,
  `SpesaMensileTyperaInputType`, `PagamentoMensileFornitoriType`.
- Servizio + mutation di migrazione: `MigrazioneChiusureMensiliService` (no-op) e la mutation
  `migraChiusureMensiliVecchioModello`.
- Mutation spese libere: `aggiungiSpesaLibera`, `modificaSpesaLibera`, `eliminaSpesaLibera`.
- Mutation pagamenti in chiusura: `aggiungiPagamentoFornitoreInChiusura`,
  `modificaPagamentoFornitoreInChiusura`, `eliminaPagamentoFornitoreInChiusura`,
  `includiPagamentoFornitore` (già dead).
- KPI `[NotMapped]` speciali della PR #7 su `ChiusuraMensile`: `SpeseAggiuntiveNonDuplicateCalcolate`,
  `TotaleSpeseCalcolato`, `DifferenzaCalcolata` → diventano **codice morto** una volta tolte le
  `SpeseLibere`. Navigation `SpeseLibere` e `PagamentiInclusi` rimosse. `RegistriInclusi`
  (`RegistriCassaMensili`) **resta** (unica join legittima per l'aggregazione).

**Aggiunte**:
- Colonna `Categoria` su `SpeseCassa` e su `PagamentiFornitori` (enum mappato).
- Percorso per registrare una spesa su un **giorno privo di registro** (es. affitto pagato in un
  giorno di chiusura): **registro "leggero"** (solo spese, senza vendite) creabile su qualsiasi data
  del mese, con **bypass** di `GuardGiornoOperativoConPeriodi` limitato al percorso spese.
  **Dettaglio rimandato al design.**

**Chiusura mensile → pura aggregazione**:
- I valori tracciato/non-tracciato restano invariati e derivano **solo** dai registri inclusi:
  `SpeseTracciate = Σ SpeseFornitori`, `SpeseNonTracciate = Σ SpeseGiornaliere` (già corretti nel
  codice). Nessun ricalcolo speciale, nessuna spesa fuori registro.

**Frontend**:
- Rimozione mutation/fragment/tipi delle spese libere e dei pagamenti-in-chiusura; spostamento
  dell'editing spese sul registro giornaliero; riuso di `CategoriaSpesa`/`categoriaOptions` (già
  presenti) sul registro.

### Out of Scope

- **NON** si tocca la formula `ContanteAtteso` / riconciliazione del contante del giorno.
  L'utente la considera irrilevante per questa change: l'asse rilevante (tracciato/non-tracciato di
  spese e ricavato) è **già** corretto nel codice. (Diverge dalla raccomandazione tentativa
  dell'esplorazione, che ipotizzava di rivedere `CalcolaTotali`/`RecalculateSpeseFornitori`.)
- **NON** si aggiunge `MetodoPagamento` a `SpesaCassa` (per definizione è sempre contanti/non-tracciato).
- **NESSUNA migrazione dati** delle spese storiche (vedi `Approccio` per la giustificazione sui dati reali).
- Entità spesa unica tipizzata (`Spesa` con `tipo`) — follow-up citato in issue #8 punto 3, rimandato.

## Approccio

### Modello (OPZIONE B)
`SpesaCassa` (non tracciata, contanti) e `PagamentoFornitore` (tracciata, con `MetodoPagamento` già
esistente) diventano le **uniche** sedi delle spese, entrambe agganciate a un registro giornaliero.
Entrambe acquisiscono `Categoria` per classificare le spese fisse. La chiusura mensile non ospita più
spese proprie: aggrega i registri via `RegistriCassaMensili`.

### Perché NESSUNA migrazione dati (dati reali dev = specchio prod)
- `SpeseMensili` = **0 righe** e `SpeseMensiliLibere` = **0 righe** → nulla da migrare, si droppa e basta.
- `PagamentiMensiliFornitori` = **32 righe**, ma **tutte** con `PagamentoFornitore.RegistroCassaId`
  **NON null** → droppando la join di chiusura, ogni pagamento resta raggiungibile via registro:
  **zero orfani**.
- `ChiusureMensili` = **2 righe, entrambe in stato `BOZZA`** (nessuna `CHIUSA`/`RICONCILIATA`) →
  nessun mese chiuso viene toccato, nessun KPI storico blindato da preservare.

Le migrazioni EF sono quindi **solo di schema**: (1) `AddCategoriaToSpesaCassa` +
`AddCategoriaToPagamentoFornitore` (add colonna enum, default `Altro` o nullable — da fissare in
design); (2) `DropSpeseMensili_SpeseMensiliLibere_PagamentiMensiliFornitori` (drop tabelle + FK residue,
inclusa la FK `PagamentoFornitore.SpeseMensili`).

### Registro "leggero" (dettaglio in design)
Per pagare una spesa in un giorno senza registro (es. affitto in giorno di chiusura settimanale),
serve un find-or-create del registro alla data che **bypassi** `GuardGiornoOperativoConPeriodi` per il
solo percorso spese (una spesa non è un'operazione di vendita). L'indice UNIQUE su `RegistroCassa.Data`
rende l'operazione idempotente. `GuardMeseChiuso` **resta** attivo (non si tocca un mese chiuso).
Meccanismo esatto (mutation dedicata vs estensione di `mutateRegistroCassa`, stato del registro
leggero) da definire in design.

## Affected Areas

| Area | Impatto | Descrizione |
|------|---------|-------------|
| `backend/Models/SpesaCassa.cs` | Modified | Aggiunge `Categoria` (enum `CategoriaSpesa`). |
| `backend/Models/PagamentoFornitore.cs` | Modified | Aggiunge `Categoria`. `MetodoPagamento`/`FatturaId?`/`DdtId?` già presenti. |
| `backend/Models/ChiusuraMensile.cs` | Modified | Rimuove nav `SpeseLibere`, `PagamentiInclusi` e i `[NotMapped]` PR #7 (`SpeseAggiuntiveNonDuplicateCalcolate`, `TotaleSpeseCalcolato`, `DifferenzaCalcolata`). Mantiene `RegistriInclusi`. |
| `backend/Models/SpesaMensile.cs`, `SpesaMensileLibera.cs`, `PagamentoMensileFornitori.cs` | Removed | Entità eliminate. |
| `backend/DataAccess/AppDbContext.cs` | Modified | Rimuove DbSet `SpeseMensili`/`SpeseMensiliLibere`/`PagamentiMensiliFornitori` e relative config; estende config `SpesaCassa` e `PagamentoFornitore`. |
| Migrazioni EF | New | `AddCategoria*` (add colonne) + `Drop*` (drop tabelle/FK). Solo schema, nessun backfill dati. |
| `backend/GraphQL/GestioneCassa/Types/SpesaCassaType.cs` | Modified | Estende `SpesaCassaType`/`SpesaCassaInput`/`SpesaCassaInputType` con `Categoria`. |
| `backend/GraphQL/Fornitori/Types/PagamentoFornitoreType.cs` | Modified | Aggiunge `categoria`; rimuove field `speseMensili`. |
| `backend/GraphQL/ChiusureMensili/Types/` | Removed/Modified | Elimina `SpesaMensileType`, `SpesaMensileInputType`, `SpesaMensileTyperaType`, `SpesaMensileTyperaInputType`, `PagamentoMensileFornitoriType`; ripulisce `ChiusuraMensileType`/`InputType`. |
| `backend/GraphQL/ChiusureMensili/ChiusureMensiliMutations.cs` | Modified | Rimuove le mutation spese libere, pagamento-in-chiusura, `includiPagamentoFornitore`, `migraChiusureMensiliVecchioModello`. |
| `backend/Services/ChiusureMensili/ChiusuraMensileService.cs` | Modified | Rimuove i metodi `AggiungiSpesaLibera*`/`*PagamentoFornitoreInChiusura*`/`IncludiPagamentoFornitore`; semplifica `GetChiusuraConRelazioniAsync` e la valorizzazione KPI. |
| `backend/Services/ChiusureMensili/MigrazioneChiusureMensiliService.cs` | Removed | Servizio no-op eliminato. |
| `backend/GraphQL/Connection/ConnectionQueries.cs` | Modified | Rimuove query `speseMensili` e gli `Include(SpeseLibere/PagamentiInclusi)`. |
| `backend/GraphQL/GestioneCassa/MutateRegistroCassaOrchestrator.cs` | Modified | `AggiungiSpese` mappa il nuovo campo `Categoria`. **Formula `CalcolaTotali` invariata.** |
| Registro "leggero" (backend) | New | Percorso spesa-su-giorno-senza-registro con bypass `GuardGiornoOperativoConPeriodi`. **Dettaglio in design.** |
| `duedgusto/src/graphql/chiusureMensili/mutations.tsx` | Modified | Rimuove mutation spese libere e pagamenti-in-chiusura. |
| `duedgusto/src/graphql/chiusureMensili/fragments.tsx` | Modified | Rimuove `speseLibere`, `pagamentiInclusi`, KPI PR #7. |
| `duedgusto/src/@types/MonthlyClosure.d.ts` | Modified | Rimuove `SpesaMensileLibera`, `PagamentoMensileFornitori`, KPI PR #7. |
| `duedgusto/src/components/pages/registrazioneCassa/MonthlyClosureDetails.tsx` | Modified | Rimuove wiring/handler delle spese libere e pagamenti-in-chiusura. |
| `RegistroCassaDetails.tsx`, `SpeseDataGrid.tsx`, `@types/RegistroCassa.d.ts`, `graphql/registroCassa/*` | Modified | Editing spese sul registro con `Categoria`. `SpeseDataGrid` è condivisa: refactor senza rompere il flusso registro. |
| Componenti morti (`MonthlyClosureList/Form/SummaryView.tsx`) | Removed (opz.) | Candidati cleanup, non importati. |
| Test | Modified | `ChiusuraMensileServiceTests`, `MonthlyClosuresQueriesTests`, `MonthlyClosureDetails.test.tsx`, `SpeseDataGrid.test.tsx`. |
| Spec `openspec/specs/chiusure-mensili` | Modified | Il requirement `RicavoNettoCalcolato` referenzia `SpeseAggiuntiveCalcolate`/`SpeseLibere`: da riscrivere come pura aggregazione dai registri inclusi. |
| Spec `openspec/specs/gestione-cassa` | Modified (minore) | Aggiungere `Categoria` a `SpesaCassa`/`SpesaCassaInput` e al flusso registro; spesa-su-giorno-senza-registro. |

## Risks

| Rischio | Probabilità | Mitigazione |
|---------|-------------|-------------|
| Rimozioni distruttive (3 tabelle + molti tipi/mutation) rompono riferimenti residui | Media | Ricerca esaustiva dei riferimenti (già mappata nell'esplorazione); `dotnet build` + `ts:check`/`lint` come gate; drop coperto da migrazione EF reversibile. |
| `SpeseDataGrid` è condivisa tra chiusura e registro: refactor rompe il flusso registro | Media | Test su entrambi i flussi; il grid già distingue righe `isPagamentoFornitore`/`registroCassaId`. |
| Registro "leggero" apre un buco nei guard (spese in mesi/giorni non dovuti) | Media | Bypass limitato a `GuardGiornoOperativoConPeriodi`; `GuardMeseChiuso` resta attivo; scelte fissate in design con validazione contabile. |
| Semantica `Categoria` su `PagamentoFornitore` (default, nullability) ambigua | Bassa | Definire in design default/nullability della colonna enum e mapping GraphQL. |
| Spec `chiusure-mensili` disallineata dopo la rimozione dei KPI PR #7 | Bassa | Aggiornare la spec nella fase spec/archive; nessun mese `CHIUSA` esistente da preservare. |

## Rollback Plan

- **Codice**: la change è isolata su un branch dedicato; rollback = revert del branch/PR. Nessun
  merge su `main` prima del gate CI (`dotnet test` + build frontend).
- **Database**: le migrazioni EF sono di **solo schema**. Rollback = `dotnet ef database update <MigrazionePrecedente>`:
  - `Add Categoria*` è additiva e reversibile senza perdita (drop colonna).
  - `Drop*` tabelle: essendo `SpeseMensili`/`SpeseMensiliLibere` **vuote** e i
    `PagamentiMensiliFornitori` **ridondanti** rispetto a `PagamentoFornitore.RegistroCassaId`, il
    down della migrazione ricrea le tabelle vuote/di sola struttura senza perdita di dati di business.
  - **Nessun backfill dati** → nessun rischio di rollback dati sporco.
- Poiché non esistono chiusure `CHIUSA`/`RICONCILIATA`, un rollback non lascia mesi blindati in stato
  incoerente.

## Dependencies

- Nessuna dipendenza esterna.
- Prerequisito informativo: i conteggi DB citati (`SpeseMensili=0`, `SpeseMensiliLibere=0`,
  `PagamentiMensiliFornitori=32` tutti con `RegistroCassaId` non null, `ChiusureMensili=2` BOZZA)
  vanno **riconfermati su prod** prima del deploy, poiché giustificano l'assenza di migrazione dati.

## Success Criteria

- [ ] `SpesaCassa` espone `Categoria` (enum `CategoriaSpesa`) e **non** ha `MetodoPagamento`.
- [ ] `PagamentoFornitore` espone `Categoria`; una spesa tracciata senza fattura/DDT è registrabile.
- [ ] Entità/tabelle `SpesaMensile`, `SpesaMensileLibera`, `PagamentoMensileFornitori` rimosse; nessun
      riferimento residuo (build backend + `ts:check` verdi).
- [ ] Mutation e tipi GraphQL elencati in `Rimozioni` non esistono più nello schema.
- [ ] KPI `[NotMapped]` PR #7 rimossi; `SpeseTracciate`/`SpeseNonTracciate` continuano a quadrare come
      pura aggregazione dei registri inclusi (`Σ SpeseFornitori` / `Σ SpeseGiornaliere`).
- [ ] La formula `ContanteAtteso`/riconciliazione contante è **invariata** rispetto a prima della change.
- [ ] È possibile registrare una spesa su un giorno privo di registro senza sbloccare un mese chiuso.
- [ ] Migrazioni EF solo di schema; nessuno step di data-migration; suite test backend + frontend verdi.

## Open Questions (per il design)

1. **Registro "leggero"**: meccanismo esatto del find-or-create con bypass di
   `GuardGiornoOperativoConPeriodi` (mutation dedicata `aggiungiSpesaSuGiorno(data)` vs estensione di
   `mutateRegistroCassa`), stato del registro creato (DRAFT?), e comportamento con `GuardMeseChiuso`.
2. **Categoria su `PagamentoFornitore`**: default/nullability della colonna enum, valore per le 32 righe
   esistenti, esposizione GraphQL.
3. **Validazione contabile**: far validare dall'`accounting-expert` la coerenza dell'asse
   tracciato/non-tracciato e la conferma che lasciare invariata la formula `ContanteAtteso` non
   introduce incoerenze nei KPI di chiusura.
4. **Cleanup componenti frontend morti** (`MonthlyClosureList/Form/SummaryView.tsx`): includere o
   rimandare.
