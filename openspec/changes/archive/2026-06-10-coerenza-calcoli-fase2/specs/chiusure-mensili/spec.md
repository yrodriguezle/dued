# Delta for Chiusure Mensili

**Change**: coerenza-calcoli-fase2
**Date**: 2026-06-09
**Status**: Draft

> Nota sullo schema GraphQL: questa delta NON modifica lo schema GraphQL.
> Il campo `ricavoNettoCalcolato` resta invariato nel nome e nel tipo; cambia la formula
> con cui viene calcolato a runtime (proprietà `[NotMapped]`, nessun dato persistito).
> Nessuna migrazione database.
>
> Comportamento attuale verificato:
> - `CreaChiusuraAsync` esegue due `SaveChangesAsync` separati senza transazione
>   (`ChiusuraMensileService.cs`, righe ~70 e ~100): un errore tra i due lascia una
>   chiusura persistita senza link a registri/pagamenti;
> - `ChiudiMensileAsync` (righe ~115-163) non usa transazione esplicita;
> - `RicavoNettoCalcolato = RicavoTotaleCalcolato − SpeseAggiuntiveCalcolate`
>   (`ChiusuraMensile.cs`, riga 104) ignora le `SpeseGiornaliere` dei registri inclusi;
> - test esistenti che fissano il valore: `ChiusuraMensileServiceTests.cs` riga 233
>   (atteso 300) e `MonthlyClosuresQueriesTests.cs` riga 265 (atteso 3700).

## ADDED Requirements

### Requirement: Atomicità della creazione chiusura mensile

`CreaChiusuraAsync` MUST eseguire in una transazione esplicita l'intera sequenza:
creazione della chiusura, associazione dei registri cassa del mese e associazione dei
pagamenti fornitori del mese. Se una qualunque fase fallisce, il sistema MUST annullare
l'intera operazione: nessuna `ChiusuraMensile` e nessun record di link
(`RegistroCassaMensile`, `PagamentoMensileFornitori`) devono restare persistiti.

#### Scenario: Errore a metà creazione — nessun dato parziale

- GIVEN un mese con registri chiusi e pagamenti fornitori da associare
- WHEN `CreaChiusuraAsync` fallisce dopo il salvataggio della chiusura ma prima (o durante)
  il salvataggio dei link a registri/pagamenti
- THEN nel database non esiste alcuna `ChiusuraMensile` per quel mese
- AND non esiste alcun record di link orfano
- AND un successivo tentativo di creazione per lo stesso mese non viene rifiutato come
  "già esistente"

#### Scenario: Creazione riuscita

- GIVEN un mese con 2 registri `CLOSED` e 1 pagamento fornitore
- WHEN `CreaChiusuraAsync` completa con successo
- THEN la chiusura esiste in stato `BOZZA` con 2 link registro (`Incluso = true`)
  e 1 link pagamento (`InclusoInChiusura = true`)
- AND la transazione è stata confermata una sola volta al termine dell'intera sequenza

### Requirement: Atomicità della chiusura definitiva mensile

`ChiudiMensileAsync` MUST eseguire la transizione di stato `BOZZA → CHIUSA` (inclusi i
campi di audit `ChiusaDa`, `ChiusaIl`, `UpdatedAt`) in una transazione esplicita con il
pattern try/commit/catch/rollback già usato dagli orchestrator. In caso di errore in
qualunque punto, la chiusura MUST restare in stato `BOZZA` senza alcun campo di audit
parzialmente valorizzato. Le validazioni esistenti (stato `BOZZA`, completezza registri
al netto dei giorni esclusi, ricavo totale > 0) MUST restare invariate.

#### Scenario: Errore durante la chiusura — stato invariato

- GIVEN una chiusura mensile in stato `BOZZA` valida per la chiusura
- WHEN `ChiudiMensileAsync` incontra un errore dopo l'avvio della transazione
  (es. fallimento del salvataggio)
- THEN la chiusura resta in stato `BOZZA`
- AND `ChiusaDa` e `ChiusaIl` restano null
- AND l'errore viene propagato al chiamante

#### Scenario: Chiusura riuscita

- GIVEN una chiusura mensile in stato `BOZZA` con tutti i registri operativi presenti
  e ricavo totale > 0
- WHEN `ChiudiMensileAsync` completa
- THEN la chiusura è in stato `CHIUSA` con `ChiusaIl` valorizzato e `ChiusaDa` pari
  all'utente indicato
- AND la transazione è stata confermata

## MODIFIED Requirements

### Requirement: RicavoNettoCalcolato include le spese giornaliere dei registri inclusi

La proprietà calcolata `RicavoNettoCalcolato` MUST valere
`RicavoTotaleCalcolato − SpeseAggiuntiveCalcolate − Σ SpeseGiornaliere` dei registri
inclusi nella chiusura (`RegistriInclusi` con `Incluso == true`). I registri con
`Incluso == false` MUST NOT contribuire alla somma delle spese giornaliere. Il valore
MUST essere calcolato a runtime (proprietà `[NotMapped]`, nessun dato persistito): le
chiusure esistenti, anche già `CHIUSA`, espongono il nuovo valore — comportamento
intenzionale e documentato. Lista, dettaglio e report di stampa
(`MonthlyClosureList.tsx`, `MonthlyClosureDetails.tsx`, `MonthlyClosureReport.tsx`)
MUST mostrare il valore `ricavoNettoCalcolato` del server senza ricalcoli locali; il
report di stampa SHOULD elencare le voci di spesa (incluse le spese giornaliere dei
registri) in modo che il dettaglio sia coerente con il nuovo netto. I test esistenti che
fissano il valore atteso (`ChiusuraMensileServiceTests.cs` riga ~233 e
`MonthlyClosuresQueriesTests.cs` riga ~265) MUST essere aggiornati alla nuova formula.

(Precedentemente: `RicavoNettoCalcolato = RicavoTotaleCalcolato − SpeseAggiuntiveCalcolate`,
che sovrastimava il netto ignorando le spese giornaliere dei registri inclusi.)

#### Scenario: Netto con spese giornaliere dei registri

- GIVEN una chiusura con ricavo totale 1.000 € e spese aggiuntive 700 €
  (spese libere + pagamenti fornitori inclusi)
- AND i registri inclusi hanno `SpeseGiornaliere` per 50 € e 30 €
- WHEN viene letto `ricavoNettoCalcolato`
- THEN il valore è 220 € (1.000 − 700 − 80)

#### Scenario: Registro escluso non contribuisce alle spese giornaliere

- GIVEN una chiusura con due link registro: R1 (`Incluso = true`, `SpeseGiornaliere = 40 €`)
  e R2 (`Incluso = false`, `SpeseGiornaliere = 60 €`)
- WHEN viene letto `ricavoNettoCalcolato`
- THEN solo i 40 € di R1 vengono sottratti
- AND R2 non contribuisce né al ricavo né alle spese

#### Scenario: Nessuna spesa giornaliera — formula equivalente alla precedente

- GIVEN una chiusura i cui registri inclusi hanno tutti `SpeseGiornaliere = 0`
- WHEN viene letto `ricavoNettoCalcolato`
- THEN il valore coincide con `RicavoTotaleCalcolato − SpeseAggiuntiveCalcolate`
  (identico al comportamento precedente)

#### Scenario: Chiusura già CHIUSA espone il nuovo valore a runtime

- GIVEN una chiusura in stato `CHIUSA`, creata prima di questa modifica, i cui registri
  inclusi hanno spese giornaliere totali di 120 €
- WHEN la lista, il dettaglio o il report di stampa richiedono `ricavoNettoCalcolato`
- THEN il valore restituito è inferiore di 120 € rispetto a quello mostrato prima della modifica
- AND nessun dato persistito della chiusura è stato modificato
