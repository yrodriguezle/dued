# Delta for Sicurezza

**Change**: vetrina-fondamenta-media
**Date**: 2026-08-11
**Status**: Draft

> **Nota sullo schema GraphQL** — questa delta non introduce né modifica tipi, query o
> mutation: descrive **chi** può invocare ciò che le spec `media-assets` e
> `vetrina-prodotti` definiscono. Le dichiarazioni di schema stanno in quelle spec.
>
> Le operazioni da proteggere sono il **nuovo ramo root `vetrina`**
> (`mutateProdottoVetrina`, `mutateMediaAsset`, `eliminaMediaAsset`), la
> `connection { mediaAssets }` e i due endpoint REST `POST /api/media` e
> `GET /api/media/configurazione`. Collocare il CRUD dei media in GraphQL invece che in REST
> ha una conseguenza diretta su questa spec: il ramo `vetrina` viene enumerato dallo schema
> ed è quindi **coperto automaticamente** dal test che verifica quali rami sono raggiungibili
> senza autenticazione, cosa che un controller REST non sarebbe.
>
> **Comportamento attuale verificato**:
> - `VenditeQueries.cs:21` e `VenditeMutations.cs:25` — `this.Authorize()` a livello di tipo:
>   copre l'intero ramo `vendite`, ma verifica **solo** che l'utente sia autenticato.
> - `GestioneCassaGuards.GuardUtenteAmministratore`
>   ([`GestioneCassaGuards.cs:94-106`](../../../../backend/GraphQL/GestioneCassa/GestioneCassaGuards.cs))
>   legge il flag `Ruolo.Amministratore` — **non** il nome del ruolo — e solleva un errore
>   applicativo esplicito quando manca. È già usata da `RiapriRegistroCassaOrchestrator` e
>   da `AuthMutations`.
> - `AuthController` è l'unico controller REST esistente: `[Authorize]` a livello di classe,
>   `[AllowAnonymous]` sui singoli endpoint pubblici, identità dell'utente nei claim
>   `NameIdentifier` / `UserId`.
> - `WikiLayout.tsx:36,52-58` — il gate client-side legge
>   `store.utente?.ruolo?.amministratore` e mostra un avviso: è presentazione, non sicurezza.

## ADDED Requirements

### Requirement: Media e campi vetrina sono un'area riservata agli amministratori

Ogni operazione su media e campi vetrina MUST essere riservata agli utenti il cui ruolo ha
il flag amministrativo. In dettaglio:

- **Scritture GraphQL**: il nuovo ramo root `vetrina` MUST richiedere l'autenticazione a
  livello di tipo come gli altri rami, e **ciascuna** delle sue mutation
  (`mutateProdottoVetrina`, `mutateMediaAsset`, `eliminaMediaAsset`) MUST verificare il flag
  amministrativo dell'utente **come prima operazione del resolver**, prima di qualunque
  lettura o scrittura. L'autorizzazione a livello di tipo verifica solo l'autenticazione e
  MUST NOT essere considerata sufficiente.
- **Lettura dei media in GraphQL**: la `connection { mediaAssets }` MUST richiedere anch'essa
  il flag amministrativo. In questa fase non esiste alcun consumatore anonimo né non
  amministrativo dei media: l'API pubblica arriva in Fase 2.
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
