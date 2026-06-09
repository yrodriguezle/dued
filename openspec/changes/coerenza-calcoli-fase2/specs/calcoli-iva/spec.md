# Delta for Calcoli IVA

**Change**: coerenza-calcoli-fase2
**Date**: 2026-06-09
**Status**: Draft

> Nota sullo schema GraphQL: questa delta NON modifica lo schema GraphQL.
> I campi esposti (`importoIva`, `imponibile`, `totaleConIva`, `totaleVendite`) restano
> invariati; cambia solo il punto in cui i valori vengono calcolati (consolidamento).
>
> Convenzioni esistenti verificate nel codice:
> - `BusinessSettings.VatRate` è una **frazione** (es. `0.22`) — usata in
>   `MutateRegistroCassaOrchestrator.CalcolaTotali` (riga ~533: `TotaleVendite * (aliquota / (1 + aliquota))`).
> - `AliquotaIva` di fatture/fornitori è una **percentuale** (es. `22`) — usata in
>   `UpdatePagamentiEsistenti` (riga ~276), `CreaFatturaAcquisto` (riga ~391),
>   `FatturaAcquistoOrchestrator.MutateAsync` (riga ~40) e
>   `RicalcolaTotaliFatturaAsync` (righe ~160-166: `lordo / (1 + aliquota / 100)`).

## ADDED Requirements

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
   (con aliquota ricavata inversamente dalla fattura, invariata).

A parità di input, gli importi prodotti dopo il refactoring MUST coincidere al centesimo
con quelli prodotti dalle formule inline attuali (nessun cambiamento funzionale: è un
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

- GIVEN una fattura con DDT collegati per un totale lordo di 244,00 € e aliquota effettiva 22%
  (ricavata inversamente da `ImportoIva/Imponibile` come oggi)
- WHEN i totali fattura vengono ricalcolati tramite il calculator
- THEN `TotaleConIva` vale 244,00 €, `Imponibile` vale 200,00 € e `ImportoIva` vale 44,00 €
- AND `Imponibile + ImportoIva = TotaleConIva` al centesimo
