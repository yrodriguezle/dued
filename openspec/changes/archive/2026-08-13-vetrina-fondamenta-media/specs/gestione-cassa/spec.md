# Delta for Gestione Cassa

**Change**: vetrina-fondamenta-media
**Date**: 2026-08-11
**Status**: Draft

> **Nota sullo schema GraphQL** — questa delta tocca il ramo `vendite` in **un solo punto**,
> additivo e retrocompatibile:
>
> 1. `ProdottoType` guadagna campi in sola lettura (dichiarati nella spec
>    `vetrina-prodotti`): nessun campo esistente cambia nome o tipo.
>
> Tutto il resto della vetrina vive **fuori** dal ramo `vendite`: la lettura dell'anagrafica
> per l'amministrazione è una nuova `connection { prodotti }`, le scritture sono nel nuovo
> ramo root `vetrina`. Nessun file di `backend/GraphQL/Vendite/` cambia comportamento.
>
> `VenditeQueries` (`prodotti`, `prodotto`, `categorieProdotto`), `ProdottoInput` /
> `ProdottoInputType` e la mutation `mutateProdotto` restano **letteralmente invariati**:
> è il punto centrale della change.
>
> **Comportamento attuale verificato** (`backend/GraphQL/Vendite/`):
> - `VenditeQueries.cs:37` — `IQueryable<Prodotto> query = dbContext.Prodotti.Where(p => p.Attivo);`
>   la query `prodotti` non restituisce i prodotti disattivati.
> - `VenditeQueries.cs:61-69` — la query `prodotto(id)` **non** filtra su `Attivo`: un
>   prodotto disattivato è già leggibile per id.
> - `VenditeQueries.cs:125` — `categorieProdotto` filtra `p.Attivo && p.Categoria != null`.
> - `VenditeMutations.cs:294-353` — `UpsertProdottoAsync` assegna esplicitamente nove campi,
>   uno per riga: non è una patch selettiva.
> - `VenditeQueries.cs:21` e `VenditeMutations.cs:25` — `this.Authorize()` a livello di tipo
>   (Fase 0 già applicata): tutto il ramo richiede un utente autenticato.

## MODIFIED Requirements

### Requirement: Mutation mutateProdotto

Il sistema DEVE esporre una mutation GraphQL `mutateProdotto` (modulo Vendite) per creare o
aggiornare un prodotto, inclusa l'aliquota IVA. La mutation DEVE essere protetta da
autorizzazione, DEVE applicare la validazione delle aliquote ammesse e DEVE restituire il
prodotto risultante come `ProdottoType`.

`mutateProdotto` MUST restare il canale di amministrazione dei **soli dati contabili** del
prodotto. Il suo tipo di input `ProdottoInput` MUST NOT accettare alcun campo di vetrina, e
il percorso di upsert MUST NOT assegnare, azzerare o normalizzare alcun campo di vetrina, né
in creazione né in aggiornamento. Il motivo è strutturale e non stilistico: l'upsert assegna
**esplicitamente ogni campo del proprio input** a ogni invocazione, quindi un campo di
vetrina che entrasse in `ProdottoInput` verrebbe azzerato in massa dal primo salvataggio
della cassa che non lo invia.

L'amministrazione dei campi di vetrina passa da una mutation separata
(`mutateProdottoVetrina`), collocata nel **nuovo ramo root `vetrina`** e non nel ramo
`vendite` (spec `vetrina-prodotti`), che a sua volta MUST NOT toccare alcun campo contabile.

(Precedentemente: il requirement diceva soltanto che «la gestione prodotti da interfaccia
utente NON è in scope, la mutation è l'unico punto di amministrazione». Con questa change
nasce la prima interfaccia prodotti del progetto — la griglia di vetrina — che però
amministra **solo** i campi di vetrina e non invoca mai `mutateProdotto`. Il resto del
requirement, schema di input compreso, è invariato.)

Schema GraphQL (invariato rispetto a oggi):

```graphql
type VenditeMutation {
  mutateProdotto(prodotto: ProdottoInput!): Prodotto
}

input ProdottoInput {
  prodottoId: Int        # assente/null = creazione
  codice: String!
  nome: String!
  descrizione: String
  prezzo: Decimal!
  categoria: String
  unitaDiMisura: String
  attivo: Boolean
  aliquotaIva: Decimal   # default 22 se omessa in creazione
}
```

#### Scenario: Creazione e aggiornamento restano invariati

- GIVEN un client autenticato
- WHEN invia `mutateProdotto` per creare o aggiornare un prodotto con i soli campi contabili
- THEN il comportamento (validazioni, unicità del codice, aliquote ammesse, prezzo non negativo, valore restituito) è identico a prima della change

#### Scenario: L'input della cassa non accetta campi di vetrina

- GIVEN lo schema GraphQL della change applicata
- WHEN un client invia `mutateProdotto` includendo un campo di vetrina (es. `visibileSulSito`) dentro `prodotto`
- THEN la richiesta viene rifiutata dalla validazione dello schema
- AND nessun prodotto viene creato o modificato

#### Scenario: Un salvataggio della cassa non azzera la vetrina

- GIVEN un prodotto con tutti i campi di vetrina valorizzati
- WHEN la cassa invoca `mutateProdotto` con un payload di soli campi contabili
- THEN i campi contabili risultano aggiornati
- AND ognuno dei dieci campi di vetrina conserva esattamente il valore precedente

## ADDED Requirements

### Requirement: Le query del ramo vendite restano invariate

Le query `prodotti`, `prodotto(id)` e `categorieProdotto` MUST restare invariate: stessa
firma, stessi argomenti, stesso comportamento. In particolare la query `prodotti` MUST NOT
guadagnare alcun argomento — nemmeno opzionale con default retrocompatibile — e MUST
continuare a restituire i soli prodotti con `Attivo = true`, con la stessa paginazione per
limite e scostamento.

Il fabbisogno dell'amministrazione della vetrina — vedere anche i prodotti disattivati per
poterne correggere lo stato — MUST essere servito da una **query separata** nel ramo
`connection` (spec `vetrina-prodotti`), non da un argomento sulla query della cassa.

La motivazione è tecnica oltre che di confine, ed è vincolante: la griglia di
amministrazione consuma le connection tramite l'hook generico del progetto, che genera a
runtime una query con esattamente `where`, `pageSize`, `orderBy` e `cursor`; un argomento
tipizzato in più **non sarebbe raggiungibile** senza rinunciare a quell'hook. E il filtro
`where` viaggia attraverso una traduzione che gestisce **solo confronti LIKE su stringhe**:
un filtro booleano non è nemmeno esprimibile per quella via. Un argomento server-side sui
non attivi sarebbe quindi codice aggiunto al ramo cassa e mai invocato.

#### Scenario: Comportamento della query prodotti invariato

- GIVEN un listino con 5 prodotti attivi e 2 disattivati
- WHEN un client invoca `prodotti`
- THEN la risposta contiene i soli 5 prodotti attivi, esattamente come prima della change

#### Scenario: Nessun nuovo argomento sulla query della cassa

- GIVEN lo schema GraphQL della change applicata
- WHEN si ispezionano gli argomenti della query `prodotti` del ramo `vendite`
- THEN sono esattamente `ricerca`, `categoria`, `limite` e `scostamento`
- AND non esiste alcun argomento relativo ai prodotti non attivi

#### Scenario: prodotto(id) continua a leggere anche i disattivati

- GIVEN un prodotto con `Attivo = false`
- WHEN un client invoca `prodotto(id)` con il suo id
- THEN il prodotto viene restituito, esattamente come prima della change

#### Scenario: categorieProdotto non cambia

- GIVEN un prodotto disattivato con una categoria che nessun prodotto attivo possiede
- WHEN un client invoca `categorieProdotto`
- THEN quella categoria non compare nel risultato, esattamente come prima della change
