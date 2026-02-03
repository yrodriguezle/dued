# Piano di Aggiornamento Client - Chiusure Mensili

## Sommario

Il backend ha completato la transizione dal **modello denormalizzato** al **modello referenziale puro** per le chiusure mensili. Questo documento descrive le modifiche necessarie al client (frontend) per adeguarsi alle nuove API GraphQL.

---

## 📋 Indice

1. [Cosa è Cambiato](#cosa-è-cambiato)
2. [Breaking Changes](#breaking-changes)
3. [Nuove Query e Mutations](#nuove-query-e-mutations)
4. [Migration Strategy](#migration-strategy)
5. [Esempi Pratici](#esempi-pratici)
6. [Checklist Aggiornamento](#checklist-aggiornamento)

---

## 🔄 Cosa è Cambiato

### Modello Vecchio (Denormalizzato)

```graphql
type ChiusuraMensile {
  chiusuraId: Int!
  anno: Int!
  mese: Int!

  # ❌ CAMPI RIMOSSI (denormalizzati)
  ricavoTotale: Decimal
  totaleContanti: Decimal
  totaleElettronici: Decimal
  totaleFatture: Decimal
  speseAggiuntive: Decimal
  ricavoNetto: Decimal

  # ❌ NAVIGATION PROPERTY RIMOSSA
  spese: [SpesaMensile]
}
```

### Modello Nuovo (Referenziale Puro)

```graphql
type ChiusuraMensile {
  chiusuraId: Int!
  anno: Int!
  mese: Int!
  ultimoGiornoLavorativo: DateTime!

  # ✅ PROPRIETÀ CALCOLATE (compute on-the-fly)
  ricavoTotaleCalcolato: Decimal!
  totaleContantiCalcolato: Decimal!
  totaleElettroniciCalcolato: Decimal!
  totaleFattureCalcolato: Decimal!
  speseAggiuntiveCalcolate: Decimal!
  ricavoNettoCalcolato: Decimal!

  # ✅ NUOVE NAVIGATION PROPERTIES (relazioni esplicite)
  registriInclusi: [RegistroCassaMensile]!
  speseLibere: [SpesaMensileLibera]!
  pagamentiInclusi: [PagamentoMensileFornitori]!

  stato: String!
  note: String
  chiusaDa: Int
  chiusaDaUtente: Utente
  chiusaIl: DateTime
  creatoIl: DateTime!
  aggiornatoIl: DateTime!
}
```

### Nuovi Tipi Introdotti

#### 1. RegistroCassaMensile

Join table tra `ChiusuraMensile` e `RegistroCassa` (registri giornalieri).

```graphql
type RegistroCassaMensile {
  chiusuraId: Int!
  registroId: Int!
  incluso: Boolean!

  chiusura: ChiusuraMensile!
  registro: RegistroCassa!
}
```

#### 2. SpesaMensileLibera

Sostituisce `SpesaMensile` per le spese senza pagamento fornitore.

```graphql
type SpesaMensileLibera {
  spesaId: Int!
  chiusuraId: Int!
  descrizione: String!
  importo: Decimal!
  categoria: CategoriaSpesa!  # Enum: Affitto, Utenze, Stipendi, Altro

  chiusura: ChiusuraMensile!
  creatoIl: DateTime!
  aggiornatoIl: DateTime!
}
```

#### 3. PagamentoMensileFornitori

Join table tra `ChiusuraMensile` e `PagamentoFornitore`.

```graphql
type PagamentoMensileFornitori {
  chiusuraId: Int!
  pagamentoId: Int!
  inclusoInChiusura: Boolean!

  chiusura: ChiusuraMensile!
  pagamento: PagamentoFornitore!
}
```

---

## ⚠️ Breaking Changes

### 1. Campi Rimossi da `ChiusuraMensile`

| Campo Vecchio | Campo Nuovo (Calcolato) | Note |
|--------------|------------------------|------|
| `ricavoTotale` | `ricavoTotaleCalcolato` | Somma da `registriInclusi` |
| `totaleContanti` | `totaleContantiCalcolato` | Somma da `registriInclusi` |
| `totaleElettronici` | `totaleElettroniciCalcolato` | Somma da `registriInclusi` |
| `totaleFatture` | `totaleFattureCalcolato` | Somma da `registriInclusi` |
| `speseAggiuntive` | `speseAggiuntiveCalcolate` | Somma da `speseLibere` + `pagamentiInclusi` |
| `ricavoNetto` | `ricavoNettoCalcolato` | `ricavoTotale - speseAggiuntive` |

**Azione richiesta**: Aggiornare tutte le query GraphQL del client per usare i nuovi nomi.

### 2. Navigation Property `spese` Rimossa

Prima:
```graphql
query {
  chiusureMensili {
    spese {
      descrizione
      importo
    }
  }
}
```

Dopo:
```graphql
query {
  chiusureMensili {
    speseLibere {
      descrizione
      importo
      categoria
    }
    pagamentiInclusi {
      inclusoInChiusura
      pagamento {
        descrizione
        importo
      }
    }
  }
}
```

### 3. Mutation `mutazioneChiusuraMensile` Rimossa

La vecchia mutation per creare/aggiornare chiusure è stata **completamente rimossa**. Usare le nuove mutations dedicate.

---

## ✅ Nuove Query e Mutations

### Query

#### 1. `chiusureMensili` - **AGGIORNATA**

```graphql
query GetChiusureMensili($year: Int) {
  chiusureMensili(year: $year) {
    chiusuraId
    anno
    mese
    ultimoGiornoLavorativo

    # ✅ Nuovi campi calcolati
    ricavoTotaleCalcolato
    totaleContantiCalcolato
    totaleElettroniciCalcolato
    totaleFattureCalcolato
    speseAggiuntiveCalcolate
    ricavoNettoCalcolato

    # ✅ Nuove relazioni
    registriInclusi {
      registroId
      incluso
      registro {
        data
        totaleVendite
        incassoContanteTracciato
        incassiElettronici
        incassiFattura
      }
    }

    speseLibere {
      spesaId
      descrizione
      importo
      categoria
    }

    pagamentiInclusi {
      pagamentoId
      inclusoInChiusura
      pagamento {
        descrizione
        importo
      }
    }

    stato
    note
    chiusaDa
    chiusaIl
  }
}
```

#### 2. `validaCompletezzaRegistri` - **NUOVA**

Valida che tutti i registri giornalieri del mese siano chiusi prima di creare la chiusura.

```graphql
query ValidaRegistri($anno: Int!, $mese: Int!) {
  validaCompletezzaRegistri(anno: $anno, mese: $mese)
}

# Ritorna: ["2026-02-05", "2026-02-10"]  (date con registri mancanti)
# Se array vuoto: tutto ok, si può creare la chiusura
```

### Mutations

#### 1. `creaChiusuraMensile` - **NUOVA**

Crea una nuova chiusura mensile con validazione automatica.

```graphql
mutation CreaChiusura($anno: Int!, $mese: Int!) {
  creaChiusuraMensile(anno: $anno, mese: $mese) {
    chiusuraId
    anno
    mese
    ricavoTotaleCalcolato
    stato
  }
}
```

**Validazione automatica**:
- Verifica che tutti i giorni lavorativi del mese abbiano registri chiusi
- Associa automaticamente tutti i registri del mese
- Associa automaticamente i pagamenti fornitori del mese
- Lancia `ExecutionError` se mancano registri

#### 2. `aggiungiSpesaLibera` - **NUOVA**

Aggiunge una spesa libera (affitto, utenze, stipendi) alla chiusura.

```graphql
mutation AggiungiSpesa(
  $chiusuraId: Int!,
  $descrizione: String!,
  $importo: Decimal!,
  $categoria: String!  # "Affitto", "Utenze", "Stipendi", "Altro"
) {
  aggiungiSpesaLibera(
    chiusuraId: $chiusuraId,
    descrizione: $descrizione,
    importo: $importo,
    categoria: $categoria
  ) {
    spesaId
    descrizione
    importo
    categoria
  }
}
```

#### 3. `includiPagamentoFornitore` - **NUOVA**

Associa un pagamento fornitore alla chiusura mensile.

```graphql
mutation IncludiPagamento(
  $chiusuraId: Int!,
  $pagamentoId: Int!
) {
  includiPagamentoFornitore(
    chiusuraId: $chiusuraId,
    pagamentoId: $pagamentoId
  )
}
```

#### 4. `chiudiChiusuraMensile` - **AGGIORNATA**

Cambia lo stato da `BOZZA` → `CHIUSA`. Ora usa il service layer.

```graphql
mutation ChiudiChiusura($chiusuraId: Int!) {
  chiudiChiusuraMensile(chiusuraId: $chiusuraId) {
    chiusuraId
    stato
    chiusaDa
    chiusaIl
  }
}
```

#### 5. `eliminaChiusuraMensile` - **INVARIATA**

Elimina una chiusura in stato BOZZA.

```graphql
mutation EliminaChiusura($chiusuraId: Int!) {
  eliminaChiusuraMensile(chiusuraId: $chiusuraId)
}
```

#### 6. `migraChiusureMensiliVecchioModello` - **DEPRECATA**

⚠️ **Non più funzionale**: i campi del vecchio modello sono stati rimossi dal database. Questa mutation ritorna un messaggio di errore.

---

## 🚀 Migration Strategy

### Fase 1: Aggiornamento Graduale delle Query (NON-BREAKING)

**Prima di cambiare le mutations**, aggiorna tutte le query per usare i nuovi campi calcolati.

1. **Trova tutti i file che usano query GraphQL** per chiusure mensili
2. **Sostituisci i campi vecchi con i nuovi**:
   ```diff
   query {
     chiusureMensili {
   -   ricavoTotale
   +   ricavoTotaleCalcolato
   -   totaleContanti
   +   totaleContantiCalcolato
   -   speseAggiuntive
   +   speseAggiuntiveCalcolate
     }
   }
   ```

3. **Aggiorna le navigation properties**:
   ```diff
   query {
     chiusureMensili {
   -   spese {
   -     descrizione
   -     importo
   -   }
   +   speseLibere {
   +     descrizione
   +     importo
   +     categoria
   +   }
   +   pagamentiInclusi {
   +     pagamento {
   +       descrizione
   +       importo
   +     }
   +   }
     }
   }
   ```

4. **Testa le query aggiornate** prima di procedere

### Fase 2: Aggiornamento Mutations (BREAKING)

1. **Sostituisci chiamate a `mutazioneChiusuraMensile`** con:
   - `creaChiusuraMensile` per creazione nuove chiusure
   - `aggiungiSpesaLibera` per aggiungere spese libere
   - `includiPagamentoFornitore` per associare pagamenti

2. **Esempio di conversione**:

   Prima (vecchio):
   ```typescript
   const result = await mutazioneChiusuraMensile({
     chiusura: {
       anno: 2026,
       mese: 2,
       ricavoTotale: 15000,
       speseAggiuntive: 3000,
       spese: [
         { descrizione: "Affitto", importo: 2000, categoria: "Affitto" }
       ]
     }
   });
   ```

   Dopo (nuovo):
   ```typescript
   // 1. Valida completezza registri
   const giorniMancanti = await validaCompletezzaRegistri({
     anno: 2026,
     mese: 2
   });

   if (giorniMancanti.length > 0) {
     alert(`Registri mancanti: ${giorniMancanti.join(', ')}`);
     return;
   }

   // 2. Crea chiusura (calcola automaticamente totali)
   const chiusura = await creaChiusuraMensile({
     anno: 2026,
     mese: 2
   });

   // 3. Aggiungi spese libere
   await aggiungiSpesaLibera({
     chiusuraId: chiusura.chiusuraId,
     descrizione: "Affitto",
     importo: 2000,
     categoria: "Affitto"
   });

   // 4. Visualizza totali calcolati
   console.log("Ricavo:", chiusura.ricavoTotaleCalcolato);
   console.log("Spese:", chiusura.speseAggiuntiveCalcolate);
   console.log("Netto:", chiusura.ricavoNettoCalcolato);
   ```

### Fase 3: Pulizia Codice Legacy

1. Rimuovi tutti i riferimenti a:
   - `ricavoTotale`, `totaleContanti`, etc. (senza suffisso `Calcolato`)
   - `spese` navigation property
   - `mutazioneChiusuraMensile` mutation

2. Aggiorna TypeScript types/interfaces:
   ```typescript
   interface ChiusuraMensile {
     chiusuraId: number;
     anno: number;
     mese: number;

     // ✅ Campi calcolati (sempre presenti)
     ricavoTotaleCalcolato: number;
     totaleContantiCalcolato: number;
     totaleElettroniciCalcolato: number;
     totaleFattureCalcolato: number;
     speseAggiuntiveCalcolate: number;
     ricavoNettoCalcolato: number;

     // ✅ Nuove relazioni
     registriInclusi: RegistroCassaMensile[];
     speseLibere: SpesaMensileLibera[];
     pagamentiInclusi: PagamentoMensileFornitori[];

     stato: string;
     note?: string;
     chiusaDa?: number;
     chiusaIl?: Date;
   }

   interface SpesaMensileLibera {
     spesaId: number;
     chiusuraId: number;
     descrizione: string;
     importo: number;
     categoria: CategoriaSpesa;
   }

   enum CategoriaSpesa {
     Affitto = "Affitto",
     Utenze = "Utenze",
     Stipendi = "Stipendi",
     Altro = "Altro"
   }
   ```

---

## 📚 Esempi Pratici

### Esempio 1: Creazione Nuova Chiusura Mensile

```typescript
async function creaChiusuraFebbraio2026() {
  // Step 1: Valida completezza
  const giorniMancanti = await client.query({
    query: gql`
      query {
        validaCompletezzaRegistri(anno: 2026, mese: 2)
      }
    `
  });

  if (giorniMancanti.data.validaCompletezzaRegistri.length > 0) {
    console.error("Registri mancanti:", giorniMancanti.data.validaCompletezzaRegistri);
    return;
  }

  // Step 2: Crea chiusura
  const result = await client.mutate({
    mutation: gql`
      mutation {
        creaChiusuraMensile(anno: 2026, mese: 2) {
          chiusuraId
          anno
          mese
          ricavoTotaleCalcolato
          speseAggiuntiveCalcolate
          ricavoNettoCalcolato

          registriInclusi {
            registroId
            incluso
          }
        }
      }
    `
  });

  console.log("Chiusura creata:", result.data.creaChiusuraMensile);
  return result.data.creaChiusuraMensile;
}
```

### Esempio 2: Aggiungere Spese alla Chiusura

```typescript
async function aggiungiSpeseChiusura(chiusuraId: number) {
  // Spesa 1: Affitto
  await client.mutate({
    mutation: gql`
      mutation AggiungiAffitto($chiusuraId: Int!) {
        aggiungiSpesaLibera(
          chiusuraId: $chiusuraId,
          descrizione: "Affitto locale commerciale",
          importo: 2500.00,
          categoria: "Affitto"
        ) {
          spesaId
          importo
        }
      }
    `,
    variables: { chiusuraId }
  });

  // Spesa 2: Utenze
  await client.mutate({
    mutation: gql`
      mutation AggiungiUtenze($chiusuraId: Int!) {
        aggiungiSpesaLibera(
          chiusuraId: $chiusuraId,
          descrizione: "Bollette luce e gas",
          importo: 450.00,
          categoria: "Utenze"
        ) {
          spesaId
          importo
        }
      }
    `,
    variables: { chiusuraId }
  });
}
```

### Esempio 3: Visualizzare Dettaglio Chiusura

```typescript
async function visualizzaDettaglioChiusura(chiusuraId: number) {
  const result = await client.query({
    query: gql`
      query GetChiusura($id: Int!) {
        chiusureMensili(year: null) {
          chiusuraId
          anno
          mese

          # Totali calcolati
          ricavoTotaleCalcolato
          totaleContantiCalcolato
          totaleElettroniciCalcolato
          totaleFattureCalcolato
          speseAggiuntiveCalcolate
          ricavoNettoCalcolato

          # Registri inclusi
          registriInclusi {
            registroId
            incluso
            registro {
              data
              totaleVendite
              stato
            }
          }

          # Spese libere
          speseLibere {
            spesaId
            descrizione
            importo
            categoria
          }

          # Pagamenti fornitori
          pagamentiInclusi {
            pagamentoId
            inclusoInChiusura
            pagamento {
              descrizione
              importo
              fornitore {
                nome
              }
            }
          }
        }
      }
    `
  });

  const chiusura = result.data.chiusureMensili.find(c => c.chiusuraId === chiusuraId);
  console.log("Dettaglio chiusura:", chiusura);

  return chiusura;
}
```

---

## ✅ Checklist Aggiornamento

### Backend (Completato ✓)

- [x] Creazione nuovi modelli (`RegistroCassaMensile`, `SpesaMensileLibera`, `PagamentoMensileFornitori`)
- [x] Migration database per nuove tabelle
- [x] Proprietà calcolate su `ChiusuraMensile`
- [x] Service layer (`ChiusuraMensileService`)
- [x] Nuove mutations GraphQL
- [x] Aggiornamento queries GraphQL
- [x] Rimozione campi obsoleti dal modello
- [x] Migration per drop colonne obsolete
- [x] Build verificato e funzionante

### Frontend (DA FARE)

- [ ] **Fase 1: Aggiornare Query**
  - [ ] Trovare tutti i file che usano query GraphQL chiusure mensili
  - [ ] Sostituire campi denormalizzati con campi calcolati (es. `ricavoTotale` → `ricavoTotaleCalcolato`)
  - [ ] Aggiornare navigation properties (`spese` → `speseLibere` + `pagamentiInclusi`)
  - [ ] Testare query aggiornate

- [ ] **Fase 2: Aggiornare Mutations**
  - [ ] Sostituire `mutazioneChiusuraMensile` con `creaChiusuraMensile`
  - [ ] Implementare logica per `aggiungiSpesaLibera`
  - [ ] Implementare logica per `includiPagamentoFornitore`
  - [ ] Aggiungere validazione con `validaCompletezzaRegistri` prima di creare chiusure
  - [ ] Testare flusso completo di creazione chiusura

- [ ] **Fase 3: Aggiornare TypeScript Types**
  - [ ] Definire nuove interfacce per `SpesaMensileLibera`, `PagamentoMensileFornitori`, `RegistroCassaMensile`
  - [ ] Aggiornare interfaccia `ChiusuraMensile`
  - [ ] Definire enum `CategoriaSpesa`
  - [ ] Rimuovere vecchie interfacce non più usate

- [ ] **Fase 4: Aggiornare UI**
  - [ ] Form creazione chiusura: rimuovere input manuali per totali
  - [ ] Form creazione chiusura: aggiungere validazione pre-creazione
  - [ ] Form spese: usare dropdown per categorie type-safe
  - [ ] Dettaglio chiusura: visualizzare registri inclusi
  - [ ] Dettaglio chiusura: separare spese libere e pagamenti fornitori
  - [ ] Dashboard: usare totali calcolati per statistiche

- [ ] **Fase 5: Testing**
  - [ ] Test E2E: creazione chiusura mensile completa
  - [ ] Test: validazione registri mancanti
  - [ ] Test: aggiunta spese libere
  - [ ] Test: chiusura mensile (BOZZA → CHIUSA)
  - [ ] Test: visualizzazione dettagli con nuove relazioni

- [ ] **Fase 6: Cleanup**
  - [ ] Rimuovere codice legacy riferito al vecchio modello
  - [ ] Rimuovere mutation `mutazioneChiusuraMensile` dal codice
  - [ ] Code review finale

---

## 📞 Supporto

Per domande o chiarimenti su questo refactoring, contattare il team backend o fare riferimento a:

- `PIANO_REFACTORING_CHIUSURE_MENSILI.md` - Piano tecnico completo del refactoring backend
- `Models/ChiusuraMensile.cs` - Modello aggiornato con proprietà calcolate
- `Services/ChiusureMensili/ChiusuraMensileService.cs` - Logica di business
- `GraphQL/ChiusureMensili/MonthlyClosuresMutations.cs` - Mutations disponibili
- `GraphQL/ChiusureMensili/MonthlyClosuresQueries.cs` - Queries disponibili

---

**Data documento**: 2026-02-03
**Versione backend**: Post-refactoring Opzione A (Modello Referenziale Puro)
**Migrations applicate**:
- `20260203093309_RifacimentoChiusureMensiliOpzioneA`
- `20260203134239_RimozioneColonneObsoleteChiusureMensili`
