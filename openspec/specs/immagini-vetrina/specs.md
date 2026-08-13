# Immagini della Vetrina Specification

**Domain**: immagini-vetrina
**Status**: Active
**Ultimo aggiornamento**: 2026-08-13

Change incorporate in questa spec:

| Change | Archiviata il | Contenuto |
|--------|---------------|-----------|
| vetrina-sito-astro | 2026-08-13 | Spec iniziale del dominio: sorgenti costruite solo dalle larghezze disponibili, dimensione di resa obbligatoria, due formati dichiarati, nessuno spostamento del contenuto, mai il componente immagine del framework sui media remoti |

È il **lato markup** del DTO dell'immagine definito dalla spec [`api-pubblica`](../api-pubblica/specs.md)
(*"una sola forma di immagine per tutta l'API pubblica"*, *"il DTO espone la chiave, non l'URL"*) e
della pipeline di varianti definita dalla spec [`media-assets`](../media-assets/specs.md).

## Purpose

Definire **come un'immagine del contratto pubblico diventa markup**: quali sorgenti si dichiarano,
quali no, cosa è obbligatorio dichiarare al componente e perché una singola omissione — la
dimensione di resa — triplica silenziosamente il peso della pagina.

Il dominio esiste separato perché tutte le sue regole discendono da un fatto **del backend** che il
sito non può ricalcolare: la pipeline genera le varianti che ha generato, e **non fa upscaling**.
Ogni riga di questa spec è una forma di "non dedurre ciò che ti è stato detto".

**Il contratto in ingresso**, verificato nel codice: chiave di storage, **elenco delle larghezze
disponibili**, larghezza e altezza dell'originale, testo alternativo, didascalia, punto focale già
nella forma utilizzabile dal client, placeholder come **data URI completo** (≤ 2 kB). Il backend
genera **due formati per ogni larghezza** — moderno e di ripiego — sulle larghezze effettivamente
prodotte
([`ImmagineProcessor.cs:376-377`](../../../backend/Services/Media/ImmagineProcessor.cs),
[`MediaAsset.cs:35-40`](../../../backend/Models/MediaAsset.cs)).

**Fuori scope in questa spec**: la composizione del prefisso dell'URL, che sta nella spec
[`consumo-api-pubblica`](../consumo-api-pubblica/specs.md); l'SVG del logo, che non è una risorsa
remota e sta nella spec [`temi-e-identita`](../temi-e-identita/specs.md).

**Fuori scope in questa fase**: lightbox della galleria e ogni altra isola interattiva; art
direction per breakpoint oltre l'uso della dimensione di resa; ottimizzazione di performance (Fase
7).

---

## Dominio: Le sorgenti responsive

### Requirement: 🔴 L'insieme delle sorgenti si costruisce solo dalle larghezze disponibili

L'insieme delle sorgenti responsive MUST essere costruito **esclusivamente** dall'elenco delle
larghezze disponibili dichiarato dal DTO, e MUST NOT essere dedotto riapplicando la regola di
generazione del backend, né da una costante del sito, né dalla larghezza dell'originale.

La pipeline **non fa upscaling**: una sorgente da 900 px produce le varianti fino a 800 e basta.
Riapplicare la regola emetterebbe URL che rispondono `404`, con un guasto che degrada **in
silenzio** e **in modo diverso da browser a browser** — ciascuno sceglie una variante diversa in
funzione della densità e della finestra.

Un elenco di larghezze **vuoto** è uno stato legittimo (il backend lo espone così per una riga
malformata o priva di varianti) e MUST NOT produrre un'eccezione: il componente MUST degradare a un
markup senza sorgenti multiple o omettere l'immagine, mai far fallire la pagina.

**Verifica per mutazione**: sostituire l'elenco del DTO con la costante delle larghezze standard
MUST far fallire lo scenario dell'immagine piccola. Un test che usasse solo un'immagine grande, le
cui varianti coincidono con la costante, resterebbe verde.

#### Scenario: 🔴 Immagine con meno varianti della costante

- GIVEN un'immagine il cui elenco di larghezze disponibili è `[400, 800]`
- WHEN il componente costruisce l'insieme delle sorgenti
- THEN dichiara esattamente due sorgenti
- AND nessuna sorgente cita una larghezza superiore a 800

#### Scenario: Immagine con tutte le varianti

- GIVEN un'immagine il cui elenco di larghezze disponibili è `[400, 800, 1200, 1600]`
- WHEN il componente costruisce l'insieme delle sorgenti
- THEN dichiara esattamente quattro sorgenti

#### Scenario: Nessuna larghezza dedotta

- GIVEN i sorgenti di `sito/`
- WHEN si cercano le larghezze delle varianti come costante
- THEN non esiste alcun elenco scritto a mano
- AND l'unica fonte è il campo del DTO

#### Scenario: Elenco di larghezze vuoto

- GIVEN un'immagine con elenco di larghezze disponibili vuoto
- WHEN la pagina che la contiene viene renderizzata
- THEN la pagina risponde `200`
- AND nessuna sorgente multipla viene dichiarata
- AND nessuna eccezione viene sollevata

#### Scenario: Nessuna variante inesistente viene richiesta

- GIVEN una pagina con immagini di larghezze diverse
- WHEN si aprono le pagine in un browser e si osserva la scheda di rete
- THEN ogni richiesta di variante risponde `200`
- AND nessuna risponde `404`

### Requirement: 🔴 La dimensione di resa è una proprietà obbligatoria

Il componente MUST dichiarare la dimensione di resa (`sizes`) come proprietà **obbligatoria**, la
cui omissione è un errore di tipo in fase di controllo, e MUST NOT prevedere alcun valore di
default.

Ometterla non è un errore per il browser: assume la larghezza dell'intera finestra e scarica la
variante più grande **anche per una miniatura**. Un default silenzioso che triplica il peso della
pagina è peggio di un errore di compilazione — e il componente **non può indovinare** il layout del
chiamante.

La dimensione di resa MUST essere dichiarata su **entrambe** le sorgenti del markup: quella del
formato moderno e quella di ripiego.

#### Scenario: 🔴 Omettere la dimensione di resa è un errore di tipo

- GIVEN un uso del componente senza la proprietà della dimensione di resa
- WHEN si esegue il controllo dei tipi
- THEN fallisce nominando la proprietà mancante

#### Scenario: Nessun default nel componente

- GIVEN il sorgente del componente
- WHEN si cerca un valore di default per la dimensione di resa
- THEN non esiste

#### Scenario: La dimensione di resa compare su entrambe le sorgenti

- GIVEN un'immagine renderizzata
- WHEN si ispeziona il markup prodotto
- THEN sia la sorgente del formato moderno sia quella di ripiego dichiarano la dimensione di resa

### Requirement: Il markup dichiara due formati, quelli che il backend ha già generato

Il markup MUST essere un elemento `<picture>` con una sorgente per il **formato moderno** e un
elemento immagine di ripiego nel **formato tradizionale**, perché il backend genera **entrambi** per
ogni larghezza.

Il formato di ripiego MUST essere quello dell'elemento immagine, così che un browser che non
supporti il formato moderno riceva comunque una variante corretta.

Il sito MUST NOT richiedere formati che il backend non genera.

Ogni elemento sorgente MUST essere scritto in forma **auto-chiusa** (spec `sito-pubblico`).

#### Scenario: Due formati nel markup

- GIVEN un'immagine renderizzata
- WHEN si ispeziona il markup prodotto
- THEN contiene una sorgente dichiarata nel formato moderno
- AND l'elemento immagine punta a una variante nel formato tradizionale

#### Scenario: Nessun formato inventato

- GIVEN i sorgenti di `sito/`
- WHEN si cercano le estensioni dei formati richiesti
- THEN sono soltanto le due che il backend genera

#### Scenario: Il markup compila con il compilatore severo

- GIVEN il componente dell'immagine
- WHEN si esegue la build
- THEN riesce
- AND ogni elemento sorgente è scritto in forma auto-chiusa

### Requirement: Le dimensioni dichiarate azzerano lo spostamento del contenuto

Il markup MUST dichiarare larghezza e altezza **dell'originale**, così che il rapporto d'aspetto sia
corretto e lo spostamento del contenuto durante il caricamento sia nullo, **anche se** la variante
effettivamente servita ha una larghezza diversa.

Il punto focale MUST essere applicato nella forma già fornita dal DTO, senza conversioni; in sua
assenza MUST essere usato il centro.

Il placeholder MUST essere usato **verbatim** come sfondo dell'elemento immagine: è un data URI
completo e non va composto né ricodificato. In sua assenza il markup MUST semplicemente non
dichiarare alcuno sfondo.

Il testo alternativo assente MUST produrre una stringa **vuota**, non un attributo assente: la
stringa vuota dichiara "decorativa" agli assistenti vocali, mentre l'attributo mancante fa loro
leggere l'URL.

L'immagine principale della pagina MAY essere marcata come prioritaria — caricamento immediato e
priorità alta —; tutte le altre MUST essere a caricamento differito, e la decodifica MUST essere
asincrona.

#### Scenario: Dimensioni dichiarate

- GIVEN un'immagine il cui originale è 2400×1600
- WHEN si ispeziona il markup prodotto
- THEN l'elemento immagine dichiara quelle due dimensioni
- AND le dichiara anche se la variante servita è da 800

#### Scenario: Nessuno spostamento di contenuto al caricamento

- GIVEN una pagina con immagini, aperta con throttling di rete
- WHEN si osserva il caricamento
- THEN il contenuto sotto le immagini non si sposta

#### Scenario: Punto focale applicato verbatim

- GIVEN un'immagine con punto focale dichiarato dal DTO
- WHEN si ispeziona il markup prodotto
- THEN il valore è applicato così com'è
- AND nessuna conversione è avvenuta

#### Scenario: Punto focale assente

- GIVEN un'immagine senza punto focale
- WHEN si ispeziona il markup prodotto
- THEN il posizionamento applicato è il centro

#### Scenario: Placeholder usato verbatim

- GIVEN un'immagine con placeholder dichiarato
- WHEN si ispeziona il markup prodotto
- THEN il data URI compare integralmente come sfondo
- AND non è stato ricomposto né ricodificato

#### Scenario: Placeholder assente

- GIVEN un'immagine senza placeholder
- WHEN si ispeziona il markup prodotto
- THEN nessuno sfondo viene dichiarato
- AND l'immagine si carica comunque

#### Scenario: Testo alternativo assente

- GIVEN un'immagine senza testo alternativo
- WHEN si ispeziona il markup prodotto
- THEN l'attributo del testo alternativo è presente con valore vuoto
- AND non è omesso

#### Scenario: Caricamento differito tranne la principale

- GIVEN una pagina con più immagini di cui una marcata prioritaria
- WHEN si ispeziona il markup prodotto
- THEN la prioritaria è a caricamento immediato con priorità alta
- AND tutte le altre sono a caricamento differito

### Requirement: 🔴 Mai il componente immagine del framework sui media remoti

Il sito MUST NOT usare il componente immagine del framework (né la sua variante per immagini
remote) per i media della libreria, e MUST NOT dichiarare alcuna configurazione di domini o pattern
remoti per le immagini.

Rifarebbe **a runtime** l'ottimizzazione che il backend ha **già** fatto, richiederebbe di
autorizzare ogni origine, e porterebbe la libreria di elaborazione immagini **con i suoi binari
nativi** nel container di Fase 6.

**Verifica per mutazione**: introdurre quel componente su un media remoto MUST far fallire il test
che ne pinna l'assenza. È una regola che nessun comportamento osservabile rivelerebbe — la pagina
funzionerebbe — ed è per questo che va pinnata invece che documentata.

#### Scenario: 🔴 Il componente immagine del framework non compare nei sorgenti

- GIVEN i sorgenti di `sito/`
- WHEN si cercano gli import del componente immagine del framework
- THEN non esiste alcuna occorrenza

#### Scenario: Nessuna autorizzazione di origini remote nella configurazione

- GIVEN la configurazione del progetto
- WHEN se ne leggono le opzioni relative alle immagini
- THEN non dichiara alcun dominio né pattern remoto

#### Scenario: Nessuna libreria di elaborazione immagini fra le dipendenze

- GIVEN le dipendenze di `sito/`
- WHEN se ne enumerano i pacchetti
- THEN non compare alcuna libreria di elaborazione immagini con binari nativi

### Requirement: La composizione dell'URL della variante è verificabile in isolamento

La composizione dell'URL di una variante MUST essere una funzione **pura** del modulo unico di
composizione (spec `consumo-api-pubblica`), verificabile senza rete e senza browser: dalla chiave,
dalla larghezza e dal formato produce l'URL, anteponendo il prefisso dei media.

Il componente MUST NOT comporre URL per conto proprio (spec `consumo-api-pubblica`, unicità del
compositore).

#### Scenario: Composizione di un URL di variante

- GIVEN la chiave di un media, la larghezza `800` e il formato moderno
- WHEN si invoca la funzione di composizione
- THEN l'URL prodotto inizia con il prefisso dei media
- AND contiene la chiave, la larghezza e l'estensione del formato

#### Scenario: L'insieme delle sorgenti si compone dalla stessa funzione

- GIVEN un'immagine con due larghezze disponibili
- WHEN si costruisce l'insieme delle sorgenti
- THEN ogni voce è stata prodotta dalla funzione di composizione
- AND ogni voce dichiara la propria larghezza come descrittore

#### Scenario: Il componente non compone URL da sé

- GIVEN il sorgente del componente dell'immagine
- WHEN si cerca il segmento di percorso dei media
- THEN non compare
- AND il componente si limita a invocare il modulo di composizione
