# Ciclo DDT → Fattura Acquisto — Specification

## Purpose

Specifica il workflow di prelievo DDT aperti di un fornitore, associazione a una fattura di acquisto, ricalcolo automatico dei totali, e disassociazione. Copre il backend (query + mutation GraphQL) e il frontend (toolbar button + dialog di selezione).

---

## Dominio: Query DDT Aperti

### Requirement: Recupero DDT aperti per fornitore

Il sistema DEVE esporre una query GraphQL `documentiTrasportoAperti(fornitoreId)` che restituisce tutti i DDT con `FatturaId = null` appartenenti al fornitore specificato.

La query DEVE richiedere autenticazione.

I risultati DEVONO essere ordinati per `DataDdt` decrescente (piu recenti prima).

#### Scenario: DDT aperti esistenti per il fornitore

- GIVEN il fornitore con ID 10 ha 5 DDT, di cui 3 con `FatturaId = null`
- WHEN si esegue la query `documentiTrasportoAperti(fornitoreId: 10)`
- THEN il sistema restituisce esattamente 3 DDT
- AND ogni DDT contiene: `ddtId`, `numeroDdt`, `dataDdt`, `importo`, `note`

#### Scenario: Nessun DDT aperto per il fornitore

- GIVEN il fornitore con ID 20 ha DDT ma tutti gia associati a fatture
- WHEN si esegue la query `documentiTrasportoAperti(fornitoreId: 20)`
- THEN il sistema restituisce una lista vuota

#### Scenario: Fornitore senza DDT

- GIVEN il fornitore con ID 30 non ha nessun DDT nel sistema
- WHEN si esegue la query `documentiTrasportoAperti(fornitoreId: 30)`
- THEN il sistema restituisce una lista vuota

#### Scenario: Utente non autenticato

- GIVEN l'utente non e autenticato
- WHEN si esegue la query `documentiTrasportoAperti(fornitoreId: 10)`
- THEN il sistema restituisce errore `ACCESS_DENIED`

---

## Dominio: Associazione DDT a Fattura

### Requirement: Associazione batch DDT

Il sistema DEVE esporre una mutation GraphQL `associaDdtAFattura(fatturaId, ddtIds)` che associa uno o piu DDT a una fattura di acquisto in una singola transazione atomica.

La mutation DEVE:
- Settare `FatturaId` su ogni DDT specificato
- Verificare che ogni DDT abbia `FatturaId = null` (non gia associato)
- Verificare che ogni DDT appartenga allo stesso fornitore della fattura
- Ricalcolare il totale della fattura sommando gli importi di TUTTI i DDT associati (compresi quelli gia presenti)
- Restituire la fattura aggiornata con i DDT associati

La mutation DEVE richiedere autenticazione.

#### Scenario: Associazione di DDT aperti

- GIVEN una fattura con ID 100 per il fornitore 10
- AND 3 DDT aperti (ID: 1, 2, 3) del fornitore 10 con importi 100, 200, 150
- WHEN si esegue `associaDdtAFattura(fatturaId: 100, ddtIds: [1, 2, 3])`
- THEN i DDT 1, 2, 3 hanno `FatturaId = 100`
- AND il totale fattura e aggiornato a 450 (100 + 200 + 150)
- AND l'imponibile e l'IVA della fattura sono ricalcolati in base all'aliquota

#### Scenario: DDT gia associato a un'altra fattura

- GIVEN il DDT con ID 5 ha gia `FatturaId = 200`
- WHEN si esegue `associaDdtAFattura(fatturaId: 100, ddtIds: [5, 6])`
- THEN il sistema restituisce un errore indicando che il DDT 5 e gia associato
- AND nessun DDT viene modificato (rollback transazione)

#### Scenario: DDT di fornitore diverso

- GIVEN la fattura con ID 100 e del fornitore 10
- AND il DDT con ID 7 appartiene al fornitore 20
- WHEN si esegue `associaDdtAFattura(fatturaId: 100, ddtIds: [7])`
- THEN il sistema restituisce un errore indicando che il DDT non appartiene al fornitore della fattura
- AND nessun DDT viene modificato

#### Scenario: DDT con importo null

- GIVEN 2 DDT aperti: DDT 1 con importo 100, DDT 2 con importo null
- WHEN si esegue `associaDdtAFattura(fatturaId: 100, ddtIds: [1, 2])`
- THEN entrambi i DDT vengono associati
- AND il totale fattura e 100 (null trattato come 0)

#### Scenario: Aggiunta DDT a fattura con DDT gia associati

- GIVEN la fattura 100 ha gia DDT associati con importo totale 300
- AND 2 nuovi DDT aperti (ID: 10, 11) con importi 50, 75
- WHEN si esegue `associaDdtAFattura(fatturaId: 100, ddtIds: [10, 11])`
- THEN i nuovi DDT vengono associati
- AND il totale fattura e 425 (300 + 50 + 75)

---

### Requirement: Disassociazione DDT da Fattura

Il sistema DEVE esporre una mutation GraphQL `disassociaDdtDaFattura(ddtIds)` che rimuove l'associazione di uno o piu DDT dalla loro fattura.

La mutation DEVE:
- Settare `FatturaId = null` su ogni DDT specificato
- Ricalcolare il totale della fattura originale (sottraendo gli importi rimossi)
- Restituire la fattura aggiornata
- Operare in una singola transazione atomica

#### Scenario: Disassociazione di un DDT

- GIVEN la fattura 100 ha DDT associati: DDT 1 (importo 100), DDT 2 (importo 200), DDT 3 (importo 150)
- WHEN si esegue `disassociaDdtDaFattura(ddtIds: [2])`
- THEN il DDT 2 ha `FatturaId = null`
- AND il totale fattura e aggiornato a 250 (100 + 150)

#### Scenario: Disassociazione di tutti i DDT

- GIVEN la fattura 100 ha DDT associati: DDT 1 (importo 100), DDT 2 (importo 200)
- WHEN si esegue `disassociaDdtDaFattura(ddtIds: [1, 2])`
- THEN entrambi i DDT hanno `FatturaId = null`
- AND il totale fattura e aggiornato a 0

#### Scenario: DDT non associato a nessuna fattura

- GIVEN il DDT con ID 5 ha `FatturaId = null`
- WHEN si esegue `disassociaDdtDaFattura(ddtIds: [5])`
- THEN il sistema restituisce un errore indicando che il DDT non e associato a nessuna fattura

---

## Dominio: UI Prelievo DDT

### Requirement: Bottone Preleva DDT nella Toolbar

La pagina Fattura Acquisto DEVE mostrare un bottone "Preleva DDT" nella toolbar.

Il bottone DEVE essere visibile solo quando:
- La fattura e in modalita UPDATE (gia salvata, con `invoiceId` valido)
- Il form e sbloccato (non in `isFormLocked`)
- Un fornitore e selezionato (`fornitoreId > 0`)

Il bottone SHOULD avere un'icona che rappresenti il prelievo/importazione (es. `LocalShippingIcon` o `MoveToInboxIcon`).

#### Scenario: Bottone visibile in UPDATE con fornitore

- GIVEN l'utente ha aperto una fattura esistente (modalita UPDATE, form sbloccato)
- AND il fornitore "Rossi SRL" e selezionato
- WHEN la pagina viene renderizzata
- THEN il bottone "Preleva DDT" e visibile nella toolbar

#### Scenario: Bottone nascosto in INSERT

- GIVEN l'utente sta creando una nuova fattura (modalita INSERT)
- WHEN la pagina viene renderizzata
- THEN il bottone "Preleva DDT" NON e visibile

#### Scenario: Bottone nascosto con form bloccato

- GIVEN l'utente ha aperto una fattura esistente (modalita UPDATE, form bloccato)
- WHEN la pagina viene renderizzata
- THEN il bottone "Preleva DDT" NON e visibile

---

### Requirement: Dialog Selezione DDT

Al click su "Preleva DDT", il sistema DEVE aprire un dialog modale che mostra i DDT aperti del fornitore selezionato.

Il dialog DEVE:
- Mostrare una griglia con colonne: Numero DDT, Data DDT, Importo, Note
- Supportare selezione multipla tramite checkbox
- Mostrare il totale degli importi selezionati in tempo reale
- Avere un bottone "Conferma" (disabilitato se nessun DDT selezionato)
- Avere un bottone "Annulla" per chiudere senza azione

Il dialog SHOULD mostrare un messaggio quando non ci sono DDT aperti disponibili.

#### Scenario: Apertura dialog con DDT disponibili

- GIVEN la fattura e del fornitore "Rossi SRL" (ID: 10)
- AND il fornitore ha 3 DDT aperti
- WHEN l'utente clicca "Preleva DDT"
- THEN si apre il dialog con la griglia che mostra 3 DDT
- AND nessun DDT e selezionato
- AND il bottone "Conferma" e disabilitato

#### Scenario: Selezione DDT e aggiornamento totale

- GIVEN il dialog mostra 3 DDT con importi: 100, 200, 150
- WHEN l'utente seleziona DDT 1 (100) e DDT 3 (150)
- THEN il totale selezionato mostra 250.00
- AND il bottone "Conferma" e abilitato

#### Scenario: Conferma prelievo

- GIVEN l'utente ha selezionato 2 DDT nel dialog
- WHEN l'utente clicca "Conferma"
- THEN il sistema esegue la mutation `associaDdtAFattura`
- AND il dialog si chiude
- AND la fattura viene ricaricata con i nuovi DDT associati
- AND viene mostrato un toast di successo

#### Scenario: Nessun DDT disponibile

- GIVEN il fornitore non ha DDT aperti
- WHEN l'utente clicca "Preleva DDT"
- THEN il dialog mostra il messaggio "Nessun DDT aperto disponibile per questo fornitore"
- AND il bottone "Conferma" e disabilitato

#### Scenario: Errore durante l'associazione

- GIVEN l'utente ha selezionato DDT nel dialog
- WHEN l'utente clicca "Conferma" e la mutation fallisce
- THEN viene mostrato un toast di errore
- AND il dialog resta aperto
- AND la selezione e preservata

---

### Requirement: Disassociazione DDT dalla Griglia

Nella griglia DDT della fattura (gia esistente in modalita UPDATE), il sistema DEVE permettere di disassociare un DDT dalla fattura.

Il sistema SHOULD mostrare un'icona/bottone di rimozione su ogni riga DDT.

Prima della disassociazione, il sistema DEVE chiedere conferma all'utente.

#### Scenario: Disassociazione con conferma

- GIVEN la fattura ha 3 DDT associati nella griglia
- WHEN l'utente clicca il bottone di rimozione sul DDT 2
- THEN appare un dialog di conferma "Vuoi disassociare il DDT dalla fattura?"
- AND l'utente conferma
- THEN il sistema esegue la mutation `disassociaDdtDaFattura`
- AND la fattura viene ricaricata
- AND il DDT rimosso non appare piu nella griglia
- AND il totale fattura e ricalcolato

#### Scenario: Annullamento disassociazione

- GIVEN la fattura ha DDT associati
- WHEN l'utente clicca il bottone di rimozione su un DDT
- AND l'utente clicca "No" nel dialog di conferma
- THEN nessuna modifica viene effettuata

---

## Dominio: Ricalcolo Totali

### Requirement: Calcolo automatico totale da DDT

Quando i DDT vengono associati o disassociati, il sistema DEVE ricalcolare automaticamente:
- **Totale fattura**: somma degli importi di tutti i DDT associati (importo null = 0)
- **Imponibile**: totale / (1 + aliquotaIva / 100)
- **IVA**: totale - imponibile

Il sistema DEVE aggiornare i campi calcolati nella UI immediatamente dopo il reload della fattura.

#### Scenario: Ricalcolo dopo associazione

- GIVEN la fattura ha aliquota IVA al 22%
- AND vengono associati DDT con importi totali pari a 1220
- WHEN il sistema ricalcola
- THEN il totale fattura e 1220.00
- AND l'imponibile e 1000.00 (1220 / 1.22)
- AND l'IVA e 220.00

#### Scenario: Ricalcolo dopo disassociazione parziale

- GIVEN la fattura ha DDT associati per un totale di 1220 e aliquota 22%
- AND l'utente disassocia un DDT con importo 220
- WHEN il sistema ricalcola
- THEN il totale fattura e 1000.00
- AND l'imponibile e 819.67 (1000 / 1.22)
- AND l'IVA e 180.33
