# Delta for Punto Vendita — Ordini

**Change**: ordini-punto-vendita
**Date**: 2026-08-28
**Status**: Draft
**Base spec**: nessuna — dominio nuovo. Confina con `openspec/specs/gestione-cassa/specs.md`
**Fonti vincolanti**: issue #24 (decisioni dell'utente), issue #19 (anagrafica di cassa e mappatura dei tre secchi)

L'**ordine** è l'unità che tiene insieme le consumazioni battute al bancone finché non si sa come
il cliente pagherà. Il metodo di pagamento appartiene all'ordine, non alla riga. Un ordine aperto
è una **pre-vendita**: non è ancora un incasso e MUST NOT comportarsi come tale.

Convenzioni trasversali (vincolanti per tutti i requirement):

- Gli stati dell'ordine sono stringhe maiuscole, come `RegistroCassa.Stato` e
  `Vendita.MetodoPagamento`: restano leggibili guardando la tabella e non si rinumerano da sole.
- I tre metodi di pagamento restano quelli di `MetodiPagamentoVendita` (`ELETTRONICO`,
  `CONTANTE_TRACCIATO`, `CONTANTE_NON_TRACCIATO`) e la loro mappatura sui secchi resta quella
  decisa in #19: questo change sposta il **momento** in cui il delta si applica, non la mappatura.
- Il delta dei secchi (`SecchiIncassiApplier.ApplicaDelta`) NON è idempotente per costruzione:
  ogni requirement che lo tocca MUST proteggerlo con la transizione di stato, mai con una
  convenzione sul chiamante.
- Il modello resta «un ordine, un metodo». Il pagamento misto si ottiene per **split**, mai
  ammettendo due metodi sullo stesso ordine.
- «Un ordine aperto a lungo» è la norma, non un'anomalia da sanare con timeout o chiusure
  automatiche.

### Impatti sullo schema GraphQL

Il ramo `vendite` acquisisce le operazioni d'ordine. Le forme esatte appartengono al design; la
spec vincola quanto segue:

- MUST esistere un tipo `OrdineType` che espone almeno: identificativo stampabile, stato,
  registro di appartenenza, metodo di pagamento (nullo finché l'ordine è `APERTO`), voci,
  totale, autore e istante di ogni transizione, e il riferimento all'ordine di origine per le
  parti nate da uno split.
- MUST esistere una query che elenchi gli ordini di un registro filtrabili per stato — è ciò che
  alimenta l'elenco degli ordini aperti mostrato al blocco della chiusura di cassa.
- Le mutation di transizione (apertura, aggiunta e rimozione voce, chiusura con eventuale split,
  annullo, storno) MUST stare sotto il ramo `vendite` già autorizzato a livello di tipo
  (`VenditeMutations.this.Authorize()`): nessun campo d'ordine MUST risultare invocabile in
  anonimo.
- L'evento `onVenditaCreated` e il suo payload NON sono estesi da questo change: restano come
  sono finché la sottoscrizione non viene consumata.

---

## ADDED Requirements

### Requirement: Ciclo di vita dell'ordine

Un ordine MUST trovarsi in esattamente uno degli stati `APERTO`, `CHIUSO`, `ANNULLATO`,
`SPLITTATO`, `STORNATO`.

Le sole transizioni ammesse SHALL essere:

| Da | A | Gesto |
|---|---|---|
| — | `APERTO` | apertura |
| `APERTO` | `CHIUSO` | chiusura con incasso, un solo taglio |
| `APERTO` | `SPLITTATO` | chiusura con n tagli: il padre passa a `SPLITTATO`, i figli nascono `CHIUSO` |
| `APERTO` | `ANNULLATO` | annulla |
| `CHIUSO` | `STORNATO` | storna |

*`SPLITTATO` chiude **D-A1**: l'ordine originale **non** diventa una delle parti, resta come padre
marcato e conserva il legame con i figli. Un padre `SPLITTATO` MUST NOT muovere alcun secchio — li
muovono i figli — e MUST NOT essere stornabile direttamente: si stornano i figli, uno per uno.*

Ogni altra transizione MUST essere rifiutata con un messaggio parlante che nomina lo stato
corrente. In particolare `CHIUSO → APERTO`, `ANNULLATO → *`, `STORNATO → *`, `SPLITTATO → STORNATO`
e `CHIUSO → CHIUSO` MUST NOT essere possibili da alcun percorso dell'API.

La guardia MUST stare sulla **transizione di stato**, non sul chiamante: nessun percorso
alternativo, nessun flag di input e nessun ruolo MUST poterla aggirare.

#### Scenario: Apertura

- GIVEN un registro cassa del giorno in stato `DRAFT` e un mese non chiuso
- WHEN si apre un nuovo ordine
- THEN l'ordine esiste in stato `APERTO`, agganciato a quel registro
- AND ha un identificativo stampabile
- AND nessun campo del registro è cambiato

#### Scenario: Transizione vietata su ordine chiuso

- GIVEN un ordine in stato `CHIUSO`
- WHEN si tenta di riaprirlo o di annullarlo
- THEN l'operazione è rifiutata con un messaggio che dice lo stato corrente e indirizza allo **storno**
- AND lo stato resta `CHIUSO`
- AND nessun campo del registro è cambiato

#### Scenario: Transizione vietata su ordine annullato

- GIVEN un ordine in stato `ANNULLATO`
- WHEN si tenta di chiuderlo, aggiungerci una voce o stornarlo
- THEN l'operazione è rifiutata
- AND lo stato resta `ANNULLATO`

---

### Requirement: Un ordine aperto non muove i secchi né il breakdown IVA

Finché un ordine è `APERTO`, le sue voci MUST NOT influenzare alcun valore contabile del
registro: né `IncassiElettronici`, né `IncassoContanteTracciato`, né `VenditeContanti`, né
`TotaleVendite`, né le righe di `RegistriCassaIva`.

Il breakdown IVA ricalcola da `Σ` delle vendite persistite (`BreakdownIvaApplier`): le voci di un
ordine aperto MUST restare **fuori** da quella somma, e MUST restarne fuori anche quando il
registro viene risalvato da un'altra strada (`mutateRegistroCassa` →
`MutateRegistroCassaOrchestrator`).

#### Scenario: Ordine aperto con più voci

- GIVEN un registro con `IncassiElettronici = 40.00`, `VenditeContanti = 0`, una riga IVA stimata
- WHEN si apre un ordine e vi si aggiungono tre voci per un totale di 18,50 €
- THEN `IncassiElettronici`, `IncassoContanteTracciato`, `VenditeContanti`, `TotaleVendite` e `ImportoIva` sono identici a prima
- AND le righe di `RegistriCassaIva` sono identiche a prima (stessa aliquota, stesso imponibile, stesso flag `Stimato`)

#### Scenario: Registro risalvato mentre un ordine è aperto

- GIVEN un registro con un ordine `APERTO` da 18,50 €
- WHEN il registro viene risalvato con `mutateRegistroCassa` senza altre modifiche
- THEN `VenditeContanti` non include i 18,50 €
- AND il residuo stimato del breakdown è quello che sarebbe stato senza l'ordine

#### Scenario: Rimozione di una voce da un ordine aperto — nessun delta

- GIVEN un ordine `APERTO` con tre voci
- WHEN si rimuove l'ultima voce battuta
- THEN nessun campo del registro cambia
- AND nessun delta inverso viene applicato ai secchi
- AND l'ordine resta `APERTO` con due voci

> Questo scenario pinna il comportamento **opposto** a quello odierno: oggi `eliminaVendita`
> applica sempre il delta inverso, perché la riga era già un incasso nel momento in cui nasceva.

---

### Requirement: La chiusura muove i secchi una volta sola

La chiusura di un ordine MUST applicare il delta ai secchi del registro **esattamente una
volta**, in funzione del metodo scelto, secondo la mappatura già in vigore (issue #19):

| Metodo | Effetto |
|---|---|
| `ELETTRONICO` | somma a `IncassiElettronici` (e da lì a `TotaleVendite`) |
| `CONTANTE_TRACCIATO` | somma a `IncassoContanteTracciato` (alza `RestoFornitore` — colonna AD, abbassa `Ecc` — colonna AE) |
| `CONTANTE_NON_TRACCIATO` | nessun campo mosso — il residuo `Ecc` è già calcolato per differenza |

Poiché il delta **non è idempotente per costruzione** (dichiarato tale nel commento di
`SecchiIncassiApplier`), la protezione MUST essere la transizione di stato: un ordine già
`CHIUSO` non si richiude.

L'ordine di invocazione MUST restare quello odierno: delta dei secchi **prima** del breakdown
IVA, perché il breakdown ricalcola `TotaleVendite` a partire da `IncassiElettronici` e leggerlo
prima del delta darebbe un totale vecchio di un ordine.

#### Scenario: Chiusura elettronica

- GIVEN un ordine `APERTO` da 18,50 € e un registro con `IncassiElettronici = 40.00`
- WHEN l'ordine viene chiuso con metodo `ELETTRONICO`
- THEN l'ordine è `CHIUSO`
- AND `IncassiElettronici == 58.50`
- AND `TotaleVendite` cresce di 18,50 €
- AND il breakdown IVA include ora le voci dell'ordine come parte **esatta**, e il residuo stimato cala di conseguenza

#### Scenario: Chiusura in contante non tracciato — quadratura invariata

- GIVEN un ordine `APERTO` da 18,50 €
- WHEN l'ordine viene chiuso con metodo `CONTANTE_NON_TRACCIATO`
- THEN nessun secchio è mosso
- AND `ContanteNetto`, `RestoFornitore`, `Ecc` e `Resto` (colonna AG) restano quelli calcolati dalle formule del foglio
- AND `VenditeContanti` cresce di 18,50 € e il breakdown IVA si raffina

#### Scenario: Seconda chiusura dello stesso ordine — il delta non si applica due volte

- GIVEN un ordine già `CHIUSO` con metodo `ELETTRONICO` e `IncassiElettronici == 58.50`
- WHEN si invoca di nuovo la chiusura sullo stesso ordine, con lo stesso o con altro metodo
- THEN l'operazione è rifiutata
- AND `IncassiElettronici == 58.50` (invariato)

#### Scenario: Retry di rete sulla chiusura

- GIVEN un client che ritenta la stessa richiesta di chiusura dopo un timeout, mentre la prima è andata a buon fine
- WHEN la seconda richiesta arriva al server
- THEN i secchi contengono l'importo dell'ordine **una volta sola**
- AND il client riceve un esito che non lo induce a ritentare ancora

#### Scenario: Due chiusure concorrenti sullo stesso ordine

- GIVEN due dispositivi dietro lo stesso bancone che chiudono lo stesso ordine nello stesso istante
- WHEN entrambe le richieste vengono servite
- THEN una sola vince e i secchi si muovono una volta sola
- AND la perdente riceve un errore parlante, non un successo silenzioso

---

### Requirement: Una sola porta muove i secchi

Dopo questo change MUST esistere **un solo** percorso del backend che applica il delta ai secchi
del registro: la transizione di chiusura (o di storno) di un ordine. Nessun'altra operazione
dell'API — in particolare la creazione o l'aggiornamento di una singola vendita — MUST poter
muovere `IncassiElettronici` o `IncassoContanteTracciato`.

#### Scenario: Enumerazione dei chiamanti del delta

- GIVEN il codice del backend dopo il change
- WHEN si enumerano i punti che invocano l'applicatore del delta dei secchi
- THEN esiste un solo punto di invocazione, quello della transizione di stato dell'ordine
- AND un test strutturale rende rosso qualunque nuovo chiamante aggiunto in seguito

> Il pattern del test enumerativo esiste già nel repository (`ConfineVetrinaCassaTests`): se il
> test diventa rosso, è sbagliata la modifica, non il test.

#### Scenario: La vecchia porta non incassa più

- GIVEN il registro del giorno con `IncassiElettronici = 40.00`
- WHEN una vendita viene creata fuori da un ordine chiuso, per qualunque via ancora esposta dall'API, con metodo `ELETTRONICO`
- THEN `IncassiElettronici` resta `40.00`
- AND la chiamata o viene rifiutata, o produce una voce che non è ancora un incasso

---

### Requirement: Split alla chiusura, per voci

Alla chiusura, un ordine MAY essere spaccato in **2..n** ordini chiusi, **uno per metodo di
pagamento**. Il modello resta «un ordine, un metodo».

La divisione MUST avvenire **per voci**: ogni voce dell'ordine originale MUST finire in
esattamente una parte. La divisione **per importo** sullo stesso insieme di voci NON è
supportata: l'API MUST rifiutarla e l'interfaccia MUST dichiararlo **prima** che l'operatore ci
arrivi alla cassa, non dopo il tentativo.

Lo split MUST essere atomico: o nascono tutte le parti e i secchi si muovono una volta sola in
totale, o non cambia nulla e l'ordine resta `APERTO`. La transizione è «ordine aperto → n ordini
chiusi», non n chiusure indipendenti.

#### Scenario: «Il mio spritz lo pago io, il tuo lo paghi tu»

- GIVEN un ordine `APERTO` con 4 voci per un totale di 30,00 € (due voci da 8,00 € e due da 7,00 €)
- WHEN si chiude spaccandolo in due parti: le prime due voci in `CONTANTE_TRACCIATO`, le altre due in `ELETTRONICO`
- THEN esistono due ordini in stato `CHIUSO`, uno per metodo
- AND la somma dei loro totali è 30,00 €
- AND nessun ordine resta `APERTO` da questa operazione
- AND `IncassoContanteTracciato` cresce di 16,00 € e `IncassiElettronici` di 14,00 €, ciascuno una volta sola
- AND ogni parte ha un identificativo stampabile proprio, riconducibile all'ordine di origine

#### Scenario: Split fallito a metà — nessun effetto parziale

- GIVEN un ordine `APERTO` da 30,00 € da spaccare in due parti
- WHEN la creazione della seconda parte fallisce
- THEN nessun secchio è stato mosso
- AND l'ordine è ancora `APERTO` con tutte e 4 le voci
- AND non esiste alcun ordine chiuso orfano

#### Scenario: Voce non assegnata o assegnata due volte

- GIVEN un ordine `APERTO` con 4 voci
- WHEN si richiede uno split che lascia una voce fuori da ogni parte, oppure la mette in due parti
- THEN l'operazione è rifiutata con un messaggio che nomina la voce
- AND l'ordine resta `APERTO` e i secchi sono invariati

#### Scenario: Divisione per importo — non supportata e dichiarata

- GIVEN un ordine `APERTO` da 30,00 € con una sola voce da 30,00 €
- WHEN si tenta di dividerlo in 20,00 € in contanti e 10,00 € con carta
- THEN l'operazione è rifiutata dal server
- AND l'interfaccia ha già dichiarato, **prima** del tentativo, che si divide per voci e non per importo

#### Scenario: Split in una sola parte

- GIVEN un ordine `APERTO`
- WHEN si chiude assegnando tutte le voci a un'unica parte
- THEN il risultato è indistinguibile da una chiusura semplice: un ordine `CHIUSO`, un delta applicato una volta

---

### Requirement: Resto al cliente, con un nome distinto da `RegistroCassa.Resto`

Alla chiusura, quando il metodo è contante (tracciato o non tracciato), l'operatore MAY digitare
**quanto ha dato il cliente** e il sistema MUST mostrare il **resto da rendere**.

Il valore digitato e quello calcolato SHALL essere un aiuto all'operatore, NON un dato contabile:
MUST NOT toccare alcun secchio, alcun totale del registro e alcuna riga IVA.

Gli identificatori usati in codice, in UI e nello schema GraphQL MUST NOT essere `Resto` nudo:
`RegistroCassa.Resto` esiste già ed è la **colonna AG** del foglio («Ecc al netto delle spese con
scontrino»), che non c'entra nulla. Nomi come *contante ricevuto* e *resto da rendere* MUST
distinguerli senza ambiguità.

#### Scenario: Resto calcolato

- GIVEN un ordine `APERTO` con totale 17,50 €
- WHEN si sceglie contante e si digita 20,00 € ricevuti
- THEN il sistema mostra un resto da rendere di 2,50 €

#### Scenario: Il resto al cliente non tocca la colonna AG

- GIVEN un registro con `Resto` (colonna AG) pari a un certo valore
- WHEN si chiude un ordine in contanti digitando il contante ricevuto e leggendo il resto
- THEN `RegistroCassa.Resto` è cambiato solo per effetto delle formule del foglio, mai per effetto del resto reso al cliente
- AND nessun campo del registro contiene il valore del contante ricevuto

#### Scenario: Contante ricevuto inferiore al totale

- GIVEN un ordine con totale 17,50 €
- WHEN si digita 15,00 € ricevuti
- THEN il sistema segnala che la cifra non copre il totale
- AND non mostra un resto negativo come se fosse un numero valido

#### Scenario: Metodo elettronico — nessun resto

- GIVEN un ordine da chiudere con metodo `ELETTRONICO`
- WHEN si arriva alla scelta del metodo
- THEN il campo del contante ricevuto non viene proposto

#### Scenario: Nessuna collisione di nome

- GIVEN il codice del change
- WHEN si cercano gli identificatori del dominio ordine in backend, in frontend e nello schema GraphQL
- THEN nessuno di essi si chiama `Resto` senza qualificazione

---

### Requirement: Annulla e storna sono due gesti distinti

**Annulla** MUST applicarsi SOLO a un ordine `APERTO`: non produce alcun delta, perché non c'era
nulla da disfare. **Storna** MUST applicarsi SOLO a un ordine `CHIUSO`: applica il delta inverso,
una volta sola.

I due gesti MUST NOT essere lo stesso comando né lo stesso pulsante: hanno conseguenze opposte e
rischi opposti.

Un ordine annullato MUST NOT sparire: passa in stato `ANNULLATO` e resta consultabile con **chi**
e **quando**. Cancellare un ordine è la via d'uscita dal blocco della chiusura di cassa, quindi è
anche il modo di far sparire un incasso reale: la scappatoia MUST restare tracciata.

**Chi può fare che cosa**, e perché i due gesti si trattano diversamente:

| Gesto | Ruolo richiesto | Traccia obbligatoria |
|---|---|---|
| annulla (ordine `APERTO`) | **nessuno in particolare**: chiunque venda | motivo non vuoto, autore, istante |
| storna (ordine `CHIUSO`) | **amministratore** | motivo non vuoto, autore, istante |

L'annullo MUST NOT essere riservato agli amministratori: un annullo che richiede il capo spinge
l'operatore a **non chiudere affatto** gli ordini, che è peggio del rischio che eviterebbe. Lo storno,
che applica un delta inverso su un'operazione non idempotente, MUST invece essere riservato.

Allo storno le `Vendita` dell'ordine MUST essere **cancellate**, non marcate con un flag: gli applier
ricalcolano i totali dalla **somma delle `Vendita` persistite**, e un flag costringerebbe ad aggiungere
un filtro in ogni applier — cioè a reintrodurre l'accoppiata «stato + filtro» che questo change esiste
per togliere. L'invariante MUST restare: **una `Vendita` che esiste è una riga incassata adesso**.

Le **righe dell'ordine** MUST NOT essere mai cancellate, in nessuna transizione: il libro mastro è
l'ordine, ed è ciò che rende uno storno distinguibile da un ordine mai esistito.

#### Scenario: Lo storno cancella le vendite e conserva le righe

- GIVEN un ordine `CHIUSO` di tre voci, con tre `Vendita` generate alla chiusura
- WHEN un amministratore lo storna
- THEN non esiste più alcuna `Vendita` legata a quell'ordine
- AND le tre righe dell'ordine esistono ancora, con gli stessi importi
- AND il totale ricalcolato dagli applier non comprende più quelle voci

#### Scenario: Storno chiesto da chi non è amministratore — rifiutato

- GIVEN un ordine `CHIUSO` e un utente senza ruolo amministrativo
- WHEN quell'utente tenta lo storno
- THEN l'operazione è rifiutata
- AND le `Vendita` dell'ordine esistono ancora e i secchi sono invariati

#### Scenario: Storno senza motivo — rifiutato

- GIVEN un ordine `CHIUSO`
- WHEN si invoca lo storno con motivo vuoto o di soli spazi
- THEN l'operazione è rifiutata prima di qualunque scrittura

#### Scenario: Storno di un ordine splittato — rifiutato

- GIVEN un ordine `SPLITTATO` con due figli `CHIUSO`
- WHEN si tenta di stornare il padre
- THEN l'operazione è rifiutata con un messaggio che indirizza allo storno dei singoli figli
- AND i due figli restano `CHIUSO` e i secchi sono invariati

#### Scenario: Annulla su ordine aperto

- GIVEN un ordine `APERTO` da 18,50 €
- WHEN l'operatore lo annulla
- THEN lo stato è `ANNULLATO`
- AND nessun campo del registro è cambiato
- AND l'ordine resta consultabile, con l'utente che l'ha annullato e l'istante

#### Scenario: Annulla su ordine chiuso — rifiutato

- GIVEN un ordine `CHIUSO`
- WHEN si tenta di annullarlo
- THEN l'operazione è rifiutata con un messaggio che indirizza allo storno
- AND i secchi sono invariati

#### Scenario: Storno di un ordine chiuso

- GIVEN un ordine `CHIUSO` da 18,50 € con metodo `ELETTRONICO` e `IncassiElettronici == 58.50`
- WHEN l'ordine viene stornato
- THEN lo stato è `STORNATO`
- AND `IncassiElettronici == 40.00`
- AND il breakdown IVA torna a considerare le voci come non vendute

#### Scenario: Storno doppio — il delta inverso non si applica due volte

- GIVEN un ordine già `STORNATO` e `IncassiElettronici == 40.00`
- WHEN si invoca di nuovo lo storno
- THEN l'operazione è rifiutata
- AND `IncassiElettronici == 40.00`

#### Scenario: Storno su ordine aperto — rifiutato

- GIVEN un ordine `APERTO`
- WHEN si tenta di stornarlo
- THEN l'operazione è rifiutata con un messaggio che indirizza all'annullo

#### Scenario: Gli ordini annullati restano nello storico

- GIVEN tre ordini annullati in una giornata
- WHEN si consulta la giornata a fine mese
- THEN i tre ordini sono elencati con stato `ANNULLATO`, autore, istante e voci
- AND non sono conteggiati in alcun totale contabile

---

### Requirement: Il gesto di battuta non chiede più il metodo

Toccare un prodotto MUST aggiungere una voce all'ordine aperto **senza** chiedere il metodo di
pagamento. Il metodo MUST essere chiesto **una volta sola**, alla chiusura.

Il foglio che sale dal basso (`SceltaMetodoPagamento.tsx`) resta valido come gesto — bersagli
≥ 56 px, una mano sola, nessuna azione distruttiva adiacente — ma si sposta da ogni voce a fine
ordine.

#### Scenario: Otto consumazioni, una sola scelta di metodo

- GIVEN un ordine `APERTO`
- WHEN si battono otto consumazioni
- THEN il foglio della scelta del metodo non si apre mai
- AND si apre una volta sola quando si chiude l'ordine

#### Scenario: Quantità maggiore di uno

- GIVEN un prodotto da 2,50 €
- WHEN lo si aggiunge all'ordine con quantità 3
- THEN l'ordine contiene una voce da 7,50 €
- AND la quantità è trattata come valore decimale, non come intero (`Vendita.Quantita` è un `decimal`)

#### Scenario: Uso da telefono

- GIVEN un viewport da 360 px e uno da 390 px
- WHEN si apre il punto vendita e si compone un ordine di quattro voci fino alla chiusura
- THEN ogni bersaglio toccabile del percorso è ≥ 48 px, e ≥ 56 px per la scelta del metodo
- AND nessuna azione distruttiva è adiacente a un bersaglio della sequenza
- AND le animazioni di conferma rispettano `prefers-reduced-motion`

---

### Requirement: Ordini multipli aperti, nessuna nozione di tavolo

Più ordini MAY restare `APERTI` contemporaneamente, e ordini già chiusi convivono con quelli
aperti: è la norma, non un'eccezione. Il sistema MUST NOT introdurre alcuna nozione di **tavolo**
o di conto raggruppato: si gestisce l'ordine, uno per volta.

#### Scenario: Tre ordini aperti insieme

- GIVEN tre ordini `APERTI` sul registro del giorno
- WHEN se ne chiude uno
- THEN gli altri due restano `APERTI` e intatti
- AND i secchi sono mossi solo dall'importo dell'ordine chiuso

#### Scenario: Nessun raggruppamento per tavolo

- GIVEN l'interfaccia del punto vendita e lo schema GraphQL del dominio ordine
- WHEN se ne esaminano il modello e le schermate
- THEN non esiste alcun campo o schermata che raggruppi più ordini in un conto unico

---

### Requirement: L'ordine appartiene al giorno in cui è stato aperto

Un ordine aperto prima di mezzanotte e chiuso dopo MUST restare sul registro del **giorno di
apertura**, finché la cassa di quel giorno non è chiusa. Il caso non si gestisce diversamente:
MUST NOT esistere alcuna migrazione automatica di un ordine da un registro all'altro.

#### Scenario: Ordine a cavallo di mezzanotte

- GIVEN un ordine aperto alle 23:50 sul registro del giorno D
- WHEN viene chiuso alle 00:20 del giorno D+1, con la cassa di D ancora aperta
- THEN il delta è applicato al registro del giorno D
- AND il registro del giorno D+1 è invariato

---

### Requirement: Guardie di mese chiuso e di registro

L'apertura di un ordine, l'aggiunta di voci, la chiusura e lo storno MUST rispettare le guardie
già in vigore sul mese chiuso (`ChiusuraMensileService.DataAppartieneAMeseChiusoAsync` /
`RegistroAppartieneAMeseChiusoAsync`). I messaggi del server MUST essere mostrati come arrivano,
non trasformati in un toast generico.

Lo stato «mese chiuso» e «registro assente» MUST essere gestito **prima** di mostrare la griglia
di vendita, non alla conferma.

#### Scenario: Mese chiuso all'apertura dell'ordine

- GIVEN un mese in stato chiuso
- WHEN si tenta di aprire un ordine su un registro di quel mese
- THEN l'operazione è rifiutata con il messaggio parlante del server («il mese MM/yyyy è chiuso»)
- AND la griglia dei prodotti non viene presentata come utilizzabile

#### Scenario: Mese chiuso fra apertura e chiusura dell'ordine

- GIVEN un ordine `APERTO` e un mese che nel frattempo viene chiuso
- WHEN si tenta di chiudere l'ordine
- THEN l'operazione è rifiutata
- AND nessun delta viene applicato
- AND l'ordine resta `APERTO`

---

### Requirement: Identificativo stampabile e righe come gruppo

Ogni ordine MUST avere un identificativo **stampabile** e stabile, e le sue voci MUST restare
recuperabili **come gruppo** dopo la chiusura, dopo lo split e dopo lo storno.

La stampa delle voci NON è in scope adesso, ma il modello MUST reggerla fin da subito: righe
trattate come vendite sciolte agganciate al registro non lo reggono.

#### Scenario: Le voci restano un gruppo dopo la chiusura

- GIVEN un ordine chiuso con cinque voci
- WHEN si richiede l'ordine per identificativo
- THEN si ottengono le cinque voci nello stesso gruppo, con l'identificativo dell'ordine e il metodo di pagamento

#### Scenario: Le voci restano un gruppo dopo lo split

- GIVEN un ordine spaccato in due parti
- WHEN si richiedono le due parti
- THEN ciascuna espone il proprio identificativo stampabile e le proprie voci
- AND ciascuna è riconducibile all'ordine di origine

---

## Decisioni di questo dominio — esito

Entrambe erano rimaste aperte perché `design.md` non era leggibile per intero quando questo file è
stato scritto. Il design è ora integrale e le chiude entrambe.

| # | Domanda | Esito |
|---|---|---|
| **D-A1** | Sorte dell'ordine originale dopo lo split: diventa una delle parti, o resta come padre marcato? | ✅ **Resta come padre marcato**, in stato `SPLITTATO`: non muove secchi, conserva il legame con i figli e non è stornabile direttamente. Pinnato nel requirement «Ciclo di vita dell'ordine» |
| **D-A2** | Sorte della porta `creaVendita`: ritirata, resa interna, o mantenuta senza effetto sui secchi | ✅ **Ritirata dallo schema**, non deprecata: una deprecazione non è una guardia, e finché il campo risponde i due regimi convivono. `aggiornaVendita` / `eliminaVendita` restano ma rifiutano ogni vendita nata da un ordine, indirizzando allo storno |

Nessuna decisione resta aperta in questo dominio. L'unica ancora aperta nell'intero change è la
**lista delle varianti di listino** (D-B4 nel dominio catalogo), che non tocca questi requirement.

#### Scenario: La porta diretta non esiste più

- GIVEN lo schema GraphQL dopo il change
- WHEN si cerca una mutation che crei una vendita senza passare da un ordine
- THEN non ne esiste alcuna
- AND il tentativo di modificare o eliminare una vendita nata da un ordine viene rifiutato con un
  messaggio che indirizza allo storno dell'ordine

## Fuori scope, dichiarato

- La **stampa** delle voci d'ordine: prevista, non ora — ma il modello la deve reggere.
- La divisione **per importo** sullo stesso insieme di voci: esplicitamente non supportata.
- Il **doppio conteggio** nella scheda del registro (#19 Fase 7): rischio preesistente.
- La visibilità in pagina del **residuo negativo** (#19 Fase 6): preesistente.
