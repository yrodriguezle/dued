# Delta for Gestione Cassa

**Change**: fix-salvataggio-cassa-fase1
**Date**: 2026-06-09
**Status**: Draft

> Nota sullo schema GraphQL: questa change NON richiede modifiche allo schema GraphQL.
> La mutation `gestioneCassa.mutateRegistroCassa` restituisce già `pagamentiFornitori`
> con `pagamentoId`, `fattura.fatturaId`, `ddt.ddtId` e i campi identificativi
> (`fornitore.fornitoreId`, `numeroFattura`, `numeroDdt`) tramite `RegistroCassaFragment`
> (verificato in `duedgusto/src/graphql/cashRegister/fragments.tsx` e `mutations.tsx`).
> Anche `importoIva` e `totaleVendite` sono già esposti sul tipo `RegistroCassa`.

## ADDED Requirements

### Requirement: Riuso DocumentoTrasporto esistente in salvataggio registro

Quando il salvataggio del registro cassa crea un pagamento fornitore di tipo DDT senza
`ddtId`, il sistema MUST cercare un `DocumentoTrasporto` esistente per la coppia
`(FornitoreId, NumeroDdt)` — la stessa chiave dell'indice UNIQUE
`IX_DocumentiTrasporto_FornitoreId_NumeroDdt` — e, se trovato, MUST riusarne l'ID invece
di creare un nuovo record. Il confronto MUST trattare il numero DDT vuoto/null in modo
normalizzato e coerente con la creazione: ogni riga con numero vuoto risolve a un
documento con numero placeholder deterministico `SN-{yyyyMMdd}-{seq}` (data del registro,
progressivo per fornitore), riusabile in modo idempotente ai salvataggi successivi.
Il sistema MUST NOT sollevare violazioni dell'indice UNIQUE durante il salvataggio del
registro per DDT già esistenti.

#### Scenario: Riscrittura registro con DDT già registrato

- GIVEN un registro cassa salvato in precedenza con un pagamento collegato al DDT n. "123" del fornitore F
- AND il client reinvia la riga spesa senza `ddtId` (es. prima del refetch)
- WHEN viene eseguita la mutation `mutateRegistroCassa` con la riga DDT n. "123" del fornitore F
- THEN il sistema riusa il `DocumentoTrasporto` esistente `(F, "123")` senza crearne uno nuovo
- AND il salvataggio completa con successo senza errori `Duplicate entry`
- AND nel database esiste un solo DDT con quella coppia fornitore/numero

#### Scenario: Due righe DDT senza numero per lo stesso fornitore

- GIVEN un registro cassa in compilazione con due righe spesa di tipo DDT per lo stesso fornitore F, entrambe con numero DDT vuoto
- WHEN l'utente salva il registro
- THEN il salvataggio completa con successo senza violazione dell'indice UNIQUE
- AND il comportamento è deterministico e documentato: ogni riga senza numero risolve a un documento placeholder distinto `SN-{yyyyMMdd}-{seq}` (es. `SN-20260609-1` e `SN-20260609-2`)
- AND un risalvataggio del registro riusa gli stessi documenti placeholder in modo idempotente, senza crearne di nuovi

#### Scenario: DDT nuovo (nessun documento esistente)

- GIVEN nessun `DocumentoTrasporto` esiste per la coppia `(fornitore F, numero "456")`
- WHEN l'utente salva il registro con una riga spesa DDT n. "456" del fornitore F
- THEN il sistema crea un nuovo `DocumentoTrasporto` con fornitore F, numero "456", data e importo della riga
- AND il pagamento fornitore creato referenzia il nuovo `ddtId`

### Requirement: Deduplicazione fatture acquisto estesa al numero vuoto

La deduplicazione delle fatture acquisto in salvataggio registro MUST essere applicata
anche quando `NumeroFattura` è vuoto o null, usando la stessa normalizzazione del valore
persistito (la chiave di ricerca MUST coincidere con quella dell'indice UNIQUE
`IX_FattureAcquisto_FornitoreId_NumeroFattura`). Il sistema MUST NOT creare una seconda
fattura con la stessa coppia `(FornitoreId, NumeroFattura)`.

(Comportamento attuale errato: `CreaFatturaAcquisto` salta la dedup se
`string.IsNullOrEmpty(numeroFattura)` e tenta sempre l'insert, causando `Duplicate entry`.)

#### Scenario: Fattura con numero vuoto già esistente

- GIVEN esiste una `FatturaAcquisto` del fornitore F con `NumeroFattura` vuoto (creata da un salvataggio precedente)
- WHEN l'utente risalva il registro con una riga spesa fattura del fornitore F senza numero fattura e senza `fatturaId`
- THEN il sistema trova la fattura esistente con la chiave normalizzata `(F, "")` e la riusa
- AND il salvataggio completa senza errori `Duplicate entry`

#### Scenario: Riuso fattura orfana (senza pagamenti)

- GIVEN esiste una `FatturaAcquisto` `(F, "789")` senza alcun pagamento collegato
- WHEN l'utente salva un registro con una riga spesa fattura n. "789" del fornitore F
- THEN il sistema riusa la fattura esistente collegandovi il nuovo pagamento
- AND non viene creata una seconda fattura `(F, "789")`

### Requirement: Distinzione tra riscrittura dello stesso registro e doppia registrazione fattura

Quando la dedup trova una fattura esistente che ha già pagamenti collegati, il sistema
MUST distinguere i due casi: se tutti i pagamenti esistenti appartengono al registro
cassa in corso di salvataggio (riscrittura legittima), il sistema MUST riusare la fattura
senza errore; se almeno un pagamento appartiene a un ALTRO registro cassa, il sistema
MUST rifiutare l'operazione con un errore esplicito di doppia registrazione che
identifichi fattura e fornitore. L'errore MUST provocare il rollback dell'intera
transazione (nessun salvataggio parziale).

(Comportamento attuale errato: l'errore viene lanciato per qualunque pagamento esistente,
anche dello stesso registro in riscrittura.)

#### Scenario: Riscrittura del registro con fattura già pagata dallo stesso registro

- GIVEN il registro R è stato salvato con una riga spesa fattura n. "100" del fornitore F (pagamento P collegato alla fattura, `RegistroCassaId = R`)
- AND il client reinvia la riga con `pagamentoId = null` (es. risalvataggio prima del refetch)
- WHEN viene eseguita la mutation `mutateRegistroCassa` per il registro R con la riga fattura n. "100" del fornitore F
- THEN il sistema riusa la fattura esistente senza sollevare l'errore di doppia registrazione
- AND il salvataggio completa con successo
- AND la fattura n. "100" del fornitore F resta unica nel database

#### Scenario: Vera doppia registrazione (pagamenti di un altro registro)

- GIVEN la fattura n. "200" del fornitore F ha un pagamento collegato al registro R1
- WHEN l'utente tenta di salvare il registro R2 (giorno diverso) con una riga spesa fattura n. "200" del fornitore F senza `fatturaId`/`pagamentoId`
- THEN il sistema rifiuta il salvataggio con un errore che indica che la fattura è già registrata (numero fattura e fornitore nel messaggio)
- AND l'intera transazione viene annullata: il registro R2 non viene salvato né parzialmente modificato

### Requirement: Salvataggio registro con saldo di giornata negativo

Il sistema MUST salvare correttamente un registro cassa il cui risultato di giornata è
negativo (spese superiori agli incassi), inclusi DDT e fatture allegati. I campi
`ContanteAtteso`, `Differenza` e i totali MUST accettare e persistere valori negativi.
Il valore negativo MUST NOT essere causa di errore o di rollback.

#### Scenario: Spese fornitori superiori agli incassi con documenti allegati

- GIVEN un registro cassa con incasso contante tracciato 100€, incassi elettronici 0€, incassi fattura 0€
- AND righe spesa per 250€ totali che includono una fattura acquisto e un DDT
- WHEN l'utente salva il registro
- THEN la mutation completa con successo e il registro viene persistito
- AND `ContanteAtteso` risulta negativo (100 − spese) e viene salvato con il segno corretto
- AND i documenti (fattura e DDT) risultano creati o riusati senza duplicati

#### Scenario: Risalvataggio consecutivo di un registro con saldo negativo

- GIVEN il registro con saldo negativo dello scenario precedente è stato appena salvato
- WHEN l'utente preme di nuovo Salva senza che sia avvenuto il refetch
- THEN il salvataggio completa di nuovo con successo
- AND non vengono creati pagamenti, fatture o DDT duplicati

### Requirement: Formula ContanteAtteso corretta

Il calcolo dei totali del registro cassa MUST applicare la formula
`ContanteAtteso = IncassoContanteTracciato − SpeseFornitori − SpeseGiornaliere`.
Il sistema MUST NOT azzerare o ignorare la componente di incasso contante nel calcolo.
`Differenza` MUST restare derivata come
`(TotaleChiusura − TotaleApertura) − ContanteAtteso`.

(Comportamento attuale errato: `VenditeContanti` viene forzato a 0 prima del calcolo e
`ContanteAtteso` usa `VenditeContanti`, risultando sempre `−SpeseFornitori − SpeseGiornaliere`.)

#### Scenario: Calcolo ContanteAtteso con incassi e spese

- GIVEN un registro con incasso contante tracciato 500€, spese fornitori 120€, spese giornaliere 30€
- AND totale apertura 200€ e totale chiusura 550€
- WHEN il registro viene salvato
- THEN `ContanteAtteso` persistito vale 350€ (500 − 120 − 30)
- AND `Differenza` vale 0€ ((550 − 200) − 350)

#### Scenario: ContanteAtteso negativo

- GIVEN un registro con incasso contante tracciato 50€, spese fornitori 200€, spese giornaliere 0€
- WHEN il registro viene salvato
- THEN `ContanteAtteso` persistito vale −150€
- AND il salvataggio completa senza errori

### Requirement: Sincronizzazione ID documenti sulle righe spese dopo il submit

Dopo un submit riuscito della mutation `mutateRegistroCassa`, il frontend MUST aggiornare
le righe spese di tipo pagamento fornitore con gli identificativi restituiti dal server
(`pagamentoId`, `fatturaId`, `ddtId` da `result.pagamentiFornitori`), così che un
risalvataggio immediato invii aggiornamenti (`pagamentoId` valorizzato) e non nuovi
inserimenti. L'associazione riga ↔ pagamento restituito MUST avvenire per chiave di
business (fornitore + tipo documento + numero documento), NOT per posizione/indice.
Se l'associazione per chiave non è possibile (mismatch tra righe inviate e pagamenti
restituiti), il frontend MUST riallineare lo stato con un refetch completo del registro
invece di lasciare righe con ID mancanti o errati.

#### Scenario: Risalvataggio immediato prima del refetch

- GIVEN l'utente ha salvato con successo un registro con una riga spesa DDT n. "123" del fornitore F (prima volta, senza ID)
- AND la mutation ha restituito `pagamentiFornitori` con `pagamentoId`, `ddtId` per quella riga
- WHEN l'utente preme di nuovo Salva senza ricaricare la pagina e senza refetch
- THEN la riga spesa viene inviata con `pagamentoId` e `ddtId` valorizzati (update, non insert)
- AND il backend aggiorna il pagamento esistente senza cancellarlo e ricrearlo
- AND il salvataggio completa senza errori `Duplicate entry`

#### Scenario: Aggiornamento righe miste fattura e DDT

- GIVEN un submit riuscito con due righe spesa: una fattura n. "10" del fornitore A e un DDT n. "20" del fornitore B
- WHEN il frontend elabora `result.pagamentiFornitori`
- THEN la riga fattura riceve `pagamentoId` e `fatturaId` del pagamento con fornitore A e numero fattura "10"
- AND la riga DDT riceve `pagamentoId` e `ddtId` del pagamento con fornitore B e numero DDT "20"
- AND nessuna riga riceve gli ID dell'altra (match per chiave, non per indice)

#### Scenario: Mismatch tra righe inviate e pagamenti restituiti

- GIVEN un submit riuscito in cui il numero o le chiavi dei `pagamentiFornitori` restituiti non corrispondono alle righe spese in griglia
- WHEN il frontend tenta la mappatura per chiave e rileva il mismatch
- THEN il frontend esegue un refetch completo del registro dal server
- AND la griglia spese viene ripopolata con i dati e gli ID del server

### Requirement: IVA visualizzata dal backend

Il riepilogo cassa (`CashSummary`) MUST mostrare l'IVA usando il valore `importoIva`
calcolato e restituito dal backend. Il frontend MUST NOT calcolare l'IVA con un'aliquota
hardcoded (attuale `totalSales * 0.1`). Il backend resta l'unica fonte di verità per
l'aliquota (da `BusinessSettings.VatRate`) e per lo scorporo.

#### Scenario: Visualizzazione IVA su registro salvato

- GIVEN un registro cassa salvato per cui il backend ha calcolato `importoIva`
- WHEN l'utente apre la pagina di gestione cassa di quel giorno
- THEN il riepilogo mostra l'IVA pari al campo `importoIva` del server
- AND nessun ricalcolo locale con aliquota fissa al 10% viene applicato

#### Scenario: Registro nuovo non ancora salvato

- GIVEN l'utente sta compilando un registro nuovo non ancora salvato (nessun `importoIva` dal server)
- WHEN il riepilogo viene renderizzato
- THEN l'IVA MUST NOT essere calcolata con l'aliquota 10% hardcoded
- AND il riepilogo mostra un valore neutro definito (0 o assente) finché il dato del server non è disponibile, oppure dopo il salvataggio mostra l'`importoIva` restituito dalla mutation

### Requirement: Totale Vendite frontend allineato al backend

Il valore "Totale Vendite" visualizzato dal frontend (`SummaryDataGrid`) MUST coincidere
con il `totaleVendite` calcolato dal backend, definito come somma dei canali di incasso
(`incassoContanteTracciato + incassiElettronici + incassiFattura`). Il frontend MUST NOT
derivarlo dal movimento fisico di cassa
(attuale `(chiusura − apertura) + elettronico + fattura`). In presenza del dato del
server il frontend SHOULD usarlo direttamente.

#### Scenario: Totale Vendite coerente tra riepilogo e backend

- GIVEN un registro con incasso contante tracciato 300€, incassi elettronici 150€, incassi fattura 50€
- AND conteggi fisici con chiusura − apertura = 280€ (diverso dal contante tracciato)
- WHEN il riepilogo viene visualizzato
- THEN il Totale Vendite mostrato vale 500€ (300 + 150 + 50)
- AND coincide con il campo `totaleVendite` restituito dal backend
- AND il movimento fisico (280€) non altera il Totale Vendite
