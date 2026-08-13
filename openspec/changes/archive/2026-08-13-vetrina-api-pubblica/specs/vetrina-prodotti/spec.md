# Delta for Vetrina Prodotti

**Change**: vetrina-api-pubblica
**Date**: 2026-08-11
**Status**: Draft

> **Base di questa delta**: la spec `vetrina-prodotti` introdotta dal change
> [`vetrina-fondamenta-media`](../../../vetrina-fondamenta-media/specs/vetrina-prodotti/spec.md),
> **non ancora archiviata** in `openspec/specs/`. In fase di archiviazione le due vanno fuse
> nell'ordine: prima quella del change precedente, poi questa.
>
> **Cosa cambia e cosa no.** Le due regole della vetrina — la pubblicazione e il fallback del
> prezzo — **non cambiano di comportamento**: cambiano di **collocazione**. Oggi vivono dentro
> due resolver GraphQL e non sono richiamabili da altro codice; da questa change vivono in un
> punto condiviso, e i resolver le **chiamano** invece di implementarle. Il contratto dello
> schema resta identico carattere per carattere.
>
> **Comportamento attuale verificato**:
> - [`ProdottoType.cs:49-61`](../../../../../backend/GraphQL/Vendite/Types/ProdottoType.cs) —
>   `pubblicatoSulSito` risolve `context.Source.Attivo && context.Source.VisibileSulSito` e la
>   sua descrizione dichiara: *"È la regola unica su cui filtrerà l'API pubblica — chiunque
>   filtri diversamente sta inventando un secondo criterio"*. `prezzoEffettivoVetrina` risolve
>   `PrezzoVetrina ?? Prezzo`.
> - 🔴 [`VetrinaMutations.cs:194`](../../../../../backend/GraphQL/Vetrina/VetrinaMutations.cs) —
>   `.Where(p => p.ImmagineId == mediaAssetId && p.Attivo && p.VisibileSulSito)`: **la seconda
>   copia della regola esiste già oggi**. Questa change non previene una duplicazione futura, ne
>   risolve una presente.
> - [`AppDbContext.cs:448-449`](../../../../../backend/DataAccess/AppDbContext.cs) — l'indice su
>   `VisibileSulSito` esiste, etichettato *"Filtro dell'API pubblica di Fase 2"*, e nessuna query
>   lo usa.

## MODIFIED Requirements

### Requirement: La pubblicazione è la congiunzione, calcolata in lettura e mai persistita

`VisibileSulSito` è un'**intenzione**, `Attivo` è uno **stato**. Sono proprietà di due domini
diversi: l'una MUST NOT scrivere sull'altra e l'una MUST NOT vincolare la scrittura dell'altra.
La pubblicazione effettiva MUST essere la **congiunzione** `Attivo && VisibileSulSito`, MUST
essere esposta come campo derivato di sola lettura (`pubblicatoSulSito`) e MUST NOT essere
persistita in alcuna colonna. Tutto ciò resta invariato.

**Ciò che questa change aggiunge**: la congiunzione MUST esistere come **espressione condivisa e
richiamabile**, collocata in un punto del backend che non dipende né da GraphQL né dal database,
e MUST essere utilizzabile in due modi con **una sola scrittura**:

1. come **filtro tradotto in SQL**, applicabile a una query di prodotti, così che una richiesta
   anonima non materializzi l'intero listino per scartarne la maggior parte;
2. come **valutazione in memoria** su un prodotto già caricato, per i resolver.

La forma (2) MUST derivare dalla forma (1) — la stessa espressione, compilata — e MUST NOT essere
una seconda scrittura della regola.

Il sistema MUST NOT usare un metodo di estensione sull'entità come forma canonica della regola:
non sarebbe traducibile in SQL, e si finirebbe con l'estensione per la memoria e una condizione
scritta a mano per il database — cioè con le due copie che questa change esiste per eliminare.

(Precedentemente: il requirement diceva che la regola «MUST essere esposta come unico campo
derivato» e che «i consumatori futuri MUST leggerla invece di riderivarla». Restava però
implementata **dentro un resolver GraphQL**, quindi non richiamabile: un controller REST poteva
solo riscriverla. Questa change la rende richiamabile, che è la condizione perché il divieto
scritto nella descrizione del campo sia rispettabile.)

Le descrizioni dei due campi GraphQL MUST restare **identiche carattere per carattere**: cambia
chi calcola il valore, non ciò che il contratto promette.

#### Scenario: Matrice della regola di pubblicazione

- GIVEN i quattro stati possibili della coppia attività in cassa / visibilità sul sito
- WHEN si valuta la regola condivisa su ciascuno
- THEN vale vero solo per `Attivo = true` con `VisibileSulSito = true`
- AND vale falso negli altri tre casi, compreso `Attivo = false` con `VisibileSulSito = true`

#### Scenario: La stessa regola in memoria e in SQL

- GIVEN un insieme di prodotti nei quattro stati possibili
- WHEN si filtra l'insieme con l'espressione applicata alla query e poi si valuta la regola in
  memoria su ciascun prodotto
- THEN i due risultati coincidono, prodotto per prodotto

#### Scenario: Il filtro viene tradotto in SQL

- GIVEN una query di prodotti a cui viene applicata l'espressione condivisa
- WHEN si ispeziona l'istruzione generata
- THEN la condizione compare nella clausola `WHERE`
- AND il filtro non viene applicato dopo la materializzazione dei risultati

#### Scenario: Il campo derivato non cambia comportamento

- GIVEN un client autenticato che legge `pubblicatoSulSito` su un insieme di prodotti
- WHEN si confrontano i valori letti prima e dopo la change
- THEN sono identici per ogni prodotto

#### Scenario: Le descrizioni dello schema restano identiche

- GIVEN lo schema GraphQL prima e dopo la change
- WHEN si confrontano le descrizioni di `pubblicatoSulSito` e `prezzoEffettivoVetrina`
- THEN sono identiche carattere per carattere

#### Scenario: La pubblicazione continua a non avere uno stato proprio a database

- GIVEN lo schema del database dopo la change
- WHEN si ispezionano le colonne della tabella dei prodotti
- THEN non esiste alcuna colonna corrispondente alla pubblicazione
- AND non è stata aggiunta alcuna colonna alla tabella dei prodotti

### Requirement: PrezzoVetrina se valorizzato, altrimenti Prezzo

Il prezzo da mostrare in vetrina MUST essere `PrezzoVetrina` quando questo è **non null**, e
`Prezzo` in tutti gli altri casi. Il fallback MUST essere **dinamico**, valutato a ogni lettura,
e il sistema MUST NOT copiare `Prezzo` dentro `PrezzoVetrina` al momento della scrittura.
🔴 `PrezzoVetrina = 0` MUST essere considerato un valore valorizzato — un omaggio — e MUST NOT
ricadere sul listino: **solo `null` è assenza**. Tutto ciò resta invariato.

**Ciò che questa change aggiunge**: il fallback MUST esistere nello stesso punto condiviso della
regola di pubblicazione, e MUST essere esposto in una forma che accetti **i due valori** (prezzo
di vetrina e prezzo di listino) e non soltanto l'entità intera.

La ragione della firma è vincolante e non stilistica: la lettura pubblica avviene tramite una
**proiezione**, dove l'entità non esiste più. Una funzione che accettasse solo l'entità
costringerebbe il consumatore a riscrivere il fallback dentro la proiezione, e la duplicazione
sarebbe **imposta dal design** invece che prevenuta. Una forma di comodo che accetta l'entità MAY
esistere in aggiunta, purché **deleghi** e non reimplementi.

(Precedentemente: il requirement diceva che la regola «MUST essere implementata in un unico punto
ed esposta come campo derivato in lettura, mai duplicata nei client». L'unico punto era un
resolver GraphQL, quindi inaccessibile a un controller REST e a una proiezione SQL.)

#### Scenario: Prezzo di vetrina valorizzato

- GIVEN prezzo di listino `3.80` e prezzo di vetrina `4.50`
- WHEN si valuta il fallback condiviso
- THEN vale `4.50`

#### Scenario: Prezzo di vetrina assente

- GIVEN prezzo di listino `3.80` e prezzo di vetrina `null`
- WHEN si valuta il fallback condiviso
- THEN vale `3.80`

#### Scenario: 🔴 Prezzo di vetrina pari a zero

- GIVEN prezzo di listino `3.80` e prezzo di vetrina `0`
- WHEN si valuta il fallback condiviso
- THEN vale `0`
- AND non vale `3.80`

#### Scenario: 🔴 Verifica per mutazione del caso omaggio

- GIVEN i test della regola condivisa verdi
- WHEN si riscrive il fallback trattando come assente anche il valore zero
- THEN lo scenario del prezzo pari a zero fallisce
- AND gli scenari del prezzo assente e del prezzo positivo restano verdi

#### Scenario: La forma che accetta i due valori è usabile dopo una proiezione

- GIVEN una lettura che ha proiettato dal database i soli due prezzi, senza l'entità
- WHEN si applica il fallback condiviso
- THEN il risultato è quello atteso senza che il consumatore riscriva la regola

#### Scenario: La forma di comodo delega

- GIVEN un prodotto in memoria
- WHEN si valuta il fallback nella forma che accetta l'entità e in quella che accetta i due valori
- THEN i due risultati coincidono in tutti i casi della matrice

## ADDED Requirements

### Requirement: 🔴 Una sola espressione delle due regole in tutto il repository

Al termine della change il repository MUST contenere **una sola** congiunzione fra lo stato di
attività in cassa e la visibilità sul sito, e **un solo** fallback fra prezzo di vetrina e prezzo
di listino, entrambi nel punto condiviso. Ogni altro consumatore MUST chiamarli.

Ciò MUST includere la riscrittura della copia **già esistente** nel punto in cui si elencano i
prodotti pubblicati che usano un media in via di eliminazione: senza quella riscrittura il
criterio sarebbe rosso il primo giorno, perché la seconda copia è nel codice prima ancora che
questa change cominci.

L'unicità MUST essere verificata da un test che **scansiona i sorgenti applicativi** — esclusi i
file generati e il progetto di test — e MUST fallire nominando il file di troppo. La verifica
strutturale MUST affiancarsi a quella comportamentale, non sostituirla: la scansione dice che la
regola è **una sola**, la matrice dice che è **giusta**.

**Verifica per mutazione**: reintrodurre la congiunzione in un secondo file MUST far fallire il
test; rimuoverla MUST farlo tornare verde.

#### Scenario: La congiunzione compare in un file solo

- GIVEN i sorgenti applicativi del backend dopo la change
- WHEN si cercano le occorrenze della congiunzione fra attività in cassa e visibilità sul sito
- THEN l'unico file che la contiene è quello della regola condivisa

#### Scenario: Il fallback del prezzo compare in un file solo

- GIVEN i sorgenti applicativi del backend dopo la change
- WHEN si cercano le occorrenze del fallback fra prezzo di vetrina e prezzo di listino
- THEN l'unico file che lo contiene è quello della regola condivisa

#### Scenario: 🔴 Verifica per mutazione dell'unicità

- GIVEN il test di unicità verde
- WHEN si aggiunge una seconda scrittura della congiunzione in un qualunque altro file applicativo
- THEN il test fallisce indicando il file aggiunto
- AND rimuovendo quella scrittura il test torna verde

#### Scenario: La copia preesistente è stata riscritta

- GIVEN il punto che elenca i prodotti pubblicati che usano un media in via di eliminazione
- WHEN se ne ispeziona il filtro
- THEN applica la regola condivisa invece di riscrivere la congiunzione

#### Scenario: Il comportamento del punto riscritto è invariato

- GIVEN un media assegnato a un prodotto pubblicato e a uno non pubblicato
- WHEN si tenta di eliminare il media
- THEN il messaggio nomina i prodotti esattamente come prima della change

#### Scenario: I file generati non producono falsi positivi

- GIVEN il test di unicità
- WHEN nel repository sono presenti migrazioni generate e file compilati che contengono i nomi
  delle colonne
- THEN il test li esclude dalla scansione e resta verde
