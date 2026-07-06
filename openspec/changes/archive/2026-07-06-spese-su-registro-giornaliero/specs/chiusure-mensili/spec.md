# Delta for Chiusure Mensili

**Change**: spese-su-registro-giornaliero
**Domain**: chiusure-mensili

Questo delta riporta la chiusura mensile a **pura aggregazione dai registri
giornalieri inclusi**: nessuna spesa vive più appesa alla `ChiusuraMensile`. Tutte le
spese (tracciate e non tracciate) appartengono a un registro giornaliero e i totali della
chiusura derivano esclusivamente dai registri con `Incluso == true`. Vengono rimossi il
codice legacy delle spese fuori registro e i KPI `[NotMapped]` anti-doppio-conteggio
introdotti nella PR #7.

## MODIFIED Requirements

### Requirement: Atomicità della creazione chiusura mensile

`CreaChiusuraAsync` MUST eseguire in una transazione esplicita l'intera sequenza:
creazione della chiusura e associazione dei registri cassa del mese
(`RegistroCassaMensile`). La creazione MUST NOT associare più i pagamenti fornitori del
mese tramite una join dedicata (`PagamentoMensileFornitori`): i pagamenti fornitori sono
raggiungibili esclusivamente attraverso i registri giornalieri inclusi
(`PagamentoFornitore.RegistroCassaId`). Se una qualunque fase fallisce, il sistema MUST
annullare l'intera operazione: nessuna `ChiusuraMensile` e nessun record di link
`RegistroCassaMensile` devono restare persistiti.

(Precedentemente: la sequenza associava anche i pagamenti fornitori del mese tramite la
join `PagamentoMensileFornitori`, che viene rimossa da questa change.)

#### Scenario: Errore a metà creazione — nessun dato parziale

- GIVEN un mese con registri chiusi da associare
- WHEN `CreaChiusuraAsync` fallisce dopo il salvataggio della chiusura ma prima (o durante)
  il salvataggio dei link ai registri
- THEN nel database non esiste alcuna `ChiusuraMensile` per quel mese
- AND non esiste alcun record di link `RegistroCassaMensile` orfano
- AND un successivo tentativo di creazione per lo stesso mese non viene rifiutato come
  "già esistente"

#### Scenario: Creazione riuscita — solo link ai registri

- GIVEN un mese con 2 registri `CLOSED`, ciascuno con propri pagamenti fornitori e spese cassa
- WHEN `CreaChiusuraAsync` completa con successo
- THEN la chiusura esiste in stato `BOZZA` con 2 link registro (`Incluso = true`)
- AND NON esiste alcun record di link `PagamentoMensileFornitori`
- AND i pagamenti fornitori del mese restano raggiungibili solo tramite i registri inclusi
- AND la transazione è stata confermata una sola volta al termine dell'intera sequenza

### Requirement: Chiusura mensile come pura aggregazione dai registri inclusi

I valori di spesa e di ricavo della `ChiusuraMensile` MUST derivare **esclusivamente** dai
registri giornalieri inclusi (`RegistriInclusi` con `Incluso == true`), senza alcuna spesa
o pagamento appeso direttamente alla chiusura. In particolare:

- Le **spese tracciate** (`SpeseTracciate`) MUST valere `Σ SpeseFornitori` dei registri
  inclusi (somma degli importi `PagamentoFornitore` linkati a quei registri).
- Le **spese non tracciate** (`SpeseNonTracciate`) MUST valere `Σ SpeseGiornaliere` dei
  registri inclusi (somma degli importi `SpesaCassa` di quei registri).
- Il **ricavato** tracciato e non tracciato MUST derivare allo stesso modo dai soli
  registri inclusi.
- `RicavoNettoCalcolato` MUST valere `RicavoTotaleCalcolato − Σ SpeseFornitori −
  Σ SpeseGiornaliere` dei soli registri inclusi.

I registri con `Incluso == false` MUST NOT contribuire ad alcuna somma. I valori MUST
essere calcolati a runtime (proprietà `[NotMapped]`, nessun dato persistito): le chiusure
esistenti, anche già `CHIUSA`, espongono i valori come pura aggregazione dei registri.
Il sistema MUST NOT usare campi speciali, residui o anti-doppio-conteggio per riconciliare
fonti di spesa eterogenee (i KPI `SpeseAggiuntiveNonDuplicateCalcolate`,
`TotaleSpeseCalcolato`, `DifferenzaCalcolata` introdotti nella PR #7 sono rimossi — vedi
sezione REMOVED).

(Precedentemente: `RicavoNettoCalcolato = RicavoTotaleCalcolato − SpeseAggiuntiveCalcolate
− Σ SpeseGiornaliere`, dove `SpeseAggiuntiveCalcolate` sommava spese libere appese alla
chiusura più pagamenti fornitori inclusi tramite join dedicata, con KPI `[NotMapped]`
dedicati a evitare il doppio conteggio dei pagamenti già presenti nei registri.)

#### Scenario: Netto come pura aggregazione dei registri inclusi

- GIVEN una chiusura con due registri inclusi: R1 con `SpeseFornitori = 200 €` e
  `SpeseGiornaliere = 50 €`, R2 con `SpeseFornitori = 100 €` e `SpeseGiornaliere = 30 €`
- AND `RicavoTotaleCalcolato` pari a 1.000 €
- WHEN vengono letti i valori della chiusura
- THEN `SpeseTracciate` vale 300 € (200 + 100)
- AND `SpeseNonTracciate` vale 80 € (50 + 30)
- AND `RicavoNettoCalcolato` vale 620 € (1.000 − 300 − 80)

#### Scenario: Registro escluso non contribuisce ad alcuna somma

- GIVEN una chiusura con due link registro: R1 (`Incluso = true`, `SpeseFornitori = 100 €`,
  `SpeseGiornaliere = 40 €`) e R2 (`Incluso = false`, `SpeseFornitori = 500 €`,
  `SpeseGiornaliere = 60 €`)
- WHEN vengono letti i valori della chiusura
- THEN solo i valori di R1 contribuiscono: `SpeseTracciate = 100 €`,
  `SpeseNonTracciate = 40 €`
- AND R2 non contribuisce né al ricavo né alle spese

#### Scenario: Nessuna spesa fuori registro

- GIVEN una chiusura mensile
- WHEN si valutano le sue spese
- THEN non esiste alcuna spesa o pagamento associato direttamente alla chiusura
- AND ogni euro di spesa considerato dalla chiusura proviene da un registro incluso

#### Scenario: Chiusura già CHIUSA espone i valori aggregati a runtime

- GIVEN una chiusura in stato `CHIUSA`, creata prima di questa change
- WHEN la lista, il dettaglio o il report di stampa richiedono i valori della chiusura
- THEN i valori restituiti sono la pura aggregazione dei registri inclusi
- AND nessun dato persistito della chiusura è stato modificato

## REMOVED Requirements

### Requirement: Spese libere appese alla chiusura mensile

(Motivazione: OPZIONE B della issue #8 — tutte le spese vivono su un registro giornaliero.
Le entità/tabelle `SpesaMensileLibera` (`SpeseMensiliLibere`) e `SpesaMensile`
(`SpeseMensili`, legacy morto) vengono eliminate. Sono rimosse le mutation GraphQL
`aggiungiSpesaLibera`, `modificaSpesaLibera`, `eliminaSpesaLibera` e la navigation
`ChiusuraMensile.SpeseLibere`. I dati reali giustificano la rimozione senza migrazione:
`SpeseMensili = 0` righe e `SpeseMensiliLibere = 0` righe. Le spese non tracciate si
registrano ora come `SpesaCassa` su un registro giornaliero — vedi dominio gestione-cassa.)

### Requirement: Pagamenti fornitori inclusi in chiusura tramite join dedicata

(Motivazione: i pagamenti fornitori appartengono al registro giornaliero
(`PagamentoFornitore.RegistroCassaId`) e vengono aggregati dalla chiusura solo tramite i
registri inclusi. Sono rimosse la tabella/entità `PagamentoMensileFornitori`
(`PagamentiMensiliFornitori`), la navigation `ChiusuraMensile.PagamentiInclusi` e le
mutation `aggiungiPagamentoFornitoreInChiusura`, `modificaPagamentoFornitoreInChiusura`,
`eliminaPagamentoFornitoreInChiusura`, `includiPagamentoFornitore`. I 32 record esistenti
di `PagamentiMensiliFornitori` hanno tutti `PagamentoFornitore.RegistroCassaId` non null →
zero orfani, nessuna migrazione dati necessaria. La navigation `RegistriInclusi`
(`RegistriCassaMensili`) resta come unica join legittima per l'aggregazione.)

### Requirement: KPI speciali anti-doppio-conteggio della chiusura (PR #7)

(Motivazione: i KPI `[NotMapped]` `SpeseAggiuntiveNonDuplicateCalcolate`,
`TotaleSpeseCalcolato` e `DifferenzaCalcolata` esistevano solo per riconciliare fonti di
spesa eterogenee ed evitare il doppio conteggio dei pagamenti già presenti nei registri.
Con la chiusura ridotta a pura aggregazione dei soli registri inclusi, questi KPI
diventano codice morto: le spese tracciate/non tracciate quadrano per costruzione. Sono
rimossi dal modello, dai tipi GraphQL e dal frontend.)

### Requirement: Migrazione chiusure vecchio modello

(Motivazione: `MigrazioneChiusureMensiliService` è un servizio no-op e la mutation
`migraChiusureMensiliVecchioModello` non ha alcun effetto utile. Con la rimozione del
vecchio modello di spesa non esiste più nulla da migrare — vengono eliminati servizio e
mutation.)

## GraphQL Schema Changes

I seguenti field MUST essere rimossi dallo schema GraphQL del dominio chiusure-mensili:

- Su `ChiusuraMensileType`: `speseLibere`, `pagamentiInclusi`,
  `speseAggiuntiveNonDuplicateCalcolate`, `totaleSpeseCalcolato`, `differenzaCalcolata`
  (e ogni field derivato dai KPI PR #7 rimossi).
- Tipi eliminati: `SpesaMensileType`, `SpesaMensileInputType`, `SpesaMensileTyperaType`,
  `SpesaMensileTyperaInputType`, `PagamentoMensileFornitoriType`.
- Mutation eliminate: `aggiungiSpesaLibera`, `modificaSpesaLibera`, `eliminaSpesaLibera`,
  `aggiungiPagamentoFornitoreInChiusura`, `modificaPagamentoFornitoreInChiusura`,
  `eliminaPagamentoFornitoreInChiusura`, `includiPagamentoFornitore`,
  `migraChiusureMensiliVecchioModello`.
- Query eliminata: `speseMensili` (su `ConnectionQueries`).

Il field GraphQL additivo `speseGiornaliereRegistriCalcolate` su `ChiusuraMensileType`
(introdotto in coerenza-calcoli-fase2) MAY restare come esposizione dell'aggregato non
tracciato dei registri inclusi; il sistema MUST NOT reintrodurre alcun field basato sulle
spese appese alla chiusura.

#### Scenario: Schema privo dei tipi e delle mutation rimossi

- GIVEN lo schema GraphQL dopo la change
- WHEN si ispeziona lo schema
- THEN i tipi `SpesaMensileType`, `SpesaMensileInputType`, `SpesaMensileTyperaType`,
  `SpesaMensileTyperaInputType`, `PagamentoMensileFornitoriType` non esistono
- AND le mutation delle spese libere, dei pagamenti-in-chiusura,
  `includiPagamentoFornitore` e `migraChiusureMensiliVecchioModello` non esistono
- AND `ChiusuraMensileType` non espone `speseLibere`, `pagamentiInclusi` né i KPI speciali
  della PR #7
