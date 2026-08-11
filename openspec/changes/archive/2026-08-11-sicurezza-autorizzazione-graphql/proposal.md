# Proposal: Autorizzazione dello schema GraphQL

> **Change retroattiva.** Il codice è già stato scritto, testato e verificato: questa proposal
> documenta una correzione di sicurezza **già applicata**, perché il contratto che ne è nato
> deve vivere nelle spec e non solo nei commit. Non contiene lavoro da fare; è scritta al passato.
> Estende il dominio `openspec/specs/sicurezza/`.

## Intent

L'endpoint `/graphql` è montato con `opt.AuthorizationRequired = false` (`backend/Program.cs`).
La protezione è quindi **interamente per-campo**: un `ObjectGraphType` che nasce senza
`this.Authorize()` è raggiungibile in anonimo da Internet. È il default sbagliato — aperto per
costruzione, chiuso solo se qualcuno si ricorda di chiuderlo. Su quattordici moduli root, tre erano
del tutto privi di autorizzazione e un quarto la applicava a un solo resolver:

| Modulo | Stato precedente |
|--------|------------------|
| `backend/GraphQL/Authentication/AuthMutations.cs` | Nessuna autorizzazione, né di classe né di campo |
| `backend/GraphQL/Connection/ConnectionQueries.cs` | Assente |
| `backend/GraphQL/Vendite/VenditeQueries.cs` | Assente |
| `backend/GraphQL/Vendite/VenditeMutations.cs` | Solo `.Authorize()` di campo su `mutateProdotto` |

**L'impatto peggiore era un account takeover completo.** Il resolver `mutateUtente` accettava
l'`id` di un utente esistente e, se il campo `password` era valorizzato, riscriveva `Hash` e
`Salt` senza alcun controllo. Un anonimo resettava la password del superadmin e poi entrava
regolarmente da `POST /api/auth/signin`.

`ConnectionQueries` esponeva inoltre in anonimo l'anagrafica utenti, ruoli e menu, i registri di
cassa, i fornitori, le fatture di acquisto e le chiusure mensili — l'intero contenuto gestionale
del sistema in sola lettura.

Il difetto vero non è però il singolo modulo dimenticato: è che nulla impediva al prossimo modulo
di ripetere l'errore. Per questo il deliverable principale della change non è una riga di
`this.Authorize()`, ma un test che **enumera i rami root dallo schema** e pretende che ognuno neghi
l'accesso in anonimo.

## Scope

### In Scope

- `this.Authorize()` a livello di tipo sui quattro moduli scoperti
- Rimozione del `.Authorize()` di campo ridondante su `mutateProdotto` (una sola regola invece di due sovrapposte)
- Guard amministratore sui resolver di anagrafica: `mutateRuolo`, `deleteRuolo`, `mutateMenus`, `deleteMenus`
- Regola di autorizzazione fine su `mutateUtente`: amministratore **oppure** modifica del proprio profilo senza toccare `ruoloId` né `disabilitato`
- Nuova validation rule che blocca l'introspezione dello schema fuori da Development
- CORS ristretto a una allowlist esplicita di host, configurata via variabile d'ambiente
- Test di contratto che enumerano i rami root **dallo schema** e verificano la negazione in anonimo
- Test che pinnano la regola fine di `mutateUtente` e il comportamento della validation rule

### Out of Scope

- **`AuthorizationRequired = true` sull'endpoint** — lavoro futuro. Va prima verificato l'ordine di
  valutazione rispetto a `WebSocketAuthenticationService`: alzarlo alla cieca rischia di rompere il
  realtime della cassa, che è il canale operativo del punto vendita
- **`server_name _` catch-all di nginx** — il vhost risponde a qualunque Host header. Previsto in
  sede di go-live del sito vetrina, quando i server block andranno comunque riscritti
- Rotazione delle credenziali eventualmente compromesse (decisione operativa, non di codice)
- Audit log degli accessi negati
- Revisione dell'autorizzazione nei moduli che erano già protetti correttamente

## Approach

**1. Chiudere i quattro moduli, al livello giusto.** L'autorizzazione è stata messa sulla classe,
non sui singoli campi: un campo aggiunto domani a un modulo già protetto eredita la regola invece
di doversela ricordare. Per coerenza è stato tolto il `.Authorize()` di campo su `mutateProdotto`,
che sarebbe rimasto come seconda regola sovrapposta alla prima.

**2. Autenticato non basta per l'anagrafica.** Ruoli e menu governano chi vede cosa in tutta
l'applicazione: sono stati protetti con il guard amministratore già esistente
(`GestioneCassaGuards.GuardUtenteAmministratore`), che verifica il flag `Ruolo.Amministratore` e non
il nome del ruolo.

**3. `mutateUtente` ha richiesto una regola più fine.** È **anche** il canale con cui `ProfilePage`
salva il proprio profilo: un guard admin secco avrebbe rotto il salvataggio per tutti gli utenti non
amministratori. La regola implementata: se il chiamante non è amministratore, può agire solo sul
proprio `id` e solo lasciando invariati `ruoloId` e `disabilitato` — altrimenti si
auto-promuoverebbe.

**4. Introspezione chiusa fuori da Development.** Non è una vulnerabilità di per sé, ma con
l'endpoint raggiungibile in anonimo lo schema introspezionabile regala la mappa completa del
gestionale. In Development resta attiva, altrimenti si perdono autocompletamento e strumenti di
esplorazione.

**5. CORS: da deduzione a dichiarazione.** La policy precedente ammetteva *qualunque origine il cui
host fosse un IP pubblico parsabile*, in combinazione con `AllowCredentials()`: qualunque sito
ospitato su un IP nudo poteva chiamare l'API con i cookie dell'utente. Ora localhost e la LAN privata
restano ammessi per lo sviluppo su più dispositivi, mentre gli host esterni vanno dichiarati in
`ALLOWED_ORIGINS` (più `SERVER_IP`, aggiunta in automatico).

**6. Il test come contratto, non come checklist.** `AutorizzazioneAnonimaTests` non contiene una
lista di rami scritta a mano — la deriva da `schema.Query.Fields` e `schema.Mutation.Fields`. Un
modulo aggiunto domani è coperto automaticamente e rompe la CI se dimentica l'autorizzazione. La
documentazione inline stabilisce anche la via d'uscita corretta: un ramo che deve davvero essere
pubblico non va aggiunto a un'allowlist nel test, va esposto come endpoint REST sotto
`/api/public/*`, dove la superficie è chiusa per costruzione invece che aperta per default.

## Affected Areas

Modifiche **solo backend**. Nessun file frontend toccato, nessuna migrazione database.

| Area | Impact | Descrizione |
|------|--------|-------------|
| `backend/GraphQL/Authentication/AuthMutations.cs` | Modified | `this.Authorize()` di tipo; guard admin su `mutateRuolo`/`deleteRuolo`/`mutateMenus`/`deleteMenus`; regola fine su `mutateUtente` |
| `backend/GraphQL/Connection/ConnectionQueries.cs` | Modified | `this.Authorize()` di tipo |
| `backend/GraphQL/Vendite/VenditeQueries.cs` | Modified | `this.Authorize()` di tipo |
| `backend/GraphQL/Vendite/VenditeMutations.cs` | Modified | `this.Authorize()` di tipo; rimosso `.Authorize()` di campo ridondante su `mutateProdotto` |
| `backend/GraphQL/Validation/NoIntrospectionValidationRule.cs` | New | Blocca `__schema` e `__type` fuori da Development (`Number` = `INTROSPEZIONE_DISABILITATA`, `Code` = `NO_INTROSPECTION`, derivato dal nome della classe) |
| `backend/Common/CorsOriginPolicy.cs` | New | Predicato CORS estratto dai top-level statements per renderlo raggiungibile dai test |
| `backend/Program.cs` | Modified | Registrazione della validation rule; CORS da allowlist esplicita (delegata a `CorsOriginPolicy`) invece che da deduzione sull'IP |
| `docker-compose.yml` | Modified | Propaga `ALLOWED_ORIGINS` e `SERVER_IP` al container backend |
| `.env.production.example` | Modified | Documenta `ALLOWED_ORIGINS` |
| `backend/DuedGusto.Tests/Helpers/GraphQLTestHost.cs` | New | Costruisce lo schema col cablaggio di `Program.cs` (inclusa la rule sull'introspezione, con `IWebHostEnvironment` fake) ed esegue query in-process |
| `backend/DuedGusto.Tests/Integration/GraphQL/AutorizzazioneAnonimaTests.cs` | New | Enumera i rami root dallo schema — Query, Mutation e Subscription; ognuno deve negare l'accesso in anonimo |
| `backend/DuedGusto.Tests/Integration/GraphQL/PrivilegiAmministrativiTests.cs` | New | Pinna la regola fine di `mutateUtente` |
| `backend/DuedGusto.Tests/Unit/GraphQL/NoIntrospectionValidationRuleTests.cs` | New | Attivazione/disattivazione della rule per ambiente |
| `backend/DuedGusto.Tests/Integration/GraphQL/IntrospezioneTests.cs` | New | Esegue davvero `__schema`/`__type` attraverso la catena di produzione e osserva il rifiuto |
| `backend/DuedGusto.Tests/Unit/Common/CorsOriginPolicyTests.cs` | New | Copre i cinque scenari CORS sul predicato estratto |

## Risks

| Rischio | Probabilità | Mitigazione |
|---------|-------------|-------------|
| Un guard troppo stretto su `mutateUtente` rompe il salvataggio del profilo per gli utenti non amministratori | Media | È esattamente il motivo della regola fine invece del guard admin secco; `PrivilegiAmministrativiTests` pinna entrambi i rami (admin e self-service) |
| La finestra di esposizione precedente è stata sfruttata: password già alterate o dati esfiltrati | Bassa/Ignota | Fuori dallo scope del codice. La contromisura operativa è la rotazione delle credenziali amministrative e la verifica dei log di accesso |
| L'allowlist CORS blocca un client legittimo non previsto | Media | `ALLOWED_ORIGINS` è configurabile senza rebuild; localhost e LAN privata restano sempre ammessi. In produzione nginx serve app e API sullo stesso origin, quindi il CORS entra in gioco raramente |
| L'introspezione chiusa rompe strumenti di sviluppo o generazione tipi | Bassa | La regola è disattivata in Development, dove quegli strumenti girano |
| Un modulo GraphQL futuro nasce di nuovo senza autorizzazione | Media | `AutorizzazioneAnonimaTests` deriva i rami dallo schema: la CI rompe da sola, senza che nessuno debba aggiornare una lista |
| `AuthorizationRequired = false` resta il default dell'endpoint | Alta (accettata) | Consapevolmente deferita: il test di contratto copre il rischio finché il default non viene alzato |

## Rollback Plan

Nessuna migrazione database, nessun dato modificato: il rollback è puramente di codice e reversibile
in ogni suo pezzo, in modo indipendente.

- **Autorizzazione GraphQL** — `git revert` dei quattro file dei moduli riporta lo schema allo stato
  precedente. **Sconsigliato**: ripristina l'account takeover. Se un resolver specifico risulta troppo
  restrittivo, la correzione mirata è allentare quel singolo guard, non revertire `this.Authorize()`
  di tipo.
- **CORS** — impostare `ALLOWED_ORIGINS` con gli host mancanti e riavviare il container: nessun
  rebuild, nessun deploy. Il rollback vero (tornare ad ammettere qualunque IP pubblico) non va fatto:
  era la vulnerabilità.
- **Introspezione** — la regola si disattiva rimuovendone la registrazione in `Program.cs`; è
  autonoma e non ha effetti collaterali sul resto della pipeline di validazione.
- **Test** — eliminabili senza toccare il codice di produzione. Rimuoverli però significa perdere la
  garanzia che il difetto non torni: è il deliverable che vale di più.

## Dependencies

- `GestioneCassaGuards.GuardUtenteAmministratore` — guard amministrativo già esistente, riusato
- Flag `Ruolo.Amministratore` già presente nel modello dati
- `GraphQL.Server.Transports.AspNetCore` per `AccessDeniedError`, il tipo che i test verificano
- `ALLOWED_ORIGINS` e `SERVER_IP` devono essere presenti nel `.env` del server di produzione
- **Nessuna migrazione database**

## Success Criteria

- [x] Ogni ramo root di `Query` e `Mutation` nega l'accesso in anonimo con `ACCESS_DENIED`, verificato enumerando lo schema e non una lista scritta a mano
- [x] `mutateUtente` in anonimo non può riscrivere `Hash`/`Salt` di alcun utente
- [x] Un utente non amministratore salva il proprio profilo, ma non può modificare `ruoloId` o `disabilitato` né agire su altri utenti
- [x] `mutateRuolo`, `deleteRuolo`, `mutateMenus`, `deleteMenus` sono riservate agli amministratori
- [x] L'introspezione è bloccata fuori da Development e resta attiva in Development
- [x] Il CORS ammette solo host dichiarati, localhost e LAN privata; un IP pubblico arbitrario non è più ammesso per deduzione
- [x] Suite backend verde: 407/407 test (358 alla stesura iniziale → 362 con l'enumerazione delle subscription → 407 con i test su CORS e introspezione)
- [x] Smoke test su applicazione avviata: i tre rami precedentemente aperti rispondono `ACCESS_DENIED` in anonimo
