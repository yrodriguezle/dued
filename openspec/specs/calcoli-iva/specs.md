# Calcoli IVA Specification

**Domain**: calcoli-iva
**Status**: Active
**Ultimo aggiornamento**: 2026-08-13

Change incorporate in questa spec:

| Change | Archiviata il | Contenuto |
|--------|---------------|-----------|
| coerenza-calcoli-fase2 | 2026-06-10 | Spec iniziale del dominio: `IvaCalculator` centralizzato e sostituzione formule inline |
| fattura-iva-digitata | 2026-08-13 | Operazioni a IVA nota, modalità persistita `FatturaAcquisto.IvaCalcolata`, importo IVA esplicito negli input; ricalcolo da DDT reso condizionale ed etichettatura aliquota mista |

> Nota sullo schema GraphQL: `coerenza-calcoli-fase2` non aveva toccato lo schema.
> `fattura-iva-digitata` aggiunge solo campi additivi: `importoIva` in
> `FatturaAcquistoInput` e `PagamentoFornitoreRegistroInput`, `ivaCalcolata` in
> `FatturaAcquisto`. I campi preesistenti (`importoIva`, `imponibile`, `totaleConIva`,
> `totaleVendite`) restano invariati per nome e semantica.
>
> Convenzioni di aliquota nel codebase:
> - `BusinessSettings.VatRate` è una **frazione** (es. `0.22`);
> - `AliquotaIva` di fatture/fornitori/prodotti è una **percentuale** (es. `22`).
> La normalizzazione tra le due convenzioni avviene in un punto solo (vedi requirement
> del calculator e, per l'estensione multialiquota, la spec `gestione-cassa` sez. 9).
>
> Non tutte le fatture hanno un'aliquota. Una fattura multialiquota (Cash & Carry: righe a
> 4/10/22% e un solo totale IVA stampato) porta l'IVA come **dato** letto dal documento: le
> operazioni "a IVA nota" la accettano tale e quale e la modalità è persistita in
> `FatturaAcquisto.IvaCalcolata`, mai dedotta dagli importi.

## Requirements

### Requirement: Calculator IVA centralizzato come unica fonte delle formule IVA

Il sistema MUST esporre un componente unico e privo di dipendenze (`IvaCalculator`) che
implementa le due sole operazioni IVA dell'applicazione:

1. **Scorporo da totale lordo** (prezzi IVA inclusa): `Imponibile = Round(lordo / (1 + aliquota), 2)`
   e `Iva = lordo − Imponibile`. L'IVA MUST essere calcolata come differenza, così che
   `Imponibile + Iva = lordo` valga sempre al centesimo.
2. **Applicazione su imponibile**: `Iva = Round(imponibile × aliquota, 2)` e
   `Totale = imponibile + Iva`.

Il calculator MUST definire una **convenzione di input unica e documentata per l'aliquota**
(frazione oppure percentuale, una sola delle due); la normalizzazione dall'altra convenzione
MUST avvenire in un punto solo. L'arrotondamento MUST essere `Math.Round(..., 2)` con un
`MidpointRounding` esplicito e documentato, identico per tutte le operazioni.
L'aliquota MUST essere un parametro dell'operazione (non una costante interna), per
consentire l'estensione multialiquota (Fase 3). Il calculator MUST accettare aliquota `0`
(IVA nulla) senza errori.

#### Scenario: Scorporo da lordo con risultato esatto

- GIVEN un totale lordo di 122,00 € e aliquota 22%
- WHEN viene eseguito lo scorporo da lordo
- THEN l'imponibile vale 100,00 € e l'IVA vale 22,00 €
- AND imponibile + IVA = 122,00 € esattamente

#### Scenario: Scorporo da lordo con arrotondamento — l'IVA è la differenza

- GIVEN un totale lordo di 100,00 € e aliquota 22%
- WHEN viene eseguito lo scorporo da lordo
- THEN l'imponibile vale 81,97 € (arrotondato a 2 decimali)
- AND l'IVA vale 18,03 € (100,00 − 81,97, non un arrotondamento indipendente)
- AND imponibile + IVA = 100,00 € al centesimo

#### Scenario: Applicazione IVA su imponibile

- GIVEN un imponibile di 100,00 € e aliquota 22%
- WHEN viene applicata l'IVA sull'imponibile
- THEN l'IVA vale 22,00 € e il totale vale 122,00 €

#### Scenario: Convenzioni di aliquota normalizzate verso lo stesso risultato

- GIVEN lo stesso importo lordo elaborato una volta a partire da `BusinessSettings.VatRate = 0.22`
  (frazione) e una volta a partire da `AliquotaIva = 22` (percentuale)
- WHEN entrambi i call site convertono la propria convenzione verso quella del calculator
  ed eseguono lo scorporo
- THEN imponibile e IVA risultanti sono identici al centesimo nei due casi

#### Scenario: Aliquota zero

- GIVEN un totale lordo di 50,00 € e aliquota 0
- WHEN viene eseguito lo scorporo da lordo
- THEN l'imponibile vale 50,00 € e l'IVA vale 0,00 €
- AND nessun errore viene sollevato

### Requirement: Sostituzione delle formule IVA inline con il calculator

Tutti e cinque i call site con formule IVA inline MUST usare il calculator, e il codebase
backend MUST NOT contenere altre formule IVA inline residue in
`MutateRegistroCassaOrchestrator` e `FatturaAcquistoOrchestrator`:

1. `MutateRegistroCassaOrchestrator.CalcolaTotali` — scorporo di `ImportoIva` da
   `TotaleVendite` con `VatRate` frazionario;
2. `MutateRegistroCassaOrchestrator.UpdatePagamentiEsistenti` — scorporo sulla fattura
   collegata a un pagamento aggiornato (aliquota percentuale, default 22 / aliquota fornitore);
3. `MutateRegistroCassaOrchestrator.CreaFatturaAcquisto` — scorporo nel riuso/creazione
   fatture da riga spesa;
4. `FatturaAcquistoOrchestrator.MutateAsync` — applicazione IVA su imponibile inserito;
5. `FatturaAcquistoOrchestrator.RicalcolaTotaliFatturaAsync` — scorporo dal totale DDT
   (con aliquota ricavata inversamente dalla fattura, invariata), **salvo il ramo a IVA nota
   introdotto da `fattura-iva-digitata`: vedi il requirement "Ricalcolo dei totali da DDT
   condizionato alla modalità IVA"**.

> Nota di collocazione (`fattura-iva-digitata`): i call site 2 e 3 sono nel frattempo migrati in
> `DocumentiFornitoreService` (creazione/riuso documento) e in `MutateRegistroCassaOrchestrator.RipartisciImportoPagamentoAsync`
> (aggiornamento pagamento). La regola non cambia — nessuna formula IVA inline — cambia il file.

A parità di input, gli importi prodotti dopo il refactoring MUST coincidere al centesimo
con quelli prodotti dalle formule inline precedenti (nessun cambiamento funzionale: è un
consolidamento). La logica di determinazione dell'aliquota dei call site (input →
fornitore → default 22%) MUST restare invariata.

#### Scenario: Totali registro cassa invariati dopo il refactoring

- GIVEN un registro cassa con `TotaleVendite = 1.220,00 €` e `BusinessSettings.VatRate = 0.22`
- WHEN il registro viene salvato e `CalcolaTotali` calcola l'IVA tramite il calculator
- THEN `ImportoIva` vale 220,00 €, identico al valore della formula inline precedente
  `Round(1220 × (0.22 / 1.22), 2)`

#### Scenario: Fattura da pagamento con scorporo invariato

- GIVEN una riga spesa fattura da 250,00 € (IVA inclusa) di un fornitore con `AliquotaIva = 10`
- WHEN il salvataggio del registro crea o aggiorna la fattura collegata tramite il calculator
- THEN `Imponibile` vale 227,27 €, `ImportoIva` vale 22,73 € e `TotaleConIva` vale 250,00 €
- AND i valori coincidono con quelli della formula inline precedente
  (`Round(250 / (1 + 10/100), 2)` e differenza)

#### Scenario: Fattura acquisto inserita da imponibile

- GIVEN una fattura acquisto inserita con `Imponibile = 300,00 €` e `AliquotaIva = 22`
- WHEN la mutation di salvataggio fattura calcola i totali tramite il calculator
- THEN `ImportoIva` vale 66,00 € e `TotaleConIva` vale 366,00 €

#### Scenario: Ricalcolo totali fattura da DDT collegati

- GIVEN una fattura con `IvaCalcolata = true`, DDT collegati per un totale lordo di 244,00 €
  e aliquota effettiva 22% (ricavata inversamente da `ImportoIva/Imponibile` come oggi)
- WHEN i totali fattura vengono ricalcolati tramite il calculator
- THEN `TotaleConIva` vale 244,00 €, `Imponibile` vale 200,00 € e `ImportoIva` vale 44,00 €
- AND `Imponibile + ImportoIva = TotaleConIva` al centesimo

---

### Requirement: Operazioni IVA con l'IVA come dato invece che come incognita

Non tutte le fatture hanno un'aliquota: un Cash & Carry vende righe a 4/10/22% e stampa un solo
totale IVA. Il calculator MUST quindi esporre due operazioni in cui l'aliquota non entra nel
calcolo, duali di quelle esistenti:

1. **Da importi netti**: `DaImportoEsplicito(imponibile, iva)` → `Totale = imponibile + iva`, con
   entrambi gli addendi arrotondati al centesimo.
2. **Da importo lordo**: `RipartisciConIvaNota(lordo, iva)` → `Imponibile = lordo − iva`, totale
   invariato.

Entrambe MUST mantenere `Imponibile + Iva == Totale` al centesimo e MUST usare lo stesso
`MidpointRounding` delle altre operazioni. Nessuna delle due MUST sollevare errore per `iva > lordo`
o per importi negativi: il rifiuto degli importi implausibili appartiene ai livelli a monte.

#### Scenario: Fattura multialiquota inserita da imponibile e IVA

- GIVEN una fattura Cash & Carry con imponibile 204,42 € e IVA 23,08 € letta dal documento
- WHEN gli importi vengono elaborati con l'IVA come dato
- THEN il totale vale 227,50 € e i due importi restano esattamente quelli inseriti
- AND nessuna aliquota entra nel calcolo

#### Scenario: Ripartizione di un lordo con IVA nota

- GIVEN un pagamento di 227,50 € su una fattura che stampa 23,08 € di IVA
- WHEN il lordo viene ripartito con l'IVA come dato
- THEN l'imponibile vale 204,42 €, l'IVA 23,08 € e il totale resta 227,50 €

#### Scenario: IVA nota pari a zero

- GIVEN un lordo di 250,00 € e IVA 0,00 € (operazione fuori campo o non imponibile)
- WHEN il lordo viene ripartito con l'IVA come dato
- THEN l'imponibile vale 250,00 € e nessun errore viene sollevato

#### Scenario: IVA superiore al lordo non è respinta dal calculator

- GIVEN un lordo di 100,00 € e un'IVA di 120,00 €
- WHEN il lordo viene ripartito con l'IVA come dato
- THEN l'imponibile risulta −20,00 € e il totale resta 100,00 €
- AND nessuna eccezione viene sollevata (la formula resta simmetrica agli storni)

### Requirement: Aliquota implicita come valore di sola presentazione

Il calculator MUST esporre `AliquotaImplicitaPercentuale(imponibile, iva)` che deriva la percentuale
`iva / imponibile` arrotondata al centesimo, e MUST restituire assenza di valore quando non è
derivabile: IVA assente, imponibile nullo, o rapporto negativo.

Il valore prodotto MUST essere trattato come informazione da mostrare all'operatore e MUST NOT essere
usato per decidere come ricalcolare gli importi di un documento.

#### Scenario: Aliquota implicita di una fattura monoaliquota

- GIVEN una fattura con imponibile 227,27 € e IVA 22,73 €
- WHEN viene derivata l'aliquota implicita
- THEN il valore è 10,00 %

#### Scenario: Aliquota implicita di una fattura multialiquota

- GIVEN una fattura con imponibile 204,42 € e IVA 23,08 €
- WHEN viene derivata l'aliquota implicita
- THEN il valore è 11,29 %, che non appartiene alle aliquote di legge
- AND rappresenta una media ponderata, non l'aliquota di alcuna riga del documento

#### Scenario: Aliquota implicita non derivabile

- GIVEN una fattura priva di `ImportoIva`, oppure con imponibile 0, oppure con rapporto negativo
- WHEN viene derivata l'aliquota implicita
- THEN non viene prodotto alcun valore

### Requirement: Modalità IVA persistita sulla fattura acquisto

`FatturaAcquisto` MUST persistere `IvaCalcolata` (booleano, obbligatorio, default `true`):
`true` = `ImportoIva` è stato calcolato da un'aliquota; `false` = è l'importo letto dal documento e
digitato dall'operatore.

La modalità MUST essere decisa dai punti che ricevono l'input dell'operatore, in funzione della
presenza di un importo IVA esplicito, e MUST NOT essere dedotta dagli importi persistiti: `22,00` su
`100,00` è identico che sia calcolato o digitato.

La migrazione MUST essere additiva e il default `true` MUST valere per tutte le righe preesistenti:
prima dell'introduzione del campo l'inserimento manuale dell'IVA non esisteva, quindi lo storico è
per costruzione tutto calcolato.

#### Scenario: Fattura salvata con IVA digitata

- GIVEN una fattura inserita con imponibile 204,42 € e importo IVA esplicito 23,08 €
- WHEN la fattura viene salvata
- THEN persiste `ImportoIva = 23,08`, `TotaleConIva = 227,50` e `IvaCalcolata = false`
- AND l'aliquota presente nell'input non viene letta

#### Scenario: Fattura salvata dall'aliquota

- GIVEN una fattura inserita con imponibile 300,00 € e aliquota 22 %, senza importo IVA esplicito
- WHEN la fattura viene salvata
- THEN persiste `ImportoIva = 66,00`, `TotaleConIva = 366,00` e `IvaCalcolata = true`

#### Scenario: Ritorno alla modalità aliquota

- GIVEN una fattura salvata con IVA digitata
- WHEN viene risalvata senza importo IVA esplicito e con aliquota 22 %
- THEN `IvaCalcolata` torna `true` e gli importi sono ricalcolati dall'aliquota

#### Scenario: Backfill dello storico

- GIVEN un database con fatture acquisto preesistenti
- WHEN viene applicata la migrazione che introduce `IvaCalcolata`
- THEN ogni fattura preesistente ha `IvaCalcolata = true`
- AND nessun altro campo delle fatture viene modificato

### Requirement: Importo IVA esplicito negli input di fattura e pagamento

`FatturaAcquistoInput` e `PagamentoFornitoreRegistroInput` MUST accettare un importo IVA opzionale.
Quando valorizzato MUST prevalere sull'aliquota presente nello stesso input, che MUST NOT essere
letta. Gli input MUST NOT esporre un flag di modalità separato: la presenza dell'importo È la
dichiarazione di modalità.

`FatturaAcquistoType` MUST esporre `ivaCalcolata` in lettura.

#### Scenario: Pagamento fornitore con IVA presa dalla fattura

- GIVEN una riga di pagamento da 227,50 € con importo IVA esplicito 23,08 € e tipo documento "FA"
- WHEN il pagamento viene registrato dal registro cassa
- THEN la fattura creata o riusata persiste imponibile 204,42 €, IVA 23,08 € e `IvaCalcolata = false`

#### Scenario: Pagamento fornitore senza importo IVA esplicito

- GIVEN una riga di pagamento da 250,00 € senza importo IVA e un fornitore con aliquota 10 %
- WHEN il pagamento viene registrato
- THEN la fattura persiste imponibile 227,27 €, IVA 22,73 € e `IvaCalcolata = true`

### Requirement: Ricalcolo dei totali da DDT condizionato alla modalità IVA

`FatturaAcquistoOrchestrator.RicalcolaTotaliFatturaAsync` è l'unico punto che ricalcola gli importi
di una fattura senza ricevere l'input dell'operatore, e quindi l'unico che MUST leggere la modalità
dal dato persistito. Il ricalcolo MUST scegliere fra due rami:

- `IvaCalcolata = true` → scorporo dal totale DDT con l'aliquota ricavata inversamente dalla fattura,
  **comportamento invariato**;
- `IvaCalcolata = false` e `ImportoIva` presente → l'IVA MUST essere congelata al valore persistito e
  l'imponibile MUST essere ricalcolato come `totale − iva`. Riscorporare significherebbe reinventare
  un'aliquota che sulla fattura non esiste.

#### Scenario: Ricalcolo su fattura a IVA digitata

- GIVEN una fattura con `IvaCalcolata = false` e `ImportoIva = 23,08 €`
- WHEN vengono collegati DDT per un totale di 300,00 €
- THEN `TotaleConIva` vale 300,00 €, `ImportoIva` resta 23,08 € e `Imponibile` vale 276,92 €
- AND `Imponibile + ImportoIva = TotaleConIva` al centesimo

#### Scenario: IVA digitata pari a un'aliquota di legge

- GIVEN una fattura con `IvaCalcolata = false`, imponibile 100,00 € e `ImportoIva = 22,00 €`
  (aliquota implicita esattamente 22 %, indistinguibile da una monoaliquota guardando gli importi)
- WHEN vengono collegati DDT per un totale di 300,00 €
- THEN `ImportoIva` resta 22,00 € e `Imponibile` vale 278,00 €
- AND il dato digitato NON viene riscorporato

### Requirement: Persistenza dell'associazione DDT prima del ricalcolo dei totali

L'associazione e la disassociazione dei DDT MUST essere persistite prima che i totali della fattura
vengano ricalcolati, perché il ricalcolo rilegge i DDT dal database (`Repository.FindAsync` è
`Where(...).ToListAsync()`, una query al provider) e non dal change tracker.

#### Scenario: DDT appena associato incluso nel totale

- GIVEN una fattura senza DDT collegati e un DDT da 244,00 € del suo stesso fornitore
- WHEN il DDT viene associato alla fattura
- THEN il totale della fattura vale 244,00 €, non 0,00 €

#### Scenario: DDT appena disassociato escluso dal totale

- GIVEN una fattura con due DDT collegati da 300,00 € e 120,00 €
- WHEN il secondo DDT viene rimosso dalla fattura
- THEN il totale della fattura vale 300,00 €

### Requirement: Etichettatura dell'aliquota mista nel breakdown IVA a credito

Il breakdown IVA a credito MUST marcare `AliquotaMista` quando la fattura ha `IvaCalcolata = false`
**oppure** quando la sua aliquota implicita non è un'aliquota di legge. Una fattura a IVA digitata
espone per costruzione una media ponderata, anche quando la percentuale coincide con un'aliquota
reale.

#### Scenario: Fattura a IVA digitata con percentuale pari al 22 %

- GIVEN un pagamento di 122,00 € su una fattura con `IvaCalcolata = false`, imponibile 100,00 €
  e IVA 22,00 €
- WHEN viene calcolato il breakdown IVA a credito
- THEN la riga espone aliquota 22,00 % con `AliquotaMista = true` e `Stimato = false`
