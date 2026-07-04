# Dashboard Cassa Specification

> Change: `dashboard-charts-redesign` — spec NUOVA (nessuna spec principale esistente per il dominio `dashboard-cassa`).
> Riferimento formule: `duedgusto/src/components/pages/registrazioneCassa/vistaMensile/VistaMensile.tsx` (calcolo `monthlyStats`) e `RiepilogoIncassiMensile.tsx`.

## Purpose

La Dashboard Cassa è la pagina di panoramica gestionale del punto vendita (renderizzata da `HomePage.tsx`). Mostra i KPI gestionali coerenti con la vista mensile, la distribuzione degli incassi, il flusso di denaro e i trend annuali, alimentata da dati aggregati lato server (non da liste di registri scaricate client-side).

## Definizioni e Formule (normative)

Per ogni registro cassa, con i campi del tipo GraphQL `RegistroCassa`:

| Metrica | Formula per registro |
|---------|---------------------|
| Movimento fisico di cassa | `totaleChiusura − totaleApertura` (null → 0) |
| Vendite del registro | `totaleVendite` se valorizzato dal server, altrimenti `movimentoFisico + incassiElettronici + incassiFattura` |
| Ricavo tracciato | `incassoContanteTracciato + incassiElettronici + incassiFattura` |
| Ricavo non tracciato | `movimentoFisico − incassoContanteTracciato` |
| Spese tracciate | `speseFornitori` |
| Spese non tracciate | `speseGiornaliere` |

Aggregati di periodo (mese o anno) = somma delle metriche per registro su TUTTI i registri del periodo, indipendentemente dallo stato (bozze incluse), come nella vista mensile. Derivati:

- `totaleSpese = speseTracciate + speseNonTracciate`
- `differenza = totaleVendite − totaleSpese`

## Requirements

### Requirement: KPI gestionali del mese di riferimento

La dashboard MUST mostrare, per il mese di riferimento, i 7 KPI gestionali della vista mensile: Totale Vendite, Totale Spese, Differenza, Ricavo tracciato, Ricavo non tracciato, Spese tracciate, Spese non tracciate. I valori MUST essere calcolati con le formule normative di questa spec e MUST coincidere al centesimo con quelli mostrati da `RiepilogoIncassiMensile` per lo stesso mese. I valori monetari MUST essere formattati con `formatCurrency` (prefisso `€`, segno negativo per le spese quando > 0).

Il mese di riferimento MUST essere:
- il mese corrente, se l'anno selezionato è l'anno corrente;
- l'ultimo mese dell'anno con almeno un registro, se l'anno selezionato è un anno passato.

L'intestazione della sezione KPI MUST indicare esplicitamente mese e anno di riferimento.

#### Scenario: Coerenza al centesimo con la vista mensile

- GIVEN un mese con registri cassa (chiusi e in bozza) con incassi elettronici, fatture, contante tracciato e spese
- WHEN l'utente apre la dashboard con l'anno corrente selezionato
- THEN i 7 KPI del mese corrente mostrano gli stessi importi, al centesimo, del riepilogo della vista mensile per lo stesso mese
- AND la Differenza è visualizzata con colore positivo se ≥ 0 e negativo se < 0

#### Scenario: Anno passato selezionato

- GIVEN l'anno selezionato 2025 (passato) con registri fino a novembre
- WHEN la dashboard renderizza la sezione KPI mensili
- THEN i KPI si riferiscono a novembre 2025 (ultimo mese con registri)
- AND l'intestazione indica chiaramente "Novembre 2025" (o equivalente localizzato)

#### Scenario: Registro con campi null

- GIVEN un registro del mese con `totaleVendite`, `incassoContanteTracciato` o totali di apertura/chiusura null
- WHEN vengono calcolati i KPI
- THEN i campi null sono trattati come 0 e il fallback `movimentoFisico + incassiElettronici + incassiFattura` è usato al posto di `totaleVendite`
- AND nessun KPI mostra `NaN` o valori non numerici

### Requirement: KPI annuali

La dashboard MUST mostrare i KPI aggregati sull'intero anno selezionato (somma dei 12 mesi) per almeno: Totale Vendite, Totale Spese, Differenza, Ricavo tracciato, Ricavo non tracciato. La dashboard MAY accorpare i KPI annuali in un layout più compatto rispetto a quelli mensili.

#### Scenario: Aggregato annuale come somma dei mesi

- GIVEN un anno con dati in più mesi
- WHEN la dashboard renderizza i KPI annuali
- THEN ogni KPI annuale è uguale alla somma dei corrispondenti valori mensili dei 12 mesi dell'anno selezionato

### Requirement: Confronto con il periodo precedente

I KPI del mese di riferimento MUST mostrare la variazione percentuale rispetto al mese precedente (dicembre dell'anno precedente quando il mese di riferimento è gennaio, se il dato è disponibile) almeno per Totale Vendite e Differenza; SHOULD mostrarla anche per gli altri KPI monetari. I KPI annuali SHOULD mostrare la variazione percentuale rispetto all'anno precedente.

La variazione MUST essere calcolata come `(valoreCorrente − valorePrecedente) / |valorePrecedente| × 100`. Quando il valore del periodo precedente è 0 o non disponibile, l'indicatore di variazione MUST essere omesso (nessuna divisione per zero, nessun "Infinity%").

#### Scenario: Trend positivo mese su mese

- GIVEN Totale Vendite di marzo = 11.000 € e di febbraio = 10.000 €
- WHEN la dashboard mostra il KPI Totale Vendite di marzo
- THEN accanto al valore compare un indicatore +10,0% con connotazione positiva (icona/colore)

#### Scenario: Periodo precedente senza dati

- GIVEN il mese precedente al mese di riferimento senza alcun registro
- WHEN la dashboard renderizza i KPI mensili
- THEN nessun indicatore percentuale è mostrato per quei KPI
- AND il valore del KPI resta visibile normalmente

### Requirement: Donut distribuzione incassi

La dashboard MUST mostrare un grafico a donut della distribuzione degli incassi del periodo (anno selezionato) con esattamente 4 segmenti: Contante tracciato (`incassoContanteTracciato`), Elettronici (`incassiElettronici`), Fatture (`incassiFattura`), Non tracciato (ricavo non tracciato). Ogni segmento MUST esporre etichetta, valore in euro e percentuale sul totale (nel tooltip e/o in legenda). I segmenti con valore ≤ 0 MUST essere esclusi dal grafico ma SHOULD restare visibili in legenda con valore zero.

#### Scenario: Distribuzione con tutte le categorie valorizzate

- GIVEN un anno con incassi in tutte e 4 le categorie
- WHEN la dashboard renderizza il donut
- THEN sono visibili 4 segmenti le cui somme corrispondono a Ricavo tracciato + Ricavo non tracciato dell'anno
- AND il tooltip di ogni segmento mostra valore formattato in euro e percentuale

#### Scenario: Categoria a zero

- GIVEN un anno senza incassi a fattura (`incassiFattura` = 0 su tutti i registri)
- WHEN la dashboard renderizza il donut
- THEN il segmento Fatture non è disegnato nel grafico
- AND il totale visualizzato resta coerente con la somma delle categorie rimanenti

### Requirement: Trend mensile ricavi vs spese (barre)

La dashboard MUST mostrare un grafico a barre con i 12 mesi dell'anno selezionato sull'asse X e, per ogni mese, le serie Totale Vendite e Totale Spese. Il grafico SHOULD mostrare anche la Differenza (come serie o come derivabile visivamente). I mesi senza dati MUST comparire sull'asse con valore 0 (nessun buco nell'asse). Il tooltip MUST mostrare i valori formattati in euro.

#### Scenario: Anno parziale

- GIVEN l'anno corrente con dati solo da gennaio ad aprile
- WHEN la dashboard renderizza il trend mensile
- THEN l'asse X mostra tutti i 12 mesi (Gen–Dic)
- AND i mesi da maggio a dicembre hanno barre a 0

### Requirement: Andamento (linea)

La dashboard MUST mostrare un grafico a linee dell'andamento sui 12 mesi dell'anno selezionato con almeno le serie Ricavo tracciato e Ricavo non tracciato; MAY includere Totale Vendite. Le serie MUST essere distinguibili per colore coerente con la semantica dei KPI (tracciato/non tracciato).

#### Scenario: Andamento tracciato vs non tracciato

- GIVEN un anno con dati mensili
- WHEN la dashboard renderizza il grafico a linee
- THEN sono presenti le serie Ricavo tracciato e Ricavo non tracciato su 12 punti ciascuna
- AND i valori di ogni punto coincidono con gli aggregati mensili delle formule normative

### Requirement: Sparkline nelle KPI card

Le KPI card del mese di riferimento SHOULD includere una sparkline con l'andamento degli ultimi 12 mesi della metrica della card (serie mensile dell'anno selezionato). La sparkline MUST essere puramente indicativa (senza assi) e MUST essere omessa quando la serie storica non contiene almeno 2 mesi con dati. La sparkline MUST NOT alterare la leggibilità del valore principale della card.

#### Scenario: Sparkline con storico disponibile

- GIVEN almeno 2 mesi con registri nell'anno selezionato
- WHEN la dashboard renderizza la KPI card Totale Vendite
- THEN la card contiene una sparkline con un punto per ciascun mese dell'anno

#### Scenario: Storico insufficiente

- GIVEN un anno con registri in un solo mese
- WHEN la dashboard renderizza le KPI card
- THEN nessuna sparkline è mostrata
- AND la card mantiene layout e valore corretti

### Requirement: Sankey flusso di denaro

La dashboard MUST mostrare un diagramma Sankey del flusso di denaro dell'anno selezionato con questa topologia:

- nodo sorgente **Vendite** (Totale Vendite);
- Vendite → **Ricavo tracciato** e Vendite → **Ricavo non tracciato**;
- Ricavo tracciato/non tracciato → **Spese tracciate**, **Spese non tracciate** e **Netto** (differenza residua).

I link MUST avere valori ≥ 0: i valori negativi (es. ricavo non tracciato negativo o differenza negativa) MUST essere troncati a 0 nel diagramma, e in tal caso la dashboard SHOULD segnalare testualmente l'anomalia (es. "netto negativo"). Il tooltip di ogni link MUST mostrare il valore in euro. Il blocco Sankey MUST essere caricato in modo lazy (code-splitting) e un errore di rendering del Sankey MUST NOT far crashare il resto della dashboard.

#### Scenario: Flusso completo positivo

- GIVEN un anno con Vendite 100.000 €, tracciato 70.000 €, non tracciato 30.000 €, spese tracciate 20.000 €, spese non tracciate 10.000 €
- WHEN la dashboard renderizza il Sankey
- THEN i link Vendite→Tracciato (70.000) e Vendite→Non tracciato (30.000) sono proporzionali ai valori
- AND il nodo Netto riceve 70.000 € (100.000 − 30.000 di spese)

#### Scenario: Netto negativo

- GIVEN un anno in cui il totale spese supera il totale vendite
- WHEN la dashboard renderizza il Sankey
- THEN nessun link ha valore negativo (il link verso Netto è 0)
- AND un'indicazione testuale segnala il saldo negativo

#### Scenario: Errore di rendering del Sankey

- GIVEN un errore runtime nel componente Sankey (es. incompatibilità libreria)
- WHEN la dashboard viene renderizzata
- THEN KPI e gli altri grafici restano visibili e funzionanti
- AND l'area del Sankey mostra un fallback di errore localizzato

### Requirement: Origine dati aggregata e contratto RiepilogoDashboard

La dashboard MUST alimentarsi da un contratto dati normalizzato `RiepilogoDashboard` contenente, per ciascuno dei 12 mesi dell'anno selezionato: `anno`, `mese`, `totaleVendite`, `ricavoTracciato`, `ricavoNonTracciato`, `speseTracciate`, `speseNonTracciate`, `incassoContanteTracciato`, `incassiElettronici`, `incassiFattura`, `numeroRegistri`. La fonte primaria MUST essere la query GraphQL aggregata `riepilogoAnnuale(anno)` (vedi delta `gestione-cassa`).

La dashboard MUST NOT scaricare liste di registri cassa a paginazione larga (es. `GetRegistriCassa` con pageSize dell'ordine delle centinaia/1000) per costruire gli aggregati.

Se la query aggregata non è disponibile (backend non ancora deployato: errore di schema/validazione), la dashboard MUST ricadere su un adapter client-side che produce la stessa shape `RiepilogoDashboard` applicando le formule normative ai registri recuperati per mese; l'adapter MUST essere trasparente per i componenti di presentazione.

#### Scenario: Fonte primaria server

- GIVEN il backend che espone `riepilogoAnnuale`
- WHEN la dashboard carica i dati per l'anno selezionato
- THEN viene eseguita una sola query aggregata annuale (più eventuali query leggere di confronto periodo)
- AND nessuna query `GetRegistriCassa` con pageSize ≥ 100 è eseguita dalla dashboard

#### Scenario: Fallback adapter client

- GIVEN un backend privo della query `riepilogoAnnuale` (errore GraphQL di campo sconosciuto)
- WHEN la dashboard carica i dati
- THEN l'adapter client costruisce `RiepilogoDashboard` con le stesse formule normative
- AND KPI e grafici mostrano valori identici a quelli che produrrebbe il server per gli stessi registri

### Requirement: Selezione anno

La dashboard MUST offrire un selettore dell'anno con default l'anno corrente e almeno gli ultimi 5 anni disponibili. Al cambio di anno, KPI, donut, trend, andamento, sparkline e Sankey MUST aggiornarsi coerentemente con il nuovo anno. La selezione MAY non essere persistita tra sessioni.

#### Scenario: Cambio anno

- GIVEN la dashboard sull'anno corrente
- WHEN l'utente seleziona l'anno precedente
- THEN tutti i KPI e i grafici mostrano i dati dell'anno selezionato
- AND l'intestazione della sezione KPI mensile riflette il nuovo mese di riferimento

### Requirement: Stati di caricamento

Durante il caricamento dei dati la dashboard MUST mostrare indicatori di caricamento (skeleton o spinner) e MUST NOT mostrare empty state o valori a zero spacciati per dati reali. Al primo caricamento la struttura della pagina (header, selettore anno, azioni) SHOULD restare visibile e interattiva.

#### Scenario: Primo caricamento

- GIVEN la query aggregata in corso
- WHEN la dashboard è renderizzata
- THEN le aree KPI e grafici mostrano placeholder di caricamento
- AND non compare il messaggio di "nessun dato"

### Requirement: Empty state

Quando l'anno selezionato non contiene alcun registro, la dashboard MUST mostrare un empty state esplicito e localizzato in italiano (es. "Nessun dato per il {anno}") al posto di grafici vuoti o rotti, e SHOULD proporre l'azione "Nuova Cassa". I KPI MAY mostrare 0 € purché l'assenza di dati sia comunicata chiaramente.

#### Scenario: Anno senza registri

- GIVEN un anno selezionato senza alcun registro cassa
- WHEN il caricamento termina
- THEN donut, Sankey e trend mostrano l'empty state (nessun grafico con soli assi vuoti o `NaN`)
- AND è disponibile un'azione per creare una nuova cassa o tornare all'anno corrente

### Requirement: Gestione errori

In caso di errore di rete o GraphQL non recuperabile (dopo l'eventuale fallback adapter), la dashboard MUST mostrare un messaggio di errore localizzato con azione di retry e MUST NOT mostrare dati parziali senza segnalarlo. Gli errori MUST essere loggati tramite il logger dell'app (non `console`).

#### Scenario: Errore di rete con retry

- GIVEN il backend irraggiungibile
- WHEN la dashboard tenta il caricamento
- THEN compare un messaggio di errore in italiano con pulsante "Riprova"
- AND al click su "Riprova" la query viene rieseguita e, in caso di successo, la dashboard si popola normalmente

### Requirement: Tema dark/light

Tutti i componenti della dashboard (KPI card, donut, barre, linee, sparkline, Sankey, tooltip, legende) MUST essere leggibili e coerenti col tema MUI attivo sia in dark che in light mode, usando colori derivati dalla palette del tema (`theme.tsx`), inclusi i grafici che non ereditano il tema automaticamente. Il cambio tema a runtime MUST aggiornare i colori dei grafici senza ricaricare la pagina.

#### Scenario: Cambio tema a runtime

- GIVEN la dashboard renderizzata in light mode
- WHEN l'utente attiva la dark mode dal toggle dell'header
- THEN sfondi, testi, tooltip e serie dei grafici (incluso il Sankey) adottano i colori dark del tema
- AND nessun testo risulta illeggibile per contrasto insufficiente

### Requirement: Layout responsive

La dashboard MUST essere utilizzabile da 360px di larghezza in su: le KPI card MUST riorganizzarsi su colonne ridotte, i grafici MUST ridimensionarsi al contenitore senza overflow orizzontale della pagina. Su viewport mobile il Sankey MAY essere scrollabile orizzontalmente o sostituito da una rappresentazione compatta, ma l'informazione del flusso MUST restare accessibile.

#### Scenario: Viewport mobile

- GIVEN un viewport di 375×667
- WHEN la dashboard è renderizzata
- THEN non è presente scroll orizzontale a livello di pagina
- AND KPI card e grafici sono impilati e leggibili

#### Scenario: Viewport desktop

- GIVEN un viewport ≥ 1280px
- WHEN la dashboard è renderizzata
- THEN il layout usa la griglia con gerarchia: KPI in alto, distribuzione/flusso al centro, trend sotto
