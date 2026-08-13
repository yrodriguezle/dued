# Delta for Calcoli IVA — IVA digitata sulle fatture acquisto

**Change**: fattura-iva-digitata
**Date**: 2026-08-13
**Status**: Draft
**Base spec**: `openspec/specs/calcoli-iva/specs.md`

Convenzioni trasversali (vincolanti per tutti i requirement):

- Le operazioni a IVA nota NON prendono un'aliquota: l'IVA è un input, il terzo importo si ricava
  per differenza o per somma. L'invariante `Imponibile + Iva == Totale` al centesimo resta valida.
- La modalità di una fattura è il campo persistito `FatturaAcquisto.IvaCalcolata`. NON si deduce
  dagli importi: `22,00` su `100,00` è identico che sia calcolato o digitato.
- L'aliquota implicita (`ImportoIva / Imponibile`) è un valore da MOSTRARE. Su una fattura a IVA
  digitata è una media ponderata e non corrisponde ad alcuna aliquota reale.
- Gli importi negativi restano ammessi (storni), come nelle operazioni preesistenti.

---

## ADDED Requirements

### Requirement: Operazioni IVA con l'IVA come dato invece che come incognita

Il calculator MUST esporre due operazioni in cui l'aliquota non entra nel calcolo, duali di quelle
esistenti:

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
presenza di un importo IVA esplicito, e MUST NOT essere dedotta dagli importi persistiti.

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

### Requirement: Persistenza dell'associazione DDT prima del ricalcolo dei totali

L'associazione e la disassociazione dei DDT MUST essere persistite prima che i totali della fattura
vengano ricalcolati, perché il ricalcolo rilegge i DDT dal database e non dal change tracker.

#### Scenario: DDT appena associato incluso nel totale

- GIVEN una fattura senza DDT collegati e un DDT da 244,00 € del suo stesso fornitore
- WHEN il DDT viene associato alla fattura
- THEN il totale della fattura vale 244,00 €, non 0,00 €

#### Scenario: DDT appena disassociato escluso dal totale

- GIVEN una fattura con due DDT collegati da 300,00 € e 120,00 €
- WHEN il secondo DDT viene rimosso dalla fattura
- THEN il totale della fattura vale 300,00 €

---

## MODIFIED Requirements

### Requirement: Sostituzione delle formule IVA inline con il calculator

La lista dei call site resta valida, con una precisazione sul quinto:
`FatturaAcquistoOrchestrator.RicalcolaTotaliFatturaAsync` (ricalcolo dal totale dei DDT collegati)
MUST scegliere fra due rami in base a `FatturaAcquisto.IvaCalcolata`:

- `IvaCalcolata = true` → scorporo dal totale DDT con l'aliquota ricavata inversamente dalla fattura,
  **comportamento invariato**;
- `IvaCalcolata = false` e `ImportoIva` presente → l'IVA MUST essere congelata al valore persistito e
  l'imponibile MUST essere ricalcolato come `totale − iva`. Riscorporare significherebbe reinventare
  un'aliquota che sulla fattura non esiste.

Questo è l'unico punto che ricalcola gli importi di una fattura senza ricevere l'input dell'operatore,
e quindi l'unico che deve leggere la modalità dal dato persistito.

#### Scenario: Ricalcolo totali fattura da DDT collegati (monoaliquota, invariato)

- GIVEN una fattura con `IvaCalcolata = true` e aliquota effettiva 22 %, con DDT collegati per 244,00 €
- WHEN i totali fattura vengono ricalcolati
- THEN `TotaleConIva` vale 244,00 €, `Imponibile` 200,00 € e `ImportoIva` 44,00 €

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

### Requirement: Etichettatura dell'aliquota mista nel breakdown IVA a credito

Il breakdown IVA a credito MUST marcare `AliquotaMista` quando la fattura ha `IvaCalcolata = false`
**oppure** quando la sua aliquota implicita non è un'aliquota di legge. Una fattura a IVA digitata
espone per costruzione una media ponderata, anche quando la percentuale coincide con un'aliquota
reale.

#### Scenario: Fattura a IVA digitata con percentuale pari al 22 %

- GIVEN un pagamento di 122,00 € su una fattura con `IvaCalcolata = false`, imponibile 100,00 € e IVA 22,00 €
- WHEN viene calcolato il breakdown IVA a credito
- THEN la riga espone aliquota 22,00 % con `AliquotaMista = true` e `Stimato = false`
