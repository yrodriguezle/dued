# Proposal: IVA digitata sulle fatture acquisto

## Intent

Oggi ogni importo IVA di una fattura acquisto è il **risultato** di un'aliquota: la UI chiede
"Aliquota IVA %" e il backend scorpora o applica. Il presupposto è che ogni fattura abbia
un'unica aliquota, e per la maggior parte dei fornitori è vero.

Non lo è per un Cash & Carry. Quel fornitore vende nello stesso documento righe al 4%, al 10%
e al 22%, e sulla fattura stampa un **solo totale IVA**. Nessuna aliquota unica esiste: qualunque
scorporo il sistema faccia inventa un numero che sul documento non c'è. L'operatore ha davanti
l'importo IVA corretto — deve poterlo scrivere, non farselo ricalcolare.

Serve quindi una seconda modalità di inserimento («togli la spunta e scrivi l'IVA») e, soprattutto,
serve che i punti che RISCRIVONO gli importi di una fattura già salvata non distruggano quel dato.

## Scope

### In Scope

**A. Operazioni a IVA nota (`IvaCalculator`)**
1. `DaImportoEsplicito(imponibile, iva)`: totale per somma — duale di `ApplicaSuImponibile`.
2. `RipartisciConIvaNota(lordo, iva)`: imponibile per differenza — duale di `ScorporaDaLordo`.
3. `AliquotaImplicitaPercentuale(imponibile, iva)`: percentuale derivata, **da mostrare, non su cui
   decidere** (su una fattura multialiquota è una media ponderata).

**B. Modalità persistita (`FatturaAcquisto.IvaCalcolata`)**
4. Colonna `bool NOT NULL DEFAULT true`. `false` = l'IVA è il dato letto dal documento.
5. Migrazione additiva. **Backfill esatto senza archeologia**: prima di questa change l'inserimento
   manuale dell'IVA non esisteva, quindi tutto lo storico è legittimamente `true`.

**C. Canale di input (GraphQL, additivo)**
6. `FatturaAcquistoInput.ImportoIva` e `PagamentoFornitoreRegistroInput.ImportoIva`, entrambi
   opzionali. Se valorizzati **prevalgono** su `AliquotaIva`, che non viene nemmeno letta.
7. `FatturaAcquistoType.ivaCalcolata` esposto in lettura.

**D. I quattro punti che riscrivono gli importi**
8. `FatturaAcquistoOrchestrator.MutateAsync` — onora `ImportoIva`, **decide** `IvaCalcolata`.
9. `DocumentiFornitoreService.CreaFatturaAcquistoAsync` — idem, sia in creazione sia in riuso.
10. `MutateRegistroCassaOrchestrator.UpdatePagamentiEsistenti` — idem.
11. `FatturaAcquistoOrchestrator.RicalcolaTotaliFatturaAsync` (prelievo/rimozione DDT) — unico punto
    senza input: **legge** `IvaCalcolata`. Se `false`, congela l'IVA e ricalcola l'imponibile
    (`totale − iva`) invece di riscorporare.

**E. Correzione di un bug preesistente**
12. `AssociaDdtAsync`/`DisassociaDdtAsync` ricalcolavano i totali **prima** di persistere
    l'associazione. `Repository.FindAsync` è `Where(...).ToListAsync()` — una query al database, non
    una lettura del change tracker — quindi i DDT appena (dis)associati restavano fuori dalla somma.
    Aggiunto `SaveChangesAsync` prima del ricalcolo, dentro la transazione già aperta.

**F. Frontend**
13. Spunta «Calcola IVA dall'aliquota» (default ON) su `FatturaAcquistoForm` e su
    `PagamentoFornitoreDialog` — il Cash & Carry si paga in giornata, quindi passa dalla cassa.
14. A spunta OFF il campo IVA diventa editabile e l'aliquota diventa un valore mostrato («media»).
15. `duedgusto/src/common/iva/aliquote.tsx`: helper di sola presentazione, speculare al calculator.

### Out of Scope

- **Breakdown per aliquota sulla fattura acquisto** (righe 4/10/22 dettagliate): questa change
  registra il totale IVA, non lo disaggrega. La disaggregazione degli acquisti resta futura.
- **`AliquotaIva` persistita sulla fattura**: valutata e scartata (vedi Decisioni).
- **IVA detraibile fiscale**: `IvaBreakdownCreditoCalculator` resta un dato gestionale di cassa.
- **Validazione dell'IVA digitata contro un range plausibile**: l'unico vincolo è `iva ≤ totale`,
  applicato in UI; il calculator resta simmetrico agli storni.

### Decisioni prese con l'utente

1. **Prima versione: deduzione, poi ribaltata.** L'implementazione iniziale deduceva la modalità
   dagli importi (aliquota implicita non di legge → digitata), senza colonna nuova. Scartata dopo
   averne visto la conseguenza: `22,00` su `100,00` è identico che sia calcolato o digitato, quindi
   un'IVA scritta a mano che cade su un'aliquota di legge veniva riscorporata al primo prelievo DDT.
   La funzione `IvaNonRiconducibileAdAliquota` e la sua gemella frontend sono state **rimosse**.
2. **Spunta su entrambe le UI**, non solo sulla pagina fattura.
3. **Prelievo DDT congela l'IVA** e muove l'imponibile, invece di bloccare l'operazione con errore.

## Approach

1. **L'IVA come dato o come risultato** è l'unica domanda che governa tutto. Il calculator guadagna
   una colonna di operazioni "IVA nota" simmetrica a quelle esistenti; nessuna formula inline nuova.
2. **La modalità si decide in tre punti e si legge in uno.** I tre punti con input sanno già cosa
   vuole l'operatore (`ImportoIva is null`); il quarto riparte da una fattura salvata e deve leggere
   un fatto persistito. Questo asimmetria è il motivo per cui la colonna esiste.
3. **Retrocompatibilità totale**: campi GraphQL additivi, colonna con default corretto per lo
   storico, comportamento invariato a spunta ON.

Moduli coinvolti: **backend + frontend**. Migrazioni DB: **1, additiva, backfill esatto**.

## Affected Areas

| Area | Impact | Descrizione |
|------|--------|-------------|
| `backend/Models/FatturaAcquisto.cs` | Modified | `IvaCalcolata` bool, default true |
| `backend/DataAccess/AppDbContext.cs` | Modified | Colonna required con default DB |
| `backend/Migrations/*AddIvaCalcolataToFatturaAcquisto` | New | `tinyint(1) NOT NULL DEFAULT 1` |
| `backend/Common/IvaCalculator.cs` | Modified | `DaImportoEsplicito`, `RipartisciConIvaNota`, `AliquotaImplicitaPercentuale` |
| `backend/Common/IvaBreakdownCreditoCalculator.cs` | Modified | `AliquotaMista` vera anche per IVA digitata |
| `backend/GraphQL/Fornitori/FatturaAcquistoOrchestrator.cs` | Modified | Decide la modalità; congela l'IVA nel ricalcolo DDT; `SaveChanges` prima del ricalcolo |
| `backend/GraphQL/Fornitori/Types/FatturaAcquistoInputType.cs` | Modified | `ImportoIva` opzionale |
| `backend/GraphQL/Fornitori/Types/FatturaAcquistoType.cs` | Modified | Campo `ivaCalcolata` |
| `backend/GraphQL/GestioneCassa/Types/RegistroCassaInputType.cs` | Modified | `ImportoIva` sulla riga pagamento |
| `backend/GraphQL/GestioneCassa/MutateRegistroCassaOrchestrator.cs` | Modified | `RipartisciImportoPagamentoAsync` estratto; decide la modalità |
| `backend/Services/Fornitori/DocumentiFornitoreService.cs` | Modified | `RipartisciImportoFatturaAsync` estratto; decide la modalità |
| `duedgusto/src/common/iva/aliquote.tsx` | New | Helper di presentazione |
| `duedgusto/src/components/pages/fattureAcquisto/*` | Modified | Spunta, campo IVA editabile, mapping input |
| `duedgusto/src/components/pages/registrazioneCassa/PagamentoFornitoreDialog.tsx` | Modified | Spunta e campo IVA |
| `duedgusto/src/components/pages/registrazioneCassa/RegistroCassaDetails.tsx` | Modified | Ripristino riga da `ivaCalcolata` |
| `duedgusto/src/graphql/*/fragments.tsx`, `@types/*` | Modified | `ivaCalcolata`, `importoIva` |

## Risks

| Rischio | Probabilità | Mitigazione |
|---------|-------------|-------------|
| Un punto futuro riscrive gli importi senza leggere `IvaCalcolata` | Media | La modalità si legge in un solo punto, documentato nel modello e nel calculator; test d'integrazione su prelievo e rimozione DDT |
| Reintroduzione della deduzione dagli importi | Media | Funzioni rimosse di proposito, non deprecate; il motivo è scritto nella XML doc di `IvaCalcolata` |
| La correzione del `SaveChanges` cambia i totali di fatture con DDT esistenti | Bassa | Prima il ricalcolo era semplicemente sbagliato (sommava l'insieme stantio); il primo prelievo/rimozione successivo corregge il totale. Nessun ricalcolo retroattivo d'ufficio |
| `AliquotaMista` ora vera anche a 22% esatto | Bassa | È il comportamento voluto: la percentuale di una fattura a IVA digitata è una media ponderata |

## Rollback Plan

- **Codice**: revert dei commit backend+frontend nello stesso PR (fragment e tipi inclusi).
- **Database**: `dotnet ef database update VetrinaTestiRecensioniLavagna` rimuove la colonna. Gli altri
  campi non sono mai stati toccati dalla migrazione: nessuna perdita per lo storico.
- **Fatture inserite a IVA digitata prima del rollback**: gli importi restano quelli digitati
  (`Imponibile`/`ImportoIva`/`TotaleConIva` sono dati normali); si perde solo la memoria del fatto
  che fossero manuali, e un successivo prelievo DDT tornerebbe a riscorporarle.

## Dependencies

- `coerenza-calcoli-fase2`: `IvaCalculator` come unica fonte delle formule IVA.
- `ciclo-ddt-fattura` (change **attiva, non archiviata**): il suo requirement "Calcolo automatico
  totale da DDT" descrive il ricalcolo incondizionato. Questa change lo rende **condizionale**
  — chi archivierà `ciclo-ddt-fattura` deve recepire la variante, non riscriverla.

## Success Criteria

- [x] Una fattura salvata con `importoIva` persiste quell'importo esatto e `IvaCalcolata = false`
- [x] Una fattura salvata senza `importoIva` è identica al comportamento pre-change e `IvaCalcolata = true`
- [x] Rimettendo la spunta su una fattura a IVA digitata, gli importi tornano a derivare dall'aliquota
- [x] Il prelievo DDT su fattura a IVA digitata lascia l'IVA invariata e muove l'imponibile
- [x] Il prelievo DDT su fattura monoaliquota riscorpora come prima (scenario spec: 244 al 22% → 200/44)
- [x] Un'IVA digitata pari a un'aliquota di legge resta congelata (il buco della deduzione è chiuso)
- [x] I DDT appena associati/disassociati entrano/escono dalla somma nello stesso ricalcolo
- [x] Lo storico esistente è tutto `IvaCalcolata = true` senza query di backfill
- [x] `dotnet build` + `dotnet test` verdi; `npm run ts:check` + `npm run lint` + `npm run test` verdi
