# Sicurezza Specification

**Domain**: sicurezza
**Status**: Active
**Ultimo aggiornamento**: 2026-08-11

Change incorporate in questa spec:

| Change | Archiviata il | Contenuto |
|--------|---------------|-----------|
| fix-salvataggio-cassa-fase1 | 2026-06-10 | Spec iniziale del dominio: esposizione errori GraphQL, gestione secrets |
| sicurezza-autorizzazione-graphql | 2026-08-11 | Autorizzazione dello schema GraphQL: autorizzazione di tipo sui rami root, contratto enumerato dallo schema, dati pubblici via `/api/public/*`, privilegio amministrativo, regola fine su `mutateUtente`, introspezione fuori da Development, allowlist CORS |
| vetrina-fondamenta-media | 2026-08-13 | Media e campi vetrina come area riservata agli amministratori: privilegio dal flag e non dal nome, una verifica sola per due trasporti, il gate client-side non è sicurezza |
| vetrina-api-pubblica | 2026-08-13 | La superficie anonima esiste solo in REST (e il meccanismo enumerativo non la copre: serve la prova manuale); impostazioni vetrina riservate anche in lettura; policy CORS dedicata senza credenziali; nessun rate limit sulle letture pubbliche, con il criterio scritto |

> Nessuna modifica alla **forma** dello schema GraphQL da parte di queste change: nessun tipo, campo
> o argomento aggiunto, rinominato o rimosso, nessuna migrazione database. I requirement riguardano
> il contenuto degli errori esposti, i metadati di autorizzazione degli `ObjectGraphType`, la
> pipeline di validazione delle richieste e la policy CORS dell'host.

## Purpose

Definire il comportamento di sicurezza del backend su tre assi:

1. **Esposizione degli errori** — quali dettagli delle eccezioni raggiungono il client, in funzione
   dell'ambiente di esecuzione (Development vs produzione).
2. **Gestione dei secrets** di configurazione (connection string MySQL e chiave JWT).
3. **Raggiungibilità e privilegio sullo schema GraphQL** — chi può raggiungere `/graphql`, con quale
   privilegio, da quali origini, e cosa può scoprire dello schema.

## Requirements

### Requirement: Dettagli errori GraphQL esposti solo in Development

Il backend MUST esporre i dettagli delle eccezioni nelle risposte GraphQL
(`ExposeExceptionDetails`, tipo eccezione, messaggi inner exception, stack trace) SOLO
quando l'ambiente di esecuzione è Development. In ogni altro ambiente la risposta GraphQL
per un'eccezione non gestita MUST contenere un messaggio generico senza tipo eccezione,
senza inner exception e senza stack trace. I dettagli completi dell'eccezione MUST essere
sempre registrati nei log del server in tutti gli ambienti. Le eccezioni di dominio
lanciate intenzionalmente con messaggio per l'utente (es. errore di doppia registrazione
fattura) SHOULD continuare a recapitare il loro messaggio al client in tutti gli ambienti.

#### Scenario: Eccezione non gestita in produzione

- GIVEN il backend in esecuzione con ambiente diverso da Development (es. Production)
- WHEN una mutation GraphQL solleva un'eccezione non gestita (es. `DbUpdateException`)
- THEN la risposta GraphQL contiene un messaggio di errore generico
- AND la risposta non contiene tipo dell'eccezione, messaggi delle inner exception né stack trace
- AND i dettagli completi dell'eccezione sono presenti nei log del server

#### Scenario: Eccezione non gestita in Development

- GIVEN il backend in esecuzione con ambiente Development
- WHEN una query o mutation GraphQL solleva un'eccezione non gestita
- THEN la risposta GraphQL contiene i dettagli dell'eccezione utili al debug (tipo, messaggio, inner exception)
- AND i dettagli sono presenti anche nei log del server

#### Scenario: Errore di dominio con messaggio per l'utente in produzione

- GIVEN il backend in produzione
- WHEN il salvataggio del registro viene rifiutato per vera doppia registrazione di una fattura
- THEN il client riceve il messaggio applicativo esplicito previsto dal requisito di dedup (fattura e fornitore)
- AND nessuno stack trace viene incluso nella risposta

### Requirement: Secrets fuori dal repository versionato

Il file `backend/appsettings.json` versionato MUST NOT contenere secrets: né la
connection string con credenziali del database né la chiave di firma JWT. Il backend MUST
leggere connection string e chiave JWT da variabili d'ambiente (convenzione .NET, es.
`ConnectionStrings__Default`; per la chiave JWT è già supportata `JWT_SECRET_KEY`).
Un fallback con valori di sviluppo MAY esistere SOLO per l'ambiente Development (es.
`appsettings.Development.json` NON versionato ed escluso via `.gitignore`); il fallback
MUST NOT essere attivo negli altri ambienti. In ambiente non-Development, se un secret
richiesto non è configurato, l'avvio MUST fallire in modo esplicito con un messaggio che
indica la variabile mancante (fail-fast, nessun valore di default silenzioso).

#### Scenario: Repository senza secrets

- GIVEN la change applicata
- WHEN si ispeziona `backend/appsettings.json` versionato
- THEN il file non contiene la password del database (`password=root`) né la chiave JWT
- AND il file di sviluppo contenente i valori locali è elencato in `.gitignore` e non risulta tracciato da git

#### Scenario: Avvio locale in Development senza configurazione aggiuntiva

- GIVEN una macchina di sviluppo con MySQL locale standard e ambiente Development
- AND nessuna variabile d'ambiente di secrets impostata
- WHEN si esegue `cd backend && dotnet run`
- THEN l'applicazione si avvia correttamente usando il fallback di sviluppo (connection string e chiave JWT locali)
- AND le migrazioni automatiche e il login funzionano come prima della change

#### Scenario: Avvio in produzione con variabili d'ambiente

- GIVEN ambiente non-Development con `ConnectionStrings__Default` e `JWT_SECRET_KEY` impostate
- WHEN l'applicazione viene avviata
- THEN connection string e chiave JWT usate sono quelle delle variabili d'ambiente
- AND nessun valore di fallback di sviluppo viene utilizzato

#### Scenario: Secret mancante in produzione

- GIVEN ambiente non-Development senza `JWT_SECRET_KEY` (o senza connection string) configurata
- WHEN l'applicazione viene avviata
- THEN l'avvio fallisce immediatamente con un errore che indica quale configurazione manca
- AND l'applicazione non si avvia con secrets di default hardcoded

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

### Requirement: Media e campi vetrina sono un'area riservata agli amministratori

Ogni operazione su media e campi vetrina MUST essere riservata agli utenti il cui ruolo ha
il flag amministrativo. In dettaglio:

- **Scritture GraphQL**: il ramo root `vetrina` MUST richiedere l'autenticazione a
  livello di tipo come gli altri rami, e **ciascuna** delle sue mutation
  (`mutateProdottoVetrina`, `mutateMediaAsset`, `eliminaMediaAsset`) MUST verificare il flag
  amministrativo dell'utente **come prima operazione del resolver**, prima di qualunque
  lettura o scrittura. L'autorizzazione a livello di tipo verifica solo l'autenticazione e
  MUST NOT essere considerata sufficiente.
- **Lettura dei media in GraphQL**: la `connection { mediaAssets }` MUST richiedere anch'essa
  il flag amministrativo. Non esiste alcun consumatore anonimo né non amministrativo dei media
  in GraphQL: la superficie anonima è REST, ed è definita più avanti in questa spec.
- **Endpoint REST dei media**: `POST /api/media` MUST richiedere sia l'autenticazione sia il
  flag amministrativo. `GET /api/media/configurazione` MUST richiedere l'autenticazione ma
  MAY essere accessibile a qualunque utente autenticato, perché espone soltanto costanti di
  validazione e nessun dato.
- **Una verifica sola, due forme d'errore**: la verifica del privilegio MUST essere
  implementata una volta sola e condivisa fra i due trasporti. In GraphQL il rifiuto MUST
  essere un errore applicativo; in REST MUST essere una risposta **403 con corpo JSON
  contenente un messaggio leggibile**, nella stessa forma già usata dall'autenticazione, e
  MUST NOT essere un 500 generato dalla propagazione di un errore pensato per GraphQL.
- **Privilegio dal flag, non dal nome**: la verifica MUST basarsi sul flag
  `Ruolo.Amministratore`, così che rinominare un ruolo non sposti i permessi e revocare il
  flag li tolga immediatamente.
- **Il gate client-side non è un controllo di sicurezza**: nascondere le voci di menu o
  mostrare un avviso nella pagina MUST NOT essere l'unico ostacolo. Le stesse operazioni,
  invocate direttamente via GraphQL o via HTTP saltando l'interfaccia, MUST essere rifiutate
  dal backend.
- **Letture dei campi vetrina**: i campi vetrina esposti su `Prodotto` MAY restare leggibili
  da qualunque utente autenticato (restano coperti dall'`Authorize()` di ramo), perché non
  contengono dati sensibili e la loro destinazione è comunque la pubblicazione.

Il rifiuto MUST produrre un errore esplicito che indichi la mancanza di privilegi
amministrativi, e MUST NOT lasciare alcun effetto collaterale: nessun record creato o
modificato, nessun file scritto sul filesystem.

#### Scenario: Utente autenticato non amministratore su GraphQL

- GIVEN un utente autenticato il cui ruolo ha `Amministratore = false`
- WHEN invoca una qualsiasi mutation del ramo `vetrina` direttamente sull'endpoint GraphQL, senza passare dall'interfaccia
- THEN la richiesta viene rifiutata con un errore esplicito di privilegi insufficienti
- AND nessun campo del prodotto e nessun media vengono modificati

#### Scenario: Utente autenticato non amministratore sull'upload dei media

- GIVEN un utente autenticato il cui ruolo ha `Amministratore = false`
- WHEN invia una richiesta multipart a `/api/media` con un client HTTP qualsiasi
- THEN la risposta ha stato 403 con un corpo JSON contenente un messaggio leggibile
- AND nessun file viene scritto sotto la radice dei media
- AND nessun record di media viene creato

#### Scenario: Utente non amministratore in lettura sui media

- GIVEN un utente autenticato non amministratore
- WHEN interroga `connection { mediaAssets }`
- THEN la richiesta viene rifiutata per privilegi insufficienti

#### Scenario: Richiesta anonima

- GIVEN nessun token di accesso valido
- WHEN viene invocato un qualsiasi endpoint dei media o una qualsiasi operazione del ramo `vetrina`
- THEN la richiesta viene rifiutata come non autenticata
- AND non viene eseguita alcuna verifica di ruolo né alcuna scrittura

#### Scenario: Il nuovo ramo GraphQL non è raggiungibile in anonimo

- GIVEN lo schema GraphQL della change applicata
- WHEN il test che enumera i rami root dallo schema verifica quali sono raggiungibili senza autenticazione
- THEN il ramo `vetrina` risulta protetto
- AND non compare in alcuna lista di eccezioni

#### Scenario: Amministratore autorizzato

- GIVEN un utente autenticato il cui ruolo ha `Amministratore = true`
- WHEN carica un'immagine e modifica i campi vetrina di un prodotto
- THEN entrambe le operazioni vanno a buon fine

#### Scenario: Il privilegio segue il flag, non il nome del ruolo

- GIVEN un ruolo con `Amministratore = true` di nome `"Direzione"`
- WHEN il ruolo viene rinominato in `"Titolare"` mantenendo il flag
- THEN gli utenti di quel ruolo continuano a poter scrivere su media e campi vetrina

#### Scenario: Revoca del flag amministrativo

- GIVEN un utente che opera regolarmente sulla vetrina
- WHEN il flag `Amministratore` viene rimosso dal suo ruolo
- THEN le sue successive scritture su media e campi vetrina vengono rifiutate
- AND il rifiuto avviene lato backend, indipendentemente da ciò che l'interfaccia mostra

#### Scenario: Menu della sezione riservato ai soli ruoli amministrativi

- GIVEN il seed dei menu della sezione dedicata al sito
- WHEN il seed assegna le voci ai ruoli
- THEN le voci risultano assegnate ai soli ruoli con flag amministrativo (più il superadmin)
- AND un utente non amministratore non vede la sezione nella navigazione
- AND questo MUST NOT essere l'unico controllo: le chiamate dirette restano rifiutate dal backend

### Requirement: La superficie anonima esiste solo in REST, e nasce con la sveglia già suonata

Nessun ramo GraphQL MUST diventare raggiungibile senza autenticazione per effetto dell'apertura
dell'API pubblica. Ogni nuovo ramo root di query MUST dichiarare l'autorizzazione a livello di
tipo, come tutti gli altri, e MUST NOT comparire in alcuna lista di eccezioni.

⚠️ Il test che pinna l'elenco dei rami root **fallisce** all'introduzione di un ramo nuovo, e
aggiornarlo aggiungendo il ramo fra le query è il comportamento **progettato**: quel test è la
sveglia che chiede *"è nato un ramo root, hai verificato che sia autorizzato?"*. L'aggiornamento
MUST consistere nell'aggiunta del nome all'elenco atteso e MUST NOT consistere nell'esclusione
del ramo dalle verifiche enumerative, che MUST continuare a coprirlo senza che nessuno le tocchi.

🔴 Il meccanismo enumerativo **non copre la superficie REST**, e questo MUST essere dichiarato
invece che dato per scontato: un test che istanzia direttamente il controller pubblico e ne
invoca un metodo non attraversa autenticazione né autorizzazione, quindi sarebbe verde anche se
il controller richiedesse un login. Le due mezze misure MUST essere entrambe presenti, e nessuna
delle due MUST essere considerata sufficiente da sola:

1. un test che verifica che il controller **dichiari** l'accesso anonimo e non porti alcun
   attributo di autorizzazione — non prova che funzioni, prova che l'intenzione non è stata
   cancellata il giorno in cui qualcuno aggiunge un `[Authorize]` "per coerenza";
2. una verifica **manuale** con un client HTTP privo di credenziali, in sviluppo **e** in
   produzione, che è l'unica prova reale dell'anonimato.

Lo stesso vale per la rotta del nome attività, che è una minimal API e non è raggiungibile da un
test unitario: la sua verifica MUST essere manuale e MUST includere l'avvio dell'applicazione,
perché il suo fallimento non rompe una pagina ma il **bootstrap** del frontend.

#### Scenario: Il nuovo ramo di query nega l'anonimo

- GIVEN lo schema GraphQL con il ramo pubblico introdotto
- WHEN il test che enumera i rami root verifica quali sono raggiungibili senza autenticazione
- THEN il nuovo ramo di query risulta protetto
- AND non compare in alcuna lista di eccezioni

#### Scenario: L'elenco atteso dei rami root viene aggiornato, non aggirato

- GIVEN il test che pinna l'elenco dei rami root
- WHEN nasce un ramo root nuovo
- THEN l'elenco atteso delle query contiene il ramo nuovo
- AND le verifiche enumerative continuano a includerlo senza esclusioni

#### Scenario: L'anonimato del controller pubblico è dichiarato

- GIVEN il controller delle rotte pubbliche
- WHEN se ne ispezionano gli attributi
- THEN dichiara esplicitamente l'accesso anonimo e non porta alcun attributo di autorizzazione

#### Scenario: 🔴 Il test strutturale da solo non prova l'anonimato

- GIVEN il test che istanzia direttamente il controller pubblico e ne invoca i metodi
- WHEN si aggiunge un requisito di autorizzazione al controller
- THEN quel test resta verde
- AND soltanto la verifica con un client HTTP senza credenziali rileva il cambiamento

#### Scenario: Prova manuale dell'accesso anonimo

- GIVEN una shell senza header di autorizzazione e senza cookie
- WHEN si richiedono le tre rotte pubbliche in sviluppo e in produzione
- THEN tutte rispondono `200`

#### Scenario: Il bootstrap dell'applicazione resta intatto

- GIVEN il sistema con l'API pubblica attiva
- WHEN si apre l'applicazione, si completa il login e si osserva l'intestazione
- THEN il titolo dell'attività è visibile
- AND la rotta del nome attività ha risposto correttamente

### Requirement: Le impostazioni della vetrina sono riservate agli amministratori anche in lettura

Sia la query di lettura sia la mutation delle impostazioni della vetrina MUST verificare il flag
amministrativo **come prima operazione del resolver**, prima di qualunque lettura o scrittura.
L'autorizzazione a livello di tipo verifica solo l'autenticazione e MUST NOT essere considerata
sufficiente. La verifica MUST basarsi sul flag del ruolo e non sul suo nome, riusando la funzione
condivisa già esistente.

🔴 La riserva **in lettura** MUST valere anche se una parte degli stessi dati esce anonima dalla
rotta pubblica dell'identità: il tipo di amministrazione espone campi che la risposta pubblica
non contiene — chiave del servizio antispam, parametri delle prenotazioni, e tutto ciò che le
fasi successive aggiungeranno. È il precedente già stabilito nel progetto per la lettura dei
media: *aprirla dopo è una riga; accorgersi che era aperta è un incidente*.

Il rifiuto MUST essere un errore applicativo esplicito e MUST NOT lasciare alcun effetto: nessuna
riga creata o modificata.

La voce di menu delle impostazioni della vetrina MUST essere assegnata ai soli ruoli con flag
amministrativo, e ciò MUST NOT essere l'unico controllo: le chiamate dirette MUST restare
rifiutate dal backend.

#### Scenario: Utente autenticato non amministratore in scrittura

- GIVEN un utente autenticato il cui ruolo non ha il flag amministrativo
- WHEN invoca la mutation delle impostazioni della vetrina direttamente sull'endpoint GraphQL
- THEN la richiesta viene rifiutata con un errore esplicito di privilegi insufficienti
- AND nessun campo delle impostazioni risulta modificato

#### Scenario: Utente autenticato non amministratore in lettura

- GIVEN un utente autenticato il cui ruolo non ha il flag amministrativo
- WHEN interroga la query delle impostazioni della vetrina
- THEN la richiesta viene rifiutata per privilegi insufficienti

#### Scenario: Richiesta anonima sul ramo di amministrazione

- GIVEN nessun token di accesso valido
- WHEN viene invocata la query o la mutation delle impostazioni della vetrina
- THEN la richiesta viene rifiutata come non autenticata
- AND non viene eseguita alcuna verifica di ruolo né alcuna scrittura

#### Scenario: Amministratore autorizzato

- GIVEN un utente autenticato con flag amministrativo
- WHEN legge e poi salva le impostazioni della vetrina
- THEN entrambe le operazioni vanno a buon fine

#### Scenario: La voce di menu è riservata

- GIVEN il seed dei menu della sezione del sito
- WHEN il seed assegna la terza voce ai ruoli
- THEN risulta assegnata ai soli ruoli con flag amministrativo (più il superadmin)
- AND un utente non amministratore non vede la voce nella navigazione

### Requirement: Le rotte pubbliche non possono diventare un vettore credenziale

Le tre rotte pubbliche MUST essere servite da una policy di condivisione fra origini **dedicata**
che MUST NOT ammettere credenziali, e MUST limitarsi al metodo di lettura. La policy globale
credenziale MUST restare invariata e MUST continuare ad applicarsi all'endpoint GraphQL e alle
rotte di autenticazione.

Ammettere qualunque origine **senza** credenziali è più restrittivo, non meno: le due cose sono
mutuamente esclusive per specifica, quindi questa famiglia di rotte non può diventare un vettore
credenziale **nemmeno per un errore di configurazione futuro**. Restringere per origine una API
che risponde a chiunque con un client da riga di comando non protegge nulla: il controllo di
origine vive nel browser e protegge letture credenziali, che qui non esistono.

Nessuna estensione della policy globale MUST essere usata al posto della policy dedicata:
allargherebbe **anche** l'endpoint GraphQL e le rotte di autenticazione.

#### Scenario: Le rotte pubbliche non ammettono credenziali

- GIVEN il backend in esecuzione
- WHEN un browser richiede una rotta pubblica includendo i cookie
- THEN la risposta non dichiara di ammettere credenziali
- AND il browser non espone la risposta come credenziale al codice chiamante

#### Scenario: L'endpoint GraphQL resta sotto la policy credenziale

- GIVEN la configurazione con l'API pubblica attiva
- WHEN si ispezionano le policy applicate all'endpoint GraphQL e alle rotte di autenticazione
- THEN sono quelle precedenti, con allowlist di host e credenziali

#### Scenario: Nessuna riga inutile nella configurazione delle origini

- GIVEN la verifica che l'allowlist confronta il solo host e ammette già le origini locali
- WHEN si valuta l'aggiunta della porta di sviluppo del sito all'elenco delle origini ammesse
- THEN non viene aggiunta, perché sarebbe priva di effetto

### Requirement: Nessun rate limit applicativo sulle letture pubbliche, e il criterio è scritto

Le tre rotte pubbliche MUST NOT essere aggiunte al dizionario del rate limiting applicativo
esistente. La decisione MUST essere motivata nel codice, accanto al dizionario, perché una rotta
di **scrittura** pubblica (le prenotazioni) farà la scelta **opposta** e deve poterlo fare senza
rileggere il design.

Le tre ragioni, tutte verificate:

1. **la chiave del contatore è falsificabile**: viene letta da un header della richiesta senza
   alcuna validazione e senza sapere se davanti c'è un proxy fidato. Un abusatore ruota l'header
   e ottiene contatori illimitati, mentre un client onesto — che l'header non lo manda — resta
   l'unico davvero limitato. Un limitatore che frena solo chi non sta abusando non è una
   mitigazione;
2. **il dizionario dei contatori non viene mai ripulito**: la procedura di pulizia esiste ma
   nessun servizio la invoca. Il danno è contenuto perché le rotte limitate sono di login, con
   pochi indirizzi distinti; agganciarvi la rotta più richiesta di un sito pubblico
   significherebbe una voce permanente per ogni visitatore, cioè una perdita di memoria
   **proporzionale al traffico anonimo**;
3. **la protezione vera è già progettata e non è un contatore**: ogni risposta ha **costo fisso**
   — nessun parametro di query, nessun filtro libero, nessuna paginazione, tetto di 300 elementi
   — e gli header di cache permettono al reverse proxy di collassare le richieste concorrenti
   identiche in una sola verso l'applicazione.

Il criterio da scrivere MUST essere: **lettura cacheabile a costo fisso, no; scrittura che
persiste dati o invia email, sì.**

**Rischio residuo dichiarato**: fino all'introduzione del micro-cache, un flusso anonimo intenso
raggiunge il database con una query limitata a 300 righe. La mitigazione, se servirà, MUST essere
un limite nel reverse proxy — che vede l'indirizzo reale della connessione e non può essere
ingannato da un header — e MUST NOT essere una riga nel dizionario applicativo.

#### Scenario: Le rotte pubbliche non sono nel dizionario

- GIVEN il codice del backend
- WHEN si ispeziona il dizionario delle rotte sottoposte a limite
- THEN contiene esattamente le due voci di autenticazione preesistenti
- AND accanto è scritto il criterio che spiega perché le letture pubbliche non ci sono e perché
  una futura scrittura pubblica ci andrà

#### Scenario: Molte richieste consecutive non vengono rifiutate

- GIVEN un client anonimo
- WHEN richiede ripetutamente `/api/public/menu`
- THEN nessuna richiesta viene rifiutata per superamento di limite
- AND ogni risposta è identica

#### Scenario: Il costo per richiesta non è amplificabile

- GIVEN una qualsiasi delle tre rotte pubbliche
- WHEN un chiamante tenta di allargare il risultato tramite parametri di query
- THEN il numero di righe lette dal database resta lo stesso
- AND resta limitato dal tetto dichiarato

#### Scenario: Il comportamento delle rotte di autenticazione è invariato

- GIVEN le rotte di autenticazione
- WHEN si superano i limiti già configurati
- THEN il rifiuto avviene esattamente come prima

---

## Debito di copertura dichiarato

Registrato al momento dell'archiviazione di `sicurezza-autorizzazione-graphql` (2026-08-11). Nessuno
di questi punti è una violazione: sono scenari **implementati e verificati per lettura** ma privi di
test automatico, tutti su percorsi permissivi o di transport.

| Scenario | Requirement | Stato | Rischio |
|----------|-------------|-------|---------|
| Amministratore gestisce ruoli e menu | Privilegio amministrativo | Senza test | Funzionale: un guard troppo stretto sui 4 resolver di anagrafica non verrebbe intercettato dalla CI |
| Operatore tenta di creare un utente | Regola fine su `mutateUtente` | Senza test | Basso: è il primo disgiunto dello stesso `if` il cui secondo disgiunto è testato |
| Subscription in anonimo | Autorizzazione di tipo | Parziale | Il meccanismo di negazione è provato in-process; il transport WebSocket reale e `WebSocketAuthenticationService` non sono esercitati |
