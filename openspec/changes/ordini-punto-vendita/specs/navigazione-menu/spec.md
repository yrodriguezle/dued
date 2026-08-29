# Delta for Navigazione — «Vendita» a primo livello

**Change**: ordini-punto-vendita
**Date**: 2026-08-28
**Status**: Draft
**Base spec**: nessuna — dominio nuovo (le voci di menu non hanno oggi una spec propria)
**Fonti vincolanti**: issue #24 punto C

È il punto **C** della issue: indipendente da A e da B, costa poco, si fa per primo.

Convenzioni trasversali (vincolanti per i requirement):

- Le voci di menu si propagano **dal seed**, non da SQL a mano: `SeedMenus.UpdateMenuIfNeeded`
  sa già correggere una voce esistente, e il seed è idempotente per costruzione.
- La rotta è dinamica: `ProtectedRoutes.tsx` carica il componente da `PercorsoFile` tramite
  `loadDynamicComponent()`. Spostare la voce nella gerarchia MUST NOT cambiare né il percorso né
  il file caricato.

### Impatti sullo schema GraphQL

Nessuno. Il change tocca dati di seed (`Menus`), non lo schema: `MenuType` espone già
`menuPadreId`, `posizione`, `percorso`, `nomeVista` e `percorsoFile`.

---

## ADDED Requirements

### Requirement: «Vendita» è una voce di primo livello

La voce di menu «Vendita» MUST stare al **primo livello** della sidebar (`MenuPadreId == null`),
con una `Posizione` che la metta in alto. È la pagina che si apre cento volte al giorno da dietro
il bancone, e oggi è sepolta sotto «Cassa» insieme a quelle che si aprono una volta al mese.

`Percorso`, `NomeVista` e `PercorsoFile` MUST restare invariati (`/gestionale/cassa/vendita`,
`PuntoVendita`, `vendite/PuntoVendita.tsx`), così come l'icona `ShoppingCart`, già mappata in
`iconMapping.tsx`.

Il cambio MUST propagarsi al riavvio tramite il seed, senza toccare il database a mano, e MUST
essere idempotente.

#### Scenario: Database senza la voce

- GIVEN un database che non contiene la voce «Vendita»
- WHEN il seed gira all'avvio
- THEN la voce esiste con `MenuPadreId == null` e la posizione prevista
- AND la sidebar la mostra al primo livello

#### Scenario: 🔴 Database con la voce già annidata sotto «Cassa» — la FK deve azzerarsi davvero

- GIVEN un database in cui «Vendita» ha `MenuPadreId` che punta a «Cassa»
- WHEN il seed gira all'avvio e poi il processo viene riavviato
- THEN **nel database** `MenuPadreId` della voce «Vendita» è `NULL`
- AND la sidebar la mostra al primo livello, non più sotto «Cassa»

> Questo scenario pinna una trappola EF reale, e la verifica MUST avvenire **sul database dopo il
> riavvio**, non sull'entità tracciata in memoria: una verifica sull'oggetto in memoria sarebbe
> verde con la voce ancora annidata.
>
> `SeedMenus.UpdateMenuIfNeeded` sposta il padre con
> `if (menu.MenuPadreId != menuPadre?.Id) { menu.MenuPadre = menuPadre; needsUpdate = true; }`,
> ma la query che carica la voce in `SeedMenusVendita` fa `.Include(m => m.Ruoli)` e **non**
> carica `MenuPadre`. La navigazione è quindi già `null` in memoria mentre `MenuPadreId` è
> valorizzato: assegnarle `null` non produce alcuna modifica rilevata dal change tracker.
> `needsUpdate` diventa `true`, l'`Update` gira, la pipeline resta verde — e al riavvio la voce è
> ancora sotto «Cassa».

#### Scenario: Idempotenza

- GIVEN un database già allineato dopo un primo avvio
- WHEN il seed gira una seconda volta
- THEN nessuna modifica viene applicata e nessuna voce duplicata viene creata

#### Scenario: «Cassa» resta con i suoi figli

- GIVEN il menu «Cassa» con le altre voci figlie, fra cui «Prodotti»
- WHEN «Vendita» sale al primo livello
- THEN «Cassa» esiste ancora e conserva le altre voci figlie
- AND nessuna di esse cambia posizione in modo imprevisto

#### Scenario: Il primo livello resta ordinato

- GIVEN le voci di primo livello esistenti, Dashboard compresa
- WHEN «Vendita» prende la sua posizione
- THEN non esistono due voci di primo livello con la stessa posizione che si scambiano di posto a ogni caricamento

#### Scenario: La rotta dinamica continua a funzionare

- GIVEN la voce spostata al primo livello
- WHEN si naviga a `/gestionale/cassa/vendita`
- THEN `ProtectedRoutes` carica `vendite/PuntoVendita.tsx` come prima
- AND l'autorizzazione dei dati resta quella di prima: `this.Authorize()` sui tipi GraphQL

---

### Requirement: La voce «Vendita» è visibile a chiunque sia autenticato

*Chiude **D-C1**.*

La voce «Vendita» MUST essere assegnata a **tutti i ruoli**, non al solo SuperAdmin: la vendita non è
un'operazione amministrativa (#19 Fase 8) e la voce sta in cima alla sidebar.

🔴 L'allargamento riguarda **solo la visibilità della voce**. L'autorizzazione delle operazioni è un
meccanismo distinto e MUST restare invariata: `VenditeQueries` e `VenditeMutations` dichiarano
`this.Authorize()` a livello di tipo, cioè esigono un utente **autenticato** senza esigere un ruolo.
«Per chiunque» MUST significare **chiunque sia autenticato**, e MUST NOT introdurre alcun accesso
anonimo: nessun ramo GraphQL MUST perdere il proprio `Authorize`, in un progetto dove un modulo che non
lo dichiara è **pubblico per default**.

⚠️ L'assegnazione è additiva per costruzione (`SeedMenus.AssegnaRuoli` non toglie mai un ruolo):
allargare costa un riavvio, restringere richiederebbe SQL diretto sul VPS.

#### Scenario: Un ruolo non amministrativo vede la voce

- GIVEN un utente con un ruolo privo del flag `Amministratore`
- WHEN carica i propri menu dopo il seed
- THEN la voce «Vendita» è fra i suoi menu di primo livello

#### Scenario: Visibile non vuol dire aperto

- GIVEN un client non autenticato
- WHEN interroga i rami `vendite` dello schema GraphQL
- THEN la richiesta viene rifiutata per mancata autorizzazione
- AND l'allargamento dei ruoli della voce di menu non ha cambiato questo esito

#### Scenario: Un ruolo nuovo non perde la voce

- GIVEN un ruolo creato dopo il primo seed
- WHEN il seed gira al riavvio successivo
- THEN anche quel ruolo ha la voce «Vendita»
- AND nessun ruolo ha perso voci che aveva

---

## Decisioni di questo dominio — esito

| # | Domanda | Esito |
|---|---|---|
| **D-C1** | Se aprire la voce «Vendita» ad altri ruoli oltre a SuperAdmin. La vendita non è amministrativa (#19 Fase 8), ma la decisione non è mai stata presa | ✅ **Chiusa: per chiunque sia autenticato.** Pinnata dal requirement «La voce «Vendita» è visibile a chiunque sia autenticato» |

Nessuna decisione resta aperta in questo dominio.
