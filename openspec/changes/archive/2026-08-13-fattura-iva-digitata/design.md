# Design: IVA digitata sulle fatture acquisto

## Technical Approach

Una sola domanda governa l'intero design: **l'IVA di questo documento è un risultato o un dato?**

- **Risultato** — il documento ha un'aliquota, l'IVA discende da quella. Comportamento storico.
- **Dato** — il documento stampa un totale IVA che non deriva da alcuna aliquota unica
  (fattura multialiquota). L'IVA si prende così com'è e il terzo importo si ricava per differenza.

Il calculator guadagna quindi una colonna di operazioni simmetrica a quelle esistenti, la fattura
guadagna un campo che ricorda quale delle due risposte vale per lei, e i punti che riscrivono gli
importi si dividono fra chi la risposta ce l'ha nell'input e chi deve leggerla dal database.

---

## Architecture Decisions

### Decision: modalità PERSISTITA (`IvaCalcolata`), non dedotta dagli importi

**Alternativa scartata (implementata e poi rimossa)**: dedurre la modalità dagli importi —
se `ImportoIva / Imponibile` non è un'aliquota di legge (`{0,4,5,10,22}`), l'IVA è digitata.
Zero migrazioni, zero colonne.

**Perché è stata scartata.** La deduzione ha un falso negativo strutturale: `22,00` su `100,00`
è aritmeticamente un 22% sia che l'abbia calcolato il sistema sia che l'abbia scritto l'operatore
copiandolo dalla carta. Il database non li distingue, quindi quella fattura veniva riscorporata al
primo prelievo DDT, cancellando in silenzio il dato inserito a mano. Il caso non è teorico: una
fattura Cash & Carry può benissimo avere una media ponderata che cade su un'aliquota di legge.

**Costo reale della colonna: quasi nullo**, per un motivo preciso — prima di questa change
l'inserimento manuale dell'IVA non esisteva, quindi **tutto lo storico è legittimamente
`true`** e il backfill è `DEFAULT 1`, senza una riga di SQL interpretativo sui dati esistenti.

**Conseguenza operativa**: `IvaNonRiconducibileAdAliquota` (backend) e `ivaNonRiconducibileAdAliquota`
(frontend) sono state **rimosse**, non deprecate. Sopravvive `AliquotaImplicitaPercentuale`, ma con
la doc riscritta: è un valore da *mostrare*, mai su cui decidere.

### Decision: `AliquotaIva` NON persistita sulla fattura

Con `IvaCalcolata = true` l'aliquota è ricavabile esattamente dagli importi, quindi la colonna
sarebbe ridondante. Resta un caso di bordo — imponibile minuscolo (0,01 € al 22% → IVA 0,00 →
aliquota implicita 0%) — dove la UI mostrerebbe una percentuale sbagliata pur avendo importi giusti.

Scartata perché il caso non esiste nella pratica e due colonne che descrivono lo stesso fatto
aprono la porta a stati incoerenti fra loro (flag "calcolata" con aliquota che non torna).

### Decision: la modalità si DECIDE in tre punti, si LEGGE in uno

| Punto | Ha l'input? | Cosa fa |
|-------|-------------|---------|
| `FatturaAcquistoOrchestrator.MutateAsync` | sì | `IvaCalcolata = input.ImportoIva is null` |
| `DocumentiFornitoreService.CreaFatturaAcquistoAsync` | sì | idem (creazione **e** riuso) |
| `MutateRegistroCassaOrchestrator.UpdatePagamentiEsistenti` | sì | idem |
| `FatturaAcquistoOrchestrator.RicalcolaTotaliFatturaAsync` | **no** | legge `IvaCalcolata` |

L'asimmetria è il cuore del design. Il prelievo DDT è l'unico punto che riparte da una fattura già
salvata senza che l'operatore stia dichiarando alcunché: è l'unico che, senza il campo, dovrebbe
indovinare. Gli altri tre non hanno bisogno di leggere nulla — l'input glielo dice.

Nel ramo congelato: `TotaleConIva = Σ DDT`, `ImportoIva` invariato, `Imponibile = totale − iva`.
Coerente con il documento: l'IVA è stata copiata dalla carta, la base è ciò che resta.

### Decision: `ImportoIva` in input prevale su `AliquotaIva` (nessun terzo campo di modalità)

Gli input GraphQL non portano un flag esplicito: la presenza di `ImportoIva` **è** la dichiarazione
di modalità. Un campo booleano separato negli input permetterebbe la combinazione incoerente
(`ivaManuale: true` senza importo) senza aggiungere espressività.

### Decision: `AliquotaMista` vera anche quando l'IVA digitata cade su un'aliquota di legge

`IvaBreakdownCreditoCalculator` etichetta `AliquotaMista` per dire «questa percentuale è una media
ponderata, non un'aliquota reale». Con la modalità persistita la condizione diventa
`!IvaCalcolata || !IsAliquotaAmmessa(percent)`: su una fattura a IVA digitata la percentuale è per
costruzione una media, anche quando per caso vale 22,00. Prima non c'era modo di saperlo.

### Decision: correzione del ricalcolo DDT (bug preesistente)

`AssociaDdtAsync` impostava `FatturaId` sui DDT in memoria e chiamava subito il ricalcolo, che li
rilegge con `_unitOfWork.DocumentiTrasporto.FindAsync(d => d.FatturaId == ...)`. Quel metodo è
`_dbSet.Where(predicate).ToListAsync()`: una **query al provider**, non una lettura del change
tracker. I DDT appena collegati non erano ancora persistiti, quindi non comparivano nella somma
(e in disassociazione continuavano a comparire).

Corretto con `SaveChangesAsync` prima del ricalcolo, dentro la transazione di `ExecuteInTransactionAsync`
già aperta: nessun cambio di atomicità.

Non è stato cercato: è emerso perché il test `AssociaDdt_SuFatturaMonoaliquota_RiscorporaComePrima`
attendeva 244 e trovava 0. La decisione sul congelamento non poteva funzionare su un totale
calcolato da un insieme di DDT stantio.

### Decision: frontend — un helper di sola presentazione

`duedgusto/src/common/iva/aliquote.tsx` espone `arrotondaCentesimi`, `aliquotaImplicita` e
`defaultAliquotaIva`. Serve a mostrare imponibile/IVA/aliquota mentre si compila un form e a
riallineare il campo che diventa editabile al cambio spunta, così gli importi non saltano.

**Non decide nulla**: la modalità di una fattura salvata arriva da `ivaCalcolata` via GraphQL.

---

## Data Flow

**Inserimento a spunta OFF (pagina fattura)**

```
UI: Totale 227,50 + IVA 23,08
  → imponibile = 227,50 − 23,08 = 204,42        (client, entrambi a 2 decimali)
  → input { imponibile: 204.42, aliquotaIva: 22, importoIva: 23.08 }
  → DaImportoEsplicito(204.42, 23.08) → (204.42, 23.08, 227.50)
  → IvaCalcolata = false
```

`aliquotaIva: 22` viaggia ma non viene letta: è il valore residuo del campo, non un'istruzione.

**Prelievo DDT su quella fattura (nessun input)**

```
SaveChanges (associazione DDT persistita)
  → totale = Σ DDT = 300,00
  → IvaCalcolata == false → RipartisciConIvaNota(300.00, 23.08)
  → (276.92, 23.08, 300.00)
```

**Pagamento in cassa a spunta OFF**

```
riga pagamento { importo: 227.50, aliquotaIva: 22, importoIva: 23.08 }
  → RipartisciConIvaNota(227.50, 23.08) → (204.42, 23.08, 227.50)
  → fattura creata/riusata con IvaCalcolata = false
```

---

## Interfaces / Contracts

```csharp
// IVA nota — nessuna aliquota nel calcolo
public static RisultatoIva DaImportoEsplicito(decimal imponibile, decimal iva);
public static RisultatoIva RipartisciConIvaNota(decimal lordo, decimal iva);

// Valore da mostrare, non su cui decidere
public static decimal? AliquotaImplicitaPercentuale(decimal imponibile, decimal? iva);
```

Invariante mantenuta da entrambe le operazioni nuove: `Imponibile + Iva == Totale` al centesimo.
Importi negativi ammessi (storni), come nelle operazioni preesistenti. Nessuna guard su `iva > lordo`:
il rifiuto sta a monte (UI e mutation), il calculator resta simmetrico.

```graphql
input FatturaAcquistoInput          { ..., aliquotaIva: Decimal!, importoIva: Decimal }
input PagamentoFornitoreRegistroInput { ..., aliquotaIva: Decimal, importoIva: Decimal }
type  FatturaAcquisto               { ..., ivaCalcolata: Boolean! }
```

---

## Testing Strategy

| Livello | Copertura |
|---------|-----------|
| Unit — `IvaCalculatorTests` | Le due operazioni a IVA nota (casi esatti, IVA zero, storni, IVA > lordo); `AliquotaImplicitaPercentuale` inclusi i casi non derivabili |
| Unit — `IvaBreakdownCreditoCalculatorTests` | `AliquotaMista` vera per IVA digitata pari a un'aliquota di legge |
| Integration — `FatturaIvaDigitataTests` | Inserimento nelle due modalità; ritorno alla modalità aliquota; prelievo e rimozione DDT su fattura congelata; **IVA digitata pari al 22% congelata comunque**; prelievo su monoaliquota invariato; creazione da cassa nelle due modalità |
| Frontend — `aliquote.test.tsx` | Helper di presentazione, stessi casi del calculator per tenere allineate le due copie |
| Frontend — statico | `ts:check` e `lint` coprono il cablaggio di spunta, mapping input e fragment |

---

## Migration / Rollout

Migrazione singola e additiva (`AddIvaCalcolataToFatturaAcquisto`), auto-applicata all'avvio come da
progetto:

```sql
ALTER TABLE FattureAcquisto ADD IvaCalcolata tinyint(1) NOT NULL DEFAULT 1;
```

Nessun backfill esplicito: il default è **semanticamente esatto** per ogni riga esistente, inclusi i
607 registri dello storico importato, perché la modalità manuale non esisteva prima di questa change.

Query di controllo post-migrazione: `SELECT COUNT(*) FROM FattureAcquisto WHERE IvaCalcolata <> 1`
atteso `0` subito dopo il deploy.

`Down()` droppa la colonna; gli importi restano intatti.

---

## Open Questions

Nessuna aperta. Le tre scelte di prodotto (modalità persistita, spunta su entrambe le UI,
congelamento al prelievo DDT) sono state decise con l'utente e sono registrate nella proposal.
