# Verification Report

**Change**: `sicurezza-autorizzazione-graphql`
**Data**: 2026-08-11
**Natura**: change retroattiva — il codice era già in albero, la verifica confronta la spec con ciò che esiste
**Tipo di verifica**: esecutiva (build + suite eseguiti realmente, non solo lettura)

> **Aggiornamento 2026-08-11, in sede di archiviazione.** Questo report fotografa l'albero **prima**
> di due interventi successivi — l'estrazione testabile del predicato CORS e i test di esecuzione
> reale dell'introspezione — che hanno chiuso i warning W1, W2 e W5 e portato **8 scenari** da
> PARTIAL/UNTESTED a COMPLIANT. La matrice sottostante è conservata così com'era, perché è l'audit
> trail della verifica: **lo stato attuale è nella sezione “Aggiornamento post-verifica” in fondo al
> documento**. La suite è passata da 362 a 407 test. Chi legge questo archivio non deve credere che
> le lacune su CORS e introspezione siano ancora aperte.

---

## Completeness

Non esiste `tasks.md`: la change è retroattiva e non ha task da spuntare. La completezza va letta
sui `Success Criteria` della proposal, tutti confermati dall'esecuzione tranne il conteggio dei test
(vedi SUGGESTION S1).

| Metrica | Valore |
|---------|--------|
| Task totali | 0 (change retroattiva) |
| Requirement nella delta | 7 |
| Scenari nella delta | 26 |

---

## Build & Tests Execution

**Build**: PASSATO — `cd backend && dotnet build`

```
duedgusto -> backend\bin\Debug\net8.0\duedgusto.dll
DuedGusto.Tests -> backend\DuedGusto.Tests\bin\Debug\net8.0\DuedGusto.Tests.dll
Compilazione completata.
    Avvisi: 0
    Errori: 0
```

**Tests**: PASSATI — `cd backend && dotnet test DuedGusto.Tests/DuedGusto.Tests.csproj`

```
Superato! - Non superati: 0. Superati: 362. Ignorati: 0. Totale: 362. Durata: 23 s
```

Exit code 0. Il numero atteso (362) coincide con il reale. Dei 362, **28 test** appartengono alla
superficie di sicurezza di questa change, tutti verdi:

- `AutorizzazioneAnonimaTests` — 17 casi Theory (7 Query + 6 Mutation + 4 Subscription) + 2 Fact
- `PrivilegiAmministrativiTests` — 6 Fact
- `NoIntrospectionValidationRuleTests` — 3 casi

I nomi dei casi Theory contengono i rami derivati **a runtime** dallo schema
(`authentication`, `connection`, `gestioneCassa`, `vendite`, `settings`, `fornitori`,
`chiusureMensili`, `onRegistroCassaUpdated`, `onVenditaCreated`, `onChiusuraCassaCompleted`,
`onSettingsUpdated`): è la prova diretta che l'enumerazione non è una lista scritta a mano.

**Frontend**: non eseguito — la change non tocca alcun file frontend (`rules.verify` richiede
`ts:check`/`lint` solo per modifiche frontend).

**Coverage**: non configurata (`rules.verify` non definisce `coverage_threshold`).

---

## Spec Compliance Matrix

### Requirement 1 — Autorizzazione di tipo su ogni ramo root dello schema GraphQL

| # | Scenario | Test | Esito |
|---|----------|------|-------|
| 1 | Richiesta anonima su un ramo root qualsiasi | `AutorizzazioneAnonimaTests.OgniRamoQuery_InAnonimo_NegaAccesso` (7) + `OgniRamoMutation_InAnonimo_NegaAccesso` (6) | COMPLIANT |
| 2 | Escalation da anonimo su `mutateUtente` | `AutorizzazioneAnonimaTests.MutateUtente_InAnonimo_NonPuoResettareLaPassword` | COMPLIANT |
| 3 | Campo aggiunto a un modulo già protetto | Le 17 Theory selezionano solo `__typename`, campo privo di autorizzazione propria, e sono comunque negate | COMPLIANT |
| 4 | Subscription in anonimo | `AutorizzazioneAnonimaTests.OgniRamoSubscription_InAnonimo_NegaAccesso` (4) | PARTIAL |

**Evidenza strutturale.** Tutti e 14 i moduli root portano `this.Authorize()` a livello di tipo
(`AuthQueries`, `AuthMutations`, `ConnectionQueries`, `GestioneCassaQueries/Mutations`,
`VenditeQueries/Mutations`, `SettingsQueries/Mutations`, `FornitoriQueries/Mutations`,
`ChiusureMensiliQueries/Mutations`), più `GraphQLSubscriptions`. Un grep esaustivo su
`backend/GraphQL/` restituisce **15 occorrenze, tutte `this.Authorize()` di tipo e nessuna di
campo**: il `.Authorize()` ridondante su `mutateProdotto` è stato effettivamente rimosso
(`VenditeMutations.cs:44-46`), quindi il MUST NOT sulle regole sovrapposte è rispettato.

Nessun campo `signIn`/`login` esiste nello schema GraphQL: il login vive solo in
`Controllers/AuthController.cs`. L'ultimo MUST del requirement è soddisfatto.

**Note.**
- Scenario 1: l'AND "nessun resolver del ramo viene eseguito" non è asserito esplicitamente, ma è
  strutturalmente garantito — `AuthorizationValidationRule` nega in fase di **validazione**, prima
  dell'esecuzione.
- Scenario 2: l'ultimo AND ("il successivo `POST /api/auth/signin` fallisce") non viene eseguito dal
  test. È però una conseguenza della negazione in validazione: `Hash`/`Salt` non possono cambiare
  perché il resolver non parte.
- Scenario 4 → **PARTIAL**: il GIVEN parla di "una connessione WebSocket senza utente autenticato",
  mentre il test esegue il documento via `IDocumentExecuter` in-process. Il meccanismo di negazione
  (autorizzazione di tipo su `GraphQLSubscriptions`) è provato; il **transport WebSocket reale** e
  `WebSocketAuthenticationService` non sono esercitati. L'AND "nessun evento del bus viene
  recapitato" segue dalla negazione in validazione (lo `StreamResolver` non parte) ma non è asserito.

### Requirement 2 — Il contratto di autorizzazione è enumerato dallo schema, non da una lista

| # | Scenario | Test | Esito |
|---|----------|------|-------|
| 5 | Modulo nuovo aggiunto senza autorizzazione | `AutorizzazioneAnonimaTests.RamiQuery/RamiMutation/RamiSubscription` (MemberData da `host.Schema.*.Fields`) + `SchemaEspone_TuttiIRamiRootAttesi` | COMPLIANT |
| 6 | Ramo che fallisce in anonimo ma non per autorizzazione | `AutorizzazioneAnonimaTests.AssertAccessoNegato` — asserisce `errore is AccessDeniedError`, non la mera presenza di errori | COMPLIANT |

**Note.**
- La metà negativa di entrambi gli scenari (la CI che effettivamente diventa rossa) non è
  esercitabile senza introdurre un modulo scoperto nel codice di produzione. La metà positiva è
  provata a runtime.
- Il messaggio di fallimento include `GraphQLTestHost.DescriviErrori(result)`, quindi l'AND
  "il messaggio riporta gli errori effettivamente ricevuti" dello scenario 6 è soddisfatto.
- **Divergenza documentale sanata in questa verifica**: il testo del requirement elencava solo
  `schema.Query.Fields` e `schema.Mutation.Fields`, mentre il test enumera anche
  `schema.Subscription.Fields`. La spec non era violata (il MUST è inclusivo), ma descriveva per
  difetto. La riga è stata corretta perché il requirement e lo scenario "Subscription in anonimo"
  puntino alla stessa superficie. È l'unica modifica applicata alla spec.
- **Divergenza aperta (WARNING W1)**: il requirement chiede "la stessa catena di validation rule
  registrata in produzione". `GraphQLTestHost` registra `.AddAuthorizationRule()` ma **non**
  `.AddValidationRule<NoIntrospectionValidationRule>()`, presente invece in `Program.cs:199`.
  L'intento del MUST (non chiamare i resolver direttamente, passare dal motore reale) è rispettato;
  la lettera no.

### Requirement 3 — I dati pubblici si espongono via REST sotto /api/public/*

| # | Scenario | Test | Esito |
|---|----------|------|-------|
| 7 | Nuovo dato da pubblicare senza login | Evidenza reale: `Program.cs:334` espone `GET /api/public/business-name`; nessun ramo GraphQL è esente (17/17 negati) | COMPLIANT |
| 8 | Tentativo di esentare un ramo GraphQL | Verifica strutturale: `AutorizzazioneAnonimaTests` non contiene alcun meccanismo di allowlist o esenzione | COMPLIANT |

**Note.** Il pattern non è teorico: `/api/public/business-name` esiste già e
`VenditeQueries.cs:20` documenta esplicitamente che il listino del sito vetrina passerà da
`/api/public/menu` e non dallo schema. Lo scenario 8 è una regola di **review**, non automatizzabile;
ciò che è verificabile — il MUST NOT sull'allowlist nel test — è verificato leggendo il file intero.

### Requirement 4 — Il privilegio amministrativo è distinto dall'autenticazione

| # | Scenario | Test | Esito |
|---|----------|------|-------|
| 9 | Operatore tenta di modificare un ruolo | `PrivilegiAmministrativiTests.Operatore_ModificaUnRuolo_Rifiutata` | COMPLIANT |
| 10 | Operatore tenta di modificare la navigazione | `PrivilegiAmministrativiTests.Operatore_EliminaMenu_Rifiutata` | COMPLIANT |
| 11 | Amministratore gestisce ruoli e menu | (nessuno) | **UNTESTED** |
| 12 | Ruolo amministrativo rinominato | `RiapriRegistroCassaTests.RiapriRegistroCassa_IlPrivilegioDipendeDalFlagNonDalNomeDelRuolo` | COMPLIANT |

**Evidenza strutturale.** I quattro resolver di anagrafica chiamano `GuardAmministratore` come
**prima istruzione dopo il recupero del `DbContext`**, prima di qualunque lettura o scrittura di
dominio (`AuthMutations.cs:75, 118, 141, 179`): il MUST sull'ordine è rispettato.
`GestioneCassaGuards.GuardUtenteAmministratore` (`GestioneCassaGuards.cs:94-106`) legge
`ruolo.Amministratore` e non il nome, e solleva un `ExecutionError` con messaggio esplicito
("Operazione riservata agli amministratori...") distinguibile dagli errori applicativi.

**Note.**
- Scenario 10: `AssertRifiutata` verifica che il messaggio contenga "amministrator", il che distingue
  il rifiuto dal "Nessun menu trovato" — è esattamente l'AND dello scenario. È testato `deleteMenus`
  e non `mutateMenus` (lo scenario li pone in OR, quindi il MUST è coperto).
- Scenario 11 → **UNTESTED**: nessun test esegue `mutateRuolo`/`deleteRuolo`/`mutateMenus`/
  `deleteMenus` come amministratore. Il percorso permissivo del guard è comunque provato su un altro
  resolver (`RiapriRegistroCassa_ConRuoloAmministratore_RiportaLoStatoADraft`, verde). Il rischio
  residuo è funzionale (guard troppo stretto), non di sicurezza: per questo è classificato WARNING e
  non CRITICAL.
- Scenario 12: la prova sta sul guard **condiviso**, non sui resolver di anagrafica. Poiché
  `AuthMutations.GuardAmministratore` delega esattamente a quel metodo, il percorso di codice è lo
  stesso.
- Scenario 9: l'AND "il flag resta invariato sul database" non è asserito sul DB, ma il `throw`
  precede ogni scrittura.

### Requirement 5 — Regola di autorizzazione fine su mutateUtente

| # | Scenario | Test | Esito |
|---|----------|------|-------|
| 13 | Operatore salva il proprio profilo | `PrivilegiAmministrativiTests.Operatore_ModificaIlProprioProfilo_Riesce` | COMPLIANT |
| 14 | Operatore tenta di modificare un altro utente | `PrivilegiAmministrativiTests.Operatore_ModificaUnAltroUtente_Rifiutata` | COMPLIANT |
| 15 | Operatore tenta di auto-promuoversi | `PrivilegiAmministrativiTests.Operatore_SiAutoPromuoveAdAmministratore_Rifiutata` | COMPLIANT |
| 16 | Operatore tenta di creare un utente | (nessuno) | **UNTESTED** |
| 17 | Amministratore gestisce l'anagrafica utenti | `PrivilegiAmministrativiTests.Amministratore_ModificaUnAltroUtente_Riesce` | COMPLIANT |

**Evidenza strutturale.** `AuthMutations.cs:207-228` implementa esattamente le quattro condizioni
del requirement, e il blocco precede sia l'update sia la rigenerazione di `Hash`/`Salt`
(righe 230-252): il MUST "la verifica precede qualunque scrittura" è rispettato.
Le condizioni 1 e 2 sono il disgiunto `existingUser == null || userId != utenteCorrenteId`;
le condizioni 3 e 4 il confronto `ruoloRichiesto != existingUser.RuoloId || disabilitatoRichiesto != existingUser.Disabilitato`.

**Note.**
- Scenario 16 → **UNTESTED**: la creazione da parte di un non amministratore non è esercitata. Il
  percorso è però il **primo disgiunto dello stesso `if`** il cui secondo disgiunto è testato dallo
  scenario 14, quindi il rischio di regressione silenziosa è basso.
- Scenario 15: è testata la variante `ruoloId` diverso, non la variante `disabilitato` diverso —
  stessa condizione booleana, secondo operando dell'`||`.
- Scenari 14 e 15: gli AND sull'invarianza dei dati a database non sono asseriti direttamente, ma i
  `throw` precedono ogni `SaveChangesAsync`.

### Requirement 6 — Introspezione dello schema disabilitata fuori da Development

| # | Scenario | Test | Esito |
|---|----------|------|-------|
| 18 | Introspezione in produzione | `NoIntrospectionValidationRuleTests.FuoriDaDevelopment_LaRegolaVisita("Production")` | PARTIAL |
| 19 | Introspezione puntuale su un tipo in produzione | `NoIntrospectionValidationRuleTests.FuoriDaDevelopment_LaRegolaVisita("Staging")` | PARTIAL |
| 20 | Introspezione in Development | `NoIntrospectionValidationRuleTests.InDevelopment_LaRegolaNonVisita` | COMPLIANT |
| 21 | `__typename` resta disponibile | Le 17 Theory di `AutorizzazioneAnonimaTests` selezionano `__typename` — ma su una catena priva della rule | PARTIAL |

**Evidenza strutturale.** `NoIntrospectionValidationRule` (`backend/GraphQL/Validation/`) valuta
`environment.IsDevelopment()` **nel costruttore** e restituisce il visitor solo fuori da Development:
la catena registrata è quindi una sola per tutti gli ambienti, come richiede il MUST. Il visitor
matcha esclusivamente i nomi letterali `__schema` e `__type`, quindi `__typename` non è intercettato.
`NoIntrospectionError` porta il codice `INTROSPEZIONE_DISABILITATA`. La rule è registrata in
`Program.cs:199`.

**Note (WARNING W2).** I test coprono **solo l'attivazione/disattivazione della rule per ambiente**:
nessun test esegue mai `query { __schema { ... } }` o `query { __type(name: ...) { ... } }` per
osservare l'errore. Gli scenari 18 e 19 sono quindi provati a metà (l'ambiente decide, sì; il blocco
effettivo e il codice d'errore, no — solo per lettura). Lo scenario 20 è invece completo: con
visitor `null` nessun errore di validazione può essere aggiunto, che è esattamente il suo AND.
Lo scenario 21 è PARTIAL perché `GraphQLTestHost` non registra la rule (W1): l'evidenza di runtime su
`__typename` non proviene da una catena che contiene la regola.

### Requirement 7 — Origini CORS ammesse da allowlist dichiarata

| # | Scenario | Test | Esito |
|---|----------|------|-------|
| 22 | Origine dichiarata nell'allowlist | (nessuno) | **UNTESTED** |
| 23 | IP pubblico non dichiarato | (nessuno) | **UNTESTED** |
| 24 | Sviluppo su più dispositivi in LAN | (nessuno) | **UNTESTED** |
| 25 | IP del server aggiunto senza toccare l'allowlist | (nessuno) | **UNTESTED** |
| 26 | Nuovo client legittimo da autorizzare | (nessuno) | **UNTESTED** |

**Evidenza strutturale (solo lettura).** `Program.cs:114-172` implementa il predicato esattamente
come descritto: `localhost`/`127.0.0.1` → ammessi; host in `allowedOrigins` (da `ALLOWED_ORIGINS`,
split su virgola con `TrimEntries`, confronto `OrdinalIgnoreCase`, più `SERVER_IP` aggiunta
automaticamente alle righe 126-130) → ammessi; IPv4 privati `192.168.x.x`, `10.x.x.x`,
`172.16–31.x.x` → ammessi; **tutto il resto rifiutato**, quindi un IP pubblico non dichiarato non è
più ammesso per deduzione. `AllowCredentials()` resta attivo (riga 170), il che è il motivo per cui
la deduzione era pericolosa.
Propagazione verificata: `docker-compose.yml:38-39` passa `ALLOWED_ORIGINS` e `SERVER_IP` al
container; `.env.production.example:15-21` documenta entrambe. Il MUST sulla configurabilità senza
rebuild è quindi soddisfatto.

**Note (WARNING W5).** La policy vive come lambda inline dentro `Program.cs` (top-level statements) e
non è estratta in una funzione o classe testabile: nessuno dei 5 scenari ha copertura automatica. Il
requirement è **implementato** ma non **eseguito** da alcun test.

---

### Riepilogo compliance

| Esito | Scenari |
|-------|---------|
| COMPLIANT | 15 / 26 |
| PARTIAL | 4 / 26 |
| UNTESTED | 7 / 26 |
| FAILING | 0 / 26 |

**Compliance summary**: 15/26 scenari pienamente compliant con prova di esecuzione, 4 parziali,
7 privi di test. **Nessuno scenario è violato dal codice**: le lacune sono di copertura, non di
comportamento — ogni scenario UNTESTED o PARTIAL è stato verificato leggendo il codice e risulta
implementato correttamente.

---

## Correctness (Static — Structural Evidence)

| Requirement | Stato | Note |
|-------------|-------|------|
| 1. Autorizzazione di tipo su ogni ramo root | Implementato | 15 `this.Authorize()` di tipo, 0 di campo; login fuori dallo schema |
| 2. Contratto enumerato dallo schema | Implementato | Enumera Query + Mutation + Subscription; catena di validation rule non identica a produzione (W1) |
| 3. Dati pubblici via `/api/public/*` | Implementato | `/api/public/business-name` già in esercizio; nessuna allowlist nel test |
| 4. Privilegio amministrativo distinto | Implementato | Guard prima di ogni I/O sui 4 resolver; privilegio dal flag, non dal nome |
| 5. Regola fine su `mutateUtente` | Implementato | Le 4 condizioni presenti e valutate prima di ogni scrittura |
| 6. Introspezione disabilitata fuori da Development | Implementato | Rule corretta e registrata; comportamento di blocco non eseguito da test (W2) |
| 7. CORS da allowlist dichiarata | Implementato | Predicato conforme; env propagate a compose e documentate; nessun test (W5) |

---

## Coherence (Design)

Nessun `design.md` per questa change (retroattiva). Le decisioni dichiarate nella sezione *Approach*
della proposal sono state confrontate con il codice:

| Decisione (proposal) | Seguita? | Note |
|----------------------|----------|------|
| 1. Autorizzazione al livello di tipo, non di campo | Sì | 15 `this.Authorize()`, 0 `.Authorize()` di campo |
| 1b. Rimozione del `.Authorize()` di campo su `mutateProdotto` | Sì | `VenditeMutations.cs:44-46` privo di autorizzazione di campo |
| 2. Guard admin riusato per ruoli e menu | Sì | `GestioneCassaGuards.GuardUtenteAmministratore` |
| 3. Regola fine su `mutateUtente` invece di guard admin secco | Sì | `AuthMutations.cs:207-228`; `ProfilePage` non è rotta (scenario 13 verde) |
| 4. Introspezione chiusa fuori da Development | Sì | Rule env-aware, catena unica |
| 5. CORS da dichiarazione invece che da deduzione | Sì | `Program.cs:114-172` |
| 6. Test come contratto derivato dallo schema | Sì, ampliata | Copre anche `Subscription`, oltre a quanto scritto nella proposal |

La tabella *Affected Areas* della proposal corrisponde ai file realmente presenti in albero: tutti i
12 file elencati esistono e hanno il contenuto dichiarato.

---

## Issues Found

**CRITICAL** (bloccanti per l'archive): **nessuno**.
Build verde, 362/362 test verdi, nessuno scenario violato dal codice, nessun requirement mancante.

**WARNING** (da sistemare, non bloccanti):

- **W1 — `GraphQLTestHost` non replica la catena completa di validation rule di produzione.**
  Il Requirement 2 impone "la stessa catena di validation rule registrata in produzione".
  `Program.cs:199` registra `.AddValidationRule<NoIntrospectionValidationRule>()`, il test host
  (`DuedGusto.Tests/Helpers/GraphQLTestHost.cs:55-61`) no. L'intento del MUST è rispettato — il test
  passa dal motore reale e non chiama i resolver direttamente — ma la lettera diverge. Causa
  probabile: `IWebHostEnvironment` non è registrato nel container di test, quindi la rule non si
  costruirebbe senza un fake.
- **W2 — Il blocco dell'introspezione non è mai eseguito da un test.**
  `NoIntrospectionValidationRuleTests` verifica solo se il visitor viene restituito per ambiente.
  Nessun test esegue `__schema`/`__type` né osserva il codice `INTROSPEZIONE_DISABILITATA`. Gli
  scenari 18, 19 e 21 restano parziali.
- **W3 — Scenario 11 (amministratore gestisce ruoli e menu) senza test.**
  È il percorso permissivo di 4 resolver amministrativi. Un guard troppo stretto non verrebbe
  intercettato dalla CI. Rischio funzionale, non di sicurezza.
- **W4 — Scenario 16 (non amministratore tenta di creare un utente) senza test.**
  Percorso `existingUser == null`: stesso `if` del caso testato, primo disgiunto non esercitato.
- **W5 — I 5 scenari CORS non hanno alcuna copertura automatica.**
  Il predicato è una lambda inline nei top-level statements di `Program.cs`, non estratta e non
  testabile allo stato attuale. L'intero Requirement 7 è verificato per sola lettura.

**SUGGESTION** (migliorie, non blocchi):

- **S1 — Il success criterion della proposal dice "358/358 test", la suite reale è 362/362.**
  La differenza è esattamente 4, cioè i quattro casi Theory su `Subscription`: conferma indipendente
  che l'enumerazione delle subscription è stata aggiunta dopo la stesura della proposal — la stessa
  divergenza sanata in questa verifica sul testo del Requirement 2. Allineare il criterio a 362
  renderebbe la proposal coerente con l'albero (non modificata in questa verifica: fuori dal mandato).
- **S2 — Estrarre il predicato CORS** in un metodo statico testabile (es.
  `CorsPolicyHelper.IsOriginAllowed(origin, allowedOrigins)`) chiuderebbe W5 con 5 test unitari
  diretti sugli scenari 22-26.
- **S3 — Registrare `NoIntrospectionValidationRule` in `GraphQLTestHost`** con un
  `IWebHostEnvironment` fake (già disponibile in `NoIntrospectionValidationRuleTests`) chiuderebbe
  W1, W2 e porterebbe gli scenari 18, 19 e 21 a COMPLIANT.
- **S4 — `backend/CLAUDE.md` è stale** su due punti che toccano questa change: documenta una mutation
  root `signIn(username, password)` che non esiste nello schema (il login è REST, come impone il
  Requirement 1) e afferma "Nessun progetto di test" mentre `DuedGusto.Tests` contiene 362 test.

---

## Modifiche applicate durante la verifica

Una sola, esplicitamente autorizzata dall'orchestratore:

**`openspec/changes/sicurezza-autorizzazione-graphql/specs/sicurezza/spec.md`** — Requirement 2.
L'elenco delle superfici enumerate dal test di contratto passa da
`` (`schema.Query.Fields`, `schema.Mutation.Fields`) `` a
`` (`schema.Query.Fields`, `schema.Mutation.Fields`, `schema.Subscription.Fields`) ``, allineando il
testo del requirement al codice (`AutorizzazioneAnonimaTests.RamiSubscription`) e allo scenario
"Subscription in anonimo" dello stesso documento. Nessun'altra riga della spec è stata toccata.

---

## Verdict

**PASS WITH WARNINGS**

Il codice in albero soddisfa tutti e 7 i requirement della delta: build pulita, 362/362 test verdi,
nessuno scenario contraddetto dal codice. Le riserve riguardano esclusivamente la **copertura**:
11 scenari su 26 (4 parziali + 7 senza test) sono verificati solo per lettura, concentrati su CORS,
introspezione e sui due percorsi permissivi dell'anagrafica.

> Verdetto aggiornato in sede di archiviazione: **PASS**, con due sole lacune di copertura residue
> (scenari 11 e 16) più una parzialità di transport (scenario 4). Vedi la sezione seguente.

---

## Aggiornamento post-verifica — 2026-08-11

Interventi entrati in albero **dopo** la stesura del report, ricontrollati in sede di archiviazione
eseguendo `dotnet test DuedGusto.Tests/DuedGusto.Tests.csproj`: **Superati 407, Non superati 0,
Ignorati 0**.

1. **Predicato CORS estratto e testato.** `backend/Common/CorsOriginPolicy.cs` sostituisce la lambda
   inline nei top-level statements (`Program.cs` legge le variabili d'ambiente e delega);
   `backend/DuedGusto.Tests/Unit/Common/CorsOriginPolicyTests.cs` copre i cinque scenari — con le
   region intitolate esattamente come gli scenari della spec — più le origini non parsabili come URI.
   **Chiude W5 e S2.**
2. **Blocco dell'introspezione eseguito davvero.**
   `backend/DuedGusto.Tests/Integration/GraphQL/IntrospezioneTests.cs` esegue `__schema` e `__type`
   in Production e Staging attraverso il motore GraphQL reale, osserva il rifiuto, `Data` nulla e
   l'errore prodotto; verifica inoltre l'introspezione funzionante in Development e `__typename` non
   bloccato in tutti e tre gli ambienti. `GraphQLTestHost` registra ora
   `NoIntrospectionValidationRule` con un `IWebHostEnvironment` fake, quindi la catena di validazione
   del test coincide con quella di `Program.cs`. **Chiude W1, W2 e S3.**
3. **Conteggio dei test allineato nella proposal** (358 → 407). **Chiude S1.**
4. **Correzione della delta sull'identificatore d'errore dell'introspezione** — vedi in fondo.

### Scenari che cambiano stato

| # | Scenario | Prima | Ora | Prova |
|---|----------|-------|-----|-------|
| 18 | Introspezione in produzione | PARTIAL | COMPLIANT | `IntrospezioneTests.FuoriDaDevelopment_QuerySchema_Bloccata("Production"/"Staging")` |
| 19 | Introspezione puntuale su un tipo | PARTIAL | COMPLIANT | `IntrospezioneTests.FuoriDaDevelopment_QueryType_Bloccata("Production"/"Staging")` |
| 20 | Introspezione in Development | COMPLIANT | COMPLIANT (prova rafforzata) | `InDevelopment_QuerySchema_RestituisceLoSchema`, `InDevelopment_QueryType_RestituisceICampiDelTipo` — non più solo visitor nullo, ma schema realmente restituito |
| 21 | `__typename` resta disponibile | PARTIAL | COMPLIANT | `IntrospezioneTests.Typename_NonBloccatoInNessunAmbiente` su Production, Staging e Development, con la rule in catena |
| 22 | Origine dichiarata nell'allowlist | UNTESTED | COMPLIANT | `CorsOriginPolicyTests.HostDichiaratoInAllowedOrigins_Ammesso`, `AllowedOrigins_ElencoMultiplo_...`, `ConfrontoHost_CaseInsensitive` |
| 23 | IP pubblico non dichiarato | UNTESTED | COMPLIANT | `IpPubblicoNonDichiarato_Rifiutato` (incluse le sponde `172.15`/`172.32`, `11.x`, `192.169`), `DominioSconosciuto_Rifiutato` |
| 24 | Sviluppo su più dispositivi in LAN | UNTESTED | COMPLIANT | `SviluppoLocale_Ammesso`, `LanPrivata_Ammessa` |
| 25 | IP del server aggiunto senza toccare l'allowlist | UNTESTED | COMPLIANT | `ServerIp_AmmessoSenzaDuplicarloInAllowedOrigins`, `ServerIp_ConSpaziEsterni_VieneNormalizzata`, `ServerIp_NonValorizzata_NonAggiungeNulla` |
| 26 | Nuovo client legittimo da autorizzare | UNTESTED | COMPLIANT | `HostAggiuntoAdAllowedOrigins_PassaDaRifiutatoAdAmmesso` |

### Riepilogo compliance aggiornato

| Esito | Scenari |
|-------|---------|
| COMPLIANT | 23 / 26 |
| PARTIAL | 1 / 26 (scenario 4) |
| UNTESTED | 2 / 26 (scenari 11 e 16) |
| FAILING | 0 / 26 |

### Debito residuo dichiarato (aperto all'archiviazione)

Nessuno di questi è di sicurezza: sono percorsi **permissivi** e una parzialità di transport. Restano
scritti qui perché l'archivio dica la verità su cosa non è coperto.

- **W3 — Scenario 11, "amministratore gestisce ruoli e menu": senza test.** Nessun caso esegue
  `mutateRuolo`/`deleteRuolo`/`mutateMenus`/`deleteMenus` con un utente amministratore. Un guard
  troppo stretto su quei quattro resolver non verrebbe intercettato dalla CI. Il percorso permissivo
  del guard condiviso è comunque provato altrove
  (`RiapriRegistroCassaTests.RiapriRegistroCassa_ConRuoloAmministratore_...`). Rischio funzionale.
- **W4 — Scenario 16, "non amministratore tenta di creare un utente": senza test.** È il primo
  disgiunto (`existingUser == null`) dello stesso `if` il cui secondo disgiunto è testato dallo
  scenario 14. Rischio di regressione silenziosa basso, non nullo.
- **Scenario 4, "subscription in anonimo": resta PARTIAL.** `AutorizzazioneAnonimaTests` esegue i
  documenti di subscription in-process via `IDocumentExecuter`: il meccanismo di negazione
  (autorizzazione di tipo su `GraphQLSubscriptions`) è provato, il **transport WebSocket reale** e
  `WebSocketAuthenticationService` non sono esercitati. È la stessa area che la proposal ha
  dichiarato Out of Scope per `AuthorizationRequired = true`.
- **S4 — `backend/CLAUDE.md` è ancora stale** su due punti toccati da questa change: documenta una
  mutation root `signIn(username, password)` che nello schema non esiste (il login è REST, come
  impone il Requirement 1) e afferma "Nessun progetto di test" mentre `DuedGusto.Tests` ne contiene
  407. Debito documentale, non di codice.

### Correzione applicata alla delta in sede di archiviazione

Il Requirement 6 e gli scenari 18/19 affermavano che il rifiuto dell'introspezione arriva "con
codice `INTROSPEZIONE_DISABILITATA`". **È falso.** `NoIntrospectionError` passa quella stringa al
parametro `number` del costruttore di `ValidationError`, quindi finisce in
`ValidationError.Number`; il `Code` osservabile è **`NO_INTROSPECTION`**, che GraphQL.NET deriva dal
nome della classe — la stessa convenzione di `AccessDeniedError` → `ACCESS_DENIED`, già in uso nel
progetto. `IntrospezioneTests` asserisce entrambi e lo documenta nei propri commenti.

Peggio: `Program.cs:169` imposta `ExposeExtensions = builder.Environment.IsDevelopment()`, quindi
**in produzione il client non vede né `code` né `number`**, solo il messaggio. Un requirement che
poggia su un codice invisibile proprio nell'ambiente che vuole proteggere non è verificabile dove
conta. Il requirement è stato quindi riscritto sul **comportamento** (richiesta rifiutata in
validazione, nessuna informazione di schema restituita), con gli identificatori come dettaglio
diagnostico e la nota esplicita sulla loro visibilità limitata a Development.

Il codice di produzione **non è stato toccato**: la convenzione inglese derivata dal nome della
classe è coerente col resto del progetto.
