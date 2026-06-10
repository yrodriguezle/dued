# Delta for Affidabilità Frontend

**Change**: qualita-fase4
**Date**: 2026-06-10
**Status**: Draft

> Nota: questa delta NON modifica lo schema GraphQL né il comportamento funzionale
> visibile (refactor conservativi). Dominio nuovo: tutte le requirement sono ADDED.
>
> Stato attuale verificato nel codice:
> - `src/components/common/ErrorBoundary.tsx` esiste (full-screen, reset via
>   `window.location.href`/`reload`) ed è montato solo al top-level in `src/routes/Root.tsx`.
>   Un crash in una pagina smonta l'intera shell (Layout, sidebar, header).
> - `src/graphql/common/useFetchData.tsx`: `fetchItems` (riga 40) hardcoda
>   `fetchPolicy: "cache-first"` ignorando il parametro (default `"network-only"`);
>   `setFetchingMore(false)` esiste solo nel ramo error di `subscribeToMore`;
>   il cleanup dell'effetto di fetch (riga 118) cancella solo il timeout, non la
>   subscription corrente.
> - `src/graphql/configureClient.tsx` (righe 158-191): i campi Query `connection`,
>   `gestioneCassa`, `chiusureMensili` usano `keyArgs: false` + merge shallow
>   `{ ...existing, ...incoming }`.
> - Sync settings frammentata: `SettingsDetails.tsx` (parsing inline in `onCompleted`),
>   `GiorniNonLavorativiSection.tsx` (`readQuery ... as any`),
>   `PeriodoProgrammazioneSection.tsx` (solo refetch), `useSettingsSync.tsx`
>   (unico che usa già `parseSettingsFromRaw`).

## ADDED Requirements

### Requirement: Isolamento per-route degli errori di rendering

Il sistema MUST avvolgere ogni elemento di route renderizzato dentro il `Layout` di
`ProtectedRoutes.tsx` (sia le route statiche sia quelle dinamiche generate dai menu)
in un error boundary per-route. Un errore di rendering in una pagina MUST essere
contenuto nella sola area contenuto: la shell applicativa (sidebar, header, layout)
MUST restare montata e funzionante. Il boundary top-level esistente in `Root.tsx`
MUST restare attivo come ultima rete per gli errori fuori dall'area contenuto.

#### Scenario: Crash di una pagina non smonta la shell

- GIVEN un utente autenticato sulla pagina di una route protetta
- WHEN il componente pagina lancia un errore durante il rendering
- THEN nell'area contenuto compare il fallback di errore
- AND la sidebar e l'header restano visibili e interattivi
- AND l'utente può aprire il menu e navigare verso un'altra route senza ricaricare la pagina

#### Scenario: Crash al mount, navigazione altrove e ritorno

- GIVEN una route il cui componente crasha immediatamente al mount
- WHEN l'utente apre quella route, poi naviga verso un'altra route, poi torna alla route che crashava
- THEN durante la navigazione intermedia l'altra pagina viene renderizzata normalmente (nessun fallback residuo)
- AND al ritorno il rendering della pagina viene ritentato da zero (se l'errore persiste, ricompare il fallback; la shell resta sempre funzionante)

#### Scenario: Errore fuori dall'area contenuto

- GIVEN un errore di rendering sollevato fuori dalle route protette (es. nella shell stessa)
- WHEN l'errore si propaga
- THEN viene catturato dal boundary top-level esistente in `Root.tsx` (comportamento attuale invariato)

### Requirement: Fallback per-route con messaggio e retry

Il fallback per-route MUST mostrare un messaggio di errore in italiano e un'azione di
retry. Il retry MUST ritentare il rendering della sola pagina, senza ricaricare
l'intera applicazione (nessun `window.location.reload`/redirect forzato) e senza
perdere lo stato della shell (autenticazione, store, sidebar).

#### Scenario: Retry dopo errore transitorio

- GIVEN il fallback per-route visualizzato a seguito di un errore transitorio
- WHEN l'utente attiva l'azione di retry
- THEN il componente pagina viene rimontato e, se l'errore non si ripresenta, la pagina viene renderizzata normalmente
- AND non avviene alcun reload del documento

#### Scenario: Retry con errore persistente

- GIVEN il fallback per-route visualizzato a seguito di un errore deterministico
- WHEN l'utente attiva l'azione di retry
- THEN il fallback viene mostrato di nuovo
- AND la shell resta funzionante

### Requirement: Reset del boundary al cambio di route

Lo stato di errore del boundary per-route MUST essere azzerato automaticamente al
cambio di route: la navigazione verso un percorso diverso MUST renderizzare la nuova
pagina senza fallback residuo, anche se la route precedente era in stato di errore.

#### Scenario: La navigazione azzera lo stato di errore

- GIVEN il fallback per-route visualizzato sulla route A
- WHEN l'utente naviga verso la route B dalla sidebar
- THEN la pagina B viene renderizzata normalmente (il boundary non mostra il fallback della route A)

### Requirement: useFetchData rispetta il parametro fetchPolicy

L'hook `useFetchData` MUST usare il parametro `fetchPolicy` ricevuto in tutte le
operazioni che esegue, incluso il callback `fetchItems`, che MUST NOT hardcodare
`cache-first`. Il valore di default del parametro MUST restare `"network-only"`
(comportamento del `watchQuery` di prima pagina invariato). I chiamanti MAY passare
esplicitamente `"cache-first"` (o altre policy) dove richiesto.

#### Scenario: Default invariato

- GIVEN un componente che usa `useFetchData` senza specificare `fetchPolicy`
- WHEN viene eseguito il fetch della prima pagina o `fetchItems`
- THEN la richiesta usa la policy `network-only` (i dati arrivano dalla rete, non dalla sola cache)

#### Scenario: cache-first esplicito ancora possibile

- GIVEN un componente che passa `fetchPolicy: "cache-first"` a `useFetchData`
- WHEN viene invocato `fetchItems` con dati già presenti in cache per quella query e quelle variabili
- THEN la risposta viene servita dalla cache senza una nuova richiesta di rete

### Requirement: fetchingMore resettato al completamento del caricamento

Lo stato `fetchingMore` di `useFetchData` MUST tornare `false` al termine di ogni
invocazione di `subscribeToMore`, sia in caso di successo sia in caso di errore.

#### Scenario: Reset dopo caricamento riuscito

- GIVEN una lista paginata con `hasMore` true
- WHEN `subscribeToMore` completa con successo il caricamento della pagina successiva
- THEN i nuovi item vengono accodati
- AND `fetchingMore` vale `false`

#### Scenario: Reset dopo errore (comportamento esistente preservato)

- GIVEN una lista paginata con `hasMore` true
- WHEN `subscribeToMore` fallisce con un errore di rete
- THEN `fetchingMore` vale `false`
- AND la promise risolve con il risultato vuoto (comportamento attuale invariato)

### Requirement: Ciclo di vita delle subscription di useFetchData senza leak

Il cleanup dell'effetto di fetch di `useFetchData` MUST annullare (unsubscribe) la
subscription corrente, oltre al timeout di debounce. Tra esecuzioni consecutive
dell'effetto (cambio di `query`/`variables`/`fetchPolicy`) MUST essere attiva al più
una subscription di prima pagina; all'unmount del componente MUST NOT restare
subscription attive né aggiornamenti di stato pendenti.

#### Scenario: Cambio rapido di variabili senza subscription orfane

- GIVEN un componente che usa `useFetchData` con un filtro
- WHEN le variabili cambiano più volte in rapida successione
- THEN solo la subscription dell'ultima esecuzione resta attiva
- AND i risultati delle esecuzioni precedenti non aggiornano lo stato (nessun dato stantio renderizzato)

#### Scenario: Unmount durante un fetch in corso

- GIVEN un fetch di prima pagina in corso
- WHEN il componente viene smontato
- THEN la subscription viene annullata
- AND non avvengono aggiornamenti di stato dopo l'unmount (nessun warning React, nessun leak)

### Requirement: Entry di cache Apollo distinte per variabili discriminanti

Le type policy dei campi Query `connection`, `gestioneCassa` e `chiusureMensili` in
`configureClient.tsx` MUST usare `keyArgs` che discriminano le entry di cache in base
alle variabili che identificano davvero la query (mappa campo→keyArgs definita nel
design). Due query dello stesso campo con argomenti discriminanti diversi MUST NOT
condividere la stessa entry di cache né sovrascriversi a vicenda. Il comportamento
osservabile dei dati renderizzati MUST restare invariato.

#### Scenario: Due liste con variabili diverse coesistono

- GIVEN una query di lista eseguita con filtro X e la stessa query eseguita con filtro Y
- WHEN entrambe le risposte sono in cache
- THEN ciascuna mantiene la propria entry di cache
- AND rileggere la query con filtro X restituisce i dati di X (non quelli di Y)

#### Scenario: Comportamento invariato dei flussi esistenti

- GIVEN i flussi cassa, chiusure mensili e liste connection esistenti
- WHEN si naviga e si ricaricano i dati dopo la modifica delle policy
- THEN i dati renderizzati sono identici a prima (verifica manuale documentata, possibilità di rollback per singolo campo)

### Requirement: Merge di cache non distruttivo

Le funzioni di merge delle policy di `connection`, `gestioneCassa` e `chiusureMensili`
MUST NOT perdere dati annidati: quando `incoming` contiene un sottoinsieme dei campi
di `existing`, i dati già presenti e non sostituiti MUST essere preservati, oppure la
sostituzione integrale MUST essere intenzionale e documentata per quel campo.

#### Scenario: Refetch parziale non cancella gli array annidati

- GIVEN una entry di cache con un oggetto che contiene array annidati (es. denominazioni, dettagli)
- WHEN arriva un `incoming` che non include quegli array
- THEN i dati annidati preesistenti non vengono persi dal merge
- AND le query attive che li selezionano continuano a riceverli

### Requirement: Percorso unico di sincronizzazione settings Apollo→Zustand

Il sistema MUST avere un unico percorso di sincronizzazione dei settings da Apollo
allo store Zustand, basato su `parseSettingsFromRaw`. Tutti i punti che oggi
sincronizzano i settings (`SettingsDetails`, `GiorniNonLavorativiSection`,
`PeriodoProgrammazioneSection`, `useSettingsSync`) MUST passare da questo percorso:
il parsing inline duplicato e la lettura `readQuery ... as any` MUST essere eliminati.
Ogni percorso MUST produrre nello store la stessa shape normalizzata (orari troncati
a `HH:mm`, `operatingDays`/`giorniOperativi` come array di boolean).

#### Scenario: Shape normalizzata identica da ogni percorso

- GIVEN dati settings raw provenienti da una mutation, da una subscription o dal bootstrap
- WHEN vengono sincronizzati nello store
- THEN lo store contiene la stessa shape normalizzata in tutti i casi
- AND `operatingDays` è sempre un array di boolean (mai una stringa JSON)

### Requirement: Store aggiornato dopo ogni mutation settings senza reload

Dopo ogni mutation sui settings (business settings, periodi di programmazione, giorni
non lavorativi) lo store Zustand MUST riflettere i nuovi valori senza ricaricare la
pagina: `isOpen()`, `isOpenNow()` e `getNextOperatingDate()` MUST restituire risultati
coerenti con i dati appena salvati immediatamente dopo il completamento della mutation.

#### Scenario: Modifica dei giorni operativi

- GIVEN il negozio configurato come aperto il lunedì
- WHEN l'utente salva i settings disattivando il lunedì
- THEN subito dopo il salvataggio `isOpen()` per un lunedì restituisce `false` senza reload
- AND `getNextOperatingDate()` salta i lunedì

#### Scenario: Aggiunta di un giorno non lavorativo

- GIVEN una data operativa secondo i periodi correnti
- WHEN l'utente aggiunge quella data come giorno non lavorativo e la mutation completa
- THEN `isOpen()` per quella data restituisce `false` senza reload

#### Scenario: Modifica di un periodo di programmazione

- GIVEN un periodo di programmazione attivo
- WHEN l'utente modifica i giorni operativi o gli orari del periodo e la mutation completa
- THEN `isOpen()` e `isOpenNow()` riflettono immediatamente il periodo aggiornato
