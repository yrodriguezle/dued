# Consumo dell'API Pubblica Specification

**Domain**: consumo-api-pubblica
**Status**: Active
**Ultimo aggiornamento**: 2026-08-13

Change incorporate in questa spec:

| Change | Archiviata il | Contenuto |
|--------|---------------|-----------|
| vetrina-sito-astro | 2026-08-13 | Spec iniziale del dominio: due prefissi distinti da due moduli virtuali, avviso quando coincidono, il modulo di lettura restituisce un esito e non lancia mai, tipi che rispecchiano i DTO campo per campo, il percorso caldo non usa CORS |

È il **lato consumatore** del contratto definito dalla spec [`api-pubblica`](../api-pubblica/specs.md).
Quella spec descrive **cosa il backend espone**; questa descrive **come il sito lo legge**, e in
particolare il confine che il DTO ha documentato un change prima che il consumatore esistesse.

## Purpose

Il change precedente si è chiuso scrivendo, dentro il DTO dell'immagine, l'avvertimento che questa
spec esiste per far rispettare:

> *"Chi compone l'URL è il consumatore, e ha **due** prefissi distinti: quello con cui legge le
> rotte API server-side (rete interna) e quello con cui il **browser** carica le immagini.
> Confonderli produce markup che funziona in ogni prova server-side e si rompe per ogni
> visitatore — in sviluppo i due prefissi coincidono, ed è precisamente per questo che l'errore
> non si vede finché non si va in produzione."*
> — [`ImmaginePubblicaDto.cs:13-17`](../../../backend/Controllers/Public/Dto/ImmaginePubblicaDto.cs)

Questa spec definisce quindi tre cose, e la prima è la sola ragione per cui esiste come dominio
separato:

1. **Il confine dei due prefissi**: due moduli virtuali diversi, un file solo per ciascuno, un
   avviso che si accende **dove i due coincidono**, e una prova con host sentinella accompagnata
   dalla **controprova** che dimostra che la prova ingenua sarebbe passata lo stesso.
2. **La forma della lettura**: un modulo che restituisce un **esito** e non lancia mai, con un
   timeout e una degradazione dichiarata.
3. **Lo specchio dei tipi**: i tipi del sito rispecchiano i DTO, con le nullabilità che il backend
   ha scelto deliberatamente.

**Fuori scope in questa spec**: il comportamento HTTP delle pagine in degradazione — codici,
`Retry-After`, `Cache-Control` — che sta nella spec [`sito-pubblico`](../sito-pubblico/specs.md); il
markup delle immagini, che sta nella spec [`immagini-vetrina`](../immagini-vetrina/specs.md).

**Stato verificato prima della change**: le tre rotte pubbliche esistono, sono anonime, rispondono
`200` con `Cache-Control` corretto e **non le chiama nessuno**; il controller porta la policy CORS
dedicata `PubblicaSenzaCredenziali`, scritta per un consumatore browser che non è mai arrivato; in
sviluppo il percorso `/media/` è servito da .NET **solo** in ambiente Development, in produzione da
nginx dalla cartella dei media — cioè da **due host diversi**, ed è la ragione strutturale del
doppio prefisso.

---

## Dominio: I due prefissi

### Requirement: 🔴 Due prefissi distinti, esposti da due moduli virtuali diversi

Il sito MUST leggere due variabili d'ambiente **distinte**:

| Variabile | Chi la usa | Contesto | Sviluppo | Produzione (Fase 6) |
|---|---|---|---|---|
| `API_INTERNA_URL` | il **server** del sito, per leggere le rotte | server | `https://localhost:4000` | `http://backend:5000` — nome della rete Docker |
| `PUBLIC_MEDIA_ORIGINE` | il **browser**, dentro `src` e `srcset` | client | `https://localhost:4000` | l'host pubblico della vetrina |

Le due MUST essere dichiarate in uno **schema tipizzato** nella configurazione del progetto, con il
**contesto** esplicito (server per la prima, client per la seconda), e MUST essere lette dai
**due moduli virtuali corrispondenti** — non dallo stesso oggetto di ambiente.

Un file che tentasse di leggere la variabile del server dal modulo del client (o viceversa) MUST
produrre un **errore di build**, non un valore indefinito a runtime.

⚠️ I due nomi MUST NOT condividere alcun morfema: `API` ≠ `MEDIA`, `INTERNA` ≠ `PUBLIC`, `URL` ≠
`ORIGINE`. Non è un vezzo — una coppia come `API_BASE_URL` / `MEDIA_BASE_URL` differisce per **una**
parola in mezzo, e una copia-incolla distratta produce l'altra. Qui non esiste una copia-incolla che
produca l'altra.

Il prefisso `PUBLIC_` MUST essere mantenuto anche se lo schema dichiara già il contesto: è la parola
che si legge nel file `.env`, ed è lì che qualcuno deciderà quale valore mettere. "PUBLIC" significa
letteralmente *il browser lo vedrà*.

#### Scenario: Lo schema dichiara due variabili con due contesti

- GIVEN la configurazione del progetto
- WHEN se ne legge lo schema delle variabili d'ambiente
- THEN dichiara `API_INTERNA_URL` con contesto server
- AND dichiara `PUBLIC_MEDIA_ORIGINE` con contesto client
- AND non esiste alcuna terza variabile che rappresenti un prefisso

#### Scenario: 🔴 L'import dal contesto sbagliato è un errore di build

- GIVEN un file che importa `API_INTERNA_URL` dal modulo del client
- WHEN si esegue la build
- THEN fallisce
- AND l'errore nomina la variabile e il contesto

#### Scenario: I due nomi non si trasformano l'uno nell'altro

- GIVEN i nomi delle due variabili
- WHEN se ne confrontano le parole
- THEN nessuna parola compare in entrambi

#### Scenario: Il file di esempio spiega la differenza dove si sceglie il valore

- GIVEN il file di esempio delle variabili d'ambiente
- WHEN se ne leggono le due righe
- THEN ciascuna dichiara **chi** usa quel prefisso (il server o il browser)
- AND dichiara il valore che assumerà in produzione
- AND avverte che in sviluppo i due coincidono ed è per questo che l'errore non si vede

### Requirement: 🔴 Un file solo per prefisso, pinnato da un test che legge i sorgenti

Il modulo che legge le rotte MUST essere l'**unico** file del progetto che importa dal modulo
virtuale del contesto server.

Il modulo che compone gli URL dei media MUST essere l'**unico** file del progetto che contiene il
segmento di percorso dei media, e l'unico che importa dal modulo virtuale del contesto client.

Entrambe le unicità MUST essere verificate da un test che **legge i sorgenti** — idioma già in uso
nel backend per la regola di pubblicazione unica — e non da una convenzione o da una revisione.

🔴 La composizione dell'URL dei media MUST NOT essere condivisa con l'app di cassa e MUST NOT essere
estratta in un pacchetto comune: l'admin ha **un** prefisso perché è tutto browser, il sito ne ha
**due**. La dottrina è la stessa; il file, deliberatamente, no.

**Verifica per mutazione**: aggiungere in un secondo file l'import del modulo server, o una seconda
composizione del percorso dei media, MUST far fallire il test. Un test che verificasse solo che il
file atteso contiene la stringa resterebbe verde.

#### Scenario: 🔴 Il modulo dell'ambiente server compare in un file solo

- GIVEN i sorgenti di `sito/`
- WHEN si cercano i file che importano dal modulo virtuale del contesto server
- THEN l'elenco contiene esattamente il modulo che legge le rotte

#### Scenario: 🔴 Il percorso dei media si compone in un file solo

- GIVEN i sorgenti di `sito/`
- WHEN si cercano i file che contengono il segmento di percorso dei media
- THEN l'elenco contiene esattamente il modulo di composizione degli URL

#### Scenario: 🔴 Un secondo compositore fa fallire il test

- GIVEN una pagina che compone a mano l'URL di un media invece di usare il modulo
- WHEN si esegue la suite
- THEN il test dell'unicità fallisce nominando il file aggiunto

#### Scenario: Nessuna utility condivisa con l'app di cassa

- GIVEN il repository alla fine della change
- WHEN si cerca un pacchetto o un modulo condiviso per la composizione degli URL dei media
- THEN non esiste
- AND il file corrispondente dell'app di cassa è invariato

#### Scenario: Il commento dice perché i due file non sono uno

- GIVEN il modulo di composizione degli URL del sito
- WHEN se ne legge il commento di testa
- THEN dichiara che l'admin ha un prefisso e il sito ne ha due
- AND dichiara che l'estrazione di una utility comune imporrebbe al sito la forma sbagliata

### Requirement: 🔴 Un avviso allo start si accende quando i due prefissi coincidono

All'avvio del dev server **e** del server di prova, lo script di avvio MUST confrontare i valori dei
due prefissi e, se sono **uguali**, MUST stampare un avviso che:

1. dichiara che i due coincidono, riportando il valore;
2. dichiara che è **lecito in sviluppo** e sarà un **guasto invisibile in produzione** — ogni
   immagine del sito porterebbe l'host interno del backend;
3. mostra il comando esatto per avviare con i due valori distinti.

L'avviso MUST NOT impedire l'avvio: non è una guardia, è **una diagnosi che compare da sé** nel
punto in cui il problema è per definizione invisibile. Chi sviluppa la legge ogni giorno, e la
prima volta che la legge sa già cosa significa.

Quando i due valori sono **diversi**, l'avviso MUST NOT comparire: un avviso che compare sempre
smette di essere letto.

#### Scenario: 🔴 I due valori coincidono

- GIVEN i due prefissi impostati allo stesso valore
- WHEN si avvia il dev server
- THEN compare l'avviso
- AND riporta il valore condiviso
- AND spiega che in produzione ogni immagine porterebbe l'host interno del backend
- AND mostra il comando per avviare con i due valori distinti
- AND il server si avvia comunque

#### Scenario: I due valori sono diversi

- GIVEN i due prefissi impostati a due valori diversi
- WHEN si avvia il dev server
- THEN nessun avviso sui prefissi compare

#### Scenario: L'avviso vale anche per il server di prova

- GIVEN i due prefissi impostati allo stesso valore
- WHEN si avvia il bundle di produzione tramite lo script di avvio
- THEN compare lo stesso avviso

### Requirement: 🔴 La prova con host sentinella, e la controprova che la rende necessaria

La separazione dei due prefissi MUST essere provata con **due** verifiche, e servono entrambe.

**Prova A — automatizzabile, deterministica, senza rete.** Con `PUBLIC_MEDIA_ORIGINE` impostato a
un host **sentinella** che non esiste (`media.sentinella.invalid`) e `API_INTERNA_URL` puntato al
backend vero, l'HTML servito di `/menu` MUST contenere l'host sentinella e MUST contenere **zero**
occorrenze dell'host dell'API. È un'asserzione **sul markup**, non sul caricamento: l'host
sentinella non risolve, e non deve risolvere.

**Prova B — la prova umana.** Con `PUBLIC_MEDIA_ORIGINE` puntato all'indirizzo di rete locale e
`API_INTERNA_URL` a `localhost`, la pagina MUST renderizzarsi **e** le immagini MUST caricare nel
browser: due valori diversi, entrambi funzionanti.

🔴 **Controprova, obbligatoria.** Con **un solo** prefisso — cioè componendo gli URL delle immagini
dallo stesso valore usato per leggere le rotte — la prova A MUST fallire, trovando l'host dell'API
dentro il markup. È ciò che **dimostra** che una prova ingenua (pagina che si renderizza, markup
presente, nessun test rosso) sarebbe passata lo stesso, ed è per questo che serve quella con i due
valori distinti.

⚠️ Le asserzioni MUST essere ricerche di sottostringa sull'HTML servito, mai confronti su righe o
indentazione (spec `sito-pubblico`).

#### Scenario: 🔴 Prova A — host sentinella nel markup

- GIVEN il prefisso dei media impostato a `media.sentinella.invalid` e il prefisso API al backend
  vero
- WHEN si costruisce il bundle, si avvia il server di prova e si richiede `/menu`
- THEN l'HTML contiene `media.sentinella.invalid`
- AND contiene zero occorrenze dell'host dell'API
- AND la verifica non richiede che l'host sentinella risolva

#### Scenario: 🔴 Controprova — con un prefisso solo l'asserzione trova l'host interno

- GIVEN il sito modificato per comporre gli URL dei media dal prefisso dell'API
- WHEN si esegue la prova A
- THEN fallisce trovando l'host dell'API nel markup
- AND la pagina si sarebbe comunque renderizzata senza alcun errore

#### Scenario: Prova B — due valori diversi, entrambi funzionanti

- GIVEN il prefisso dei media puntato all'indirizzo di rete locale e quello API a `localhost`
- WHEN si apre `/menu` in un browser
- THEN la pagina si renderizza
- AND le immagini rispondono `200` nella scheda di rete

#### Scenario: L'HTML servito non contiene mai l'host di lettura delle rotte

- GIVEN una qualunque configurazione in cui i due prefissi sono distinti
- WHEN si ispeziona l'HTML servito di `/` e `/menu`
- THEN l'host del prefisso API non compare in alcun attributo del markup

### Requirement: Il prefisso dei media è un'origine assoluta, mai vuota

`PUBLIC_MEDIA_ORIGINE` MUST essere un'origine **assoluta** in ogni ambiente, sviluppo compreso, e
MUST NOT essere vuota.

Un prefisso vuoto produrrebbe URL relative — tecnicamente corrette, perché in produzione i media
saranno serviti sullo stesso host della vetrina — e sarebbe la forma più breve. Va rifiutata per due
ragioni:

1. **l'immagine di anteprima social deve essere assoluta**, e con il prefisso vuoto non lo sarebbe;
2. la stringa vuota è **anche ciò che si ottiene dimenticando la variabile**: con quel valore i due
   prefissi tornano indistinguibili da un errore di configurazione.

Il backend MUST NOT essere modificato per comporre l'URL e mandarlo nel DTO: è precisamente ciò che
il DTO **rifiuta di fare**, con la sua motivazione scritta — una risposta cacheata cinque minuti che
contenesse un hostname resterebbe sbagliata per cinque minuti dopo ogni cambio di dominio.

#### Scenario: Origine assoluta in sviluppo

- GIVEN il file di esempio delle variabili d'ambiente
- WHEN si legge il valore del prefisso dei media
- THEN è un'origine assoluta con schema e host

#### Scenario: Immagine di anteprima social assoluta

- GIVEN una pagina con l'immagine di anteprima social presa dall'API
- WHEN se ne ispeziona il meta nell'HTML servito
- THEN il suo valore è un URL assoluto

#### Scenario: Il backend non compone URL

- GIVEN la risposta di una qualsiasi rotta pubblica
- WHEN se ne ispezionano i campi immagine
- THEN nessuno contiene uno schema o un host
- AND il backend è invariato rispetto alla base della change

---

## Dominio: La lettura delle rotte

### Requirement: 🔴 Il modulo di lettura restituisce un esito e non lancia mai

Il modulo che legge le rotte MUST esporre funzioni che restituiscono un'**unione discriminata** con
due stati — dati presenti, oppure assenti con il motivo — e MUST NOT lanciare eccezioni, MUST NOT
restituire una promessa che rifiuta, e MUST NOT usare la forma "valore oppure nullo", che non dice
**perché**.

I motivi dell'assenza MUST distinguere almeno: timeout, errore di rete, risposta HTTP non riuscita,
formato inatteso.

Ogni lettura MUST avere un timeout, dichiarato in **una sola costante**.

⚠️ Proprietà che discende dal fatto che nessuna funzione rifiuta, e va detta perché è ciò che la
rende utile: l'attesa **parallela** delle due letture non può cortocircuitare. Le due letture della
home partono insieme, dimezzando la latenza, senza bisogno di una forma di attesa tollerante ai
rigetti — e un fallimento **parziale** resta parziale, cioè `/` con gli orari veri e senza i
consigliati è uno stato reale e va reso (spec `sito-pubblico`).

Ogni esito assente MUST scrivere una riga sullo stdout del processo: in Fase 6 sono i log del
container, come il log di avviso del backend è nei log di .NET. **Chi guarda il sito vede meno; chi
guarda i log sa perché.**

Il modulo MUST NOT riprovare la lettura: un secondo tentativo raddoppierebbe il tempo peggiore di
risposta proprio nel caso in cui il backend è **giù**, che è il caso in cui i tentativi non
servono.

#### Scenario: 🔴 Backend non in ascolto

- GIVEN il backend non in ascolto
- WHEN si invoca la lettura della rotta del sito
- THEN la promessa si risolve
- AND l'esito dichiara l'assenza con motivo di rete
- AND nessuna eccezione viene propagata al chiamante

#### Scenario: Risposta lenta oltre il timeout

- GIVEN un backend che non risponde entro il timeout dichiarato
- WHEN si invoca la lettura
- THEN l'esito dichiara l'assenza con motivo di timeout
- AND l'attesa non supera sensibilmente il valore della costante

#### Scenario: Risposta con codice di errore

- GIVEN un backend che risponde `500`
- WHEN si invoca la lettura
- THEN l'esito dichiara l'assenza con motivo HTTP
- AND il dettaglio riporta il codice ricevuto

#### Scenario: Risposta con corpo inatteso

- GIVEN un backend che risponde `200` con un corpo non interpretabile
- WHEN si invoca la lettura
- THEN l'esito dichiara l'assenza con motivo di formato

#### Scenario: L'attesa parallela non cortocircuita

- GIVEN la rotta del sito che risponde e quella del menu che fallisce
- WHEN la home attende entrambe in parallelo
- THEN ottiene un esito presente per il sito e uno assente per il menu
- AND l'attesa non viene interrotta dal fallimento

#### Scenario: Un solo valore di timeout nel progetto

- GIVEN i sorgenti di `sito/`
- WHEN si cercano i valori di timeout delle letture
- THEN esiste una sola costante
- AND nessuna chiamata dichiara un proprio valore

#### Scenario: Ogni assenza lascia una riga nei log

- GIVEN una lettura che non riesce, per qualunque motivo
- WHEN si osserva lo stdout del processo
- THEN contiene una riga che nomina la rotta e il motivo

### Requirement: L'ora di ripiego del tema è dichiarata come ripiego

Lo script del tema (spec `temi-e-identita`) ha bisogno dell'ora di inizio del registro serale, che
arriva dalla rotta del sito. Quando quella lettura è **assente**, il sito MUST usare una costante di
ripiego dichiarata in un modulo dedicato, con il commento che dice **cos'è e cosa non è**: non una
seconda sorgente di verità, ma un ripiego per un backend irraggiungibile, il cui unico effetto se
sbagliato è spostare di qualche ora un tema automatico su una pagina **che sta già dichiarando di
essere incompleta**.

La costante MUST NOT essere usata quando la lettura è riuscita, nemmeno come valore di default di
un parametro.

#### Scenario: Ripiego usato solo in assenza del dato

- GIVEN la rotta del sito che risponde
- WHEN si ispeziona la pagina servita
- THEN l'ora passata allo script è quella della risposta
- AND non è il valore di ripiego

#### Scenario: Ripiego in stato degradato

- GIVEN il backend non in ascolto
- WHEN si apre `/`
- THEN lo script riceve il valore di ripiego
- AND la pagina dichiara comunque di essere incompleta

#### Scenario: Il commento dice cosa non è

- GIVEN il modulo che dichiara la costante di ripiego
- WHEN se ne legge il commento
- THEN dichiara che non è una seconda sorgente di verità
- AND dichiara qual è l'unico effetto di un valore sbagliato

---

## Dominio: Lo specchio dei tipi

### Requirement: I tipi del sito rispecchiano i DTO, campo per campo

Il modulo dei tipi MUST rispecchiare i DTO delle rotte pubbliche. Un campo dichiarato qui che il DTO
non possiede è un campo che sarà **sempre** indefinito; un campo del DTO che manca qui è un dato che
il sito **ignora** — entrambe le cose vanno viste, ed è la ragione per cui i tipi stanno in un file
solo con quel commento in testa.

Vincoli che il tipo MUST riportare fedelmente:

| Campo | Vincolo | Perché |
|---|---|---|
| larghezze disponibili | elenco di **numeri**, mai una stringa da interpretare | il backend le espone già come numeri, tolleranti a righe malformate |
| prezzo | numero già risolto: `0` è un **omaggio**, non un'assenza | distinzione decisa nel change precedente |
| giorni operativi | ⚠️ **nullable**, e va gestito | il backend li espone nulli quando il valore persistito non è leggibile come sette booleani: *"omettere gli orari settimanali è meglio che dichiararne di sbagliati"* |
| coordinate geografiche | o **entrambe** o niente | il backend espone l'oggetto nullo, non due campi indipendenti |
| punto focale | stringa **già** nella forma utilizzabile dal client | nessuna conversione lato sito |
| placeholder | data URI **completo** | si usa verbatim, non si compone |
| ora di inizio del registro serale | **parametro**, non "è sera adesso" | spec `temi-e-identita` |

#### Scenario: Giorni operativi nulli

- GIVEN una risposta della rotta del sito con i giorni operativi nulli
- WHEN si apre `/`
- THEN la pagina mostra apertura e chiusura
- AND non mostra alcun elenco di giorni
- AND non solleva alcun errore

#### Scenario: Prezzo a zero

- GIVEN un prodotto pubblicato con prezzo `0`
- WHEN compare in `/menu`
- THEN il prezzo viene mostrato come tale
- AND il prodotto non viene trattato come privo di prezzo

#### Scenario: Coordinate assenti

- GIVEN una risposta della rotta del sito senza coordinate
- WHEN si apre `/`
- THEN la pagina si renderizza
- AND non mostra alcun riferimento a coordinate parziali

#### Scenario: Il modulo dei tipi non inventa campi

- GIVEN il modulo dei tipi del sito
- WHEN se ne confrontano i campi con i DTO delle rotte pubbliche
- THEN ogni campo dichiarato esiste nel DTO corrispondente

#### Scenario: Il commento di testa dichiara la regola

- GIVEN il modulo dei tipi
- WHEN se ne legge il commento di testa
- THEN dichiara che un campo in più è sempre indefinito
- AND dichiara che un campo in meno è un dato ignorato

### Requirement: Il percorso caldo non usa CORS, e la policy dedicata resta intatta

La lettura delle rotte MUST avvenire **server-side**: il percorso caldo non usa CORS affatto.

Il change MUST NOT aggiungere origini alla configurazione CORS del backend: la policy dedicata alle
rotte pubbliche esiste già, emette un'intestazione di origine costante e **senza credenziali**, ed è
già applicata al controller. La scelta non riguardava l'accesso — l'origine di sviluppo era già
ammessa dalla policy globale — ma il fatto che una risposta dichiarata cacheabile non debba portare
la variazione per origine.

#### Scenario: La lettura avviene sul server

- GIVEN una pagina servita con JavaScript disattivato nel browser
- WHEN si apre `/menu`
- THEN i prodotti sono già presenti nell'HTML servito
- AND il browser non effettua alcuna richiesta verso le rotte pubbliche per popolarli

#### Scenario: Nessuna modifica alla configurazione CORS

- GIVEN il repository alla fine della change
- WHEN si ispeziona la configurazione CORS del backend
- THEN è invariata rispetto alla base della change
