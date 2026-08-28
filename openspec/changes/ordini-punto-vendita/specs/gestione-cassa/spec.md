# Delta for Gestione Cassa — Ordini del punto vendita

**Change**: ordini-punto-vendita
**Date**: 2026-08-28
**Status**: Draft
**Base spec**: `openspec/specs/gestione-cassa/specs.md`
**Fonti vincolanti**: issue #24 (decisioni dell'utente), issue #19 (mappatura dei tre secchi)

Questo delta riguarda il **confine** fra il dominio degli ordini e la quadratura del registro:
quando i secchi si muovono, che cosa entra nel breakdown IVA, e che cosa impedisce di chiudere la
cassa. Le regole di calcolo del foglio non cambiano.

Convenzioni trasversali (vincolanti per tutti i requirement):

- `RiepilogoCards.tsx` resta il **riferimento normativo** delle formule di quadratura. Qualunque
  divergenza altrove è un errore, non una variante.
- `MutateRegistroCassaOrchestrator.CalcolaTotali` resta la fonte unica dei quattro campi che
  dichiara. I due secchi non sono fra quei quattro: il commento che delimita quel confine MUST
  essere esteso a dire **chi li muove ora**.
- Convivono due regimi sullo stesso registro, ed è voluto: `VenditeContanti`, `TotaleVendite` e
  il breakdown IVA ricalcolati da capo; `IncassiElettronici` e `IncassoContanteTracciato`
  digitabili e mossi per delta.

### Impatti sullo schema GraphQL

- `chiudiRegistroCassa` NON cambia firma: acquisisce una guardia in più, che si manifesta come
  errore parlante.
- La query che elenca gli ordini di un registro filtrabili per stato (definita nel delta
  `punto-vendita-ordini`) è ciò che alimenta l'elenco mostrato al blocco della chiusura: MUST
  essere interrogabile dalla scheda del registro senza query aggiuntive per ogni ordine.
- Nessun campo di `RegistroCassaType` viene rimosso o rinominato da questo change.

---

## MODIFIED Requirements

### Requirement: Momento in cui i secchi si muovono

I secchi `IncassiElettronici` e `IncassoContanteTracciato` MUST essere mossi per delta alla
**chiusura (o allo storno) di un ordine**.

(Previously: erano mossi alla **creazione della singola vendita**, nello stesso commit in cui
nasceva la riga — `CreaVenditaAsync` → `SecchiIncassiApplier.ApplicaDelta`, con la simmetrica in
`AggiornaVenditaAsync` ed `EliminaVenditaAsync`.)

Resta invariata la mappatura metodo → secchio decisa in #19. Resta invariata la convivenza dei
due regimi sullo stesso registro. Resta invariata la sequenza di invocazione: il delta dei secchi
PRIMA del breakdown, perché il breakdown legge `IncassiElettronici` per ricalcolare
`TotaleVendite`.

Resta invariato anche il clamp a zero di un secchio che andrebbe negativo, con il relativo
warning: la cassa non si blocca mai.

#### Scenario: Il delta arriva alla chiusura, non alla battuta

- GIVEN un registro con `IncassiElettronici = 40.00`
- WHEN si battono tre voci in un ordine aperto e poi lo si chiude con `ELETTRONICO` per 18,50 €
- THEN `IncassiElettronici` resta `40.00` durante tutta la fase aperta
- AND vale `58.50` subito dopo la chiusura, mai un valore intermedio

#### Scenario: Il totale digitato a mano sopravvive

- GIVEN un registro con `IncassiElettronici = 120.00` digitato a mano nella scheda
- WHEN si chiude un ordine elettronico da 18,50 € e poi si risalva il registro
- THEN `IncassiElettronici == 138.50`
- AND il valore digitato non viene sovrascritto da una somma delle vendite

---

### Requirement: Il breakdown IVA considera solo le vendite incassate

`BreakdownIvaApplier` ricalcola da `Σ` delle vendite persistite del registro. Le voci degli
ordini `APERTI` e `ANNULLATI` MUST essere escluse da quella somma; quelle degli ordini `CHIUSI`
MUST entrarci; quelle degli ordini `STORNATI` MUST uscirne.

(Previously: ogni riga di `Vendite` persistita entrava nella somma per il solo fatto di esistere,
perché una riga non poteva esistere senza essere già un incasso.)

Restano invariati: la riga esatta per aliquota venduta, la riga `Stimato = true` sul residuo, e
la rigenerazione idempotente `RemoveRange` + `Add` delle righe `RegistriCassaIva`.

#### Scenario: Ordini di stati diversi sullo stesso registro

- GIVEN un registro con un ordine `CHIUSO` da 30,00 €, uno `APERTO` da 18,50 €, uno `ANNULLATO` da 12,00 € e uno `STORNATO` da 9,00 €
- WHEN il breakdown IVA viene ricalcolato
- THEN `VenditeContanti == 30.00`
- AND la parte esatta del breakdown copre solo i 30,00 €
- AND il residuo stimato è calcolato su `TotaleVendite − 30.00`

#### Scenario: Residuo negativo — comportamento invariato

- GIVEN un registro il cui itemizzato incassato supera il dichiarato
- WHEN il breakdown viene ricalcolato
- THEN il residuo è portato a 0, la riga stimata sparisce e resta il warning nel log del server
- AND il salvataggio non viene bloccato (decisione vincolante di #19, non modificata qui)

---

## ADDED Requirements

### Requirement: La chiusura di cassa si blocca in presenza di ordini aperti

`chiudiRegistroCassa` MUST rifiutare la chiusura finché esistono ordini in stato `APERTO` sul
registro: un ordine aperto è per definizione un incasso non dichiarato.

Il messaggio MUST dire **quanti** ordini bloccano e per **quale importo**. Il punto di blocco
MUST mostrare l'elenco degli ordini aperti con le due sole uscite previste per ognuno:
**chiuderlo** incassando, o **annullarlo**.

Ordini in stato `CHIUSO`, `SPLITTATO`, `ANNULLATO` o `STORNATO` MUST NOT bloccare la chiusura.
`SPLITTATO` in particolare: il padre di uno split non ha nulla di indeciso: i suoi figli sono già
`CHIUSO` e hanno già mosso i secchi. Bloccare su di lui fermerebbe la cassa su un incasso **già
dichiarato**, senza alcuna azione possibile per sbloccarla.

La nuova guardia MUST affiancarsi a quelle esistenti senza sostituirle, e MUST essere valutata
prima di aprire la transazione che scrive lo stato.

#### Scenario: Chiusura bloccata

- GIVEN un registro `DRAFT` con due ordini `APERTI` per 30,00 € complessivi
- WHEN si tenta di chiudere il registro
- THEN la chiusura è rifiutata con un messaggio che nomina i due ordini e i 30,00 €
- AND lo stato del registro resta `DRAFT`
- AND l'operatore vede l'elenco dei due ordini con l'azione «chiudi» e l'azione «annulla» per ciascuno

#### Scenario: La via d'uscita sblocca

- GIVEN un registro bloccato da un solo ordine aperto
- WHEN l'ordine viene annullato
- THEN la chiusura del registro riesce
- AND nessun secchio è stato mosso dall'annullo

#### Scenario: Ordini già risolti non bloccano

- GIVEN un registro con cinque ordini `CHIUSI`, due `ANNULLATI` e uno `STORNATO`, e nessuno `APERTO`
- WHEN si chiude il registro
- THEN la chiusura riesce al primo tentativo

#### Scenario: Le altre guardie di chiusura restano

- GIVEN un registro con ordini tutti risolti ma in un mese chiuso, o in un giorno non operativo
- WHEN si tenta di chiudere il registro
- THEN valgono le guardie preesistenti (`GuardMeseChiuso`, `GuardGiornoOperativoConPeriodi`), con i loro messaggi
- AND il registro già `CLOSED` o `RECONCILED` continua a rifiutare la richiusura come oggi

---

### Requirement: Divergenza nota sulla formula di `TotaleVendite` — da riallineare, non da propagare

`openspec/specs/gestione-cassa/specs.md` (§ *Normalizzazione di VenditeContanti nel ricalcolo
totali*, ~riga 1204) dichiara

```
TotaleVendite == VenditeContanti + IncassiElettronici + IncassoContanteTracciato + IncassiFattura
```

mentre il codice (`BreakdownIvaApplier.ApplicaAsync`) calcola

```
TotaleVendite == (TotaleChiusura − TotaleApertura) + IncassiElettronici + IncassiFattura
```

La formula del **codice** è quella del foglio (`RiepilogoCards`, riferimento normativo) ed è
pinnata da un test esistente (*«Totale Vendite usa il movimento fisico, non il "Pago in contanti"
digitato»*). Questo change MUST NOT propagare la formula della spec e MUST NOT cambiare la
formula del codice. Il riallineamento del file di spec è un lavoro a parte, da fare prima di
costruirci sopra.

#### Scenario: Una vendita in contanti non gonfia il totale

- GIVEN un registro con `TotaleChiusura − TotaleApertura = 480.00`, `IncassiElettronici = 0`, `IncassiFattura = 0`
- WHEN si chiude un ordine da 20,00 € con metodo `CONTANTE_TRACCIATO`
- THEN `TotaleVendite == 480.00` (invariato)
- AND `IncassoContanteTracciato == 20.00`
- AND `RestoFornitore` (colonna AD) sale di 20,00 € e `Ecc` (colonna AE) scende di 20,00 €

---

## Fuori scope, dichiarato

- Il **doppio conteggio** nella scheda del registro (#19 Fase 7): i due secchi restano digitabili
  e ora conterranno anche l'incassato dagli ordini. Rischio preesistente, non introdotto qui.
- La visibilità in pagina della condizione di **residuo negativo** (#19 Fase 6).
- Il riallineamento del file `openspec/specs/gestione-cassa/specs.md` sulla formula di
  `TotaleVendite`: segnalato qui, non eseguito da questo change.
