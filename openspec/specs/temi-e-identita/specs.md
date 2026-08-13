# Temi e Identità Specification

**Domain**: temi-e-identita
**Status**: Active
**Ultimo aggiornamento**: 2026-08-13

Change incorporate in questa spec:

| Change | Archiviata il | Contenuto |
|--------|---------------|-----------|
| vetrina-sito-astro | 2026-08-13 | Spec iniziale del dominio: HTML identico nei due temi byte per byte, tema e "aperto ora" client-side, nessun FOUC, selettore a tre stati, l'arancio non può portare testo di giorno, tre caratteri serviti dal sito, insegna stirata ×1.55 da un token solo, il logo entra nel DOM come markup |

È il **primo consumatore** degli asset di marca in `docs/brand/`, limitatamente al sottoinsieme
che il loro README destina al sito.

## Purpose

Definire il **design system dei due registri del locale** e le regole che lo rendono a prova di
lettore futuro: come si sceglie il tema, dove si sceglie, quali colori possono portare testo, quali
caratteri esistono e in quali pesi, e in quale forma il marchio entra nella pagina.

I due temi **non sono un light/dark generico**: sono i due registri visivi che il locale già usa,
con i valori **campionati dalle locandine vere**. Il tema scuro si chiama **`sera`**, mai `notte`.

| | Giorno (crema + oliva) | Sera (lavagna) |
|---|---|---|
| Sfondo | crema `#F2EDE7` | lavagna `#251C19` — carboncino **caldo**, non nero neutro |
| Inchiostro | nero quasi puro `#020302` | gesso crema `#F2EDE7` — **la crema fa doppio lavoro** |
| Accento | verde oliva `#41511E` | gesso giallo `#FDDB5B` |
| Accento 2 | arancio `#FD8502` | arancio `#FD8502` — 🔴 l'unico comune, e il solo che non può portare testo di giorno |

Tre classi di errore di questo dominio sono **invisibili sulla macchina di chi sviluppa**, ed è la
ragione per cui ogni requisito qui dentro dichiara **come si prova**:

| Errore | Dove si vede in sviluppo | Dove si vede davvero |
|---|---|---|
| Tema calcolato server-side | **Mai**: un visitatore alla volta | Micro-cache di Fase 6, metà dei visitatori |
| Token del tema senza inlining | **Mai**: alla radice le due forme sono identiche | Il primo sottoalbero con un tema proprio |
| Arancio usato per il testo di giorno | **Mai**: si legge benissimo, è solo 2.11 | L'audit di accessibilità, o mai |

**Fuori scope in questa spec**: il markup delle immagini (spec
[`immagini-vetrina`](../immagini-vetrina/specs.md)); i due prefissi (spec
[`consumo-api-pubblica`](../consumo-api-pubblica/specs.md)); il comportamento HTTP delle pagine
(spec [`sito-pubblico`](../sito-pubblico/specs.md)).

**Fuori scope in questa fase**: audit AA completo e regressione visiva automatizzata (Fase 7); le
altre pagine del sito; il lightbox della galleria e ogni altra isola interattiva.

**Stato verificato prima della change**: `docs/brand/` è completo e **vettoriale dall'origine**;
`logo-2dgusto.svg` contiene due riferimenti a `currentColor` e un arancio sotto una variabile
dedicata, `monogramma-2d.svg` uno e uno — sono già scritti per essere inseriti inline;
`duedgusto/src/assets/fonts/` contiene quattro `.ttf` e **nessun** `.woff2`, e **né Allura né
Playfair Display esistono nel repository**.

---

## Dominio: Il tema è client-side, sempre

### Requirement: 🔴 L'HTML servito è identico nei due temi, byte per byte

Il server MUST emettere **una sola pagina, priva di tema**. Il tag radice dell'HTML servito MUST NOT
portare l'attributo del tema.

La ragione è aritmetica, non stilistica: la rotta del sito è cacheabile 300 secondi e la Fase 6
metterà un micro-cache davanti alle pagine. Un tema calcolato server-side ha due sole uscite,
entrambe guaste: o entra nella chiave di cache e la **frammenta** (due copie di ogni pagina, e il
beneficio del micro-cache si dimezza), o non ci entra e **metà dei visitatori riceve il tema
sbagliato** — quello di chi ha riempito la cache.

Il server MUST NOT decidere il tema da: un cookie, un header di preferenza del client, un parametro
di query, l'indirizzo del chiamante o l'ora corrente.

L'identità MUST essere verificata con **quattro** asserzioni, non una:

| # | Prova | Cosa esclude |
|---|---|---|
| 1 | due richieste alla stessa URL a distanza di un minuto → corpi identici | ogni stringa che dipende dall'**orologio** |
| 2 | richiesta con cookie di tema `sera` contro `giorno` → corpi identici | il tema letto da un cookie |
| 3 | richiesta con header di preferenza scuro contro chiaro → corpi identici | il tema negoziato dagli header |
| 4 | 🔴 l'attributo del tema compare **una volta sola** nell'HTML, e quell'unica occorrenza è **dentro lo script** | il tema deciso dal server |

🔴 La quarta è quella decisiva: **le prime tre passano anche se il server scrive sempre lo stesso
tema**. Senza di essa il criterio si chiuderebbe per somiglianza.

⚠️ Le asserzioni MUST essere ricerche di sottostringa (spec `sito-pubblico`): la compressione
dell'HTML è deterministica — quindi l'identità byte per byte regge — ma il markup non ha
l'indentazione su cui si sarebbe tentati di asserire.

#### Scenario: 🔴 Il tag radice non porta l'attributo del tema

- GIVEN una pagina servita dal bundle di produzione
- WHEN si ispeziona il tag radice dell'HTML ricevuto
- THEN non porta l'attributo del tema
- AND l'attributo compare una volta sola nell'intero documento
- AND quell'unica occorrenza è all'interno dello script inline

#### Scenario: Due richieste a un minuto di distanza

- GIVEN una pagina servita dal bundle di produzione con il backend in ascolto
- WHEN si richiede la stessa URL due volte a distanza di un minuto
- THEN i due corpi sono identici byte per byte

#### Scenario: Il cookie non cambia la risposta

- GIVEN due richieste alla stessa URL, una con cookie di tema `sera` e una con `giorno`
- WHEN si confrontano i corpi
- THEN sono identici

#### Scenario: L'header di preferenza non cambia la risposta

- GIVEN due richieste alla stessa URL, una che dichiara preferenza per lo schema scuro e una per
  quello chiaro
- WHEN si confrontano i corpi
- THEN sono identici

#### Scenario: 🔴 Controprova — le prime tre prove non bastano

- GIVEN un server che scrivesse **sempre** il tema giorno sul tag radice
- WHEN si eseguono le prime tre prove
- THEN passerebbero tutte e tre
- AND solo la quarta rileverebbe il guasto

### Requirement: 🔴 Lo stato "aperto ora" è client-side, per la stessa ragione del tema

Gli **orari** (apertura, chiusura, giorni) sono **dato** e MUST essere renderizzati server-side.

Lo **stato** di apertura ("aperto ora" / "chiuso") è **orologio** e MUST essere calcolato
client-side, nello stesso script del tema.

Renderizzarlo server-side produrrebbe un HTML che **cambia da solo nel tempo**, quindi (a)
resterebbe stantio fino a sessanta secondi nel micro-cache, potendo dire "aperto" dopo la chiusura,
e (b) **farebbe fallire la prova di identità byte per byte** appena due richieste cadessero a
cavallo di un minuto. È letteralmente la stessa decisione del tema, e va presa allo stesso modo.

L'elemento che porta lo stato MUST essere reso **nascosto** dal server e svelato dallo script,
così da non produrre salto di layout.

Senza JavaScript il visitatore MUST vedere **gli orari veri** e nessun badge: è una degradazione
onesta — l'informazione c'è, manca la comodità.

#### Scenario: 🔴 Lo stato di apertura non compare nell'HTML servito

- GIVEN una pagina servita dal bundle di produzione
- WHEN si cercano nel corpo le parole che dichiarano lo stato di apertura
- THEN non compaiono come contenuto già deciso
- AND l'elemento che le ospiterà è servito nascosto

#### Scenario: Gli orari invece ci sono

- GIVEN la rotta del sito che risponde con apertura e chiusura
- WHEN si ispeziona l'HTML servito
- THEN gli orari compaiono come testo

#### Scenario: Il badge compare nel browser

- GIVEN un browser con JavaScript attivo
- WHEN si apre `/` in un orario di apertura
- THEN il badge di stato diventa visibile
- AND nessun salto di layout accompagna la sua comparsa

#### Scenario: Senza JavaScript restano gli orari

- GIVEN un browser con JavaScript disattivato
- WHEN si apre `/`
- THEN gli orari sono leggibili
- AND nessun badge di stato è visibile

### Requirement: 🔴 Il confine del registro serale ha due estremi, ed entrambi vengono dall'API

Lo script MUST ricevere l'ora di inizio del registro serale e gli orari come **parametri** letti
dall'API, e MUST NOT ricevere una decisione già presa server-side.

Il registro serale MUST valere quando l'ora di Roma è **maggiore o uguale** all'ora di inizio del
registro serale **oppure** **minore** dell'orario di apertura del locale:

```
sera  ⟺  ora >= oraInizioTemaSera  ∨  ora < orari.apertura
```

🔴 Il solo primo confronto darebbe il tema **giorno alle due di notte**. L'estremo di uscita MUST
NOT essere una costante inventata: è l'orario di **apertura**, che l'API già espone. Nessun numero
nuovo, nessun secondo posto in cui un orario possa divergere dal database.

L'ora MUST essere quella del fuso **`Europe/Rome`**, non quella del sistema del visitatore.

⚠️ Il formato dell'ora MUST usare il ciclo orario a 24 ore che produce `00` a mezzanotte, e MUST NOT
usare la forma che in alcune versioni della libreria di internazionalizzazione restituisce `24:00`:
`"24:00" >= "18:00"` darebbe il registro serale all'ora sbagliata per sessanta minuti l'anno.

#### Scenario: 🔴 Le due di notte sono registro serale

- GIVEN ora di inizio del registro serale `18:00` e apertura `07:00`
- WHEN l'ora di Roma è `01:00`
- THEN il registro applicato è quello serale

#### Scenario: Il registro serale finisce quando il locale apre

- GIVEN ora di inizio del registro serale `18:00` e apertura `07:00`
- WHEN l'ora di Roma è `07:00`
- THEN il registro applicato è quello del giorno

#### Scenario: Dopo l'ora di inizio è sera

- GIVEN ora di inizio del registro serale `18:00`
- WHEN l'ora di Roma è `18:00`
- THEN il registro applicato è quello serale

#### Scenario: Mezzanotte non produce un'ora fuori scala

- GIVEN l'ora di Roma esattamente a mezzanotte
- WHEN si formatta l'ora per il confronto
- THEN il valore è `00:00`
- AND non è `24:00`

#### Scenario: Il fuso del visitatore non cambia il tema

- GIVEN un visitatore il cui sistema è impostato su un fuso orario lontano
- WHEN apre il sito in stato automatico
- THEN il tema applicato è quello che corrisponde all'ora di Roma
- AND non cambia cambiando il fuso di sistema

#### Scenario: I parametri arrivano dall'API, non dal template

- GIVEN i sorgenti di `sito/`
- WHEN si cercano l'ora di inizio del registro serale e gli orari come costanti scritte a mano
- THEN non esistono, salvo il valore di ripiego dichiarato per il backend irraggiungibile

### Requirement: 🔴 Nessun FOUC, provato in condizioni sfavorevoli

Lo script che decide il tema MUST essere **inline** — dichiarato tale in modo esplicito — e MUST
essere il primo elemento del `<head>` dopo la dichiarazione della codifica, **prima** di qualunque
foglio di stile: così gira senza nemmeno aspettare che la richiesta del CSS parta.

⚠️ Il passaggio di variabili allo script implica già l'inline, ma la dichiarazione esplicita MUST
comunque esserci: chi in futuro rimuovesse il passaggio di variabili non deve riportare il FOUC come
effetto collaterale.

Il tag radice MUST portare il colore di sfondo del token, così che il **primissimo pixel dipinto**
sia già del tema giusto.

Le transizioni MUST essere disattivate fino al primo frame, tramite un attributo di "pronto"
aggiunto dallo script. Quell'attributo MUST NOT comparire nell'HTML **servito**, altrimenti
l'identità byte per byte non reggerebbe.

La verifica MUST essere per **hard reload ripetuti** — almeno dieci, con cache disabilitata e
throttling di rete, su **entrambi** i temi e partendo da ognuno dei tre stati del selettore — e MUST
NOT chiudersi con "a me non si vede": cache calda e rete locale lo nascondono. **Un solo lampo
bianco all'apertura in tema sera fa fallire il criterio.**

#### Scenario: Lo script è inline e viene prima del CSS

- GIVEN l'HTML servito di una qualsiasi pagina
- WHEN si ispeziona l'ordine degli elementi del `<head>`
- THEN lo script del tema precede ogni foglio di stile
- AND è dichiarato esplicitamente come inline

#### Scenario: L'attributo di pronto non è nell'HTML servito

- GIVEN l'HTML servito di una qualsiasi pagina
- WHEN si cerca l'attributo che disattiva le transizioni iniziali
- THEN non compare nel markup
- AND compare nel DOM dopo il primo frame

#### Scenario: 🔴 Dieci hard reload in tema sera

- GIVEN il tema sera selezionato, cache disabilitata e throttling di rete attivo
- WHEN si esegue un hard reload dieci volte
- THEN in nessuna delle dieci compare un lampo di sfondo chiaro

#### Scenario: Nessun lampo dai tre stati del selettore

- GIVEN ognuno dei tre stati del selettore come punto di partenza
- WHEN si ricarica la pagina in entrambi i temi
- THEN il primo paint è già nel tema corretto

### Requirement: Il selettore del tema ha tre stati, è vanilla e sopravvive al reload

Il selettore MUST offrire tre stati in ciclo: giorno → sera → automatico. La preferenza esplicita
MUST vincere sull'ora; lo stato automatico MUST tornare alla decisione oraria.

La preferenza MUST essere persistita nel browser e MUST sopravvivere al ricaricamento.

Il selettore MUST essere realizzato in JavaScript semplice e MUST NOT essere un'isola di un
framework UI: otto righe non meritano il runtime di una libreria su ogni pagina, con un budget
dichiarato inferiore a 60 kB di JavaScript.

Il bottone MUST essere reso dal server con un'etichetta **neutra**, e la sua etichetta corrente MUST
essere scritta dallo script: un'etichetta renderizzata server-side rivelerebbe lo stato, e lo stato
è client-side.

#### Scenario: Giro completo dei tre stati con reload

- GIVEN il selettore in stato automatico
- WHEN si passa a giorno, si ricarica, si passa a sera, si ricarica, si passa ad automatico e si
  ricarica
- THEN dopo ogni ricaricamento il tema è quello dello stato selezionato
- AND nello stato automatico il tema torna a seguire l'ora

#### Scenario: L'etichetta servita è neutra

- GIVEN l'HTML servito
- WHEN si ispeziona l'etichetta del selettore
- THEN non nomina alcuno dei tre stati come corrente

#### Scenario: Nessun runtime di framework UI

- GIVEN il bundle client servito da una pagina
- WHEN se ne enumerano gli script
- THEN non contiene il runtime di alcuna libreria di interfaccia
- AND il peso complessivo del JavaScript resta sotto il budget dichiarato

---

## Dominio: I token e le utility

### Requirement: 🔴 I token che cambiano a runtime sono inlineati nelle utility

I colori dei due registri sono custom properties **di runtime**, riassegnate da un attributo
sull'elemento radice o su un sottoalbero. I token che generano utility di colore MUST essere
dichiarati nella forma che **inlinea il valore nell'utility**, e MUST NOT essere dichiarati nella
forma che fa passare la risoluzione da una variabile dichiarata sulla radice.

I token che **non cambiano mai** (famiglie di caratteri, breakpoint) MAY usare la forma semplice.

🔴 La ragione per cui la scelta sbagliata non si vedrebbe: il tema di pagina vive sull'elemento
radice, che **è** la radice — con entrambe le forme il risultato lì è identico. La differenza compare
**solo** quando un token viene ridefinito in un **sottoalbero**.

E non è un caso teorico: la home MUST contenere una **fascia in registro serale fisso**, qualunque
sia il tema della pagina, perché *è* la lavagna del locale — i due registri sono due momenti della
giornata, non due preferenze. Quella fascia porta l'attributo del tema su una sezione. Con la forma
semplice, ogni utility di colore al suo interno resterebbe crema-e-oliva: **una fascia scura con
dentro i colori del giorno, e nessun errore da nessuna parte**.

⚠️ Conseguenza da conoscere prima di scrivere CSS a mano: il nome del token del tema non è più il
canale attraverso cui passa il valore. Il CSS scritto a mano MUST usare il **nome di runtime**, mai
il nome generato dal tema.

La variante che lega uno stile al registro serale MUST essere dichiarata come variante
personalizzata su **attributo** (coerente con il valore `sera`), e MUST NOT essere una classe
generica di dark mode. La specificità della variante MUST restare a zero.

**La prova non richiede un browser**: la differenza è già nel CSS **generato**. Il test MUST
asserire **positivamente** che l'utility di sfondo contiene il riferimento al token di runtime, e
**negativamente** che non contiene il riferimento al token generato dal tema.

#### Scenario: 🔴 Le utility di colore inlinano il token di runtime

- GIVEN il CSS generato dalla build
- WHEN si ispeziona la regola dell'utility di sfondo
- THEN contiene il riferimento al token di runtime
- AND non contiene il riferimento al token generato dal tema

#### Scenario: 🔴 La fascia in registro serale dentro una pagina in tema giorno

- GIVEN la home visualizzata in tema giorno
- WHEN si osserva la fascia che porta l'attributo del registro serale
- THEN il suo sfondo e il suo inchiostro sono quelli del registro serale
- AND non sono quelli del tema della pagina

#### Scenario: Il caso resta riproducibile anche se la fascia cambiasse

- GIVEN una decisione editoriale che rimuovesse la fascia dalla home
- WHEN si verifica il progetto
- THEN esiste comunque un sottoalbero con tema proprio su cui la differenza è osservabile
- AND senza di esso la scelta fra le due forme tornerebbe indistinguibile

#### Scenario: Il CSS scritto a mano usa il nome di runtime

- GIVEN i fogli di stile del progetto
- WHEN si cercano i riferimenti ai token di colore nel CSS scritto a mano
- THEN usano il nome di runtime
- AND nessuno usa il nome generato dal tema

#### Scenario: La variante del registro serale è legata a un attributo

- GIVEN la dichiarazione della variante
- WHEN se ne legge la definizione
- THEN è legata all'attributo del tema con valore `sera`
- AND non introduce specificità aggiuntiva

### Requirement: 🔴 L'arancio non può portare testo di giorno: la classe non esiste

**Contrasto misurato, non stimato:**

| Token | su sfondo giorno (crema) | su sfondo sera (lavagna) | |
|---|---|---|---|
| inchiostro / gesso | 17.75 | 14.33 | ✅ |
| inchiostro tenue | 6.79 | 8.97 | ✅ |
| accento (oliva / gesso giallo) | 7.45 | 12.28 | ✅ |
| **arancio `#FD8502`** | 🔴 **2.11** | 6.78 | ❌ / ✅ |

**2.11 è sotto persino la soglia 3:1 del testo grande.** Ed è l'unico colore comune ai due registri,
quindi è anche quello che verrà riusato **per analogia**.

Il vincolo MUST diventare **la forma del foglio di stile**, non un commento: un commento non
impedisce niente.

- Il token dell'arancio MUST vivere **fuori** dalla namespace del tema, fra le variabili che non
  generano utility.
- Le **sole** utility dell'arancio che MUST esistere sono quelle di **riempimento, bordo e
  campitura**. `text-arancio` MUST NOT esistere come classe: scriverla non produce CSS, e il testo
  resta del colore ereditato — cioè **leggibile**. Il default del guasto è sicuro.
- Il commento accanto al token MUST riportare i due valori misurati, dichiarare che di giorno
  l'arancio è riempimento/bordo/superficie con testo **nero** sopra, e **indirizzare** a quale token
  cerca davvero chi cerca "l'arancio per un titolo" — cioè l'accento, che porta testo in entrambi i
  registri.

Tre strati, perché coprono guasti diversi:

1. **l'utility non esiste** → protegge dall'errore per analogia, che è il caso comune;
2. **un test che legge i sorgenti** → protegge dai valori arbitrari, che l'utility mancante non
   ferma (una classe con valore arbitrario, il colore scritto a mano, il valore esadecimale);
3. **la misura sul rendering** → protegge da ciò che nessuna ricerca testuale vede.

Le chiamate all'azione MUST cambiare forma fra i registri, e non è un vezzo: è l'unica combinazione
che passa in entrambi. Giorno: **oliva pieno con testo crema** (7.45). Sera: **arancio o giallo
pieno con testo lavagna**. Una sola classe, i cui token cambiano con il tema.

**Costo accettato consapevolmente**: nella fascia in registro serale l'arancio *potrebbe*
legittimamente portare testo (6.78). Il divieto è **globale** e lì proibisce un uso valido. Si
accetta: una regola sola senza eccezioni vale più di 0.28 punti di contrasto in un contesto — e
un'eccezione documentata è il modo in cui una regola smette di essere applicata.

**Verifica per mutazione**: spostare il token dell'arancio dentro la namespace del tema MUST far
comparire la classe di testo nel CSS generato, e MUST far fallire lo scenario che ne pinna
l'assenza. Un requisito che si limitasse a documentare il divieto non produrrebbe alcuna
differenza osservabile.

#### Scenario: 🔴 La classe di testo arancione non esiste nel CSS generato

- GIVEN il CSS generato dalla build
- WHEN si cerca la regola della classe di testo arancione
- THEN non esiste

#### Scenario: 🔴 Scriverla non produce alcun effetto

- GIVEN un elemento a cui è applicata la classe di testo arancione
- WHEN si osserva il colore del testo renderizzato
- THEN è il colore ereditato dal contesto
- AND è leggibile sul suo sfondo in entrambi i registri

#### Scenario: Le tre utility ammesse esistono

- GIVEN il CSS generato dalla build
- WHEN si cercano le utility dell'arancio
- THEN esistono quelle di riempimento, bordo e campitura
- AND non ne esiste alcuna che imposti il colore del testo

#### Scenario: 🔴 Nessun testo arancione per valore arbitrario

- GIVEN i sorgenti di `sito/`
- WHEN si cercano le forme che assegnano al testo il colore arancione — classe con valore
  arbitrario, riferimento al token, valore esadecimale
- THEN non esiste alcuna occorrenza

#### Scenario: Il commento indirizza al token giusto

- GIVEN il commento accanto al token dell'arancio
- WHEN se ne legge il testo
- THEN riporta i due valori di contrasto misurati
- AND dichiara che di giorno l'arancio è solo riempimento, bordo o superficie
- AND nomina il token dell'accento come quello che porta testo

#### Scenario: Contrasto misurato sul rendering

- GIVEN `/` e `/menu` aperte nei due temi
- WHEN si esegue lo strumento di accessibilità del browser
- THEN nessuna coppia testo/sfondo scende sotto 4.5:1, o 3:1 per il testo grande
- AND nessun testo arancione compare nel tema giorno

#### Scenario: Le chiamate all'azione passano in entrambi i registri

- GIVEN una chiamata all'azione nella stessa posizione nei due temi
- WHEN se ne misura il contrasto
- THEN nel tema giorno è oliva pieno con testo crema
- AND nel tema sera è arancio o giallo pieno con testo lavagna
- AND entrambe superano la soglia

---

## Dominio: La tipografia

### Requirement: I tre caratteri sono serviti dal sito, mai da un CDN

Il sito MUST servire **tre** file di carattere in formato `woff2`, subset **latino**, dalla propria
origine: il carattere da insegna (Anton, un solo peso), quello calligrafico (Allura) e quello
dell'insegna a tre parole (Playfair Display nel peso più pesante).

Il sito MUST NOT effettuare alcuna richiesta verso i domini dei font esterni, e i loro nomi MUST NOT
comparire nell'HTML né nel CSS generati.

I file MUST essere **scaricati già ottimizzati** dalla fonderia e committati, e MUST NOT essere
prodotti convertendo i `.ttf` presenti nel repository: la pipeline della fonderia produce file
misurabilmente più piccoli, e la conversione richiederebbe una toolchain che nessun altro pezzo del
repository usa.

Accanto ai file MUST esistere:

- il testo della **licenza**, che la licenza stessa richiede accompagni i file;
- un documento di **provenienza** con famiglia, versione, URL esatta di origine, impronta
  crittografica e data;
- uno script, **senza dipendenze**, che rifà l'operazione e **verifica le impronte** contro quelle
  registrate. Lo script MUST NOT girare durante la build.

Ogni dichiarazione di carattere MUST riportare l'intervallo Unicode **verbatim** da quello della
fonderia: senza, il browser scarica il font anche per testo privo di glifi in quel range.

Il carico dei caratteri MUST usare la strategia che mostra subito un ripiego e sostituisce al
caricamento, e MUST NOT usare quella che blocca il testo: il titolo **è** il contenuto.

Il carattere del **corpo** MUST essere uno stack di sistema, a costo zero byte. Il piano prescriveva
un carattere "già dipendenza": era vero per l'app di cassa e **falso per `sito/`**, che è un
progetto indipendente — quel carattere resta comunque dentro lo stack, e sui sistemi che lo hanno il
visitatore lo ottiene gratis.

⚠️ Nomenclatura: la namespace dei caratteri è quella breve; la forma lunga appartiene a una alpha e
**non genera nulla**. Inoltre il ruolo da insegna MUST NOT essere chiamato `display`: sarebbe una
classe utility omonima del descrittore di caricamento dei font, e chi cercasse l'uno troverebbe
l'altro.

#### Scenario: Zero richieste verso i domini dei font esterni

- GIVEN `/` e `/menu` aperte in un browser con la scheda di rete attiva
- WHEN si osservano le richieste
- THEN nessuna è diretta ai domini dei font esterni
- AND i file dei caratteri sono caricati da un percorso locale

#### Scenario: I domini esterni non compaiono nei file generati

- GIVEN i file prodotti dalla build
- WHEN si cercano i nomi dei domini dei font esterni
- THEN non esiste alcuna occorrenza

#### Scenario: I tre file esistono con licenza e provenienza

- GIVEN la cartella dei caratteri di `sito/`
- WHEN se ne enumerano i file
- THEN contiene tre file `woff2`
- AND contiene il testo della licenza
- AND contiene il documento di provenienza con versione, URL e impronta di ciascun file

#### Scenario: Lo script di scarico verifica le impronte

- GIVEN i tre file committati
- WHEN si esegue lo script di scarico
- THEN riscarica i file e ne confronta le impronte con quelle registrate
- AND segnala qualunque differenza

#### Scenario: Lo script non gira durante la build

- GIVEN gli script del progetto
- WHEN si esegue la build
- THEN nessuna richiesta di rete verso la fonderia viene effettuata

#### Scenario: L'intervallo Unicode copre ciò che il sito scrive

- GIVEN le dichiarazioni dei caratteri
- WHEN si verificano gli intervalli dichiarati
- THEN coprono le lettere accentate italiane, il simbolo dell'euro, l'apostrofo tipografico, i
  trattini lunghi e il simbolo di grado

#### Scenario: Il corpo non scarica alcun file

- GIVEN la dichiarazione del carattere del corpo
- WHEN se ne legge il valore
- THEN è uno stack di caratteri di sistema
- AND nessun file viene scaricato per il testo di corpo

### Requirement: Il preload è solo su Anton, con `crossorigin` e con l'URL prodotta dalla build

Il layout di base MUST dichiarare il **preload** del solo carattere da insegna, che è il display
sopra la piega di entrambe le pagine. Gli altri due MUST NOT essere preloadati: sono decorativi e
non bloccano la lettura.

⚠️ L'attributo `crossorigin` MUST essere presente **anche se il file è servito dalla stessa
origine**: i font si recuperano in modalità CORS e senza l'attributo il preload non viene riusato —
il font si scarica **due volte**.

🔴 L'URL del preload MUST essere quella **prodotta dalla build** (importata come risorsa), e MUST
NOT essere un percorso scritto a mano: il bundler riscrive l'URL nel CSS con un'impronta di
contenuto, e un percorso scritto a mano punterebbe a un file **diverso** da quello che il CSS
chiede. Il browser ne scaricherebbe due, e il preload comparirebbe negli strumenti come "inutile"
invece che come sbagliato.

L'elemento MUST essere scritto in forma auto-chiusa (spec `sito-pubblico`).

#### Scenario: Un solo preload di carattere

- GIVEN l'HTML servito
- WHEN si enumerano gli elementi di preload di tipo font
- THEN ne esiste esattamente uno
- AND riguarda il carattere da insegna

#### Scenario: 🔴 L'attributo crossorigin è presente

- GIVEN l'elemento di preload del carattere
- WHEN se ne ispezionano gli attributi
- THEN porta l'attributo `crossorigin`

#### Scenario: 🔴 L'URL del preload è la stessa che il CSS richiede

- GIVEN il bundle di produzione
- WHEN si confrontano l'URL del preload e l'URL richiesta dal foglio di stile
- THEN sono identiche
- AND il browser scarica il file una volta sola

### Requirement: La scala tipografica dichiara i ruoli, e la sintesi dei caratteri è disattivata

I tre caratteri hanno **un solo peso ciascuno** e nessun corsivo.

🔴 Il guasto non è "manca un peso": è che il browser **ne inventa uno**. Un peso maggiore su un
carattere che non lo possiede produce un **falso grassetto sintetizzato**, che (a) ispessisce i
tratti in modo non uniforme rovinando proprio ciò che rende quel carattere adatto a un'insegna, e
(b) è **diverso fra i motori di rendering**. È un guasto che non appare in alcun log e che chi
sviluppa su un solo browser non vede mai.

Il foglio di stile MUST disattivare la sintesi dei caratteri sull'elemento radice, e la
disattivazione MUST essere pinnata da un test sul CSS **generato**. Con quella riga un peso
maggiore **non fa nulla** — e "non fa nulla" è visibile subito, mentre un grassetto sintetizzato
sembra funzionare.

La scala MUST dichiarare i ruoli **adesso**, non a metà lavoro:

| Ruolo | Famiglia | Dove | Regola |
|---|---|---|---|
| Display | insegna (Anton) | titoli principali, prezzi | maiuscolo, spaziatura leggermente negativa, **misura ≥ 28 px**: sotto, un condensato pesante chiude i contrograffi |
| **Intermedio** | **corpo, peso semibold/bold** | sottotitoli, occhielli, etichette | 🔴 **mai il carattere da insegna**: maiuscoletto e spaziatura positiva tengono il registro senza cambiare famiglia |
| Firma | calligrafico (Allura) | slogan e tocchi calligrafici | **≥ 28 px, mai maiuscolo**, mai su prezzi, orari o indirizzo; di giorno legato al token dell'accento, mai a quello dell'inchiostro |
| Insegna | Playfair, peso più pesante | le sole tre parole | un uso solo, in un posto solo |
| Corpo | corpo, peso normale | descrizioni, allergeni | |

#### Scenario: 🔴 La sintesi dei caratteri è disattivata nel CSS generato

- GIVEN il CSS generato dalla build
- WHEN si cerca la dichiarazione che disattiva la sintesi dei caratteri
- THEN esiste ed è applicata all'elemento radice

#### Scenario: Un peso non disponibile non produce un grassetto finto

- GIVEN un elemento con il carattere da insegna e un peso maggiore dichiarato
- WHEN si osserva il testo renderizzato
- THEN i tratti sono quelli del peso disponibile
- AND non compare alcun ispessimento sintetizzato

#### Scenario: Il ruolo intermedio non usa il carattere da insegna

- GIVEN i sottotitoli, gli occhielli e le etichette delle due pagine
- WHEN se ne ispeziona la famiglia applicata
- THEN è quella del corpo
- AND non è quella da insegna

#### Scenario: Il carattere da insegna non scende sotto la misura minima

- GIVEN gli elementi che usano il carattere da insegna
- WHEN se ne ispeziona la misura calcolata
- THEN nessuno è sotto i 28 px

#### Scenario: Il calligrafico non compare su dati

- GIVEN prezzi, orari e indirizzo delle due pagine
- WHEN se ne ispeziona la famiglia applicata
- THEN nessuno usa il carattere calligrafico

### Requirement: L'insegna a tre parole è stirata ×1.55 da un token solo

Il fattore di stiramento orizzontale MUST essere **1.55** — il valore **misurato** sull'artwork — e
MUST NOT essere 1.5, che è quel numero arrotondato mentre si scriveva l'esempio nella stessa riga
del README di marca. I due differiscono del 3.3%: su una riga di 600 px sono 20 px, visibilissimi in
un confronto affiancato con l'insegna vera.

🔴 Il fattore MUST vivere in **un token solo**, e la **riserva di spazio** MUST derivare dallo
stesso token. La ragione è tecnica: la trasformazione **non partecipa al layout** — l'elemento
continua a occupare la larghezza non trasformata, quindi il testo stirato **sborda** sui vicini e
non si centra da solo. Se la riserva ripetesse il numero, il giorno in cui il fattore cambia lo
spazio resterebbe quello vecchio, e nessuno collegherebbe le due cose.

⚠️ Le tre parole MUST restare **testo selezionabile** e MUST NOT essere prese dall'SVG
dell'insegna: devono poter essere lette, tradotte e indicizzate.

La regolazione della larghezza tramite l'asse di font corrispondente MUST NOT essere usata: la
famiglia scelta non possiede quell'asse, e su un carattere che non ce l'ha quella proprietà **non
fallisce — non fa nulla**, che è peggio.

**Nota di debito**: la riga ambigua del README di marca andrebbe corretta perché punti al token
invece di ripetere un numero, ma `docs/brand/**` è invariato in questo change. È un change di
documentazione da un rigo.

#### Scenario: Il fattore è dichiarato una volta sola

- GIVEN i fogli di stile del progetto
- WHEN si cerca il fattore di stiramento
- THEN esiste un solo token che lo dichiara
- AND il suo valore è 1.55

#### Scenario: 🔴 La riserva di spazio deriva dal token

- GIVEN la regola che riserva lo spazio per il testo stirato
- WHEN se ne legge la definizione
- THEN è calcolata a partire dal token del fattore
- AND non contiene alcun numero ripetuto

#### Scenario: Cambiare il fattore sposta anche lo spazio

- GIVEN il token modificato a un valore diverso
- WHEN si osserva la riga dell'insegna
- THEN il testo resta centrato e non sborda sui vicini

#### Scenario: Le tre parole sono testo

- GIVEN l'HTML servito della home
- WHEN si cercano le tre parole dell'insegna
- THEN compaiono come testo selezionabile
- AND non sono contenute in un'immagine

---

## Dominio: Il marchio nella pagina

### Requirement: 🔴 Il logo entra nel DOM come markup, non come risorsa

Un SVG dentro un elemento immagine è un **documento isolato** e non eredita il colore corrente:
questo si risolve al nero, e il logo **sparisce sul fondo lavagna**. Sbagliare cartella non produce
un errore: produce un logo che scompare di sera. È la ragione per cui il logo esiste in tre varianti
invece che in una sola a colori dinamici.

La distinzione del README di marca MUST essere applicata alla lettera:

| Destinazione | File | Perché |
|---|---|---|
| cartella dei file serviti verbatim | favicon, icona per dispositivi mobili, immagine di anteprima social di ripiego, `robots.txt` | il browser li cerca a percorsi **precisi**, e un'impronta di contenuto nel nome li renderebbe introvabili |
| cartella degli asset di sorgente | logo e monogramma | inseriti **inline nel DOM**, l'unica condizione in cui il colore corrente segue il tema |

La controprova diagnostica, che è anche il criterio di successo: ispezionando l'elemento si deve
vedere un elemento SVG, **non** un elemento immagine.

Il change MUST copiare da `docs/brand/` **un sottoinsieme**, e MUST NOT copiare l'intera cartella:
il README dichiara sé stesso *"il master, non la cartella del sito"*, ed è la ragione per cui il
rollback non fa perdere alcun asset.

⚠️ Il `robots.txt` del sito MUST nascere **permissivo**: il divieto totale va sull'host dell'**app**,
non della vetrina, ed è Fase 6. Anticiparlo al file sbagliato deindicizzerebbe il sito che stiamo
costruendo.

#### Scenario: 🔴 Il logo è inline nel DOM

- GIVEN una pagina aperta nel browser
- WHEN si ispeziona l'elemento del logo
- THEN è un elemento SVG
- AND non è un elemento immagine

#### Scenario: 🔴 Il logo resta leggibile nei due temi

- GIVEN il logo visibile
- WHEN si passa da tema giorno a tema sera
- THEN il segno resta leggibile su entrambi i fondi
- AND non scompare in alcuno dei due

#### Scenario: I file serviti verbatim stanno ai loro percorsi

- GIVEN il sito servito
- WHEN si richiedono favicon, icona per dispositivi mobili e immagine di anteprima di ripiego ai
  loro percorsi canonici
- THEN ognuna risponde `200`
- AND il loro nome non contiene un'impronta di contenuto

#### Scenario: Solo un sottoinsieme del master è stato copiato

- GIVEN le cartelle degli asset di `sito/`
- WHEN si confrontano con `docs/brand/`
- THEN contengono un sottoinsieme
- AND `docs/brand/` è invariato

#### Scenario: Il `robots.txt` è permissivo

- GIVEN il `robots.txt` servito dal sito
- WHEN se ne legge il contenuto
- THEN non contiene un divieto totale di scansione

### Requirement: L'immagine di anteprima social è assoluta, con un ripiego locale

I meta di anteprima social MUST essere popolati dai campi SEO della rotta del sito.

L'immagine di anteprima MUST essere **assoluta**:

- quando l'API la fornisce, è assoluta per costruzione perché composta dal prefisso dei media (spec
  `consumo-api-pubblica`) — è il caso normale;
- in sua assenza MUST essere usato il file di ripiego servito verbatim, reso assoluto rispetto
  all'URL della richiesta corrente.

Il ripiego MUST essere mantenuto: il costo è un file già esistente e tre righe, l'alternativa è un
link condiviso senza anteprima nel giorno in cui nessuno ha ancora scelto l'immagine.

⚠️ L'URL canonico e il collegamento canonico assoluti restano **Fase 3**, insieme alla dichiarazione
del dominio e alla sitemap.

⚠️ Rischio residuo dichiarato: dietro un proxy inverso l'origine assoluta dipenderà dagli header di
host e di protocollo inoltrato. La configurazione esistente li inoltra già, ma il proxy davanti alla
**vetrina** non esiste ancora: **da verificare in Fase 6**. Il sintomo di un guasto sarebbe
un'immagine di anteprima in chiaro su un sito servito in sicuro.

#### Scenario: Anteprima dall'API

- GIVEN la rotta del sito che fornisce l'immagine di anteprima
- WHEN si ispezionano i meta dell'HTML servito
- THEN l'URL dell'immagine è assoluto
- AND è composto dal prefisso dei media

#### Scenario: Anteprima di ripiego

- GIVEN la rotta del sito che non fornisce alcuna immagine di anteprima
- WHEN si ispezionano i meta dell'HTML servito
- THEN l'URL punta al file di ripiego servito verbatim
- AND è assoluto

#### Scenario: Nessun canonico assoluto in questa fase

- GIVEN l'HTML servito
- WHEN si cerca il collegamento canonico assoluto
- THEN non è presente
- AND la sua introduzione è dichiarata come Fase 3
