# API Pubblica Specification

**Domain**: api-pubblica
**Status**: Active
**Ultimo aggiornamento**: 2026-08-13

Change incorporate in questa spec:

| Change | Archiviata il | Contenuto |
|--------|---------------|-----------|
| vetrina-api-pubblica | 2026-08-13 | Spec iniziale del dominio: le tre rotte anonime `/api/public/{site,menu,galleria}`, ciò che non vi compare mai, header di cache come contratto, CORS senza credenziali, filtro di pubblicazione condiviso, prezzo con fallback, raggruppamento e ordinamento, tetto dichiarato, DTO che espone la chiave e non l'URL |

## Purpose

Definire il **contratto JSON che il sistema espone a un visitatore senza alcuna credenziale**:
tre rotte in sola lettura sotto `/api/public/`, la loro forma esatta, ciò che vi compare e —
soprattutto — ciò che **non vi deve comparire mai**.

Il dominio esiste separato perché il criterio che lo governa è opposto a quello di tutto il
resto del backend. Nel resto del sistema la protezione è una verifica: si autentica, si
controlla un ruolo, si nega. Qui non c'è nulla da negare, quindi la sola difesa è la **forma
della risposta**: un campo contabile non finisce fuori perché qualcuno si ricorda di filtrarlo,
ma perché la query non lo seleziona, il tipo di ritorno non lo possiede e un test lo scopre
prima della CI. È la dottrina già scritta nel codice — *"REST è la corsia del pubblico,
GraphQL quella del privato… dove la superficie è chiusa per costruzione invece che aperta per
default"* ([`MediaController.cs:28-35`](../../../backend/Controllers/MediaController.cs),
[`AutorizzazioneAnonimaTests.cs:21-23`](../../../backend/DuedGusto.Tests/Integration/GraphQL/AutorizzazioneAnonimaTests.cs)) —
e questa spec ne è il **primo consumatore**.

**Fuori scope in questa fase**: `GET /api/public/eventi`, `/eventi/{slug}`, `/promozioni`,
`/contenuti` e `POST /api/public/prenotazioni` (Fasi 3-5); il progetto Astro che consuma queste
rotte; il micro-cache nginx e qualunque modifica sotto `deploy/` (Fase 6).

**Stato verificato del codice prima della change**: non esiste alcun `PublicController` né
alcuna cartella `Controllers/Public/`; `backend/Controllers/` contiene solo `AuthController.cs`
e `MediaController.cs`; l'unica rotta pubblica reale è la minimal API
`app.MapGet("/api/public/business-name", …)`
([`Program.cs:358`](../../../backend/Program.cs)), chiamata dal bootstrap del frontend
prima del login ([`main.tsx:43`](../../../duedgusto/src/main.tsx)); non è registrato alcun
middleware di caching (né `AddResponseCaching` né `AddOutputCache`) e
`grep -rn "proxy_cache" deploy/nginx/` non produce alcun risultato; `app.UseCors("AllowSpecificOrigins")`
è globale e la sua policy usa `AllowCredentials()`.

---

## Superficie REST introdotta

**Tre rotte, e nient'altro.** Il controller MUST NOT contenere alcuna quarta action, nemmeno
come stub delle fasi successive: una rotta che risponde `[]` è indistinguibile da una rotta
rotta, e il consumatore di Fase 3 la troverebbe già "esistente".

| Rotta | Metodo | Autenticazione | `Cache-Control` |
|---|---|---|---|
| `/api/public/site` | GET | nessuna | `public,max-age=300` |
| `/api/public/menu` | GET | nessuna | `public,max-age=60` |
| `/api/public/galleria` | GET | nessuna | `public,max-age=300` |

```
GET /api/public/site
{
  "insegna": "2D Gusto Bar",
  "indirizzo": { "via": "…", "cap": "36016", "citta": "Thiene", "provincia": "VI", "paese": "IT" },
  "geo":       { "latitudine": 45.70…, "longitudine": 11.47… },   // l'oggetto è null se non impostate
  "contatti":  { "telefono": "…", "email": "…" },
  "social":    { "instagram": "https://…", "facebook": "https://…" },
  "orari":     { "apertura": "07:00", "chiusura": "21:00",
                 "giorniOperativi": [true,true,true,true,true,true,false],   // null se illeggibile
                 "timezone": "Europe/Rome" },                     // ← da BusinessSettings
  "chiusure":  [ { "data": "2026-08-13", "descrizione": "Ferie", "motivo": "FERIE" } ],
                                                                  // ← da GiorniNonLavorativi;
                                                                  //   una voce per DATA, [] se non ce ne sono
  "seo":       { "titoloDefault": "…", "descrizioneDefault": "…",
                 "immagineOg": { …immagine } },                   // null se non impostata
  "oraInizioTemaSera": "18:00"
}

GET /api/public/menu
{
  "categorie": [ { "nome": "Caffetteria",
                   "prodotti": [ { "id": 42, "nome": "Caffè", "descrizione": "…",
                                   "prezzo": 1.20, "allergeni": "…",
                                   "novita": false, "consigliato": true,
                                   "immagine": { …immagine } } ] } ],
  "totaleProdottiPubblicati": 87,
  "limiteApplicato": 300,
  "troncato": false
}

GET /api/public/galleria
{ "immagini": [ { …immagine } ] }

// forma condivisa da menu e galleria — una sola per tutta l'API pubblica
immagine = { "chiave": "2026/08/caffe-a1b2c3", "larghezzeDisponibili": [400,800,1200,1600],
             "larghezza": 2400, "altezza": 1600, "testoAlternativo": "…",
             "didascalia": "…", "focale": "50% 40%", "placeholder": "data:image/…" }
```

**Non appartengono a questa superficie, in nessuna delle tre rotte**: `codice`, `aliquotaIva`,
`attivo`, `categoria` (contabile), `unitaDiMisura`, `createdAt`, `updatedAt`, `vatRate`,
`giornaleImportoSabato`, `giornaleImportoFeriale`, `settingsId`, `turnstileSiteKey` e i campi
`prenotazioni*`.

---

## Dominio: Accesso anonimo e chiusura della superficie

### Requirement: Le tre rotte rispondono a un client senza alcuna credenziale

Le tre rotte MUST essere raggiungibili in HTTP `GET` da un client che non invia alcun header
`Authorization` e alcun cookie, e MUST rispondere `200` con corpo JSON. Il controller MUST
dichiarare esplicitamente l'accesso anonimo, anche se oggi nessun filtro globale né alcuna
`FallbackPolicy` lo renderebbero necessario: la dichiarazione descrive l'intenzione a chi
legge — il fratello `MediaController` porta `[Authorize]` sulla stessa riga, e il contrasto è
l'informazione — e sopravvive al giorno in cui una policy di fallback chiuderà il resto
dell'app.

Il controller MUST NOT portare alcuna richiesta di autorizzazione a livello di classe o di
action. Le rotte MUST NOT accettare alcun parametro di query, alcun filtro libero e alcuna
paginazione: il costo di ogni risposta MUST essere fisso e indipendente da qualunque input del
chiamante.

Le tre rotte MUST NOT impostare alcun cookie.

Un token valido inviato da un chiamante autenticato MUST essere semplicemente ignorato: la
risposta MUST essere identica byte per byte a quella ricevuta da un anonimo, perché **non
esiste alcun dato riservato che queste rotte possano decidere di mostrare in più**.

#### Scenario: Lettura completamente anonima

- GIVEN un client HTTP che non invia né header `Authorization` né cookie
- WHEN richiede `/api/public/site`, `/api/public/menu` e `/api/public/galleria`
- THEN ognuna risponde `200` con un corpo JSON valido
- AND nessuna delle tre risposte contiene un header `Set-Cookie`

#### Scenario: Un token non cambia la risposta

- GIVEN un utente amministratore autenticato
- WHEN richiede `/api/public/menu` inviando il proprio `Authorization: Bearer …`
- THEN la risposta è identica a quella ottenuta senza alcun header

#### Scenario: L'intenzione di anonimato è dichiarata e non cancellabile per distrazione

- GIVEN il controller delle rotte pubbliche
- WHEN se ne ispezionano gli attributi
- THEN dichiara esplicitamente l'accesso anonimo
- AND non porta alcun attributo di autorizzazione, né sulla classe né su alcuna action

#### Scenario: Nessun input amplifica il lavoro del server

- GIVEN una qualsiasi delle tre rotte
- WHEN un chiamante aggiunge parametri di query arbitrari all'URL
- THEN la risposta è identica a quella senza parametri
- AND nessun parametro modifica il numero di righe lette dal database

#### Scenario: Nessuna quarta rotta pubblica

- GIVEN il controller della change applicata
- WHEN se ne enumerano le action
- THEN sono esattamente tre
- AND non esiste alcuno stub per eventi, promozioni, contenuti o prenotazioni

#### Scenario: La rotta del nome attività resta dov'è e continua a rispondere

- GIVEN il sistema dopo la change
- WHEN un client anonimo richiede `/api/public/business-name`
- THEN risponde come prima della change
- AND l'applicazione frontend completa il proprio bootstrap: il login riesce e il titolo
  dell'attività compare in intestazione

### Requirement: 🔴 Nessun campo contabile o interno può comparire in una risposta pubblica

Le risposte pubbliche MUST essere prodotte da tipi dedicati che **non possiedono** i campi
riservati: la protezione MUST essere strutturale e MUST NOT consistere nell'omettere in
serializzazione campi che il tipo possiede. In particolare:

1. la lettura dal database MUST essere una **proiezione** che non seleziona le colonne
   riservate — non "le legge e non le serializza";
2. i tipi di risposta MUST NOT dichiarare alcuna property fra `Codice`, `AliquotaIva`, `Attivo`,
   `Categoria`, `UnitaDiMisura`, `CreatedAt`, `UpdatedAt`, `VatRate`, `GiornaleImportoSabato`,
   `GiornaleImportoFeriale`, `SettingsId`, `TurnstileSiteKey` e i campi delle prenotazioni;
3. il divieto MUST valere **ricorsivamente** su ogni tipo annidato raggiungibile dalle risposte,
   non solo sui tipi di primo livello;
4. ogni action MUST dichiarare un tipo di ritorno che è uno di quei tipi dedicati, e MUST NOT
   poter restituire un'entità del database;
5. l'elenco delle property di ciascun tipo di risposta MUST essere pinnato in modo **esatto**:
   né un campo in più né uno in meno.

Il punto (3) non è cautela: `/api/public/site` **compone** i dati del sito con quelli di
`BusinessSettings`, ed è esattamente al punto di composizione che l'aliquota IVA e il costo del
giornale salirebbero a bordo senza che nessuno lo scriva.

Il divieto sul nome `Categoria` MUST applicarsi anche alla categoria **di vetrina**, che è
legittima: la categoria di menu MUST chiamarsi diversamente. Un nome ambiguo fra due domini è
la strada più breve perché la categoria contabile finisca come intestazione sul sito.

**Verifica per mutazione**: aggiungere una property vietata a un tipo di risposta, o far
restituire un'entità a un'action, MUST far fallire i test; ripristinare MUST farli tornare
verdi. Un test che resta verde dopo l'iniezione della violazione non sta proteggendo nulla.

#### Scenario: Il tipo di risposta del prodotto ha esattamente i campi dichiarati

- GIVEN i tipi di risposta della change applicata
- WHEN si enumerano le property del tipo che rappresenta un prodotto pubblico
- THEN l'elenco corrisponde **esattamente** a quello dichiarato nel contratto, senza aggiunte né
  omissioni

#### Scenario: Nessun tipo annidato porta un campo riservato

- GIVEN i tipi di risposta della change applicata
- WHEN si visitano ricorsivamente tutti i tipi raggiungibili dai tipi di ritorno delle tre action
- THEN nessuno di essi possiede una property con un nome dell'elenco riservato

#### Scenario: Verifica per mutazione del divieto

- GIVEN i test della superficie pubblica verdi
- WHEN si aggiunge una property `AliquotaIva` a un tipo annidato di secondo livello
- THEN almeno un test fallisce nominando il tipo e il campo
- AND rimuovendo la property i test tornano verdi

#### Scenario: Un'action non può restituire un'entità

- GIVEN il controller della change applicata
- WHEN si ispezionano i tipi di ritorno delle tre action
- THEN ognuno appartiene ai tipi dedicati alle risposte pubbliche
- AND nessuno è un'entità del database

#### Scenario: La query non legge le colonne riservate

- GIVEN la lettura del menu
- WHEN si ispeziona l'istruzione SQL generata
- THEN non contiene `Codice`, `AliquotaIva`, `CreatedAt`, `UpdatedAt`, `Categoria`,
  `UnitaDiMisura` né `Attivo`

#### Scenario: Controprova sul JSON reale

- GIVEN un sistema con prodotti pubblicati e le impostazioni del sito valorizzate
- WHEN si enumerano tutte le chiavi presenti nei corpi JSON delle tre rotte
- THEN nessuna chiave corrisponde a un nome dell'elenco riservato

#### Scenario: La categoria di menu non si chiama come quella contabile

- GIVEN il tipo che rappresenta una categoria di menu
- WHEN se ne enumerano le property
- THEN la categoria di vetrina non è esposta con il nome `Categoria`

### Requirement: Gli header di cache sono un contratto, non una cache

Ogni rotta MUST dichiarare la propria durata di cache e MUST emettere un `Cache-Control`
pubblico con quella durata: `300` secondi per `site` e `galleria`, `60` secondi per `menu`.
Il sistema MUST NOT registrare alcun middleware di caching e MUST NOT memorizzare alcuna
risposta lato server in questa fase: ciò che si introduce è **l'header**, non la cache.

La durata di `menu` MUST essere lo stesso numero che il reverse proxy userà in Fase 6, così che
i due valori non possano divergere: sono la stessa decisione, scritta due volte di proposito.

La verifica MUST avvenire **leggendo l'header o i metadati della rotta**, e MUST NOT consistere
nel confronto con una stringa letterale: la piattaforma emette `public,max-age=300` senza spazio
dopo la virgola, mentre il criterio della proposal è scritto `public, max-age=300`. È la stessa
direttiva, e un criterio verificato per uguaglianza di stringa fallirebbe su una differenza che
non esiste.

Nessuna delle tre risposte MUST contenere `Set-Cookie`: una risposta cacheabile che porta un
cookie è la premessa del guasto in cui una cache condivisa serve la sessione di un utente a un
altro.

#### Scenario: Durata dichiarata per ogni rotta

- GIVEN il controller della change applicata
- WHEN si ispezionano i metadati di cache delle tre action
- THEN `site` e `galleria` dichiarano 300 secondi e `menu` 60 secondi
- AND tutte e tre dichiarano una cache **pubblica** (condivisibile da un proxy)

#### Scenario: Header letto dalla risposta reale

- GIVEN il backend in esecuzione
- WHEN si richiedono le tre rotte ispezionando i soli header
- THEN ognuna riporta un `Cache-Control` pubblico con la durata attesa
- AND nessuna riporta un `Set-Cookie`

#### Scenario: Nessuna cache lato server

- GIVEN la configurazione dell'applicazione dopo la change
- WHEN si ispezionano i servizi e i middleware registrati
- THEN non è registrato alcun middleware di response caching o di output caching
- AND due richieste consecutive alla stessa rotta interrogano entrambe il database

#### Scenario: Il valore del menu coincide con quello previsto per il proxy

- GIVEN la durata dichiarata sulla rotta del menu
- WHEN la si confronta con la validità di cache prevista per il reverse proxy di Fase 6
- THEN i due numeri coincidono

### Requirement: CORS pubblico e senza credenziali

Le tre rotte MUST essere servite da una policy CORS **dedicata**, distinta da quella globale
dell'applicazione: MUST ammettere qualunque origine, MUST limitarsi al metodo `GET` e MUST NOT
ammettere credenziali. La policy globale con `AllowCredentials()` MUST restare invariata e MUST
continuare ad applicarsi a `/graphql` e a `/api/auth/*`.

Il motivo decisivo è la **cache**, non l'accesso: sotto la policy globale la risposta
conterrebbe un `Access-Control-Allow-Origin` variabile e un `Vary: Origin` su un corpo
dichiarato cacheabile per cinque minuti, e la correttezza dipenderebbe dal fatto che ogni cache
intermedia onori `Vary`. Con un valore costante non esiste variante, non esiste `Vary`, non
esiste la classe di bug. Il secondo motivo è di onestà del contratto: CORS protegge letture
**credenziali**, e qui non ce ne sono; dichiararlo aperto senza credenziali descrive
esattamente ciò che la rotta è.

⚠️ La policy dedicata dipende dal fatto che il middleware CORS legga i metadati di un endpoint
già selezionato. Il sistema MUST NOT introdurre una selezione di routing esplicita successiva
all'applicazione del CORS: in quel caso l'attributo smetterebbe di avere effetto **in silenzio**
e le rotte pubbliche tornerebbero sotto la policy credenziale. Il punto MUST essere annotato nel
codice accanto alla registrazione del CORS.

#### Scenario: Origine qualsiasi ammessa senza credenziali

- GIVEN il backend in esecuzione
- WHEN un browser da un'origine qualsiasi richiede `/api/public/menu`
- THEN la risposta ammette l'origine
- AND non dichiara di ammettere credenziali
- AND non contiene un `Vary: Origin` che faccia variare la risposta per origine

#### Scenario: Le rotte credenziali restano sotto la policy globale

- GIVEN la configurazione CORS dopo la change
- WHEN si ispezionano le policy applicate a `/graphql` e a `/api/auth/signin`
- THEN è quella globale con allowlist di host e credenziali, invariata rispetto a prima della
  change

#### Scenario: Sviluppo del sito dal browser

- GIVEN il progetto del sito servito in sviluppo su una porta locale diversa da quella del
  backend
- WHEN il browser richiede una delle tre rotte pubbliche
- THEN la richiesta non viene bloccata dal controllo di origine

---

## Dominio: `GET /api/public/menu`

### Requirement: 🔴 Il filtro di pubblicazione è la regola condivisa, non una seconda congiunzione

La rotta del menu MUST selezionare i prodotti applicando **la stessa identica regola** esposta
come `pubblicatoSulSito` (spec `vetrina-prodotti`), riusata da un punto condiviso e non
riscritta: il controller MUST NOT contenere alcuna congiunzione fra lo stato di attività in
cassa e la visibilità sul sito.

La regola MUST essere applicata **nel database** e non in memoria: il filtro MUST essere
tradotto nell'istruzione SQL, così che una richiesta anonima non materializzi l'intero listino
per poi scartarne la maggior parte. È una proprietà che non si vede finché il listino resta
piccolo, e per questo va pinnata adesso.

#### Scenario: Prodotto attivo e visibile compare

- GIVEN un prodotto con attività in cassa e visibilità sul sito entrambe attive
- WHEN un client anonimo richiede `/api/public/menu`
- THEN il prodotto compare nella risposta

#### Scenario: Prodotto visibile ma non attivo in cassa non compare

- GIVEN un prodotto marcato visibile sul sito e disattivato in cassa
- WHEN un client anonimo richiede `/api/public/menu`
- THEN il prodotto non compare in alcuna categoria della risposta
- AND non è conteggiato nel totale dei prodotti pubblicati

#### Scenario: Prodotto attivo ma non marcato visibile non compare

- GIVEN un prodotto attivo in cassa e non marcato visibile sul sito
- WHEN un client anonimo richiede `/api/public/menu`
- THEN il prodotto non compare nella risposta

#### Scenario: La disattivazione in cassa si riflette sul sito senza toccare la vetrina

- GIVEN un prodotto pubblicato che compare nel menu
- WHEN la cassa lo disattiva
- THEN alla richiesta successiva il prodotto non compare più nel menu
- AND nessun campo vetrina del prodotto è stato modificato

#### Scenario: Il filtro gira nel database

- GIVEN la lettura del menu
- WHEN si ispeziona l'istruzione SQL generata
- THEN contiene la condizione di pubblicazione nella clausola `WHERE`
- AND il numero di righe restituite dal database non è l'intero listino

### Requirement: 🔴 Il prezzo esposto è il fallback, e zero è un omaggio

Il prezzo esposto per ogni prodotto MUST essere il prezzo di vetrina quando questo è **non
null**, e il prezzo di listino in tutti gli altri casi. La regola MUST essere quella condivisa
(spec `vetrina-prodotti`) e MUST NOT essere riscritta nel controller.

🔴 **`PrezzoVetrina = 0` MUST essere esposto come `0` e MUST NOT ricadere sul prezzo di
listino.** Zero è un prezzo valido — un omaggio — e la sola assenza di valore è `null`. Una
implementazione che riscrivesse il fallback con un confronto "maggiore di zero" trasformerebbe
un omaggio nel prezzo pieno sul sito **senza produrre alcun errore**, e nessuno se ne
accorgerebbe fino all'arrivo del cliente al banco.

**Verifica per mutazione**: sostituire il fallback con una forma che tratti `0` come assenza
MUST far fallire un test dedicato; il caso `null` da solo resterebbe verde, ed è per questo che
i due casi MUST essere due scenari distinti.

#### Scenario: Prezzo di vetrina valorizzato

- GIVEN un prodotto pubblicato con prezzo di listino `3.80` e prezzo di vetrina `4.50`
- WHEN un client anonimo richiede `/api/public/menu`
- THEN il prezzo esposto per quel prodotto è `4.50`

#### Scenario: Prezzo di vetrina assente

- GIVEN un prodotto pubblicato con prezzo di listino `3.80` e prezzo di vetrina `null`
- WHEN un client anonimo richiede `/api/public/menu`
- THEN il prezzo esposto è `3.80`

#### Scenario: 🔴 Prezzo di vetrina pari a zero resta zero

- GIVEN un prodotto pubblicato con prezzo di listino `3.80` e prezzo di vetrina `0.00`
- WHEN un client anonimo richiede `/api/public/menu`
- THEN il prezzo esposto è `0.00`
- AND non è `3.80`

#### Scenario: Verifica per mutazione del fallback

- GIVEN i test del menu verdi
- WHEN si sostituisce il fallback con una forma che considera assente anche il valore zero
- THEN il test del prezzo pari a zero fallisce
- AND il test del prezzo assente resta verde, a dimostrazione che da solo non copre il caso

#### Scenario: Aggiornamento di listino visibile sul sito senza toccare la vetrina

- GIVEN un prodotto pubblicato senza prezzo di vetrina proprio
- WHEN la cassa ne aggiorna il prezzo di listino
- THEN il prezzo esposto dal menu diventa il nuovo prezzo di listino, entro il tempo di cache

### Requirement: Raggruppamento per categoria di vetrina, con un contenitore per gli esclusi

I prodotti MUST essere raggruppati per **categoria di vetrina**. Un prodotto pubblicato che non
ha alcuna categoria di vetrina MUST comparire comunque, dentro un gruppo dedicato denominato
`"Altro"`: una sparizione silenziosa è la stessa classe di guasto del troncamento muto, e chi
guarda il sito non ha modo di sapere che manca qualcosa.

🔴 Il sistema MUST NOT ricadere sulla categoria **contabile** quando la categoria di vetrina è
assente: è la strada più breve per far comparire un'etichetta di magazzino come intestazione sul
sito, ed è la ragione per cui quel nome è nell'elenco dei campi riservati.

Il nome del gruppo di raccolta MUST essere lo stesso per tutti i prodotti senza categoria: MUST
NOT generarsi un gruppo per prodotto.

#### Scenario: Prodotti raggruppati per categoria di vetrina

- GIVEN tre prodotti pubblicati con categoria di vetrina `"Caffetteria"` e due con `"Aperitivi"`
- WHEN un client anonimo richiede `/api/public/menu`
- THEN la risposta contiene due categorie, con tre e due prodotti rispettivamente

#### Scenario: Prodotto senza categoria di vetrina non sparisce

- GIVEN un prodotto pubblicato senza alcuna categoria di vetrina
- WHEN un client anonimo richiede `/api/public/menu`
- THEN il prodotto compare in un gruppo denominato `"Altro"`
- AND il totale dei prodotti pubblicati lo conteggia

#### Scenario: 🔴 La categoria contabile non compare mai come intestazione

- GIVEN un prodotto pubblicato con categoria contabile `"BEVANDE"` e nessuna categoria di vetrina
- WHEN un client anonimo richiede `/api/public/menu`
- THEN nessuna categoria della risposta si chiama `"BEVANDE"`
- AND il prodotto compare nel gruppo `"Altro"`

#### Scenario: Un solo contenitore per tutti gli esclusi

- GIVEN quattro prodotti pubblicati senza categoria di vetrina
- WHEN un client anonimo richiede `/api/public/menu`
- THEN esiste un solo gruppo `"Altro"` e contiene tutti e quattro i prodotti

#### Scenario: Categoria di vetrina composta di soli spazi

- GIVEN un prodotto pubblicato la cui categoria di vetrina è vuota o composta di soli spazi
- WHEN un client anonimo richiede `/api/public/menu`
- THEN il prodotto compare nel gruppo `"Altro"`
- AND non esiste alcun gruppo con nome vuoto

### Requirement: Ordinamento totale e stabile fra due richieste identiche

L'ordine dei prodotti dentro una categoria MUST essere determinato dall'ordinamento di vetrina,
poi dal nome mostrato, poi dall'identificativo del prodotto. Il terzo criterio MUST esistere e
MUST rendere l'ordine **totale**: senza, due prodotti con lo stesso ordinamento e lo stesso nome
si scambierebbero di posto fra due richieste, e una risposta cacheata servirebbe pagine diverse
a visitatori diversi.

L'ordine delle categorie MUST derivare dal **minimo** ordinamento di vetrina dei prodotti che
contengono, con il nome della categoria come criterio di parità. Non esiste un'entità categoria
con un ordine proprio, e questa regola dà all'amministratore una leva reale — abbassare
l'ordinamento di un prodotto fa salire la sua categoria — senza introdurne una.

#### Scenario: Ordine dei prodotti dentro la categoria

- GIVEN tre prodotti pubblicati della stessa categoria con ordinamenti `3`, `1` e `2`
- WHEN un client anonimo richiede `/api/public/menu`
- THEN compaiono nell'ordine `1`, `2`, `3`

#### Scenario: Ordine stabile a parità di ordinamento e nome

- GIVEN due prodotti pubblicati con lo stesso ordinamento e lo stesso nome mostrato
- WHEN si richiede `/api/public/menu` due volte senza modifiche intermedie
- THEN i due prodotti compaiono nello stesso ordine in entrambe le risposte

#### Scenario: Ordine delle categorie guidato dall'ordinamento dei prodotti

- GIVEN la categoria `"Aperitivi"` il cui prodotto con ordinamento più basso vale `10` e la
  categoria `"Caffetteria"` il cui minimo vale `1`
- WHEN un client anonimo richiede `/api/public/menu`
- THEN `"Caffetteria"` precede `"Aperitivi"`

#### Scenario: L'amministratore fa salire una categoria

- GIVEN due categorie nell'ordine visto sopra
- WHEN l'amministratore porta a `0` l'ordinamento di vetrina di un prodotto di `"Aperitivi"`
- THEN alla richiesta successiva `"Aperitivi"` precede `"Caffetteria"`

### Requirement: Il limite di 300 elementi si dichiara nella risposta

La rotta del menu MUST NOT restituire più di **300** prodotti. Il limite MUST essere una
costante del backend, MUST NOT essere configurabile dall'amministratore e MUST NOT essere
influenzabile dal chiamante: un numero che protegge da un guasto non va messo dove chi subisce
il guasto può alzarlo.

Il troncamento MUST essere **dichiarato nella risposta**: il corpo MUST contenere il conteggio
**reale** dei prodotti pubblicati (non la lunghezza della lista restituita), il limite applicato
e un indicatore booleano di troncamento. Il conteggio reale MUST essere ottenuto con lo stesso
predicato di pubblicazione.

Al superamento del limite il sistema MUST registrare un avviso lato server contenente il totale.
Chi guarda il sito vede meno piatti; chi guarda i log sa perché.

Il troncamento MUST essere applicato **sulla query ordinata, prima del raggruppamento**: con 301
prodotti si MUST perdere l'ultimo per ordinamento, e MUST NOT sparire un'intera categoria.

#### Scenario: Listino oltre il limite

- GIVEN 301 prodotti pubblicati
- WHEN un client anonimo richiede `/api/public/menu`
- THEN la somma dei prodotti di tutte le categorie della risposta è 300
- AND il conteggio reale dichiarato è 301
- AND il limite dichiarato è 300
- AND l'indicatore di troncamento è vero
- AND il server registra un avviso che riporta il totale

#### Scenario: Listino entro il limite

- GIVEN 87 prodotti pubblicati
- WHEN un client anonimo richiede `/api/public/menu`
- THEN la somma dei prodotti di tutte le categorie è 87
- AND il conteggio reale dichiarato è 87
- AND l'indicatore di troncamento è falso
- AND il server non registra alcun avviso di troncamento

#### Scenario: Il troncamento non fa sparire una categoria intera

- GIVEN 301 prodotti pubblicati distribuiti su più categorie, ordinati per ordinamento di vetrina
- WHEN un client anonimo richiede `/api/public/menu`
- THEN il prodotto assente è l'ultimo secondo l'ordinamento
- AND ogni categoria che contiene almeno un prodotto entro i primi 300 compare nella risposta

#### Scenario: Il limite non è alzabile dal chiamante

- GIVEN 301 prodotti pubblicati
- WHEN un client anonimo richiede il menu aggiungendo parametri di query che suggeriscono un
  limite diverso
- THEN la risposta contiene comunque 300 prodotti

#### Scenario: Il limite è una costante pinnata

- GIVEN il codice della change applicata
- WHEN si ispeziona la costante che definisce il limite del menu
- THEN vale 300
- AND non esiste alcun percorso che la legga da configurazione o dalle impostazioni del sito

---

## Dominio: `GET /api/public/site`

### Requirement: Identità del locale composta da due sorgenti, con una sola verità per dato

La rotta MUST comporre due sorgenti: i dati di identità, indirizzo, geolocalizzazione, contatti,
social, meta di default e ora di inizio del tema serale dalle impostazioni della vetrina (spec
`impostazioni-vetrina`); il nome dell'attività, gli orari di apertura e chiusura, i giorni
operativi e il fuso orario dalle impostazioni operative già usate da cassa e chiusure mensili.

Ogni dato MUST avere **una sola sorgente**: il sistema MUST NOT duplicare gli orari nelle
impostazioni della vetrina, e le impostazioni della vetrina MUST NOT poter dichiarare orari
propri. È ciò che rende impossibile per costruzione la classe di bug "il sito dice aperto fino
alle 21, la cassa alle 19".

La rotta MUST NOT esporre alcun dato contabile della sorgente operativa — aliquota IVA, importi
del giornale, identificativo delle impostazioni, marche temporali — né i campi non ancora
attivi delle impostazioni della vetrina.

#### Scenario: Orari dalla sorgente operativa

- GIVEN le impostazioni operative con apertura `07:00`, chiusura `21:00` e fuso `Europe/Rome`
- WHEN un client anonimo richiede `/api/public/site`
- THEN la risposta riporta quegli stessi valori

#### Scenario: Un cambio di orario in cassa si riflette sul sito

- GIVEN un sito che dichiara chiusura alle `21:00`
- WHEN un amministratore modifica l'orario di chiusura dalle impostazioni della cassa
- THEN entro il tempo di cache `/api/public/site` riporta il nuovo orario
- AND nessun dato delle impostazioni della vetrina è stato modificato

#### Scenario: Nessun dato contabile nella risposta

- GIVEN le impostazioni operative con aliquota IVA e importi del giornale valorizzati
- WHEN un client anonimo richiede `/api/public/site`
- THEN nessuna chiave della risposta corrisponde a quei dati

#### Scenario: I campi non ancora attivi non escono

- GIVEN le impostazioni della vetrina con la chiave del servizio antispam e i parametri delle
  prenotazioni valorizzati
- WHEN un client anonimo richiede `/api/public/site`
- THEN nessuno di quei valori compare nella risposta

#### Scenario: Un amministratore compila e il sito lo mostra

- GIVEN un amministratore che compila indirizzo, social e ora di inizio del tema serale dalla
  pagina di amministrazione e salva
- WHEN si richiede `/api/public/site` dopo il tempo di cache
- THEN i valori salvati compaiono nella risposta

### Requirement: La rotta dell'identità non fallisce mai su dati incompleti o malformati

`/api/public/site` MUST NOT rispondere `500` in nessuna circostanza determinata dallo stato dei
dati. In particolare:

- se **non esiste alcuna riga** di impostazioni della vetrina (installazione avviata senza seed),
  la rotta MUST rispondere `200` con i valori di default e MUST registrare un avviso lato server.
  Un `404` sull'identità del locale farebbe fallire l'intera pagina iniziale del sito; un corpo
  con i default produce un sito incompleto, che è un guasto **visibile e circoscritto**;
- se i **giorni operativi** persistiti non sono leggibili come una sequenza di sette booleani, il
  campo MUST essere esposto come `null` e il sistema MUST registrare un avviso. **Omettere gli
  orari settimanali è meglio che dichiararne di sbagliati**, e il consumatore che genera i dati
  strutturati per i motori di ricerca MUST omettere la sezione degli orari quando il campo è
  nullo;
- se la geolocalizzazione non è impostata, l'oggetto corrispondente MUST essere `null` e MUST NOT
  contenere valori inventati come zero.

### Requirement: Le eccezioni all'orario settimanale fanno parte del contratto pubblico

L'orario settimanale da solo NON è l'orario del locale. Le eccezioni — ferie, festività,
chiusure straordinarie — vivono nel calendario che la cassa già usa per non pretendere il
registro dei giorni chiusi, e `/api/public/site` MUST esporle: senza, il sito non ha **alcun**
modo di sapere che il locale è chiuso, e dichiara aperto un giorno di ferie senza un errore da
nessuna parte.

> Il guasto è documentato e non ipotetico: il 13 agosto 2026, con il bar in ferie dal 10 al 22
> registrate in cassa, la vetrina scriveva «Giovedì 07:00 — 20:00» e accendeva «Aperto».
> L'orario settimanale arrivava vivo e corretto — mancava il campo in cui l'eccezione potesse
> viaggiare.

La rotta MUST esporre **date già proiettate su un calendario**, una voce per data, in ordine
crescente, da oggi in avanti e per un orizzonte fisso. Il consumatore MUST NOT dover conoscere
il concetto di ricorrenza: la regola con cui una riga ricorrente diventa una data MUST essere la
**stessa** che usa la chiusura mensile, e MUST vivere in un solo punto del sistema. Due copie di
quella condizione sono due lati che devono concordare, e il giorno in cui divergessero la cassa
non pretenderebbe il registro del 25 dicembre mentre il sito direbbe «aperto».

Il giorno «oggi» MUST essere calcolato nel **fuso del locale** e non in quello del processo.

La rotta MUST NOT esporre gli identificativi del calendario (chiave del giorno, chiave delle
impostazioni) né il flag di ricorrenza, che è già stato risolto: ciò che esce sono una data, la
descrizione scritta dall'amministratore e il codice del motivo.

#### Scenario: Le ferie in corso arrivano al sito

- GIVEN un calendario con le ferie registrate da oggi ai prossimi giorni
- WHEN un client anonimo richiede `/api/public/site`
- THEN la risposta elenca quelle date, una per giorno, con la descrizione scritta in cassa

#### Scenario: Una chiusura passata non compare

- GIVEN una chiusura registrata per ieri
- WHEN un client anonimo richiede `/api/public/site`
- THEN quella data non compare: annunciare una chiusura già finita è un'informazione falsa

#### Scenario: Una festività ricorrente cade nell'anno corrente

- GIVEN una festività registrata con un anno passato e il flag di ricorrenza
- WHEN quella ricorrenza cade dentro l'orizzonte
- THEN la risposta la riporta con la data **di quest'anno**

#### Scenario: Nessuna chiusura è lo stato normale

- GIVEN un calendario senza chiusure nell'orizzonte
- WHEN un client anonimo richiede `/api/public/site`
- THEN il campo è un elenco vuoto e MUST NOT essere `null`: «non ce ne sono» non deve avere due
  forme

#### Scenario: Nessuna riga di impostazioni

- GIVEN un'installazione avviata senza seed, con la tabella delle impostazioni della vetrina vuota
- WHEN un client anonimo richiede `/api/public/site`
- THEN la risposta è `200` con i valori di default
- AND il server registra un avviso
- AND la risposta non è né `404` né `500`

#### Scenario: Giorni operativi illeggibili

- GIVEN impostazioni operative il cui campo dei giorni operativi contiene un valore non
  interpretabile come sequenza di sette booleani
- WHEN un client anonimo richiede `/api/public/site`
- THEN la risposta è `200` e il campo dei giorni operativi vale `null`
- AND il server registra un avviso
- AND nessuna eccezione viene propagata al client

#### Scenario: Geolocalizzazione non impostata

- GIVEN impostazioni della vetrina senza latitudine né longitudine
- WHEN un client anonimo richiede `/api/public/site`
- THEN l'oggetto della geolocalizzazione è `null`
- AND non contiene coordinate pari a zero

#### Scenario: Immagine di anteprima social non impostata

- GIVEN impostazioni della vetrina senza immagine di anteprima social
- WHEN un client anonimo richiede `/api/public/site`
- THEN il campo dell'immagine è `null`
- AND la risposta resta valida in ogni altra sua parte

---

## Dominio: `GET /api/public/galleria`

### Requirement: La galleria elenca i soli media della cartella dedicata e pubblicati

La rotta MUST restituire i media la cui cartella editoriale è quella dedicata alla galleria
(spec `media-assets`) **e** il cui stato di pubblicazione è attivo. Entrambe le condizioni MUST
valere: un media della cartella generale MUST NOT comparire, e un media della cartella della
galleria non pubblicato MUST NOT comparire.

Il confronto sulla cartella MUST essere di **uguaglianza secca** sul valore persistito e MUST
NOT applicare alcuna normalizzazione in lettura: la normalizzazione avviene in scrittura (spec
`media-assets`), così che il valore a database sia canonico invece che soltanto equivalente e
l'indice di ordinamento resti utilizzabile.

L'ordinamento MUST essere quello editoriale, con l'identificativo del media come criterio di
parità, così che due richieste identiche restituiscano lo stesso ordine.

Una galleria **vuota MUST essere uno stato legittimo** e MUST produrre `200` con un elenco
vuoto: nessuno ha ancora etichettato immagini. La diagnosi di questo stato vive
nell'amministrazione, dove la libreria mostra la cartella di ogni media.

#### Scenario: Solo i media della cartella dedicata

- GIVEN due media pubblicati nella cartella della galleria e tre nella cartella generale
- WHEN un client anonimo richiede `/api/public/galleria`
- THEN la risposta contiene esattamente i due media della galleria

#### Scenario: Media non pubblicato escluso

- GIVEN un media nella cartella della galleria con stato di pubblicazione disattivo
- WHEN un client anonimo richiede `/api/public/galleria`
- THEN il media non compare nella risposta

#### Scenario: Galleria vuota

- GIVEN nessun media nella cartella della galleria
- WHEN un client anonimo richiede `/api/public/galleria`
- THEN la risposta è `200` con un elenco vuoto
- AND non è un errore

#### Scenario: Ordine stabile

- GIVEN due media della galleria con lo stesso valore di ordinamento
- WHEN si richiede `/api/public/galleria` due volte senza modifiche intermedie
- THEN i due media compaiono nello stesso ordine in entrambe le risposte

#### Scenario: Un'immagine appena etichettata compare

- GIVEN un media pubblicato nella cartella generale
- WHEN un amministratore ne cambia la cartella in quella della galleria
- THEN entro il tempo di cache il media compare in `/api/public/galleria`

---

## Dominio: Forma dell'immagine nella superficie pubblica

### Requirement: Una sola forma di immagine per tutta l'API pubblica

Menu e galleria MUST esporre l'immagine nella **stessa identica forma**, così che il consumatore
abbia un solo tipo da gestire: chiave di storage, larghezze disponibili, dimensioni
dell'originale, testo alternativo, didascalia, punto focale e placeholder.

Le dimensioni MUST essere esposte perché il consumatore possa dichiararle nel markup ed evitare
lo spostamento del contenuto durante il caricamento. Il punto focale MUST essere esposto nella
forma già utilizzabile dal client, senza conversioni.

#### Scenario: Stessa forma nelle due rotte

- GIVEN un media assegnato a un prodotto pubblicato e presente anche nella galleria
- WHEN si confrontano l'oggetto immagine del menu e quello della galleria
- THEN hanno lo stesso insieme di campi

#### Scenario: Prodotto senza immagine

- GIVEN un prodotto pubblicato senza immagine associata
- WHEN un client anonimo richiede `/api/public/menu`
- THEN il prodotto compare con il campo immagine valorizzato a `null`
- AND non viene omesso dalla risposta

### Requirement: Il DTO espone la chiave, non l'URL

L'immagine MUST essere esposta tramite la sua **chiave di storage**, senza prefisso di serving e
senza host. Il backend MUST NOT comporre URL assolute e MUST NOT esporre alcun nome host nella
risposta: la chiave non conosce l'ambiente, il prefisso è *serving* e non dato, e una risposta
cacheata per cinque minuti che contenesse un hostname resterebbe sbagliata per cinque minuti
dopo qualunque cambio di dominio o di reverse proxy.

La composizione dell'URL MUST essere responsabilità del consumatore, che MUST distinguere due
prefissi diversi: quello con cui **legge le rotte API server-side** e quello con cui il
**browser carica le immagini**. Confonderli produce markup che funziona in ogni prova
server-side e si rompe per ogni visitatore.

#### Scenario: Nessuna URL assoluta nella risposta

- GIVEN una qualsiasi delle tre rotte con immagini nella risposta
- WHEN si ispezionano i valori dei campi immagine
- THEN nessuno contiene uno schema `http`/`https` né un nome host
- AND la chiave non contiene il prefisso di serving dei media

#### Scenario: La risposta non contiene la base URL dei media

- GIVEN il corpo JSON di `/api/public/site`
- WHEN se ne enumerano le chiavi
- THEN non esiste alcun campo che dichiari la base URL dei media

### Requirement: Le larghezze disponibili sono numeri, e una riga malformata non produce un errore

Le larghezze disponibili MUST essere esposte come elenco di numeri interi: il consumatore MUST
NOT dover interpretare una stringa per costruire il proprio insieme di sorgenti responsive.

La conversione MUST essere **tollerante**: un valore persistito vuoto MUST produrre un elenco
vuoto e un valore non numerico MUST essere scartato senza sollevare eccezioni. In una rotta
anonima un'eccezione su una riga malformata è un `500` servito a un visitatore.

La conversione MUST esistere in **un solo punto** del backend, riusato da tutti i consumatori
esistenti: al momento della change ne esistono due implementazioni divergenti, una delle quali
solleva un'eccezione su input sporco.

#### Scenario: Larghezze esposte come numeri

- GIVEN un media con larghezze disponibili `400`, `800`, `1200` e `1600`
- WHEN compare in una risposta pubblica
- THEN il campo corrispondente è un elenco di quattro numeri interi

#### Scenario: Valore persistito vuoto

- GIVEN un media il cui elenco di larghezze persistito è vuoto
- WHEN compare in una risposta pubblica
- THEN il campo corrispondente è un elenco vuoto
- AND la risposta è `200`

#### Scenario: Valore persistito malformato

- GIVEN un media il cui elenco di larghezze persistito contiene un valore non numerico
- WHEN compare in una risposta pubblica
- THEN i valori non numerici vengono scartati e i restanti esposti
- AND la risposta è `200` e non `500`

#### Scenario: Una sola conversione nel repository

- GIVEN il codice della change applicata
- WHEN si cercano le conversioni da elenco persistito a numeri
- THEN esiste una sola implementazione
- AND i consumatori preesistenti la richiamano invece di implementarla
