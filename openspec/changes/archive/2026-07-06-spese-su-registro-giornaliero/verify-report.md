# Verification Report

**Change**: spese-su-registro-giornaliero
**Riferimento**: GitHub issue #8
**Data verifica**: 2026-07-06
**Versione**: N/A (delta specs chiusure-mensili + gestione-cassa)

---

## Esito complessivo: PASS_WITH_NOTES

Tutte le Fasi 1-9 sono implementate e tutti i gate finali (Fase 10.1/10.2) passano con
esito reale verificato in questa sessione. Le uniche note sono deviazioni minori
**documentate** nei task e già accettate (codice morto residuo non bloccante, copertura
test round-trip via percorso alternativo, task DB/deploy intenzionalmente non eseguiti).

---

## Completeness

| Metrica | Valore |
|---------|--------|
| Task totali | 63 |
| Task completati `[x]` | 60 |
| Task incompleti `[ ]` | 3 |

Task incompleti (tutti **non bloccanti**, per design):
- **2.4** — Applicare le migrazioni su DB pulito. NON eseguito volutamente: auto-apply
  all'avvio via `Program.cs` (come da istruzioni "non applicare al DB").
- **10.1** — Gate backend `dotnet build`/`dotnet test`. Eseguiti e **verdi** in questa
  verifica (checkbox non spuntato nel file, ma il gate è passato — vedi sotto).
- **10.2** — Gate frontend `ts:check`/`lint`/`test`. Eseguiti e **verdi** in questa verifica.
- **10.3** (nota, non checkbox di codice) — riconferma conteggi DB su prod prima del merge:
  azione operativa pre-deploy, fuori dal codice.

---

## Build & Tests Execution (GATE FINALI — esito reale)

| Comando | Esito | Dettaglio |
|---------|-------|-----------|
| `cd backend && dotnet build` (solution intera, incl. progetto test) | PASS | `Build succeeded. 0 Warning(s), 0 Error(s)` — `duedgusto.dll` + `DuedGusto.Tests.dll` |
| `cd backend && dotnet test` | PASS | `Passed: 255, Failed: 0, Skipped: 0, Total: 255` |
| `cd duedgusto && npm run ts:check` | PASS | `tsc -b` senza errori |
| `cd duedgusto && npm run lint` | PASS | `eslint .` senza errori |
| `cd duedgusto && npm run test` | PASS | `Test Files 83 passed (83)`, `Tests 626 passed (626)` |

**Coverage**: non configurato (`rules.verify.coverage_threshold` assente) → non valutato.

---

## Copertura Spec — chiusure-mensili

| Requirement | Scenario | Evidenza | Esito |
|-------------|----------|----------|-------|
| Atomicità creazione chiusura | Errore a metà creazione — nessun dato parziale | `CreaChiusuraAsync` in transazione esplicita (`ChiusuraMensileService`), join `PagamentoMensileFornitori` rimossa | COPERTO |
| Atomicità creazione chiusura | Creazione riuscita — solo link ai registri | Nessun record `PagamentoMensileFornitori`; solo `RegistriCassaMensili` | COPERTO |
| Chiusura come pura aggregazione | Netto come pura aggregazione dei registri inclusi | `RicavoNettoCalcolato = RicavoTotale − SpeseTracciateRegistriCalcolate − SpeseGiornaliereRegistriCalcolate` (`ChiusuraMensile.cs:104-105`); test `ComputedProperties_KpiPuri_NettoComeAggregazione` | COPERTO |
| Chiusura come pura aggregazione | Registro escluso non contribuisce | `.Where(r => r.Incluso)` su tutti i KPI (`ChiusuraMensile.cs:54-138`); test esistente registro escluso | COPERTO |
| Chiusura come pura aggregazione | Nessuna spesa fuori registro | Navigation `SpeseLibere`/`PagamentiInclusi` rimosse dal modello (garanzia compile-time) | COPERTO |
| Chiusura come pura aggregazione | Chiusura già CHIUSA espone valori aggregati a runtime | KPI `[NotMapped]` calcolati a runtime, nessun dato persistito | COPERTO |
| GraphQL Schema Changes | Schema privo dei tipi e mutation rimossi | File tipi legacy assenti; mutation legacy assenti; `ChiusuraMensileType` espone solo `speseGiornaliereRegistriCalcolate`/`speseTracciateRegistriCalcolate`/`ricavoNettoCalcolato` | COPERTO (compile-time; vedi deviazione introspezione) |

## Copertura Spec — gestione-cassa

| Requirement | Scenario | Evidenza | Esito |
|-------------|----------|----------|-------|
| Categoria su SpesaCassa | Registrare spesa fissa in contanti | `SpesaCassa.Categoria` NOT NULL default `Altro` (`SpesaCassa.cs:13`); `AggiungiSpesaSuGiornoTests` ramo cash `Affitto` | COPERTO |
| Categoria su SpesaCassa | Categoria assente ammessa | Test `NonTracciata_CategoriaDefaultAltro`; default `Altro` | COPERTO |
| Categoria su SpesaCassa | Categoria non altera riconciliazione | `CalcolaTotali` invariata (`MutateRegistroCassaOrchestrator.cs:340-351`) — `Categoria` non compare nella formula | COPERTO |
| Categoria su PagamentoFornitore | Spesa fissa via bonifico senza documento | `AggiungiSpesaSuGiornoOrchestrator.cs:75-87` (Categoria + MetodoPagamento Bonifico, FatturaId/DdtId null); test ramo tracciata | COPERTO |
| Categoria su PagamentoFornitore | Pagamento con documento conserva Categoria opzionale | `PagamentoFornitore.Categoria` nullable (`PagamentoFornitore.cs:34`) | COPERTO |
| Registro "leggero" | Spesa su giorno non operativo senza registro | `AggiungiSpesaSuGiornoOrchestrator` NON applica `GuardGiornoOperativoConPeriodi`; test su data domenica | COPERTO |
| Registro "leggero" | Registro esistente riusato (idempotenza) | `FindOrCreateRegistroCassaAsync` + indice UNIQUE su `Data`; test idempotenza | COPERTO |
| Registro "leggero" | Spesa rifiutata su mese chiuso | `GuardMeseChiuso` mantenuto (`AggiungiSpesaSuGiornoOrchestrator.cs:48`); test mese CHIUSA → `ExecutionError` | COPERTO |
| Esposizione GraphQL Categoria | SpesaCassa espone categoria, non metodoPagamento | `SpesaCassaType.cs:16` (`NonNullGraphType<EnumerationGraphType<CategoriaSpesa>>`); nessun `metodoPagamento` | COPERTO |
| Esposizione GraphQL Categoria | PagamentoFornitore espone categoria e non più speseMensili | `PagamentoFornitoreType.cs:25-26`; `speseMensili` assente | COPERTO |
| Esposizione GraphQL Categoria | Round-trip categoria via mutateRegistroCassa | Coperto via `aggiungiSpesaSuGiorno` (cash + tracciata); mapping in `mutateRegistroCassa` è privato/statico | PARZIALE (vedi deviazione 8.7) |

**Riepilogo copertura**: 17/18 scenari COPERTI, 1 PARZIALE (round-trip via percorso
alternativo, comportamento comunque testato).

---

## Criteri di accettazione issue #8

| Criterio | Esito | Evidenza |
|----------|-------|----------|
| SpesaMensileLibera/SpeseMensiliLibere rimossa; nessuna spesa appesa a ChiusuraMensile | PASS | File entità eliminati; nav `SpeseLibere` rimossa; nessun ref fuori da Migrations storiche |
| Legacy SpesaMensile + tipi Typera rimossi | PASS | `SpesaMensile.cs` + `SpesaMensile*Type.cs`/Typera assenti |
| Spese mensili registrabili su registro giornaliero; tracciato/non-tracciato non altera riconciliazione | PASS | `SpesaCassa`+Categoria / `PagamentoFornitore`+Categoria; `CalcolaTotali` invariata |
| KPI chiusura solo da registri inclusi; tracciato/non-tracciato quadrano senza residuo; rimossi campi speciali | PASS | KPI PR #7 (`SpeseAggiuntiveNonDuplicateCalcolate`/`TotaleSpeseCalcolato`/`DifferenzaCalcolata`) rimossi; `RicavoNetto` = pura aggregazione |
| Rimosse tabelle SpeseMensili/SpeseMensiliLibere/PagamentiMensiliFornitori; ChiusuraMensile solo → RegistriCassaMensili | PASS | Migrazione `Drop...` con 3 `DropTable`; DbSet/config rimossi; solo `RegistriInclusi` resta |
| Test aggiornati verdi | PASS | 255 backend + 626 frontend, 0 failed |

---

## Decisioni verificate

| Decisione | Esito | Evidenza |
|-----------|-------|----------|
| Decision 3 — registro leggero (mutation dedicata, bypass solo giorno-operativo) | CONFERMATA | `AggiungiSpesaSuGiornoOrchestrator` mantiene `GuardMeseChiuso`, NON applica `GuardGiornoOperativoConPeriodi`, blocca `RECONCILED`, usa find-or-create (DRAFT) |
| Decision 8 — esclusione registri a sole spese da TotaleDifferenzeCassaCalcolato | CONFERMATA | `ChiusuraMensile.cs:133-138` condizione inline `!(TotaleVendite==0 && TotaleApertura==TotaleChiusura)`; test `TotaleDifferenzeCassa_EscludeRegistriASoleSpese...` |
| Decision 9 — guard RegistroCassaId sempre valorizzato | CONFERMATA | `AggiungiSpesaSuGiornoOrchestrator.cs:65-70` (reg.Id>0) e `:90-94` (RegistroCassaId != null); test Decision 9 |
| Formula ContanteAtteso INVARIATA | CONFERMATA | `CalcolaTotali` (`MutateRegistroCassaOrchestrator.cs:340-351`): `ContanteAtteso = IncassoContanteTracciato − SpeseFornitori − SpeseGiornaliere`, `Differenza = incassoGiornaliero − ContanteAtteso`. `Categoria` non compare. `internal` per riuso come fonte unica |

---

## Coherence (Design) — File Changes

Tutte le voci della tabella "File Changes" del design risultano applicate: modelli, DbContext,
2 migrazioni (add colonne → drop tabelle), tipi GraphQL, orchestrator/mutation nuovi,
service semplificato, `Program.cs` (DI: rimosso `MigrazioneChiusureMensiliService`,
aggiunto `AggiungiSpesaSuGiornoOrchestrator`), frontend (tipi, fragment, componenti,
componenti morti eliminati). Nessuna alternativa scartata reintrodotta.

---

## Issues Found

**CRITICAL** (bloccanti prima dell'archive):
- Nessuno.

**WARNING** (da valutare, non bloccanti):
- **Codice morto in `SpeseDataGrid.tsx`**: l'infrastruttura `persistence`
  (`persistence?` prop + rami `createExpense/updateExpense/createSupplierPayment/
  updateSupplierPayment`) è ora **irraggiungibile** — nessun caller passa più `persistence`
  (verificato: solo `RegistroCassaForm` usa il grid, in modalità staged con
  `showCategoria`). Deviazione **documentata e accettata** nei task 7.2/9.1 (rimozione
  rimandata a refactor Fase 7, non test-only). Non altera il comportamento; candidata a
  cleanup follow-up.

**SUGGESTION** (migliorie):
- **Deviazione test 8.6/8.7**: l'assenza dei tipi/mutation rimossi dallo schema GraphQL è
  garantita a compile-time (il progetto applicativo referenzia quei simboli e compila),
  non da un test di introspezione schema — scelta motivata (infrastruttura DI di
  introspezione assente nella suite integrazione). Il round-trip `Categoria` è coperto via
  `aggiungiSpesaSuGiorno` anziché `mutateRegistroCassa` (mapping privato/statico). Copertura
  comportamentale equivalente; eventuale test di introspezione è nice-to-have.
- **Commento residuo** in `ChiusuraMensile.cs:141-143`: la docstring di `AvvisiCompletezza`
  cita ancora "pagamenti fornitori del mese non inclusi" (ramo rimosso). Solo commento,
  nessun impatto funzionale. Fix banale (aggiornare la docstring) — **segnalato, non applicato**.

---

## Verdict

**PASS WITH NOTES** — Implementazione completa e conforme a specs, design e criteri issue #8.
Tutti e 5 i gate finali verdi (build solution 0/0, 255 test backend, ts:check, lint, 626
test frontend). Nessun riferimento legacy nel codice sorgente (solo negli snapshot storici
delle migrazioni, corretto). Le uniche note sono codice morto documentato/accettato e
deviazioni test motivate. Pronto per l'archive; prima del merge eseguire la nota deploy 10.3
(riconferma conteggi DB su prod).
