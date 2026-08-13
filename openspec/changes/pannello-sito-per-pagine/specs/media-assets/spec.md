# Delta per media-assets

**Domain**: media-assets
**Change**: pannello-sito-per-pagine
**Date**: 2026-08-13
**Status**: Draft
**Tipo**: DELTA sulla spec attiva [`openspec/specs/media-assets/specs.md`](../../../../specs/media-assets/specs.md)

## Purpose del delta

La domanda dell'utente — *«quante immagini posso caricare»* — oggi **non ha risposta**, e non ce
l'ha nemmeno per chi legge il codice: esiste **una sola galleria ordinata**, e la **posizione**
decide il ruolo su **quattro** pagine su cinque, con intervalli sovrapposti.

| Pagina | Posizioni consumate |
|---|---|
| `/` | 1ª in evidenza · 2ª-4ª in griglia |
| `/menu` | 1ª-3ª in coda al listino |
| `/locale` | 2ª ritratto (ripiego sulla 1ª) · 3ª-5ª quadrate |
| `/aperitivo` | **l'ultima** |
| `/contatti` | nessuna |

🔴 Due conseguenze che questo delta esiste per rendere visibili:

1. con cinque foto caricate, la **seconda** è contemporaneamente la prima della griglia della home,
   la seconda foto del menu e il ritratto del locale;
2. **caricare una foto qualsiasi sposta l'immagine in evidenza dell'aperitivo**, perché quella pagina
   prende l'ultima. Un'aggiunta innocua a una pagina ne cambia un'altra, senza alcun errore da
   nessuna parte.

Il commento nel sorgente della home dichiara una premessa che oggi **non è vera**: *«l'ordine è
editoriale — lo decide l'amministratore dalla libreria media»*. L'amministratore non può decidere un
ordine di cui non conosce il significato.

⚠️ **Decisione di design aperta (nodo B)**. La proposal lascia tre uscite — cartelle per pagina
(**B1**), slot nominati per i ruoli singoli (**B2**), convenzione posizionale spiegata (**B3**) — e
questo delta **non la scioglie**. I requisiti sono scritti in due gruppi:

- **incondizionati** — valgono in tutte e tre le uscite, e sono la risposta minima alla domanda posta;
- **condizionali** — dichiarati per ramo, e vincolanti solo per il ramo che il design sceglierà.

**Fuori scope**: rendere l'ordine della galleria irrilevante ovunque. Le griglie di più foto restano
pescate dalla galleria anche nella forma raccomandata: sono davvero *«foto del locale»*, e va bene
che compaiano su più pagine.

---

## Dominio: I ruoli delle immagini

### ADDED Requirements

### Requirement: 🔴 La libreria media dichiara i ruoli attivi di ogni immagine della galleria

Accanto a **ogni** immagine della galleria, la libreria media MUST dichiarare **quali ruoli sta
ricoprendo adesso**, nominando la **pagina** e la **posizione editoriale** — non l'indice.

Il requisito vale in **ogni** variante del nodo B, e in nessuna è opzionale: la libreria è il posto
in cui si trascina per riordinare, ed è il posto in cui oggi si cambia l'immagine in evidenza della
home senza saperlo.

Un'immagine MUST poter dichiarare **più ruoli contemporaneamente**: la sovrapposizione è il fatto che
il pannello deve rendere visibile, non un caso da nascondere.

Un'immagine della galleria che **non ricopre alcun ruolo** MUST essere dichiarata come tale, con
parole proprie. Un'assenza di etichetta è indistinguibile da un'etichetta non ancora caricata.

Le immagini **non pubblicate** e quelle **fuori dalla cartella della galleria** MUST NOT risultare
titolari di alcun ruolo: la rotta pubblica non le seleziona, e attribuirgliene uno sarebbe una mappa
che mente in favore di sicurezza.

#### Scenario: I ruoli sono scritti accanto alle immagini

- GIVEN una galleria con almeno cinque immagini pubblicate
- WHEN un amministratore apre la libreria media
- THEN accanto a ciascuna immagine legge i ruoli che sta ricoprendo, con il nome della pagina
- AND nessun ruolo è espresso come un numero di posizione

#### Scenario: Un'immagine con più ruoli li dichiara tutti

- GIVEN un'immagine che alimenta contemporaneamente più pagine
- WHEN un amministratore la osserva nella libreria
- THEN tutti i suoi ruoli sono elencati

#### Scenario: Un'immagine senza ruolo lo dice

- GIVEN una galleria con più immagini di quante ne consumino le pagine
- WHEN un amministratore osserva un'immagine che nessuna pagina usa
- THEN legge esplicitamente che non ricopre alcun ruolo

#### Scenario: Un'immagine non pubblicata non ha ruoli

- GIVEN un'immagine della galleria con lo stato di pubblicazione disattivo
- WHEN un amministratore la osserva nella libreria
- THEN non risulta titolare di alcun ruolo
- AND la libreria indica che è la mancata pubblicazione a escluderla

#### Scenario: Un'immagine fuori dalla galleria non ha ruoli di pagina

- GIVEN un'immagine pubblicata in una cartella diversa da quella della galleria
- WHEN un amministratore la osserva nella libreria
- THEN non risulta titolare di alcun ruolo di pagina

### Requirement: 🔴 I ruoli mostrati dalla libreria e i conteggi mostrati dalle schede vengono dalla stessa dichiarazione

I ruoli che la libreria media mostra e il numero di immagini che ciascuna scheda di pagina dichiara
MUST derivare da **una sola** dichiarazione, e MUST NOT essere due elenchi scritti a mano che si
corrispondono per disciplina.

Due scritture della stessa verità divergono, e questa divergerebbe nel modo peggiore: la scheda
direbbe *«quattro immagini»* e la libreria ne etichetterebbe tre, e nessuno dei due numeri sarebbe
palesemente sbagliato.

**Verifica per mutazione**: cambiare la dichiarazione di un ruolo MUST cambiare **insieme** ciò che
la libreria mostra e ciò che la scheda conta. Se solo uno dei due si muove, esistono due scritture.

#### Scenario: Un ruolo aggiunto compare in entrambi i posti

- GIVEN la dichiarazione dei ruoli e le schede allineate
- WHEN si aggiunge un ruolo alla dichiarazione
- THEN la libreria lo mostra sull'immagine che lo ricopre
- AND la scheda della pagina interessata aggiorna il proprio conteggio

#### Scenario: La somma dei ruoli e i conteggi delle schede coincidono

- GIVEN le cinque schede di pagina e la libreria media
- WHEN si confronta, pagina per pagina, il numero dichiarato dalla scheda con il numero di ruoli che
  la libreria attribuisce a quella pagina
- THEN i due numeri coincidono per ogni pagina

---

## Dominio: Il nodo B — requisiti condizionali alla decisione di design

⚠️ **Ogni requisito di questa sezione è condizionale.** Il design ne rende vincolante uno solo, e i
requisiti degli altri rami decadono con la decisione. Sono scritti adesso perché il costo di ciascun
ramo sia una cosa **verificabile** al momento di scegliere, e non una promessa.

### ADDED Requirements

### Requirement: ⚠️ SE la galleria resta posizionale (B3), la trappola MUST essere dichiarata dove si scatena

Se il design sceglie di **non cambiare i dati** e di limitarsi a spiegare la convenzione:

- ogni scheda di pagina MUST dichiarare **quali posizioni della galleria** la pagina consuma e con
  quale ruolo, in parole e non in indici;
- la libreria media MUST dichiarare, **prima** che un riordino o un caricamento avvenga, **quali
  pagine ne saranno cambiate**;
- 🔴 il caso dell'aperitivo MUST essere nominato per nome: la pagina prende **l'ultima** immagine,
  quindi **ogni** caricamento in galleria ne cambia l'immagine in evidenza. È l'unico effetto che si
  propaga da un'azione senza relazione apparente con la pagina colpita;
- il change MUST NOT dichiarare risolta la sovrapposizione: B3 risponde alla domanda posta e
  **lascia intatta** la trappola, e la scheda MUST dirlo invece di lasciarlo intuire.

#### Scenario: ⚠️ La scheda dichiara le posizioni consumate

- GIVEN la scheda di una pagina che pesca dalla galleria
- WHEN un amministratore ne legge la sezione delle immagini
- THEN legge quali posizioni della galleria la pagina consuma e con quale ruolo
- AND legge che le stesse immagini possono servire altre pagine

#### Scenario: 🔴 Il caricamento avvisa di cosa cambia altrove

- GIVEN una galleria con immagini già in uso
- WHEN un amministratore carica una nuova immagine in galleria
- THEN la libreria dichiara quali pagine cambiano per effetto del caricamento
- AND nomina esplicitamente l'immagine in evidenza dell'aperitivo

#### Scenario: ⚠️ Il riordino avvisa prima di essere confermato

- GIVEN un amministratore che trascina un'immagine in una posizione diversa
- WHEN il riordino sta per essere applicato
- THEN la libreria dichiara quali ruoli cambiano di titolare
- AND l'amministratore può annullare prima che accada

### Requirement: ⚠️ SE i ruoli diventano espliciti (B2), nessuna pagina MUST restare senza immagine dopo l'aggiornamento

Se il design sceglie gli **slot nominati** per le immagini a ruolo singolo, lasciando la galleria alle
griglie:

- 🔴 ogni slot vuoto MUST avere un **ripiego dichiarato** che riproduce **esattamente** l'immagine
  che la pagina mostra oggi. Al primo deploy nessuno ha ancora valorizzato gli slot: senza ripiego,
  un aggiornamento toglierebbe l'immagine in evidenza a tre pagine contemporaneamente;
- la scheda MUST dichiarare **se sta mostrando lo slot o il ripiego**, e MUST NOT presentare i due
  stati allo stesso modo: sono due promesse diverse, e la seconda scade appena la galleria cambia;
- la migrazione MUST essere **additiva** — colonne nullable e chiavi esterne — e MUST NOT aggiungere,
  rimuovere o modificare alcuna colonna della tabella dei media. La relazione verso i media MUST
  essere dichiarata **senza navigazione inversa**, come già fatto per l'immagine di anteprima social;
- ⚠️ gli slot MUST essere considerati **scelta editoriale**: una volta valorizzati, l'ordine della
  galleria non li riproduce più, ed è il solo punto di non ritorno del piano di rollback.

#### Scenario: 🔴 Primo avvio dopo la migrazione, slot tutti vuoti

- GIVEN un'installazione con dati reali e gli slot appena creati e vuoti
- WHEN si aprono le cinque pagine del sito
- THEN ciascuna mostra esattamente le immagini che mostrava prima del change
- AND nessuna pagina resta senza immagine

#### Scenario: ⚠️ La scheda distingue slot e ripiego

- GIVEN uno slot vuoto e la pagina servita dal ripiego
- WHEN un amministratore apre la scheda di quella pagina
- THEN legge che l'immagine mostrata viene dal ripiego e non da una scelta
- AND legge che cambierà se l'ordine della galleria cambia

#### Scenario: La migrazione non tocca la tabella dei media

- GIVEN la migrazione del change
- WHEN se ne genera lo script SQL
- THEN contiene soltanto aggiunte di colonne nullable e i loro vincoli
- AND non contiene alcuna modifica alle colonne della tabella dei media

#### Scenario: Nessuna colonna ombra sull'entità dei media

- GIVEN lo schema del database dopo la migrazione
- WHEN si ispezionano le colonne della tabella dei media
- THEN sono esattamente quelle precedenti al change

#### Scenario: Uno slot valorizzato vince sul ripiego

- GIVEN uno slot valorizzato con un'immagine pubblicata
- WHEN si apre la pagina corrispondente
- THEN mostra l'immagine dello slot
- AND riordinare la galleria non la cambia

### Requirement: ⚠️ SE si adottano cartelle per pagina (B1), il contratto pubblico MUST essere cambiato esplicitamente

Se il design sceglie **una cartella per pagina**:

- il change MUST portare un delta esplicito sulle spec del contratto pubblico e del suo consumo: il
  valore canonico della cartella della galleria è **pinnato** dalla spec attiva, e la rotta pubblica
  che lo filtra fa parte del contratto;
- ⚠️ il costo MUST essere dichiarato dove la scelta viene fatta: la stessa fotografia usata su due
  pagine andrebbe **caricata due volte**, e da quel momento sono due media distinti che invecchiano
  separatamente;
- il change MUST NOT modificare il valore canonico o il filtro della rotta pubblica **senza** quel
  delta: un cambio silenzioso lascerebbe la galleria del sito vuota senza alcun errore da nessuna
  parte.

#### Scenario: ⚠️ Il valore canonico non cambia senza un delta di contratto

- GIVEN il change applicato
- WHEN si confronta il valore canonico della cartella della galleria e il filtro della rotta pubblica
  con quelli pinnati dalla spec attiva
- THEN o sono invariati, o esiste un delta esplicito sulle spec del contratto pubblico che li
  ridefinisce

### Requirement: In ogni variante, la risposta alla domanda esiste e la galleria resta una scelta editoriale

Qualunque ramo il design scelga, MUST valere:

- ogni immagine che una pagina rende MUST avere un **ruolo dicibile**, e ogni ruolo MUST essere
  nominato da **almeno una** scheda di pagina;
- l'amministratore MUST poter rispondere alla domanda *«quante immagini ospita questa pagina»*
  **senza leggere il codice del sito**;
- il riordino della galleria MUST restare una **scelta editoriale che ha effetti dichiarati**, non una
  scelta di cui non si conosce il significato;
- la selezione di un'immagine, ovunque avvenga, MUST usare il selettore di media **già esistente**.

#### Scenario: Ogni ruolo è nominato da una scheda

- GIVEN l'insieme dei ruoli che le pagine del sito consumano
- WHEN si confronta con l'insieme dei ruoli nominati dalle cinque schede
- THEN i due insiemi coincidono

#### Scenario: La domanda ha risposta senza leggere il codice

- GIVEN un amministratore che non ha accesso ai sorgenti
- WHEN apre la scheda di una pagina qualunque
- THEN sa quante immagini quella pagina ospita, quali sono e cosa succede a lasciarne un posto vuoto

#### Scenario: Nessun secondo percorso di scelta delle immagini

- GIVEN ogni punto del pannello in cui si sceglie un'immagine
- WHEN se ne osserva il percorso
- THEN è sempre il selettore di media già esistente
