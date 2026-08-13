# Delta for Sicurezza

**Change**: vetrina-api-pubblica
**Date**: 2026-08-11
**Status**: Draft

> **Nota sullo schema GraphQL** — questa delta non introduce tipi: descrive **chi** può invocare
> ciò che le spec `api-pubblica` e `impostazioni-vetrina` definiscono, e — per la prima volta nel
> progetto — **cosa è deliberatamente raggiungibile da chiunque**.
>
> Questa è la change in cui il sistema apre la sua **prima superficie anonima non di
> autenticazione**. La dottrina che la governa è già scritta nel codice e non si ridiscute:
>
> > *"Se un ramo deve davvero essere raggiungibile senza login, NON aggiungerlo a un'allowlist
> > qui: esponilo come endpoint REST sotto `/api/public/*`, dove la superficie è **chiusa per
> > costruzione** invece che aperta per default."*
> > — [`AutorizzazioneAnonimaTests.cs:21-23`](../../../../../backend/DuedGusto.Tests/Integration/GraphQL/AutorizzazioneAnonimaTests.cs)
>
> **Comportamento attuale verificato**:
> - Lo schema GraphQL è montato con `AuthorizationRequired = false`
>   ([`Program.cs:303`](../../../../../backend/Program.cs)): la protezione è **interamente per
>   campo**, quindi un modulo che nasce senza `this.Authorize()` è pubblico. È già successo, con
>   un takeover di account anonimo.
> - `AutorizzazioneAnonimaTests` enumera i rami **dallo schema**: copre gratis ogni ramo GraphQL
>   nuovo e **non copre nulla** di REST.
> - `SchemaEspone_TuttiIRamiRootAttesi` (righe 93-111) elenca sette rami di query
>   (`authentication`, `connection`, `gestioneCassa`, `vendite`, `settings`, `fornitori`,
>   `chiusureMensili`) e otto di mutation, `vetrina` compresa.
> - `GestioneCassaGuards.GuardUtenteAmministratore` legge il flag `Ruolo.Amministratore`, non il
>   nome del ruolo, ed è già condivisa.
> - `AuthRateLimitMiddleware.RateLimitedPaths` (righe 24-28) è un dizionario hardcoded con due
>   sole voci, entrambe `/api/auth/*`; `GetClientIpAddress` (righe 106-125) legge
>   `X-Forwarded-For` **senza validarlo**; `CleanupOldEntries` (riga 131) è documentata come da
>   invocare periodicamente e `grep -rn "CleanupOldEntries" backend/` trova **solo la definizione
>   e due chiamate nei test**.
> - `app.UseCors("AllowSpecificOrigins")` è globale e la sua policy usa `AllowCredentials()`;
>   `CorsOriginPolicy.OrigineAmmessa` confronta `uri.Host` **ignorando la porta** e ammette
>   `localhost`, quindi lo sviluppo del sito su una porta locale è **già** consentito.

## ADDED Requirements

### Requirement: La superficie anonima esiste solo in REST, e nasce con la sveglia già suonata

Nessun ramo GraphQL MUST diventare raggiungibile senza autenticazione per effetto di questa
change. Il nuovo ramo root di query MUST dichiarare l'autorizzazione a livello di tipo, come
tutti gli altri, e MUST NOT comparire in alcuna lista di eccezioni.

⚠️ Il test che pinna l'elenco dei rami root **fallirà** all'introduzione del nuovo ramo, e
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

- GIVEN lo schema GraphQL della change applicata
- WHEN il test che enumera i rami root verifica quali sono raggiungibili senza autenticazione
- THEN il nuovo ramo di query risulta protetto
- AND non compare in alcuna lista di eccezioni

#### Scenario: L'elenco atteso dei rami root viene aggiornato, non aggirato

- GIVEN il test che pinna l'elenco dei rami root
- WHEN si applica la change
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

- GIVEN il sistema dopo la change
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

La terza voce di menu MUST essere assegnata ai soli ruoli con flag amministrativo, e ciò MUST NOT
essere l'unico controllo: le chiamate dirette MUST restare rifiutate dal backend.

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

- GIVEN la configurazione dopo la change
- WHEN si ispezionano le policy applicate all'endpoint GraphQL e alle rotte di autenticazione
- THEN sono quelle precedenti alla change, con allowlist di host e credenziali

#### Scenario: Nessuna riga inutile nella configurazione delle origini

- GIVEN la verifica che l'allowlist confronta il solo host e ammette già le origini locali
- WHEN si valuta l'aggiunta della porta di sviluppo del sito all'elenco delle origini ammesse
- THEN non viene aggiunta, perché sarebbe priva di effetto

### Requirement: Nessun rate limit applicativo sulle letture pubbliche, e il criterio è scritto

Le tre rotte pubbliche MUST NOT essere aggiunte al dizionario del rate limiting applicativo
esistente. La decisione MUST essere motivata nel codice, accanto al dizionario, perché la Fase 4
farà la scelta **opposta** su una rotta di scrittura e deve poterlo fare senza rileggere il
design.

Le tre ragioni, tutte verificate:

1. **la chiave del contatore è falsificabile**: viene letta da un header della richiesta senza
   alcuna validazione e senza sapere se davanti c'è un proxy fidato. Un abusatore ruota l'header
   e ottiene contatori illimitati, mentre un client onesto — che l'header non lo manda — resta
   l'unico davvero limitato. Un limitatore che frena solo chi non sta abusando non è una
   mitigazione;
2. **il dizionario dei contatori non viene mai ripulito**: la procedura di pulizia esiste ma
   nessun servizio la invoca. Oggi il danno è contenuto perché le rotte limitate sono di login,
   con pochi indirizzi distinti; agganciarvi la rotta più richiesta di un sito pubblico
   significherebbe una voce permanente per ogni visitatore, cioè una perdita di memoria
   **proporzionale al traffico anonimo**;
3. **la protezione vera è già progettata e non è un contatore**: ogni risposta ha **costo fisso**
   — nessun parametro di query, nessun filtro libero, nessuna paginazione, tetto di 300 elementi
   — e gli header di cache permettono al reverse proxy di Fase 6 di collassare le richieste
   concorrenti identiche in una sola verso l'applicazione.

Il criterio da scrivere MUST essere: **lettura cacheabile a costo fisso, no; scrittura che
persiste dati o invia email, sì.**

**Rischio residuo dichiarato**: fino all'introduzione del micro-cache, un flusso anonimo intenso
raggiunge il database con una query limitata a 300 righe. La mitigazione, se servirà, MUST essere
un limite nel reverse proxy — che vede l'indirizzo reale della connessione e non può essere
ingannato da un header — e MUST NOT essere una riga nel dizionario applicativo.

#### Scenario: Le rotte pubbliche non sono nel dizionario

- GIVEN il codice della change applicata
- WHEN si ispeziona il dizionario delle rotte sottoposte a limite
- THEN contiene esattamente le due voci di autenticazione preesistenti
- AND accanto è scritto il criterio che spiega perché le letture pubbliche non ci sono e perché
  la scrittura della Fase 4 ci andrà

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
- THEN il rifiuto avviene esattamente come prima della change
