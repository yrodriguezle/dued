# Searchbox UI Specification

## Purpose

Specifica i requisiti comportamentali del componente Searchbox relativi a debounce delle query, visualizzazione dei risultati vuoti e navigazione da tastiera.

## Requirements

### Requirement: Debounce delle query GraphQL

Il sistema DEVE separare lo stato di input immediato (`innerValue`) dallo stato che alimenta la query GraphQL (`debouncedValue`), applicando un ritardo di debounce di 300ms.

Il sistema DEVE aggiornare il TextField immediatamente ad ogni keystroke (nessun ritardo percepito dall'utente).

Il sistema DEVE eseguire la query GraphQL solo dopo che l'utente ha smesso di digitare per almeno 300ms.

Il sistema DEVE annullare il timeout di debounce pendente quando il componente viene smontato o quando il valore cambia prima che il timeout scada.

Il sistema DEVE continuare a rispettare la soglia minima di 3 caratteri prima di eseguire la query (parametro `skip` di `useFetchData`).

#### Scenario: Digitazione rapida di 5 caratteri

- GIVEN il Searchbox e' montato e vuoto
- WHEN l'utente digita "Mario" in rapida successione (5 keystroke in meno di 300ms)
- THEN il TextField mostra "Mario" immediatamente dopo ogni keystroke
- AND una sola query GraphQL viene eseguita, 300ms dopo l'ultimo keystroke, con il valore "Mario"

#### Scenario: Digitazione lenta con pause

- GIVEN il Searchbox e' montato e vuoto
- WHEN l'utente digita "Ma", attende 400ms, poi digita "rio"
- THEN una prima query viene eseguita con "Ma" (ma viene skippata perche' < 3 caratteri)
- AND una seconda query viene eseguita 300ms dopo "rio" con il valore completo "Mario"

#### Scenario: Componente smontato durante il debounce

- GIVEN il Searchbox ha un timeout di debounce pendente
- WHEN il componente viene smontato (es. navigazione ad altra pagina)
- THEN il timeout viene cancellato
- AND nessuna query GraphQL viene eseguita

#### Scenario: Cancellazione rapida del testo

- GIVEN il Searchbox contiene "Mario" e una query e' stata eseguita
- WHEN l'utente cancella rapidamente tutto il testo
- THEN il TextField si svuota immediatamente
- AND la griglia dei risultati si nasconde (perche' `innerValue.trim().length` diventa 0)
- AND nessuna nuova query viene eseguita (il debounced value sotto soglia viene skippato)

---

### Requirement: Griglia sempre visibile con stato vuoto

Il sistema DEVE renderizzare il componente `ContainerGridResults` ogni volta che `resultsVisible` e' true, indipendentemente dal numero di risultati.

Il sistema DEVE NOT mostrare il Paper statico "Nessun risultato trovato" come elemento separato dalla griglia.

Il sistema DEVE mostrare un messaggio di stato vuoto ("Nessun risultato trovato") tramite il meccanismo overlay nativo di AG Grid (`overlayNoRowsTemplate` o `noRowsOverlayComponent`) quando la lista dei risultati e' vuota.

Il sistema DEVE mantenere la stessa dimensione e posizione della griglia sia con risultati sia senza.

#### Scenario: Ricerca senza risultati

- GIVEN il Searchbox e' visibile e l'utente ha digitato almeno 3 caratteri
- WHEN la query GraphQL restituisce 0 risultati
- THEN il componente `ContainerGridResults` e' visibile con altezza 30vh
- AND all'interno della griglia AG Grid viene mostrato il messaggio "Nessun risultato trovato" tramite l'overlay nativo
- AND il Paper statico separato NON viene renderizzato

#### Scenario: Ricerca con risultati dopo ricerca vuota

- GIVEN il Searchbox mostra la griglia con 0 risultati (overlay attivo)
- WHEN l'utente modifica il testo e la nuova query restituisce 3 risultati
- THEN l'overlay scompare
- AND le 3 righe vengono mostrate nella stessa griglia
- AND la dimensione del contenitore non cambia

#### Scenario: Risultati visibili durante il caricamento

- GIVEN il Searchbox mostra la griglia con risultati precedenti
- WHEN una nuova query e' in corso (loading = true)
- THEN la griglia resta visibile con i risultati precedenti
- AND l'indicatore di caricamento di AG Grid viene mostrato

---

### Requirement: Navigazione Arrow Up dalla griglia al textfield

Il sistema DEVE intercettare la pressione del tasto Arrow Up quando il focus e' sulla prima riga (rowIndex === 0) della griglia dei risultati.

Il sistema DEVE spostare il focus al TextField di input quando Arrow Up viene premuto dalla prima riga.

Il sistema DEVE deselezionare la riga corrente nella griglia quando il focus torna al textfield.

Il sistema DEVE NOT interferire con la navigazione Arrow Up standard di AG Grid quando il focus e' su righe successive alla prima (rowIndex > 0).

#### Scenario: Arrow Up dalla prima riga

- GIVEN la griglia dei risultati e' visibile con almeno 1 risultato
- AND il focus e' sulla prima riga della griglia (rowIndex === 0)
- WHEN l'utente preme Arrow Up
- THEN il focus si sposta al TextField di input del Searchbox
- AND la riga nella griglia viene deselezionata

#### Scenario: Arrow Up da riga non-prima

- GIVEN la griglia dei risultati e' visibile con almeno 3 risultati
- AND il focus e' sulla seconda riga della griglia (rowIndex === 1)
- WHEN l'utente preme Arrow Up
- THEN il focus si sposta alla prima riga (rowIndex === 0) tramite il comportamento standard di AG Grid
- AND il sistema non interviene

#### Scenario: Ciclo completo di navigazione tastiera

- GIVEN il Searchbox e' vuoto e montato
- WHEN l'utente digita "Mar" e attende i risultati
- AND preme Arrow Down per entrare nella griglia
- AND preme Arrow Down per scendere alla seconda riga
- AND preme Arrow Up per tornare alla prima riga
- AND preme Arrow Up di nuovo
- THEN il focus torna al TextField
- AND l'utente puo' continuare a digitare

#### Scenario: Arrow Up dalla prima riga senza risultati

- GIVEN la griglia dei risultati e' visibile ma con 0 risultati (overlay attivo)
- WHEN l'utente in qualche modo ha focus nella griglia e preme Arrow Up
- THEN il sistema non genera errori
- AND il comportamento e' neutro (nessuna riga da deselezionare)

---

### Requirement: Callback onNavigateBack nella catena dei componenti

Il sistema DEVE propagare un callback `onNavigateBack` dalla Searchbox attraverso `ContainerGridResults` fino a `GridResults`.

Il componente `Searchbox` DEVE fornire l'implementazione di `onNavigateBack` che invoca `inputRef.current?.focus()`.

Il componente `ContainerGridResults` DEVE accettare e propagare `onNavigateBack` come passthrough.

Il componente `GridResults` DEVE invocare `onNavigateBack` quando rileva Arrow Up su rowIndex === 0.

#### Scenario: Propagazione del callback

- GIVEN il componente Searchbox e' montato con risultati visibili
- WHEN la griglia interna riceve un evento Arrow Up su rowIndex === 0
- THEN il callback `onNavigateBack` viene invocato
- AND il focus si sposta al TextField del Searchbox
