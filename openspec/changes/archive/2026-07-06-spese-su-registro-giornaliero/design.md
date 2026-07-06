# Design: Spese sul registro giornaliero (chiusura mensile = pura aggregazione)

**Change**: spese-su-registro-giornaliero
**Riferimento**: GitHub issue #8
**Artefatti a monte**: `proposal.md`, `exploration.md`
**Moduli**: backend (.NET 8 / GraphQL.NET / EF Core / MySQL) + frontend (React 19 / Apollo)
**Migrazioni DB**: SÌ — **solo di schema** (add 2 colonne + drop 3 tabelle). Nessuna migrazione dati.

> Nota di allineamento: la sezione "Recommendation" dell'esplorazione ipotizzava di aggiungere
> `MetodoPagamento` a `SpesaCassa`, di rivedere la formula `ContanteAtteso` e di migrare i dati di
> `SpeseMensiliLibere`. Quelle ipotesi sono **superate** dalle decisioni fisse della proposal:
> `SpesaCassa` acquisisce **solo** `Categoria`, la formula `ContanteAtteso` **non si tocca**, e non
> c'è **alcuna** migrazione dati (le tabelle sono vuote o ridondanti). Questo design segue la proposal.

---

## Technical Approach

Il modello passa da **quattro** sedi di spesa a **due**, entrambe agganciate a un registro giornaliero,
lungo un unico asse contabile **TRACCIATO / NON-TRACCIATO**:

- `SpesaCassa` (tabella `SpeseCassa`) = spesa **NON tracciata**, sempre contanti. Acquisisce **solo**
  `Categoria` (`CategoriaSpesa`). Somma in `RegistroCassa.SpeseGiornaliere`.
- `PagamentoFornitore` (tabella `PagamentiFornitori`) = spesa **TRACCIATA** (metodo in `MetodoPagamento`
  già esistente, `FatturaId?`/`DdtId?` già nullable). Acquisisce `Categoria` (nullable) per ospitare le
  spese fisse pagate in modo tracciato. Somma in `RegistroCassa.SpeseFornitori`.

La `ChiusuraMensile` **non ospita più spese proprie**: torna a **pura aggregazione** dei soli registri
inclusi via `RegistriCassaMensili`. Spariscono le entità legacy (`SpesaMensile`, `SpesaMensileLibera`,
`PagamentoMensileFornitori`), i tipi/mutation GraphQL relativi, il servizio di migrazione no-op e i KPI
`[NotMapped]` anti-doppio-conteggio della PR #7.

Per registrare una spesa fissa in un giorno **senza** registro (es. affitto in giorno di chiusura), si
introduce una **mutation dedicata** che riusa il find-or-create idempotente del registro e **bypassa il
solo guard giorno-operativo**, mantenendo attivo `GuardMeseChiuso`.

La formula `ContanteAtteso`/`Differenza` (`CalcolaTotali`, `RecalculateSpeseFornitoriAsync`) resta
**invariata**: l'asse tracciato/non-tracciato dei KPI mensili è già `Σ SpeseFornitori` / `Σ SpeseGiornaliere`
per costruzione e non dipende da `ContanteAtteso`.

---

## Architecture Decisions

### Decision 1 — `SpeseCassa.Categoria`: enum NOT NULL, default `Altro`

**Choice**: nuova colonna `Categoria` di tipo `CategoriaSpesa`, persistita come `varchar(20)` via
`HasConversion<string>()`, **NOT NULL**, **default applicativo/SQL `Altro`**. Nessun indice.

**Alternatives considered**:
- Nullable — scartata: una spesa cassa è sempre una spesa reale e ha sempre una categoria sensata; la
  grid frontend crea già le righe nuove con `categoria = "Altro"` (`SpeseDataGrid.tsx:333`).
- Indice su `Categoria` (come l'aveva `SpeseMensiliLibere`) — scartato: `SpeseCassa` è piccola e non
  viene mai filtrata per categoria; l'indice sarebbe overhead inutile.

**Rationale**: NOT NULL + default `Altro` rende additiva la migrazione anche in presenza di righe
`SpeseCassa` preesistenti (backfill automatico a `Altro`), evita la gestione del null nell'aggregazione
e allinea la semantica alla ex-`SpeseMensileLibera.Categoria` (che era NOT NULL). Le righe `SpeseCassa`
vengono comunque ricreate a ogni `mutateRegistroCassa` (`UpsertRegistroBase` fa `RemoveRange` + re-add),
quindi il default protegge solo i casi non aggiornati.

### Decision 2 — `PagamentiFornitori.Categoria`: enum **nullable**, default NULL

**Choice**: nuova colonna `Categoria` di tipo `CategoriaSpesa?`, persistita come `varchar(20)` via
`HasConversion<string>()`, **nullable**, default NULL. Le 32 righe esistenti restano NULL. Nessun indice.

**Alternatives considered**:
- NOT NULL default `Altro` — scartata: forzerebbe una categoria "spesa fissa" su pagamenti che sono
  in gran parte **fatture/DDT fornitori documentati** (merce/servizi), snaturando la semantica di
  `Categoria` (pensata per affitto/utenze/stipendi/altro).

**Rationale**: `Categoria` su `PagamentoFornitore` è significativa **solo** per le spese fisse pagate in
modo tracciato (bonifico senza documento). Per i pagamenti documentali resta legittimamente NULL. La
nullability distingue "pagamento fornitore documentale" (categoria NULL) da "spesa fissa tracciata"
(categoria valorizzata) senza aggiungere stato ridondante. Nessun backfill richiesto.

### Decision 3 — Registro "leggero": **mutation dedicata** `aggiungiSpesaSuGiorno`, non estensione di `mutateRegistroCassa`

**Choice**: nuova mutation `aggiungiSpesaSuGiorno(input)` in `GestioneCassa`, che:
1. applica `GuardMeseChiuso(data)` — **mantenuto**;
2. **NON** applica `GuardGiornoOperativoConPeriodi` (una spesa non è un'operazione di vendita);
3. blocca se esiste già un registro alla data in stato `RECONCILED` (coerente col frontend che blinda
   solo `RECONCILED`);
4. `FindOrCreateRegistroCassaAsync(data, utenteId)` — crea un registro `DRAFT` se assente (riuso diretto
   del metodo esistente in `RegistroCassaSyncService`, già privo di guard e idempotente per l'indice
   UNIQUE su `Data`);
5. **se non tracciata (contanti)** → aggiunge una `SpesaCassa { Descrizione, Importo, Categoria }` e
   ricalcola `SpeseGiornaliere` + `CalcolaTotali`;
6. **se tracciata** → aggiunge un `PagamentoFornitore { DataPagamento=data, Importo,
   MetodoPagamento, Categoria, RegistroCassaId=registro.Id, FatturaId=null, DdtId=null, Note }` e chiama
   `RecalculateSpeseFornitoriAsync(registro.Id)`;
7. restituisce il `RegistroCassa` aggiornato.

**Alternatives considered**:
- Estendere `mutateRegistroCassa` con un flag di bypass — scartata: indebolirebbe il guard
  giorno-operativo sull'**intero** percorso vendite (upsert completo con `RemoveRange` di tutte le
  spese/conteggi), aprendo la porta alla creazione di registri di vendita in giorni non operativi.
  Il bypass va confinato al solo percorso spesa.
- Agganciare la spesa al registro operativo più vicino — scartata: sporca la data di competenza.

**Rationale**: una mutation dedicata isola il bypass al solo percorso spesa, riusa infrastruttura
esistente (`FindOrCreateRegistroCassaAsync`, `RecalculateSpeseFornitoriAsync`, `CalcolaTotali`),
mantiene `GuardMeseChiuso` (non si tocca un mese chiuso) e l'indice UNIQUE su `Data` garantisce
idempotenza del find-or-create. Il registro leggero resta `DRAFT`.

### Decision 4 — KPI `ChiusuraMensile`: pura aggregazione, rimozione anti-doppio-conteggio

**Choice**:
- **Restano** (già pura aggregazione da `RegistriInclusi`): `RicavoTotaleCalcolato`,
  `TotaleContantiCalcolato`, `TotaleElettroniciCalcolato`, `TotaleFattureCalcolato`,
  `TotaleIvaCalcolato`, `TotaleImponibileCalcolato`, `TotaleLordoCalcolato`,
  `TotaleDifferenzeCassaCalcolato`, `SpeseGiornaliereRegistriCalcolate` (= **non tracciato**).
- **Nuovo** `SpeseTracciateRegistriCalcolate` = `Σ Registro.SpeseFornitori` dei registri inclusi
  (= **tracciato**), simmetrico al non tracciato.
- **Ridefinito** `RicavoNettoCalcolato` = `RicavoTotaleCalcolato − SpeseTracciateRegistriCalcolate −
  SpeseGiornaliereRegistriCalcolate` (pura aggregazione; **niente** più `SpeseAggiuntiveCalcolate`).
- **Rimossi** (dipendevano da `SpeseLibere`/`PagamentiInclusi`): `SpeseAggiuntiveCalcolate`,
  `SpeseAggiuntiveNonDuplicateCalcolate`, `TotaleSpeseCalcolato`, `DifferenzaCalcolata`.
- **Navigation rimosse**: `SpeseLibere`, `PagamentiInclusi`. **Mantenuta**: `RegistriInclusi`.
- `AvvisiCompletezza`: **mantenuto** ma **semplificato** — cade il ramo "pagamenti fornitori del mese
  non inclusi" (non esistono più pagamenti fuori-registro); resta il controllo "registri chiusi del mese
  non inclusi".

**Alternatives considered**: mantenere `TotaleSpeseCalcolato`/`DifferenzaCalcolata` con lo stesso nome
ma ricalcolati puri — scartato perché la proposal chiede esplicitamente la rimozione di quei
`[NotMapped]` PR #7. La "Totale Spese"/"Differenza" headline della vista chiusura passa
all'aggregazione client già presente (`aggregaRegistriPerMese` su `registriInclusi`) e/o ai due numeri
tracciato/non-tracciato esposti dal backend.

**Rationale**: rimosse le spese fuori-registro, ogni spesa è conteggiata **esattamente una volta** nel
suo registro. Il totale spese mensile è, per costruzione, `Σ (SpeseFornitori + SpeseGiornaliere)` dei
registri inclusi: non serve più l'anti-doppio-conteggio. `GetChiusuraConRelazioniAsync` non deve più
includere `SpeseLibere`/`PagamentiInclusi`; `RegistriInclusi.ThenInclude(Registro)` è sufficiente perché
`SpeseFornitori`/`SpeseGiornaliere` sono colonne scalari già derivate su `RegistroCassa`.

### Decision 5 — Vista chiusura mensile: spese in **sola lettura/aggregate**, editing solo sul registro

**Choice**: `MonthlyClosureDetails.tsx` **non** monta più una `SpeseDataGrid` editabile con `persistence`.
Le spese del mese si mostrano come **KPI aggregati** (Totale Spese Tracciate / Non Tracciate / Totale /
Differenza) calcolati client-side da `registriInclusi` (via `aggregaRegistriPerMese`, già presente).
L'editing per-riga delle spese avviene **solo** sul registro giornaliero (`RegistroCassaDetails`).

**Alternatives considered**: mantenere in chiusura una grid **read-only** che elenca ogni spesa dei
registri inclusi — richiederebbe di includere `Registro.SpeseCassa`/`PagamentiFornitori` nella query di
chiusura. Rimandato a follow-up: non necessario per la parità funzionale (l'utente edita le spese sul
registro del giorno).

**Rationale**: coerente con "chiusura = pura aggregazione". Elimina in blocco l'oggetto `persistence`, il
`gridExpenses` costruito da `speseLibere`/`pagamentiInclusi` e le 6 mutation, semplificando molto il
componente.

### Decision 6 — Tipo `CategoriaSpesa` (frontend) va **spostato/preservato**

**Choice**: spostare la union type `CategoriaSpesa` e `categoriaOptions` da `@types/MonthlyClosure.d.ts`
(che viene svuotato) a una sede condivisa (`@types/RegistroCassa.d.ts` o un file comune), perché ora
serve alla colonna Categoria del **registro** oltre che alla chiusura.

**Rationale**: evita un import morto quando si smantellano i tipi chiusura; `SpeseDataGrid.tsx` continua
a referenziarlo.

### Decision 7 — Componenti frontend morti: cleanup mirato

**Choice**: eliminare `MonthlyClosureForm.tsx` e `MonthlySummaryView.tsx` (codice morto confermato: zero
import). **NON** toccare `MonthlyClosureList.tsx` (vivo: registrato nel menu DB via
`SeedData/SeedMenus.cs`, caricato dinamicamente). `MonthlyClosureReport.tsx` è vivo e va **adeguato**
(oggi consuma `speseLibere`/`pagamentiInclusi`).

**Rationale**: cleanup a rischio nullo sui due file inutilizzati; `MonthlyClosureList` resta perché è la
lista raggiunta dal menu dinamico.

### Decision 8 — Registro a sole spese escluso da `TotaleDifferenzeCassaCalcolato` (Differenza fantasma)

**Choice**: nel calcolo del KPI mensile `TotaleDifferenzeCassaCalcolato` si **escludono i registri "a
sole spese"**, individuati inline dalla condizione derivata:

    è registro a sole spese ⇔ Registro.TotaleVendite == 0 && Registro.TotaleApertura == Registro.TotaleChiusura

Implementazione (`ChiusuraMensile.cs`, `[NotMapped]`):

```csharp
[NotMapped]
public decimal TotaleDifferenzeCassaCalcolato => RegistriInclusi
    .Where(r => r.Incluso)
    .Where(r => r.Registro != null
        && !(r.Registro.TotaleVendite == 0
             && r.Registro.TotaleApertura == r.Registro.TotaleChiusura))   // esclude "a sole spese"
    .Sum(r => r.Registro!.Differenza);
```

**Alternatives considered**:
- Flag persistito `SoloSpese` su `RegistroCassa` — scartato: è uno stato **derivabile** dai totali già
  presenti; una colonna aggiungerebbe uno stato ridondante da mantenere in sync a ogni mutazione.
- Azzerare `Differenza` sul registro leggero in `CalcolaTotali` — scartato: significherebbe toccare la
  formula/riconciliazione giornaliera (fuori scope) e nasconderebbe il dato a livello di registro.

**Rationale**: un registro `DRAFT` a sole spese (nessuna vendita, nessun conteggio moneta) produce, con
la formula invariata, `ContanteAtteso = −Importo` e `Differenza = +Importo`: è una "Differenza fantasma"
che non rappresenta un ammanco/eccedenza di cassa reale. Escluderla dall'aggregato mensile evita di
inquinare `TotaleDifferenzeCassaCalcolato` senza toccare la formula giornaliera. La condizione è inline,
nessun flag necessario. La `Differenza` resta visibile sul singolo registro (trasparenza), ma non
concorre al totale di chiusura. Validato dall'accounting-expert (esito: corretto).

### Decision 9 — Integrità `PagamentoFornitore.RegistroCassaId` sempre valorizzato per i nuovi pagamenti

**Choice**: ogni `PagamentoFornitore` **creato da questo change** (percorso registro e percorso
`aggiungiSpesaSuGiorno`) DEVE avere `RegistroCassaId` valorizzato. Si aggiunge una **validazione
applicativa** nell'orchestratore/servizio che crea il pagamento (guard: se `RegistroCassaId == null`
dopo il find-or-create → `ExecutionError`), poiché `FindOrCreateRegistroCassaAsync` garantisce sempre un
registro alla data.

**Stato schema attuale**: la colonna `PagamentiFornitori.RegistroCassaId` è **nullable**
(`PagamentoFornitore.cs:41`, FK `OnDelete(SetNull)` in `AppDbContext.cs:840-843`). Oggi un pagamento
"origine-chiusura" veniva creato con `RegistroCassaId == null` (via `aggiungiPagamentoFornitoreInChiusura`,
mutation **rimossa** da questo change). Rimossa quella via, l'unico modo per creare un `PagamentoFornitore`
resta il registro (`ProcessaPagamentiFornitori` imposta `RegistroCassaId = registro.Id`,
`MutateRegistroCassaOrchestrator.cs:329`) o la pagina fatture (`FindOrCreateRegistroCassaAsync` → poi
link al registro).

**Choice sul constraint DB**: **NON** rendere la colonna NOT NULL in questa change. La FK con
`OnDelete(SetNull)` implica che l'eliminazione di un registro azzeri `RegistroCassaId` sui pagamenti
collegati; portarla NOT NULL richiederebbe cambiare la `DeleteBehavior` (es. `Restrict`) e verificare
tutti i flussi di eliminazione registro → fuori scope e rischioso. Si affida l'integrità alla
**validazione applicativa** + al fatto che tutte le vie di creazione ora valorizzano `RegistroCassaId`.

**Alternatives considered**:
- Colonna NOT NULL + `DeleteBehavior.Restrict` — scartata in questa change (impatto su
  `EliminaRegistroCassaOrchestrator` e sui 32 pagamenti storici); annotata come possibile hardening
  futuro.

**Rationale**: l'aggregazione mensile conta le spese tracciate come `Σ Registro.SpeseFornitori`, che
somma i `PagamentoFornitore` **linkati a un registro**. Un pagamento con `RegistroCassaId == null`
sarebbe **sotto-contato** (invisibile all'aggregazione). Garantire il link alla creazione elimina il
sotto-conteggio senza un constraint DB invasivo. Validato dall'accounting-expert (esito: corretto).

---

## Data Flow

### Flusso attuale (da rimuovere): spesa in chiusura

    UI Chiusura ─→ aggiungiSpesaLibera / *PagamentoFornitoreInChiusura ─→ ChiusuraMensileService
                                                                              │
                                        SpeseMensiliLibere / PagamentiMensiliFornitori (join a ChiusuraMensile)

### Flusso target: spesa sul registro (giorno operativo, registro esistente)

    UI Registro ─→ mutateRegistroCassa(input.Spese[].Categoria, input.PagamentiFornitori[])
                        │  Guards: GuardMeseChiuso + GuardGiornoOperativoConPeriodi
                        ▼
                   UpsertRegistroBase → AggiungiSpese(+Categoria) → CalcolaTotali (formula invariata)
                        │
                   RegistroCassa.SpeseGiornaliere / .SpeseFornitori (totali derivati)
                        │
    Chiusura (view) ◀── aggregaRegistriPerMese(registriInclusi)  [pura aggregazione, read-only]

### Flusso nuovo: spesa fissa su un giorno SENZA registro (sequence diagram)

    Attore        UI                aggiungiSpesaSuGiorno         RegistroCassaSyncService        DB
      │  compila   │                        │                            │                        │
      │  spesa +   │                        │                            │                        │
      │  categoria │                        │                            │                        │
      ├───────────▶│  mutation(input)       │                            │                        │
      │            ├───────────────────────▶│                            │                        │
      │            │                        │ GuardMeseChiuso(data)      │                        │
      │            │                        ├───────────────────────────────────────────────────▶│
      │            │                        │◀── ok (mese non chiuso) ───────────────────────────┤
      │            │                        │  [NO GuardGiornoOperativo] │                        │
      │            │                        │ FindOrCreateRegistroCassa  │                        │
      │            │                        ├───────────────────────────▶│  SELECT by Data        │
      │            │                        │                            ├───────────────────────▶│
      │            │                        │                            │◀── null / registro ────┤
      │            │                        │  [se RECONCILED → errore]  │                        │
      │            │                        │                            │  INSERT RegistroCassa  │
      │            │                        │                            │  (DRAFT) se assente    │
      │            │                        │◀── registro (DRAFT) ───────┤                        │
      │            │                        │                            │                        │
      │            │      ┌─ non tracciata (contanti) ─────────────────┐ │                        │
      │            │      │ add SpesaCassa{+Categoria}                 │ │                        │
      │            │      │ CalcolaTotali (SpeseGiornaliere, formula   │ │                        │
      │            │      │ invariata)                                 │ │                        │
      │            │      └────────────────────────────────────────────┘ │                        │
      │            │      ┌─ tracciata ────────────────────────────────┐ │                        │
      │            │      │ add PagamentoFornitore{+Categoria,          │ │                        │
      │            │      │   Fattura/Ddt=null, RegistroCassaId}        │ │                        │
      │            │      │ RecalculateSpeseFornitoriAsync (invariato)  │ │                        │
      │            │      └────────────────────────────────────────────┘ │                        │
      │            │                        │  SAVE                       │                        │
      │            │                        ├───────────────────────────────────────────────────▶│
      │            │◀── RegistroCassa ──────┤                            │                        │
      │◀── ok ─────┤                        │                            │                        │

---

## EF Core Model Changes & Migration Strategy

### Cambi al modello

| Entità | Cambio |
|--------|--------|
| `SpesaCassa` | + `public CategoriaSpesa Categoria { get; set; } = CategoriaSpesa.Altro;` |
| `PagamentoFornitore` | + `public CategoriaSpesa? Categoria { get; set; }`; **rimuovere** `ICollection<SpesaMensile> SpeseMensili` |
| `ChiusuraMensile` | rimuovere nav `SpeseLibere`, `PagamentiInclusi`; rimuovere `[NotMapped]` `SpeseAggiuntiveCalcolate`, `SpeseAggiuntiveNonDuplicateCalcolate`, `TotaleSpeseCalcolato`, `DifferenzaCalcolata`; **aggiungere** `[NotMapped] SpeseTracciateRegistriCalcolate`; **ridefinire** `RicavoNettoCalcolato` |
| `SpesaMensile`, `SpesaMensileLibera`, `PagamentoMensileFornitori` | **eliminare** (classi + `.cs`) |

### Config `AppDbContext.OnModelCreating`

- `SpesaCassa` (blocco `:303-326`): aggiungere
  `entity.Property(x => x.Categoria).HasConversion<string>().HasMaxLength(20).IsRequired().HasDefaultValue(CategoriaSpesa.Altro);`
- `PagamentoFornitore` (blocco `:797-856`): aggiungere
  `entity.Property(x => x.Categoria).HasConversion<string>().HasMaxLength(20);` (nullable, nessun default).
- Rimuovere i DbSet `SpeseMensili` (`:43`), `SpeseMensiliLibere` (`:47`), `PagamentiMensiliFornitori` (`:48`).
- Rimuovere i blocchi config `SpesaMensile` (`:906-953`), `SpesaMensileLibera` (`:985-1031`),
  `PagamentoMensileFornitori` (`:1033-1059`).
- La navigation `WithMany(c => c.SpeseLibere)` / `WithMany(c => c.PagamentiInclusi)` sparisce con i
  blocchi. `RegistroCassaMensile` (config `:958-983`) e `RegistriInclusi` **restano invariati**.

### Migrazioni EF (solo schema) — ordine: **prima add colonne, poi drop tabelle**

1. **`AddCategoriaToSpeseCassaEPagamentiFornitori`**
   - `ADD COLUMN Categoria varchar(20) NOT NULL DEFAULT 'Altro'` su `SpeseCassa`.
   - `ADD COLUMN Categoria varchar(20) NULL` su `PagamentiFornitori`.
   - Additiva, reversibile senza perdita (`Down` = drop colonne).
2. **`DropSpeseMensiliSpeseMensiliLiberePagamentiMensiliFornitori`**
   - `DROP TABLE PagamentiMensiliFornitori` (FK → `ChiusureMensili`, `PagamentiFornitori`).
   - `DROP TABLE SpeseMensiliLibere` (FK → `ChiusureMensili`).
   - `DROP TABLE SpeseMensili` (FK → `ChiusureMensili`, e FK `SpeseMensili.PagamentoId` → `PagamentiFornitori`).
   - `Down` ricrea le tabelle vuote/di sola struttura (nessun dato di business, vedi proposal §Approccio).

**Motivazione dell'ordine**: le due colonne sono additive e sicure; il drop è distruttivo. Separando in
due migrazioni si può fare rollback della sola distruttiva senza perdere le colonne. L'auto-apply
all'avvio (`Program.cs`) esegue entrambe in ordine di timestamp.

**Nessuna migrazione dati**: `SpeseMensili`=0, `SpeseMensiliLibere`=0 righe → drop diretto;
`PagamentiMensiliFornitori`=32 righe tutte con `PagamentoFornitore.RegistroCassaId` non-null → ogni
pagamento resta raggiungibile via registro (zero orfani). `ChiusureMensili`=2 BOZZA → nessun mese
blindato. **Da riconfermare su prod** prima del deploy (dependency nella proposal).

---

## Interfaces / Contracts (delta GraphQL)

### Tipi modificati

```
type SpesaCassa {
  id: Int!
  registroCassaId: Int!
  descrizione: String!
  importo: Decimal!
  categoria: CategoriaSpesa!        # NUOVO (enum, NOT NULL)
}

input SpesaCassaInput {
  descrizione: String!
  importo: Decimal!
  categoria: CategoriaSpesa         # NUOVO (default Altro se assente)
}

type PagamentoFornitore {
  ...campi esistenti...
  categoria: CategoriaSpesa         # NUOVO (nullable)
  # speseMensili: [SpesaMensile]    # RIMOSSO
}
```

`CategoriaSpesa` è già mappabile come `EnumerationGraphType` (valori `Affitto|Utenze|Stipendi|Altro`).
Va registrato un `EnumerationGraphType<CategoriaSpesa>` se non già presente nello schema.

### Nuova mutation

```
input AggiungiSpesaSuGiornoInput {
  data: DateTime!
  descrizione: String!
  importo: Decimal!
  categoria: CategoriaSpesa!
  tracciata: Boolean!               # true → PagamentoFornitore; false → SpesaCassa
  metodoPagamento: String          # usato solo se tracciata (default "Bonifico")
  utenteId: Int!
}

extend type Mutation {
  aggiungiSpesaSuGiorno(input: AggiungiSpesaSuGiornoInput!): RegistroCassa
}
```

### Rimozioni dallo schema (mutation, tipi, query, field)

- Mutation: `aggiungiSpesaLibera`, `modificaSpesaLibera`, `eliminaSpesaLibera`,
  `aggiungiPagamentoFornitoreInChiusura`, `modificaPagamentoFornitoreInChiusura`,
  `eliminaPagamentoFornitoreInChiusura`, `includiPagamentoFornitore`,
  `migraChiusureMensiliVecchioModello`.
- Tipi: `SpesaMensileType`, `SpesaMensileInputType`, `SpesaMensileTyperaType`,
  `SpesaMensileTyperaInputType`, `PagamentoMensileFornitoriType`.
- Query connection: `speseMensili` (`ConnectionQueries.cs:237`).
- Field: `PagamentoFornitore.speseMensili`; `ChiusuraMensile.speseLibere`,
  `ChiusuraMensile.pagamentiInclusi`, `ChiusuraMensile.speseAggiuntiveCalcolate`,
  `speseAggiuntiveNonDuplicateCalcolate`, `totaleSpeseCalcolato`, `differenzaCalcolata`.
- Field aggiunto su `ChiusuraMensile`: `speseTracciateRegistriCalcolate`; `ricavoNettoCalcolato`
  ridefinito.

### Includes da rimuovere

- `ChiusuraMensileService.GetChiusuraConRelazioniAsync` (`:900`): togliere `.Include(c => c.SpeseLibere)`
  e `.Include(c => c.PagamentiInclusi).ThenInclude(p => p.Pagamento)`.
- `ConnectionQueries.cs`: togliere `.Include(p => p.SpeseMensili)` (`:203`), `.Include(c => c.SpeseLibere)`
  (`:230`), `.Include(c => c.PagamentiInclusi).ThenInclude(...)` (`:231-232`) e l'intera query
  `speseMensili` (`:237-262`).

---

## File Changes

### Backend

| File | Azione | Descrizione |
|------|--------|-------------|
| `backend/Models/SpesaCassa.cs` | Modify | + `Categoria` (NOT NULL, default `Altro`). |
| `backend/Models/PagamentoFornitore.cs` | Modify | + `Categoria` (nullable); rimuove nav `SpeseMensili`. |
| `backend/Models/ChiusuraMensile.cs` | Modify | Rimuove nav `SpeseLibere`/`PagamentiInclusi` e 4 `[NotMapped]` PR #7; + `SpeseTracciateRegistriCalcolate`; ridefinisce `RicavoNettoCalcolato`; **filtra i registri a sole spese in `TotaleDifferenzeCassaCalcolato`** (Decision 8). |
| `backend/Models/SpesaMensile.cs` | Delete | Legacy morto. |
| `backend/Models/SpesaMensileLibera.cs` | Delete | Assorbita da `SpesaCassa`. |
| `backend/Models/PagamentoMensileFornitori.cs` | Delete | Join di chiusura eliminata. |
| `backend/DataAccess/AppDbContext.cs` | Modify | + config `Categoria` su 2 entità; rimuove 3 DbSet + 3 blocchi config. |
| `backend/Migrations/*` | New | (1) `AddCategoria*` colonne; (2) `Drop*` 3 tabelle. Rigenerare `AppDbContextModelSnapshot`. |
| `backend/GraphQL/GestioneCassa/Types/SpesaCassaType.cs` | Modify | + `categoria` su `SpesaCassaType`/`SpesaCassaInput`/`SpesaCassaInputType`. |
| `backend/GraphQL/GestioneCassa/MutateRegistroCassaOrchestrator.cs` | Modify | `AggiungiSpese` mappa `Categoria`. **`CalcolaTotali` invariata.** |
| `backend/GraphQL/GestioneCassa/` (nuovo orchestrator/mutation) | New | `aggiungiSpesaSuGiorno` + input type; riuso `FindOrCreateRegistroCassaAsync`/`RecalculateSpeseFornitoriAsync`; **guard `RegistroCassaId` valorizzato** sul `PagamentoFornitore` creato (Decision 9). |
| `backend/GraphQL/GestioneCassa/Types/` (enum) | New/Modify | `EnumerationGraphType<CategoriaSpesa>` se non presente. |
| `backend/GraphQL/Fornitori/Types/PagamentoFornitoreType.cs` | Modify | + `categoria` (nullable); rimuove field `speseMensili`. |
| `backend/GraphQL/ChiusureMensili/Types/ChiusuraMensileType.cs` | Modify | Rimuove 4 field KPI PR #7 + `speseLibere`/`pagamentiInclusi`/`speseAggiuntiveCalcolate`; + `speseTracciateRegistriCalcolate`; ridefinisce `ricavoNettoCalcolato`. |
| `backend/GraphQL/ChiusureMensili/Types/SpesaMensileType.cs`, `SpesaMensileInputType.cs`, `SpesaMensileTyperaType.cs`, `SpesaMensileTyperaInputType.cs`, `PagamentoMensileFornitoriType.cs` | Delete | Tipi legacy. |
| `backend/GraphQL/ChiusureMensili/Types/ChiusuraMensileInputType.cs` | Modify | Rimuove riferimenti a tipi legacy. |
| `backend/GraphQL/ChiusureMensili/ChiusureMensiliMutations.cs` | Modify | Rimuove `aggiungi/modifica/eliminaSpesaLibera`, `*PagamentoFornitoreInChiusura`, `includiPagamentoFornitore`, `migraChiusureMensiliVecchioModello`. Restano `creaChiusuraMensile`, `aggiornaGiorniEsclusi`, `chiudiChiusuraMensile`, `eliminaChiusuraMensile`. |
| `backend/Services/ChiusureMensili/ChiusuraMensileService.cs` | Modify | Rimuove `AggiungiSpesaLibera*`/`Modifica`/`Elimina`, `*PagamentoFornitoreInChiusura*`, `IncludiPagamentoFornitore`; semplifica `GetChiusuraConRelazioniAsync` (via includes) e `ValidaCompletezzaChiusuraWarningsAsync` (ramo pagamenti). |
| `backend/Services/ChiusureMensili/MigrazioneChiusureMensiliService.cs` | Delete | Servizio no-op; rimuovere anche registrazione `Program.cs:47`. |
| `backend/GraphQL/Connection/ConnectionQueries.cs` | Modify | Rimuove query `speseMensili` e gli `Include` obsoleti (`:203,:230-232,:237-262`). |
| `backend/Program.cs` | Modify | Rimuove `AddScoped<MigrazioneChiusureMensiliService>()`; registra nuova mutation/orchestrator se serve. |

### Frontend (`duedgusto/src`)

| File | Azione | Descrizione |
|------|--------|-------------|
| `@types/RegistroCassa.d.ts` | Modify | + `categoria: CategoriaSpesa` su `SpesaCassa`; ospita/importa `CategoriaSpesa`. |
| `@types/MonthlyClosure.d.ts` | Modify | Rimuove `SpesaMensileLibera`, `PagamentoMensileFornitori`, KPI PR #7, `speseLibere`, `pagamentiInclusi`; sposta `CategoriaSpesa`/`categoriaOptions`. |
| `graphql/registroCassa/fragments.tsx` | Modify | + `categoria` in `spesaCassaFragment` (`:14-21`). |
| `graphql/registroCassa/mutations.tsx` | Modify | + `categoria` in `SpesaCassaInput` (`:16-19`). |
| `graphql/registroCassa/*` | New (opz.) | Mutation `aggiungiSpesaSuGiorno` se esposta a UI dedicata. |
| `graphql/chiusureMensili/mutations.tsx` | Modify | Rimuove mutation spese libere + pagamenti-in-chiusura + `includiPagamentoFornitore`. Restano lifecycle chiusura. |
| `graphql/chiusureMensili/fragments.tsx` | Modify | Rimuove `spesaMensileLiberaFragment`, `pagamentoMensileFornitoriFragment`, KPI PR #7 (`:73-75`), `speseLibere`/`pagamentiInclusi` (`:95-101`). |
| `graphql/chiusureMensili/queries.tsx` | Modify | Adegua ai fragment ridotti. |
| `components/pages/registrazioneCassa/SpeseDataGrid.tsx` | Modify | Nessuna rottura del flusso registro; verificare che `showCategoria` funzioni anche in modalità staged (cassa). |
| `components/pages/registrazioneCassa/RegistroCassaForm.tsx` | Modify | Passa `columns={{ showCategoria: true }}` alla `SpeseDataGrid` (`:96-104`). |
| `components/pages/registrazioneCassa/RegistroCassaDetails.tsx` | Modify | Mappa `categoria` in lettura (`:418-422`) e in `RegistroCassaInput` (`:210-213`). |
| `components/pages/registrazioneCassa/MonthlyClosureDetails.tsx` | Modify | Rimuove import/`useMutation`/`persistence`/`gridExpenses` spese-libere+pagamenti; sostituisce grid editabile con KPI aggregati da `registriInclusi`; rimuove consumo KPI PR #7 (`:426,:435`). |
| `components/pages/registrazioneCassa/MonthlyClosureReport.tsx` | Modify | Rimuove consumo `speseLibere`/`pagamentiInclusi` (`:102,110,124,132`); usa aggregazione registri. |
| `components/pages/registrazioneCassa/PagamentoFornitoreDialog.tsx` | Modify | + select `Categoria` opzionale (per spese fisse tracciate); default vuoto/null. |
| `components/pages/registrazioneCassa/MonthlyClosureForm.tsx` | Delete | Codice morto. |
| `components/pages/registrazioneCassa/MonthlySummaryView.tsx` | Delete | Codice morto. |
| `components/pages/registrazioneCassa/MonthlyClosureList.tsx` | Keep | Vivo (menu DB). |

---

## KPI ChiusuraMensile — mappa restano/spariscono/nuovi

| KPI (`[NotMapped]`) | Sorte | Formula pura |
|---------------------|-------|--------------|
| `RicavoTotaleCalcolato` | resta | `Σ Registro.TotaleVendite` |
| `TotaleContantiCalcolato` | resta | `Σ Registro.IncassoContanteTracciato` |
| `TotaleElettroniciCalcolato` | resta | `Σ Registro.IncassiElettronici` |
| `TotaleFattureCalcolato` | resta | `Σ Registro.IncassiFattura` |
| `TotaleIvaCalcolato` | resta | `Σ Registro.ImportoIva` |
| `TotaleImponibileCalcolato` | resta | `RicavoTotale − IVA` |
| `TotaleLordoCalcolato` | resta | alias `RicavoTotale` |
| `TotaleDifferenzeCassaCalcolato` | **modificato** | `Σ Registro.Differenza` **escludendo i registri a sole spese** (vedi Decision 8) |
| `SpeseGiornaliereRegistriCalcolate` (**non tracciato**) | resta | `Σ Registro.SpeseGiornaliere` |
| `SpeseTracciateRegistriCalcolate` (**tracciato**) | **nuovo** | `Σ Registro.SpeseFornitori` |
| `RicavoNettoCalcolato` | **ridefinito** | `RicavoTotale − SpeseTracciate − SpeseNonTracciate` |
| `SpeseAggiuntiveCalcolate` | **rimosso** | (dipendeva da `SpeseLibere`+`PagamentiInclusi`) |
| `SpeseAggiuntiveNonDuplicateCalcolate` | **rimosso** | (anti-doppio-conteggio PR #7) |
| `TotaleSpeseCalcolato` | **rimosso** | (PR #7) → aggregazione client/`SpeseTracciate+SpeseNonTracciate` |
| `DifferenzaCalcolata` | **rimosso** | (PR #7) → aggregazione client |
| `AvvisiCompletezza` | resta (semplificato) | solo "registri del mese non inclusi" |

---

## Testing Strategy

| Layer | Cosa testare | Come |
|-------|--------------|------|
| Unit (backend) | `AggiungiSpese` mappa `Categoria`; default `Altro` se assente. | xUnit su orchestrator. |
| Unit (backend) | `aggiungiSpesaSuGiorno`: crea registro `DRAFT` bypassando giorno-operativo; rispetta `GuardMeseChiuso`; blocca `RECONCILED`; cash→`SpesaCassa`+Categoria; tracciata→`PagamentoFornitore`+Categoria senza fattura/DDT; idempotenza find-or-create. | Nuovi test. |
| Unit (backend) | **(Decision 9)** `aggiungiSpesaSuGiorno` tracciata: il `PagamentoFornitore` creato ha SEMPRE `RegistroCassaId` valorizzato; guard `ExecutionError` se `null`. | Nuovo test. |
| Unit (backend) | **(Decision 8)** `TotaleDifferenzeCassaCalcolato` esclude i registri a sole spese (`TotaleVendite==0 && TotaleApertura==TotaleChiusura`): dato un mese con 1 registro vendite (Differenza X) + 1 registro leggero (Differenza Y), il totale = X (non X+Y). Registri con vendite e differenza reale restano inclusi. | Nuovo test su `ChiusuraMensile`/service. |
| Unit (backend) | KPI puri: `SpeseTracciateRegistriCalcolate`/`SpeseGiornaliereRegistriCalcolate`/`RicavoNettoCalcolato` quadrano su registri inclusi/esclusi. | `ChiusuraMensileServiceTests` (adeguare, rimuovere test spese-libere). |
| Unit (backend) | `GetChiusuraConRelazioniAsync` non carica più `SpeseLibere`/`PagamentiInclusi`. | Adeguare test esistenti. |
| Integration (backend) | Schema GraphQL non espone più mutation/tipi rimossi; espone `categoria`; migrazioni schema applicano su DB pulito. | `MonthlyClosuresQueriesTests`, test migrazioni. |
| Unit (frontend) | Colonna Categoria editabile sul registro (staged) senza rompere il flusso cassa. | `SpeseDataGrid.test.tsx` (adeguare mock, rimuovere persistence spese-libere). |
| Unit (frontend) | `RegistroCassaDetails` mappa `categoria` in input/lettura. | `RegistroCassaDetails.test.tsx`. |
| Unit (frontend) | `MonthlyClosureDetails` mostra KPI da `registriInclusi` senza campi PR #7. | `MonthlyClosureDetails.test.tsx` (rimuovere mock `differenzaCalcolata`/`totaleSpeseCalcolato`). |
| Gate | `dotnet build` + `dotnet test`; `npm run ts:check` + `npm run lint` + `npm run test`. | CI. |

---

## Migration / Rollout

- **Schema-only**, auto-apply all'avvio. Due migrazioni: add colonne (additiva) → drop tabelle (distruttiva).
- **Nessun data-migration step**. Riconfermare i conteggi su prod (`SpeseMensili=0`,
  `SpeseMensiliLibere=0`, `PagamentiMensiliFornitori=32` con `RegistroCassaId` non-null,
  `ChiusureMensili=2` BOZZA) prima del deploy.
- **Rollback**:
  - Codice: revert del branch/PR (nessun merge su `main` senza gate CI verde).
  - DB: `dotnet ef database update <MigrazionePrecedente>`. `AddCategoria*` → drop colonne (nessuna
    perdita di business). `Drop*` → `Down` ricrea tabelle vuote/di struttura (nessun dato di business
    perso, tabelle erano vuote o ridondanti). Nessun mese `CHIUSA`/`RICONCILIATA` da preservare.

---

## Validazione contabile — esito (`accounting-expert`)

**Esito: nessun bloccante al merge.** I 5 punti sono stati validati come CORRETTI/accettabili. Due punti
hanno generato conseguenze dirette da progettare qui (2a/2b → Decision 8 e 9); un punto è annotato come
follow-up fuori scope.

| # | Punto validato | Esito | Azione in questo design |
|---|----------------|-------|-------------------------|
| 1 | Asse tracciato (`Σ SpeseFornitori`) / non-tracciato (`Σ SpeseGiornaliere`) e `RicavoNettoCalcolato = Ricavo − Tracciate − NonTracciate`. | CORRETTO | Nessuna modifica (Decision 4). |
| 2 | Formula `ContanteAtteso` invariata: bonifico `PagamentoFornitore` riduce comunque il contante atteso giornaliero (over-subtracting pre-esistente). I KPI mensili non ne dipendono. | ACCETTABILE per la riconciliazione giornaliera; l'over-subtracting è **debito tecnico noto** | Non toccata qui → **follow-up** (vedi sotto). |
| 3 | Registro `DRAFT` a sole spese: `ContanteAtteso = −Importo`, `Differenza = +Importo` ("Differenza fantasma"), rischio di inquinare `TotaleDifferenzeCassaCalcolato`. | ACCETTABILE **a condizione** di escludere questi registri dall'aggregato mensile | **Decision 8** (in scope). |
| 4 | Nessun doppio conteggio dopo rimozione `SpeseLibere`/`PagamentiInclusi`; ogni spesa contata una volta via registro. Rischio **sotto-conteggio** se un `PagamentoFornitore` ha `RegistroCassaId == null`. | CORRETTO **a condizione** di garantire il link al registro | **Decision 9** (in scope). |
| 5 | Semantica `Categoria`: cash→`SpesaCassa`+Categoria; bonifico→`PagamentoFornitore`+Categoria; documentale→`PagamentoFornitore` Categoria NULL. | CORRETTO | Nessuna modifica (Decision 1, 2). |

### Follow-up (fuori scope — issue separata)

- **Debito tecnico noto — over-subtracting `ContanteAtteso`**: la formula giornaliera
  (`CalcolaTotali`, `RecalculateSpeseFornitoriAsync`) sottrae dal `ContanteAtteso` **tutti** i
  `PagamentoFornitore`, incluso quelli con `MetodoPagamento = Bonifico` che **non toccano il cassetto**.
  La correzione (escludere i bonifici dalla sottrazione del contante atteso) **NON** è implementata in
  questo change (out of scope: "non toccare la formula `ContanteAtteso`"). Va tracciata come **issue
  futura** di rettifica della riconciliazione giornaliera. Impatto: solo `ContanteAtteso`/`Differenza`
  del singolo registro; nessun impatto sui KPI mensili tracciato/non-tracciato.

---

## Open Questions

Tutte le open question della proposal sono **sciolte** in questo design:

- [x] **Registro leggero**: mutation dedicata `aggiungiSpesaSuGiorno` con bypass del solo
  `GuardGiornoOperativoConPeriodi`, `GuardMeseChiuso` mantenuto, blocco su registro `RECONCILED`,
  registro creato `DRAFT` (Decision 3).
- [x] **`Categoria` su `PagamentoFornitore`**: nullable, default NULL, esposta nullable in GraphQL, select
  opzionale in `PagamentoFornitoreDialog` (Decision 2, 4).
- [x] **`Categoria` su `SpesaCassa`**: NOT NULL default `Altro` (Decision 1).
- [x] **KPI chiusura**: mappa restano/spariscono/nuovi definita (Decision 4).
- [x] **Cleanup componenti frontend morti**: `MonthlyClosureForm`/`MonthlySummaryView` eliminati,
  `MonthlyClosureList` mantenuto (Decision 7).
- [x] **Differenza fantasma registro leggero**: esclusa da `TotaleDifferenzeCassaCalcolato` via
  condizione inline (Decision 8).
- [x] **Integrità `RegistroCassaId`**: validazione applicativa sui nuovi `PagamentoFornitore`
  (Decision 9).
- [x] **Validazione contabile**: completata dall'`accounting-expert` — **nessun bloccante**. Esito e
  azioni nella sezione "Validazione contabile — esito".

Nessuna open question residua. Un solo elemento tracciato come **follow-up fuori scope** (issue
separata): correzione over-subtracting `ContanteAtteso` per i pagamenti in bonifico.
