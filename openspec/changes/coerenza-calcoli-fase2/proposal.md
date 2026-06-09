# Proposal: Coerenza Calcoli — Fase 2

## Intent

La Fase 1 (`fix-salvataggio-cassa-fase1`) ha corretto i bug di salvataggio del registro cassa e allineato i totali frontend al backend nei punti critici. Restano però incoerenze di calcolo e di processo emerse dall'audit:

1. **Formule IVA duplicate inline** in più punti (scorporo da lordo e applicazione su imponibile), con convenzioni diverse: `BusinessSettings.VatRate` è una frazione (`0.22`) mentre `AliquotaIva` di fatture/fornitori è una percentuale (`22`). Ogni duplicazione è un punto di divergenza potenziale.
2. **KPI dashboard contabilmente errati**: `MediaMese` include i registri DRAFT (che valgono 0 €) abbassando la media; `TrendSettimana` confronta gli ultimi 3 registri contro il resto (`TakeLast(3)`), una finestra arbitraria che non rappresenta "settimana corrente vs precedente".
3. **Chiusura mensile fragile e netto sovrastimato**: `ChiudiMensileAsync` non usa una transazione esplicita (a differenza di tutti gli orchestrator); `RicavoNettoCalcolato` ignora le `SpeseGiornaliere` dei registri inclusi, quindi il netto mostrato in lista, dettaglio e report di stampa è sovrastimato.
4. **Guard giorno operativo asimmetrici**: la creazione del registro rispetta i `PeriodiProgrammazione` (`GuardGiornoOperativoConPeriodi`), la chiusura solo il calendario globale (`GuardGiornoOperativoSoloGlobale`) → un registro creato in un giorno operativo di periodo può risultare **non chiudibile**.
5. **Residui frontend**: `VistaMensile.tsx` calcola ancora il Totale Vendite mensile con il movimento fisico di cassa (formula che la Fase 1 ha già corretto in `SummaryDataGrid.tsx`); `CashSummary.tsx` è dead code (nessun import nel codebase).

## Scope

### In Scope

**A. IvaCalculator centralizzato (backend)**
1. Nuova classe statica documentata (es. `backend/Common/IvaCalculator.cs`) con due operazioni:
   - **Scorporo da totale lordo** (prezzi IVA inclusa — registro cassa, fatture da pagamento): `Imponibile = Round(lordo / (1 + aliquota), 2)`, `Iva = lordo - Imponibile` (l'IVA come differenza garantisce che imponibile + IVA = lordo al centesimo);
   - **Applicazione su imponibile** (fatture acquisto inserite da imponibile): `Iva = Round(imponibile * aliquota, 2)`, `Totale = imponibile + Iva`.
   - Convenzione di input unica e documentata per l'aliquota (normalizzare frazione `0.22` di `BusinessSettings.VatRate` vs percentuale `22` di `AliquotaIva`), arrotondamento `Math.Round(..., 2)` coerente (documentare il `MidpointRounding` scelto).
2. Sostituire le formule inline con il calculator in:
   - `MutateRegistroCassaOrchestrator.CalcolaTotali` (righe ~532-534, scorporo su `TotaleVendite` con `VatRate` frazionario);
   - `MutateRegistroCassaOrchestrator.UpdatePagamentiEsistenti` (righe ~275-279, scorporo fattura collegata);
   - `MutateRegistroCassaOrchestrator.CreaFatturaAcquisto` (righe ~390-392, scorporo nel riuso fatture introdotto in Fase 1);
   - `FatturaAcquistoOrchestrator.MutateAsync` (righe ~40-41, applicazione IVA su imponibile);
   - `FatturaAcquistoOrchestrator.RicalcolaTotaliFatturaAsync` (righe ~160-166, scorporo da totale DDT con aliquota ricavata inversamente).

**B. Fix KPI dashboard** (`backend/GraphQL/GestioneCassa/GestioneCassaQueries.cs`, righe ~44-94)
3. `MediaMese`: media di `TotaleVendite` calcolata **solo sui registri CLOSED/RECONCILED** del mese corrente (oggi i DRAFT a 0 € abbassano la media).
4. `TrendSettimana`: confronto **settimana corrente (da lunedì a oggi)** vs **stessa porzione della settimana precedente** (lunedì → stesso giorno della settimana), sostituendo il `TakeLast(3)` arbitrario. Solo registri CLOSED/RECONCILED; trend 0 se la base di confronto è 0. Nota: il calcolo attuale di `startOfWeek` usa `DayOfWeek` con domenica=0 → settimana che parte di domenica; va normalizzato a lunedì coerentemente col resto dell'app (vedi `operatingDayIndex` nei guard).

**C. Chiusura mensile** (`backend/Services/ChiusureMensili/ChiusuraMensileService.cs` + `backend/Models/ChiusuraMensile.cs`)
5. `ChiudiMensileAsync` (righe ~115-163) avvolto in transazione esplicita, coerente con il pattern degli orchestrator (`BeginTransaction`/`Commit`/`Rollback`); valutare lo stesso per `CreaChiusuraAsync` che esegue due `SaveChangesAsync` separati (chiusura + link registri/pagamenti) e oggi può lasciare una chiusura senza link in caso di errore a metà.
6. `RicavoNettoCalcolato` (riga ~104) deve sottrarre anche le **SpeseGiornaliere dei registri inclusi**: `RicavoTotale - SpeseAggiuntive - Σ SpeseGiornaliere(registri inclusi)`. Impatto verificato sui consumatori del campo GraphQL `ricavoNettoCalcolato`: `MonthlyClosureList.tsx` (riga ~173), `MonthlyClosureDetails.tsx` (riga ~533), `MonthlyClosureReport.tsx` (riga ~190) — mostrano il valore server e non richiedono modifiche di formula, ma il report di stampa va verificato perché elenchi le voci di spesa in modo coerente col nuovo netto. **Aggiornare i test esistenti** che fissano il valore atteso: `backend/DuedGusto.Tests/Unit/Services/ChiusuraMensileServiceTests.cs` (riga ~233) e `backend/DuedGusto.Tests/Integration/GraphQL/MonthlyClosuresQueriesTests.cs` (riga ~265).

**D. Allineamento guard giorno operativo** (`backend/GraphQL/GestioneCassa/GestioneCassaGuards.cs`)
7. `ChiudiRegistroCassaOrchestrator` (riga ~40) passa da `GuardGiornoOperativoSoloGlobale` a `GuardGiornoOperativoConPeriodi`, con messaggio d'errore declinato per la chiusura ("Impossibile chiudere..."). `GuardGiornoOperativoSoloGlobale` (righe ~84-100) viene rimosso se non ha altri call site (verificato: unico utilizzo è la chiusura). Estrarre la logica condivisa con parametro per il messaggio, evitando duplicazione.

**E. Frontend follow-up**
8. `VistaMensile.tsx` (`duedgusto/src/components/pages/registrazioneCassa/vistaMensile/`, righe ~79-99): `totaleVendite` mensile deve sommare `cr.totaleVendite` dal server (fallback: canali di incasso `contante tracciato + elettronici + fatture`, stessa formula backend), eliminando il `movimento` fisico dalla somma vendite — stesso allineamento fatto in Fase 1 su `SummaryDataGrid.tsx` (riga ~79). Verificare anche il `revenue` degli eventi calendario (riga ~105) che usa la stessa formula del movimento.
9. Rimozione `CashSummary.tsx` (`duedgusto/src/components/pages/registrazioneCassa/CashSummary.tsx`): dead code confermato, nessun import nel codebase.

### Out of Scope

- **NumeroFattura obbligatorio per FA** (era nella Fase 2 originale): superato — la Fase 1 ha introdotto i placeholder deterministici `SN-{yyyyMMdd}-{seq}` per i numeri vuoti, rendendo non necessario l'obbligo.
- **Guard su RegistroCassa CLOSED / mese chiuso** (punto 1 dell'audit): deferred per decisione esplicita dell'utente.
- **IVA multialiquota** (più aliquote per registro/fattura): sarà la change successiva (Fase 3). `IvaCalculator` ne è il prerequisito: centralizza il punto unico da estendere.
- **Ricalcolo retroattivo** dei dati storici (ImportoIva, netti di chiusure già CHIUSE): nessuna migrazione dati; i valori persistiti restano invariati, le proprietà `[NotMapped]` calcolate (es. `RicavoNettoCalcolato`) cambiano invece anche per le chiusure esistenti perché calcolate a runtime — comportamento accettato e documentato.
- Refactoring di qualità generale (Fase 4 dell'audit).

## Approach

1. **IvaCalculator**: classe statica pura in `backend/Common/` (namespace `duedgusto.Common`), senza dipendenze, con XML doc che fissa convenzione aliquota e arrotondamento. I call site convertono la propria convenzione (frazione/percentuale) verso quella del calculator in un punto solo. Nessun cambiamento funzionale atteso nei valori calcolati (le formule sono già matematicamente equivalenti): è consolidamento, e i casi limite (aliquota 0, importi negativi) vengono definiti una volta sola.
2. **KPI**: filtro `Stato == "CLOSED" || Stato == "RECONCILED"` sulle query del mese e delle settimane (riusare la costante/condizione già usata da `ChiusuraMensileService.CreaChiusuraAsync`); calcolo `startOfWeek` normalizzato a lunedì; trend = `(correnteParziale - precedenteEquivalente) / precedenteEquivalente * 100` con guardia divisione per zero. `VenditeOggi`/`DifferenzaOggi` restano sul registro del giorno (anche DRAFT: è il dato live di oggi).
3. **Chiusura mensile**: avvolgere `ChiudiMensileAsync` (e `CreaChiusuraAsync`) in transazione con il pattern try/commit/catch/rollback già usato dagli orchestrator (il servizio usa `AppDbContext` direttamente: `dbContext.Database.BeginTransactionAsync()` come in `SettingsMutations`). Estendere `RicavoNettoCalcolato` sommando `Registro.SpeseGiornaliere` dei `RegistriInclusi` con `Incluso == true` (le relazioni sono già caricate da `GetChiusuraConRelazioniAsync`).
4. **Guard**: rifattorizzare `GestioneCassaGuards` per condividere la valutazione "giorno operativo con periodi" tra creazione e chiusura, parametrizzando il verbo del messaggio; aggiornare `ChiudiRegistroCassaOrchestrator` e rimuovere il guard solo-globale.
5. **Frontend**: in `VistaMensile.tsx` usare `cr.totaleVendite` (server) con fallback alla somma canali; eliminare `CashSummary.tsx`. Lint + ts:check a valle.

Moduli coinvolti: **backend e frontend**. Migrazioni DB: **nessuna** (solo logica applicativa e proprietà `[NotMapped]`).

## Affected Areas

| Area | Impact | Descrizione |
|------|--------|-------------|
| `backend/Common/IvaCalculator.cs` | New | Scorporo IVA da lordo + applicazione IVA su imponibile, convenzione aliquota e Round documentati |
| `backend/GraphQL/GestioneCassa/MutateRegistroCassaOrchestrator.cs` | Modified | `CalcolaTotali`, `UpdatePagamentiEsistenti`, `CreaFatturaAcquisto` → IvaCalculator |
| `backend/GraphQL/Fornitori/FatturaAcquistoOrchestrator.cs` | Modified | `MutateAsync`, `RicalcolaTotaliFatturaAsync` → IvaCalculator |
| `backend/GraphQL/GestioneCassa/GestioneCassaQueries.cs` | Modified | `dashboardKPIs`: MediaMese solo CLOSED/RECONCILED, TrendSettimana lunedì→oggi vs equivalente precedente |
| `backend/Services/ChiusureMensili/ChiusuraMensileService.cs` | Modified | Transazione esplicita in `ChiudiMensileAsync` (e `CreaChiusuraAsync`) |
| `backend/Models/ChiusuraMensile.cs` | Modified | `RicavoNettoCalcolato` include SpeseGiornaliere dei registri inclusi |
| `backend/GraphQL/GestioneCassa/GestioneCassaGuards.cs` | Modified | Chiusura allineata a `GuardGiornoOperativoConPeriodi`; rimozione guard solo-globale |
| `backend/GraphQL/GestioneCassa/ChiudiRegistroCassaOrchestrator.cs` | Modified | Usa il guard con periodi |
| `backend/DuedGusto.Tests/Unit/Services/ChiusuraMensileServiceTests.cs` | Modified | Atteso `RicavoNettoCalcolato` aggiornato (riga ~233) |
| `backend/DuedGusto.Tests/Integration/GraphQL/MonthlyClosuresQueriesTests.cs` | Modified | Atteso `RicavoNettoCalcolato` aggiornato (riga ~265) |
| `duedgusto/src/components/pages/registrazioneCassa/vistaMensile/VistaMensile.tsx` | Modified | Totale Vendite mensile dal valore server / formula canali di incasso |
| `duedgusto/src/components/pages/registrazioneCassa/CashSummary.tsx` | Removed | Dead code, nessun import |
| `duedgusto/src/components/pages/registrazioneCassa/MonthlyClosureReport.tsx` | Verify | Coerenza voci del report con il nuovo netto (modifica solo se necessario) |

## Risks

| Rischio | Probabilità | Mitigazione |
|---------|-------------|-------------|
| `RicavoNettoCalcolato` cambia retroattivamente anche per chiusure già CHIUSE (proprietà runtime, non persistita) | Alta (intenzionale) | Documentare nel changelog; il nuovo valore è quello contabilmente corretto; nessun dato persistito viene toccato |
| L'introduzione di IvaCalculator altera importi per differenze di arrotondamento/convenzione aliquota | Bassa | Formule matematicamente identiche alle attuali; convenzione aliquota normalizzata in un punto solo; confronto puntuale prima/dopo sui call site in verify |
| Il guard con periodi blocca la chiusura di registri esistenti creati quando non c'erano periodi configurati | Bassa | Il guard con periodi ha già fallback alle impostazioni globali quando non esistono periodi: comportamento invariato in quel caso |
| Trend settimana a inizio settimana (lunedì) con base quasi nulla produce percentuali instabili | Media | Confronto su porzione equivalente (lunedì→stesso giorno); trend 0 con base 0; documentare la formula nel resolver |
| La transazione esplicita in `ChiudiMensileAsync` confligge con transazioni ambient di chiamanti GraphQL | Bassa | Verificato: le mutation ChiusureMensili chiamano il servizio senza transazione propria; pattern identico agli orchestrator esistenti |
| Test esistenti su `RicavoNettoCalcolato` falliscono | Alta (attesa) | Aggiornamento contestuale dei due test con i nuovi valori attesi |

## Rollback Plan

- **Nessuna migrazione DB e nessun dato persistito modificato**: il rollback è un revert puramente applicativo dei commit (backend + frontend).
- IvaCalculator: revert ripristina le formule inline; nessun impatto sui dati già salvati (i valori calcolati sono identici).
- `RicavoNettoCalcolato` e KPI: proprietà/risposte calcolate a runtime → revert ripristina immediatamente i valori precedenti.
- Guard chiusura: revert ripristina il guard solo-globale; i registri chiusi nel frattempo restano validi.
- `CashSummary.tsx`: recuperabile dalla history git se servisse.

## Dependencies

- Fase 1 (`fix-salvataggio-cassa-fase1`) committata: il riuso fatture con scorporo (righe ~390-392) e l'allineamento `SummaryDataGrid` sono i punti di partenza di A.2 ed E.8.
- `GetChiusuraConRelazioniAsync` deve caricare `RegistriInclusi.Registro` (già verificato: usato da `TotaleContantiCalcolato` ecc.).
- Suite test backend esistente (`backend/DuedGusto.Tests`) eseguibile con `dotnet test`.
- Fase 3 (IVA multialiquota) dipenderà da IvaCalculator: l'API del calculator deve restare estendibile (aliquota come parametro, non costante).

## Success Criteria

- [ ] Nessuna formula IVA inline residua in `MutateRegistroCassaOrchestrator` e `FatturaAcquistoOrchestrator`: tutti i 5 call site usano `IvaCalculator`
- [ ] A parità di input, gli importi IVA/imponibile/totale calcolati prima e dopo il refactoring coincidono al centesimo (imponibile + IVA = lordo)
- [ ] `MediaMese` ignora i registri DRAFT: con N registri chiusi e M bozze, la media è su N
- [ ] `TrendSettimana` confronta lunedì→oggi della settimana corrente con la porzione equivalente della settimana precedente (solo registri CLOSED/RECONCILED); 0 se la base è 0
- [ ] `ChiudiMensileAsync` (e `CreaChiusuraAsync`) eseguono in transazione: un errore a metà non lascia stato parziale
- [ ] `RicavoNettoCalcolato = RicavoTotale - SpeseAggiuntive - Σ SpeseGiornaliere` dei registri inclusi; lista, dettaglio e report stampa mostrano il nuovo netto
- [ ] Un registro creato in un giorno operativo di un periodo di programmazione è sempre chiudibile (guard simmetrici)
- [ ] `VistaMensile` mostra il Totale Vendite mensile coerente con i valori server (somma `totaleVendite`), non più il movimento fisico
- [ ] `CashSummary.tsx` rimosso; `npm run ts:check` e `npm run lint` passano
- [ ] `dotnet build` e `dotnet test` passano (test `RicavoNettoCalcolato` aggiornati)
