# Media Assets Specification

**Domain**: media-assets
**Status**: Active
**Ultimo aggiornamento**: 2026-08-13

Change incorporate in questa spec:

| Change | Archiviata il | Contenuto |
|--------|---------------|-----------|
| vetrina-fondamenta-media | 2026-08-13 | Spec iniziale del dominio: upload autenticato, elaborazione (validazione, orientamento, strip dei metadati, varianti responsive, LQIP), collocazione su filesystem, eliminazione protetta dai riferimenti, durabilità rispetto a deploy e backup |
| vetrina-api-pubblica | 2026-08-13 | Secondo referente dei media (anteprima social) con verifica **prima** di toccare il disco; cartella normalizzata in scrittura con valore canonico `galleria`; cartelle suggerite dal server; una sola conversione, tollerante, dell'elenco delle larghezze |

## Purpose

Definire il comportamento end-to-end della gestione delle immagini del sistema: caricamento
autenticato, elaborazione (validazione, orientamento, rimozione dei metadati, varianti
responsive, placeholder), collocazione dei file su filesystem, esposizione in lettura,
eliminazione protetta dai riferimenti, e **continuità dei file rispetto a deploy e backup**.

È il primo dominio del progetto che persiste dati fuori dal database: le sue regole di
collocazione e di durabilità sono requisiti verificabili quanto quelle applicative, perché
una `Chiave` nel database senza il file corrispondente è un errore silenzioso che si vede
solo a schermo, giorni dopo.

L'**esposizione pubblica** dei media a visitatori anonimi non è definita qui: è la spec
`api-pubblica`, che consuma questo dominio senza modificarne le regole. Introdotta da
`vetrina-fondamenta-media`, questa spec nasceva con quell'esposizione dichiarata fuori scope
(«nessun endpoint pubblico li elenca»); da `vetrina-api-pubblica` esiste, e la cartella
`galleria` è il suo unico filtro.

**Stato verificato del codice prima di `vetrina-fondamenta-media`**: nessuna entità `MediaAsset`, nessun
`MediaController`, nessun riferimento a `ImageSharp` o `MEDIA_ROOT` nel repository;
`backend/Controllers/` contiene solo `AuthController.cs`; `Program.cs` non registra
`UseStaticFiles`; il servizio `backend` di `docker-compose.yml` non ha alcuna sezione
`volumes:`; `deploy/nginx/duedgusto.conf` non ha alcuna `location /media/`;
`deploy/scripts/backup.sh` esegue **solo** `mysqldump`.

---

## Modifiche allo schema GraphQL e superficie REST

La regola di collocazione è quella già scritta nel codebase: **REST è la corsia del
pubblico, GraphQL quella del privato**. Il CRUD dei media è privato e riservato agli
amministratori, quindi vive in GraphQL; REST ospita **soltanto** ciò che GraphQL non sa
trasportare.

| Operazione | Dove |
|---|---|
| Upload di un file | `POST /api/media` (REST, multipart) |
| Lettura delle costanti di limite | `GET /api/media/configurazione` (REST) |
| Elenco e ricerca dei media | `connection { mediaAssets }` |
| Modifica dei metadati editoriali | `vetrina { mutateMediaAsset }` |
| Eliminazione | `vetrina { eliminaMediaAsset }` |

L'upload resta REST per una ragione di **trasporto**, non di dominio: il client GraphQL del
progetto non dispone di un link per il multipart, e il client HTTP generico hardcoda
`Content-Type: application/json` e `JSON.stringify` del corpo, quindi non può inviare un
`FormData`. Introdurre la catena di link necessaria per un solo endpoint sarebbe una
dipendenza in più per un caso solo.

- **Nuovo output type `MediaAsset`** (`MediaAssetType`):

```graphql
type MediaAsset {
  mediaAssetId: Int!
  chiave: String!                 # chiave di storage, senza larghezza né estensione
  nomeOriginale: String!
  mimeType: String!
  larghezza: Int!                 # dimensioni dell'originale dopo auto-orient
  altezza: Int!
  larghezzeDisponibili: [Int!]!   # le larghezze effettivamente generate su disco
  testoAlternativo: String
  didascalia: String
  focale: String                  # punto focale in forma direttamente usabile dal client
  placeholder: String             # LQIP base64 inlineabile
  cartella: String!
  ordinamento: Int!
  pubblicato: Boolean!
  byteTotali: Long!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

- **Nuova connection di lettura**, sulla stessa forma delle altre liste del progetto:

```graphql
type ConnectionQuery {
  mediaAssets(first: Int, after: String, cursor: Int, where: String, orderBy: String): MediaAssetConnection
}
```

- **Nuove mutation, nel ramo root `vetrina`** (lo stesso di `mutateProdottoVetrina`, spec
  `vetrina-prodotti`):

```graphql
type VetrinaMutation {
  mutateMediaAsset(mediaAssetId: Int!, input: MediaAssetInput!): MediaAsset
  eliminaMediaAsset(mediaAssetId: Int!): Boolean
}

input MediaAssetInput {           # soli metadati editoriali
  testoAlternativo: String
  didascalia: String
  focale: String
  cartella: String!
  ordinamento: Int!
  pubblicato: Boolean!
}
```

`MediaAssetInput` MUST NOT contenere `chiave`, `mimeType`, `larghezza`, `altezza`,
`larghezzeDisponibili`, `placeholder` né `byteTotali`: sono prodotti dalla pipeline di
elaborazione e non sono dati editoriali. Il perimetro è imposto dalla forma dell'input, non
da un controllo nel resolver.

---

## Dominio: Modello dei dati e storage

### Requirement: Metadati nel database, binari sul filesystem

Il sistema MUST persistere per ogni immagine un record `MediaAsset` contenente **solo
metadati**. Nessuna colonna del database MUST contenere il contenuto binario dell'immagine
(nessun `BLOB`/`VARBINARY`), con l'unica eccezione del placeholder LQIP, che è per
definizione una miniatura testuale inlineabile.

Il campo `Chiave` MUST essere univoco a livello di database (indice UNIQUE) e MUST
identificare la **cartella di storage** dell'asset relativa alla radice dei media, senza
larghezza né estensione. Ogni file dell'asset MUST essere derivabile da `Chiave` senza
consultare altre colonne.

Il campo `Cartella` MUST essere trattato come etichetta editoriale di raggruppamento nella
libreria e MUST NOT influenzare in alcun modo il percorso dei file su disco: rinominare o
riorganizzare una cartella nella libreria MUST NOT invalidare alcuna URL già emessa.

`Cartella` MUST essere una **stringa libera** non nulla con default `"generale"`: il sistema
MUST NOT imporre un insieme chiuso di valori. L'insieme resta **aperto** — nessun elenco
chiuso, nessuna migrazione per ogni cartella futura; l'indice di ordinamento per cartella è
già adatto a entrambe le forme.

La cartella MUST però avere **una sola forma canonica**. Il valore MUST essere normalizzato
**in scrittura** — spazi rimossi e caratteri portati a minuscolo — sia nel percorso di
caricamento sia in quello di modifica, e il valore vuoto o composto di soli spazi MUST
continuare a diventare il valore di default.

La normalizzazione MUST avvenire in **scrittura e non in lettura**, per due ragioni entrambe
vincolanti:

1. una lettura che normalizzasse applicherebbe una funzione alla colonna dentro la condizione
   SQL, rendendo inutilizzabile l'indice per la selezione ordinata;
2. il confronto di uguaglianza si comporta in modo **diverso** fra il database di produzione,
   la cui collazione ignora le maiuscole, e il provider in memoria usato nei test, che
   confronta in modo ordinale. Un test verde direbbe poco sul comportamento reale, e
   viceversa. La normalizzazione in scrittura fa coincidere i due mondi e rende il valore
   persistito **canonico** invece che soltanto equivalente.

La cartella dedicata alla galleria pubblica MUST avere come valore canonico **`"galleria"`**,
in italiano e minuscolo. Il codebase è italiano fin dentro i valori dei dati (`generale`) e la
rotta pubblica si chiama `galleria`: un valore inglese sarebbe l'unico del modello dati, e una
rotta italiana che filtra su un valore inglese è una traduzione che esiste solo nella testa di
chi l'ha scritta.

(Precedentemente, prima di `vetrina-api-pubblica`: la cartella era «una stringa libera non
nulla con default `"generale"`», con la sola rimozione degli spazi e nessuna regola sulle
maiuscole. L'insieme chiuso era rimandato «a quando si sapranno le cartelle vere»: resta
rimandato, ma la forma canonica no.)

#### Scenario: Upload produce record e file coerenti

- GIVEN un amministratore autenticato e la radice dei media configurata
- WHEN carica un'immagine valida tramite `POST /api/media`
- THEN esiste un record `MediaAsset` con `Chiave` valorizzata, `Larghezza`, `Altezza`, `MimeType`, `NomeOriginale` e `Placeholder` non vuoto
- AND sotto la radice dei media esiste la cartella corrispondente a `Chiave` contenente tutte le varianti generate
- AND nessuna colonna della tabella dei media contiene il binario dell'immagine originale

#### Scenario: Chiave univoca a livello di database

- GIVEN un `MediaAsset` esistente con `Chiave = "2026/08/tagliere-misto-a1b2c3"`
- WHEN si tenta di inserire un secondo record con la stessa `Chiave`
- THEN l'inserimento viene rifiutato dal vincolo UNIQUE del database

#### Scenario: Cartella editoriale non tocca il disco

- GIVEN un `MediaAsset` con `Chiave = "2026/08/tagliere-misto-a1b2c3"` e `Cartella = "Piatti"`
- WHEN un amministratore cambia `Cartella` in `"Antipasti"`
- THEN i file su disco restano negli stessi percorsi
- AND `Chiave` resta invariata

#### Scenario: Normalizzazione in scrittura

- GIVEN un amministratore che modifica i metadati di un media
- WHEN inserisce `"  Galleria "` come cartella
- THEN il valore persistito è `"galleria"`

#### Scenario: Cartella vuota

- GIVEN un amministratore che modifica i metadati di un media
- WHEN lascia la cartella vuota o composta di soli spazi
- THEN il valore persistito è quello di default

#### Scenario: Normalizzazione anche in caricamento

- GIVEN un amministratore che carica un'immagine indicando `"GALLERIA"` come cartella di
  destinazione
- WHEN il caricamento va a buon fine
- THEN la cartella persistita è `"galleria"`

#### Scenario: Due grafie non producono due raggruppamenti

- GIVEN due media caricati indicando rispettivamente `"Galleria"` e `"galleria"`
- WHEN si osserva la libreria
- THEN appartengono allo stesso raggruppamento
- AND compaiono entrambi nella rotta pubblica della galleria

#### Scenario: La lettura non normalizza

- GIVEN la query che seleziona i media della galleria
- WHEN si ispeziona l'istruzione SQL generata
- THEN il confronto sulla cartella è un'uguaglianza secca sulla colonna
- AND non applica alcuna funzione di trasformazione alla colonna

#### Scenario: L'insieme delle cartelle resta aperto

- GIVEN un amministratore che modifica i metadati di un media
- WHEN inserisce una cartella non prevista, ad esempio `"eventi"`
- THEN il valore viene accettato e persistito normalizzato
- AND non viene richiesta alcuna modifica al codice o al database

#### Scenario: Nessun dato da migrare

- GIVEN il database prima dell'introduzione del valore canonico
- WHEN si cercano media con cartella pari al valore inglese `"gallery"`
- THEN non ne esiste alcuno
- AND la scelta del valore canonico non richiede alcuna migrazione di dati

### Requirement: Naming deterministico e non enumerabile

Il percorso di ogni variante MUST essere
`{anno}/{mese}/{slug}-{suffisso}/{larghezza}.{estensione}` relativo alla radice dei media,
dove:

- `anno` e `mese` derivano dall'istante di caricamento (`mese` a due cifre);
- `slug` deriva dal nome originale del file normalizzato a caratteri sicuri (minuscole,
  ASCII, separatore `-`);
- `suffisso` è una stringa casuale di 6 caratteri generata a ogni upload.

Il percorso MUST NOT essere derivabile dal solo nome del file caricato: due upload dello
stesso file MUST produrre due `Chiave` distinte e MUST NOT sovrascriversi. La
normalizzazione dello slug MUST NOT permettere che un nome file ostile (separatori di
percorso, `..`, caratteri di controllo) produca un percorso fuori dalla radice dei media.

#### Scenario: Percorso generato da un nome file reale

- GIVEN la radice dei media configurata e la data corrente ad agosto 2026
- WHEN un amministratore carica `Tagliere Misto.JPG`
- THEN `Chiave` ha la forma `2026/08/tagliere-misto-{6 caratteri}`
- AND le varianti sono file `{larghezza}.webp` e `{larghezza}.jpg` dentro quella cartella

#### Scenario: Due upload dello stesso file non collidono

- GIVEN un `MediaAsset` già creato da `menu.jpg`
- WHEN lo stesso `menu.jpg` viene caricato una seconda volta
- THEN viene creato un secondo `MediaAsset` con `Chiave` diversa dal primo
- AND nessun file del primo asset viene sovrascritto o rimosso

#### Scenario: Nome file ostile non esce dalla radice

- GIVEN la radice dei media configurata
- WHEN viene caricato un file il cui nome contiene separatori di percorso o `..` (es. `../../etc/passwd.jpg`)
- THEN lo slug generato non contiene separatori di percorso né `..`
- AND ogni file scritto si trova sotto la radice dei media

### Requirement: Punto focale e ordinamento editoriale

Il sistema MUST persistere il punto focale come **un solo valore**, nella forma
percentuale già direttamente utilizzabile dal client per il posizionamento del ritaglio
(es. `"50% 40%"`, orizzontale seguito da verticale). Il valore MUST essere nullable e
`null` MUST significare "centro", così che l'assenza di scelta editoriale non richieda di
persistere un default. Un valore non conforme al formato dichiarato MUST NOT essere
persistito.

La forma è deliberatamente quella di destinazione e non una coppia di numeri da ricomporre:
il consumatore non deve moltiplicare, formattare o ricordare in quale ordine stanno le due
coordinate, e non esiste alcun punto in cui la conversione possa divergere fra client.

Il campo `Ordinamento` MUST essere un intero con default `0` e MUST determinare, insieme a un
criterio deterministico di parità (es. data di creazione), l'ordine di presentazione nella
libreria: a parità di dati l'elenco MUST essere stabile tra due richieste identiche.

#### Scenario: Punto focale assente significa centro

- GIVEN un upload che non specifica il punto focale
- WHEN l'asset viene creato
- THEN il punto focale persistito è `null`
- AND il consumatore rende l'immagine centrata

#### Scenario: Punto focale valorizzato

- GIVEN un `MediaAsset` esistente
- WHEN un amministratore imposta il punto focale a `"50% 40%"`
- THEN il valore viene persistito così com'è
- AND è utilizzabile dal client senza alcuna conversione

#### Scenario: Punto focale in formato non valido rifiutato

- GIVEN un `MediaAsset` esistente
- WHEN un amministratore invia un punto focale che non rispetta il formato dichiarato (es. `"molto a sinistra"` o `"140%"`)
- THEN la modifica viene rifiutata con un errore esplicito
- AND il punto focale persistito resta invariato

#### Scenario: Ordine stabile della libreria

- GIVEN due `MediaAsset` con lo stesso valore di `Ordinamento`
- WHEN l'elenco dei media viene richiesto due volte di seguito senza modifiche intermedie
- THEN le due risposte presentano gli asset nello stesso ordine

---

## Dominio: Pipeline di elaborazione delle immagini

### Requirement: Validazione dei limiti prima del decode

Il sistema MUST rifiutare un upload che eccede i limiti **prima** di decodificare i pixel
dell'immagine. In particolare:

1. il limite di **dimensione in byte** MUST essere verificato prima di leggere l'intero
   contenuto in memoria;
2. il limite in **megapixel** MUST essere verificato leggendo le sole informazioni di
   intestazione dell'immagine, **senza** allocare il bitmap decompresso;
3. il **tipo di contenuto** MUST essere verificato sul contenuto reale del file e non sulla
   sola estensione o sull'header `Content-Type` dichiarato dal client.

Le soglie MUST essere definite in un solo punto del backend e i loro valori MUST essere
dichiarati:

| Soglia | Valore |
|---|---|
| Dimensione massima del file | **20 MB**, un file per richiesta |
| Megapixel massimi della sorgente | **50 Mpx** |
| Lato minimo della sorgente | **200 px** |
| Immagini animate (più di un fotogramma) | rifiutate |

La soglia di 50 Mpx copre ogni fotocamera di smartphone in circolazione (48 Mpx è il massimo
comune) e resta compatibile con il budget di memoria del container. Il prodotto
`megapixel massimi × byte per pixel × decodifiche concorrenti ammesse` MUST restare entro un
budget di memoria dichiarato per il container backend: un JPEG da 12 Mpx occupa circa 48 MB
una volta decompresso, e alcuni upload concorrenti su un VPS piccolo mandano il backend in
OOM, cioè mettono **la cassa** offline.

Le stesse costanti MUST essere **leggibili dal client** tramite un endpoint dedicato
(`GET /api/media/configurazione`), così che la validazione preventiva dell'interfaccia non
possa divergere da quella del backend: il client MUST NOT possedere una propria copia dei
valori. L'endpoint richiede l'autenticazione ma non il privilegio amministrativo, perché
espone soltanto costanti.

Ogni rifiuto MUST produrre un messaggio d'errore leggibile in italiano che distingua il caso
"file troppo grande", il caso "immagine troppo grande in pixel", il caso "immagine troppo
piccola", il caso "immagine animata non supportata" e il caso "non è un'immagine
supportata". In nessun caso di rifiuto MUST essere scritto un file su disco o creato un
record `MediaAsset`.

#### Scenario: File oltre il limite in byte

- GIVEN il limite di dimensione configurato
- WHEN un amministratore carica un file che lo eccede
- THEN la richiesta viene rifiutata con un errore leggibile che indica il limite
- AND nessun file viene scritto sotto la radice dei media
- AND nessun record `MediaAsset` viene creato

#### Scenario: Immagine con troppi pixel rifiutata senza decodifica

- GIVEN un file immagine di pochi MB che dichiara nell'intestazione dimensioni oltre la soglia di megapixel (es. 12000 × 10000)
- WHEN viene caricato
- THEN la richiesta viene rifiutata sulla base delle sole informazioni di intestazione
- AND il bitmap decompresso non viene mai allocato
- AND il processo backend non registra un picco di memoria proporzionale alle dimensioni dichiarate

#### Scenario: File non immagine con estensione ingannevole

- GIVEN un archivio ZIP rinominato in `foto.jpg`
- WHEN viene caricato
- THEN la richiesta viene rifiutata come contenuto non supportato
- AND nessun record e nessun file vengono creati

#### Scenario: Foto reale da smartphone accettata

- GIVEN una foto JPEG da 12 Mpx e circa 8 MB entro tutte le soglie
- WHEN viene caricata da un amministratore
- THEN l'upload viene accettato e le varianti vengono generate

#### Scenario: Il client legge i limiti dal server

- GIVEN un amministratore che apre la libreria dei media
- WHEN l'interfaccia si inizializza
- THEN richiede le costanti a `GET /api/media/configurazione`
- AND usa i valori ricevuti sia per la validazione preventiva sia per i tipi di file proposti nel selettore

#### Scenario: File troppo grande rifiutato prima dell'invio

- GIVEN un amministratore che seleziona un file oltre la dimensione massima dichiarata dal server
- WHEN conferma il caricamento
- THEN l'interfaccia mostra il messaggio di limite superato
- AND nessun byte del file viene inviato al backend

### Requirement: Rimozione completa dei metadati e orientamento corretto

Il sistema MUST applicare l'orientamento dichiarato nei metadati EXIF **prima** di generare
le varianti, e MUST rimuovere completamente EXIF, GPS, XMP e IPTC da **ogni** file
generato. Nessun file contenente i metadati originali MUST essere collocato sotto la radice
dei media servita dal web server: le foto del locale sono scatti da smartphone e portano
con sé le coordinate GPS del bar.

Il profilo colore ICC MAY essere preservato o convertito in sRGB, purché la scelta sia
dichiarata e uniforme.

`Larghezza` e `Altezza` persistiti MUST riflettere le dimensioni **dopo** l'applicazione
dell'orientamento.

#### Scenario: Nessun GPS nelle varianti pubblicate

- GIVEN una foto JPEG contenente tag EXIF GPS
- WHEN viene caricata e le varianti vengono generate
- THEN l'ispezione dei metadati (es. `exiftool`) su ogni file generato non mostra alcun tag GPS
- AND non mostra alcun altro tag EXIF, XMP o IPTC dell'originale

#### Scenario: Foto ruotata raddrizzata prima delle varianti

- GIVEN una foto con tag EXIF di orientamento pari a 6 (ruotata di 90°)
- WHEN viene caricata
- THEN le varianti generate sono orientate correttamente senza dipendere dal tag EXIF (che è stato rimosso)
- AND `Larghezza` e `Altezza` persistiti corrispondono alle dimensioni dopo la rotazione

#### Scenario: L'originale non resta servibile con i suoi metadati

- GIVEN una foto con metadati GPS caricata con successo
- WHEN si ispeziona il contenuto della cartella corrispondente a `Chiave`
- THEN non è presente alcun file che contenga i metadati dell'originale

### Requirement: Varianti responsive in WebP e JPEG

Per ogni asset il sistema MUST generare, per ciascuna larghezza dell'insieme
`[400, 800, 1200, 1600]`, una variante WebP e una variante JPEG, preservando le proporzioni
dell'originale. Il sistema MUST NOT ingrandire l'immagine: le larghezze superiori alla
larghezza dell'originale MUST NOT essere generate. Se l'originale è più stretto della
larghezza minima dell'insieme, il sistema MUST generare comunque una singola coppia di
varianti alla larghezza dell'originale.

L'insieme delle larghezze effettivamente generate MUST essere **persistito sul record**
(`LarghezzeDisponibili`) ed esposto in lettura, non dedotto dal consumatore: costruire un
`srcset` MUST richiedere la lettura di un dato, non la riapplicazione della regola di
generazione né una interrogazione del filesystem. Dedurlo da `Larghezza` funzionerebbe
soltanto finché la regola non cambia, e un `srcset` che contiene una variante inesistente
degrada in modo silenzioso e diverso da browser a browser — il tipo di rottura che in
sviluppo non si vede.

`LarghezzeDisponibili` MUST corrispondere esattamente alle varianti presenti su disco e
MUST NOT essere mai vuoto.

I parametri di qualità della compressione MUST essere dichiarati e uniformi tra gli asset.

#### Scenario: Originale ampio genera tutte le varianti

- GIVEN un'immagine originale larga 2400 px
- WHEN viene caricata
- THEN vengono generati 8 file: 4 larghezze (`400`, `800`, `1200`, `1600`) × 2 formati (`.webp`, `.jpg`)
- AND ogni variante mantiene le proporzioni dell'originale
- AND `LarghezzeDisponibili` vale `[400, 800, 1200, 1600]`

#### Scenario: Nessun ingrandimento

- GIVEN un'immagine originale larga 1000 px
- WHEN viene caricata
- THEN vengono generate solo le larghezze `400` e `800`, in entrambi i formati (4 file)
- AND non esiste alcuna variante `1200` o `1600`
- AND `LarghezzeDisponibili` vale `[400, 800]`

#### Scenario: Originale più stretto della larghezza minima

- GIVEN un'immagine originale larga 300 px
- WHEN viene caricata
- THEN viene generata una singola coppia di varianti alla larghezza 300 (`300.webp`, `300.jpg`)
- AND `LarghezzeDisponibili` vale `[300]`
- AND l'asset resta utilizzabile come qualunque altro

#### Scenario: Ogni larghezza dichiarata corrisponde a un file esistente

- GIVEN un `MediaAsset` qualsiasi creato dalla pipeline
- WHEN per ogni valore di `LarghezzeDisponibili` si richiede la variante corrispondente
- THEN ogni richiesta trova il file, in entrambi i formati
- AND nessuna risposta è un 404

### Requirement: Placeholder LQIP inlineabile

Il sistema MUST generare per ogni asset un placeholder a bassissima qualità, largo al
massimo 20 px, persistito in `Placeholder` come stringa base64 utilizzabile direttamente
dal client senza una richiesta HTTP aggiuntiva. Il placeholder MUST essere sempre
valorizzato per ogni asset creato e SHOULD restare sotto i 2 KB, perché viaggia dentro ogni
risposta che include l'asset.

#### Scenario: Placeholder presente e utilizzabile

- GIVEN un upload andato a buon fine
- WHEN si legge il `MediaAsset` creato
- THEN `Placeholder` è una stringa non vuota
- AND decodificata produce un'immagine larga al massimo 20 px
- AND il client può renderizzarla senza effettuare richieste HTTP aggiuntive

#### Scenario: Placeholder generato anche per immagini molto piccole

- GIVEN un'immagine originale larga 300 px
- WHEN viene caricata
- THEN `Placeholder` è comunque valorizzato

### Requirement: Atomicità dell'upload

Un upload MUST risultare completamente riuscito o completamente assente: se la generazione
di una qualunque variante o la scrittura su disco fallisce, il sistema MUST NOT lasciare un
record `MediaAsset` che punta a un insieme di file incompleto, e MUST rimuovere i file
parziali già scritti. La risposta MUST comunicare l'errore in modo leggibile.

#### Scenario: Fallimento a metà generazione

- GIVEN un upload valido per cui la scrittura di una variante fallisce (es. disco pieno o permessi errati)
- WHEN l'elaborazione termina in errore
- THEN nessun record `MediaAsset` risulta creato per quell'upload
- AND nessun file parziale resta sotto la radice dei media
- AND il client riceve un errore leggibile

---

## Dominio: Amministrazione dei media

### Requirement: Elenco e modifica dei metadati editoriali

Il sistema MUST esporre una **query di elenco** (`connection { mediaAssets }`, paginata per
cursore come le altre liste del progetto) e una **mutation di modifica**
(`vetrina { mutateMediaAsset }`) limitata ai soli metadati editoriali: testo alternativo,
didascalia, cartella, ordinamento, punto focale e stato di pubblicazione. La modifica MUST
NOT alterare `Chiave`, `MimeType`, `Larghezza`, `Altezza`, `LarghezzeDisponibili`,
`Placeholder`, `ByteTotali` né alcun file su disco. Ogni modifica MUST aggiornare
`UpdatedAt`.

Tutte le operazioni di questo dominio, **lettura inclusa**, MUST essere riservate agli
amministratori secondo la spec `sicurezza`: in questa fase non esiste alcun consumatore
anonimo dei media.

Dopo un upload — che avviene su un trasporto diverso e non passa dalla cache del client
GraphQL — la libreria MUST rileggere l'elenco, così che il media appena caricato compaia
senza che l'utente debba ricaricare la pagina.

#### Scenario: Modifica del testo alternativo

- GIVEN un `MediaAsset` esistente
- WHEN un amministratore ne modifica il testo alternativo
- THEN il nuovo testo è persistito e `UpdatedAt` è aggiornato
- AND `Chiave`, `Larghezza`, `Altezza`, `LarghezzeDisponibili` e `Placeholder` restano invariati
- AND nessun file su disco viene modificato

#### Scenario: Il tipo di input non espone i campi tecnici

- GIVEN lo schema GraphQL della change applicata
- WHEN si ispeziona il tipo di input della mutation di modifica dei media
- THEN non contiene `chiave`, `mimeType`, `larghezza`, `altezza`, `larghezzeDisponibili`, `placeholder` né `byteTotali`
- AND una richiesta che tenta di passarne uno viene rifiutata dalla validazione dello schema

#### Scenario: L'elenco riflette un media appena caricato

- GIVEN la libreria dei media aperta e un elenco già visualizzato
- WHEN un amministratore completa l'upload di una nuova immagine
- THEN il nuovo media compare nell'elenco senza ricaricare la pagina

### Requirement: Eliminazione bloccata se l'asset è referenziato

Il sistema MUST **rifiutare** l'eliminazione di un `MediaAsset` referenziato: il tentativo
MUST produrre un errore esplicito il cui messaggio **nomina il riferimento**, e MUST NOT
eliminare né il record né alcun file. Il requisito è espresso in termini di comportamento e
non di codice di stato HTTP, perché l'operazione non è più un `DELETE` REST ma una mutation
GraphQL: ciò che MUST valere è il rifiuto, la diagnosticità del messaggio e l'assenza di
qualunque effetto.

Il vincolo MUST essere applicato **anche a livello di database** con una politica di
cancellazione restrittiva sulla foreign key, così che nemmeno una cancellazione diretta
possa lasciare un riferimento pendente.

Quando l'asset non è referenziato, l'eliminazione MUST rimuovere sia il record sia **tutti**
i file delle sue varianti.

I referenti da verificare MUST essere **due** — i prodotti e l'immagine di anteprima social
delle impostazioni della vetrina — e la verifica di **entrambi** MUST avvenire **prima di
toccare il disco**.

🔴 L'ordine è la sostanza del requisito, non un dettaglio implementativo. Con la verifica
collocata dopo la rimozione dei file, l'esito di un'eliminazione rifiutata sarebbe: **riga
ancora presente, file spariti, immagine di anteprima rotta su ogni condivisione social**, e un
messaggio incomprensibile del database mostrato all'utente. Il rifiuto MUST quindi lasciare il
sistema **esattamente** come era: record presente, riferimento intatto e **ogni file ancora sul
filesystem**.

Il messaggio d'errore per il caso dell'immagine di anteprima MUST nominare il media e MUST
indicare l'azione correttiva — sostituirla o rimuoverla dalle impostazioni del sito — con la
stessa leggibilità del messaggio usato per i prodotti.

La relazione verso il media MUST essere dichiarata **senza navigazione inversa** e con politica
restrittiva, così che nemmeno una cancellazione diretta a database possa lasciare un
riferimento pendente (spec `impostazioni-vetrina`).

(Precedentemente, prima di `vetrina-api-pubblica`: il requirement parlava di un solo referente,
i prodotti, perché era l'unico esistente.)

**Verifica per mutazione**: rimuovere il controllo sull'immagine di anteprima MUST far fallire
lo scenario che asserisce la presenza dei file su disco. È l'asserzione che conta ed è quella
che si dimentica: un test che verificasse solo il rifiuto resterebbe verde anche con i file già
cancellati.

#### Scenario: Eliminazione di un asset in uso

- GIVEN un `MediaAsset` assegnato come immagine di due prodotti
- WHEN un amministratore ne richiede l'eliminazione
- THEN l'operazione viene rifiutata con un errore esplicito
- AND il messaggio d'errore nomina entrambi i prodotti che lo referenziano
- AND il record e tutti i file restano presenti
- AND l'interfaccia mostra quell'errore all'amministratore senza trattamenti speciali per il caso

#### Scenario: Eliminazione di un asset non referenziato

- GIVEN un `MediaAsset` non assegnato ad alcun prodotto
- WHEN un amministratore ne richiede l'eliminazione
- THEN il record viene rimosso
- AND tutti i file della sua cartella vengono rimossi dal filesystem

#### Scenario: Riferimento rimosso e poi eliminazione

- GIVEN un `MediaAsset` referenziato da un solo prodotto
- WHEN l'amministratore azzera l'immagine del prodotto e poi richiede l'eliminazione dell'asset
- THEN l'eliminazione va a buon fine

#### Scenario: Cancellazione diretta a database bloccata

- GIVEN un `MediaAsset` referenziato da un prodotto
- WHEN si tenta di cancellare la riga direttamente a database
- THEN il vincolo di foreign key restrittivo impedisce la cancellazione

#### Scenario: 🔴 Media assegnato come immagine di anteprima social

- GIVEN un media assegnato come immagine di anteprima social nelle impostazioni della vetrina
- WHEN un amministratore ne richiede l'eliminazione
- THEN l'operazione viene rifiutata con un errore leggibile che nomina il media e indica di
  sostituirlo o rimuoverlo dalle impostazioni del sito
- AND il record del media è ancora presente
- AND **tutti i file delle sue varianti sono ancora sul filesystem**
- AND il riferimento nelle impostazioni è invariato

#### Scenario: 🔴 Verifica per mutazione dell'ordine dei controlli

- GIVEN lo scenario precedente verde
- WHEN si rimuove la verifica sull'immagine di anteprima social
- THEN l'asserzione sulla presenza dei file su disco fallisce
- AND l'asserzione sul rifiuto potrebbe restare verde, a dimostrazione che da sola non copre il
  guasto

#### Scenario: Media referenziato da entrambi i referenti

- GIVEN un media assegnato a un prodotto **e** come immagine di anteprima social
- WHEN un amministratore ne richiede l'eliminazione
- THEN l'operazione viene rifiutata con un errore leggibile
- AND record e file restano presenti

#### Scenario: Riferimento social rimosso e poi eliminazione

- GIVEN un media referenziato solo come immagine di anteprima social
- WHEN un amministratore azzera il riferimento nelle impostazioni e poi richiede l'eliminazione
- THEN l'eliminazione va a buon fine
- AND il record e tutti i file vengono rimossi

#### Scenario: Cancellazione diretta a database bloccata anche dal secondo referente

- GIVEN un media assegnato come immagine di anteprima social
- WHEN si tenta di cancellare la riga direttamente a database
- THEN il vincolo restrittivo impedisce la cancellazione

#### Scenario: Il caso preesistente resta invariato

- GIVEN un media assegnato a due prodotti e non referenziato dalle impostazioni
- WHEN un amministratore ne richiede l'eliminazione
- THEN il rifiuto e il messaggio che nomina i prodotti sono identici a prima dell'introduzione
  del secondo referente

### Requirement: Stato di pubblicazione senza rotture silenziose

Il campo `Pubblicato` MUST essere metadato editoriale della libreria, con default `true`, e
MUST NOT modificare in alcun modo i prodotti che referenziano l'asset. Quando un
amministratore porta a `false` il `Pubblicato` di un asset **referenziato da almeno un
prodotto pubblicato sul sito**, il sistema MUST segnalarlo elencando i prodotti coinvolti,
così che la decisione sia consapevole invece che silenziosa.

Un asset con `Pubblicato = false` MUST NOT poter essere assegnato come immagine di un
prodotto (spec `vetrina-prodotti`): la libreria è la fonte, e un'immagine ritirata non deve
poter rientrare da una porta laterale.

#### Scenario: Depubblicazione di un'immagine in uso su un prodotto pubblicato

- GIVEN un `MediaAsset` con `Pubblicato = true` assegnato a un prodotto il cui `pubblicatoSulSito` vale `true`
- WHEN un amministratore porta `Pubblicato` a `false`
- THEN il sistema segnala che l'asset è in uso su quel prodotto
- AND nessun campo del prodotto viene modificato

### Requirement: Le cartelle suggerite arrivano dal server, e la cartella si sceglie invece di digitarla

L'elenco delle cartelle suggerite MUST essere esposto dal backend insieme alle altre costanti già
lette dalla libreria dei media al montaggio, e il frontend MUST NOT possedere una propria copia
di quei valori: **non può divergere ciò di cui non si ha una seconda scrittura**.

Qui la divergenza avrebbe una forma precisa e insidiosa: l'amministratore etichetta un'immagine
con un valore scritto dal frontend, la rotta pubblica filtra su un valore diverso, e **la
galleria del sito resta vuota senza alcun errore da nessuna parte**.

Nei due punti in cui la cartella si digita, l'interfaccia MUST proporre le cartelle disponibili
— quelle suggerite dal server unite a quelle già presenti fra i media caricati — **continuando
ad accettare un valore digitato**: l'insieme è aperto, quindi un elenco chiuso sarebbe
sbagliato, ma un campo di testo nudo non rende scopribile la cartella della galleria e nessuno
la popolerebbe mai.

Poiché la galleria vuota è uno stato legittimo (spec `api-pubblica`), l'amministrazione MUST
essere il posto in cui lo si diagnostica: la libreria MUST mostrare la cartella di ogni media,
così che *"quante immagini ci sono in galleria"* sia una domanda a cui si risponde guardando la
pagina e non il database.

#### Scenario: Le costanti includono le cartelle suggerite

- GIVEN un utente autenticato
- WHEN richiede le costanti di configurazione dei media
- THEN la risposta include l'elenco delle cartelle suggerite
- AND contiene sia il valore di default sia quello della galleria

#### Scenario: Il frontend non ha una propria copia

- GIVEN il codice del frontend
- WHEN si cercano occorrenze letterali dei nomi delle cartelle
- THEN non esiste alcun elenco di cartelle definito nel frontend
- AND i suggerimenti provengono dalla risposta del server

#### Scenario: La cartella della galleria è selezionabile

- GIVEN un amministratore che carica un'immagine
- WHEN apre il campo della cartella di destinazione
- THEN fra le opzioni proposte compare quella della galleria
- AND selezionandola il valore inviato è quello canonico

#### Scenario: Un valore digitato resta accettato

- GIVEN un amministratore sul campo della cartella
- WHEN digita un valore non presente fra le opzioni e conferma
- THEN il valore viene accettato e inviato
- AND il salvataggio va a buon fine

#### Scenario: Le cartelle già usate compaiono fra i suggerimenti

- GIVEN media già caricati in una cartella non suggerita dal server
- WHEN un amministratore apre il campo della cartella
- THEN quella cartella compare fra le opzioni proposte

#### Scenario: La cartella è visibile su ogni media della libreria

- GIVEN la libreria dei media con media in cartelle diverse
- WHEN un amministratore la consulta
- THEN la cartella di ciascun media è visibile senza aprire il dettaglio

### Requirement: Una sola conversione dell'elenco delle larghezze, tollerante

La conversione dell'elenco delle larghezze da valore persistito a numeri MUST esistere in **un
solo punto** del backend, e i consumatori MUST delegarvi invece di implementarla. Prima di
`vetrina-api-pubblica` ne esistevano due, divergenti.

La semantica unificata MUST essere **tollerante**: un valore vuoto MUST produrre un elenco vuoto
e i valori non numerici MUST essere scartati, senza sollevare eccezioni. La variante che solleva
MUST NOT sopravvivere: la stessa conversione viene eseguita anche in una rotta **anonima**, dove
un'eccezione su una riga malformata è un errore di infrastruttura servito a un visitatore.

Questo requisito è la sorgente unica anche per l'esposizione pubblica descritta nella spec
`api-pubblica`, che ne è consumatore.

#### Scenario: Una sola implementazione

- GIVEN il codice del backend
- WHEN si cercano le conversioni dell'elenco delle larghezze
- THEN esiste una sola implementazione
- AND i due consumatori preesistenti la richiamano

#### Scenario: Valore vuoto

- GIVEN un elenco di larghezze persistito vuoto
- WHEN viene convertito
- THEN il risultato è un elenco vuoto
- AND nessuna eccezione viene sollevata

#### Scenario: Valore sporco

- GIVEN un elenco di larghezze persistito che contiene un valore non numerico fra valori validi
- WHEN viene convertito
- THEN i valori validi vengono restituiti e gli altri scartati
- AND nessuna eccezione viene sollevata

#### Scenario: Il comportamento dei consumatori preesistenti non peggiora

- GIVEN un media con elenco di larghezze regolare
- WHEN lo si legge dalla lettura REST e da quella GraphQL
- THEN entrambe restituiscono gli stessi numeri di prima dell'unificazione

---

## Dominio: Serving dei file

### Requirement: In produzione servono i media dal web server, non dall'applicazione

In ambiente di produzione l'applicazione .NET MUST NOT servire direttamente i file dei
media: il compito MUST essere del web server, con cache di lunga durata (un anno), che è
sicura perché ogni `Chiave` contiene un suffisso casuale e i percorsi non vengono mai
riutilizzati. In ambiente Development l'applicazione MUST servire i media, così che la
libreria funzioni in locale senza web server davanti.

#### Scenario: Media serviti dal web server in produzione

- GIVEN il sistema in produzione con il web server configurato
- WHEN un client richiede l'URL pubblica di una variante
- THEN il file viene servito dal web server con header di cache di lunga durata
- AND la richiesta non attraversa l'applicazione .NET

#### Scenario: Media serviti dall'applicazione in Development

- GIVEN il backend avviato in ambiente Development senza web server davanti
- WHEN il client dell'amministrazione richiede una variante appena caricata
- THEN il file viene servito correttamente dall'applicazione

### Requirement: Il limite di corpo della richiesta non produce errori opachi

I limiti di dimensione del corpo della richiesta MUST essere disposti in ordine
**decrescente di permissività** dall'esterno verso l'interno — web server, host
applicativo, applicazione — così che a rifiutare un file troppo grande sia sempre lo strato
che sa produrre un messaggio leggibile, e mai il web server con un 413 nudo. Il limite
attuale della rotta `/api/` è **10 MB** (`deploy/nginx/duedgusto.conf`), inferiore a una foto
da smartphone moderno.

Il margine fra gli strati MUST essere **strettamente positivo** e MUST coprire l'overhead
della codifica multipart: con limiti numericamente uguali, un file esattamente al limite
produce un corpo di richiesta più grande del limite e viene rifiutato dal web server
**prima** che l'applicazione possa dire perché. Il margine non è decorativo: è ciò che rende
raggiungibile il messaggio leggibile.

L'innalzamento del limite MUST riguardare una rotta dedicata all'upload dei media e MUST NOT
allargare il limite delle altre rotte API, in particolare di quelle raggiungibili senza
autenticazione.

#### Scenario: Upload oltre il limite attuale della rotta API

- GIVEN il limite del backend configurato al di sopra di 10 MB e il web server allineato
- WHEN un amministratore carica una foto da 15 MB entro il limite del backend
- THEN l'upload raggiunge il backend e viene elaborato
- AND il client non riceve un 413 generato dal web server

#### Scenario: Upload oltre entrambi i limiti

- GIVEN un file che eccede il limite del backend
- WHEN viene caricato
- THEN il client riceve il messaggio d'errore applicativo del backend, non un 413 privo di spiegazione

#### Scenario: File esattamente al limite applicativo

- GIVEN un file di dimensione esattamente pari al limite dichiarato dal backend
- WHEN viene caricato
- THEN la richiesta raggiunge il backend nonostante l'overhead della codifica multipart
- AND viene accettata

#### Scenario: Le altre rotte API mantengono il limite precedente

- GIVEN la configurazione del web server dopo la change
- WHEN si ispeziona il limite di corpo della rotta di autenticazione
- THEN è quello precedente alla change
- AND l'innalzamento riguarda la sola rotta di upload dei media

#### Scenario: Un rifiuto del web server non rompe il client

- GIVEN una richiesta di upload che il web server rifiuta con una risposta non applicativa (corpo HTML)
- WHEN il client la riceve
- THEN mostra un messaggio leggibile sul limite superato
- AND non propaga alcun errore di analisi della risposta

---

## Dominio: Continuità operativa dei media

### Requirement: I media sopravvivono a un deploy

I file dei media MUST risiedere fuori dalla directory di serving del frontend, che lo script
di deploy svuota a ogni esecuzione (`rm -rf "$APP_DIR/frontend/dist/"*`,
`deploy/scripts/deploy.sh`). Dopo un'esecuzione completa dello script di deploy, **ogni**
file presente prima MUST essere ancora presente e raggiungibile con la stessa URL. Lo script
MUST creare la directory dei media con i permessi corretti quando non esiste, prima di
avviare i container, così che il primo deploy non fallisca né la crei di proprietà errata.

#### Scenario: Deploy simulato non perde i media

- GIVEN una directory dei media contenente le varianti di più asset e i corrispondenti record a database
- WHEN viene eseguito lo script di deploy per intero
- THEN tutti i file sono ancora presenti negli stessi percorsi
- AND ogni `MediaAsset.Chiave` continua a corrispondere a file esistenti
- AND le URL delle varianti restano raggiungibili

#### Scenario: Primo deploy su una macchina senza directory media

- GIVEN un server dove la directory dei media non esiste
- WHEN viene eseguito lo script di deploy
- THEN la directory viene creata con proprietario e permessi tali che il backend possa scrivere
- AND l'upload di un'immagine funziona subito dopo il deploy

#### Scenario: I media sono visibili al processo backend containerizzato

- GIVEN il backend in esecuzione come container
- WHEN un amministratore carica un'immagine
- THEN i file compaiono nella directory dei media dell'host
- AND restano presenti dopo la ricreazione del container

### Requirement: L'identità del processo containerizzato è deterministica

L'utente non privilegiato con cui il processo backend gira nel container MUST avere UID e
GID **fissati esplicitamente** nell'immagine (**10001**), e gli script di deploy MUST usare
lo stesso numero per assegnare la proprietà della directory dei media sull'host.

La ragione è che su un bind mount il kernel confronta **soltanto gli identificativi
numerici**: il nome dell'utente non attraversa il confine del container. Creando l'utente
senza fissarne l'UID, il sistema ne assegna uno automaticamente — il primo libero fra quelli
di sistema — e quel valore MAY cambiare al variare dell'immagine di base. L'assegnazione di
proprietà colpirebbe allora un UID diverso da quello del processo, e il primo upload in
produzione fallirebbe per permessi negati: un errore che **in sviluppo non si manifesta**,
perché in sviluppo il container non c'è.

I permessi della directory MUST consentire la scrittura al solo utente del backend e la
lettura al processo del web server.

#### Scenario: L'utente dell'immagine ha identificativi fissati

- GIVEN l'immagine del backend costruita
- WHEN si ispezionano UID e GID dell'utente con cui gira il processo
- THEN valgono entrambi `10001`
- AND non dipendono da quale versione dell'immagine di base è stata usata

#### Scenario: La proprietà della directory coincide con il processo

- GIVEN un server preparato dagli script di deploy
- WHEN si confronta il proprietario numerico della directory dei media con l'UID del processo backend nel container
- THEN i due valori coincidono

#### Scenario: Il primo upload dopo un deploy pulito riesce

- GIVEN un server appena preparato, con la directory dei media creata dallo script di deploy
- WHEN un amministratore carica la prima immagine in assoluto
- THEN l'upload va a buon fine
- AND non si verifica alcun errore di permessi in scrittura

#### Scenario: Il web server legge ma non scrive

- GIVEN la directory dei media con i permessi assegnati dal deploy
- WHEN il web server serve una variante
- THEN la lettura riesce
- AND l'utente del web server non ha permesso di scrittura sulla directory

### Requirement: I media sono inclusi nel backup

La procedura di backup MUST mantenere, oltre al dump del database, un **mirror dell'albero
dei file dei media** nella directory di backup. Un ripristino del dump del database
**insieme** al mirror MUST ricostituire un sistema senza riferimenti rotti.

Il mirror MUST essere **incrementale e append-only**: MUST copiare i file nuovi e MUST NOT
propagare alcuna eliminazione. E MUST NOT essere sottoposto a rotazione, a differenza dei
dump del database.

**Le due politiche divergono perché i due dati sono diversi, e la divergenza MUST essere
documentata nello script.** Ogni dump SQL è uno snapshot completo e ridondante: conservarne
trenta è ragionevole e scartare il trentunesimo non perde nulla. I media sono invece
contenuto **unico e immutabile**: ruotarli significa cancellare l'unica copia esistente, e
un mirror con propagazione delle eliminazioni smetterebbe di essere un backup nel momento
esatto in cui serve — quando qualcuno ha cancellato per errore.

La sincronizzazione dei media MUST avvenire **dopo** il dump del database e MUST NOT poter
interrompere l'esecuzione dello script: il fallimento della parte media MUST essere
segnalato e il dump MUST essere prodotto e conservato comunque.

**Rischio residuo dichiarato**: il mirror risiede sullo stesso disco dell'originale. Protegge
dalla cancellazione accidentale e dal ripristino di un database, **non** dalla perdita del
disco. Una copia fuori sede è fuori scope in questa fase.

#### Scenario: Backup completo

- GIVEN un sistema con record `MediaAsset` e i relativi file
- WHEN viene eseguita la procedura di backup
- THEN nella directory di backup esistono sia il dump del database sia il mirror dei media
- AND il mirror contiene tutti i file presenti nella directory dei media

#### Scenario: Ripristino senza immagini rotte

- GIVEN un ambiente pulito, un dump del database e il mirror dei media
- WHEN si ripristinano entrambi
- THEN per ogni `MediaAsset` presente a database esistono i file corrispondenti
- AND nessuna URL di variante risponde 404

#### Scenario: Fallimento della parte media non compromette il dump

- GIVEN una directory dei media non accessibile al momento del backup
- WHEN viene eseguita la procedura di backup
- THEN il dump del database viene comunque prodotto e conservato
- AND l'errore sulla parte media viene segnalato nel log
- AND lo script termina senza abortire i passi successivi al dump

#### Scenario: Nessuna rotazione sul mirror dei media

- GIVEN un mirror dei media contenente file sincronizzati da più di 30 giorni
- WHEN viene eseguita la procedura di backup
- THEN nessun file del mirror viene eliminato per anzianità
- AND la rotazione a 30 giorni continua ad applicarsi ai soli dump del database

#### Scenario: Un media eliminato per errore resta recuperabile

- GIVEN un `MediaAsset` già presente nel mirror
- WHEN l'asset viene eliminato dal sistema e viene poi eseguito un nuovo backup
- THEN i suoi file sono ancora presenti nel mirror

#### Scenario: Sincronizzazione incrementale

- GIVEN un backup già eseguito e nessun nuovo upload da allora
- WHEN viene eseguita una seconda procedura di backup
- THEN nessun file già presente nel mirror viene riscritto
- AND il mirror resta identico a prima
