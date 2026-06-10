# Design: IVA Multialiquota — Fase 3

## Technical Approach

Il dato multialiquota viene introdotto end-to-end in tre strati, tutti additivi:

1. **`Prodotto.AliquotaIva`** (percentuale, `decimal(5,2)`, default 22.00) — stessa convenzione di `Fornitore.AliquotaIva` (`backend/Migrations/20260322141031_AddAliquotaIvaToFornitore.cs`).
2. **Snapshot su `Vendita`** (`AliquotaIva`, `Imponibile`, `ImportoIva`) calcolato alla creazione/aggiornamento con `IvaCalculator.ScorporaDaLordo` — l'aliquota è congelata al momento della vendita, gli importi rispettano l'invariante `Imponibile + ImportoIva == PrezzoTotale` al centesimo.
3. **Tabella figlia `RegistriCassaIva`** rigenerata in modo idempotente (delete+reinsert, come `ConteggiMoneta`/`SpeseCassa` in `UpsertRegistroBase`) da un **calculator puro** `IvaBreakdownCalculator` in `backend/Common/`: parte esatta = somma degli scorpori di riga delle Vendite raggruppate per aliquota (`Stimato = false`); residuo dichiarato non itemizzato scorporato all'aliquota di default (`Stimato = true`). `RegistroCassa.ImportoIva` diventa `Σ Imposta` del breakdown (retrocompatibile per costruzione: per registri senza vendite la riga unica stimata usa lo stesso `ScorporaDaLordo` di oggi).

Punti di invocazione: `MutateRegistroCassaOrchestrator.CalcolaTotali` (salvataggio registro) e le tre mutation di `VenditeMutations` (crea/aggiorna/elimina), tramite un applier condiviso con accesso DB. GraphQL solo additivo; frontend: breakdown nel riepilogo del dettaglio registro. Subscription invariate (decisione orchestratore #6).

Decisioni vincolanti già prese dall'orchestratore e recepite: residuo negativo → clamp a 0 + warning log (mai bloccare); helper puro in `Common/`; niente pagina admin Prodotti (solo mutation); `aggiornaVendita` ricalcola lo snapshot solo al cambio prodotto/prezzo; backfill storico tutto `Stimato = true`; subscription invariate.

## Architecture Decisions

### Decision: Tabella figlia `RegistriCassaIva` con unique `(RegistroCassaId, Aliquota, Stimato)`

**Choice**: nuova entità `RegistroCassaIva` → tabella `RegistriCassaIva` (plurale, convenzione `RegistriCassa`/`ConteggiMoneta`):

| Colonna | Tipo | Note |
|---------|------|------|
| `Id` | int PK autoincrement | convenzione figli registro (`ConteggioMoneta.Id`) |
| `RegistroCassaId` | int FK → `RegistriCassa.Id` | `OnDelete(Cascade)` |
| `Aliquota` | `decimal(5,2)` NOT NULL | percentuale (22.00), come `Fornitore.AliquotaIva` |
| `Imponibile` | `decimal(10,2)` NOT NULL | |
| `Imposta` | `decimal(10,2)` NOT NULL | |
| `Stimato` | `tinyint(1)` NOT NULL | true = residuo non itemizzato |

Indici: `HasIndex(RegistroCassaId)` (lookup DataLoader) + `HasIndex(RegistroCassaId, Aliquota, Stimato).IsUnique()`.
Navigation: `RegistroCassa.BreakdownIva` (`ICollection<RegistroCassaIva>`, default `[]`), configurata in `AppDbContext.OnModelCreating` con `HasCharSet("utf8mb4")`/`UseCollation("utf8mb4_unicode_ci")` come le altre.

**Alternatives considered**: colonna JSON su `RegistriCassa`; chiave naturale composta `(RegistroCassaId, Aliquota, Stimato)` senza `Id` surrogato.
**Rationale**: la tabella consente `GROUP BY Aliquota` cross-registro per i futuri registri IVA mensili e tipi forti con FK cascade (già motivato in proposal). L'unique include `Stimato` perché un registro può legittimamente avere DUE righe alla stessa aliquota: quella esatta dalle vendite e quella stimata dal residuo (caso aliquota vendite == aliquota default). L'`Id` surrogato segue il pattern dei figli esistenti e semplifica EF; l'unique resta come guardia contro doppie insert in caso di rigenerazione non pulita.

### Decision: `IvaBreakdownCalculator` puro in `backend/Common/` + applier con DB accanto all'orchestrator

**Choice**: due livelli.

Livello 1 — calculator puro, testabile senza DB (`backend/Common/IvaBreakdownCalculator.cs`):

```csharp
namespace duedgusto.Common;

public readonly record struct RigaBreakdownIva(
    decimal Aliquota,    // percentuale (22.00)
    decimal Imponibile,
    decimal Imposta,
    bool Stimato);

public readonly record struct EsitoBreakdownIva(
    IReadOnlyList<RigaBreakdownIva> Righe,
    decimal TotaleItemizzato,   // Σ Vendite.PrezzoTotale
    decimal ResiduoOriginale,   // TotaleVendite − TotaleItemizzato (può essere < 0)
    bool ResiduoClampato);      // true se ResiduoOriginale < 0 (riga stimata omessa)

public static class IvaBreakdownCalculator
{
    /// <param name="vendite">Snapshot di riga (AliquotaIva %, Imponibile, ImportoIva, PrezzoTotale).</param>
    /// <param name="totaleVendite">Totale vendite dichiarato del registro (lordo).</param>
    /// <param name="aliquotaDefault">Aliquota default come FRAZIONE (BusinessSettings.VatRate), convenzione IvaCalculator.</param>
    public static EsitoBreakdownIva Calcola(
        IReadOnlyCollection<Vendita> vendite,
        decimal totaleVendite,
        decimal aliquotaDefault);
}
```

Algoritmo (nessuna formula nuova, riusa `IvaCalculator`):
1. Parte esatta: `vendite.GroupBy(v => v.AliquotaIva)` → una riga per aliquota con `Σ Imponibile`, `Σ ImportoIva`, `Stimato = false` (somma degli scorpori di riga, MAI scorporo della somma), ordinate per `Aliquota` decrescente.
2. `residuo = totaleVendite − Σ PrezzoTotale`:
   - `> 0` → riga `Stimato = true` con `IvaCalculator.ScorporaDaLordo(residuo, aliquotaDefault)` e `Aliquota = aliquotaDefault × 100`;
   - `== 0` → nessuna riga stimata;
   - `< 0` → **clamp a 0**: nessuna riga stimata, `ResiduoClampato = true` (decisione #1: mai bloccare; il log è responsabilità del chiamante, il calculator resta puro).
3. Righe a importi tutti zero non vengono emesse.

In `IvaCalculator` si aggiunge la costante centralizzata delle aliquote ammesse:

```csharp
public static readonly IReadOnlyList<decimal> AliquoteAmmessePercentuali = new[] { 0m, 4m, 5m, 10m, 22m };
public static bool IsAliquotaAmmessa(decimal percentuale)
    => AliquoteAmmessePercentuali.Contains(percentuale);
```

Livello 2 — applier statico con DB (`backend/GraphQL/GestioneCassa/BreakdownIvaApplier.cs`, pattern `FatturaAcquistoStatusHelper`):

```csharp
public static class BreakdownIvaApplier
{
    /// Ricarica le Vendite del registro, ricalcola il breakdown (calculator puro),
    /// rigenera le righe RegistriCassaIva (RemoveRange + Add) e riallinea
    /// VenditeContanti, TotaleVendite e ImportoIva. NON chiama SaveChanges.
    public static async Task<EsitoBreakdownIva> ApplicaAsync(
        AppDbContext db, RegistroCassa registro, decimal vatRateFrazione, ILogger logger);
}
```

Comportamento: carica `db.Vendite.Where(v => v.RegistroCassaId == registro.Id)` e le righe `RegistriCassaIva` esistenti; `registro.VenditeContanti = Σ PrezzoTotale`; `registro.TotaleVendite = VenditeContanti + IncassiElettronici + IncassoContanteTracciato + IncassiFattura`; calcola breakdown; delete+reinsert; `registro.ImportoIva = Σ Imposta`; se `ResiduoClampato` → `logger.LogWarning` con id registro, totale dichiarato e totale itemizzato.

**Alternatives considered**: servizio scoped registrato in DI; logica inline duplicata nelle 4 call site; calculator che accede al DB.
**Rationale**: la decisione #2 vincola il calculator puro in `Common/` (input vendite + totale + aliquota default frazione). L'applier elimina la quadruplicazione (orchestrator + 3 mutation vendite) restando nello stile del progetto (helper statici, niente nuovo servizio DI); il cross-using `Vendite → GestioneCassa` è già prassi (`VenditeMutations` usa `Subscriptions.Types`). Il calculator puro non logga: il warning di clamp è del chiamante che ha `ILogger` (decisione #1).

### Decision: integrazione in `CalcolaTotali` — `VenditeContanti` ricalcolato, breakdown rigenerato

**Choice**: in `MutateRegistroCassaOrchestrator`:
- `UpsertRegistroBase` aggiunge `.Include(r => r.BreakdownIva)` e `db.RegistriCassaIva.RemoveRange(registroCassa.BreakdownIva)` accanto ai RemoveRange di `ConteggiMoneta`/`SpeseCassa` (stessa strategia delete+reinsert).
- Dopo `ProcessaPagamentiFornitori` (il `SaveChangesAsync` a riga ~61 garantisce `registroCassa.Id` anche per registri nuovi), il blocco "Calcoli finali" diventa:
  1. `CalcolaTotali(registroCassa, totaleSpese)` — resta statico ma **perde** il calcolo IVA e l'azzeramento `VenditeContanti = 0` (riga 518) e il ricalcolo `TotaleVendite`: restano `SpeseGiornaliere`, `ContanteAtteso`, `Differenza`, `ContanteNetto` (formule invariate, non dipendono da `VenditeContanti`).
  2. `await BreakdownIvaApplier.ApplicaAsync(db, registroCassa, settings.VatRate, _logger)` — ricalcola `VenditeContanti` dalla somma delle Vendite persistite (normalizzazione C.9: per i registri reali senza vendite itemizzate la somma è 0 → comportamento bit-identico a oggi), `TotaleVendite`, breakdown e `ImportoIva`.
- Nuovo parametro costruttore `ILogger<MutateRegistroCassaOrchestrator> logger` (già registrato scoped in `Program.cs` riga 58, DI standard).

In `VenditeMutations` (crea/aggiorna/elimina): dopo aver applicato la modifica alla vendita, si sostituiscono gli aggiornamenti incrementali inline di `VenditeContanti`/`TotaleVendite` con la stessa chiamata `BreakdownIvaApplier.ApplicaAsync(...)` prima di `SaveChangesAsync` (settings via `db.BusinessSettings.FirstAsync()`, logger via `GraphQLService.GetService<ILogger<VenditeMutations>>(context)`). NB: la vendita appena creata/modificata non è ancora persistita quando l'applier ricarica da DB → l'applier somma le vendite **tracciate** (`db.Vendite.Local` union query) oppure, più semplice e robusto, le mutation fanno `SaveChangesAsync` della vendita PRIMA di invocare l'applier e un secondo `SaveChangesAsync` dopo (pattern già usato dall'orchestrator con i pagamenti fornitori, due save nella stessa request).

**Alternatives considered**: mantenere gli incrementi inline (`VenditeContanti += ...`) e aggiungere solo il breakdown; ricalcolo del breakdown in un interceptor EF.
**Rationale**: il ricalcolo da somma in un punto unico chiude il finding 1 della proposal (azzeramento a riga 518 che perdeva il totale itemizzato) e **sana un bug latente trovato in esplorazione**: `AggiornaVenditaAsync` oggi modifica `PrezzoTotale` (cambio quantità) senza MAI aggiornare `VenditeContanti`/`TotaleVendite` del registro. La somma idempotente è immune da drift incrementale. I due `SaveChangesAsync` nella stessa transazione implicita di request sono già il pattern del progetto.

### Decision: snapshot IVA su `Vendita` — ricalcolo solo su cambio prodotto o prezzo

**Choice** (decisione #4):
- `CreaVenditaAsync`: `sale.AliquotaIva = product.AliquotaIva`; `RisultatoIva r = IvaCalculator.ScorporaDaLordo(sale.PrezzoTotale, IvaCalculator.AliquotaDaPercentuale(sale.AliquotaIva))`; `Imponibile = r.Imponibile`, `ImportoIva = r.Iva`.
- `AggiornaVenditaAsync`:
  - se cambia `ProdottoId` → `sale.AliquotaIva = nuovoProdotto.AliquotaIva` (riprende l'aliquota corrente del nuovo prodotto, coerente con la ripresa del `Prezzo` corrente già esistente);
  - se NON cambia prodotto → `sale.AliquotaIva` resta lo snapshot storico (immutabilità), anche se nel frattempo l'aliquota del prodotto è cambiata;
  - in ogni caso, se `PrezzoTotale` risultante è cambiato (quantità e/o prodotto) → `Imponibile`/`ImportoIva` ricalcolati da `ScorporaDaLordo(PrezzoTotale, AliquotaDaPercentuale(sale.AliquotaIva))` per preservare l'invariante al centesimo.

**Alternatives considered**: ricalcolare sempre l'aliquota dal prodotto corrente; non ricalcolare mai gli importi.
**Rationale**: l'aliquota è un dato fiscale del momento della vendita; gli importi invece sono derivati e DEVONO restare coerenti con `PrezzoTotale` (invariante del calculator), altrimenti il breakdown esatto non quadra più con `Σ lordi`.

### Decision: tre migrazioni in sequenza A→B→C, backfill registri tutto `Stimato = true`

**Choice**: tre migrazioni EF (auto-apply all'avvio), ognuna con DDL EF-generated + `migrationBuilder.Sql()` di backfill nello stesso `Up()` (pattern `FixOrphanedPaymentsLinkToRegistroCassa`):

1. **`AddAliquotaIvaToProdotti`** — `AddColumn AliquotaIva decimal(5,2) NOT NULL DEFAULT 22.00` su `Prodotti`, poi:
   ```sql
   UPDATE Prodotti
   SET AliquotaIva = COALESCE((SELECT VatRate * 100 FROM BusinessSettings LIMIT 1), 22.00);
   ```
   (subquery su tabella diversa: ammessa in MySQL; fallback 22 se settings assente. Il default DB copre già il caso VatRate = 0.22.)
2. **`AddSnapshotIvaToVendite`** — `AddColumn` su `Vendite`: `AliquotaIva decimal(5,2) NOT NULL DEFAULT 22.00`, `Imponibile decimal(10,2) NOT NULL DEFAULT 0`, `ImportoIva decimal(10,2) NOT NULL DEFAULT 0`, poi:
   ```sql
   UPDATE Vendite v
   INNER JOIN Prodotti p ON p.ProdottoId = v.ProdottoId
   SET v.AliquotaIva = p.AliquotaIva,
       v.Imponibile  = ROUND(v.PrezzoTotale / (1 + p.AliquotaIva / 100), 2),
       v.ImportoIva  = v.PrezzoTotale - ROUND(v.PrezzoTotale / (1 + p.AliquotaIva / 100), 2);
   ```
   (stessa formula di `ScorporaDaLordo`; divergenza half-away-from-zero vs ToEven impossibile per le aliquote reali su lordi a 2 decimali — documentato nella XML doc di `IvaCalculator` e coperto da `IvaCalculatorTests`.)
3. **`AddRegistroCassaIva`** — `CreateTable RegistriCassaIva` + indici, poi backfill stimato:
   ```sql
   INSERT INTO RegistriCassaIva (RegistroCassaId, Aliquota, Imponibile, Imposta, Stimato)
   SELECT r.Id,
          COALESCE((SELECT VatRate * 100 FROM BusinessSettings LIMIT 1), 22.00),
          r.TotaleVendite - r.ImportoIva,
          r.ImportoIva,
          1
   FROM RegistriCassa r
   WHERE r.TotaleVendite <> 0 OR r.ImportoIva <> 0;
   ```

L'ordine è vincolato: il backfill B legge `Prodotti.AliquotaIva` (A); C è indipendente da B ma chiude la sequenza per coerenza logica.

**Nessun breakdown "esatto" ricostruito dalle vendite nella migrazione C** (decisione #5 confermata): tutte le righe storiche sono `Stimato = true` e replicano bit a bit l'aggregato esistente (`Imposta = ImportoIva`, `Imponibile = TotaleVendite − ImportoIva`). I registri con Vendite verranno raffinati al primo risalvataggio naturale (l'applier rigenera tutto).

**Alternatives considered**: migrazione unica; backfill C che ricostruisce la parte esatta con `GROUP BY v.AliquotaIva` dalle vendite backfillate in B.
**Rationale** (per la decisione 5): (a) zero rischio contabile — nessun valore aggregato storico cambia, `TotaleIvaCalcolato` della chiusura mensile resta identico; (b) i dati storici reali non hanno vendite itemizzate (l'azzeramento a riga 518 lo garantisce: `VenditeContanti` arrivava sempre azzerato al save), quindi la ricostruzione esatta in SQL produrrebbe righe per dati di fatto non in uso aggiungendo SQL complesso e un secondo percorso di calcolo da tenere allineato al calculator; (c) il flag `stimato = true` dichiara onestamente che il passato è una stima single-rate — che è esattamente ciò che era. La riga `Down()` di C droppa la tabella (dato derivato, rigenerabile); A e B droppano le colonne senza toccare dati preesistenti.

### Decision: `mutateProdotto` in `VenditeMutations` con validazione aliquota centralizzata

**Choice**: nuovo field nello stesso `ObjectGraphType` (nessun modulo nuovo):

```csharp
Field<ProdottoType>("mutateProdotto")
    .Argument<NonNullGraphType<ProdottoInputType>>("prodotto", "Dati prodotto")
    .ResolveAsync(async context => await MutateProdottoAsync(context));
```

Input (`backend/GraphQL/Vendite/Types/ProdottoInputType.cs`, pattern `CreaVenditaInputType` con POCO + `InputObjectGraphType<T>`):

```csharp
public class ProdottoInput
{
    public int? ProdottoId { get; set; }   // null/0 = create, valorizzato = update
    public string Codice { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string? Descrizione { get; set; }
    public decimal Prezzo { get; set; }
    public string? Categoria { get; set; }
    public string? UnitaDiMisura { get; set; }
    public bool Attivo { get; set; } = true;
    public decimal AliquotaIva { get; set; } = 22m;
}
```

Resolver: upsert per `ProdottoId` (FirstOrDefault → not found = `InvalidOperationException("Prodotto non trovato")`, convenzione del modulo); validazioni esplicite prima del save:
- `IvaCalculator.IsAliquotaAmmessa(input.AliquotaIva)` altrimenti `ExecutionError($"Aliquota IVA non ammessa: {input.AliquotaIva}. Valori ammessi: 0, 4, 5, 10, 22.")`;
- `Codice` non vuoto e univoco (check esplicito su `db.Prodotti` escludendo il prodotto stesso, per dare un errore GraphQL leggibile invece della violazione dell'indice unique);
- `Prezzo >= 0`.

`SeedProducts.ReadProductsFromCsv` aggiunge `AliquotaIva = 22m` esplicita ai prodotti seed (il CSV non ha colonna aliquota; default esplicito, estendibile in futuro).

**Alternatives considered**: modulo `GraphQL/Prodotti/` dedicato; due mutation separate crea/aggiorna.
**Rationale**: i prodotti vivono già nel modulo Vendite (query in `VenditeQueries`); una singola mutation upsert segue il pattern `mutateCashRegister`/`mutateRole` del progetto. Pagina admin frontend fuori scope (decisione #3).

### Decision: GraphQL additivo + DataLoader per `breakdownIva`

**Choice**:
- `RegistroCassaIvaType` (`backend/GraphQL/GestioneCassa/Types/RegistroCassaIvaType.cs`): `aliquota`, `imponibile`, `imposta`, `stimato` (+ `id`, `registroCassaId` per coerenza con `SpesaCassaType`).
- `RegistroCassaType`: `Field<ListGraphType<RegistroCassaIvaType>>("breakdownIva").Resolve(context => context.GetBreakdownIvaByRegistroId(context.Source.Id));`
- `GestioneCassaDataLoaders`: nuovo `GetBreakdownIvaByRegistroId` — collection batch loader identico a `GetSpeseByRegistroId` (scope dedicato, `ToLookup(r => r.RegistroCassaId)`), ordinamento `OrderByDescending(Aliquota).ThenBy(Stimato)`.
- `ProdottoType`: `Field("aliquotaIva", x => x.AliquotaIva);`
- `VenditaType`: `Field("aliquotaIva", ...)`, `Field("imponibile", ...)`, `Field("importoIva", ...)`.
- Eventi subscription (`RegistroCassaUpdatedEvent`, `VenditaCreatedEvent`) **invariati** (decisione #6): il refetch client su evento ricarica il fragment, breakdown incluso.

**Alternatives considered**: campo risolto inline con query per-registro; estendere gli eventi con i dati IVA.
**Rationale**: il DataLoader è il pattern obbligato per i subfield del registro (evita N+1 su `cashRegistersConnection`); nessun campo esistente rinominato/rimosso → query e fragment correnti eseguono invariati.

### Decision: frontend — breakdown nel riepilogo `SummaryDataGrid`, layout intatto

**Choice**: `importoIva` oggi è nel fragment ma NON è renderizzato nel dettaglio registro (verificato: compare solo in viste mensili/annuali). Il breakdown si aggiunge in coda a `SummaryDataGrid.tsx` (che riceve già `registroCassa` dal server come fonte di verità), sotto la riga di KPICard:

- nuovo blocco condizionale `registroCassa?.breakdownIva?.length > 0`: un `Paper variant="outlined"` con caption "IVA (totale € {importoIva})" e una riga compatta per ogni voce: `{aliquota}% — Imponibile € {imponibile} · IVA € {imposta}` + `<Chip size="small" color="warning" label="stimato" />` per le righe `stimato` (limite contabile dichiarato in UI, come da proposal);
- valori formattati con `formatCurrency` esistente (`src/common/bones/`), nessun nuovo componente di layout: il blocco entra nel flex-wrap esistente senza stravolgere la pagina;
- per registro non ancora salvato (nessun `registroCassa`) il blocco non compare — comportamento coerente col fallback locale già presente per `totaleVendite`.

Tipi e fragment:
- `src/@types/RegistroCassa.d.ts`: nuovo tipo `RegistroCassaIvaRiga = { __typename: "RegistroCassaIva"; aliquota: number; imponibile: number; imposta: number; stimato: boolean }` e campo `breakdownIva: RegistroCassaIvaRiga[]` su `RegistroCassa`;
- `src/graphql/cashRegister/fragments.tsx`: `breakdownIva { aliquota imponibile imposta stimato }` dentro `RegistroCassaFragment` (un solo punto: tutte le query del dominio lo riusano).

**Alternatives considered**: tabella MUI dedicata in `RegistroCassaDetails.tsx`; nuova card KPI per aliquota.
**Rationale**: `SummaryDataGrid` è il riepilogo dei totali server-driven ed è già alimentato da `registroCassa`; righe testuali compatte + badge sono l'intervento minimo che espone il dato e il flag `stimato` senza toccare le griglie AG Grid né il flusso Formik.

## Data Flow

```
mutateCashRegister                          creaVendita / aggiornaVendita / eliminaVendita
       │                                                      │
       ▼                                                      ▼
MutateRegistroCassaOrchestrator                    VenditeMutations
  UpsertRegistroBase                                 snapshot IVA su Vendita
  (RemoveRange BreakdownIva,                         (AliquotaIva ← Prodotto,
   ConteggiMoneta, SpeseCassa)                        Imponibile/ImportoIva ← IvaCalculator)
       │                                                      │ SaveChanges (vendita)
       ▼                                                      ▼
  CalcolaTotali (spese, contante,            ┌──────────────────────────────┐
   differenza — senza IVA/VenditeContanti)   │   BreakdownIvaApplier        │
       │                                     │  carica Vendite del registro │
       └────────────────────────────────────►│  VenditeContanti = Σ lordi   │
                                             │  TotaleVendite ricalcolato   │
                                             │  IvaBreakdownCalculator      │◄── BusinessSettings.VatRate
                                             │   (puro: righe esatte +      │    (frazione)
                                             │    residuo stimato/clamp 0)  │
                                             │  delete+reinsert righe       │
                                             │  ImportoIva = Σ Imposta      │
                                             │  warn log se residuo < 0     │
                                             └──────────────┬───────────────┘
                                                            ▼
                                                  SaveChangesAsync
                                                            │
                              GraphQL: RegistroCassaType.breakdownIva (DataLoader)
                                                            │
                                  frontend fragment → SummaryDataGrid (righe + badge "stimato")
```

Sequenza salvataggio registro (flusso complesso, regola design config):

```
Client          Orchestrator              DB                    Applier/Calculator
  │ mutate         │                       │                          │
  ├───────────────►│ Guards (mese chiuso)  │                          │
  │                ├─ Upsert + RemoveRange children ─►│               │
  │                ├─ Conteggi/Spese/Pagamenti ──────►│ Save #1 (Id)  │
  │                ├─ CalcolaTotali (no IVA)          │               │
  │                ├─ ApplicaAsync ───────────────────┼─────────────► │ carica Vendite
  │                │                                  │ ◄──────────── │ righe breakdown
  │                ├─ Save #2 + Commit ──────────────►│               │
  │ ◄── publish RegistroCassaUpdatedEvent (invariato) │               │
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/Models/Prodotto.cs` | Modify | `AliquotaIva` decimal, default `22m`, commento convenzione percentuale |
| `backend/Models/Vendita.cs` | Modify | Snapshot `AliquotaIva`, `Imponibile`, `ImportoIva` |
| `backend/Models/RegistroCassaIva.cs` | Create | Entità breakdown (Id, RegistroCassaId, Aliquota, Imponibile, Imposta, Stimato, nav RegistroCassa) |
| `backend/Models/RegistroCassa.cs` | Modify | Navigation `ICollection<RegistroCassaIva> BreakdownIva = []` |
| `backend/DataAccess/AppDbContext.cs` | Modify | DbSet `RegistriCassaIva`; config entità + indici; colonne nuove Prodotto (`decimal(5,2)` default 22) e Vendita (`decimal(5,2)`/`decimal(10,2)`); `HasMany(BreakdownIva)` cascade su RegistroCassa |
| `backend/Common/IvaCalculator.cs` | Modify | `AliquoteAmmessePercentuali` + `IsAliquotaAmmessa` |
| `backend/Common/IvaBreakdownCalculator.cs` | Create | Calculator puro: `Calcola(vendite, totaleVendite, aliquotaDefaultFrazione)` → `EsitoBreakdownIva` |
| `backend/GraphQL/GestioneCassa/BreakdownIvaApplier.cs` | Create | Applier statico con DB: rigenerazione idempotente righe + totali, warn su clamp |
| `backend/GraphQL/GestioneCassa/MutateRegistroCassaOrchestrator.cs` | Modify | `ILogger` nel costruttore; RemoveRange BreakdownIva in `UpsertRegistroBase`; `CalcolaTotali` senza azzeramento `VenditeContanti` e senza calcolo IVA; chiamata applier nei "Calcoli finali" |
| `backend/GraphQL/Vendite/VenditeMutations.cs` | Modify | Snapshot IVA in crea/aggiorna; applier in crea/aggiorna/elimina (al posto degli incrementi inline); nuova `mutateProdotto` |
| `backend/GraphQL/Vendite/Types/ProdottoInputType.cs` | Create | `ProdottoInput` + `ProdottoInputType` con `aliquotaIva` |
| `backend/GraphQL/Vendite/Types/ProdottoType.cs` | Modify | Campo `aliquotaIva` |
| `backend/GraphQL/Vendite/Types/VenditaType.cs` | Modify | Campi `aliquotaIva`, `imponibile`, `importoIva` |
| `backend/GraphQL/GestioneCassa/Types/RegistroCassaIvaType.cs` | Create | Output type breakdown |
| `backend/GraphQL/GestioneCassa/Types/RegistroCassaType.cs` | Modify | Campo `breakdownIva` via DataLoader |
| `backend/GraphQL/DataLoaders/GestioneCassaDataLoaders.cs` | Modify | `GetBreakdownIvaByRegistroId` (collection batch loader, pattern `GetSpeseByRegistroId`) |
| `backend/SeedData/SeedProducts.cs` | Modify | `AliquotaIva = 22m` sui prodotti seed |
| `backend/Migrations/<ts>_AddAliquotaIvaToProdotti.cs` | Create | DDL + backfill `VatRate×100` |
| `backend/Migrations/<ts>_AddSnapshotIvaToVendite.cs` | Create | DDL + backfill scorporo da aliquota prodotto |
| `backend/Migrations/<ts>_AddRegistroCassaIva.cs` | Create | CreateTable + indici + backfill stimato (skip righe tutte-zero) |
| `backend/DuedGusto.Tests/Unit/Common/IvaBreakdownCalculatorTests.cs` | Create | Unit test calculator puro (vedi Testing Strategy) |
| `backend/DuedGusto.Tests/Integration/GraphQL/SalesTests.cs` | Modify | Snapshot su crea/aggiorna vendita; `mutateProdotto` (validazione aliquota) |
| `backend/DuedGusto.Tests/Integration/GraphQL/CashManagementMutationsTests.cs` | Modify | Scenari breakdown registro (senza vendite ≡ valore legacy; con vendite multialiquota) |
| `duedgusto/src/@types/RegistroCassa.d.ts` | Modify | Tipo `RegistroCassaIvaRiga` + `breakdownIva` su `RegistroCassa` |
| `duedgusto/src/graphql/cashRegister/fragments.tsx` | Modify | `breakdownIva { aliquota imponibile imposta stimato }` |
| `duedgusto/src/components/pages/registrazioneCassa/SummaryDataGrid.tsx` | Modify | Blocco breakdown IVA sotto i KPI, badge "stimato" |
| `duedgusto/src/graphql/cashRegister/__tests__/useQueryCashRegister.test.tsx` | Modify | Mock con `breakdownIva` |
| `duedgusto/src/graphql/cashRegister/__tests__/useSubmitCashRegister.test.tsx` | Modify | Mock con `breakdownIva` |
| `duedgusto/src/graphql/cashRegister/__tests__/useCloseCashRegister.test.tsx` | Modify | Mock con `breakdownIva` |
| `duedgusto/src/graphql/cashRegister/__tests__/useQueryYearlySummary.test.tsx` | Modify | Mock con `breakdownIva` (fragment condiviso) |
| `duedgusto/src/graphql/cashRegister/__tests__/useQueryCashRegistersByMonth.test.tsx` | Modify | Mock con `breakdownIva` (fragment condiviso) |
| `duedgusto/src/components/pages/registrazioneCassa/__tests__/SummaryDataGrid.test.tsx` | Modify | Casi: breakdown renderizzato, badge "stimato", assenza per registro nuovo |

## Interfaces / Contracts

Schema GraphQL (delta, solo additivo):

```graphql
type RegistroCassaIva {
  id: Int!
  registroCassaId: Int!
  aliquota: Decimal!     # percentuale, es. 22.00
  imponibile: Decimal!
  imposta: Decimal!
  stimato: Boolean!
}

extend type RegistroCassa { breakdownIva: [RegistroCassaIva] }
extend type Prodotto      { aliquotaIva: Decimal! }
extend type Vendita       { aliquotaIva: Decimal!, imponibile: Decimal!, importoIva: Decimal! }

input ProdottoInput {
  prodottoId: Int
  codice: String!
  nome: String!
  descrizione: String
  prezzo: Decimal!
  categoria: String
  unitaDiMisura: String
  attivo: Boolean
  aliquotaIva: Decimal!   # ammesse: 0, 4, 5, 10, 22
}

extend type VenditeMutation { mutateProdotto(prodotto: ProdottoInput!): Prodotto }
```

Invarianti contrattuali (da asserire nei test):
- per ogni Vendita: `Imponibile + ImportoIva == PrezzoTotale` (centesimo);
- per ogni registro: `ImportoIva == Σ breakdown.Imposta` e, senza clamp, `Σ (Imponibile + Imposta) == TotaleVendite`;
- righe esatte: `Stimato = false` ⇔ derivano da Vendite; al più UNA riga `Stimato = true`;
- residuo negativo → nessuna riga stimata, `ImportoIva == Σ imposte esatte`, warning loggato, salvataggio MAI bloccato.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (backend) | `IvaBreakdownCalculator`: nessuna vendita → singola riga stimata identica allo scorporo legacy; multialiquota → una riga esatta per aliquota + residuo; residuo 0 → nessuna riga stimata; residuo negativo → clamp + `ResiduoClampato`; vendite con aliquota == default + residuo → due righe distinte (Stimato diverso); somma scorpori ≠ scorporo somma (caso centesimi) | xUnit + FluentAssertions, pattern `IvaCalculatorTests` (Theory/InlineData) |
| Unit (backend) | `IvaCalculator.IsAliquotaAmmessa` per {0,4,5,10,22} e valori fuori set | Theory in `IvaCalculatorTests` |
| Integration (backend) | `mutateCashRegister` senza vendite: `ImportoIva` identico al centesimo al valore pre-change (riga unica stimata); con vendite a più aliquote: breakdown atteso, `VenditeContanti = Σ lordi`, `TotaleVendite` coerente; risalvataggio → rigenerazione idempotente (count righe invariato) | `CashManagementMutationsTests` (TestDbContextFactory esistente); il test puro a riga ~470 (`TotalsComputation_VatExtraction...`) resta valido e invariato |
| Integration (backend) | `creaVendita`/`aggiornaVendita`: snapshot persistito, aliquota immutata su update senza cambio prodotto, ripresa su cambio prodotto; `eliminaVendita` → breakdown ricalcolato; `mutateProdotto`: create/update ok, aliquota 7 → `ExecutionError`, codice duplicato → errore leggibile | `SalesTests` |
| Unit (frontend) | `SummaryDataGrid`: breakdown renderizzato con righe e badge "stimato"; assente senza `registroCassa`/breakdown vuoto | Vitest + Testing Library, estensione `SummaryDataGrid.test.tsx` |
| Unit (frontend) | Hook GraphQL: mock aggiornati con `breakdownIva` (il fragment condiviso obbliga tutti i mock del dominio) | aggiornamento mock nei 5 test file elencati |
| Validazione | `dotnet build` + `dotnet test`; `npm run ts:check` + `npm run lint` + `npm run test` | regole verify di `openspec/config.yaml` |

Nota impatto test esistenti: nessun test backend asserisce oggi `ImportoIva` come output dell'orchestrator (solo il test di formula pura, che non cambia); i test frontend rompono SOLO per i mock incompleti rispetto al fragment esteso — fix meccanico.

## Migration / Rollout

- **Ordine**: `AddAliquotaIvaToProdotti` → `AddSnapshotIvaToVendite` → `AddRegistroCassaIva`, auto-apply all'avvio (`Program.cs` → `MigrateAsync`), ognuna transazionale per step.
- **Backfill**: vedi SQL nelle decisioni; tutte le UPDATE/INSERT sono idempotenti rispetto a una nuova esecuzione su DB già migrato (le migrazioni EF girano comunque una volta sola).
- **Verifica pre-deploy**: eseguire le 3 migrazioni su copia del DB di produzione e confrontare `SUM(ImportoIva)` e `SUM(TotaleVendite)` prima/dopo (devono essere identici bit a bit) + `SELECT COUNT(*) FROM Vendite WHERE Imponibile + ImportoIva <> PrezzoTotale` = 0.
- **Rollback**: `dotnet ef database update RenameTimestampFields` (ultima migrazione pre-change) — `Down()` di C droppa `RegistriCassaIva` (dato derivato rigenerabile), B e A droppano le colonne; nessun dato preesistente toccato. Revert codice backend+frontend nello stesso PR (fragment e campi GraphQL devono sparire insieme).
- **Nessun feature flag**: il comportamento per i registri reali (senza vendite itemizzate) è bit-identico a oggi per costruzione.

## Open Questions

- [ ] Nessuna bloccante. (Non-bloccante, per la fase tasks: valutare se il blocco breakdown in `SummaryDataGrid` debba mostrare anche il totale imponibile complessivo — scelta puramente cosmetica, default: solo righe + totale IVA.)
