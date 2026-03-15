# Searchbox Specification

## Purpose

Il componente Searchbox e' un widget di ricerca generico riutilizzabile in tutta l'applicazione per selezionare entita' (fornitori, utenti, ruoli, menu, fatture acquisto). Questa specifica definisce il comportamento corretto del filtraggio, della visualizzazione dei risultati e dell'interazione utente.

---

## Requirements

---

### REQ-SB-001: Costruzione clausola WHERE con operatore AND

Il sistema DEVE combinare `regularWhere` e `additionalWhere` con l'operatore logico **AND** (non OR). Questo garantisce che i risultati soddisfino sia il filtro di ricerca testuale sia qualsiasi condizione aggiuntiva fornita dalla configurazione.

(Precedentemente: le clausole venivano combinate con OR, causando risultati irrilevanti)

#### Scenario: Ricerca con additionalWhere presente

- GIVEN una Searchbox configurata con `additionalWhere = "fornitore.attivo = 1"`
- WHEN l'utente digita "Mar" nel campo di ricerca
- THEN la clausola WHERE generata DEVE essere `(fornitore.ragioneSociale LIKE "%Mar%") AND (fornitore.attivo = 1)`
- AND i risultati DEVONO soddisfare entrambe le condizioni contemporaneamente

#### Scenario: Ricerca senza additionalWhere

- GIVEN una Searchbox configurata senza `additionalWhere`
- WHEN l'utente digita "Mar" nel campo di ricerca
- THEN la clausola WHERE generata DEVE contenere solo il filtro testuale senza parentesi aggiuntive
- AND la clausola DEVE essere `fornitore.ragioneSociale LIKE "%Mar%"`

#### Scenario: additionalWhere con stringa vuota

- GIVEN una Searchbox configurata con `additionalWhere = ""`
- WHEN l'utente digita "Mar" nel campo di ricerca
- THEN la clausola WHERE generata DEVE contenere solo il filtro testuale
- AND il risultato DEVE essere identico al caso senza `additionalWhere`

---

### REQ-SB-002: Filtraggio progressivo con parole multiple

Il sistema DEVE supportare il filtraggio progressivo: digitando piu' parole separate da spazi, ogni parola aggiunge una condizione AND sulla stessa colonna, restringendo i risultati.

#### Scenario: Ricerca con singola parola

- GIVEN una Searchbox con `tableName = "fornitore"` e `fieldName = "ragioneSociale"`
- WHEN l'utente digita "Mar"
- THEN la clausola WHERE generata DEVE essere `fornitore.ragioneSociale LIKE "%Mar%"`

#### Scenario: Ricerca con due parole

- GIVEN una Searchbox con `tableName = "fornitore"` e `fieldName = "ragioneSociale"`
- WHEN l'utente digita "Mar Ros"
- THEN la clausola WHERE generata DEVE essere `fornitore.ragioneSociale LIKE "%Mar%" AND fornitore.ragioneSociale LIKE "%Ros%"`

#### Scenario: Ricerca con tre parole

- GIVEN una Searchbox con `tableName = "fornitore"` e `fieldName = "ragioneSociale"`
- WHEN l'utente digita "Mar Ros Srl"
- THEN la clausola WHERE generata DEVE contenere tre condizioni AND
- AND ogni parola DEVE essere racchiusa in `LIKE "%parola%"`

#### Scenario: Input con spazi extra

- GIVEN una Searchbox attiva
- WHEN l'utente digita "  Mar   Ros  " (con spazi extra)
- THEN il sistema DEVE trimmere l'input e splittare solo sugli spazi significativi
- AND la clausola WHERE DEVE trattare solo le parole non vuote

---

### REQ-SB-003: Input vuoto non genera query

Il sistema DEVE saltare l'esecuzione della query GraphQL quando l'input e' vuoto o contiene solo spazi.

#### Scenario: Input vuoto

- GIVEN una Searchbox senza testo digitato
- WHEN il componente viene renderizzato
- THEN il sistema NON DEVE eseguire alcuna query GraphQL (skip = true)
- AND la clausola WHERE generata DEVE essere una stringa vuota

#### Scenario: Input con soli spazi

- GIVEN una Searchbox
- WHEN l'utente digita "   " (solo spazi)
- THEN il sistema NON DEVE eseguire alcuna query GraphQL (skip = true)
- AND il dropdown dei risultati NON DEVE essere visibile

---

### REQ-SB-004: Visualizzazione dropdown risultati

Il sistema DEVE mostrare il dropdown dei risultati quando l'utente digita testo non vuoto, e nasconderlo quando l'input e' vuoto.

#### Scenario: Digitazione attiva il dropdown

- GIVEN una Searchbox con dropdown nascosto
- WHEN l'utente digita almeno un carattere non spazio
- THEN il dropdown dei risultati DEVE diventare visibile

#### Scenario: Cancellazione testo nasconde il dropdown

- GIVEN una Searchbox con dropdown visibile e testo "Mar"
- WHEN l'utente cancella tutto il testo
- THEN il dropdown dei risultati DEVE essere nascosto

#### Scenario: Dropdown con risultati mostra la griglia AG Grid

- GIVEN una Searchbox con dropdown visibile
- WHEN la query restituisce uno o piu' risultati
- THEN il sistema DEVE mostrare una griglia AG Grid con i risultati
- AND la griglia DEVE usare selezione singola (`singleRow`)

---

### REQ-SB-005: Messaggio "Nessun risultato trovato"

Il sistema DEVE mostrare il messaggio "Nessun risultato trovato" quando la query non restituisce risultati e l'input ha piu' di 2 caratteri.

#### Scenario: Nessun risultato con input lungo

- GIVEN una Searchbox con dropdown visibile
- WHEN l'utente digita "xyz123nonsense" (testo senza corrispondenze)
- AND la query restituisce 0 risultati
- AND il caricamento e' completato (loading = false)
- THEN il sistema DEVE mostrare il messaggio "Nessun risultato trovato"

#### Scenario: Input corto senza risultati non mostra messaggio

- GIVEN una Searchbox con dropdown visibile
- WHEN l'utente digita "xy" (2 caratteri)
- AND la query restituisce 0 risultati
- THEN il sistema NON DEVE mostrare il messaggio "Nessun risultato trovato"
- AND il sistema DEVE mostrare la griglia (anche se vuota)

#### Scenario: Loading in corso non mostra messaggio

- GIVEN una Searchbox con dropdown visibile e input "xyz123"
- WHEN la query e' ancora in corso (loading = true)
- THEN il sistema NON DEVE mostrare il messaggio "Nessun risultato trovato"

---

### REQ-SB-006: Selezione elemento dal dropdown

Il sistema DEVE supportare la selezione di un elemento tramite doppio click nella griglia o tramite tasto Enter.

#### Scenario: Selezione con doppio click

- GIVEN una Searchbox con dropdown visibile e risultati
- WHEN l'utente fa doppio click su una riga della griglia
- THEN il campo di testo DEVE aggiornarsi con il valore dell'elemento selezionato
- AND il callback `onSelectItem` DEVE essere invocato con l'elemento selezionato
- AND il dropdown DEVE chiudersi

#### Scenario: Selezione con Enter nella griglia

- GIVEN una Searchbox con dropdown visibile e una riga selezionata nella griglia
- WHEN l'utente preme Enter
- THEN il campo di testo DEVE aggiornarsi con il valore dell'elemento selezionato
- AND il callback `onSelectItem` DEVE essere invocato
- AND il dropdown DEVE chiudersi

#### Scenario: Auto-selezione con Enter su match esatto

- GIVEN una Searchbox con dropdown visibile
- AND l'utente ha digitato un testo che corrisponde esattamente (case-insensitive) a un elemento
- WHEN l'utente preme Enter nel campo di testo
- THEN il sistema DEVE selezionare automaticamente l'elemento corrispondente
- AND il dropdown DEVE chiudersi

#### Scenario: Auto-selezione con Tab su match esatto

- GIVEN una Searchbox con dropdown visibile
- AND l'utente ha digitato un testo che corrisponde esattamente (case-insensitive) a un elemento
- WHEN l'utente preme Tab nel campo di testo
- THEN il sistema DEVE selezionare automaticamente l'elemento corrispondente
- AND il dropdown DEVE chiudersi

#### Scenario: Enter senza match esatto non seleziona

- GIVEN una Searchbox con testo "Mar" che non corrisponde esattamente a nessun elemento
- WHEN l'utente preme Enter nel campo di testo
- THEN il sistema NON DEVE selezionare alcun elemento
- AND il dropdown DEVE rimanere visibile (non c'e' match esatto)

---

### REQ-SB-007: Navigazione tastiera

Il sistema DEVE supportare la navigazione tastiera per un'esperienza utente efficiente.

#### Scenario: ArrowDown sposta il focus alla griglia

- GIVEN una Searchbox con dropdown visibile e risultati
- WHEN l'utente preme ArrowDown nel campo di testo
- THEN il focus DEVE spostarsi alla prima riga della griglia risultati
- AND la prima riga DEVE essere selezionata

#### Scenario: Escape chiude il dropdown

- GIVEN una Searchbox con dropdown visibile
- WHEN l'utente preme Escape
- THEN il dropdown DEVE chiudersi
- AND l'evento Escape DEVE essere fermato (stopPropagation) per non propagarsi

#### Scenario: Tab chiude il dropdown

- GIVEN una Searchbox con dropdown visibile
- WHEN l'utente preme Tab
- THEN il dropdown DEVE chiudersi

---

### REQ-SB-008: Click esterno chiude il dropdown

Il sistema DEVE chiudere il dropdown quando l'utente clicca fuori dal componente Searchbox.

#### Scenario: Click fuori dal componente

- GIVEN una Searchbox con dropdown visibile
- WHEN l'utente clicca su un elemento fuori dal container della Searchbox
- THEN il dropdown DEVE chiudersi

#### Scenario: Click dentro il componente non chiude

- GIVEN una Searchbox con dropdown visibile
- WHEN l'utente clicca all'interno del container della Searchbox (es. sulla griglia)
- THEN il dropdown NON DEVE chiudersi

---

### REQ-SB-009: Sincronizzazione con valore esterno

Il sistema DEVE sincronizzare il valore interno del campo con la prop `value` esterna.

#### Scenario: Aggiornamento valore esterno

- GIVEN una Searchbox con valore iniziale "Mario"
- WHEN la prop `value` cambia a "Luigi" dall'esterno
- THEN il campo di testo DEVE aggiornarsi mostrando "Luigi"

#### Scenario: Valore esterno null o undefined

- GIVEN una Searchbox con valore "Mario"
- WHEN la prop `value` cambia a stringa vuota
- THEN il campo di testo DEVE aggiornarsi mostrando stringa vuota

---

### REQ-SB-010: Modale espansione

Il sistema DEVE fornire una modale fullscreen per la selezione da un elenco completo di elementi (senza filtro testuale).

#### Scenario: Apertura modale

- GIVEN una Searchbox con pulsante expand visibile
- WHEN l'utente clicca il pulsante expand (icona ExpandMore)
- THEN la modale DEVE aprirsi
- AND il dropdown DEVE chiudersi (se era visibile)
- AND la modale DEVE caricare fino a 100 elementi senza filtro testuale

#### Scenario: Selezione da modale

- GIVEN la modale aperta con una lista di elementi
- WHEN l'utente fa doppio click su un elemento nella modale
- THEN l'elemento DEVE essere selezionato
- AND il campo di testo DEVE aggiornarsi
- AND la modale DEVE chiudersi

#### Scenario: Chiusura modale

- GIVEN la modale aperta
- WHEN l'utente chiude la modale (pulsante X o Escape)
- THEN la modale DEVE chiudersi
- AND il campo di testo NON DEVE cambiare

---

### REQ-SB-011: Indicatore di caricamento

Il sistema DEVE mostrare un indicatore di caricamento (spinner) durante il fetch dei dati.

#### Scenario: Loading spinner durante query

- GIVEN una Searchbox con una query in corso
- WHEN loading = true
- THEN il sistema DEVE mostrare un `CircularProgress` al posto del pulsante expand
- AND il pulsante expand NON DEVE essere visibile

#### Scenario: Fine caricamento ripristina pulsante

- GIVEN una Searchbox con loading spinner visibile
- WHEN il caricamento termina (loading = false)
- THEN il sistema DEVE nascondere il CircularProgress
- AND il pulsante expand DEVE riapparire

---

### REQ-SB-012: Debounce delle query

Il sistema DEVE applicare un debounce di 300ms alle query GraphQL per evitare richieste eccessive durante la digitazione rapida.

#### Scenario: Digitazione rapida con debounce

- GIVEN una Searchbox attiva
- WHEN l'utente digita "Mario" rapidamente (meno di 300ms tra un tasto e l'altro)
- THEN il sistema DEVE eseguire la query GraphQL solo dopo 300ms dall'ultimo tasto premuto
- AND NON DEVE eseguire query intermedie per "M", "Ma", "Mar", "Mari"

---

### REQ-SB-013: Costruzione body della query

Il sistema DEVE costruire il body della query GraphQL in base alla modalita' (dropdown o modale).

#### Scenario: Body per dropdown

- GIVEN una Searchbox in modalita' dropdown (modal = false)
- WHEN viene costruita la query
- THEN il body DEVE contenere i campi definiti in `options.items[].field`

#### Scenario: Body per modale

- GIVEN una Searchbox in modalita' modale (modal = true)
- WHEN viene costruita la query
- THEN il body DEVE contenere i campi definiti in `options.modal.items[].field`
- AND il pageSize DEVE essere 100

---

### REQ-SB-014: Container ridimensionabile

Il sistema SHOULD supportare un container dei risultati ridimensionabile per adattarsi al contenuto.

#### Scenario: Container si adatta al contenuto

- GIVEN una Searchbox con dropdown visibile
- WHEN i risultati vengono visualizzati
- THEN il container DEVE posizionarsi sotto il campo di input
- AND DEVE avere un'elevazione (shadow) per distinguersi dal contenuto sottostante

---

### REQ-SB-015: Integrazione Formik

Il sistema DEVE integrarsi con Formik tramite il wrapper `FormikSearchbox`.

#### Scenario: FormikSearchbox riflette errori di validazione

- GIVEN un FormikSearchbox all'interno di un form Formik
- WHEN il campo viene toccato e la validazione fallisce
- THEN il campo DEVE mostrare lo stato di errore

#### Scenario: FormikSearchbox rispetta stato disabled

- GIVEN un FormikSearchbox con prop `disabled = true`
- WHEN il componente viene renderizzato
- THEN il campo di testo DEVE essere disabilitato
- AND il pulsante expand DEVE essere disabilitato

---

## Scenari E2E

Questi scenari sono progettati per test Playwright su pagine reali dell'applicazione.

---

### REQ-E2E-001: Flusso completo ricerca e selezione

Il sistema DEVE permettere il flusso completo di ricerca e selezione di un elemento su una pagina reale.

#### Scenario: E2E - Ricerca e selezione fornitore

- GIVEN l'utente e' autenticato e si trova su una pagina con un campo Searchbox fornitore
- WHEN l'utente digita le prime lettere del nome di un fornitore esistente
- THEN il dropdown DEVE apparire con i risultati filtrati
- AND l'utente DEVE poter fare doppio click su un risultato per selezionarlo
- AND il campo DEVE aggiornarsi con il valore selezionato
- AND il dropdown DEVE chiudersi

#### Scenario: E2E - Ricerca e selezione con tastiera

- GIVEN l'utente e' autenticato e si trova su una pagina con un campo Searchbox
- WHEN l'utente digita testo e preme ArrowDown per navigare nella griglia
- AND preme Enter su un risultato
- THEN l'elemento DEVE essere selezionato
- AND il campo DEVE aggiornarsi

---

### REQ-E2E-002: Filtraggio progressivo end-to-end

Il sistema DEVE restringere progressivamente i risultati man mano che l'utente digita.

#### Scenario: E2E - I risultati diminuiscono progressivamente

- GIVEN l'utente e' autenticato e si trova su una pagina con Searchbox
- WHEN l'utente digita una lettera nel Searchbox
- THEN il dropdown DEVE mostrare un certo numero di risultati (N)
- WHEN l'utente digita una seconda lettera
- THEN il numero di risultati DEVE essere <= N (uguale o inferiore)
- WHEN l'utente digita una terza lettera
- THEN il numero di risultati DEVE essere <= al numero precedente

#### Scenario: E2E - Parole multiple restringono ulteriormente

- GIVEN l'utente e' autenticato e il Searchbox mostra risultati per "Mar"
- WHEN l'utente aggiunge uno spazio e digita "Ros" (input diventa "Mar Ros")
- THEN i risultati DEVONO essere un sottoinsieme dei risultati precedenti
- AND ogni risultato DEVE contenere sia "Mar" che "Ros" nel campo di ricerca

---

### REQ-E2E-003: Griglia vuota end-to-end

Il sistema DEVE mostrare il messaggio di assenza risultati quando non ci sono corrispondenze.

#### Scenario: E2E - Nessun risultato per testo inesistente

- GIVEN l'utente e' autenticato e si trova su una pagina con Searchbox
- WHEN l'utente digita un testo lungo senza corrispondenze (es. "zzzznonexistent999")
- THEN il sistema DEVE mostrare il messaggio "Nessun risultato trovato"
- AND la griglia AG Grid NON DEVE essere visibile

#### Scenario: E2E - Testo corto senza risultati non mostra messaggio

- GIVEN l'utente e' autenticato e si trova su una pagina con Searchbox
- WHEN l'utente digita "zz" (2 caratteri, nessun risultato)
- THEN il sistema NON DEVE mostrare il messaggio "Nessun risultato trovato"

---

### REQ-E2E-004: Modale end-to-end

Il sistema DEVE supportare l'apertura della modale e la selezione di un elemento da essa.

#### Scenario: E2E - Apertura e selezione da modale

- GIVEN l'utente e' autenticato e si trova su una pagina con Searchbox
- WHEN l'utente clicca il pulsante di espansione (icona freccia giu')
- THEN la modale DEVE aprirsi con una lista completa di elementi
- WHEN l'utente fa doppio click su un elemento nella modale
- THEN la modale DEVE chiudersi
- AND il campo Searchbox DEVE contenere il valore selezionato

---

### REQ-E2E-005: Chiusura dropdown end-to-end

Il sistema DEVE chiudere il dropdown con interazioni standard.

#### Scenario: E2E - Escape chiude il dropdown

- GIVEN l'utente e' autenticato e il Searchbox mostra risultati
- WHEN l'utente preme il tasto Escape
- THEN il dropdown DEVE chiudersi
- AND il testo nel campo DEVE rimanere invariato

#### Scenario: E2E - Click esterno chiude il dropdown

- GIVEN l'utente e' autenticato e il Searchbox mostra risultati
- WHEN l'utente clicca su un'area della pagina fuori dal Searchbox
- THEN il dropdown DEVE chiudersi

---

### REQ-E2E-006: Loading spinner end-to-end

Il sistema SHOULD mostrare un indicatore di caricamento durante le query.

#### Scenario: E2E - Spinner visibile durante caricamento

- GIVEN l'utente e' autenticato e si trova su una pagina con Searchbox
- WHEN l'utente inizia a digitare
- THEN un indicatore di caricamento (spinner) DOVREBBE apparire brevemente
- AND una volta completato il caricamento, i risultati DEVONO apparire
