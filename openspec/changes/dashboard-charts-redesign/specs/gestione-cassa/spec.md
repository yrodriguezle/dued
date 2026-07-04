# Delta for Gestione Cassa

> Change: `dashboard-charts-redesign` — delta rispetto a `openspec/specs/gestione-cassa/specs.md`.
> Estensioni GraphQL additive e read-only: nessuna migrazione database, nessuna modifica a mutation o subscription.

## ADDED Requirements

### Requirement: Query aggregata riepilogoAnnuale

Il backend MUST esporre nel namespace GraphQL `gestioneCassa` una query `riepilogoAnnuale(anno: Int!)` che restituisce esattamente 12 elementi di tipo `RiepilogoMensileCassa`, uno per ciascun mese dell'anno richiesto (1–12, in ordine crescente). I mesi senza registri MUST essere presenti con tutti i valori monetari a 0 e `numeroRegistri` = 0.

Gli aggregati mensili MUST essere calcolati su TUTTI i registri del mese indipendentemente dallo stato (bozze incluse), con le stesse formule per-registro già usate dal dominio gestione-cassa:

- `totaleVendite` = Σ `TotaleVendite` del registro (fallback: movimento fisico + elettronici + fatture, come nel calcolo per-registro esistente)
- `ricavoTracciato` = Σ (`IncassoContanteTracciato` + `IncassiElettronici` + `IncassiFattura`)
- `ricavoNonTracciato` = Σ ((`TotaleChiusura` − `TotaleApertura`) − `IncassoContanteTracciato`)
- `speseTracciate` = Σ `SpeseFornitori`; `speseNonTracciate` = Σ `SpeseGiornaliere`

La query MUST essere read-only (nessun effetto collaterale) e MUST richiedere l'autorizzazione con le stesse regole delle altre query di `gestioneCassa`.

Modifica allo schema GraphQL (additiva):

```graphql
type GestioneCassaQuery {
  # ... campi esistenti invariati ...
  riepilogoAnnuale(anno: Int!): [RiepilogoMensileCassa!]!
}
```

#### Scenario: Anno con dati parziali

- GIVEN registri cassa presenti solo nei mesi di gennaio e marzo dell'anno richiesto
- WHEN un client esegue `gestioneCassa { riepilogoAnnuale(anno: X) { mese totaleVendite numeroRegistri } }`
- THEN la risposta contiene 12 elementi ordinati per mese 1–12
- AND gli elementi di gennaio e marzo contengono gli aggregati corretti, tutti gli altri hanno valori 0

#### Scenario: Coerenza con la somma dei registri

- GIVEN un mese con registri noti (chiusi e in bozza)
- WHEN si confronta l'elemento mensile di `riepilogoAnnuale` con la somma per-registro calcolata dalle formule normative sugli stessi registri
- THEN ogni campo aggregato coincide al centesimo con la somma dei registri
- AND i registri in bozza sono inclusi nell'aggregato

#### Scenario: Anno senza alcun registro

- GIVEN un anno senza registri cassa
- WHEN un client esegue `riepilogoAnnuale(anno)` per quell'anno
- THEN la risposta contiene 12 elementi con tutti i valori monetari a 0 e `numeroRegistri` = 0
- AND nessun errore GraphQL è restituito

#### Scenario: Accesso non autorizzato

- GIVEN una richiesta senza JWT valido
- WHEN il client esegue `riepilogoAnnuale(anno)`
- THEN la query è rifiutata con errore di autorizzazione (`ACCESS_DENIED`), coerentemente con le altre query di `gestioneCassa`

### Requirement: Campi tracciati su RiepilogoMensileCassa

Il tipo GraphQL `RiepilogoMensileCassa` MUST essere esteso in modo additivo con i campi: `ricavoTracciato`, `ricavoNonTracciato`, `speseTracciate`, `speseNonTracciate`, `incassoContanteTracciato`, `incassiElettronici`, `incassiFattura`, `totaleSpese`, `differenza`, `numeroRegistri` (tutti Decimal/Float non-null, tranne `numeroRegistri` Int non-null). I valori MUST rispettare le formule normative del requirement precedente, con `totaleSpese = speseTracciate + speseNonTracciate` e `differenza = totaleVendite − totaleSpese`.

I campi esistenti (`mese`, `anno`, `totaleVendite`, `totaleContanti`, `totaleElettronici`, `mediaGiornaliera`, `giorniConDifferenze`, `totaleIva`) MUST rimanere invariati per nome, tipo e semantica: la query esistente `GetRiepilogoMensile` e il consumer legacy `MonthlyView.tsx` MUST continuare a funzionare senza modifiche.

Modifica allo schema GraphQL (additiva):

```graphql
type RiepilogoMensileCassa {
  # ... campi esistenti invariati ...
  ricavoTracciato: Decimal!
  ricavoNonTracciato: Decimal!
  speseTracciate: Decimal!
  speseNonTracciate: Decimal!
  incassoContanteTracciato: Decimal!
  incassiElettronici: Decimal!
  incassiFattura: Decimal!
  totaleSpese: Decimal!
  differenza: Decimal!
  numeroRegistri: Int!
}
```

#### Scenario: Nuovi campi interrogabili sul riepilogo mensile

- GIVEN un mese con registri cassa
- WHEN un client esegue `riepilogoMensile(anno, mese)` richiedendo i nuovi campi tracciati
- THEN la risposta contiene i nuovi campi con valori conformi alle formule normative
- AND `differenza` = `totaleVendite` − `totaleSpese` al centesimo

#### Scenario: Retrocompatibilità della query esistente

- GIVEN la query `GetRiepilogoMensile` attuale del frontend (solo campi preesistenti)
- WHEN viene eseguita contro lo schema esteso
- THEN la risposta è identica per struttura e valori a quella pre-change
- AND nessun errore di validazione dello schema è restituito

### Requirement: Test di coerenza aggregato server vs somma registri

La suite di test backend MUST includere test di integrazione che verificano, su un dataset noto con registri multipli (inclusi campi null e registri in bozza), che gli aggregati di `riepilogoAnnuale` e i nuovi campi di `riepilogoMensile` coincidano al centesimo con la somma per-registro delle formule normative.

#### Scenario: Test di integrazione con dataset misto

- GIVEN un dataset di test con registri chiusi, in bozza, con campi null e con incassi in tutte le categorie
- WHEN i test di integrazione eseguono `riepilogoAnnuale` e `riepilogoMensile`
- THEN ogni aggregato coincide con la somma attesa calcolata dai singoli registri
- AND `dotnet test` è verde
