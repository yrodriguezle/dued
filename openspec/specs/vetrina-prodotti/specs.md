# Vetrina Prodotti Specification

**Domain**: vetrina-prodotti
**Status**: Active
**Ultimo aggiornamento**: 2026-08-13

Change incorporate in questa spec:

| Change | Archiviata il | Contenuto |
|--------|---------------|-----------|
| vetrina-fondamenta-media | 2026-08-13 | Spec iniziale del dominio: campi vetrina sul prodotto, confine con la cassa nelle due direzioni, pubblicazione calcolata in lettura, prezzo di vetrina con fallback, associazione dell'immagine, griglia di amministrazione |
| vetrina-api-pubblica | 2026-08-13 | Le due regole (pubblicazione e fallback del prezzo) diventano un'espressione **condivisa e richiamabile**, usabile in SQL e in memoria con una sola scrittura; unicità verificata da un test che scansiona i sorgenti. Comportamento e contratto GraphQL invariati |

## Purpose

Definire i dati di vetrina del listino — cosa di un prodotto è destinato a un **cliente** e
non a un **cassiere** — e soprattutto il **confine** tra questi dati e quelli contabili
della cassa.

Il confine è la ragione per cui questo dominio esiste separato: `UpsertProdottoAsync`
([`backend/GraphQL/Vendite/VenditeMutations.cs:294-353`](../../../backend/GraphQL/Vendite/VenditeMutations.cs))
non applica una patch selettiva, assegna **esplicitamente ogni campo** a ogni invocazione.
Se i campi vetrina entrassero in `ProdottoInput`, il primo upsert della cassa che non li
invia li azzererebbe tutti in una volta — nomi, descrizioni, immagini e flag di
pubblicazione — e il sito si svuoterebbe senza che nessuno abbia toccato il sito.

**Fuori scope in questa fase**: l'API pubblica `/api/public/*`, il sito Astro e qualunque
esposizione a visitatori anonimi (Fase 2). Qui i campi vetrina esistono, sono amministrabili
e sono leggibili dall'app autenticata, ma **nessun visitatore anonimo li vede**.

**Stato verificato del codice prima della change**: `backend/Models/Prodotto.cs` ha 9 campi,
tutti contabili, e nessun campo vetrina; `ProdottoType` espone esattamente quei campi;
`ProdottoInput` ne accetta 8; la query `prodotti` filtra `.Where(p => p.Attivo)`
([`VenditeQueries.cs:37`](../../../backend/GraphQL/Vendite/VenditeQueries.cs)) mentre la
query `prodotto(id)` non filtra; nel frontend **non esiste alcuna pagina prodotti** né
alcuna operazione GraphQL su `prodotti`/`mutateProdotto`.

---

## Modifiche allo schema GraphQL

**Namespace delle scritture: il nuovo ramo root `vetrina`**, non `vendite`. Il ramo dice al
lettore in che territorio si trova — la domanda "sto scrivendo codice della cassa?" torna ad
avere una risposta che si legge dalla query — e accoglierà le mutation delle fasi
successive. Come ogni ramo root, MUST richiedere l'autenticazione a livello di tipo
(spec `sicurezza`).

**Namespace delle letture per l'amministrazione: il ramo `connection`**, con una nuova
`connection { prodotti }`. `VenditeQueries.prodotti` resta invariata (spec `gestione-cassa`).

**Output type `Prodotto` (`ProdottoType`) — campi aggiunti in sola lettura:**

```graphql
type Prodotto {
  # ... campi esistenti invariati: prodottoId, codice, nome, descrizione, prezzo,
  #     categoria, unitaDiMisura, attivo, aliquotaIva, createdAt, updatedAt

  visibileSulSito: Boolean!
  nomeVetrina: String
  descrizioneVetrina: String
  categoriaVetrina: String
  prezzoVetrina: Decimal
  ordinamentoVetrina: Int!
  allergeni: String
  novita: Boolean!
  consigliato: Boolean!
  immagineId: Int
  immagine: MediaAsset            # risolto dalla FK, null se non assegnata

  # Campi derivati, mai persistiti: una sola definizione condivisa da admin e Fase 2
  pubblicatoSulSito: Boolean!      # attivo && visibileSulSito
  prezzoEffettivoVetrina: Decimal! # prezzoVetrina se non null, altrimenti prezzo
}
```

**Nuova query di lettura, nel ramo `connection` (stessa forma di `fornitori`):**

```graphql
type ConnectionQuery {
  # ... connection esistenti invariate
  prodotti(first: Int, after: String, cursor: Int, where: String, orderBy: String): ProdottoConnection
}
```

A differenza di `vendite { prodotti }`, questa connection è **l'anagrafica** e non il listino
operativo: restituisce i prodotti **indipendentemente da `Attivo`**, come le connection di
utenti e ruoli restituiscono anche i disabilitati.

**Nuova mutation, separata da `mutateProdotto`:**

```graphql
type VetrinaMutation {
  mutateProdottoVetrina(prodottoId: Int!, input: ProdottoVetrinaInput!): Prodotto
  # ... le mutation sui media, spec media-assets
}

input ProdottoVetrinaInput {      # esattamente 10 campi. Zero campi cassa.
  visibileSulSito: Boolean!
  nomeVetrina: String
  descrizioneVetrina: String
  categoriaVetrina: String
  prezzoVetrina: Decimal
  ordinamentoVetrina: Int!
  allergeni: String
  novita: Boolean!
  consigliato: Boolean!
  immagineId: Int
}
```

I quattro campi non-null dell'input riflettono i quattro campi non-nullable dell'entità: la
mutation scrive l'**intero** perimetro vetrina a ogni invocazione, coerentemente con la
persistenza per riga della griglia, e non c'è alcuna combinazione di input in cui il
significato di "campo omesso" debba essere indovinato.

**Invariati per contratto**: `ProdottoInput` / `ProdottoInputType`, la mutation
`mutateProdotto` e l'intero ramo `vendite`. `ProdottoVetrinaInput` MUST NOT contenere alcun
campo contabile.

---

## Dominio: Modello dei campi vetrina

### Requirement: Campi vetrina sul prodotto, invisibili per default

Il sistema MUST persistere sull'entità `Prodotto` dieci campi di vetrina:
`VisibileSulSito`, `NomeVetrina`, `DescrizioneVetrina`, `CategoriaVetrina`, `PrezzoVetrina`,
`OrdinamentoVetrina`, `Allergeni`, `Novita`, `Consigliato`, `ImmagineId`.

`VisibileSulSito` MUST essere non-nullable con default **`false`**: un prodotto MUST NOT
finire sul sito per il solo fatto di esistere. `Novita` e `Consigliato` MUST essere
non-nullable con default `false`. `OrdinamentoVetrina` MUST essere non-nullable con default
`0`. `PrezzoVetrina` MUST essere nullable, dove `null` significa "nessun prezzo di vetrina
proprio". `ImmagineId` MUST essere una foreign key nullable verso `MediaAsset` con politica
di cancellazione restrittiva.

La migrazione MUST essere additiva e MUST NOT modificare alcun dato contabile esistente.

#### Scenario: Migrazione su listino già popolato

- GIVEN un database con prodotti esistenti e nessun campo vetrina
- WHEN viene applicata la migrazione che aggiunge i campi vetrina
- THEN ogni prodotto preesistente ha `VisibileSulSito = false`, `Novita = false`, `Consigliato = false`, `OrdinamentoVetrina = 0`
- AND `PrezzoVetrina` e `ImmagineId` sono `null`
- AND `Codice`, `Nome`, `Prezzo`, `Categoria`, `UnitaDiMisura`, `Attivo` e `AliquotaIva` di ogni prodotto sono invariati

#### Scenario: Nuovo prodotto creato dalla cassa nasce invisibile

- GIVEN il sistema migrato
- WHEN un prodotto viene creato tramite `mutateProdotto`
- THEN il prodotto ha `VisibileSulSito = false`
- AND tutti gli altri campi vetrina hanno i rispettivi default

### Requirement: Allergeni come testo libero con round-trip stabile

In questa fase `Allergeni` MUST essere **testo libero** di lunghezza massima 255 caratteri,
scritto e riletto senza alcuna interpretazione: il sistema MUST NOT imporre una tassonomia,
MUST NOT normalizzare separatori e MUST NOT riordinare il contenuto. Una tassonomia
controllata dei 14 allergeni UE è una decisione della Fase 2, quando si saprà come vanno resi
sul sito; la migrazione da testo libero a lista controllata sarà additiva.

L'assenza di allergeni MUST avere una sola rappresentazione: `null`. Una stringa vuota o
composta di soli spazi MUST essere persistita come `null`, così che nessun consumatore debba
distinguere fra più forme di vuoto.

#### Scenario: Round-trip del testo degli allergeni

- GIVEN un prodotto senza allergeni
- WHEN un amministratore imposta `allergeni` a `"Glutine, latte, frutta a guscio"` tramite `mutateProdottoVetrina` e rilegge il prodotto
- THEN il valore letto è esattamente `"Glutine, latte, frutta a guscio"`, carattere per carattere

#### Scenario: Nessun allergene ha una sola rappresentazione

- GIVEN un prodotto con allergeni valorizzati
- WHEN un amministratore invia una stringa vuota o composta di soli spazi
- THEN il valore persistito è `null`
- AND la rilettura restituisce `null`

#### Scenario: Nessuna validazione di tassonomia

- GIVEN un prodotto qualsiasi
- WHEN un amministratore imposta `allergeni` a un testo che non corrisponde ad alcun allergene UE riconosciuto
- THEN la mutation va a buon fine e il testo viene persistito così com'è

### Requirement: Categoria e ordinamento di vetrina indipendenti dalla cassa

`CategoriaVetrina` MUST essere indipendente da `Categoria`: modificare l'una MUST NOT
modificare l'altra, e la query `categorieProdotto` — che elenca le categorie della cassa —
MUST restare invariata nel comportamento e MUST NOT includere le categorie di vetrina.

L'elenco dei prodotti di vetrina MUST essere ordinabile per `OrdinamentoVetrina` con un
criterio deterministico di parità, così che a parità di dati due letture consecutive
restituiscano lo stesso ordine.

#### Scenario: Categoria di vetrina non contamina la cassa

- GIVEN un prodotto con `Categoria = "BEVANDE"`
- WHEN un amministratore imposta `CategoriaVetrina = "Cocktail della casa"`
- THEN `Categoria` resta `"BEVANDE"`
- AND `categorieProdotto` non contiene `"Cocktail della casa"`

#### Scenario: Ordine di vetrina stabile a parità di ordinamento

- GIVEN due prodotti visibili con lo stesso `OrdinamentoVetrina`
- WHEN l'elenco di vetrina viene letto due volte senza modifiche intermedie
- THEN i due prodotti compaiono nello stesso ordine in entrambe le letture

---

## Dominio: Isolamento dalla cassa (il confine)

### Requirement: mutateProdotto non tocca mai alcun campo vetrina

La mutation `mutateProdotto` e il tipo `ProdottoInput` MUST restare invariati: `ProdottoInput`
MUST NOT accettare alcun campo vetrina e il percorso di upsert dei prodotti MUST NOT
assegnare, azzerare o normalizzare alcun campo vetrina, né in creazione né in aggiornamento.

Un'invocazione di `mutateProdotto` con un payload di sola cassa su un prodotto con la vetrina
completamente valorizzata MUST lasciare **tutti e dieci** i campi vetrina byte per byte come
erano.

#### Scenario: Upsert della cassa non azzera la vetrina

- GIVEN un prodotto con `VisibileSulSito = true`, `NomeVetrina`, `DescrizioneVetrina`, `CategoriaVetrina`, `PrezzoVetrina`, `OrdinamentoVetrina`, `Allergeni`, `Novita`, `Consigliato` e `ImmagineId` tutti valorizzati
- WHEN viene invocata `mutateProdotto` con un payload che contiene solo i campi contabili (codice, nome, descrizione, prezzo, categoria, unità di misura, attivo, aliquota IVA)
- THEN dopo il salvataggio tutti e dieci i campi vetrina hanno esattamente i valori che avevano prima
- AND i campi contabili risultano aggiornati con i valori inviati

#### Scenario: Lo schema di input della cassa non espone i campi vetrina

- GIVEN lo schema GraphQL della change applicata
- WHEN si ispeziona il tipo di input di `mutateProdotto`
- THEN non contiene alcuno dei dieci campi vetrina
- AND una richiesta che tenta di passarne uno viene rifiutata dalla validazione dello schema

### Requirement: mutateProdottoVetrina non tocca mai alcun campo della cassa

La mutation `mutateProdottoVetrina` MUST agire su un prodotto **esistente** identificato da
`prodottoId` e MUST scrivere esclusivamente i dieci campi vetrina (più `UpdatedAt`).
MUST NOT modificare `Codice`, `Nome`, `Descrizione`, `Prezzo`, `Categoria`, `UnitaDiMisura`,
`Attivo` e `AliquotaIva`, e il suo tipo di input MUST NOT contenerli affatto.

La mutation MUST NOT creare prodotti: un `prodottoId` inesistente MUST produrre un errore
esplicito senza alcuna scrittura.

#### Scenario: Scrittura completa della vetrina non muove la cassa

- GIVEN un prodotto con valori contabili noti (`Codice`, `Nome`, `Descrizione`, `Prezzo`, `Categoria`, `UnitaDiMisura`, `Attivo`, `AliquotaIva`)
- WHEN un amministratore invoca `mutateProdottoVetrina` valorizzando tutti e dieci i campi vetrina
- THEN tutti i campi contabili hanno esattamente i valori che avevano prima
- AND i campi vetrina risultano aggiornati

#### Scenario: Lo schema di input della vetrina non espone i campi della cassa

- GIVEN lo schema GraphQL della change applicata
- WHEN si ispeziona `ProdottoVetrinaInput`
- THEN non contiene `codice`, `nome`, `descrizione`, `prezzo`, `categoria`, `unitaDiMisura`, `attivo` né `aliquotaIva`
- AND una richiesta che tenta di passarne uno viene rifiutata dalla validazione dello schema

#### Scenario: Prodotto inesistente

- GIVEN un `prodottoId` che non corrisponde ad alcun prodotto
- WHEN viene invocata `mutateProdottoVetrina` con quell'id
- THEN la mutation fallisce con un errore esplicito
- AND nessun prodotto viene creato o modificato

#### Scenario: Scritture alternate dai due canali

- GIVEN un prodotto con vetrina e cassa entrambe valorizzate
- WHEN si alternano una `mutateProdotto` di sola cassa e una `mutateProdottoVetrina` di sola vetrina, ripetutamente
- THEN al termine i campi contabili riflettono l'ultima `mutateProdotto`
- AND i campi vetrina riflettono l'ultima `mutateProdottoVetrina`
- AND nessuno dei due gruppi risulta mai azzerato dall'altro

---

## Dominio: Attivo (cassa) e VisibileSulSito (vetrina)

> `Attivo` è un flag della cassa: un prodotto non attivo esce dal listino operativo.
> `VisibileSulSito` è un flag della vetrina. Sono due decisioni diverse prese da persone
> diverse in momenti diversi, e questa sezione definisce come convivono senza che esista
> alcuno stato in cui un prodotto risulti pubblicato senza che nessuno possa più vederlo né
> correggerlo.

### Requirement: La pubblicazione è la congiunzione, calcolata in lettura e mai persistita

`VisibileSulSito` è un'**intenzione** ("voglio questo prodotto sul sito"), `Attivo` è uno
**stato** ("questo prodotto è in vendita alla cassa"). Sono proprietà di due domini diversi:
l'una MUST NOT scrivere sull'altra e l'una MUST NOT vincolare la scrittura dell'altra.

Il sistema MUST definire la pubblicazione effettiva di un prodotto come la **congiunzione**
`Attivo && VisibileSulSito`, MUST esporla come unico campo derivato di sola lettura
(`pubblicatoSulSito`) e MUST NOT persisterla in alcuna colonna. Amministrazione e consumatori
MUST leggere quel campo invece di riderivare la regola ciascuno per conto proprio:
è la definizione su cui l'API pubblica filtra, non `VisibileSulSito` da sola.

La congiunzione MUST esistere come **espressione condivisa e richiamabile**, collocata in un
punto del backend che non dipende né da GraphQL né dal database, e MUST essere utilizzabile in
due modi con **una sola scrittura**:

1. come **filtro tradotto in SQL**, applicabile a una query di prodotti, così che una richiesta
   anonima non materializzi l'intero listino per scartarne la maggior parte;
2. come **valutazione in memoria** su un prodotto già caricato, per i resolver.

La forma (2) MUST derivare dalla forma (1) — la stessa espressione, compilata — e MUST NOT
essere una seconda scrittura della regola.

Il sistema MUST NOT usare un metodo di estensione sull'entità come forma canonica della regola:
non sarebbe traducibile in SQL, e si finirebbe con l'estensione per la memoria e una condizione
scritta a mano per il database — cioè con le due copie che il punto condiviso esiste per
eliminare.

(Precedentemente, prima di `vetrina-api-pubblica`: la regola era esposta come campo derivato e i
consumatori futuri dovevano leggerla invece di riderivarla, ma restava implementata **dentro un
resolver GraphQL**, quindi non richiamabile — un controller REST poteva solo riscriverla. Il
comportamento non è cambiato, è cambiata la **collocazione**: i resolver ora la chiamano invece
di implementarla, e le descrizioni dei due campi GraphQL restano identiche carattere per
carattere.)

Di conseguenza `mutateProdottoVetrina` MUST accettare **qualunque** valore di
`VisibileSulSito` a prescindere da `Attivo`, e `mutateProdotto` MUST poter portare `Attivo`
a `false` senza alcun effetto sui campi vetrina.

La combinazione `VisibileSulSito = true` con `Attivo = false` MUST essere uno stato
**ammesso e innocuo**: `pubblicatoSulSito` vale `false`, quindi il prodotto semplicemente non
viene pubblicato, e MUST restare visibile e correggibile nella griglia di amministrazione
(requirement seguente). È la combinazione che permette di preparare la scheda di vetrina di
un prodotto stagionale **prima** di attivarlo in cassa, e quella in cui si trova ogni
prodotto pubblicato che la cassa disattiva.

#### Scenario: Marcare visibile un prodotto non attivo è accettato e non pubblica nulla

- GIVEN un prodotto con `Attivo = false` e `VisibileSulSito = false`
- WHEN un amministratore invoca `mutateProdottoVetrina` con `visibileSulSito = true`
- THEN la mutation va a buon fine e `VisibileSulSito` diventa `true`
- AND `pubblicatoSulSito` vale `false`
- AND nessun campo della cassa viene modificato

#### Scenario: Scheda preparata prima dell'attivazione in cassa

- GIVEN un prodotto stagionale con `Attivo = false`, la scheda di vetrina completa e `VisibileSulSito = true`
- WHEN la cassa lo attiva portando `attivo` a `true` tramite `mutateProdotto`
- THEN `pubblicatoSulSito` vale `true`
- AND non è necessaria alcuna ri-edizione dei campi vetrina

#### Scenario: Disattivazione in cassa di un prodotto pubblicato

- GIVEN un prodotto con `Attivo = true` e `VisibileSulSito = true`
- WHEN la cassa invoca `mutateProdotto` portando `attivo` a `false`
- THEN `VisibileSulSito` resta `true` (la cassa non tocca i campi vetrina)
- AND `pubblicatoSulSito` vale `false`

#### Scenario: Riattivazione in cassa ripristina la pubblicazione

- GIVEN il prodotto dello scenario precedente, con `Attivo = false` e `VisibileSulSito = true`
- WHEN la cassa lo riporta ad `Attivo = true`
- THEN `pubblicatoSulSito` torna `true`
- AND non è necessaria alcuna ri-edizione dei campi vetrina

#### Scenario: Depubblicazione sempre possibile

- GIVEN un prodotto con `Attivo = false` e `VisibileSulSito = true`
- WHEN un amministratore invoca `mutateProdottoVetrina` con `visibileSulSito = false`
- THEN la mutation va a buon fine
- AND `VisibileSulSito` diventa `false`

#### Scenario: La pubblicazione non ha uno stato proprio a database

- GIVEN lo schema del database dopo la migrazione
- WHEN si ispezionano le colonne della tabella dei prodotti
- THEN non esiste alcuna colonna corrispondente a `pubblicatoSulSito`
- AND non esiste alcuno stato del database in cui `pubblicatoSulSito` differisca da `Attivo && VisibileSulSito`

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
- WHEN si confrontano i valori letti prima e dopo lo spostamento della regola nel punto condiviso
- THEN sono identici per ogni prodotto

#### Scenario: Le descrizioni dello schema restano identiche

- GIVEN lo schema GraphQL prima e dopo lo spostamento della regola
- WHEN si confrontano le descrizioni di `pubblicatoSulSito` e `prezzoEffettivoVetrina`
- THEN sono identiche carattere per carattere

### Requirement: L'amministrazione vede e corregge anche i prodotti disattivati

La `connection { prodotti }` usata dalla griglia di vetrina MUST restituire i prodotti
**indipendentemente da `Attivo`**, così che un prodotto disattivato in cassa e rimasto
`VisibileSulSito = true` non scompaia dall'unico posto da cui lo si può correggere.

La divergenza fra intenzione e stato (`VisibileSulSito = true` con `Attivo = false`) MUST
essere segnalata visivamente sulla riga e MUST essere individuabile senza scorrere l'intero
listino. Il filtro sui prodotti non attivi MUST essere applicato **lato client** sui dati già
in griglia, senza alcun argomento aggiuntivo sulla query né alcun round trip verso il
backend.

Poiché lo stato divergente è ammesso (requirement precedente), la griglia MUST permettere di
modificare **qualunque** campo vetrina di un prodotto in quello stato, non solo
`VisibileSulSito`: la persistenza per riga reinvia l'intero perimetro vetrina a ogni
modifica di cella, e un rifiuto legato ad `Attivo` renderebbe quelle righe non modificabili
proprio dove la correzione serve.

I consumatori della cassa MUST NOT essere toccati da questa esigenza: la query `prodotti`
del ramo `vendite` resta invariata (vedi la delta su `gestione-cassa`).

#### Scenario: L'anagrafica restituisce anche i prodotti non attivi

- GIVEN un listino con 5 prodotti attivi e 2 disattivati
- WHEN la griglia di vetrina legge `connection { prodotti }`
- THEN la risposta contiene tutti e 7 i prodotti

#### Scenario: Prodotto disattivato ma marcato visibile resta amministrabile

- GIVEN un prodotto con `Attivo = false` e `VisibileSulSito = true`
- WHEN un amministratore apre la griglia della vetrina
- THEN il prodotto compare nell'elenco
- AND la riga segnala che è visibile sul sito ma non attivo in cassa, e che quindi non verrà pubblicato

#### Scenario: Filtro sui non attivi senza round trip

- GIVEN la griglia della vetrina con il listino già caricato
- WHEN l'amministratore attiva il filtro sui prodotti non attivi
- THEN l'elenco si restringe ai soli prodotti con `Attivo = false`
- AND nessuna nuova richiesta viene inviata al backend

#### Scenario: Modifica di un altro campo vetrina su un prodotto non attivo e visibile

- GIVEN un prodotto con `Attivo = false` e `VisibileSulSito = true`
- WHEN l'amministratore ne modifica `Allergeni` dalla griglia, che reinvia l'intero perimetro vetrina compreso `visibileSulSito = true`
- THEN la modifica viene accettata
- AND `VisibileSulSito` resta `true`

#### Scenario: Correzione della divergenza dalla griglia

- GIVEN la griglia della vetrina che mostra un prodotto visibile ma non attivo
- WHEN l'amministratore ne azzera `VisibileSulSito` dalla griglia
- THEN la modifica viene accettata
- AND la riga non è più segnalata come divergente

#### Scenario: La cassa non vede i disattivati

- GIVEN un prodotto con `Attivo = false`
- WHEN un consumatore invoca la query `prodotti` del ramo `vendite`
- THEN il prodotto non compare nel risultato, esattamente come prima della change

---

## Dominio: Prezzo mostrato in vetrina

### Requirement: PrezzoVetrina se valorizzato, altrimenti Prezzo

Il prezzo da mostrare in vetrina MUST essere `PrezzoVetrina` quando questo è **non null**,
e `Prezzo` in tutti gli altri casi. La regola MUST essere implementata in un unico punto ed
esposta come campo derivato in lettura, mai duplicata nei client.

Quel punto MUST essere lo stesso punto condiviso della regola di pubblicazione, e il fallback
MUST essere esposto in una forma che accetti **i due valori** (prezzo di vetrina e prezzo di
listino) e non soltanto l'entità intera. La ragione della firma è vincolante e non stilistica:
la lettura pubblica avviene tramite una **proiezione**, dove l'entità non esiste più. Una
funzione che accettasse solo l'entità costringerebbe il consumatore a riscrivere il fallback
dentro la proiezione, e la duplicazione sarebbe **imposta dal design** invece che prevenuta.
Una forma di comodo che accetta l'entità MAY esistere in aggiunta, purché **deleghi** e non
reimplementi.

(Precedentemente, prima di `vetrina-api-pubblica`: l'unico punto era un resolver GraphQL,
quindi inaccessibile a un controller REST e a una proiezione SQL.)

Il fallback MUST essere **dinamico**, valutato a ogni lettura: il sistema MUST NOT copiare
`Prezzo` dentro `PrezzoVetrina` al momento della scrittura, altrimenti un aggiornamento di
listino dalla cassa non si rifletterebbe mai in vetrina.

`PrezzoVetrina = 0` MUST essere considerato un valore valorizzato (prezzo zero), non
assenza di valore. Un `PrezzoVetrina` negativo MUST essere rifiutato, coerentemente con la
validazione già applicata a `Prezzo` in `UpsertProdottoAsync`. Azzerare esplicitamente
`PrezzoVetrina` (impostandolo a null) MUST ripristinare il fallback.

#### Scenario: Prezzo di vetrina valorizzato

- GIVEN un prodotto con `Prezzo = 3.80` e `PrezzoVetrina = 4.50`
- WHEN si legge il prezzo effettivo di vetrina
- THEN vale `4.50`

#### Scenario: Prezzo di vetrina assente

- GIVEN un prodotto con `Prezzo = 3.80` e `PrezzoVetrina = null`
- WHEN si legge il prezzo effettivo di vetrina
- THEN vale `3.80`

#### Scenario: Prezzo di vetrina pari a zero

- GIVEN un prodotto con `Prezzo = 3.80` e `PrezzoVetrina = 0.00`
- WHEN si legge il prezzo effettivo di vetrina
- THEN vale `0.00` e non `3.80`

#### Scenario: Aggiornamento di listino si riflette quando non c'è prezzo di vetrina

- GIVEN un prodotto con `Prezzo = 3.80` e `PrezzoVetrina = null`
- WHEN la cassa aggiorna `Prezzo` a `4.00` tramite `mutateProdotto`
- THEN il prezzo effettivo di vetrina vale `4.00` senza alcuna modifica ai campi vetrina

#### Scenario: Aggiornamento di listino non tocca il prezzo di vetrina esplicito

- GIVEN un prodotto con `Prezzo = 3.80` e `PrezzoVetrina = 4.50`
- WHEN la cassa aggiorna `Prezzo` a `4.00`
- THEN il prezzo effettivo di vetrina resta `4.50`

#### Scenario: Prezzo di vetrina negativo rifiutato

- GIVEN un prodotto qualsiasi
- WHEN un amministratore invoca `mutateProdottoVetrina` con `prezzoVetrina = -1.00`
- THEN la mutation fallisce con un errore esplicito
- AND `PrezzoVetrina` resta invariato

#### Scenario: Azzeramento del prezzo di vetrina ripristina il fallback

- GIVEN un prodotto con `Prezzo = 3.80` e `PrezzoVetrina = 4.50`
- WHEN un amministratore imposta esplicitamente `prezzoVetrina` a null
- THEN il prezzo effettivo di vetrina torna a valere `3.80`

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

### Requirement: 🔴 Una sola espressione delle due regole in tutto il repository

Il repository MUST contenere **una sola** congiunzione fra lo stato di attività in cassa e la
visibilità sul sito, e **un solo** fallback fra prezzo di vetrina e prezzo di listino, entrambi
nel punto condiviso. Ogni altro consumatore MUST chiamarli.

Ciò MUST includere il punto in cui si elencano i prodotti pubblicati che usano un media in via
di eliminazione, dove una seconda copia della congiunzione **esisteva già** prima che il punto
condiviso nascesse: senza quella riscrittura il criterio sarebbe rosso il primo giorno.

L'unicità MUST essere verificata da un test che **scansiona i sorgenti applicativi** — esclusi i
file generati e il progetto di test — e MUST fallire nominando il file di troppo. La verifica
strutturale MUST affiancarsi a quella comportamentale, non sostituirla: la scansione dice che la
regola è **una sola**, la matrice dice che è **giusta**.

**Verifica per mutazione**: reintrodurre la congiunzione in un secondo file MUST far fallire il
test; rimuoverla MUST farlo tornare verde.

#### Scenario: La congiunzione compare in un file solo

- GIVEN i sorgenti applicativi del backend
- WHEN si cercano le occorrenze della congiunzione fra attività in cassa e visibilità sul sito
- THEN l'unico file che la contiene è quello della regola condivisa

#### Scenario: Il fallback del prezzo compare in un file solo

- GIVEN i sorgenti applicativi del backend
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
- THEN il messaggio nomina i prodotti esattamente come prima

#### Scenario: I file generati non producono falsi positivi

- GIVEN il test di unicità
- WHEN nel repository sono presenti migrazioni generate e file compilati che contengono i nomi
  delle colonne
- THEN il test li esclude dalla scansione e resta verde

---

## Dominio: Immagine del prodotto

### Requirement: Associazione dell'immagine con integrità garantita

Il sistema MUST permettere di associare a un prodotto al massimo un `MediaAsset` tramite
`ImmagineId`, e MUST esporre in lettura i metadati dell'asset associato. Un `ImmagineId`
che non corrisponde ad alcun asset, o che corrisponde a un asset con `Pubblicato = false`,
MUST produrre un errore esplicito senza alcuna scrittura — un errore applicativo leggibile,
non l'errore del vincolo di integrità del database. Azzerare `ImmagineId` MUST essere sempre
consentito.

Finché un prodotto referenzia un asset, l'eliminazione dell'asset MUST essere rifiutata
(vedi spec `media-assets`).

La pubblicazione di un prodotto **senza** immagine MUST NOT essere bloccata in questa fase —
le regole di resa pubblica appartengono alla Fase 2 — ma l'amministrazione SHOULD segnalare
il prodotto visibile e privo di immagine, per non rimandare la scoperta al giorno del
lancio.

#### Scenario: Associazione di un'immagine esistente

- GIVEN un `MediaAsset` esistente e un prodotto senza immagine
- WHEN un amministratore imposta `immagineId` con l'id di quell'asset
- THEN il prodotto espone in lettura i metadati dell'asset (chiave, dimensioni, testo alternativo, placeholder)

#### Scenario: Immagine inesistente rifiutata

- GIVEN un id di media che non corrisponde ad alcun asset
- WHEN un amministratore lo imposta come `immagineId` di un prodotto
- THEN la mutation fallisce con un errore esplicito
- AND `ImmagineId` resta invariato

#### Scenario: Immagine non pubblicata rifiutata

- GIVEN un `MediaAsset` con `Pubblicato = false`
- WHEN un amministratore lo imposta come `immagineId` di un prodotto
- THEN la mutation fallisce con un errore esplicito che ne indica il motivo
- AND `ImmagineId` resta invariato

#### Scenario: Azzeramento dell'immagine

- GIVEN un prodotto con un'immagine associata
- WHEN un amministratore azzera `immagineId`
- THEN il prodotto risulta senza immagine
- AND l'asset resta presente nella libreria

#### Scenario: Prodotto visibile senza immagine

- GIVEN un prodotto con `Attivo = true` e nessuna immagine associata
- WHEN un amministratore lo imposta `VisibileSulSito = true`
- THEN la mutation va a buon fine
- AND l'amministrazione segnala che il prodotto è visibile ma privo di immagine

---

## Dominio: Amministrazione della vetrina

### Requirement: Griglia di vetrina con i campi della cassa in sola lettura

La pagina di amministrazione della vetrina MUST presentare `Codice`, `Nome`, `Prezzo`,
`Attivo` e `pubblicatoSulSito` in **sola lettura** e MUST rendere modificabili in linea
esclusivamente i campi vetrina, inviando le modifiche a `mutateProdottoVetrina`. La pagina
MUST NOT offrire alcun percorso che invochi `mutateProdotto`, e MUST NOT offrire alcun
percorso di creazione o eliminazione di prodotti: l'anagrafica resta della cassa. L'assenza
di quei percorsi MUST essere strutturale (nessun comando di nuova riga, nessun comando di
eliminazione) e non affidata a un controllo eseguito al salvataggio.

La griglia MUST leggere `connection { prodotti }`, la stessa forma di connection paginata per
cursore che le altre liste del progetto già consumano, esaurendone le pagine fino a disporre
dell'intero listino: filtro, ordinamento e ricerca operano poi lato client, senza un round
trip per battuta di tastiera. Il listino di un bar è dell'ordine delle centinaia di prodotti;
oltre alcune migliaia questa scelta SHOULD essere rivista passando a un caricamento
incrementale, senza che nulla del contratto cambi.

#### Scenario: I campi della cassa non sono editabili dalla griglia

- GIVEN la griglia di amministrazione della vetrina
- WHEN un amministratore prova a modificare `Codice`, `Nome`, `Prezzo`, `Attivo` o `pubblicatoSulSito` di una riga
- THEN la modifica non è possibile e nessuna mutation viene inviata

#### Scenario: Modifica in linea di un campo vetrina

- GIVEN la griglia di amministrazione della vetrina
- WHEN un amministratore modifica `NomeVetrina` di una riga e conferma
- THEN viene invocata `mutateProdottoVetrina` per quel prodotto
- AND nessuna invocazione di `mutateProdotto` viene effettuata

#### Scenario: La griglia non può creare né eliminare prodotti

- GIVEN la griglia di amministrazione della vetrina
- WHEN l'amministratore percorre l'ultima cella dell'ultima riga con il tasto di tabulazione
- THEN nessuna nuova riga viene creata
- AND nell'interfaccia non esiste alcun comando di creazione o eliminazione di un prodotto

#### Scenario: Caricamento del listino oltre la prima pagina

- GIVEN un listino con più prodotti di quanti ne restituisce una singola pagina della connection
- WHEN la griglia carica i dati
- THEN le pagine successive vengono richieste seguendo i cursori finché la connection non è esaurita
- AND nessun prodotto risulta duplicato o saltato tra due pagine consecutive
- AND l'elenco visualizzato contiene l'intero listino, prodotti non attivi compresi
