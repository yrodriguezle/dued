# Delta for Gestione Cassa

**Change**: coerenza-calcoli-fase2
**Date**: 2026-06-09
**Status**: Draft

> Nota sullo schema GraphQL: questa delta NON modifica lo schema GraphQL.
> I campi del tipo `RegistroCassaKPI` (`venditeOggi`, `differenzaOggi`, `venditeMese`,
> `mediaMese`, `trendSettimana`) restano invariati nel nome e nel tipo; cambiano i
> criteri di calcolo di `mediaMese` e `trendSettimana`.
>
> Comportamento attuale verificato (`GestioneCassaQueries.cs`, righe ~44-94):
> - `MediaMese` media `TotaleVendite` di TUTTI i registri del mese, inclusi i DRAFT a 0 €;
> - `startOfWeek = today.AddDays(-(int)today.DayOfWeek)` → settimana che inizia di domenica;
> - `TrendSettimana` confronta gli ultimi 3 registri (`TakeLast(3)`) contro tutti i precedenti.
> - `ChiudiRegistroCassaOrchestrator` (riga 40) usa `GuardGiornoOperativoSoloGlobale`;
>   la creazione (`MutateRegistroCassaOrchestrator`, riga 38) usa `GuardGiornoOperativoConPeriodi`.

## MODIFIED Requirements

### Requirement: MediaMese calcolata solo sui registri chiusi

Il KPI `mediaMese` MUST essere la media di `TotaleVendite` dei soli registri cassa del
mese corrente (dal primo del mese a oggi incluso) con stato `CLOSED` o `RECONCILED`.
I registri `DRAFT` MUST NOT concorrere alla media. Se nel mese non esiste alcun registro
`CLOSED`/`RECONCILED`, `mediaMese` MUST valere 0 (nessuna divisione per zero).
I KPI `venditeOggi` e `differenzaOggi` MUST continuare a riflettere il registro del
giorno corrente qualunque sia il suo stato (incluso `DRAFT`: è il dato live di oggi);
`venditeMese` resta invariato.

(Precedentemente: la media includeva tutti i registri del mese, e i DRAFT — che valgono
0 € — abbassavano artificialmente il valore.)

#### Scenario: Mese con registri chiusi e bozze

- GIVEN un mese corrente con 10 registri `CLOSED` per un totale vendite di 5.000 €
- AND 2 registri `DRAFT` con `TotaleVendite = 0`
- WHEN viene eseguita la query `dashboardKPIs`
- THEN `mediaMese` vale 500 € (5.000 / 10)
- AND i 2 DRAFT non entrano né al numeratore né al denominatore

#### Scenario: Mese senza registri chiusi

- GIVEN un mese corrente che contiene solo registri `DRAFT` (o nessun registro)
- WHEN viene eseguita la query `dashboardKPIs`
- THEN `mediaMese` vale 0
- AND la query completa senza errori

### Requirement: TrendSettimana su settimane lunedì-based con porzione equivalente

Il KPI `trendSettimana` MUST confrontare le vendite della **settimana corrente da lunedì
a oggi incluso** con le vendite della **porzione equivalente della settimana precedente**
(dal lunedì precedente allo stesso giorno della settimana, cioè ogni data spostata di
−7 giorni). La settimana MUST iniziare di lunedì, coerentemente con la convenzione
`operatingDayIndex` (0 = lunedì) usata dai guard e dalle chiusure mensili.
Solo i registri con stato `CLOSED` o `RECONCILED` MUST concorrere a entrambe le somme.
La formula MUST essere `trend = (correnteParziale − precedenteEquivalente) / precedenteEquivalente × 100`;
se `precedenteEquivalente` vale 0, `trendSettimana` MUST valere 0 (guardia divisione per zero).

(Precedentemente: confronto arbitrario `TakeLast(3)` contro il resto dei registri caricati,
con settimana che partiva di domenica e senza filtro sullo stato.)

#### Scenario: Trend positivo su porzione equivalente

- GIVEN oggi è mercoledì e i registri `CLOSED` da lunedì a mercoledì della settimana
  corrente totalizzano 1.100 €
- AND i registri `CLOSED` da lunedì a mercoledì della settimana precedente totalizzano 1.000 €
- AND giovedì-domenica della settimana precedente hanno altri registri chiusi (esclusi dal confronto)
- WHEN viene eseguita la query `dashboardKPIs`
- THEN `trendSettimana` vale +10 (%)
- AND i giorni della settimana precedente successivi a mercoledì non entrano nella base di confronto

#### Scenario: Settimana precedente con base zero

- GIVEN la porzione equivalente della settimana precedente non contiene registri
  `CLOSED`/`RECONCILED` (somma 0)
- WHEN viene eseguita la query `dashboardKPIs`
- THEN `trendSettimana` vale 0
- AND la query completa senza errori di divisione per zero

#### Scenario: Settimana corrente con 0 registri chiusi

- GIVEN la settimana corrente (lunedì → oggi) contiene solo registri `DRAFT` o nessun registro
- AND la porzione equivalente della settimana precedente totalizza 800 € di registri chiusi
- WHEN viene eseguita la query `dashboardKPIs`
- THEN `trendSettimana` vale −100 (%) ((0 − 800) / 800 × 100)
- AND i registri `DRAFT` della settimana corrente non vengono sommati

#### Scenario: Domenica appartiene alla settimana iniziata il lunedì precedente

- GIVEN oggi è domenica
- WHEN viene calcolato l'inizio della settimana corrente
- THEN la settimana corrente è iniziata il lunedì di 6 giorni prima (non oggi né il giorno dopo)
- AND il confronto copre lunedì→domenica corrente vs lunedì→domenica della settimana precedente

### Requirement: Guard giorno operativo simmetrico tra creazione e chiusura registro

La chiusura del registro cassa (`chiudiRegistroCassa`) MUST validare il giorno operativo
con la stessa logica della creazione: periodi di programmazione
(`PeriodiProgrammazione`) quando esistono, con fallback alle impostazioni globali
(`BusinessSettings.OperatingDays`) quando non esiste alcun periodo. Un registro creato in
un giorno operativo MUST risultare sempre chiudibile rispetto al guard del giorno
operativo (guard simmetrici). I messaggi d'errore MUST essere declinati per l'operazione
("Impossibile chiudere...") mantenendo giorno e data nel testo. La logica condivisa di
valutazione del giorno operativo MUST essere unica (nessuna duplicazione tra i due guard).

(Precedentemente: la chiusura usava `GuardGiornoOperativoSoloGlobale`, che ignora i
periodi di programmazione → un registro creato in un giorno operativo di periodo ma non
operativo nel calendario globale risultava non chiudibile.)

#### Scenario: Registro creato in giorno operativo di periodo è chiudibile

- GIVEN un periodo di programmazione attivo che include il martedì come giorno operativo
- AND le impostazioni globali (`OperatingDays`) marcano il martedì come giorno di chiusura
- AND un registro cassa creato di martedì (la creazione è stata permessa dal guard con periodi)
- WHEN l'utente esegue `chiudiRegistroCassa` su quel registro
- THEN il guard del giorno operativo passa e il registro transita a `CLOSED`

#### Scenario: Chiusura rifiutata in giorno non operativo del periodo

- GIVEN un periodo di programmazione attivo che marca la domenica come giorno di chiusura
- AND un registro cassa con data domenica
- WHEN l'utente esegue `chiudiRegistroCassa` su quel registro
- THEN l'operazione fallisce con un errore che inizia con "Impossibile chiudere"
  e contiene il nome del giorno e la data
- AND lo stato del registro resta invariato

#### Scenario: Nessun periodo configurato — fallback globale invariato

- GIVEN nessun `PeriodoProgrammazione` configurato
- AND le impostazioni globali marcano il lunedì come giorno operativo
- WHEN l'utente chiude un registro con data lunedì
- THEN il guard usa le impostazioni globali e la chiusura procede
- AND il comportamento è identico a quello precedente alla modifica

### Requirement: Totale Vendite mensile allineato al backend (VistaMensile)

Le metriche mensili di `VistaMensile` MUST calcolare `totaleVendite` sommando il campo
`totaleVendite` restituito dal server per ciascun registro; in assenza del dato del
server la somma di fallback MUST usare i canali di incasso
(`incassoContanteTracciato + incassiElettronici + incassiFattura`), cioè la stessa
formula del backend. Il movimento fisico di cassa (`totaleChiusura − totaleApertura`)
MUST NOT concorrere al Totale Vendite mensile. Anche il `revenue` degli eventi del
calendario MUST usare lo stesso valore/formula del server, NOT il movimento fisico.

(Precedentemente: `VistaMensile.tsx` riga ~89 sommava `movimento + elettronici + fatture`
e riga ~105 calcolava `revenue = (chiusura − apertura) + elettronici` — formule già
corrette in Fase 1 su `SummaryDataGrid.tsx` ma rimaste nella vista mensile.)

#### Scenario: Totale Vendite mensile coerente con il server

- GIVEN un mese con due registri: R1 con `totaleVendite = 500 €` (movimento fisico 480 €)
  e R2 con `totaleVendite = 300 €` (movimento fisico 320 €)
- WHEN la vista mensile calcola le metriche
- THEN il Totale Vendite mensile vale 800 € (500 + 300)
- AND il valore coincide con la somma dei `totaleVendite` del server, non con la somma
  dei movimenti fisici

#### Scenario: Evento calendario con revenue dal valore server

- GIVEN un registro con `totaleVendite = 500 €`, `totaleChiusura − totaleApertura = 480 €`
  e `incassiElettronici = 150 €`
- WHEN la vista mensile genera l'evento calendario di quel giorno
- THEN il `revenue` mostrato nel titolo dell'evento vale 500 €
- AND non vale 630 € (movimento + elettronici, formula precedente)

## REMOVED Requirements

### Requirement: Riepilogo cassa CashSummary

(Reason: `CashSummary.tsx` è dead code — nessun import nel codebase, verificato; il
riepilogo attivo è `SummaryDataGrid.tsx`, già allineato in Fase 1. Il file viene rimosso;
il requirement di Fase 1 "IVA visualizzata dal backend" resta soddisfatto dal riepilogo
attivo. Dopo la rimozione `npm run ts:check` e `npm run lint` MUST passare.)
