# Delta for Sicurezza

> Change: `sicurezza-autorizzazione-graphql` — delta rispetto a `openspec/specs/sicurezza/specs.md`.
>
> **Change retroattiva.** Il codice è già scritto, testato e in albero: questa delta non descrive
> lavoro da fare, codifica il contratto che il codice già rispetta perché smetta di essere un
> aneddoto nei commit e diventi una regola verificabile. I requirement sono scritti al presente
> normativo.
>
> Il dominio `sicurezza` copriva finora l'esposizione degli errori GraphQL e la gestione dei
> secrets. Questa delta aggiunge l'asse mancante: **chi può raggiungere lo schema GraphQL, e con
> quale privilegio**. Nessun requirement esistente viene modificato o rimosso.

## Modifiche allo schema GraphQL

Nessuna modifica alla **forma** dello schema: nessun tipo, campo o argomento aggiunto, rinominato o
rimosso; nessuna migrazione database. Le modifiche riguardano esclusivamente:

- i **metadati di autorizzazione** applicati agli `ObjectGraphType` dei rami root (spostati dal
  livello di campo al livello di tipo, dove mancavano del tutto sono stati introdotti);
- la **pipeline di validazione** delle richieste (nuova validation rule sull'introspezione);
- la **policy CORS** dell'host, che non fa parte dello schema ma ne governa la raggiungibilità
  cross-origin.

Un client autenticato esistente non deve modificare una sola query per continuare a funzionare.

## ADDED Requirements

### Requirement: Autorizzazione di tipo su ogni ramo root dello schema GraphQL

L'endpoint `/graphql` è montato con `AuthorizationRequired = false`: la protezione è **interamente
per-campo**, quindi il default dello schema è *aperto* e un `ObjectGraphType` che nasce senza
autorizzazione è raggiungibile in anonimo da Internet.

Per questo ogni ramo root di `GraphQLQueries` e di `GraphQLMutations`, e il tipo
`GraphQLSubscriptions`, MUST richiedere un utente autenticato tramite autorizzazione dichiarata **a
livello di tipo** (`this.Authorize()` nel costruttore dell'`ObjectGraphType`), non sui singoli
campi. L'autorizzazione a livello di tipo è la forma normativa perché un campo aggiunto in seguito a
un modulo già protetto eredita la regola invece di doversela ricordare.

Quando il tipo è già protetto, un `.Authorize()` aggiuntivo sul singolo campo MUST NOT essere
presente: due regole sovrapposte sullo stesso resolver rendono ambiguo quale delle due stia
proteggendo davvero.

Una richiesta anonima verso un qualsiasi ramo root MUST essere rifiutata con un errore di
autorizzazione (`AccessDeniedError`, codice `ACCESS_DENIED`), e MUST NOT eseguire alcun resolver né
alcuna scrittura sul database.

L'autenticazione dell'utente per il ramo `authentication` MUST restare fuori dallo schema GraphQL:
il login avviene su `POST /api/auth/signin` (REST), quindi nessun campo GraphQL ha bisogno di essere
raggiungibile in anonimo.

#### Scenario: Richiesta anonima su un ramo root qualsiasi

- GIVEN una richiesta senza JWT valido (identità non autenticata)
- WHEN il client esegue `query { <ramo> { __typename } }` o `mutation { <ramo> { __typename } }` per un qualsiasi ramo root dello schema
- THEN la risposta contiene un errore di tipo `AccessDeniedError`
- AND nessun dato del ramo è presente nella risposta
- AND nessun resolver del ramo viene eseguito

#### Scenario: Escalation da anonimo su mutateUtente

- GIVEN una richiesta anonima
- WHEN il client esegue `mutation { authentication { mutateUtente(utente: { id: 1, ..., password: "pwned" }) { id } } }` puntando a un utente esistente (incluso il superadmin)
- THEN la mutation è rifiutata con `AccessDeniedError`
- AND `Hash` e `Salt` dell'utente bersaglio restano invariati
- AND il successivo `POST /api/auth/signin` con la password tentata fallisce

#### Scenario: Campo aggiunto a un modulo già protetto

- GIVEN un modulo root che dichiara l'autorizzazione a livello di tipo
- WHEN viene aggiunto un nuovo campo al modulo senza alcuna autorizzazione esplicita sul campo
- THEN il nuovo campo è comunque rifiutato in anonimo con `AccessDeniedError`
- AND non è necessaria alcuna dichiarazione aggiuntiva sul campo

#### Scenario: Subscription in anonimo

- GIVEN una connessione WebSocket senza utente autenticato
- WHEN il client sottoscrive un qualsiasi campo di `Subscription`
- THEN la sottoscrizione è rifiutata per mancata autorizzazione
- AND nessun evento del bus viene recapitato al client

### Requirement: Il contratto di autorizzazione è enumerato dallo schema, non da una lista

Il difetto originario non era il singolo modulo dimenticato: era che nulla impediva al modulo
successivo di ripetere l'errore. Per questo la suite di test backend MUST includere un test di
contratto che deriva i rami root **dallo schema costruito** (`schema.Query.Fields`,
`schema.Mutation.Fields`, `schema.Subscription.Fields`) e non da un elenco scritto a mano, e che
per ciascun ramo pretende il rifiuto in anonimo.

Il test MUST eseguire le query attraverso il vero motore di esecuzione GraphQL con la stessa catena
di validation rule registrata in produzione: verificare l'autorizzazione chiamando i resolver
direttamente salterebbe esattamente il livello che si vuole verificare.

Il rifiuto MUST essere verificato per **tipo di errore** (`AccessDeniedError`) e non per semplice
presenza di errori: un resolver che fallisce per altri motivi (argomento inesistente, entità non
trovata) non costituisce prova di autorizzazione.

#### Scenario: Modulo nuovo aggiunto senza autorizzazione

- GIVEN un nuovo modulo root registrato in `GraphQLQueries` o `GraphQLMutations` privo di autorizzazione di tipo
- WHEN la CI esegue la suite di test backend
- THEN il test di contratto enumera automaticamente anche il nuovo ramo
- AND il test fallisce indicando quale ramo risponde in anonimo
- AND nessun aggiornamento manuale di una lista di rami è stato necessario per ottenere la copertura

#### Scenario: Ramo che fallisce in anonimo ma non per autorizzazione

- GIVEN un ramo root che in anonimo solleva un errore diverso da quello di autorizzazione
- WHEN il test di contratto valuta la risposta
- THEN il test fallisce, perché la presenza di errori non è prova di negazione dell'accesso
- AND il messaggio di fallimento riporta gli errori effettivamente ricevuti

### Requirement: I dati pubblici si espongono via REST sotto /api/public/*

Un dato che deve essere raggiungibile senza login MUST NOT essere reso pubblico esentando il suo
ramo dal test di contratto tramite un'allowlist: un'eccezione nel test riapre il default aperto che
la change ha chiuso, e lo fa in un punto che nessuno rilegge.

Il dato pubblico MUST essere esposto come endpoint REST sotto il prefisso `/api/public/*`, dove la
superficie è chiusa per costruzione — è pubblico solo ciò che viene scritto esplicitamente lì —
invece che aperta per default come lo schema GraphQL. Questa è la via d'uscita prevista per il sito
vetrina, che avrà bisogno di leggere dati senza autenticazione.

Il test di contratto MUST NOT esporre alcun meccanismo di allowlist o di esenzione per ramo.

#### Scenario: Nuovo dato da pubblicare senza login

- GIVEN un requisito di prodotto che richiede un dato leggibile senza autenticazione (es. orari o listino per il sito vetrina)
- WHEN la funzionalità viene implementata
- THEN il dato è esposto da un endpoint REST sotto `/api/public/*`
- AND nessun ramo GraphQL viene esentato dall'autorizzazione
- AND il test di contratto continua a pretendere il rifiuto in anonimo su tutti i rami root

#### Scenario: Tentativo di esentare un ramo GraphQL

- GIVEN una modifica che aggiunge un'allowlist di rami esenti al test di contratto
- WHEN la modifica viene sottoposta a review
- THEN la modifica è rifiutata come violazione di questo requirement
- AND la correzione corretta è spostare il dato su `/api/public/*`

### Requirement: Il privilegio amministrativo è distinto dall'autenticazione

L'autorizzazione di tipo verifica **solo** che l'utente sia autenticato. Ruoli e menu governano chi
vede cosa nell'intera applicazione: le mutation sull'anagrafica `mutateRuolo`, `deleteRuolo`,
`mutateMenus` e `deleteMenus` MUST verificare, in aggiunta all'autenticazione, che il chiamante
appartenga a un ruolo con privilegi amministrativi, tramite
`GestioneCassaGuards.GuardUtenteAmministratore`.

Il privilegio MUST essere determinato dal flag `Ruolo.Amministratore` gestito dall'anagrafica ruoli,
e MUST NOT dipendere dal nome del ruolo: rinominare un ruolo non deve spostare i permessi.

Il controllo MUST precedere qualunque lettura o scrittura di dominio all'interno del resolver, così
che un rifiuto non lasci effetti collaterali.

Un chiamante autenticato ma privo del flag MUST ricevere un errore che indica esplicitamente la
mancanza di privilegi amministrativi, distinguibile dagli errori applicativi del resolver.

#### Scenario: Operatore tenta di modificare un ruolo

- GIVEN un utente autenticato il cui ruolo ha `Amministratore = false`
- WHEN esegue `mutateRuolo` sul proprio ruolo impostando `amministratore: true`
- THEN la mutation è rifiutata con un errore di privilegi amministrativi
- AND il flag `Amministratore` del ruolo resta invariato sul database

#### Scenario: Operatore tenta di modificare la navigazione

- GIVEN un utente autenticato non amministratore
- WHEN esegue `deleteMenus(ids: [...])` o `mutateMenus(menus: [...])`
- THEN l'operazione è rifiutata per mancanza di privilegi amministrativi
- AND il rifiuto avviene prima di qualunque verifica applicativa sugli id forniti (nessun errore "menu non trovato" al posto del rifiuto)

#### Scenario: Amministratore gestisce ruoli e menu

- GIVEN un utente autenticato il cui ruolo ha `Amministratore = true`
- WHEN esegue `mutateRuolo`, `deleteRuolo`, `mutateMenus` o `deleteMenus`
- THEN l'operazione viene eseguita normalmente
- AND valgono le sole regole applicative preesistenti (es. un ruolo con utenti assegnati non è eliminabile)

#### Scenario: Ruolo amministrativo rinominato

- GIVEN un ruolo con `Amministratore = true` il cui nome viene cambiato da "Amministratore" a un nome qualsiasi
- WHEN un utente di quel ruolo esegue un'operazione di anagrafica
- THEN l'operazione riesce, perché il privilegio deriva dal flag e non dal nome

### Requirement: Regola di autorizzazione fine su mutateUtente

`mutateUtente` è **anche** il canale con cui `ProfilePage` salva il proprio profilo (nome, password,
`preferenzaDragModale`): un guard amministrativo secco romperebbe il salvataggio del profilo per
tutti gli utenti non amministratori. La regola normativa è quindi **amministratore OPPURE modifica
di sé stessi senza alterare il proprio privilegio**.

Un chiamante amministratore MAY agire su qualunque utente, in creazione e in modifica.

Un chiamante non amministratore MUST poter invocare `mutateUtente` solo quando **tutte** queste
condizioni sono soddisfatte:

1. l'`id` indicato corrisponde a un utente esistente;
2. l'`id` indicato coincide con l'id del chiamante;
3. il `ruoloId` inviato è identico a quello attualmente memorizzato per l'utente;
4. il valore `disabilitato` inviato è identico a quello attualmente memorizzato.

In ogni altro caso la mutation MUST essere rifiutata. In particolare un utente non amministratore
MUST NOT poter creare nuovi utenti (`id` assente o inesistente), MUST NOT poter modificare un altro
utente né riscriverne la password, e MUST NOT poter auto-promuoversi cambiando il proprio `ruoloId`
o riabilitarsi cambiando `disabilitato`.

La verifica MUST precedere qualunque scrittura, inclusa la rigenerazione di `Hash` e `Salt`.

#### Scenario: Operatore salva il proprio profilo

- GIVEN un utente autenticato non amministratore
- WHEN esegue `mutateUtente` sul proprio `id`, inviando il proprio `ruoloId` e `disabilitato` correnti e una nuova password
- THEN la mutation riesce
- AND i dati anagrafici e la password vengono aggiornati

#### Scenario: Operatore tenta di modificare un altro utente

- GIVEN un utente autenticato non amministratore
- WHEN esegue `mutateUtente` sull'`id` di un altro utente, anche solo per cambiarne la password
- THEN la mutation è rifiutata con l'errore "puoi modificare solo il tuo profilo"
- AND `Hash` e `Salt` dell'altro utente restano invariati

#### Scenario: Operatore tenta di auto-promuoversi

- GIVEN un utente autenticato non amministratore
- WHEN esegue `mutateUtente` sul proprio `id` inviando un `ruoloId` diverso da quello corrente (o `disabilitato` diverso)
- THEN la mutation è rifiutata con l'errore che riserva agli amministratori la modifica di ruolo e abilitazione
- AND il `RuoloId` e il flag `Disabilitato` dell'utente restano invariati sul database

#### Scenario: Operatore tenta di creare un utente

- GIVEN un utente autenticato non amministratore
- WHEN esegue `mutateUtente` senza `id` (o con un `id` inesistente), quindi in creazione
- THEN la mutation è rifiutata per mancanza di privilegi amministrativi
- AND nessun nuovo utente viene creato

#### Scenario: Amministratore gestisce l'anagrafica utenti

- GIVEN un utente autenticato amministratore
- WHEN esegue `mutateUtente` su un altro utente, cambiandone password, ruolo o abilitazione
- THEN la mutation riesce
- AND le modifiche sono persistite

### Requirement: Introspezione dello schema disabilitata fuori da Development

Con l'endpoint `/graphql` raggiungibile in anonimo, uno schema introspezionabile regala a chiunque
la mappa completa del gestionale — nomi dei rami, campi, argomenti. Il backend MUST rifiutare **in
fase di validazione** le query che richiedono i meta-campi di introspezione `__schema` e `__type` in
ogni ambiente diverso da Development: la richiesta MUST NOT essere eseguita e la risposta MUST NOT
contenere alcuna descrizione dello schema.

Il comportamento — richiesta rifiutata, nessuna informazione di schema restituita — è il requirement.
Gli identificatori dell'errore ne sono un **dettaglio diagnostico**: l'errore prodotto MUST essere
quello dedicato alla regola sull'introspezione, che porta `Number` = `INTROSPEZIONE_DISABILITATA` e
`Code` = `NO_INTROSPECTION`. Il `Code` è **derivato da GraphQL.NET dal nome della classe di errore**
(`NoIntrospectionError` → `NO_INTROSPECTION`), esattamente come `AccessDeniedError` →
`ACCESS_DENIED`: è la convenzione già in uso nel progetto e MUST NOT essere valorizzato a mano per
farlo coincidere con l'identificatore italiano.

Nessuno dei due identificatori è osservabile dal client in produzione: `Program.cs` imposta
`ExposeExtensions = IsDevelopment()`, quindi fuori da Development il client riceve solo il messaggio
di errore, senza `code` né `number`. Un requirement che poggiasse su un codice invisibile in
produzione non sarebbe verificabile dove conta — per questo la parte normativa sta sul
comportamento, e gli identificatori valgono in Development e per i test che ispezionano l'errore
in-process.

La verifica del blocco MUST eseguire davvero una query di introspezione attraverso la catena di
validazione registrata in produzione: ispezionare la sola costruzione della regola prova il
cablaggio, non il rifiuto.

In Development l'introspezione MUST restare attiva, altrimenti si perdono autocompletamento e
strumenti di esplorazione dello schema.

La decisione MUST dipendere dall'ambiente di esecuzione valutato dalla regola stessa, così che la
catena di validazione registrata sia una sola per tutti gli ambienti.

Il meta-campo `__typename` MUST NOT essere bloccato: non espone la mappa dello schema ed è usato
dalle librerie client (e dal test di contratto sull'autorizzazione).

#### Scenario: Introspezione in produzione

- GIVEN il backend in esecuzione con ambiente diverso da Development
- WHEN un client esegue `query { __schema { types { name } } }`
- THEN la richiesta è rifiutata in fase di validazione e non viene eseguita
- AND la risposta non contiene alcuna descrizione dello schema
- AND l'errore prodotto è quello della regola sull'introspezione (`Number` = `INTROSPEZIONE_DISABILITATA`, `Code` = `NO_INTROSPECTION`), identificatori che il client vede solo in Development

#### Scenario: Introspezione puntuale su un tipo in produzione

- GIVEN il backend in esecuzione con ambiente diverso da Development (Production o Staging)
- WHEN un client esegue `query { __type(name: "UtenteInput") { inputFields { name } } }`
- THEN la richiesta è rifiutata dalla stessa regola, con lo stesso errore
- AND nessun campo del tipo viene rivelato

#### Scenario: Introspezione in Development

- GIVEN il backend in esecuzione con ambiente Development
- WHEN un client esegue una query di introspezione
- THEN la richiesta viene eseguita normalmente e restituisce lo schema
- AND nessun errore di validazione viene aggiunto

#### Scenario: __typename resta disponibile

- GIVEN il backend in esecuzione in un ambiente qualsiasi
- WHEN una query richiede `__typename` su un tipo
- THEN la richiesta non viene bloccata dalla regola sull'introspezione

### Requirement: Origini CORS ammesse da allowlist dichiarata

La policy CORS del backend è combinata con `AllowCredentials()`: un'origine ammessa può chiamare
l'API con i cookie dell'utente. Le origini cross-origin ammesse MUST quindi provenire da una
**dichiarazione esplicita**, e MUST NOT essere dedotte da proprietà dell'host.

Un'origine MUST essere ammessa se e solo se il suo host ricade in uno di questi casi:

1. `localhost` o `127.0.0.1` (sviluppo locale);
2. un host presente nell'allowlist dichiarata, costruita dalla variabile d'ambiente
   `ALLOWED_ORIGINS` (elenco di soli host separati da virgola, senza schema né porta) a cui viene
   aggiunto automaticamente il valore di `SERVER_IP` se impostato;
3. un indirizzo IPv4 di rete privata (`192.168.x.x`, `10.x.x.x`, `172.16.x.x`–`172.31.x.x`), per il
   test su più dispositivi in LAN.

Ogni altra origine MUST essere rifiutata. In particolare un host che sia un IP **pubblico**
parsabile MUST NOT essere ammesso per il solo fatto di essere un IP: era la deduzione che, con
`AllowCredentials()`, permetteva a qualunque sito ospitato su un IP nudo di chiamare l'API con i
cookie dell'utente.

L'allowlist MUST essere configurabile senza rebuild dell'immagine: la variabile d'ambiente MUST
essere propagata al container backend e documentata nel file di esempio dell'ambiente di produzione.

#### Scenario: Origine dichiarata nell'allowlist

- GIVEN `ALLOWED_ORIGINS` contenente il dominio dell'applicazione
- WHEN arriva una richiesta cross-origin con `Origin` pari a quel dominio
- THEN la richiesta è ammessa dalla policy CORS
- AND le credenziali (cookie) sono consentite

#### Scenario: IP pubblico non dichiarato

- GIVEN `ALLOWED_ORIGINS` che non contiene l'host `203.0.113.10` e `SERVER_IP` diversa da quell'IP
- WHEN arriva una richiesta cross-origin con `Origin: https://203.0.113.10`
- THEN la richiesta è rifiutata dalla policy CORS
- AND la risposta non contiene l'header `Access-Control-Allow-Origin`

#### Scenario: Sviluppo su più dispositivi in LAN

- GIVEN nessuna configurazione aggiuntiva oltre ai default
- WHEN arriva una richiesta con `Origin: http://192.168.1.50:4001` (o `http://localhost:4001`)
- THEN la richiesta è ammessa
- AND lo sviluppo su più dispositivi in rete locale continua a funzionare come prima della change

#### Scenario: IP del server aggiunto senza toccare l'allowlist

- GIVEN `SERVER_IP` impostata con l'IP pubblico del VPS e `ALLOWED_ORIGINS` che non lo contiene
- WHEN arriva una richiesta cross-origin con `Origin` su quell'IP
- THEN la richiesta è ammessa
- AND non è stato necessario duplicare l'IP in `ALLOWED_ORIGINS`

#### Scenario: Nuovo client legittimo da autorizzare

- GIVEN un client legittimo su un host non previsto, la cui richiesta viene rifiutata dal CORS
- WHEN l'host viene aggiunto a `ALLOWED_ORIGINS` e il container backend viene riavviato
- THEN il client è ammesso
- AND non è stato necessario alcun rebuild né deploy applicativo
