# Delta for Manutenibilità Frontend

**Change**: qualita-fase4
**Date**: 2026-06-10
**Status**: Draft

> Nota: refactor conservativi a comportamento invariato, nessuna modifica funzionale
> visibile. Dominio nuovo: tutte le requirement sono ADDED. Le requirement di questo
> dominio appartengono ai blocchi P2/P3 della proposal (sacrificabili in corso d'opera
> senza invalidare la change), TRANNE gli smoke test, che sono prerequisito dei
> refactor P2.
>
> Stato attuale verificato nel codice:
> - Pattern CRUD duplicato: `useInitializeValues.tsx` per-modulo in 16 file,
>   `setInitialFocus.tsx` in 21 file. Modulo pilota scelto: **fornitori**
>   (`useInitializeValues` = defaults + `mergeWithDefaults` + guard `initialized` +
>   focus iniziale solo per form nuovo; `setInitialFocus` = focus sul campo
>   `ragioneSociale`).
> - `RegistroCassaDetails.tsx` (629 righe): 3 subscription + 3 `useEffect` quasi
>   identici (righe 132-167, pattern "se l'evento riguarda il registro corrente →
>   refetch"). `MonthlyClosureDetails.tsx`: 945 righe.
> - `any` in scope: `src/common/bones/` (`debounce`, `omitDeep`, `differenceBy`, e
>   secondariamente `isEqual`, `unionBy`, `uniq`), `businessSettingsStore.tsx:33`
>   (`set: any`), `parseSettingsFromRaw.tsx` (input `any` + cast interni).
> - IconButton senza `aria-label`: 18 dei 20 file componente con `IconButton`.
> - Test componenti pagina: nessun test per `RegistroCassaDetails`,
>   `MonthlyClosureDetails`, `FatturaAcquistoDetails`.

## ADDED Requirements

### Requirement: Hook generico useCrudForm applicato al modulo pilota fornitori

Il sistema MUST fornire un hook generico `useCrudForm<T>` che assorbe il pattern
duplicato di inizializzazione form CRUD (valori di default, merge dei valori caricati,
guard di inizializzazione singola, focus iniziale). L'API dell'hook MUST essere
derivata dall'intersezione reale dei duplicati esistenti (`useInitializeValues` +
`setInitialFocus` per-modulo). L'hook MUST essere adottato nel SOLO modulo fornitori;
tutti gli altri moduli MUST restare invariati (rollout fuori scope). I file locali
`useInitializeValues.tsx` e `setInitialFocus.tsx` del modulo fornitori MUST essere
eliminati.

#### Scenario: Nuovo fornitore — defaults e focus iniziale

- GIVEN l'utente apre il form fornitore in modalità creazione
- WHEN il form viene inizializzato
- THEN i valori iniziali sono i default del modulo (es. `paese: "IT"`, `attivo: true`, `aliquotaIva: 22`)
- AND il focus è sul campo `ragioneSociale`

#### Scenario: Fornitore esistente — caricamento valori senza focus forzato

- GIVEN l'utente apre un fornitore esistente
- WHEN i dati vengono caricati e passati all'inizializzazione
- THEN i valori del fornitore vengono fusi con i default (i campi assenti restano ai default)
- AND il focus iniziale NON viene forzato (comportamento attuale: focus solo quando non ci sono valori)

#### Scenario: Inizializzazione singola

- GIVEN un form fornitore già inizializzato
- WHEN il componente ri-renderizza senza nuovi valori da caricare
- THEN l'inizializzazione non viene rieseguita (nessun reset dei valori digitati)

#### Scenario: Comportamento dirty/submit invariato

- GIVEN il modulo fornitori migrato a `useCrudForm`
- WHEN l'utente modifica un campo e salva
- THEN lo stato dirty, la validazione e il submit si comportano esattamente come prima della migrazione

#### Scenario: Altri moduli intatti

- GIVEN i ~15 moduli CRUD non pilota (users, roles, menu, fattureAcquisto, ecc.)
- WHEN la change viene completata
- THEN i loro file `useInitializeValues.tsx`/`setInitialFocus.tsx` locali sono invariati e funzionanti

### Requirement: Estrazione hook subscription da RegistroCassaDetails

Le 3 subscription con i 3 `useEffect` quasi identici di `RegistroCassaDetails.tsx`
MUST essere estratte in un hook dedicato (`useRegistroCassaSubscriptions`) come "lift"
del codice esistente, senza riordinare le dipendenze né ristrutturare il render. Il
comportamento osservabile MUST restare identico: quando un evento di subscription
riguarda il registro corrente, viene eseguito il refetch come prima. Il consolidamento
dello stato `initial*` MAY avvenire solo se a costo zero di comportamento.

#### Scenario: Refetch su evento del registro corrente

- GIVEN la pagina del registro cassa aperta su una data
- WHEN arriva un evento di subscription relativo al registro corrente
- THEN viene eseguito il refetch dei dati come prima dell'estrazione

#### Scenario: Evento di un altro registro ignorato

- GIVEN la pagina del registro cassa aperta su una data
- WHEN arriva un evento di subscription relativo a un registro diverso
- THEN non viene eseguito alcun refetch (comportamento attuale invariato)

### Requirement: Estrazione hook conservativa da MonthlyClosureDetails

I blocchi di logica auto-contenuti di `MonthlyClosureDetails.tsx` (subscription,
derivazioni) MUST essere estratti in custom hook come spostamento di codice a
comportamento invariato. Il componente MUST NOT essere scomposto in sotto-componenti
in questa fase (fuori scope).

#### Scenario: Comportamento della pagina invariato

- GIVEN la pagina di chiusura mensile con dati reali mockati
- WHEN gli hook vengono estratti
- THEN il rendering, i refetch su eventi e i valori derivati mostrati sono identici a prima
- AND gli smoke test scritti prima del refactor restano verdi

### Requirement: Eliminazione di any nei file in scope senza cambi di comportamento

I file in scope MUST essere tipizzati eliminando `any` (e i relativi
`eslint-disable @typescript-eslint/no-explicit-any`) senza alcun cambiamento di
comportamento runtime:

- `src/common/bones/debounce`, `omitDeep`, `differenceBy` MUST usare generics/tipi espliciti; `isEqual`, `unionBy`, `uniq` SHOULD essere tipizzati nello stesso intervento;
- `src/store/businessSettingsStore.tsx` MUST tipizzare il parametro `set` con la firma Zustand corretta;
- `src/graphql/settings/parseSettingsFromRaw.tsx` MUST tipizzare l'input sulla shape della query settings.

I nuovi tipi MUST accettare tutti gli usi attuali: i call site MUST NOT richiedere
nuovi cast per compilare.

#### Scenario: Type check e lint verdi senza nuovi cast

- GIVEN i file in scope tipizzati
- WHEN vengono eseguiti `npm run ts:check` e `npm run lint`
- THEN entrambi passano senza errori
- AND nessun call site esistente ha richiesto l'aggiunta di cast o `any` per compilare

#### Scenario: Comportamento runtime invariato

- GIVEN le utility bones tipizzate
- WHEN vengono eseguiti i test unitari esistenti su bones e store
- THEN tutti i test passano con gli stessi risultati di prima

#### Scenario: Zero eslint-disable residui nei file in scope

- GIVEN i file elencati (bones in scope, `businessSettingsStore`, `parseSettingsFromRaw`, `useFetchData`)
- WHEN si cercano occorrenze di `eslint-disable @typescript-eslint/no-explicit-any`
- THEN non ne esiste alcuna in quei file

### Requirement: aria-label su tutti gli IconButton senza testo

Tutti gli `IconButton` privi di testo visibile nei 18 file componente individuati MUST
avere un attributo `aria-label` con una stringa italiana che descrive l'azione (es.
"Elimina riga", "Chiudi finestra"). L'aspetto visivo e il comportamento dei pulsanti
MUST restare invariati.

#### Scenario: Pulsante icona accessibile

- GIVEN un `IconButton` solo-icona in uno dei file in scope
- WHEN il componente viene renderizzato
- THEN il pulsante è individuabile via ruolo accessibile con nome italiano descrittivo (es. `getByRole("button", { name: "Elimina riga" })`)

#### Scenario: Copertura completa dei file in scope

- GIVEN i 18 file componente con `IconButton` privi di `aria-label`
- WHEN la change viene completata
- THEN ogni `IconButton` senza testo in quei file ha un `aria-label` italiano

### Requirement: Smoke test dei componenti pagina critici come rete di sicurezza

Il sistema MUST avere smoke test di rendering per `RegistroCassaDetails`,
`MonthlyClosureDetails` e `FatturaAcquistoDetails`, con provider mockati (Apollo
`MockedProvider`, store Zustand, router). Ogni test MUST verificare che il componente
monti senza errori e mostri gli elementi chiave della pagina. Questi test MUST essere
scritti e verdi PRIMA delle estrazioni hook (P2) sugli stessi componenti e MUST
restare verdi dopo.

#### Scenario: Rendering happy-path senza crash

- GIVEN provider mockati con dati validi per la pagina
- WHEN il componente pagina viene renderizzato nel test
- THEN il mount completa senza errori
- AND gli elementi chiave della pagina (titolo/sezioni principali/azioni) sono visibili

#### Scenario: Harness di regressione per i refactor P2

- GIVEN gli smoke test verdi sul codice pre-refactor
- WHEN vengono eseguite le estrazioni hook su `RegistroCassaDetails` e `MonthlyClosureDetails`
- THEN gli stessi smoke test passano senza modifiche ai test stessi
