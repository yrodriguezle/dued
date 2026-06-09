# Delta for Gestione Cassa — IVA Multialiquota (Fase 3)

**Change**: iva-multialiquota-fase3
**Date**: 2026-06-10
**Status**: Draft
**Base spec**: `openspec/specs/gestione-cassa/specs.md`

Convenzioni trasversali (vincolanti per tutti i requirement):

- L'aliquota persistita è SEMPRE in **percentuale** (`22.00`), come `Fornitore.AliquotaIva`; la conversione a frazione avviene esclusivamente via `IvaCalculator.AliquotaDaPercentuale` nei punti di calcolo.
- Tutti gli scorpori/applicazioni IVA passano da `IvaCalculator` (invariante: `Imponibile + Iva == Totale` al centesimo). Le spec sotto riusano questa invariante senza ridefinirla.
- Le aliquote ammesse sono il set chiuso `{0, 4, 5, 10, 22}` (percentuali), definito come costante centralizzata unica.
- Decisioni vincolanti già prese: residuo negativo → clamp a 0 + log warning (mai bloccare il salvataggio); calcolo breakdown in helper puro (senza accesso DB); pagina amministrativa Prodotti fuori scope; snapshot IVA vendita immutabile salvo cambio prodotto/prezzo; backfill registri storici tutto `stimato = true`; eventi subscription invariati.

---

## ADDED Requirements

### Requirement: Aliquota IVA del prodotto

Ogni prodotto DEVE avere un'aliquota IVA persistita (`Prodotto.AliquotaIva`, percentuale, `decimal(5,2) NOT NULL`). I prodotti creati senza aliquota esplicita DEVONO ricevere il default `22.00` (default applicativo e di colonna DB). I prodotti seed DEVONO dichiarare aliquote esplicite.

#### Scenario: Backfill dei prodotti esistenti dalla configurazione

- GIVEN un database con prodotti preesistenti privi di aliquota e `BusinessSettings.VatRate = 0.10` (frazione)
- WHEN viene applicata la migrazione che introduce `Prodotto.AliquotaIva`
- THEN ogni prodotto preesistente ha `AliquotaIva = 10.00` (conversione frazione → percentuale: `VatRate × 100`)
- AND nessun altro dato dei prodotti viene modificato

#### Scenario: Backfill senza riga BusinessSettings

- GIVEN un database con prodotti preesistenti e nessuna riga in `BusinessSettings`
- WHEN viene applicata la migrazione che introduce `Prodotto.AliquotaIva`
- THEN ogni prodotto preesistente ha `AliquotaIva = 22.00` (fallback)

#### Scenario: Default per nuovo prodotto

- GIVEN il sistema migrato
- WHEN viene creato un prodotto senza specificare l'aliquota
- THEN il prodotto persiste `AliquotaIva = 22.00`

### Requirement: Validazione delle aliquote ammesse

Il sistema DEVE rifiutare, nelle mutation che accettano un'aliquota prodotto, qualunque valore fuori dal set `{0, 4, 5, 10, 22}`, con un errore GraphQL esplicito che indichi i valori ammessi. La validazione DEVE usare un'unica costante centralizzata (nessuna duplicazione del set nei call site).

#### Scenario: Aliquota valida

- GIVEN il set di aliquote ammesse `{0, 4, 5, 10, 22}`
- WHEN un client invia `mutateProdotto` con `aliquotaIva: 10`
- THEN la mutation viene eseguita e il prodotto persiste `AliquotaIva = 10.00`

#### Scenario: Aliquota fuori set

- GIVEN il set di aliquote ammesse `{0, 4, 5, 10, 22}`
- WHEN un client invia `mutateProdotto` con `aliquotaIva: 7`
- THEN la mutation fallisce con un errore GraphQL esplicito che elenca le aliquote ammesse
- AND nessun prodotto viene creato o modificato

#### Scenario: Aliquota zero ammessa

- GIVEN il set di aliquote ammesse include `0`
- WHEN un client invia `mutateProdotto` con `aliquotaIva: 0`
- THEN la mutation viene eseguita e il prodotto persiste `AliquotaIva = 0.00`

### Requirement: Mutation mutateProdotto

Il sistema DEVE esporre una mutation GraphQL `mutateProdotto` (modulo Vendite) per creare o aggiornare un prodotto, inclusa l'aliquota IVA. La mutation DEVE essere protetta da autorizzazione (`.Authorize()`), DEVE applicare la validazione delle aliquote ammesse e DEVE restituire il prodotto risultante come `ProdottoType`. La gestione prodotti da interfaccia utente NON è in scope (la mutation è l'unico punto di amministrazione).

Schema GraphQL (additivo):

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

#### Scenario: Creazione prodotto

- GIVEN un client autenticato e nessun prodotto con codice `CAFFE01`
- WHEN il client invia `mutateProdotto` con `{ codice: "CAFFE01", nome: "Caffè", prezzo: 1.20, aliquotaIva: 10 }`
- THEN viene creato un prodotto con `AliquotaIva = 10.00`
- AND la risposta contiene `prodottoId` valorizzato e `aliquotaIva: 10`

#### Scenario: Aggiornamento aliquota di un prodotto esistente

- GIVEN un prodotto esistente con `prodottoId: 5` e `AliquotaIva = 22.00`
- WHEN il client invia `mutateProdotto` con `{ prodottoId: 5, ..., aliquotaIva: 4 }`
- THEN il prodotto 5 persiste `AliquotaIva = 4.00`
- AND gli snapshot IVA delle vendite già registrate per il prodotto 5 NON vengono modificati

#### Scenario: Aggiornamento di un prodotto inesistente

- GIVEN nessun prodotto con `prodottoId: 999`
- WHEN il client invia `mutateProdotto` con `{ prodottoId: 999, ... }`
- THEN la mutation fallisce con errore esplicito "Prodotto non trovato" (o equivalente)

### Requirement: Snapshot IVA sulla vendita alla creazione

Ogni vendita creata DEVE persistere lo snapshot IVA al momento della creazione: `AliquotaIva` (percentuale, copiata dal prodotto), `Imponibile` e `ImportoIva` (`decimal(10,2)`), calcolati per scorporo dal `PrezzoTotale` (prezzi IVA inclusa) tramite `IvaCalculator.ScorporaDaLordo`. L'invariante `Imponibile + ImportoIva == PrezzoTotale` DEVE valere al centesimo per ogni riga.

#### Scenario: Creazione vendita con scorporo per riga

- GIVEN un prodotto con `Prezzo = 1.20` e `AliquotaIva = 10.00`
- WHEN un client invia `creaVendita` con `quantita: 3` (PrezzoTotale = 3.60)
- THEN la vendita persiste `AliquotaIva = 10.00`, `Imponibile = 3.27`, `ImportoIva = 0.33`
- AND `Imponibile + ImportoIva == PrezzoTotale` al centesimo

#### Scenario: Creazione vendita con aliquota zero

- GIVEN un prodotto con `AliquotaIva = 0.00`
- WHEN un client invia `creaVendita` per quel prodotto con `PrezzoTotale = 5.00`
- THEN la vendita persiste `AliquotaIva = 0.00`, `Imponibile = 5.00`, `ImportoIva = 0.00`

#### Scenario: Backfill delle vendite esistenti

- GIVEN vendite preesistenti senza snapshot IVA e prodotti già backfillati con `AliquotaIva`
- WHEN viene applicata la migrazione che introduce lo snapshot su `Vendite`
- THEN ogni vendita preesistente ha `AliquotaIva` = aliquota corrente del suo prodotto, `Imponibile = ROUND(PrezzoTotale / (1 + AliquotaIva/100), 2)` e `ImportoIva = PrezzoTotale − Imponibile`
- AND per ogni vendita backfillata vale `Imponibile + ImportoIva == PrezzoTotale` al centesimo
- AND i valori coincidono con quelli che `IvaCalculator.ScorporaDaLordo` produrrebbe per gli stessi input (nessun midpoint per le aliquote ammesse su lordi a 2 decimali)

### Requirement: Immutabilità dello snapshot IVA in aggiornamento vendita

In `aggiornaVendita`, lo snapshot `AliquotaIva` DEVE restare immutato salvo cambio prodotto: se `ProdottoId` cambia, l'aliquota snapshot DEVE essere ripresa dall'aliquota corrente del nuovo prodotto (coerentemente con la ripresa del prezzo corrente). `Imponibile` e `ImportoIva` DEVONO essere ricalcolati (con l'aliquota snapshot vigente) solo quando cambia il `PrezzoTotale` o l'aliquota snapshot, preservando l'invariante al centesimo. Un aggiornamento che non tocca né prodotto né prezzo NON DEVE alterare lo snapshot.

#### Scenario: Aggiornamento solo note

- GIVEN una vendita con snapshot `AliquotaIva = 10.00`, `Imponibile = 3.27`, `ImportoIva = 0.33`
- WHEN un client invia `aggiornaVendita` modificando solo `note`
- THEN `AliquotaIva`, `Imponibile` e `ImportoIva` restano invariati
- AND l'aliquota NON viene riletta dal prodotto (anche se nel frattempo l'aliquota del prodotto è cambiata)

#### Scenario: Aggiornamento quantità senza cambio prodotto

- GIVEN una vendita con `AliquotaIva = 10.00` snapshot e prodotto la cui aliquota corrente è nel frattempo diventata `22.00`
- WHEN un client invia `aggiornaVendita` con `quantita: 5` (il `PrezzoTotale` cambia)
- THEN `Imponibile` e `ImportoIva` vengono ricalcolati per scorporo dal nuovo `PrezzoTotale` usando l'aliquota snapshot `10.00`
- AND `AliquotaIva` resta `10.00` (immutabilità dello storico)

#### Scenario: Cambio prodotto

- GIVEN una vendita sul prodotto A (`AliquotaIva` snapshot `22.00`) e un prodotto B con aliquota corrente `4.00`
- WHEN un client invia `aggiornaVendita` con `prodottoId` = B
- THEN la vendita riprende prezzo unitario e aliquota correnti di B: `AliquotaIva = 4.00`
- AND `Imponibile` e `ImportoIva` vengono ricalcolati per scorporo dal nuovo `PrezzoTotale` con aliquota `4.00`

### Requirement: Breakdown IVA per aliquota del registro cassa

Ogni registro cassa DEVE avere un breakdown IVA per aliquota persistito nella tabella figlia `RegistroCassaIva` (`RegistroCassaId` FK cascade, `Aliquota` decimal(5,2) percentuale, `Imponibile` decimal(10,2), `Imposta` decimal(10,2), `Stimato` bool; unique `(RegistroCassaId, Aliquota, Stimato)`). Il breakdown DEVE essere composto da:

- una riga **esatta** (`Stimato = false`) per ogni aliquota presente tra le Vendite del registro, con `Imponibile = Σ Vendita.Imponibile` e `Imposta = Σ Vendita.ImportoIva` degli snapshot di riga (somma degli scorpori di riga, MAI scorporo della somma);
- al più una riga **stimata** (`Stimato = true`) per il residuo non itemizzato (vedi requirement dedicato).

Per ogni registro DEVE valere `Σ (Imponibile + Imposta) == TotaleVendite` al centesimo.

#### Scenario: Registro con vendite ad aliquote miste

- GIVEN un registro con `TotaleVendite = 100.00` e vendite itemizzate: 36.60 con aliquota 22 (`Imponibile 30.00`, `ImportoIva 6.60`) e 22.00 con aliquota 10 (`Imponibile 20.00`, `ImportoIva 2.00`)
- WHEN il registro viene salvato e i totali ricalcolati
- THEN il breakdown contiene una riga `(22.00, 30.00, 6.60, stimato: false)` e una riga `(10.00, 20.00, 2.00, stimato: false)`
- AND una riga stimata per il residuo `100.00 − 58.60 = 41.40` scorporato all'aliquota di default
- AND `Σ (imponibile + imposta)` di tutte le righe `== 100.00` al centesimo

#### Scenario: Vendite ad aliquota zero

- GIVEN un registro con una vendita di `PrezzoTotale = 5.00` e snapshot `AliquotaIva = 0.00`
- WHEN i totali vengono ricalcolati
- THEN il breakdown contiene la riga `(0.00, 5.00, 0.00, stimato: false)`

#### Scenario: Coerenza al centesimo tra dettaglio e breakdown

- GIVEN un registro con più vendite alla stessa aliquota i cui scorpori di riga, sommati, divergono di un centesimo dallo scorporo del totale
- WHEN i totali vengono ricalcolati
- THEN la riga esatta dell'aliquota riporta la SOMMA degli `Imponibile`/`ImportoIva` di riga (non lo scorporo della somma)
- AND `imponibile + imposta` della riga `== Σ PrezzoTotale` delle vendite di quell'aliquota al centesimo

### Requirement: Residuo non itemizzato stimato all'aliquota di default

Il residuo `TotaleVendite − Σ Vendita.PrezzoTotale` rappresenta i canali dichiarati manualmente (incassi elettronici, contante tracciato, fatture) non legati a vendite. Se il residuo è positivo, il sistema DEVE generare una sola riga di breakdown scorporata all'aliquota di default (`BusinessSettings.VatRate`, frazione, convertita in percentuale per la persistenza) con `Stimato = true`. Se il residuo è zero, NON DEVE esistere alcuna riga stimata. Se il residuo è negativo (dati storici incoerenti), il sistema DEVE fare clamp a 0 e registrare un log di warning con gli importi coinvolti; il salvataggio del registro NON DEVE MAI essere bloccato per questo motivo.

#### Scenario: Registro senza vendite itemizzate (flusso operativo attuale)

- GIVEN un registro senza alcuna Vendita, con `TotaleVendite = 80.00` e `VatRate = 0.10`
- WHEN i totali vengono ricalcolati
- THEN il breakdown contiene un'unica riga stimata `(10.00, 72.73, 7.27, stimato: true)` (scorporo di 80.00 al 10%)
- AND `ImportoIva` del registro coincide al centesimo con il valore che il calcolo single-rate pre-change avrebbe prodotto

#### Scenario: Registro interamente itemizzato

- GIVEN un registro in cui `Σ Vendita.PrezzoTotale == TotaleVendite`
- WHEN i totali vengono ricalcolati
- THEN il breakdown contiene solo righe esatte (`stimato: false`)
- AND nessuna riga stimata viene creata

#### Scenario: Residuo negativo da dati storici incoerenti

- GIVEN un registro storico con `TotaleVendite = 50.00` e vendite persistite per `Σ PrezzoTotale = 60.00`
- WHEN i totali vengono ricalcolati
- THEN il residuo viene portato a 0 (clamp): nessuna riga stimata viene creata
- AND viene emesso un log di warning che riporta registro, totale e somma vendite
- AND il salvataggio del registro completa con successo (nessuna eccezione)

### Requirement: ImportoIva come somma del breakdown (retrocompatibilità)

`RegistroCassa.ImportoIva` DEVE essere valorizzato come `Σ Imposta` delle righe del breakdown (esatte + stimata), non ricalcolato indipendentemente. Per i registri senza vendite itemizzate il valore DEVE coincidere al centesimo con il calcolo single-rate pre-change. La chiusura mensile (`TotaleIvaCalcolato`) e il riepilogo annuale, che aggregano `ImportoIva`, NON DEVONO richiedere modifiche e DEVONO restituire valori invariati per i dati esistenti.

#### Scenario: Equivalenza con il calcolo pre-change

- GIVEN un registro senza vendite itemizzate con `TotaleVendite = 123.45` e `VatRate = 0.10`
- WHEN i totali vengono ricalcolati dopo la change
- THEN `ImportoIva == IvaCalculator.ScorporaDaLordo(123.45, 0.10).Iva` (identico al valore pre-change)

#### Scenario: Chiusura mensile invariata

- GIVEN un mese con registri il cui `ImportoIva` è la somma dei rispettivi breakdown
- WHEN viene calcolato `TotaleIvaCalcolato` della chiusura mensile
- THEN il valore è `Σ ImportoIva` dei registri del mese, identico nella semantica e nei valori pre-change per i dati esistenti

### Requirement: Rigenerazione del breakdown a ogni ricalcolo dei totali

Il breakdown DEVE essere rigenerato integralmente (delete + reinsert delle righe figlie, come per conteggi e spese) a ogni esecuzione del ricalcolo totali del registro: salvataggio del registro (`mutateRegistroCassa`) e mutation vendite che alterano i totali (`creaVendita`, `aggiornaVendita`, `eliminaVendita`). La rigenerazione DEVE essere idempotente: ricalcoli ripetuti sugli stessi dati DEVONO produrre lo stesso insieme di righe, senza duplicati (garantito anche dal vincolo unique `(RegistroCassaId, Aliquota, Stimato)`).

#### Scenario: Risalvataggio idempotente

- GIVEN un registro già salvato con un breakdown di N righe
- WHEN il registro viene risalvato senza alcuna modifica ai dati
- THEN il breakdown risultante contiene esattamente le stesse N righe (stessi valori di aliquota, imponibile, imposta, stimato)
- AND non esistono righe duplicate per la stessa coppia `(aliquota, stimato)`

#### Scenario: Ricalcolo su eliminazione vendita

- GIVEN un registro con breakdown comprendente una riga esatta all'aliquota 10
- WHEN l'unica vendita ad aliquota 10 viene eliminata con `eliminaVendita`
- THEN il breakdown rigenerato non contiene più la riga esatta all'aliquota 10
- AND `ImportoIva` e i totali del registro riflettono il nuovo stato

### Requirement: Normalizzazione di VenditeContanti nel ricalcolo totali

Nel ricalcolo dei totali del registro, `VenditeContanti` DEVE essere ricalcolato come `Σ PrezzoTotale` delle Vendite persistite del registro, invece di essere azzerato (comportamento attuale: `VenditeContanti = 0` ad ogni salvataggio, che perde il totale itemizzato e renderebbe negativo il residuo). Per i registri senza vendite il valore risultante DEVE essere 0, identico al comportamento odierno.

#### Scenario: Registro con vendite risalvato

- GIVEN un registro con vendite persistite per `Σ PrezzoTotale = 60.00`
- WHEN il registro viene risalvato con `mutateRegistroCassa`
- THEN `VenditeContanti == 60.00` (non azzerato)
- AND `TotaleVendite == VenditeContanti + IncassiElettronici + IncassoContanteTracciato + IncassiFattura`
- AND il residuo del breakdown è `TotaleVendite − 60.00` (mai negativo a regime)

#### Scenario: Registro senza vendite (comportamento invariato)

- GIVEN un registro senza alcuna Vendita
- WHEN il registro viene risalvato
- THEN `VenditeContanti == 0` e tutti i totali coincidono con il comportamento pre-change

### Requirement: Backfill dei registri storici

La migrazione che introduce `RegistroCassaIva` DEVE backfillare ogni registro esistente con una sola riga: `Aliquota = VatRate × 100` (fallback `22.00` senza riga settings), `Imposta = ImportoIva` esistente, `Imponibile = TotaleVendite − ImportoIva`, `Stimato = true`. Il backfill NON DEVE modificare alcun valore esistente del registro (`ImportoIva` preservato bit a bit) e NON DEVE tentare di ricostruire la parte esatta dalle vendite storiche (decisione vincolante: tutto `stimato = true`; il raffinamento avviene al primo ricalcolo naturale).

#### Scenario: Backfill registro storico

- GIVEN un registro pre-change con `TotaleVendite = 100.00` e `ImportoIva = 9.09`
- WHEN viene applicata la migrazione `RegistroCassaIva`
- THEN il registro ha una sola riga di breakdown `(aliquota default, 90.91, 9.09, stimato: true)`
- AND `ImportoIva` del registro resta `9.09` (nessuna riscrittura)

#### Scenario: Registro storico con vendite itemizzate

- GIVEN un registro pre-change che possiede Vendite (già backfillate con snapshot IVA)
- WHEN viene applicata la migrazione `RegistroCassaIva`
- THEN anche questo registro riceve la sola riga stimata aggregata (nessuna ricostruzione esatta in migrazione)
- AND al primo risalvataggio del registro il breakdown viene rigenerato con le righe esatte dalle vendite

#### Scenario: Rollback della migrazione

- GIVEN le tre migrazioni della change applicate
- WHEN si esegue `dotnet ef database update <migrazione-precedente>` a ritroso
- THEN colonne e tabella nuove vengono rimosse senza alterare i dati preesistenti
- AND il calcolo single-rate pre-change torna a produrre gli stessi valori di prima

### Requirement: Esposizione GraphQL additiva del dato IVA

Lo schema GraphQL DEVE esporre il nuovo dato IVA esclusivamente con campi additivi; nessun campo esistente DEVE essere rinominato, rimosso o cambiato di tipo. Le query e i fragment esistenti DEVONO continuare a funzionare senza modifiche.

Schema (additivo):

```graphql
type Prodotto {
  aliquotaIva: Decimal!      # percentuale
}

type Vendita {
  aliquotaIva: Decimal!      # snapshot, percentuale
  imponibile: Decimal!
  importoIva: Decimal!
}

type RegistroCassa {
  breakdownIva: [RegistroCassaIva]   # risolto con DataLoader batch per registroCassaId
}

type RegistroCassaIva {
  aliquota: Decimal!
  imponibile: Decimal!
  imposta: Decimal!
  stimato: Boolean!
}
```

#### Scenario: Query del breakdown sul registro

- GIVEN un registro salvato con breakdown a più aliquote
- WHEN un client interroga `registroCassa { importoIva breakdownIva { aliquota imponibile imposta stimato } }`
- THEN la risposta contiene la lista delle righe di breakdown
- AND `Σ imposta` delle righe `== importoIva`

#### Scenario: Caricamento batch del breakdown su lista registri

- GIVEN una query di lista che richiede `breakdownIva` per N registri
- WHEN la query viene risolta
- THEN le righe di breakdown sono caricate con un DataLoader batch per `registroCassaId` (pattern dei figli esistenti del registro), senza una query per registro

#### Scenario: Query e fragment esistenti invariati

- GIVEN i fragment frontend esistenti (`RegistroCassaFragment` senza `breakdownIva`, query prodotti/vendite correnti)
- WHEN vengono eseguiti contro lo schema aggiornato
- THEN eseguono senza errori e con gli stessi risultati semantici di prima

### Requirement: Eventi subscription invariati

I payload degli eventi di subscription esistenti (`RegistroCassaUpdatedEvent`, `VenditaCreatedEvent`) NON DEVONO essere estesi con dati IVA in questa change (decisione vincolante): il client ottiene il breakdown tramite refetch.

#### Scenario: Evento dopo salvataggio registro

- GIVEN un client sottoscritto agli aggiornamenti del registro cassa
- WHEN un registro con breakdown multialiquota viene salvato
- THEN l'evento pubblicato contiene esattamente i campi odierni (nessun campo IVA aggiunto)

### Requirement: Visualizzazione del breakdown IVA nel dettaglio registro (frontend)

Il dettaglio del registro cassa (`RegistroCassaDetails`) DEVE mostrare il breakdown IVA del registro come elenco/tabella con colonne aliquota, imponibile e imposta. Le righe stimate (`stimato = true`) DEVONO essere visivamente distinte dalle righe esatte (es. badge/etichetta "stimato"), per non presentare la stima come dato fiscale esatto. Il tipo `RegistroCassa` frontend e il fragment del registro DEVONO includere `breakdownIva`. NOTA: oggi `importoIva` è nel fragment ma non è renderizzato nel dettaglio: la sezione breakdown è una AGGIUNTA alla vista, non una sostituzione.

#### Scenario: Dettaglio registro con breakdown misto

- GIVEN un registro con due righe esatte (22%, 10%) e una riga stimata all'aliquota di default
- WHEN l'utente apre il dettaglio del registro
- THEN vede una tabella con tre righe: aliquota, imponibile, imposta
- AND la riga stimata è marcata visivamente come "stimato"
- AND le righe esatte non riportano alcuna marcatura di stima

#### Scenario: Dettaglio registro storico (tutto stimato)

- GIVEN un registro storico backfillato con la sola riga stimata aggregata
- WHEN l'utente apre il dettaglio del registro
- THEN vede un'unica riga di breakdown marcata "stimato"

#### Scenario: Test e controlli statici frontend

- GIVEN i mock dei test GraphQL aggiornati con `breakdownIva`
- WHEN si eseguono `npm run ts:check`, `npm run lint` e `npm run test`
- THEN tutti i controlli passano senza errori

## MODIFIED Requirements

Nessuno: la spec base esistente (`rinominazione-italiano-gestione-cassa`) disciplina solo la nomenclatura; nessuno dei suoi requirement viene alterato. I comportamenti modificati dall'implementazione (`CalcolaTotali`, `VenditeContanti`) non erano coperti da requirement preesistenti e sono specificati sopra come ADDED.

## REMOVED Requirements

Nessuno.
