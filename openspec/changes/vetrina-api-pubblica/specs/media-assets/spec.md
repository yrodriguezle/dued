# Delta for Media Assets

**Change**: vetrina-api-pubblica
**Date**: 2026-08-11
**Status**: Draft

> **Base di questa delta**: la spec `media-assets` introdotta dal change
> [`vetrina-fondamenta-media`](../../../vetrina-fondamenta-media/specs/media-assets/spec.md),
> **non ancora archiviata** in `openspec/specs/`. In fase di archiviazione le due vanno fuse
> nell'ordine: prima quella del change precedente, poi questa.
>
> **Perché un dominio che sembrava chiuso viene riaperto.** L'entità delle impostazioni della
> vetrina introduce un **secondo referente** dei media — l'immagine di anteprima social — e la
> procedura di eliminazione esistente è scritta per un referente solo. È il caso in cui una
> change apparentemente additiva rompe qualcosa che non ha toccato.
>
> **Comportamento attuale verificato**:
> - 🔴 [`VetrinaMutations.cs:226-255`](../../../../../backend/GraphQL/Vetrina/VetrinaMutations.cs) —
>   `EliminaMediaAssetAsync` verifica i riferimenti **solo** sui prodotti, poi
>   `await storage.EliminaAsync(asset.Chiave)` (① i file spariscono) e infine
>   `SaveChangesAsync()` (② e solo ora il database può dire di no). L'ordine è deliberato e
>   corretto per il caso previsto — *"se la cancellazione dei file fallisce, la riga resta e
>   l'operazione è ripetibile"* — ma con un secondo referente protetto da un vincolo restrittivo
>   il ② solleva un errore di chiave esterna **dopo** che ① ha già cancellato i file.
> - [`VetrinaMutations.cs:203`](../../../../../backend/GraphQL/Vetrina/VetrinaMutations.cs) —
>   `asset.Cartella = string.IsNullOrWhiteSpace(input.Cartella) ? "generale" : input.Cartella.Trim();`
>   nessuna normalizzazione di maiuscole/minuscole.
> - Il default `"generale"` compare in **cinque punti** del codice e **nessun media ha mai avuto
>   `"gallery"`**: una rotta pubblica che filtrasse su quel valore risponderebbe sempre vuota.
> - [`MediaLibrary.tsx:206-210,265-268`](../../../../../duedgusto/src/components/pages/sito/MediaLibrary.tsx) —
>   la cartella si inserisce in **due campi di testo libero**, uno nel caricamento e uno nella
>   modifica.
> - [`MediaController.cs:12-16`](../../../../../backend/Controllers/MediaController.cs) —
>   `MediaConfigurazioneDto` espone quattro costanti; la libreria la legge al montaggio ed è il
>   motivo per cui il frontend non ha una propria copia dei limiti.
> - Esistono **due** conversioni dell'elenco delle larghezze da testo a numeri, divergenti:
>   `MediaController.LeggiLarghezze` (riga 145, **solleva** su input sporco) e
>   `MediaAssetType.LeggiLarghezze` (tollerante).

## MODIFIED Requirements

### Requirement: Eliminazione bloccata se l'asset è referenziato

Il sistema MUST **rifiutare** l'eliminazione di un media referenziato, con un errore esplicito
che nomina il riferimento, e MUST NOT eliminare né il record né alcun file. Il vincolo MUST
essere applicato anche a livello di database con una politica di cancellazione restrittiva.
Quando il media non è referenziato, l'eliminazione MUST rimuovere il record e **tutti** i file
delle sue varianti. Tutto ciò resta invariato.

**Ciò che questa change aggiunge**: i referenti da verificare MUST essere **due** — i prodotti e
l'immagine di anteprima social delle impostazioni della vetrina — e la verifica di **entrambi**
MUST avvenire **prima di toccare il disco**.

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
restrittiva, così che nemmeno una cancellazione diretta a database possa lasciare un riferimento
pendente (spec `impostazioni-vetrina`).

(Precedentemente: il requirement parlava di un solo referente, i prodotti, perché era l'unico
esistente.)

**Verifica per mutazione**: rimuovere il controllo sull'immagine di anteprima MUST far fallire lo
scenario che asserisce la presenza dei file su disco. È l'asserzione che conta ed è quella che si
dimentica: un test che verificasse solo il rifiuto resterebbe verde anche con i file già
cancellati.

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

#### Scenario: Riferimento rimosso e poi eliminazione

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
- THEN il rifiuto e il messaggio che nomina i prodotti sono identici a prima della change

### Requirement: Metadati nel database, binari sul filesystem

Restano invariati: la separazione fra metadati e binari, l'univocità della chiave, il fatto che
la cartella sia un'etichetta editoriale che MUST NOT influenzare il percorso dei file su disco, e
il fatto che l'insieme delle cartelle resti **aperto** — nessun elenco chiuso, nessuna migrazione
per ogni cartella futura, perché le fasi successive ne porteranno almeno tre.

**Ciò che questa change aggiunge**: la cartella MUST avere **una sola forma canonica**. Il valore
MUST essere normalizzato **in scrittura** — spazi rimossi e caratteri portati a minuscolo — sia
nel percorso di caricamento sia in quello di modifica, e il valore vuoto o composto di soli spazi
MUST continuare a diventare il valore di default.

La normalizzazione MUST avvenire in **scrittura e non in lettura**, per due ragioni entrambe
vincolanti:

1. una lettura che normalizzasse applicherebbe una funzione alla colonna dentro la condizione
   SQL, rendendo inutilizzabile l'indice per la selezione ordinata;
2. il confronto di uguaglianza si comporta in modo **diverso** fra il database di produzione, la
   cui collazione ignora le maiuscole, e il provider in memoria usato nei test, che confronta in
   modo ordinale. Un test verde direbbe poco sul comportamento reale, e viceversa. La
   normalizzazione in scrittura fa coincidere i due mondi e rende il valore persistito
   **canonico** invece che soltanto equivalente.

La cartella dedicata alla galleria pubblica MUST avere come valore canonico **`"galleria"`**, in
italiano e minuscolo. Il codebase è italiano fin dentro i valori dei dati (`generale`) e la rotta
pubblica si chiama `galleria`: un valore inglese sarebbe l'unico del modello dati, e una rotta
italiana che filtra su un valore inglese è una traduzione che esiste solo nella testa di chi l'ha
scritta. La scelta MUST essere fatta **ora**: non esiste alcun media da migrare, e dopo il primo
caricamento non sarà più gratuita.

(Precedentemente: la cartella era «una stringa libera non nulla con default `"generale"`», con la
sola rimozione degli spazi e nessuna regola sulle maiuscole. L'insieme chiuso era rimandato «a
quando si sapranno le cartelle vere»: resta rimandato, ma la forma canonica no.)

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

- GIVEN il database prima della change
- WHEN si cercano media con cartella pari al valore inglese `"gallery"`
- THEN non ne esiste alcuno
- AND la scelta del valore canonico non richiede alcuna migrazione di dati

## ADDED Requirements

### Requirement: Le cartelle suggerite arrivano dal server, e la cartella si sceglie invece di digitarla

L'elenco delle cartelle suggerite MUST essere esposto dal backend insieme alle altre costanti già
lette dalla libreria dei media al montaggio, e il frontend MUST NOT possedere una propria copia
di quei valori: **non può divergere ciò di cui non si ha una seconda scrittura**.

Qui la divergenza avrebbe una forma precisa e insidiosa: l'amministratore etichetta un'immagine
con un valore scritto dal frontend, la rotta pubblica filtra su un valore diverso, e **la
galleria del sito resta vuota senza alcun errore da nessuna parte**.

Nei due punti in cui oggi la cartella si digita liberamente, l'interfaccia MUST proporre le
cartelle disponibili — quelle suggerite dal server unite a quelle già presenti fra i media
caricati — **continuando ad accettare un valore digitato**: l'insieme è aperto, quindi un elenco
chiuso sarebbe sbagliato, ma un campo di testo nudo non rende scopribile la cartella della
galleria e nessuno la popolerebbe mai.

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

- GIVEN il codice del frontend dopo la change
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
solo punto** del backend, e i consumatori esistenti MUST delegarvi invece di implementarla. Al
momento della change ne esistono due, divergenti.

La semantica unificata MUST essere **tollerante**: un valore vuoto MUST produrre un elenco vuoto
e i valori non numerici MUST essere scartati, senza sollevare eccezioni. La variante che solleva
MUST NOT sopravvivere: la stessa conversione viene ora eseguita anche in una rotta **anonima**,
dove un'eccezione su una riga malformata è un errore di infrastruttura servito a un visitatore.

Questo requisito è la sorgente unica anche per l'esposizione pubblica descritta nella spec
`api-pubblica`, che ne è consumatore.

#### Scenario: Una sola implementazione

- GIVEN il codice del backend dopo la change
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
- THEN entrambe restituiscono gli stessi numeri di prima della change
