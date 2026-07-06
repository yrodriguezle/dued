# Preferenze Utente Specification

**Domain**: preferenze-utente
**Status**: Active
**Ultimo aggiornamento**: 2026-07-06

Change incorporate in questa spec:

| Change | Archiviata il | Contenuto |
|--------|---------------|-----------|
| modale-drag-preferenza-utente | 2026-07-06 | Spec iniziale del dominio: preferenza per-utente `preferenzaDragModale` (free/elastic) persistita sull'entità `Utente`, esposta e salvata via GraphQL, editabile da `ProfilePage`, applicata a `AppDialog` con whitelist e fallback sicuro |

## Purpose

Specifica il comportamento end-to-end della preferenza per-utente `preferenzaDragModale`
che determina la modalità di trascinamento della modale condivisa `AppDialog`: `"free"`
(la modale resta dove viene lasciata e torna al centro alla riapertura) oppure `"elastic"`
(snap-back all'origine al rilascio). La preferenza è persistita nel backend sull'entità
`Utente`, esposta e salvata via GraphQL, modificabile dalla pagina del profilo utente e
letta dalla modale con fallback sicuro. È il primo pattern di preferenza utente
sincronizzata sul server del progetto.

Copre: (1) persistenza e lettura end-to-end della preferenza, (2) applicazione della
preferenza al drag della modale, (3) modifica dal profilo utente, (4) default per i nuovi
utenti e fallback quando l'utente non è caricato, (5) whitelist dei valori ammessi.

**Valori ammessi (whitelist)**: `"free"` | `"elastic"`. **Default**: `"free"`.

---

## Modifiche allo schema GraphQL

Namespace: `authentication`.

- **Output type `Utente`** (`UtenteType`): aggiunto campo `preferenzaDragModale: String!`
  (non-nullable, sempre valorizzato con `"free"` o `"elastic"`).
- **Input type `UtenteInput`** (`UtenteInputType`): aggiunto campo opzionale
  `preferenzaDragModale: String` (se assente in `mutateUtente`, il valore corrente NON
  viene modificato in update; in create si applica il default `"free"`).
- **Fragment `UtenteFragment`**: aggiunto il campo `preferenzaDragModale`; la modifica si
  propaga automaticamente a `utenteCorrente`, `getUtentePerId` e alla mutation
  `mutateUtente` che condividono il fragment.
- Nessun nuovo type, query o mutation: si riusa `utenteCorrente` (lettura) e `mutateUtente`
  (scrittura). La root `authentication` resta `Authorize()`.

---

## Dominio: Persistenza e lettura della preferenza (end-to-end)

### Requirement: Persistenza della preferenza sull'entità Utente

Il sistema MUST persistere la preferenza di modalità drag come colonna scalare
`PreferenzaDragModale` (string, non-nullable, default `"free"`) sulla tabella `Utenti`.
Il valore MUST essere uno dei valori della whitelist (`"free"` o `"elastic"`). La colonna
MUST essere popolata per tutti gli utenti esistenti al momento della migration con il
valore `"free"` senza richiedere backfill manuale.

#### Scenario: Migration su tabella Utenti già popolata

- GIVEN un database con la tabella `Utenti` che contiene utenti senza la colonna `PreferenzaDragModale`
- WHEN viene applicata la migration EF Core che aggiunge la colonna
- THEN la colonna `PreferenzaDragModale` esiste, è non-nullable e ha default `"free"`
- AND ogni utente preesistente ha valore `"free"`

#### Scenario: Lettura della preferenza via utenteCorrente

- GIVEN un utente autenticato con `PreferenzaDragModale = "elastic"` nel database
- WHEN il client esegue la query `authentication { utenteCorrente { ...UtenteFragment } }`
- THEN la risposta contiene `preferenzaDragModale: "elastic"`

#### Scenario: Round-trip salvataggio e rilettura

- GIVEN un utente autenticato con `preferenzaDragModale = "free"`
- WHEN il client esegue `mutateUtente` con `preferenzaDragModale = "elastic"` e successivamente `utenteCorrente`
- THEN il database contiene `PreferenzaDragModale = "elastic"` per quell'utente
- AND `utenteCorrente` restituisce `preferenzaDragModale: "elastic"`

### Requirement: Salvataggio in create e in update

La mutation `mutateUtente` MUST persistere il campo `preferenzaDragModale` in ENTRAMBI i
rami di esecuzione: creazione di un nuovo utente e aggiornamento di un utente esistente.
Poiché la mutation legge gli argomenti come `Dictionary<string, object>`, il ramo update
MUST applicare il nuovo valore solo se la chiave `preferenzaDragModale` è presente
(`ContainsKey`), lasciando altrimenti invariato il valore corrente; il ramo create MUST
applicare il valore fornito oppure il default `"free"` se la chiave è assente.

#### Scenario: Update con preferenza esplicita

- GIVEN un utente esistente con `PreferenzaDragModale = "free"`
- WHEN si esegue `mutateUtente` in update con `preferenzaDragModale = "elastic"`
- THEN l'utente aggiornato ha `PreferenzaDragModale = "elastic"` nel database

#### Scenario: Update senza chiave preferenza non altera il valore

- GIVEN un utente esistente con `PreferenzaDragModale = "elastic"`
- WHEN si esegue `mutateUtente` in update su altri campi (es. `nome`) senza includere `preferenzaDragModale`
- THEN il valore `PreferenzaDragModale = "elastic"` resta invariato nel database

#### Scenario: Create senza preferenza applica il default

- GIVEN nessun utente con il nome utente scelto
- WHEN si esegue `mutateUtente` in create senza includere `preferenzaDragModale`
- THEN il nuovo utente ha `PreferenzaDragModale = "free"` nel database

#### Scenario: Create con preferenza esplicita

- GIVEN nessun utente con il nome utente scelto
- WHEN si esegue `mutateUtente` in create con `preferenzaDragModale = "elastic"`
- THEN il nuovo utente ha `PreferenzaDragModale = "elastic"` nel database

---

## Dominio: Whitelist dei valori ammessi

### Requirement: Validazione whitelist in scrittura

La mutation `mutateUtente` MUST accettare come valore di `preferenzaDragModale` solo i
valori della whitelist `"free"` e `"elastic"`. Un valore fuori whitelist (es. stringa
arbitraria, vuota, o casing diverso) MUST NOT essere persistito così com'è: il sistema
MUST rifiutare la scrittura con un errore applicativo esplicito OPPURE normalizzare al
default `"free"`. La strategia scelta MUST essere deterministica e MUST garantire che il
database contenga sempre e solo valori della whitelist.

#### Scenario: Valore fuori whitelist in scrittura

- GIVEN un utente autenticato
- WHEN si esegue `mutateUtente` con `preferenzaDragModale = "spring"` (fuori whitelist)
- THEN il database NON contiene il valore `"spring"` per quell'utente
- AND il valore persistito è uno della whitelist (errore applicativo che blocca la scrittura, oppure normalizzazione a `"free"`)

#### Scenario: Valore vuoto in scrittura

- GIVEN un utente autenticato
- WHEN si esegue `mutateUtente` con `preferenzaDragModale = ""` (stringa vuota)
- THEN il valore persistito NON è la stringa vuota
- AND il valore persistito è uno della whitelist

### Requirement: Robustezza in lettura contro valori non validi

Il client MUST trattare come non valido qualunque valore letto che non appartenga alla
whitelist e MUST applicare il fallback `"free"`, così che un eventuale valore corrotto nel
database non renda indefinito il comportamento della modale.

#### Scenario: Valore non riconosciuto letto dal client

- GIVEN lo `userStore` contiene un utente con `preferenzaDragModale` pari a un valore non in whitelist
- WHEN una `AppDialog` viene aperta
- THEN la modale adotta il comportamento `"free"` (fallback)

---

## Dominio: Modifica della preferenza dal profilo utente

### Requirement: Selettore free/elastic in ProfilePage

La pagina `ProfilePage` ("Il mio profilo") MUST offrire un controllo (RadioGroup) che
permette all'utente di scegliere tra `"free"` ed `"elastic"`, con etichette leggibili in
italiano (es. `free` = "Resta dove la lasci", `elastic` = "Torna al centro"). Il valore
iniziale del controllo MUST riflettere la preferenza corrente dell'utente letta dallo
`userStore`. Il campo MUST essere incluso nello schema di validazione (Zod) e nel form
(Formik), ammettendo solo i valori della whitelist. Al salvataggio del profilo, il valore
selezionato MUST essere inviato tra le variables di `mutationSubmitUtente` e, al successo,
lo `userStore` MUST essere aggiornato via `receiveUtente` con l'utente restituito.

#### Scenario: Il selettore riflette la preferenza corrente

- GIVEN un utente autenticato con `preferenzaDragModale = "elastic"` nello store
- WHEN l'utente apre `ProfilePage`
- THEN il RadioGroup mostra selezionata l'opzione `"elastic"`

#### Scenario: Cambio e salvataggio della preferenza

- GIVEN `ProfilePage` aperta con opzione corrente `"free"` selezionata
- WHEN l'utente seleziona `"elastic"` e salva il profilo
- THEN la mutation `mutateUtente` viene invocata con `preferenzaDragModale = "elastic"`
- AND al successo lo `userStore` viene aggiornato con `utente.preferenzaDragModale = "elastic"`

#### Scenario: Validazione del form rifiuta valori fuori whitelist

- GIVEN `ProfilePage` con il selettore della preferenza
- WHEN il form viene validato con un valore di `preferenzaDragModale` non in whitelist
- THEN la validazione Zod fallisce e il salvataggio non viene eseguito

#### Scenario: Salvataggio di altri campi preserva la preferenza

- GIVEN un utente con `preferenzaDragModale = "elastic"` che apre `ProfilePage`
- WHEN l'utente modifica solo il nome e salva senza cambiare il selettore
- THEN il valore `preferenzaDragModale = "elastic"` resta invariato dopo il salvataggio

---

## Dominio: Applicazione della preferenza al drag della modale

### Requirement: AppDialog rispetta la preferenza utente

Il componente condiviso `AppDialog` MUST derivare la modalità di drag predefinita dalla
preferenza dell'utente corrente presente nello `userStore`, invece che dalla costante
hardcoded oggi in uso. Poiché i consumatori esistenti non passano una prop `dragMode`
esplicita, la sorgente del default MUST propagarsi a tutte le modali dell'app. Una prop
`dragMode` passata esplicitamente da un consumatore MUST avere precedenza sulla preferenza
utente (override locale).

#### Scenario: Modalità free applicata alla modale

- GIVEN un utente con `preferenzaDragModale = "free"` caricato nello store
- WHEN una `AppDialog` viene aperta e trascinata dalla barra del titolo e poi rilasciata
- THEN al rilascio la modale resta nella posizione in cui è stata lasciata
- AND alla riapertura la modale è riposizionata al centro

#### Scenario: Modalità elastic applicata alla modale

- GIVEN un utente con `preferenzaDragModale = "elastic"` caricato nello store
- WHEN una `AppDialog` viene aperta, trascinata dalla barra del titolo e poi rilasciata
- THEN al rilascio la modale torna (snap-back) alla posizione di origine

#### Scenario: Prop dragMode esplicita ha precedenza

- GIVEN un utente con `preferenzaDragModale = "free"` caricato nello store
- WHEN un consumatore monta una `AppDialog` passando esplicitamente `dragMode = "elastic"`
- THEN quella modale usa il comportamento `"elastic"` indipendentemente dalla preferenza utente

#### Scenario: Cambio preferenza si riflette sulle modali successive

- GIVEN un utente con `preferenzaDragModale = "free"` che aggiorna la preferenza a `"elastic"` dal profilo
- WHEN dopo il salvataggio viene aperta una nuova `AppDialog`
- THEN la nuova modale adotta il comportamento `"elastic"`

---

## Dominio: Default nuovi utenti e fallback utente non caricato

### Requirement: Default free per i nuovi utenti

Un nuovo utente creato senza specificare la preferenza MUST nascere con
`preferenzaDragModale = "free"`.

#### Scenario: Nuovo utente senza preferenza esplicita

- GIVEN la creazione di un nuovo utente tramite `mutateUtente` senza `preferenzaDragModale`
- WHEN l'utente viene creato e successivamente autenticato
- THEN `utenteCorrente` restituisce `preferenzaDragModale: "free"`

### Requirement: Fallback free quando l'utente non è caricato

Quando l'utente corrente non è ancora caricato nello `userStore` (es. durante bootstrap,
prima del login, o dopo il logout) il client MUST usare `"free"` come modalità di drag di
default, così che le modali eventualmente aperte in queste fasi funzionino senza errori.
L'accesso alla preferenza SHOULD essere centralizzato (es. un hook dedicato) per garantire
un unico punto di fallback e non accoppiare direttamente il componente presentazionale allo
store.

#### Scenario: Modale aperta prima del caricamento del profilo

- GIVEN lo `userStore` con `utente = null` (profilo non ancora caricato)
- WHEN una `AppDialog` viene aperta e trascinata
- THEN la modale adotta il comportamento `"free"` (fallback)
- AND non viene sollevato alcun errore per l'assenza dell'utente

#### Scenario: Fallback dopo il logout

- GIVEN un utente che esegue il logout, portando `utente` a `null` nello store
- WHEN una `AppDialog` (es. searchbox o login) viene aperta
- THEN la modale adotta il comportamento `"free"` (fallback)
