# Delta per impostazioni-vetrina

**Domain**: impostazioni-vetrina
**Change**: pannello-sito-per-pagine
**Date**: 2026-08-13
**Status**: Draft
**Tipo**: DELTA sulla spec attiva [`openspec/specs/impostazioni-vetrina/specs.md`](../../../../specs/impostazioni-vetrina/specs.md)

## Purpose del delta

La spec attiva descrive **una pagina di amministrazione, un input, un solo scrittore**. Questo
change ne fa **sei schede** — cinque pagine del sito più la scheda trasversale del sito — e con la
divisione cade la condizione che rendeva sicura l'assegnazione totale: *esiste un solo scrittore che
possiede tutti i campi*.

Il delta definisce quindi tre cose e nient'altro:

1. **cosa deve mostrare** ogni scheda di pagina — quante immagini, quali testi, e se la pagina
   esiste;
2. **chi possiede cosa** — la partizione dei campi scrivibili, resa totale, disgiunta e verificata;
3. **cosa un salvataggio non può fare** — toccare un campo che la scheda non mostra.

⚠️ **Correzione di conteggio rispetto alla proposal**: i campi scrivibili sono **30**, non 31. Il
pin per riflessione
[`ImpostazioniVetrinaInput_HaEsattamenteICampiScrivibili`](../../../../../backend/DuedGusto.Tests/Integration/GraphQL/ImpostazioniVetrinaTests.cs)
ne elenca trenta, e trenta ne dichiara
[`ImpostazioniVetrinaInputType.cs`](../../../../../backend/GraphQL/Vetrina/Types/ImpostazioniVetrinaInputType.cs).
Ogni requisito qui sotto parla di *insieme dei campi scrivibili*, mai del numero: il numero è scritto
una volta, in questa nota, perché il requisito sopravviva al campo trentunesimo.

⚠️ **Decisioni di design ancora aperte**, dichiarate qui perché alcuni requisiti sono **condizionali**
e il loro ramo si scioglie solo in design:

| Nodo | Cosa resta da decidere | Requisiti condizionati |
|---|---|---|
| **A** (§2 della proposal) | Forma della scrittura partizionata: A1 / A2 / A3 | *La forma* del canale di scrittura. **Non** le proprietà che deve avere: quelle sono requisiti incondizionati qui sotto |
| **B** (§3 della proposal) | Cartelle per pagina (B1) / slot nominati (B2) / convenzione posizionale spiegata (B3) | La forma della risposta a «quante immagini». Vedi il delta [`media-assets`](../media-assets/spec.md) |

**Fuori scope di questo delta**: il CMS a blocchi generico, le prenotazioni, gli eventi, le
promozioni, il titolo e la descrizione SEO per pagina (nominati dalla proposal e **non** inclusi), e
ogni modifica alle mutation di prodotti, media e recensioni.

**Stato verificato del codice prima del change**:

- Il sottomenu «Sito» ha **quattro** figli (posizioni 1-4) sotto un padre a `Posizione = 9`, icona
  `Globe`; il campo d'ordine si chiama **`Posizione`**, non `Ordinamento`.
- `ImpostazioniVetrinaPage.tsx` è un modulo Formik unico su **tutti** i campi scrivibili.
- `turnstileSiteKey` **non si mostra e si trasporta**, e il modulo dichiara per iscritto la ragione:
  *«un campo che il modulo non rispedisce viene azzerato dal salvataggio»*
  ([impostazioniVetrinaModulo.tsx:69-74](../../../../../duedgusto/src/components/pages/sito/impostazioniVetrinaModulo.tsx)).
- `/aperitivo` e `/locale` rispondono **404** quando `AperitivoTesto` / `StoriaTesto` sono vuoti, e
  spariscono da intestazione, piè di pagina, 404 e sitemap tramite l'unico filtro
  [`rotteDisponibili`](../../../../../sito/src/lib/rotte.ts).
- La regola di esistenza di una sezione guarda **solo il corpo del testo**: un titolo senza testo non
  la fa esistere ([PublicController.cs:453-464](../../../../../backend/Controllers/PublicController.cs)).
- Dieci campi sono di una pagina sola; `/menu` e `/contatti` non ne possiedono nessuno.

---

## Dominio: Il pannello modellato sulle pagine

### ADDED Requirements

### Requirement: Una voce di menu per ogni pagina del sito, con le etichette del sito

Il sottomenu «Sito» MUST contenere **una voce per ciascuna pagina del sito vetrina**, e le voci MUST
portare **le stesse etichette** dichiarate da [`rotte.ts`](../../../../../sito/src/lib/rotte.ts):
`Home`, `Menu`, `Aperitivo`, `Il locale`, `Contatti`.

`rotte.ts` MUST restare la **sorgente unica** dell'elenco delle pagine: il pannello la **rispecchia**
e MUST NOT diventarne una seconda scrittura autonoma. Una divergenza fra le due liste — una pagina
del sito senza scheda, o una scheda che nomina una pagina che non esiste — MUST essere rilevata da
una verifica automatica e MUST NOT dipendere dal fatto che qualcuno se ne accorga.

🔴 La voce di menu di una pagina MUST esistere **anche quando la pagina del sito non esiste**.
Nascondere la scheda di `/aperitivo` finché il testo è vuoto toglierebbe l'unico posto da cui quel
testo si può scrivere: la scheda è ciò che **crea** la pagina, non il suo riflesso.

Le voci MUST essere assegnate ai soli ruoli con flag amministratore, come le quattro esistenti.

#### Scenario: Le cinque schede esistono e portano le etichette del sito

- GIVEN un amministratore autenticato
- WHEN apre il sottomenu «Sito»
- THEN vi trova cinque voci di pagina, una per ciascuna rotta dichiarata dal sito
- AND ciascuna etichetta è identica, carattere per carattere, a quella dichiarata da `rotte.ts`
- AND selezionando ognuna si apre la scheda corrispondente

#### Scenario: 🔴 Una pagina aggiunta al sito senza scheda viene rilevata

- GIVEN una sesta rotta aggiunta all'elenco delle pagine del sito
- WHEN si esegue la verifica automatica del progetto
- THEN una verifica fallisce nominando la pagina che non ha una scheda
- AND il guasto non si manifesta soltanto come una voce mancante che nessuno nota

#### Scenario: 🔴 La scheda dell'aperitivo esiste anche a pagina inesistente

- GIVEN il testo dell'aperitivo vuoto, quindi `/aperitivo` che risponde 404 sul sito
- WHEN un amministratore apre il sottomenu «Sito»
- THEN la voce «Aperitivo» è presente e apre la sua scheda
- AND la scheda permette di scrivere il testo che fa nascere la pagina

#### Scenario: Un ruolo non amministrativo non vede alcuna scheda

- GIVEN un utente autenticato il cui ruolo non ha il flag amministratore
- WHEN carica la propria navigazione
- THEN nessuna delle voci del sottomenu «Sito» compare
- AND una chiamata diretta all'endpoint GraphQL per leggere o scrivere i dati di una scheda viene
  rifiutata

### Requirement: 🔴 Ogni scheda risponde alle tre domande, e le risponde in prima pagina

Ogni scheda di pagina MUST rispondere, **nell'ordine**, alle tre domande che l'amministratore pone:

| # | Domanda | Cosa MUST mostrare la scheda |
|---|---|---|
| 1 | **Esiste?** | Lo stato di pubblicazione della pagina, come **prima riga** della scheda |
| 2 | **Quante immagini?** | Il numero di posti immagine della pagina, quali sono e cosa succede a lasciarli vuoti |
| 3 | **Quali testi?** | I testi **di proprietà** (modificabili qui) e i testi **ereditati** (in sola lettura, con il collegamento a dove si cambiano) |

Le tre risposte MUST essere leggibili **senza aprire alcun pannello a scomparsa** e MUST NOT essere
relegate a un testo d'aiuto, a un asterisco o a un suggerimento a comparsa: sono il contenuto della
scheda, non la sua glossa.

Una scheda che non possiede alcun testo proprio (`/menu`, `/contatti`) MUST comunque rispondere a
tutte e tre le domande e MUST NOT presentarsi come una pagina vuota o come un errore: è una **mappa**
di ciò che la governa altrove, ed è precisamente la risposta che l'amministratore cerca.

#### Scenario: La scheda del locale risponde alle tre domande

- GIVEN un amministratore che apre la scheda «Il locale»
- WHEN la scheda si carica
- THEN la prima riga dichiara se la pagina è pubblicata
- AND una sezione dichiara quante immagini la pagina ospita e quali sono
- AND una sezione elenca i testi di proprietà della pagina, modificabili lì
- AND una sezione elenca i testi ereditati dal sito, in sola lettura, con il collegamento a dove si
  cambiano

#### Scenario: 🔴 Una scheda senza testi propri non è una scheda vuota

- GIVEN un amministratore che apre la scheda «Contatti»
- WHEN la scheda si carica
- THEN dichiara che la pagina non possiede alcun testo proprio
- AND elenca comunque i dati che la governano — indirizzo, contatti, social, orari — con il
  collegamento a dove si modificano
- AND non mostra alcun messaggio di errore né alcuna area vuota senza spiegazione

#### Scenario: Le tre risposte non sono nascoste

- GIVEN una scheda di pagina qualunque
- WHEN la si apre senza espandere alcuna sezione e senza soffermarsi su alcun elemento
- THEN stato di pubblicazione, numero di immagini ed elenco dei testi sono già leggibili

### Requirement: 🔴 «Quante immagini» è un numero, ed è verificato contro la pagina

Ogni scheda MUST dichiarare un **numero esatto** di posti immagine della propria pagina. Il numero
MUST NOT essere una stima, un intervallo o una frase.

La scheda MUST distinguere due grandezze che oggi si confondono:

- **quanti posti** la pagina ospita — la sua capacità;
- **quanti sono occupati adesso** — e, se un posto è vuoto, cosa la pagina rende al suo posto.

Una pagina che non ospita alcuna immagine MUST dichiarare **zero esplicitamente**. L'assenza della
sezione non è una risposta: è la stessa mancanza di informazione da cui il change nasce.

L'immagine di anteprima social è **condivisa da tutte le pagine** e MUST essere dichiarata come tale
su ognuna, MUST NOT essere contata fra i posti immagine di una singola pagina, e MUST restare
modificabile da un solo posto.

🔴 Il numero dichiarato MUST coincidere con quello che la pagina del sito consuma davvero, e la
coincidenza MUST essere imposta da una verifica automatica che **fa fallire la build** quando le due
divergono. Un numero scritto a mano nella scheda è la stessa classe di guasto della mappa dei campi:
diverge al primo ritocco del sito, e diverge in silenzio.

⚠️ I valori seguenti descrivono il sito **alla data di questo change** e sono la base di partenza
della verifica, non il requisito: il requisito è la **coincidenza**.

| Scheda | Posti immagine dichiarati | Note |
|---|---|---|
| Home | 4 | 1 in evidenza + 3 in griglia. In più, una foto viene dal **prodotto** in vetrina e non dalla galleria: MUST essere dichiarata a parte |
| Menu | 3 | in coda al listino |
| Aperitivo | 1 | in evidenza |
| Il locale | 4 | 1 ritratto + 3 quadrate |
| Contatti | 0 | dichiarato esplicitamente |

**Verifica per mutazione**: cambiare il numero di immagini che una pagina del sito consuma, senza
aggiornare la dichiarazione, MUST far fallire la verifica. Una verifica che si limitasse a
controllare che il numero è presente resterebbe verde.

#### Scenario: Il numero dichiarato è quello reso

- GIVEN la galleria con almeno tante immagini quanti sono i posti della pagina
- WHEN si confronta il numero dichiarato dalla scheda con le immagini rese dalla pagina del sito
- THEN i due numeri coincidono

#### Scenario: 🔴 Posti vuoti — capacità e riempimento sono grandezze diverse

- GIVEN una galleria con meno immagini di quanti sono i posti della pagina
- WHEN un amministratore apre la scheda di quella pagina
- THEN la scheda dichiara quanti posti la pagina ospita
- AND dichiara quanti sono occupati adesso
- AND dichiara che cosa la pagina rende al posto di quelli vuoti

#### Scenario: Zero è una risposta scritta

- GIVEN un amministratore sulla scheda «Contatti»
- WHEN cerca la risposta alla domanda sulle immagini
- THEN legge che la pagina non ospita alcuna immagine
- AND legge che l'unica immagine associata è l'anteprima social, condivisa da tutte le pagine

#### Scenario: 🔴 Verifica per mutazione del conteggio

- GIVEN la verifica automatica del conteggio delle immagini verde
- WHEN si modifica una pagina del sito perché consumi un'immagine in più, senza toccare la
  dichiarazione
- THEN la verifica fallisce nominando la pagina e i due numeri

#### Scenario: L'anteprima social non gonfia il conteggio

- GIVEN le cinque schede di pagina
- WHEN si sommano i posti immagine dichiarati
- THEN l'immagine di anteprima social non compare in alcuno di quei conteggi
- AND ogni scheda la dichiara comunque come condivisa, con il collegamento a dove si cambia

### Requirement: 🔴 I testi si dividono in «di proprietà» e «ereditati», e la scheda dice quale è quale

Ogni scheda MUST presentare i testi in **due gruppi distinti e nominati**:

- **di proprietà** — modificabili da quella scheda e **solo** da quella;
- **ereditati** — mostrati **in sola lettura**, con il **collegamento** al posto in cui si
  modificano.

Un campo letto da più pagine MUST comparire come *letto* su tutte e come *modificabile* su **una
sola**. La regola non è *un campo, una pagina*: è **un campo, un proprietario**. I testi
dell'aperitivo sono letti anche dalla home e restano di proprietà della scheda «Aperitivo».

Un testo che il sito scrive **nel proprio sorgente** e che nessun campo governa — la descrizione per
i motori di ricerca di `/menu` ne è il caso vivo — MUST essere dichiarato dalla scheda come **non
modificabile da qui**, con il motivo, e MUST NOT essere presentato come un campo: un campo che si
compila e non produce alcun effetto viene segnalato come difetto, ed è la stessa regola già applicata
ai ganci spenti.

Il testo di sola lettura MUST essere distinguibile da un campo modificabile **senza provare a
scriverci dentro**.

#### Scenario: Un testo condiviso è modificabile da una scheda sola

- GIVEN il titolo dell'aperitivo, letto sia dalla home sia dalla pagina dell'aperitivo
- WHEN un amministratore apre la scheda «Home»
- THEN il titolo dell'aperitivo compare fra i testi ereditati, in sola lettura
- AND porta il collegamento alla scheda «Aperitivo»
- AND non esiste alcun modo di modificarlo dalla scheda «Home»

#### Scenario: Lo stesso testo è modificabile dalla sua scheda

- GIVEN lo stesso titolo dell'aperitivo
- WHEN un amministratore apre la scheda «Aperitivo»
- THEN il titolo compare fra i testi di proprietà ed è modificabile
- AND salvando, il nuovo valore è quello che la home mostra

#### Scenario: 🔴 Un testo scritto nel sorgente del sito è dichiarato tale

- GIVEN la scheda «Menu»
- WHEN un amministratore cerca la descrizione della pagina per i motori di ricerca
- THEN la scheda dichiara che quel testo è scritto nel sorgente del sito e non è modificabile da qui
- AND non esiste alcun campo che sembri modificarlo

#### Scenario: Sola lettura riconoscibile a colpo d'occhio

- GIVEN una scheda che mostra sia testi di proprietà sia testi ereditati
- WHEN si osservano i due gruppi
- THEN sono separati e nominati
- AND i testi ereditati sono riconoscibili come non modificabili senza doverli attivare

### Requirement: 🔴 La mappa pagina → campi è una sola, ed è verificata contro il sito

La corrispondenza fra le pagine del sito e i campi che le governano MUST essere dichiarata **in un
posto solo**. Le schede, la dichiarazione di proprietà e ogni conteggio derivato MUST leggere da
quella dichiarazione e MUST NOT possederne una copia.

🔴 La mappa MUST essere **verificata contro i sorgenti del sito**: una verifica automatica MUST
fallire quando una pagina del sito legge un campo che la mappa non le attribuisce. Senza,
la mappa diverge dal sito al primo campo aggiunto — e un pannello che orienta con sicurezza nella
direzione sbagliata è peggio di un pannello che non orienta.

La verifica SHOULD fallire anche nel verso opposto — un campo dichiarato letto da una pagina che non
lo legge più — perché una mappa che elenca campi morti invecchia nello stesso modo, solo più
lentamente.

Il gestionale MUST NOT dipendere dalla **build** del sito per funzionare: la verifica è un confronto
fra due dichiarazioni, non un'estrazione a tempo di compilazione.

**Verifica per mutazione**: aggiungere a una pagina `.astro` la lettura di un campo, senza aggiornare
la mappa, MUST far fallire la verifica.

#### Scenario: 🔴 Un campo letto e non dichiarato fa fallire la verifica

- GIVEN la mappa allineata ai sorgenti del sito
- WHEN si aggiunge a una pagina del sito la lettura di un campo che la mappa non le attribuisce
- THEN la verifica automatica fallisce nominando la pagina e il campo

#### Scenario: La mappa non ha una seconda copia

- GIVEN il codice del change applicato
- WHEN si cerca la corrispondenza fra pagine e campi
- THEN esiste una sola dichiarazione
- AND schede, elenchi e conteggi la leggono invece di ripeterla

#### Scenario: Il gestionale non dipende dalla build del sito

- GIVEN il progetto del sito non compilato
- WHEN si eseguono build, controllo dei tipi e test del gestionale
- THEN passano

---

## Dominio: La proprietà dei campi e la scrittura

### ADDED Requirements

### Requirement: 🔴 La partizione dei campi scrivibili è totale e disgiunta

Ogni campo scrivibile delle impostazioni della vetrina MUST avere **esattamente un proprietario** fra
le sei schede — le cinque pagine e la scheda trasversale del sito.

- **Totale**: nessun campo MUST restare orfano. Un campo che nessuna scheda possiede è un campo che
  nessuno può più modificare, e la sua perdita è invisibile: il valore resta corretto finché non
  serve cambiarlo.
- **Disgiunta**: nessun campo MUST avere due proprietari. Due schede che scrivono lo stesso campo
  sono due verità, e vince l'ultima che salva.

🔴 Il pin per riflessione oggi esistente MUST essere riscritto da *«l'input possiede esattamente i
campi scrivibili»* a **«l'unione dei perimetri è esattamente l'insieme dei campi scrivibili, e le
intersezioni sono vuote»**. Nella sua forma attuale il pin resterebbe verde su una partizione che
perde metà dei campi.

⚠️ I due **grappoli a validazione incrociata** — latitudine con longitudine, punteggio con numero di
recensioni — MUST appartenere ciascuno a **una sola** scheda. I due membri di una coppia su schede
diverse renderebbero la regola *«insieme o nessuno dei due»* impossibile da valutare al momento del
salvataggio.

I dieci campi specifici di una pagina MUST appartenere alla pagina che li rende:

| Proprietario | Campi |
|---|---|
| Home | il paragrafo sotto il titolo; i tre della reputazione (punteggio, numero di recensioni, profilo) |
| Il locale | titolo e testo della storia |
| Aperitivo | titolo, testo, punti e categorie dell'aperitivo |

⚠️ L'assegnazione dei campi **trasversali** rimanenti — identità, indirizzo, coordinate, contatti,
social, SEO di default, anteprima social, aspetto, ganci spenti — è una decisione di **design**, e
questo delta la vincola soltanto con le tre regole sopra.

**Verifica per mutazione**: togliere un campo dal perimetro della sua scheda MUST far fallire la
verifica di totalità; aggiungere lo stesso campo al perimetro di due schede MUST far fallire quella
di disgiunzione.

#### Scenario: 🔴 L'unione dei perimetri è l'insieme dei campi scrivibili

- GIVEN i perimetri dichiarati delle sei schede
- WHEN se ne calcola l'unione e la si confronta con l'insieme dei campi scrivibili
- THEN i due insiemi coincidono

#### Scenario: 🔴 Nessun campo ha due proprietari

- GIVEN i perimetri dichiarati delle sei schede
- WHEN se ne calcolano le intersezioni a due a due
- THEN sono tutte vuote

#### Scenario: 🔴 Verifica per mutazione — campo orfano

- GIVEN la verifica della partizione verde
- WHEN si toglie un campo dal perimetro della scheda che lo possiede
- THEN la verifica fallisce nominando il campo rimasto senza proprietario

#### Scenario: 🔴 Verifica per mutazione — campo conteso

- GIVEN la verifica della partizione verde
- WHEN si aggiunge un campo già posseduto al perimetro di una seconda scheda
- THEN la verifica fallisce nominando il campo e le due schede

#### Scenario: Le coppie a validazione incrociata non si separano

- GIVEN i perimetri dichiarati
- WHEN si verifica dove cadono latitudine e longitudine, e dove cadono punteggio e numero di
  recensioni
- THEN i due membri di ciascuna coppia appartengono alla stessa scheda

#### Scenario: Un campo aggiunto in futuro non può restare fuori

- GIVEN un campo scrivibile nuovo aggiunto all'entità e all'input
- WHEN si esegue la verifica della partizione senza attribuirlo ad alcuna scheda
- THEN fallisce
- AND il messaggio nomina il campo

### Requirement: 🔴 Nessun salvataggio azzera un campo che la sua scheda non mostra

**È il requisito centrale del change.** Un salvataggio effettuato da una scheda MUST lasciare
invariato **ogni** campo che non appartiene al perimetro di quella scheda — invariato nel valore, non
soltanto «non mostrato modificato».

Il sistema MUST NOT ricorrere al **trasporto invisibile** per ottenere questa proprietà: un campo che
una scheda non mostra MUST NOT essere spedito da quella scheda. Il trucco oggi applicato a
`turnstileSiteKey` — trasportato senza essere mostrato — è una difesa che con sei schede diventerebbe
**sei superfici di trasporto invisibile**, ognuna capace di riscrivere un valore che il suo
utilizzatore non ha mai visto.

🔴 La verifica MUST essere **campo per campo** e MUST essere **per mutazione**: togliere un campo dal
perimetro dichiarato di una scheda, lasciando che il suo canale continui a scriverlo, MUST far
diventare rosso almeno un test. Il test frontend oggi esistente — *«ogni valore del modulo finisce
nell'input»* — confronta il modulo **con se stesso** e resterebbe verde su una scheda che ne conosce
cinque su trenta mentre il salvataggio ne azzera venticinque: MUST essere riscritto **prima** che il
modulo si divida, non dopo.

Il rifiuto di una validazione MUST NOT lasciare alcuna scrittura parziale, dentro né fuori il
perimetro.

#### Scenario: 🔴 Salvataggio a vuoto di ciascuna scheda

- GIVEN tutti i campi scrivibili valorizzati con valori distinti e riconoscibili
- WHEN un amministratore apre ciascuna delle sei schede e salva senza modificare nulla
- THEN dopo ogni salvataggio il valore di ogni campo è identico a quello di partenza, campo per campo

#### Scenario: 🔴 Salvataggio con una modifica dentro il perimetro

- GIVEN tutti i campi scrivibili valorizzati con valori distinti e riconoscibili
- WHEN un amministratore modifica un solo campo dalla scheda che lo possiede e salva
- THEN quel campo assume il nuovo valore
- AND ogni altro campo è identico a prima, campo per campo

#### Scenario: 🔴 La chiave del servizio antispam sopravvive a tutti i salvataggi

- GIVEN la chiave del servizio antispam valorizzata
- WHEN un amministratore salva ciascuna delle schede che non la possiedono
- THEN dopo ogni salvataggio la chiave è ancora quella
- AND lo è anche interrogando direttamente il dato persistito, non solo la scheda

#### Scenario: 🔴 Nessun trasporto invisibile

- GIVEN il codice del change applicato
- WHEN si confronta, per ogni scheda, l'insieme dei campi che la scheda mostra con l'insieme dei
  campi che la scheda spedisce
- THEN i due insiemi coincidono per ogni scheda
- AND non esiste alcun campo spedito senza essere mostrato

#### Scenario: 🔴 Verifica per mutazione dell'assenza di azzeramento incrociato

- GIVEN i test dell'amministrazione verdi
- WHEN si toglie un campo dal perimetro dichiarato di una scheda lasciando che il suo canale continui
  a scriverlo
- THEN almeno un test fallisce nominando il campo

#### Scenario: Due schede aperte insieme non si sovrascrivono

- GIVEN due amministratori che aprono due schede diverse sullo stesso dato
- WHEN il primo modifica e salva un campo del proprio perimetro, e poi il secondo salva la propria
  scheda senza aver ricaricato
- THEN il valore scritto dal primo è ancora quello persistito

#### Scenario: Una validazione rifiutata non scrive nulla

- GIVEN tutti i campi valorizzati
- WHEN un salvataggio viene rifiutato da una validazione
- THEN nessun campo risulta modificato, né dentro né fuori il perimetro della scheda

### MODIFIED Requirements

### Requirement: 🔴 Scrittura ad assegnazione totale: un campo si deve poter svuotare

Ogni canale di scrittura MUST assegnare **tutti** i campi del **proprio perimetro** a ogni
invocazione. Il sistema MUST NOT assegnare i campi sotto condizione di non vuoto, in nessun canale.

(Previously: esisteva **un solo** canale di scrittura, che assegnava **tutti** i campi scrivibili a
ogni invocazione. Con la divisione in schede il perimetro dell'assegnazione totale diventa il
perimetro della scheda, e l'invariante *«non c'è nulla da ricordarsi di preservare, perché non c'è
nulla che questo canale possa toccare fuori perimetro»* MUST essere ristabilita dalla partizione
totale e disgiunta, non dedotta.)

🔴 **La conseguenza vincolante non cambia: un campo valorizzato MUST poter essere svuotato.**
Cancellare il link Facebook e salvare MUST persistere l'assenza. La forma condizionale
(`if (!string.IsNullOrEmpty(...))`) MUST NOT essere introdotta in alcun canale, e la semantica
*patch* — «assente» distinto da «null» — MUST NOT essere adottata come rimedio all'azzeramento
incrociato: risolverebbe il problema nuovo reintroducendo quello che la spec ha scelto di non avere.

L'assenza MUST continuare ad avere **una sola rappresentazione**: stringa vuota o di soli spazi
persistita come nulla.

Lo scenario di svuotamento oggi provato MUST continuare a passare **senza modifiche di sostanza**: se
per farlo passare occorre cambiarne il significato, la partizione è sbagliata.

#### Scenario: 🔴 Svuotamento di un campo opzionale, dalla scheda che lo possiede

- GIVEN il link Facebook valorizzato
- WHEN un amministratore lo cancella dalla scheda che lo possiede e salva
- THEN il valore persistito è nullo
- AND la rilettura restituisce nullo

#### Scenario: 🔴 Verifica per mutazione dell'assegnazione totale, in ogni canale

- GIVEN i test dell'amministrazione verdi
- WHEN si sostituisce, in un canale di scrittura qualunque, l'assegnazione di un campo opzionale con
  una forma condizionata al valore non vuoto
- THEN lo scenario di svuotamento di quel canale fallisce

#### Scenario: Nessuna semantica di patch

- GIVEN lo schema GraphQL del change applicato
- WHEN si ispezionano gli input di scrittura
- THEN nessuno distingue «campo assente» da «campo a null»
- AND ogni campo del perimetro è presente a ogni invocazione

#### Scenario: Lo scenario di svuotamento preesistente resta valido

- GIVEN il test che prova la persistenza dell'assenza di un campo opzionale
- WHEN si esegue la suite dopo il change
- THEN passa
- AND la sua asserzione non è stata indebolita

### Requirement: Una pagina nella sezione del sito, sul pattern delle impostazioni esistenti

La pagina delle impostazioni della vetrina MUST sopravvivere, **ridotta ai campi realmente
trasversali** — identità, indirizzo, posizione, contatti e social, dati di default per i motori di
ricerca, aspetto, ganci spenti — e MUST essere rinominata in modo che il suo nome dica cosa contiene
adesso: non è più «le impostazioni del sito», è **la scheda del sito accanto alle schede delle
pagine**.

(Previously: la stessa pagina ospitava **tutti** i campi scrivibili in undici sezioni, inclusi i testi
editoriali che questo change sposta nelle schede di pagina.)

I testi editoriali migrati MUST NOT restare anche qui: due posti che modificano lo stesso testo sono
la violazione della disgiunzione.

Le proprietà già garantite dalla pagina MUST sopravvivere intatte e MUST valere **su tutte** le
schede nuove, non soltanto su questa:

- selezione delle immagini tramite il selettore di media **già esistente**, senza un secondo percorso
  di scelta;
- validazione incrociata delle coordinate lato client, che **non sostituisce** quella del backend;
- dichiarazione esplicita che i ganci spenti non sono ancora attivi;
- conferma esplicita all'uscita con modifiche non salvate;
- assenza di qualunque campo di orario, con l'indicazione di dove si modificano.

#### Scenario: La scheda del sito non contiene più i testi editoriali

- GIVEN un amministratore sulla scheda del sito
- WHEN ne percorre le sezioni
- THEN non trova alcun campo dei testi editoriali migrati nelle schede di pagina
- AND trova identità, indirizzo, posizione, contatti, social, dati per i motori di ricerca, aspetto e
  ganci spenti

#### Scenario: Le proprietà della pagina valgono su tutte le schede

- GIVEN ciascuna delle sei schede
- WHEN un amministratore modifica un campo e tenta di abbandonarla senza salvare
- THEN viene richiesta una conferma esplicita

#### Scenario: Un solo percorso di scelta delle immagini

- GIVEN una scheda qualunque che permetta di scegliere un'immagine
- WHEN si apre la scelta
- THEN compare il selettore di media già esistente
- AND non esiste alcun secondo percorso di caricamento o di scelta

#### Scenario: La validazione del client non è l'unico controllo, su ogni scheda

- GIVEN una regola incrociata di una scheda qualunque, violata
- WHEN i valori vengono inviati direttamente all'endpoint GraphQL senza passare dalla scheda
- THEN la scrittura viene rifiutata dal backend

---

## Dominio: Lo stato di pubblicazione

### ADDED Requirements

### Requirement: 🔴 «Campo vuoto = pagina inesistente» si vede prima del salvataggio, non dopo

Per le pagine la cui esistenza dipende da un testo — oggi `/aperitivo` e `/locale`, **due su cinque**
— la scheda MUST dichiarare lo stato di pubblicazione come **prima riga**, e MUST dirlo con le
conseguenze intere: la pagina **risponde 404**, **sparisce dalla navigazione** dell'intestazione e del
piè di pagina, e **sparisce dalla sitemap**.

Il criterio MUST essere **lo stesso del backend**: solo il **corpo del testo** decide. Un titolo
compilato senza il testo MUST essere mostrato come pagina **non pubblicata**, perché è precisamente
lo stato in cui si finisce compilando un modulo a metà — ed è lo stato che oggi nessuna riga
dell'interfaccia nomina.

🔴 Quando un salvataggio **farebbe sparire** una pagina oggi pubblicata, il sistema MUST chiedere una
**conferma esplicita** prima di eseguirlo, e la richiesta MUST nominare la pagina e l'effetto. È
l'unico punto del prodotto in cui svuotare un campo **cancella un URL**, e la conferma MUST NOT
essere una notifica successiva: dopo il salvataggio l'URL è già sparito.

La conferma MUST NOT comparire quando la pagina è **già** non pubblicata: chiedere conferma per
un'azione senza effetto insegna a confermare senza leggere.

Un salvataggio che **fa nascere** una pagina prima inesistente MUST dichiararlo nell'esito: è
un'informazione che l'amministratore non ha modo di ricavare altrove.

#### Scenario: 🔴 Pagina non pubblicata, dichiarata in prima riga

- GIVEN il testo della storia vuoto
- WHEN un amministratore apre la scheda «Il locale»
- THEN la prima riga dichiara che la pagina non è pubblicata
- AND dichiara che senza quel testo la pagina risponde 404
- AND dichiara che non compare nella navigazione del sito né nella sitemap

#### Scenario: 🔴 Titolo compilato e testo vuoto è ancora «non pubblicata»

- GIVEN il titolo della storia valorizzato e il testo vuoto
- WHEN un amministratore apre la scheda «Il locale»
- THEN la pagina risulta non pubblicata
- AND la scheda indica che è il testo, non il titolo, a farla esistere

#### Scenario: 🔴 Conferma prima di far sparire una pagina pubblicata

- GIVEN la pagina dell'aperitivo pubblicata
- WHEN un amministratore cancella il testo dell'aperitivo e tenta di salvare
- THEN viene richiesta una conferma esplicita che nomina la pagina e dichiara che sparirà dal sito
- AND annullando, nulla viene salvato
- AND confermando, il salvataggio avviene e lo stato in prima riga si aggiorna

#### Scenario: Nessuna conferma quando non c'è nulla da far sparire

- GIVEN la pagina dell'aperitivo già non pubblicata
- WHEN un amministratore salva la scheda lasciando il testo vuoto
- THEN nessuna conferma viene richiesta

#### Scenario: Un salvataggio che fa nascere una pagina lo dichiara

- GIVEN la pagina del locale non pubblicata
- WHEN un amministratore scrive il testo della storia e salva
- THEN l'esito dichiara che la pagina è ora pubblicata e raggiungibile
- AND la prima riga della scheda lo riflette

#### Scenario: Le pagine sempre presenti non mostrano uno stato condizionato

- GIVEN le schede «Home», «Menu» e «Contatti»
- WHEN un amministratore le apre
- THEN dichiarano che la pagina esiste sempre
- AND non mostrano alcuna conferma di sparizione al salvataggio

### Requirement: Le altre sorgenti si mostrano, non si modificano

Nessuna scheda MUST offrire un campo per modificare gli **orari**: hanno una sola sorgente, le
impostazioni della cassa, e lo sbarramento a modello, a schema e a test MUST restare invariato. Le
schede che li mostrano MUST mostrarli **in sola lettura**, con il collegamento al posto in cui si
modificano.

La stessa regola MUST valere per **prodotti** e **recensioni**: la scheda «Menu» MUST dichiarare
quanti prodotti sono pubblicati e MUST rimandare alla griglia esistente, e MUST NOT diventare una
seconda griglia dei prodotti. Le tre mutation esistenti di prodotti, media e recensioni MUST restare
invariate.

#### Scenario: Nessun campo di orario in alcuna scheda

- GIVEN ciascuna delle sei schede
- WHEN se ne enumerano i campi modificabili
- THEN nessuno è un orario di apertura, di chiusura, un giorno operativo o un fuso

#### Scenario: Gli orari mostrati sono in sola lettura e dicono dove si cambiano

- GIVEN una scheda che mostra gli orari
- WHEN un amministratore prova a modificarli
- THEN non esiste alcun campo per farlo
- AND la scheda indica che si modificano nelle impostazioni della cassa, con il collegamento

#### Scenario: La scheda del menu conta i prodotti e rimanda

- GIVEN alcuni prodotti pubblicati in vetrina
- WHEN un amministratore apre la scheda «Menu»
- THEN legge quanti prodotti sono pubblicati
- AND trova il collegamento alla griglia dei prodotti vetrina
- AND non trova alcun campo per modificare un prodotto da lì

#### Scenario: Le tre mutation delle risorse restano invariate

- GIVEN lo schema GraphQL del change applicato
- WHEN si confrontano le mutation dei prodotti vetrina, dei media e delle recensioni con quelle
  precedenti
- THEN sono identiche

---

## Dominio: Navigazione del gestionale

### ADDED Requirements

### Requirement: Il riordino del sottomenu è idempotente e non duplica nulla

Il sottomenu «Sito» MUST presentare **prima le pagine** e **poi le risorse trasversali** — libreria
media, prodotti vetrina, recensioni — e la scheda del sito. Le voci nuove MUST essere cercate per
**percorso**, come le esistenti, così che avvii ripetuti non le duplichino.

⚠️ Il riordino riscrive la **posizione di voci già esistenti**: è la prima volta che la procedura di
seed viene usata per **riordinare** invece che per **creare**, e la proprietà MUST essere provata su
un'installazione con dati reali, non dedotta dall'idempotenza della creazione.

Il padre della sezione MUST NOT essere ricreato, e le voci esistenti MUST conservare percorso,
titolo, vista e file.

#### Scenario: Tre avvii consecutivi

- GIVEN un database con la sezione del sito già seedata nella forma precedente
- WHEN il backend viene riavviato tre volte con il seed attivo
- THEN i figli della sezione del sito sono esattamente nove
- AND nessuna voce risulta duplicata
- AND le posizioni sono quelle attese dopo il primo riavvio e non cambiano nei successivi

#### Scenario: Le voci preesistenti conservano la propria identità

- GIVEN le quattro voci preesistenti del sottomenu
- WHEN il seed le riordina
- THEN percorso, titolo, vista e file di ciascuna sono invariati
- AND è cambiata soltanto la posizione

#### Scenario: L'ordine mette le pagine davanti alle risorse

- GIVEN il sottomenu dopo il seed
- WHEN se ne leggono le voci in ordine di posizione
- THEN le cinque pagine precedono le risorse trasversali e la scheda del sito

### Requirement: Nessuna voce senza icona

Ogni nome di icona che il seed assegna a una voce del sottomenu «Sito» MUST esistere nella mappa
delle icone del frontend. Un nome mancante **non produce alcun errore**: la voce compare senza icona,
e il guasto si scopre guardando la barra laterale, cioè mai.

Le due liste MUST essere allineate **nello stesso commit** e la corrispondenza MUST essere verificata
automaticamente.

Le icone delle cinque pagine MUST essere **distinte fra loro** e distinte da quelle già usate nel
ramo Sito: due voci con la stessa icona nella navigazione sono indistinguibili, ed è la stessa regola
già imposta alla terza voce della sezione.

**Verifica per mutazione**: assegnare nel seed il nome di un'icona inesistente MUST far fallire la
verifica.

#### Scenario: Ogni icona nominata dal seed esiste

- GIVEN i nomi di icona assegnati dal seed alle voci del sottomenu «Sito»
- WHEN si confrontano con la mappa delle icone del frontend
- THEN ognuno è presente

#### Scenario: 🔴 Verifica per mutazione dell'allineamento delle icone

- GIVEN la verifica delle icone verde
- WHEN si assegna nel seed il nome di un'icona che la mappa non contiene
- THEN la verifica fallisce nominando la voce e il nome dell'icona

#### Scenario: Le icone delle pagine sono distinte

- GIVEN la barra laterale con il sottomenu «Sito» espanso
- WHEN si confrontano le icone delle nove voci
- THEN sono tutte diverse fra loro
