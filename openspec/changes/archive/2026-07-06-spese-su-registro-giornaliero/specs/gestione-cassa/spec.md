# Delta for Gestione Cassa

**Change**: spese-su-registro-giornaliero
**Domain**: gestione-cassa

Questo delta estende il registro giornaliero perché ospiti **tutte** le spese secondo
l'asse contabile **TRACCIATO / NON-TRACCIATO**:

- `SpesaCassa` = spesa **NON tracciata**, sempre contanti. Acquisisce **solo** il campo
  `Categoria` (enum `CategoriaSpesa`: `Affitto | Utenze | Stipendi | Altro`). NON riceve
  `MetodoPagamento`.
- `PagamentoFornitore` = spesa **TRACCIATA** (`MetodoPagamento` string? già esistente).
  Acquisisce il campo `Categoria` per ospitare le spese fisse pagate in modo tracciato.
  `FatturaId`/`DdtId` sono già nullable → una spesa tracciata senza documento è ammessa.

Viene inoltre introdotto un percorso per registrare una spesa su un giorno privo di
registro (registro "leggero").

> **Vincolo invariante**: questa change NON tocca la formula `ContanteAtteso` né la
> riconciliazione del contante del giorno. `Categoria` è puramente classificatoria e MUST
> NOT influire su `SpeseGiornaliere`, `SpeseFornitori`, `ContanteAtteso` o `Differenza`.
> Il requirement "Formula ContanteAtteso corretta" resta **invariato**.

## ADDED Requirements

### Requirement: Categoria sulla spesa cassa (non tracciata)

Una `SpesaCassa` MUST poter acquisire una `Categoria` (enum `CategoriaSpesa`:
`Affitto | Utenze | Stipendi | Altro`) per classificare le spese fisse non tracciate
(pagate in contanti) sul registro giornaliero. La `SpesaCassa` MUST NOT esporre un campo
`MetodoPagamento`: per definizione è sempre contanti e non tracciata. L'aggiunta di
`Categoria` MUST NOT modificare il modo in cui `SpeseGiornaliere` viene calcolato
(`Σ SpesaCassa.Importo` del registro) né il valore di `ContanteAtteso`.

#### Scenario: Registrare una spesa fissa in contanti sul registro

- GIVEN un registro cassa giornaliero in editing
- WHEN l'utente aggiunge una riga `SpesaCassa` con `Descrizione = "Affitto locale"`,
  `Importo = 800 €` e `Categoria = Affitto`
- AND salva il registro con `mutateRegistroCassa`
- THEN la `SpesaCassa` viene persistita con `Categoria = Affitto`
- AND la riga concorre a `SpeseGiornaliere` esattamente come prima (800 € sottratti dal
  `ContanteAtteso` in quanto uscita di contanti)

#### Scenario: Categoria assente ammessa

- GIVEN un registro cassa in editing
- WHEN l'utente aggiunge una `SpesaCassa` senza specificare `Categoria` (spesa generica di cassa)
- THEN il salvataggio completa con successo
- AND la `SpesaCassa` è persistita con `Categoria` al valore di default previsto dal
  modello (`Altro` o nullable — fissato in design)

#### Scenario: Categoria non altera la riconciliazione del contante

- GIVEN due registri identici per incassi e importi spesa, uno con `Categoria` valorizzata
  sulle righe `SpesaCassa` e uno senza
- WHEN entrambi vengono salvati
- THEN `SpeseGiornaliere`, `ContanteAtteso` e `Differenza` sono identici tra i due registri

### Requirement: Categoria sul pagamento fornitore (tracciato) e spesa tracciata senza documento

Un `PagamentoFornitore` MUST poter acquisire una `Categoria` (enum `CategoriaSpesa`) per
ospitare le spese fisse pagate in modo **tracciato** (es. affitto/utenze/stipendi via
bonifico). Il `PagamentoFornitore` MUST poter essere registrato **senza documento**
(`FatturaId` e `DdtId` entrambi null), riusando il campo `MetodoPagamento` (string?) già
esistente per indicare il metodo tracciato (es. `Bonifico`). L'aggiunta di `Categoria`
MUST NOT modificare il calcolo di `SpeseFornitori` (`Σ PagamentoFornitore.Importo` linkati
al registro) né la formula `ContanteAtteso`.

#### Scenario: Registrare una spesa fissa via bonifico come pagamento fornitore senza documento

- GIVEN un registro cassa giornaliero in editing
- WHEN l'utente aggiunge un `PagamentoFornitore` con `Importo = 800 €`,
  `MetodoPagamento = "Bonifico"`, `Categoria = Affitto`, senza fattura e senza DDT
- AND salva il registro
- THEN il pagamento viene persistito con `Categoria = Affitto`, `MetodoPagamento = "Bonifico"`,
  `FatturaId = null` e `DdtId = null`
- AND nessuna fattura o DDT viene creato per quel pagamento

#### Scenario: Pagamento fornitore con documento conserva Categoria opzionale

- GIVEN un registro cassa in editing
- WHEN l'utente aggiunge un `PagamentoFornitore` con fattura acquisto n. "10" del fornitore A
  e senza `Categoria`
- THEN il salvataggio completa e il pagamento è persistito con la fattura associata
- AND `Categoria` resta al valore di default previsto dal modello

### Requirement: Registro "leggero" per una data senza registro

Il sistema MUST permettere di registrare una spesa su una data **priva di registro** (es.
affitto pagato in un giorno di chiusura non operativo) creando al volo un registro
giornaliero "leggero" (solo spese, senza vendite) tramite find-or-create sulla data. Il
percorso spese MUST bypassare `GuardGiornoOperativoConPeriodi` (una spesa non è
un'operazione di vendita) limitatamente a questo flusso. Il sistema MUST continuare ad
applicare `GuardMeseChiuso`: NON deve essere possibile registrare una spesa su una data
appartenente a un mese con chiusura `CHIUSA`/`RICONCILIATA`. L'indice UNIQUE su
`RegistroCassa.Data` MUST rendere l'operazione idempotente (una sola creazione per data).
Il meccanismo esatto (mutation dedicata vs estensione di `mutateRegistroCassa`, stato del
registro creato) è demandato al design.

#### Scenario: Spesa su giorno non operativo senza registro esistente

- GIVEN una data in un giorno di chiusura settimanale (non operativo) senza alcun registro
- AND il mese non ha una chiusura `CHIUSA`/`RICONCILIATA`
- WHEN l'utente registra una spesa (cash o tracciata) su quella data
- THEN viene creato un registro giornaliero "leggero" per quella data
- AND la spesa viene persistita agganciata a quel registro
- AND `GuardGiornoOperativoConPeriodi` non blocca l'operazione

#### Scenario: Registro già esistente riusato (idempotenza)

- GIVEN una data che ha già un registro (operativo o leggero)
- WHEN l'utente registra una nuova spesa su quella data
- THEN NON viene creato un secondo registro per quella data
- AND la spesa viene agganciata al registro esistente

#### Scenario: Spesa rifiutata su mese chiuso

- GIVEN una data appartenente a un mese con chiusura `CHIUSA` o `RICONCILIATA`
- WHEN l'utente tenta di registrare una spesa su quella data
- THEN `GuardMeseChiuso` blocca l'operazione con errore
- AND nessun registro leggero viene creato e nessuna spesa viene persistita

## MODIFIED Requirements

### Requirement: Esposizione GraphQL di SpesaCassa e PagamentoFornitore con Categoria

Lo schema GraphQL MUST esporre `categoria` sui tipi di spesa del registro:

- `SpesaCassaType` MUST esporre `categoria` (enum `CategoriaSpesa`); `SpesaCassaInputType`
  MUST accettare `categoria` in input. Nessuno dei due MUST esporre `metodoPagamento`.
- `PagamentoFornitoreType` MUST esporre `categoria`; il relativo input type MUST accettare
  `categoria`. Il field legacy `speseMensili` su `PagamentoFornitoreType` MUST essere
  rimosso (dipendeva dall'entità `SpesaMensile` eliminata da questa change).

La mutation `mutateRegistroCassa` MUST mappare `Categoria` sia sulle righe `SpesaCassa`
sia sui `PagamentoFornitore`. La mappatura MUST NOT alterare il calcolo derivato di
`SpeseGiornaliere` e `SpeseFornitori` né la formula `ContanteAtteso`.

(Precedentemente: `SpesaCassaType`/`SpesaCassaInputType` non avevano alcun campo
categoria; `PagamentoFornitoreType` esponeva il field legacy `speseMensili`.)

#### Scenario: SpesaCassa espone e accetta categoria, non il metodo di pagamento

- GIVEN lo schema GraphQL dopo la change
- WHEN si ispezionano `SpesaCassaType` e `SpesaCassaInputType`
- THEN entrambi espongono/accettano `categoria` di tipo `CategoriaSpesa`
- AND nessuno dei due espone/accetta `metodoPagamento`

#### Scenario: PagamentoFornitore espone categoria e non più speseMensili

- GIVEN lo schema GraphQL dopo la change
- WHEN si ispeziona `PagamentoFornitoreType`
- THEN il tipo espone `categoria`
- AND il field `speseMensili` non esiste più

#### Scenario: Round-trip della categoria tramite mutateRegistroCassa

- GIVEN un registro con una `SpesaCassa` (`Categoria = Utenze`) e un `PagamentoFornitore`
  (`Categoria = Stipendi`, `MetodoPagamento = "Bonifico"`)
- WHEN il registro viene salvato con `mutateRegistroCassa` e poi riletto
- THEN la `SpesaCassa` restituita ha `categoria = Utenze`
- AND il `PagamentoFornitore` restituito ha `categoria = Stipendi`
