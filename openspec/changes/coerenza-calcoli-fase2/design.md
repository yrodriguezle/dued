# Design: Coerenza Calcoli — Fase 2

## Technical Approach

La change consolida le formule IVA in un calculator statico unico (`duedgusto.Common.IvaCalculator`), corregge i KPI dashboard (filtro stati + settimana lunedì-based), rende transazionale la chiusura mensile, corregge il netto mensile sottraendo le spese giornaliere dei registri inclusi, allinea il guard di chiusura a quello di creazione, e completa l'allineamento frontend di Fase 1 (`VistaMensile.tsx` + rimozione `CashSummary.tsx`).

Vincolo guida: **nessun cambiamento di valore negli importi IVA calcolati** (refactoring a parità di output, vedi Decisione 2) e **nessuna migrazione DB** (solo logica applicativa e proprietà `[NotMapped]`).

Tutto il codice letto e verificato prima delle decisioni: i numeri di riga citati sono quelli correnti su `main` (post Fase 1).

## Architecture Decisions

### Decisione 1: IvaCalculator — convenzione aliquota FRAZIONE, conversione esplicita ai call site

**Choice**: `IvaCalculator` accetta l'aliquota **solo come frazione** (`0.22` = 22%). Per i call site che lavorano in percentuale (`AliquotaIva = 22`) il calculator espone l'helper di conversione `IvaCalculator.AliquotaDaPercentuale(decimal percentuale) => percentuale / 100m`, da chiamare esplicitamente al call site.

**Alternatives considered**:
- Convenzione percentuale (22) con conversione per `VatRate`: scartata — le formule matematiche sono naturali in frazione (`lordo / (1 + a)`), e ogni `/100` interno sarebbe un punto di divergenza nascosto.
- Overload doppi (`...DaPercentuale` / `...DaFrazione`): scartato — raddoppia l'API e rende ambiguo il call site che passa un `decimal` nudo.
- Tipo wrapper `Aliquota` (value object): scartato — over-engineering per 5 call site; la Fase 3 (multialiquota) può introdurlo se serve.

**Rationale**: una sola convenzione interna documentata in XML doc elimina la classe di bug "frazione vs percentuale"; la conversione esplicita `AliquotaDaPercentuale(...)` rende visibile e grep-abile ogni punto in cui la convenzione del dominio (percentuale di `Fornitore.AliquotaIva`/`FatturaAcquistoInput.AliquotaIva`) entra nel calculator. `BusinessSettings.VatRate` (già frazione, vedi seed test `VatRate = 0.10m`) passa diretto.

### Decisione 2: MidpointRounding — mantenere il default ToEven, esplicitato

**Choice**: tutti gli arrotondamenti del calculator usano `Math.Round(value, 2, MidpointRounding.ToEven)`, cioè il **default attuale** di `Math.Round(value, 2)`, reso esplicito come documentazione.

**Alternatives considered**: `AwayFromZero` (arrotondamento "commerciale"): scartato — cambierebbe i valori calcolati rispetto a oggi nei casi di midpoint, violando il success criterion "a parità di input gli importi coincidono al centesimo".

**Rationale**: nel codebase non esiste alcun uso di `MidpointRounding` (verificato con grep: zero occorrenze) → tutto il codice attuale usa implicitamente ToEven. Mantenerlo garantisce zero variazioni retroattive. Nota di equivalenza per `CalcolaTotali` (unico punto dove la formula attuale arrotonda l'IVA invece dell'imponibile): per un lordo con ≤2 decimali (i campi sono `decimal(10,2)`), `Round(lordo·a/(1+a), 2)` e `lordo − Round(lordo/(1+a), 2)` coincidono sempre con ToEven — le parti frazionarie oltre il secondo decimale di imponibile e IVA sono complementari, quindi una arrotonda in su e l'altra in giù (nei tie, le cifre dei centesimi sono `d` e `9−d`: una è pari e l'altra dispari). Va documentato nel XML doc e coperto da test unitario sui casi midpoint (es. lordo che produce imponibile `x.xx5`).

### Decisione 3: API IvaCalculator — due operazioni che restituiscono la terna completa

**Choice**: classe statica pura `backend/Common/IvaCalculator.cs`, namespace `duedgusto.Common`, con `readonly record struct RisultatoIva(decimal Imponibile, decimal Iva, decimal Totale)` e due metodi:

```csharp
namespace duedgusto.Common;

public readonly record struct RisultatoIva(decimal Imponibile, decimal Iva, decimal Totale);

public static class IvaCalculator
{
    /// <summary>Converte un'aliquota percentuale (es. 22) nella frazione interna (0.22).</summary>
    public static decimal AliquotaDaPercentuale(decimal percentuale) => percentuale / 100m;

    /// <summary>
    /// Scorporo IVA da totale lordo (prezzi IVA inclusa).
    /// Imponibile = Round(lordo / (1 + aliquota), 2, ToEven); Iva = lordo - Imponibile.
    /// L'IVA come differenza garantisce Imponibile + Iva == lordo al centesimo.
    /// </summary>
    public static RisultatoIva ScorporaDaLordo(decimal lordo, decimal aliquota);

    /// <summary>
    /// Applicazione IVA su imponibile (fatture inserite da imponibile).
    /// Iva = Round(imponibile * aliquota, 2, ToEven); Totale = imponibile + Iva.
    /// </summary>
    public static RisultatoIva ApplicaSuImponibile(decimal imponibile, decimal aliquota);
}
```

Casi limite definiti una sola volta: `aliquota < 0` → `ArgumentOutOfRangeException`; `aliquota == 0` → IVA 0, imponibile = totale = importo; importi negativi ammessi (rettifiche/storni, le formule sono simmetriche).

**Alternatives considered**:
- Due metodi separati per IVA e imponibile (`IvaDaLordo`, `ImponibileDaLordo`): scartato — l'invariante `Imponibile + Iva == Lordo` è garantibile solo se i due valori nascono dallo stesso calcolo; metodi separati la romperebbero (riproducendo proprio la divergenza attuale di `CalcolaTotali`).
- Tuple anonime `(decimal, decimal)`: scartato — il record struct dà nomi ai campi e resta allocazione-free.
- Servizio iniettabile (DI): scartato — funzione pura senza stato né dipendenze; il pattern del progetto per logica condivisa statica è `GestioneCassaGuards` (classe statica, zero DI).

**Rationale**: il risultato a terna copre tutti e 5 i call site (alcuni usano imponibile+IVA, altri IVA+totale) con una sola forma; il prerequisito Fase 3 è rispettato (aliquota sempre parametro, mai costante interna).

### Decisione 4: Mapping dei 5 call site

**Choice**:

| Call site | Convenzione origine | Sostituzione |
|---|---|---|
| `MutateRegistroCassaOrchestrator.CalcolaTotali` (r. 532-534) | `VatRate` frazione | `registroCassa.ImportoIva = IvaCalculator.ScorporaDaLordo(registroCassa.TotaleVendite, aliquotaIva).Iva;` |
| `MutateRegistroCassaOrchestrator.UpdatePagamentiEsistenti` (r. 275-279) | percentuale (default 22m / `Fornitore.AliquotaIva`) | `var r = IvaCalculator.ScorporaDaLordo(totaleConIva, IvaCalculator.AliquotaDaPercentuale(aliquota)); linkedFattura.Imponibile = r.Imponibile; linkedFattura.ImportoIva = r.Iva; linkedFattura.TotaleConIva = r.Totale;` |
| `MutateRegistroCassaOrchestrator.CreaFatturaAcquisto` (r. 390-392) | percentuale | identico al precedente (stesso scorporo per riuso e creazione fattura) |
| `FatturaAcquistoOrchestrator.MutateAsync` (r. 40-41) | percentuale (`input.AliquotaIva`) | `var r = IvaCalculator.ApplicaSuImponibile(input.Imponibile, IvaCalculator.AliquotaDaPercentuale(input.AliquotaIva)); fattura.ImportoIva = r.Iva; fattura.TotaleConIva = r.Totale;` |
| `FatturaAcquistoOrchestrator.RicalcolaTotaliFatturaAsync` (r. 160-166) | percentuale derivata inversamente | la derivazione `aliquota = Round(ImportoIva / Imponibile * 100, 2)` con fallback 22m **resta invariata** (non è una formula IVA, è inferenza dell'aliquota); poi `ScorporaDaLordo(totale, AliquotaDaPercentuale(aliquota))` |

**Rationale**: nei call site di scorporo l'attuale `Math.Round(totale / (1 + aliquota/100), 2)` con IVA per differenza è esattamente `ScorporaDaLordo` — output bit-identico. In `MutateAsync` l'attuale `Round(imponibile * aliquota / 100, 2)` è esattamente `ApplicaSuImponibile` — output bit-identico. Unico punto con dimostrazione di equivalenza non banale è `CalcolaTotali` (vedi Decisione 2).

### Decisione 5: KPI — filtro stati e settimana lunedì-based con porzione equivalente

**Choice**: in `GestioneCassaQueries.dashboardKPIs` (r. 44-94):

```csharp
private static readonly string[] StatiContabilizzati = ["CLOSED", "RECONCILED"];

DateTime today = DateTime.Today;
var startOfMonth = new DateTime(today.Year, today.Month, 1);
// Lunedì della settimana corrente — stessa mappatura ((DayOfWeek+6)%7) di guard e chiusure
DateTime startOfWeek = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
DateTime startOfLastWeek = startOfWeek.AddDays(-7);
DateTime sameDayLastWeek = today.AddDays(-7);
```

- `VenditeOggi` / `DifferenzaOggi`: invariati (registro del giorno, anche DRAFT — dato live).
- `VenditeMese`: invariato (somma su tutti i registri del mese; i DRAFT a 0 € non alterano una somma).
- `MediaMese`: `monthRegisters.Where(r => StatiContabilizzati.Contains(r.Stato))` → `Average(r => r.TotaleVendite)`, 0 se la lista filtrata è vuota.
- `TrendSettimana`: porzione corrente = registri contabilizzati con `Data >= startOfWeek && Data <= today`; porzione precedente equivalente = `Data >= startOfLastWeek && Data <= sameDayLastWeek`. `trend = prevTotal == 0 ? 0 : (currTotal - prevTotal) / prevTotal * 100`. Elimina `TakeLast(3)`. La query `weekRegisters` resta una sola (range `startOfLastWeek..today`), il filtro stato e lo split delle due porzioni avvengono in memoria.

**Alternatives considered**:
- Costante stati condivisa in `Models` (es. `RegistroCassaStati`): scartata per questa fase — oggi i literal `"CLOSED"`/`"RECONCILED"` sono duplicati in molti file (servizio chiusure, orchestrator, frontend); centralizzarli è refactoring di qualità (Fase 4 dell'audit). L'array privato nel resolver basta a EF (`Contains` → `IN`).
- Settimana ISO con `System.Globalization.ISOWeek`: scartato — serve solo il lunedì corrente, l'aritmetica `(DayOfWeek+6)%7` è già la convenzione del progetto (`operatingDayIndex` in `GestioneCassaGuards` r. 49, `ChiusuraMensileService` r. 384/563/621).

**Rationale**: confronto "stessa porzione di settimana" rende il trend stabile a inizio settimana (lunedì vs lunedì) e contabilmente sensato; il filtro stati esclude le bozze a 0 € che oggi abbassano la media. Formula documentata in commento nel resolver (richiesta del proposal, riga rischio "percentuali instabili").

### Decisione 6: Transazione in ChiusuraMensileService — `Database.BeginTransactionAsync` diretto, senza execution strategy

**Choice**: `CreaChiusuraAsync` e `ChiudiMensileAsync` avvolti nel pattern già usato da `SettingsMutations` (r. 148):

```csharp
await using IDbContextTransaction transaction = await _dbContext.Database.BeginTransactionAsync();
try
{
    // ... SaveChangesAsync multipli ...
    await transaction.CommitAsync();
}
catch
{
    await transaction.RollbackAsync();
    throw;
}
```

In `CreaChiusuraAsync` la transazione copre i passi 5-7 (insert chiusura + link registri + link pagamenti, due `SaveChangesAsync`); la rilettura finale `GetChiusuraConRelazioniAsync` resta fuori. In `ChiudiMensileAsync` copre validazione completezza + transizione stato + `SaveChangesAsync` (difensivo: oggi è un singolo SaveChanges, ma protegge da estensioni future e garantisce lettura coerente validazione→write).

**Alternatives considered**:
- Refactor del servizio su `IUnitOfWork` (pattern orchestrator): scartato — il servizio è iniettato anche negli orchestrator che hanno già una loro `IUnitOfWork`-transazione; mischiare i due pattern rischia transazioni annidate. Il servizio usa `AppDbContext` direttamente per design, e `UnitOfWork.BeginTransactionAsync` (r. 83) è comunque solo un wrapper di `_context.Database.BeginTransactionAsync()`: stesso meccanismo.
- `IExecutionStrategy.ExecuteAsync(...)`: non necessario — `UseMySql` è configurato senza `EnableRetryOnFailure` (verificato in `Program.cs` r. 86 e `AppDbContext.OnConfiguring` r. 54: zero occorrenze di retry strategy), quindi non esiste una retrying execution strategy che vieti `BeginTransaction` esplicito.
- Transazioni annidate dai chiamanti GraphQL: verificato — `ChiusureMensiliMutations` chiama il servizio senza transazione propria. `MutateRegistroCassaOrchestrator` inietta il servizio ma usa solo `DataAppartieneAMeseChiusoAsync` (read-only) dentro la propria transazione: nessun conflitto.

**Impatto test (finding chiave)**: i test unitari usano EF **InMemory** (`TestDbContextFactory.Create()` → `UseInMemoryDatabase`), che di default **lancia** su `BeginTransactionAsync` (`TransactionIgnoredWarning` configurato come throw). Senza intervento, l'aggiunta della transazione rompe TUTTI i test di `ChiusuraMensileServiceTests` che passano per `CreaChiusuraAsync`. Fix: in `TestDbContextFactory.Create()` aggiungere

```csharp
.ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
```

(namespace `Microsoft.EntityFrameworkCore.Diagnostics`) — le transazioni diventano no-op nei test InMemory, comportamento standard per questo provider.

### Decisione 7: RicavoNettoCalcolato — nuova proprietà intermedia + nuovo campo GraphQL

**Choice**: in `ChiusuraMensile.cs`:

```csharp
/// <summary>Somma delle spese giornaliere dei registri cassa inclusi</summary>
[NotMapped]
public decimal SpeseGiornaliereRegistriCalcolate => RegistriInclusi
    .Where(r => r.Incluso)
    .Sum(r => r.Registro?.SpeseGiornaliere ?? 0);

[NotMapped]
public decimal RicavoNettoCalcolato =>
    RicavoTotaleCalcolato - SpeseAggiuntiveCalcolate - SpeseGiornaliereRegistriCalcolate;
```

Esposizione GraphQL: nuovo field `speseGiornaliereRegistriCalcolate` in `ChiusuraMensileType` (stesso pattern dei field calcolati esistenti) + descrizione di `ricavoNettoCalcolato` aggiornata ("ricavo totale - spese aggiuntive - spese giornaliere registri").

**Caricamento relazioni verificato**: la proprietà richiede `RegistriInclusi.Registro` caricato; `SpeseGiornaliere` è colonna scalare di `RegistroCassa`, quindi arriva con l'entità. Entrambi i percorsi GraphQL la caricano: `chiusuraMensile` via `GetChiusuraConRelazioniAsync` (Include + ThenInclude r. 514-515) e `chiusureMensili` lista con gli stessi Include (ChiusureMensiliQueries r. 51-52). Le mutation restituiscono entità ricaricate dal servizio. Nessun percorso valuta `RicavoNettoCalcolato` senza relazioni caricate.

**Impatto frontend**:
- `MonthlyClosureList.tsx` (r. 173) e `MonthlyClosureDetails.tsx` (r. 533): mostrano il valore server → nessuna modifica di formula (il valore cambia automaticamente).
- `MonthlyClosureReport.tsx` (r. 178-192, "Riepilogo Finale"): oggi elenca `Lordo`, `IVA`, `Totale Spese (speseAggiuntiveCalcolate)`, `RICAVO NETTO`. Con il nuovo netto la tabella non quadrerebbe più (`Lordo − Spese ≠ Netto`). **Aggiungere la riga** `<tr><td>Spese Giornaliere Registri</td><td class="text-right negative">€ ${closure.speseGiornaliereRegistriCalcolate.toFixed(2)}</td></tr>` subito dopo "Totale Spese", così le voci elencate sommano esattamente al netto stampato.
- `duedgusto/src/graphql/chiusureMensili/fragments.tsx`: aggiungere `speseGiornaliereRegistriCalcolate` a `ChiusuraMensileFragment`; `duedgusto/src/@types/MonthlyClosure.d.ts`: aggiungere il campo al tipo.

**Test backend (nota importante)**: i due test citati dal proposal seedano registri con `speseGiornaliere: 0` (default di `SeedRegistroCassa`), quindi i valori attesi attuali **non cambierebbero** e il nuovo comportamento resterebbe non testato. Vanno aggiornati seedando `speseGiornaliere > 0`:
- `ChiusuraMensileServiceTests.ComputedProperties_SpeseAggiuntive_IncludesLiberePlusPagamenti` (r. 233): es. registro con `speseGiornaliere: 50m` → atteso `RicavoNettoCalcolato = 250m` (1000 − 700 − 50) e nuovo assert su `SpeseGiornaliereRegistriCalcolate == 50m`.
- `MonthlyClosuresQueriesTests.YearlySummary_WithExpenses_CalculatesNetCorrectly` (r. 265): analogo (dipende da `SeedChiusuraWithRegisters`, estendere o seedare spese sul registro).

### Decisione 8: Guard chiusura — parametro `azione` su un guard unico

**Choice**: `GuardGiornoOperativoConPeriodi` acquisisce un parametro opzionale per il verbo del messaggio:

```csharp
public static async Task GuardGiornoOperativoConPeriodi(
    AppDbContext dbContext, DateTime data, string azione = "creare")
```

I tre messaggi d'errore interni usano `$"Impossibile {azione} un registro cassa..."` (caso "nessun periodo copre la data" e caso "giorno di chiusura"). Call site:
- `MutateRegistroCassaOrchestrator` (r. 38): invariato (default "creare").
- `ChiudiRegistroCassaOrchestrator` (r. 40): `GuardGiornoOperativoConPeriodi(db, registroCassa.Data, "chiudere")` al posto di `GuardGiornoOperativoSoloGlobale`.
- `GuardGiornoOperativoSoloGlobale` (r. 84-100): **rimosso** — call site unico verificato con grep (solo `ChiudiRegistroCassaOrchestrator.cs:40`).

**Alternatives considered**: metodo privato condiviso `ValutaGiornoOperativo` + due guard pubblici: scartato — resterebbero due metodi pubblici quasi identici; il parametro con default mantiene un solo entry point e zero modifiche al call site di creazione.

**Rationale**: simmetria creazione/chiusura (un registro creato in giorno operativo di periodo è sempre chiudibile); il guard con periodi ha già il fallback alle impostazioni globali quando non esistono periodi (r. 70-74), quindi per installazioni senza periodi il comportamento di chiusura è identico a oggi.

### Decisione 9: VistaMensile — valore server con fallback canali, niente nuove query

**Choice**: `VistaMensile.tsx` ottiene i totali dal payload già caricato da `useQueryCashRegistersByMonth` (il `RegistroCassaFragment` include già `totaleVendite`, verificato in `fragments.tsx` r. 38): **nessuna modifica GraphQL**. Aggregazione client-side nel `useMemo` esistente:

```tsx
// monthlyStats (r. ~80-99)
const contantiDichiarati = cr.incassoContanteTracciato ?? 0;
const elettronici = cr.incassiElettronici ?? 0;
const fatture = cr.incassiFattura ?? 0;
const venditeRegistro = cr.totaleVendite ?? contantiDichiarati + elettronici + fatture;
// ...
totaleVendite: acc.totaleVendite + venditeRegistro,
```

La variabile `movimento` esce dalla somma vendite (e dal reducer, non avendo altri usi). Stessa sostituzione per gli eventi calendario (r. 105):

```tsx
const revenue = cr.totaleVendite ?? (cr.incassoContanteTracciato || 0) + (cr.incassiElettronici || 0) + (cr.incassiFattura || 0);
```

(`revenue` alimenta `title` e il dato mostrato nella cella del calendario: deve mostrare le vendite, non il movimento fisico — stesso fix di Fase 1 su `SummaryDataGrid.tsx` r. 79, identico pattern "server value con fallback canali").

**Alternatives considered**: query dedicata `riepilogoMensile` (esiste già in `queries.tsx` r. 99-113 con `totaleVendite` server-side): scartata — VistaMensile ha già tutti i registri in mano per il calendario; una seconda query aggiungerebbe un round-trip e un punto di disallineamento tra strip riepilogo e celle calendario.

**Rationale**: backend unica fonte di verità per i registri salvati; il fallback canali (stessa formula di `CalcolaTotali`) copre eventuali registri con `totaleVendite` null (tipizzazione difensiva, come in SummaryDataGrid).

### Decisione 10: CashSummary.tsx — rimozione

**Choice**: eliminare `duedgusto/src/components/pages/registrazioneCassa/CashSummary.tsx`.

**Rationale**: dead code confermato — grep su tutto `duedgusto/src`: le uniche occorrenze di `CashSummary` sono nel file stesso (definizione + export). Recuperabile da git history.

## Data Flow

```
IVA — scorporo da lordo (registro cassa / fatture da pagamento):
  call site (VatRate frazione | AliquotaIva %)        IvaCalculator
        │  AliquotaDaPercentuale(22) se %  ──────────►  ScorporaDaLordo(lordo, 0.22)
        │                                                Imponibile = Round(lordo/(1+a), 2, ToEven)
        ◄────────── RisultatoIva ───────────────────     Iva = lordo − Imponibile  (quadra al centesimo)

IVA — applicazione su imponibile (FatturaAcquistoOrchestrator.MutateAsync):
        │  AliquotaDaPercentuale(input.AliquotaIva) ──►  ApplicaSuImponibile(imponibile, a)
        ◄────────── RisultatoIva ───────────────────     Iva = Round(imp·a, 2, ToEven); Totale = imp + Iva

Chiusura mensile (sequenza CreaChiusuraAsync, ora transazionale):
  GraphQL mutation ──► ChiusuraMensileService.CreaChiusuraAsync
                          │ BEGIN TRANSACTION
                          │   INSERT ChiusuraMensile + SaveChanges
                          │   INSERT link RegistriCassaMensili + PagamentiMensiliFornitori + SaveChanges
                          │ COMMIT (rollback su errore → nessuna chiusura senza link)
                          └─► GetChiusuraConRelazioniAsync (fuori transazione)
                                └─► RicavoNettoCalcolato = RicavoTotale − SpeseAggiuntive − Σ SpeseGiornaliere(inclusi)
                                      └─► GraphQL: ricavoNettoCalcolato + speseGiornaliereRegistriCalcolate
                                            └─► MonthlyClosureList / Details / Report (valori server)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/Common/IvaCalculator.cs` | Create | Calculator statico (namespace `duedgusto.Common`, directory nuova): `RisultatoIva`, `ScorporaDaLordo`, `ApplicaSuImponibile`, `AliquotaDaPercentuale`; XML doc su convenzione frazione e ToEven |
| `backend/GraphQL/GestioneCassa/MutateRegistroCassaOrchestrator.cs` | Modify | 3 call site → IvaCalculator (`CalcolaTotali` r. 532-534, `UpdatePagamentiEsistenti` r. 275-279, `CreaFatturaAcquisto` r. 390-392) |
| `backend/GraphQL/Fornitori/FatturaAcquistoOrchestrator.cs` | Modify | `MutateAsync` r. 40-41 → `ApplicaSuImponibile`; `RicalcolaTotaliFatturaAsync` r. 160-166 → `ScorporaDaLordo` (derivazione inversa aliquota invariata) |
| `backend/GraphQL/GestioneCassa/GestioneCassaQueries.cs` | Modify | `dashboardKPIs` r. 44-94: filtro CLOSED/RECONCILED su MediaMese e trend; startOfWeek lunedì; trend porzione equivalente con guardia /0; commento formula |
| `backend/Services/ChiusureMensili/ChiusuraMensileService.cs` | Modify | Transazione esplicita (`await using` + try/commit/catch/rollback) in `CreaChiusuraAsync` (passi 5-7) e `ChiudiMensileAsync` |
| `backend/Models/ChiusuraMensile.cs` | Modify | Nuova `SpeseGiornaliereRegistriCalcolate`; `RicavoNettoCalcolato` la sottrae |
| `backend/GraphQL/ChiusureMensili/Types/ChiusuraMensileType.cs` | Modify | Nuovo field `speseGiornaliereRegistriCalcolate`; descrizione `ricavoNettoCalcolato` aggiornata |
| `backend/GraphQL/GestioneCassa/GestioneCassaGuards.cs` | Modify | `GuardGiornoOperativoConPeriodi(db, data, string azione = "creare")`; rimozione `GuardGiornoOperativoSoloGlobale` |
| `backend/GraphQL/GestioneCassa/ChiudiRegistroCassaOrchestrator.cs` | Modify | r. 40: guard con periodi e `azione: "chiudere"` |
| `backend/DuedGusto.Tests/Helpers/TestDbContextFactory.cs` | Modify | `ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))` — prerequisito per le transazioni nel servizio |
| `backend/DuedGusto.Tests/Unit/Services/ChiusuraMensileServiceTests.cs` | Modify | Seed `speseGiornaliere > 0` nel test r. 233 + assert su nuova proprietà; nuovi test IvaCalculator (vedi Testing Strategy) |
| `backend/DuedGusto.Tests/Integration/GraphQL/MonthlyClosuresQueriesTests.cs` | Modify | r. 265: seed con spese giornaliere e atteso aggiornato |
| `duedgusto/src/graphql/chiusureMensili/fragments.tsx` | Modify | `speseGiornaliereRegistriCalcolate` nel `ChiusuraMensileFragment` |
| `duedgusto/src/@types/MonthlyClosure.d.ts` | Modify | Campo `speseGiornaliereRegistriCalcolate: number` |
| `duedgusto/src/components/pages/registrazioneCassa/MonthlyClosureReport.tsx` | Modify | Riga "Spese Giornaliere Registri" nel Riepilogo Finale (r. ~182) perché le voci quadrino col nuovo netto |
| `duedgusto/src/components/pages/registrazioneCassa/vistaMensile/VistaMensile.tsx` | Modify | `monthlyStats.totaleVendite` e `revenue` eventi → `cr.totaleVendite` con fallback canali; rimozione `movimento` |
| `duedgusto/src/components/pages/registrazioneCassa/CashSummary.tsx` | Delete | Dead code (zero import nel codebase, verificato) |

Nuovo progetto/test infra: nessuno. Migrazioni DB: nessuna. Schema GraphQL: solo campo additivo `speseGiornaliereRegistriCalcolate` (non-breaking).

## Interfaces / Contracts

GraphQL (additivo):

```graphql
type ChiusuraMensile {
  # ... campi esistenti invariati ...
  speseGiornaliereRegistriCalcolate: Decimal  # nuovo
  ricavoNettoCalcolato: Decimal               # semantica: lordo − spese aggiuntive − spese giornaliere registri
}
```

Firma C# (vedi Decisione 3 per il corpo): `IvaCalculator.ScorporaDaLordo(decimal lordo, decimal aliquota): RisultatoIva`, `IvaCalculator.ApplicaSuImponibile(decimal imponibile, decimal aliquota): RisultatoIva`, `IvaCalculator.AliquotaDaPercentuale(decimal percentuale): decimal`. Guard: `GuardGiornoOperativoConPeriodi(AppDbContext, DateTime, string azione = "creare")`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (nuovo `DuedGusto.Tests/Unit/Common/IvaCalculatorTests.cs`) | Scorporo: quadratura `Imponibile + Iva == lordo`; equivalenza con la vecchia formula di `CalcolaTotali` su casi midpoint (lordo che genera imponibile `x.xx5`); aliquota 0; aliquota negativa → throw; importi negativi; `AliquotaDaPercentuale(22) == 0.22m`; `ApplicaSuImponibile` vs formula attuale | xUnit + FluentAssertions, `[Theory]` con casi tabellari |
| Unit | `SpeseGiornaliereRegistriCalcolate` e nuovo `RicavoNettoCalcolato` (registri con spese > 0, registri `Incluso == false` esclusi) | Aggiornare `ChiusuraMensileServiceTests` (seed `speseGiornaliere`), InMemory |
| Unit | Transazioni: i test esistenti di `CreaChiusuraAsync`/`ChiudiMensileAsync` continuano a passare con warning InMemory soppresso | `TestDbContextFactory` aggiornata; nessun test di rollback su InMemory (transazioni no-op — limitazione documentata) |
| Unit | KPI: MediaMese ignora DRAFT; TrendSettimana lunedì-based, base 0 → 0 | Se esiste copertura testabile del resolver, estrarre il calcolo in helper statico testabile; altrimenti verifica manuale in verify (resolver GraphQL.NET con service locator non è unit-testabile direttamente) |
| Integration | `MonthlyClosuresQueriesTests` r. 265 aggiornato con spese giornaliere | InMemory + service reale |
| Frontend | `npm run ts:check` + `npm run lint`; test esistenti `useQueryCashRegistersByMonth` invariati (nessun cambio query) | Vitest |
| Verify (manuale) | Confronto prima/dopo importi IVA sugli stessi input (success criterion "al centesimo"); registro in giorno operativo di periodo chiudibile; report stampa quadra | `dotnet build && dotnet test`, smoke test app |

## Migration / Rollout

Nessuna migrazione DB, nessun dato persistito modificato, nessun feature flag. `RicavoNettoCalcolato` e `speseGiornaliereRegistriCalcolate` sono runtime: il nuovo netto appare retroattivamente anche su chiusure CHIUSE esistenti (intenzionale, documentato nel proposal). Rollback = revert applicativo dei commit (vedi Rollback Plan del proposal).

## Open Questions

- [ ] Nessuna bloccante. Da confermare in review: in `MonthlyClosureDetails.tsx` la strip metriche mostra solo il Ricavo Netto aggregato — si potrebbe aggiungere la metrica "Spese giornaliere registri" per coerenza col report, ma non è richiesta dal proposal (scelta attuale: solo report, modifica minima).
