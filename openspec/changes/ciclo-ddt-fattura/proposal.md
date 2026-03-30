# Proposal: Ciclo DDT → Fattura Acquisto

## Intent

Attualmente i DDT (Documenti di Trasporto) e le Fatture di Acquisto vivono come entità slegate nel sistema. L'utente deve associare manualmente i DDT alle fatture editando singoli record. Nel flusso reale, un fornitore emette N DDT nel tempo, poi raggruppa tutto in un'unica fattura. Il programma deve supportare questo ciclo nativamente: l'utente seleziona i DDT aperti di un fornitore, li "preleva" nella fattura, e il sistema calcola automaticamente i totali e chiude il ciclo.

## Scope

### In Scope
- Bottone "Preleva DDT" nella toolbar della Fattura Acquisto
- Dialog di selezione DDT aperti filtrati per fornitore selezionato
- Associazione batch dei DDT selezionati alla fattura (set `FatturaId`)
- Ricalcolo automatico del totale fattura dalla somma importi DDT
- Evidenza visiva dei DDT "scaricati" (associati) vs "aperti" nella lista DDT
- Possibilita di disassociare un DDT dalla fattura (tornare "aperto")
- Query backend per DDT aperti per fornitore
- Mutation backend per associazione/disassociazione batch

### Out of Scope
- Creazione DDT dalla pagina fattura (esiste gia il CRUD DDT separato)
- Workflow di approvazione/firma digitale dei DDT
- Generazione automatica numero fattura
- Stampa/export PDF della fattura con DDT allegati
- Gestione pagamenti legati ai DDT (esiste gia)

## Approach

1. **Backend**: Aggiungere una query `documentiTrasportoAperti(fornitoreId)` che ritorna i DDT con `FatturaId = null` per un dato fornitore. Aggiungere una mutation `associaDdtAFattura(fatturaId, ddtIds)` che in una singola transazione setta il `FatturaId` su tutti i DDT selezionati e ricalcola il totale fattura. Aggiungere `disassociaDdtDaFattura(ddtIds)` per l'operazione inversa.

2. **Frontend**: Aggiungere un bottone "Preleva DDT" nella toolbar di `FatturaAcquistoDetails` (visibile solo quando c'e un fornitore selezionato). Al click si apre un dialog modale con una griglia AG Grid che mostra i DDT aperti del fornitore. L'utente seleziona con checkbox, conferma, e i DDT vengono associati. Il totale fattura si aggiorna automaticamente. Nella griglia DDT gia presente nella fattura, aggiungere un'azione per disassociare.

3. **Flusso INSERT**: Il "Preleva DDT" funziona solo in modalita UPDATE (fattura gia salvata), perche serve un `fatturaId` per l'associazione. In INSERT, l'utente prima salva la fattura base (fornitore + numero + data), poi preleva i DDT.

## Affected Areas

| Area | Impact | Descrizione |
|------|--------|-------------|
| `backend/GraphQL/Fornitori/FornitoriQueries.cs` | Modified | Nuova query `documentiTrasportoAperti` |
| `backend/GraphQL/Fornitori/FornitoriMutations.cs` | Modified | Nuove mutation `associaDdtAFattura`, `disassociaDdtDaFattura` |
| `backend/GraphQL/Fornitori/FatturaAcquistoOrchestrator.cs` | Modified | Logica associazione batch + ricalcolo totale |
| `duedgusto/src/graphql/fornitori/queries.tsx` | Modified | Nuova query frontend |
| `duedgusto/src/graphql/fornitori/mutations.tsx` | Modified | Nuove mutation frontend |
| `duedgusto/src/components/pages/fattureAcquisto/FatturaAcquistoDetails.tsx` | Modified | Bottone toolbar + handler prelievo |
| `duedgusto/src/components/pages/fattureAcquisto/FatturaAcquistoForm.tsx` | Modified | Azione disassocia nella griglia DDT |
| `duedgusto/src/components/pages/fattureAcquisto/PrelevaDdtDialog.tsx` | New | Dialog modale selezione DDT |

## Risks

| Rischio | Probabilita | Mitigazione |
|---------|-------------|-------------|
| Race condition: due utenti prelevano lo stesso DDT contemporaneamente | Bassa | Transazione DB con lock ottimistico; la mutation verifica che `FatturaId` sia ancora null |
| Totale fattura diverge dalla somma DDT dopo modifica manuale | Media | Il totale calcolato dai DDT sovrascrive il campo; avviso se l'utente modifica manualmente |
| DDT senza importo (null) causa errore nel calcolo totale | Bassa | Trattare importo null come 0 nella somma |

## Rollback Plan

- **Backend**: Rimuovere le nuove query/mutation. Nessuna migrazione DB necessaria (il campo `FatturaId` esiste gia).
- **Frontend**: Rimuovere il bottone toolbar, il dialog, e le query/mutation frontend. La griglia DDT nella fattura continua a funzionare come prima.
- **Dati**: I DDT gia associati restano associati (nessun dato perso). Per disassociarli basta settare `FatturaId = null`.

## Dependencies

- Il campo `DocumentoTrasporto.FatturaId` (FK nullable) esiste gia nel database
- La relazione 1:N `FatturaAcquisto → DocumentoTrasporto` e gia configurata in EF Core
- Nessuna migrazione DB necessaria

## Success Criteria

- [ ] L'utente puo prelevare DDT aperti di un fornitore dalla fattura acquisto
- [ ] I DDT prelevati risultano "scaricati" e non appaiono piu nella selezione
- [ ] Il totale fattura si aggiorna automaticamente sommando gli importi DDT
- [ ] L'utente puo disassociare un DDT dalla fattura, rendendolo nuovamente disponibile
- [ ] La query filtra correttamente per fornitore e stato aperto (FatturaId = null)
- [ ] L'associazione batch funziona in una singola transazione atomica
- [ ] Il bottone "Preleva DDT" e visibile solo in UPDATE con fornitore selezionato
