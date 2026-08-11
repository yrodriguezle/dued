# Impostazioni Vetrina Specification

**Domain**: impostazioni-vetrina
**Change**: vetrina-api-pubblica
**Date**: 2026-08-11
**Status**: Draft
**Tipo**: NUOVA spec (il dominio non esiste in `openspec/specs/` e non è stato introdotto dal
change precedente)

## Purpose

Definire **dove vivono i dati del locale** — insegna pubblica, indirizzo, geolocalizzazione,
contatti, social, meta di default, immagine di anteprima social, ora di inizio del tema serale —
chi li scrive, e perché non stanno insieme alle impostazioni operative della cassa.

Il dominio nasce da un'assenza verificata: oggi indirizzo, coordinate, social e meta non hanno
alcun posto dove esistere. `BusinessSettings` ha **11 campi, tutti operativi** — orari, giorni,
fuso, valuta, aliquota IVA, importi del giornale — letti e scritti da cassa e chiusure mensili,
con periodi di programmazione e giorni non lavorativi appesi come navigazioni. Aggiungerci venti
campi di marketing significherebbe **toccare un'entità critica a ogni modifica del sito**, e
mettere il rischio di un errore di cassa sul percorso di "cambio il link Instagram".

Ma due entità non devono diventare due verità: gli orari restano **una sola volta** nella
sorgente operativa, e la rotta pubblica dell'identità le compone (spec `api-pubblica`).

**Fuori scope in questa fase**: le entità delle fasi successive (sezioni di pagina, eventi,
promozioni, prenotazioni, piatto del giorno) e ogni loro amministrazione; l'irrigidimento del
singleton di `BusinessSettings`, che è un change dedicato.

**Stato verificato del codice prima della change**: non esiste alcuna entità
`ImpostazioniVetrina`; `BusinessSettings` è un singleton **per convenzione** — chiave
auto-incrementale, nessun vincolo, e tre letture con `FirstOrDefaultAsync()` senza ordinamento
([`SettingsQueries.cs:24`](../../../../../backend/GraphQL/Settings/SettingsQueries.cs),
[`SettingsMutations.cs:36`](../../../../../backend/GraphQL/Settings/SettingsMutations.cs),
[`Program.cs:360`](../../../../../backend/Program.cs)); `updateBusinessSettings` assegna i campi
sotto condizione `if (!string.IsNullOrEmpty(...))`, quindi **un campo non si può svuotare**;
il ramo root `vetrina` esiste fra le **mutation** e non fra le **query**
([`GraphQLQueries.cs:17-23`](../../../../../backend/GraphQL/GraphQLQueries.cs) elenca sette rami,
`vetrina` non è fra questi); `SeedMenusSito.cs` ha il padre "Sito" e **due** figli
(`Posizione` 1 e 2), cercati per `Percorso`.

---

## Modifiche allo schema GraphQL

**Nuovo ramo root fra le query**: `vetrina`, che oggi esiste solo fra le mutation. Il ramo dice
al lettore in che territorio si trova, e — essendo enumerabile dallo schema — è coperto
automaticamente dal test che verifica quali rami sono raggiungibili senza autenticazione (spec
`sicurezza`).

```graphql
extend type Query { vetrina: VetrinaQuery }

type VetrinaQuery {
  impostazioni: ImpostazioniVetrina        # + verifica del privilegio amministrativo
}

type ImpostazioniVetrina {
  impostazioniVetrinaId: Int!
  insegnaPubblica: String!
  via: String!  cap: String!  citta: String!  provincia: String!  paese: String!
  latitudine: Decimal  longitudine: Decimal
  telefono: String  email: String
  urlInstagram: String  urlFacebook: String
  metaTitoloDefault: String  metaDescrizioneDefault: String
  immagineOgId: Int
  immagineOg: MediaAsset
  oraInizioTemaSera: String!
  prenotazioniAttive: Boolean!
  prenotazioniPreavvisoOre: Int!
  prenotazioniCopertiMax: Int!
  turnstileSiteKey: String
  createdAt: DateTime!  updatedAt: DateTime!
}

extend type VetrinaMutation {
  mutateImpostazioniVetrina(input: ImpostazioniVetrinaInput!): ImpostazioniVetrina
}

input ImpostazioniVetrinaInput {   # nessun identificativo: c'è una riga sola e il resolver sa quale
  insegnaPubblica: String!
  via: String!  cap: String!  citta: String!  provincia: String!  paese: String!
  latitudine: Decimal  longitudine: Decimal
  telefono: String  email: String
  urlInstagram: String  urlFacebook: String
  metaTitoloDefault: String  metaDescrizioneDefault: String
  immagineOgId: Int
  oraInizioTemaSera: String!
  prenotazioniAttive: Boolean!
  prenotazioniPreavvisoOre: Int!
  prenotazioniCopertiMax: Int!
  turnstileSiteKey: String
}
```

`ImpostazioniVetrinaInput` MUST NOT contenere l'identificativo della riga, le marche temporali,
né alcun campo delle impostazioni operative (orari, giorni, fuso, valuta, aliquota IVA, importi
del giornale). Le tre mutation esistenti del ramo `vetrina` restano invariate, salvo quanto la
spec `media-assets` dichiara sull'eliminazione dei media.

---

## Dominio: L'entità e la sua unicità

### Requirement: 🔴 Singleton imposto dal database, non dalla convenzione

Le impostazioni della vetrina MUST esistere in **una sola riga**, con identificativo fisso e
noto. L'unicità MUST essere imposta da un vincolo che il **database** fa rispettare, e MUST NOT
dipendere dal fatto che nessuno inserisca una seconda riga. L'identificativo MUST NOT essere
generato dal database: è un valore di dominio ("la riga"), non un contatore, e con
l'auto-incremento un inserimento senza identificativo creerebbe la seconda riga in silenzio.

Ogni lettura e ogni scrittura MUST individuare la riga **per identificativo fisso** e MUST NOT
usare una lettura del tipo "la prima che trovi": senza ordinamento, "la prima" non è un concetto
definito.

Il pattern permissivo già usato per le impostazioni operative MUST NOT essere replicato qui, e i
due casi MUST NOT essere considerati simmetrici. Le impostazioni operative sono scritte da una
sola schermata e sono in produzione da anni; queste sono **seedate all'avvio** e **lette da una
rotta anonima**: un duplicato produrrebbe il guasto peggiore possibile per un dato pubblico —
**il sito mostra un indirizzo e l'amministratore ne modifica un altro**, senza alcun errore da
qualunque parte si guardi.

Le impostazioni operative esistenti MUST restare invariate: irrigidirne il singleton è un change
dedicato e MUST essere annotato come debito noto, non lasciato divergere in silenzio.

#### Scenario: Una seconda riga è rifiutata dal database

- GIVEN la riga delle impostazioni della vetrina già presente
- WHEN si tenta di inserire una seconda riga con un identificativo diverso, anche direttamente
  con un'istruzione SQL scritta a mano
- THEN il database rifiuta l'inserimento per violazione del vincolo

#### Scenario: L'identificativo non è generato dal database

- GIVEN lo schema del database dopo la migrazione
- WHEN si ispeziona la colonna dell'identificativo delle impostazioni della vetrina
- THEN non è auto-incrementale
- AND il valore della riga esistente è quello fisso dichiarato dal modello

#### Scenario: Lettura per identificativo fisso

- GIVEN il codice della change applicata
- WHEN si ispezionano le letture delle impostazioni della vetrina
- THEN ognuna filtra per l'identificativo fisso
- AND nessuna preleva "la prima riga disponibile" senza criterio

#### Scenario: Le impostazioni operative restano come sono

- GIVEN le impostazioni operative della cassa
- WHEN si ispeziona la loro configurazione dopo la change
- THEN non è stato aggiunto alcun vincolo e non è cambiata alcuna colonna

### Requirement: La migrazione è additiva e isolata

La migrazione MUST creare **una sola tabella nuova** e MUST NOT aggiungere, rimuovere o
modificare alcuna colonna di tabelle esistenti. La relazione verso il media dell'immagine di
anteprima social MUST essere dichiarata **senza navigazione inversa**: altrimenti il generatore
può riusare la collezione già esistente sull'entità dei media o creare una chiave esterna ombra,
e la migrazione produce una colonna che nessuno ha chiesto su una tabella che la change ha
promesso di non toccare.

Se lo script della migrazione contenesse una modifica a una tabella esistente, la causa MUST
essere corretta **nel modello** e la migrazione rigenerata: la migrazione MUST NOT essere
modificata a mano.

L'applicazione della migrazione su un database con dati reali MUST lasciare invariato il
contenuto di ogni tabella preesistente.

#### Scenario: Lo script contiene solo la creazione della tabella

- GIVEN la migrazione della change
- WHEN se ne genera lo script SQL
- THEN contiene la creazione della tabella nuova e il suo vincolo
- AND non contiene alcuna modifica a tabelle esistenti

#### Scenario: Nessun dato perso su un database reale

- GIVEN un database con prodotti, impostazioni operative e media reali
- WHEN la migrazione viene applicata all'avvio
- THEN i conteggi di prodotti, impostazioni operative e media sono identici a prima
- AND nessuna colonna di quelle tabelle è cambiata

#### Scenario: Nessuna colonna ombra sull'entità dei media

- GIVEN lo schema del database dopo la migrazione
- WHEN si ispezionano le colonne della tabella dei media
- THEN sono esattamente quelle precedenti alla change

### Requirement: Gli orari non si duplicano

Le impostazioni della vetrina MUST NOT contenere orari di apertura, orari di chiusura, giorni
operativi o fuso orario: quei dati appartengono alle impostazioni operative e MUST avere una
sola sorgente. La pagina di amministrazione della vetrina MUST NOT offrire alcun campo per
modificarli e MUST invece indicare dove si modificano.

#### Scenario: Il modello non possiede gli orari

- GIVEN l'entità delle impostazioni della vetrina
- WHEN se ne enumerano le proprietà
- THEN non esiste alcuna proprietà di orario di apertura, chiusura, giorni operativi o fuso orario

#### Scenario: Nemmeno l'input li accetta

- GIVEN lo schema GraphQL della change applicata
- WHEN si ispeziona l'input della mutation delle impostazioni della vetrina
- THEN non contiene alcun campo di orario
- AND una richiesta che tenta di passarne uno viene rifiutata dalla validazione dello schema

### Requirement: I campi delle fasi successive nascono spenti e nessuno li legge

L'entità MUST includere fin da ora i campi delle prenotazioni e la chiave del servizio antispam,
perché la migrazione è una sola e additiva. In questa fase **nessun codice MUST leggerli** e
nessuno di essi MUST comparire in alcuna risposta pubblica.

I campi spenti MUST essere amministrabili e MUST essere presentati all'utente come **non ancora
attivi**: un campo che si compila e non produce alcun effetto, senza spiegazione, viene segnalato
come bug.

#### Scenario: I campi spenti non escono in pubblico

- GIVEN le impostazioni della vetrina con i campi delle prenotazioni e la chiave antispam
  valorizzati
- WHEN un client anonimo richiede la rotta pubblica dell'identità
- THEN nessuno di quei valori compare nella risposta

#### Scenario: Nessun consumatore li legge

- GIVEN il codice della change applicata
- WHEN si cercano le letture dei campi delle prenotazioni e della chiave antispam
- THEN le uniche occorrenze sono il modello, i tipi di amministrazione e la pagina di
  amministrazione

---

## Dominio: Seed dei dati del locale

### Requirement: Il seed crea e non aggiorna

Il seed MUST creare la riga delle impostazioni della vetrina **solo se non esiste**, con i dati
reali del locale, e MUST NOT aggiornare alcun campo di una riga già presente. La procedura di
seed viene eseguita a **ogni avvio**: un menu riallineato dal seed è desiderabile, un indirizzo
riscritto a ogni riavvio è perdita di lavoro.

⚠️ **Conseguenza da dichiarare adesso**: poiché il seed salta quando la riga esiste, ogni colonna
aggiunta in una fase futura **non riceverà mai il valore del seed** sulle installazioni già
avviate. Un campo il cui valore iniziale è significativo MUST quindi avere quel valore come
default **del modello**, non soltanto nel seed. Vale già per l'ora di inizio del tema serale e
per il preavviso delle prenotazioni.

#### Scenario: Primo avvio su database vuoto

- GIVEN un database senza alcuna riga di impostazioni della vetrina
- WHEN il backend si avvia con il seed attivo
- THEN viene creata una riga con i dati reali del locale

#### Scenario: 🔴 Tre avvii consecutivi non sovrascrivono il lavoro dell'amministratore

- GIVEN una riga di impostazioni esistente in cui un amministratore ha modificato l'indirizzo e
  il link social
- WHEN il backend viene riavviato tre volte con il seed attivo
- THEN esiste sempre una sola riga
- AND i valori modificati a mano sono quelli letti dopo ogni riavvio

#### Scenario: Un campo aggiunto in futuro prende il default del modello

- GIVEN un'installazione con la riga già presente
- WHEN viene applicata una migrazione che aggiunge una colonna con default dichiarato nel modello
- THEN la riga esistente riporta quel default
- AND il seed non viene rieseguito su quella riga

---

## Dominio: Amministrazione via GraphQL

### Requirement: Lettura riservata agli amministratori anche se il dato è quasi pubblico

La query di lettura MUST vivere nel ramo root `vetrina` fra le query, MUST richiedere
l'autenticazione a livello di tipo e MUST verificare il privilegio amministrativo **come prima
operazione del resolver, anche in lettura** (spec `sicurezza`).

🔴 La ragione per cui la lettura è riservata benché una parte degli stessi dati esca anonima
dalla rotta pubblica è che **non sono gli stessi dati**: il tipo di amministrazione espone la
chiave del servizio antispam, i parametri delle prenotazioni e tutto ciò che le fasi successive
aggiungeranno, mentre la risposta pubblica espone un sottoinsieme scelto a mano. La verifica è
ciò che impedisce a quell'asimmetria di diventare un incidente il giorno in cui il tipo di
amministrazione cresce.

Quando la riga non esiste, la query MUST restituire un risultato gestibile dal client — mai un
errore di infrastruttura.

#### Scenario: Amministratore legge le impostazioni

- GIVEN un utente autenticato con privilegio amministrativo
- WHEN interroga `vetrina { impostazioni }`
- THEN riceve la riga con tutti i campi, inclusi quelli non ancora attivi

#### Scenario: Il ramo esiste fra le query dello schema

- GIVEN lo schema GraphQL della change applicata
- WHEN si enumerano i rami root delle query
- THEN `vetrina` è presente
- AND il ramo dichiara l'autorizzazione a livello di tipo

#### Scenario: Lettura con la riga assente

- GIVEN un database senza alcuna riga di impostazioni della vetrina
- WHEN un amministratore interroga `vetrina { impostazioni }`
- THEN la risposta è gestibile dal client e non è un errore di infrastruttura

### Requirement: 🔴 Scrittura ad assegnazione totale: un campo si deve poter svuotare

La mutation MUST assegnare **tutti** i campi scrivibili a ogni invocazione, esattamente come già
fa la mutation dei campi vetrina del prodotto. Il sistema MUST NOT assegnare i campi sotto
condizione di non vuoto.

🔴 **Conseguenza vincolante: un campo valorizzato MUST poter essere svuotato.** Cancellare il
link Facebook e salvare MUST persistere l'assenza. La forma condizionale usata da
`updateBusinessSettings` (`if (!string.IsNullOrEmpty(input.X))`) produce il difetto opposto —
il vecchio valore resta, senza alcun errore — ed è un difetto **reale del codice esistente** che
questa change MUST NOT importare in un'entità dove i campi opzionali sono la maggioranza.

L'assenza MUST avere **una sola rappresentazione**: una stringa vuota o composta di soli spazi
MUST essere persistita come nulla, così che nessun consumatore debba distinguere fra più forme di
vuoto.

L'input MUST NOT accettare l'identificativo della riga: c'è una riga sola e il resolver sa
quale; accettare un identificativo sarebbe invitare qualcuno a passarne un altro. Il resolver
MUST creare la riga se manca e aggiornarla se esiste.

**Verifica per mutazione**: sostituire l'assegnazione totale con la forma condizionale MUST far
fallire lo scenario di svuotamento.

#### Scenario: 🔴 Svuotamento di un campo opzionale

- GIVEN impostazioni con il link Facebook valorizzato
- WHEN un amministratore invia la mutation con il link Facebook vuoto e gli altri campi invariati
- THEN il valore persistito è nullo
- AND la rilettura restituisce nullo

#### Scenario: Stringa di soli spazi equivale ad assenza

- GIVEN impostazioni con il telefono valorizzato
- WHEN un amministratore invia il telefono come stringa di soli spazi
- THEN il valore persistito è nullo

#### Scenario: Verifica per mutazione dell'assegnazione totale

- GIVEN i test dell'amministrazione delle impostazioni verdi
- WHEN si sostituisce l'assegnazione di un campo opzionale con una forma condizionata al valore
  non vuoto
- THEN lo scenario di svuotamento fallisce

#### Scenario: Creazione implicita quando la riga manca

- GIVEN un'installazione avviata senza seed, con la tabella vuota
- WHEN un amministratore salva le impostazioni dalla pagina di amministrazione
- THEN la riga viene creata con l'identificativo fisso
- AND i valori inviati sono quelli persistiti

#### Scenario: L'input non accetta un identificativo

- GIVEN lo schema GraphQL della change applicata
- WHEN si ispeziona l'input della mutation
- THEN non contiene alcun campo identificativo
- AND una richiesta che tenta di passarne uno viene rifiutata dalla validazione dello schema

#### Scenario: Round-trip completo

- GIVEN impostazioni vuote
- WHEN un amministratore valorizza tutti i campi e rilegge
- THEN ogni valore letto è identico a quello inviato

### Requirement: Validazioni con messaggi leggibili e nessuna scrittura parziale

La mutation MUST validare, **prima di scrivere**, e MUST produrre errori applicativi leggibili in
italiano. Un rifiuto MUST NOT lasciare alcuna scrittura parziale.

- l'ora di inizio del tema serale MUST rispettare il formato `HH:mm`, lo stesso degli orari
  operativi;
- latitudine e longitudine MUST stare nei rispettivi intervalli validi quando valorizzate, e MUST
  essere valorizzate **insieme o nessuna delle due**: mezza coordinata è un punto sull'equatore,
  cioè un dato peggiore di un dato mancante;
- gli URL social MUST essere assoluti con schema `http` o `https`: si persistono **indirizzi
  completi e non identificativi utente**, così che nessun consumatore debba sapere come si
  costruisce un indirizzo Instagram e i dati strutturati del sito siano una copia diretta;
- l'immagine di anteprima social, se indicata, MUST esistere e MUST avere lo stato di
  pubblicazione attivo, e il messaggio d'errore MUST essere **lo stesso, alla lettera**, già usato
  quando si assegna un'immagine non pubblicata a un prodotto. Due formulazioni diverse per la
  stessa regola sono due regole, agli occhi di chi legge il messaggio.

#### Scenario: Ora del tema serale in formato non valido

- GIVEN impostazioni esistenti
- WHEN un amministratore invia `"18.00"` come ora di inizio del tema serale
- THEN la mutation fallisce con un errore leggibile
- AND nessun campo risulta modificato

#### Scenario: Mezza coordinata rifiutata

- GIVEN impostazioni senza geolocalizzazione
- WHEN un amministratore invia la sola latitudine
- THEN la mutation fallisce con un errore leggibile che indica che le due coordinate vanno
  inserite insieme
- AND nessun campo risulta modificato

#### Scenario: Coordinata fuori intervallo

- GIVEN impostazioni esistenti
- WHEN un amministratore invia una latitudine pari a `120`
- THEN la mutation fallisce con un errore leggibile
- AND nessun campo risulta modificato

#### Scenario: Entrambe le coordinate azzerate

- GIVEN impostazioni con geolocalizzazione valorizzata
- WHEN un amministratore azzera esplicitamente entrambe le coordinate
- THEN la mutation va a buon fine e la geolocalizzazione risulta assente

#### Scenario: Social come identificativo utente invece che URL

- GIVEN impostazioni esistenti
- WHEN un amministratore invia `"@2dgusto"` come link Instagram
- THEN la mutation fallisce con un errore leggibile che richiede un indirizzo completo

#### Scenario: Immagine di anteprima inesistente

- GIVEN un identificativo di media che non corrisponde ad alcun asset
- WHEN un amministratore lo indica come immagine di anteprima social
- THEN la mutation fallisce con un errore esplicito
- AND il valore persistito resta invariato

#### Scenario: Immagine di anteprima non pubblicata

- GIVEN un media con stato di pubblicazione disattivo
- WHEN un amministratore lo indica come immagine di anteprima social
- THEN la mutation fallisce
- AND il messaggio d'errore è identico a quello prodotto quando lo stesso media viene assegnato a
  un prodotto

#### Scenario: Immagine di anteprima rimossa

- GIVEN impostazioni con un'immagine di anteprima social assegnata
- WHEN un amministratore azzera il riferimento
- THEN la mutation va a buon fine e il riferimento risulta assente
- AND il media resta presente nella libreria

---

## Dominio: Pagina di amministrazione

### Requirement: Una pagina nella sezione del sito, sul pattern delle impostazioni esistenti

La pagina delle impostazioni della vetrina MUST vivere fra le pagine della sezione del sito
(`duedgusto/src/components/pages/sito/`) e MUST riusare il pattern già adottato dalla pagina
delle impostazioni della cassa: gestione del form con validazione dichiarativa, barra degli
strumenti del form, conferma sulle azioni distruttive e notifica dell'esito. MUST essere avvolta
dal gate della sezione del sito già esistente.

La pagina MUST organizzare i campi nell'ordine in cui un proprietario li compila: identità,
indirizzo, posizione, contatti e social, dati per i motori di ricerca, aspetto, prenotazioni.

La selezione dell'immagine di anteprima social MUST avvenire tramite il selettore di media **già
esistente**, e MUST NOT introdurre un secondo percorso di scelta delle immagini.

La validazione lato client MUST includere il controllo **incrociato** sulle coordinate — entrambe
o nessuna — e MUST NOT sostituire quella del backend: le stesse regole MUST valere per una
chiamata GraphQL diretta.

🔴 La sezione delle prenotazioni MUST dichiarare esplicitamente all'utente che la funzione non è
ancora attiva e che i valori vengono salvati per quando lo sarà.

Gli orari di apertura MUST NOT comparire in questa pagina: la pagina MUST indicare che si
modificano nelle impostazioni della cassa.

#### Scenario: Salvataggio completo dalla pagina

- GIVEN un amministratore sulla pagina delle impostazioni della vetrina
- WHEN compila indirizzo, contatti, social e ora di inizio del tema serale e salva
- THEN viene invocata la mutation delle impostazioni della vetrina
- AND l'esito positivo viene notificato
- AND i valori riletti dalla pagina sono quelli salvati

#### Scenario: Coordinate incoerenti bloccate prima dell'invio

- GIVEN un amministratore che compila la sola latitudine
- WHEN tenta di salvare
- THEN la pagina segnala che le due coordinate vanno inserite insieme
- AND nessuna mutation viene inviata

#### Scenario: La validazione del client non è l'unico controllo

- GIVEN le stesse coordinate incoerenti
- WHEN vengono inviate direttamente all'endpoint GraphQL senza passare dalla pagina
- THEN la mutation viene rifiutata dal backend

#### Scenario: Selezione dell'immagine di anteprima

- GIVEN un amministratore sulla sezione dei dati per i motori di ricerca
- WHEN apre la selezione dell'immagine di anteprima social
- THEN viene mostrato il selettore di media già esistente
- AND la scelta valorizza il riferimento senza alcun caricamento aggiuntivo

#### Scenario: 🔴 La sezione prenotazioni si dichiara inattiva

- GIVEN un amministratore sulla pagina
- WHEN raggiunge la sezione delle prenotazioni
- THEN la pagina mostra un avviso che la funzione non è ancora attiva sul sito e che i valori
  verranno usati quando lo sarà

#### Scenario: Gli orari non si modificano da qui

- GIVEN un amministratore sulla pagina
- WHEN cerca gli orari di apertura
- THEN non esiste alcun campo per modificarli
- AND la pagina indica che si modificano nelle impostazioni della cassa

#### Scenario: Uscita con modifiche non salvate

- GIVEN un amministratore che ha modificato un campo senza salvare
- WHEN tenta di abbandonare la pagina
- THEN viene richiesta una conferma esplicita, come nelle altre pagine di dettaglio del progetto

### Requirement: Terza voce di menu nella sezione del sito, idempotente

Il seed dei menu MUST aggiungere una **terza** voce alla sezione del sito, in terza posizione,
puntando alla pagina delle impostazioni della vetrina, con un'icona **distinta** da quella della
sezione impostazioni della cassa: due voci con la stessa icona nella navigazione sono
indistinguibili.

La voce MUST essere cercata per percorso, come le due esistenti, così che avvii ripetuti non la
duplichino. Il padre della sezione MUST NOT essere ricreato. Le due voci esistenti MUST restare
invariate. La voce MUST essere assegnata ai soli ruoli amministrativi (spec `sicurezza`).

#### Scenario: Tre avvii consecutivi

- GIVEN un database con la sezione del sito già seedata
- WHEN il backend viene riavviato tre volte con il seed attivo
- THEN i figli della sezione del sito restano esattamente tre
- AND le due voci preesistenti hanno percorso, titolo e posizione invariati

#### Scenario: La voce apre la pagina

- GIVEN un amministratore autenticato
- WHEN seleziona la terza voce della sezione del sito
- THEN viene caricata la pagina delle impostazioni della vetrina

#### Scenario: Icona distinta

- GIVEN la barra di navigazione con la sezione del sito e la sezione impostazioni della cassa
- WHEN si confrontano le rispettive icone
- THEN sono diverse
