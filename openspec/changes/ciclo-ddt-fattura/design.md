# Design: Ciclo DDT → Fattura Acquisto

## Technical Approach

Aggiungere una query e due mutation al modulo GraphQL Fornitori per gestire il ciclo DDT→Fattura. Lato frontend, aggiungere un bottone "Preleva DDT" nella toolbar esistente (via prop `children`) che apre un dialog modale con griglia AG Grid per la selezione multipla. L'associazione/disassociazione avviene tramite mutation dedicate; il ricalcolo totale e gestito dal backend.

## Architecture Decisions

### Decision: Query diretta su AppDbContext vs Repository method

**Choice**: Query diretta su `AppDbContext` nel resolver GraphQL
**Alternatives considered**: Aggiungere metodo `GetApertiByFornitoreAsync()` al repository
**Rationale**: Il pattern esistente in `FornitoriQueries.cs` usa sempre `AppDbContext` direttamente nei resolver per le query di lettura (vedi `fornitori`, `fatturaAcquisto`, `documentoTrasporto`). I repository sono usati solo negli orchestrator per le operazioni di scrittura.

### Decision: Orchestrator singolo vs mutation inline

**Choice**: Estendere `FatturaAcquistoOrchestrator` con metodi `AssociaDdtAsync` e `DisassociaDdtAsync`
**Alternatives considered**: Logica inline nel resolver della mutation
**Rationale**: Il pattern esistente separa sempre la logica di business nell'orchestrator (transazioni, validazioni, SaveChanges). Le mutation nel resolver fanno solo `GetService<Orchestrator>` → `orchestrator.Method()`.

### Decision: Ricalcolo totale backend vs frontend

**Choice**: Il backend ricalcola `TotaleConIva`, `Imponibile`, `ImportoIva` dopo associazione/disassociazione
**Alternatives considered**: Il frontend calcola e invia i nuovi totali
**Rationale**: Il backend e gia l'autorita per il calcolo IVA (vedi `FatturaAcquistoOrchestrator.MutateAsync` linea `fattura.ImportoIva = Math.Round(input.Imponibile * input.AliquotaIva / 100, 2)`). Centralizzare il ricalcolo evita divergenze.

### Decision: Dialog con griglia AG Grid vs Searchbox

**Choice**: Dialog modale custom con griglia AG Grid e checkbox
**Alternatives considered**: Riutilizzare il componente `FormikSearchbox` esistente
**Rationale**: La searchbox gestisce selezione singola. Qui serve selezione multipla con vista tabellare degli importi e totale in tempo reale. La griglia AG Grid e gia usata ovunque nel progetto.

## Data Flow

### Prelievo DDT (Associazione)

```
[Toolbar: Preleva DDT]
        │
        ▼
[PrelevaDdtDialog] ──query──→ [GraphQL: documentiTrasportoAperti(fornitoreId)]
        │                              │
        │                              ▼
        │                     [AppDbContext: DocumentiTrasporto
        │                      .Where(FatturaId == null && FornitoreId == id)
        │                      .OrderByDescending(DataDdt)]
        │
        │ utente seleziona + conferma
        ▼
[mutation: associaDdtAFattura(fatturaId, ddtIds)]
        │
        ▼
[FatturaAcquistoOrchestrator.AssociaDdtAsync]
        │
        ├── Valida: tutti DDT con FatturaId == null
        ├── Valida: tutti DDT dello stesso fornitore della fattura
        ├── Set FatturaId su ogni DDT
        ├── Ricalcola: TotaleConIva = SUM(ddt.Importo ?? 0)
        ├── Ricalcola: Imponibile = TotaleConIva / (1 + AliquotaIva/100)
        ├── Ricalcola: ImportoIva = TotaleConIva - Imponibile
        └── Return fattura aggiornata
        │
        ▼
[FatturaAcquistoDetails: loadInvoiceData()] ── reload completo
```

### Disassociazione DDT

```
[Griglia DDT: bottone rimozione]
        │
        ▼
[Dialog conferma: useConfirm]
        │ utente conferma
        ▼
[mutation: disassociaDdtDaFattura(fatturaId, ddtIds)]
        │
        ▼
[FatturaAcquistoOrchestrator.DisassociaDdtAsync]
        │
        ├── Set FatturaId = null su ogni DDT
        ├── Ricalcola totali fattura (come sopra)
        └── Return fattura aggiornata
        │
        ▼
[FatturaAcquistoDetails: loadInvoiceData()] ── reload completo
```

## File Changes

| File | Action | Descrizione |
|------|--------|-------------|
| `backend/GraphQL/Fornitori/FornitoriQueries.cs` | Modify | Aggiungere query `documentiTrasportoAperti(fornitoreId)` |
| `backend/GraphQL/Fornitori/FornitoriMutations.cs` | Modify | Aggiungere mutation `associaDdtAFattura` e `disassociaDdtDaFattura` |
| `backend/GraphQL/Fornitori/FatturaAcquistoOrchestrator.cs` | Modify | Aggiungere metodi `AssociaDdtAsync` e `DisassociaDdtAsync` con ricalcolo totali |
| `duedgusto/src/graphql/fornitori/queries.tsx` | Modify | Aggiungere query `getDocumentiTrasportoAperti` |
| `duedgusto/src/graphql/fornitori/mutations.tsx` | Modify | Aggiungere mutation `associaDdtAFattura` e `disassociaDdtDaFattura` |
| `duedgusto/src/components/pages/fattureAcquisto/FatturaAcquistoDetails.tsx` | Modify | Bottone toolbar + handler apertura dialog + handler disassocia |
| `duedgusto/src/components/pages/fattureAcquisto/FatturaAcquistoForm.tsx` | Modify | Colonna azione rimozione DDT nella griglia DDT |
| `duedgusto/src/components/pages/fattureAcquisto/PrelevaDdtDialog.tsx` | Create | Dialog modale selezione DDT con griglia AG Grid |

## Interfaces / Contracts

### Backend: Nuova query GraphQL

```csharp
// In FornitoriQueries.cs — segue il pattern esistente con AppDbContext
Field<ListGraphType<DocumentoTrasportoType>, List<DocumentoTrasporto>>("documentiTrasportoAperti")
    .Argument<NonNullGraphType<IntGraphType>>("fornitoreId")
    .ResolveAsync(async context =>
    {
        AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
        int fornitoreId = context.GetArgument<int>("fornitoreId");
        return await dbContext.DocumentiTrasporto
            .Where(d => d.FornitoreId == fornitoreId && d.FatturaId == null)
            .OrderByDescending(d => d.DataDdt)
            .ToListAsync();
    });
```

### Backend: Nuove mutation GraphQL

```csharp
// In FornitoriMutations.cs
Field<FatturaAcquistoType>("associaDdtAFattura")
    .Argument<NonNullGraphType<IntGraphType>>("fatturaId")
    .Argument<NonNullGraphType<ListGraphType<NonNullGraphType<IntGraphType>>>>("ddtIds")
    .ResolveAsync(async context =>
    {
        FatturaAcquistoOrchestrator orchestrator = GraphQLService.GetService<FatturaAcquistoOrchestrator>(context);
        int fatturaId = context.GetArgument<int>("fatturaId");
        List<int> ddtIds = context.GetArgument<List<int>>("ddtIds");
        return await orchestrator.AssociaDdtAsync(fatturaId, ddtIds);
    });

Field<FatturaAcquistoType>("disassociaDdtDaFattura")
    .Argument<NonNullGraphType<IntGraphType>>("fatturaId")
    .Argument<NonNullGraphType<ListGraphType<NonNullGraphType<IntGraphType>>>>("ddtIds")
    .ResolveAsync(async context =>
    {
        FatturaAcquistoOrchestrator orchestrator = GraphQLService.GetService<FatturaAcquistoOrchestrator>(context);
        int fatturaId = context.GetArgument<int>("fatturaId");
        List<int> ddtIds = context.GetArgument<List<int>>("ddtIds");
        return await orchestrator.DisassociaDdtAsync(fatturaId, ddtIds);
    });
```

### Backend: Orchestrator methods

```csharp
// In FatturaAcquistoOrchestrator.cs
public async Task<FatturaAcquisto> AssociaDdtAsync(int fatturaId, List<int> ddtIds)
{
    await _unitOfWork.BeginTransactionAsync();
    try
    {
        FatturaAcquisto fattura = await _unitOfWork.FattureAcquisto.GetByIdAsync(fatturaId)
            ?? throw new ExecutionError($"Fattura acquisto con ID {fatturaId} non trovata");

        List<DocumentoTrasporto> ddtList = (await _unitOfWork.DocumentiTrasporto
            .FindAsync(d => ddtIds.Contains(d.DdtId))).ToList();

        // Validazioni
        if (ddtList.Count != ddtIds.Count)
            throw new ExecutionError("Uno o piu DDT non trovati");

        DocumentoTrasporto? ddtGiaAssociato = ddtList.FirstOrDefault(d => d.FatturaId != null);
        if (ddtGiaAssociato != null)
            throw new ExecutionError($"Il DDT {ddtGiaAssociato.NumeroDdt} e gia associato a un'altra fattura");

        DocumentoTrasporto? ddtAltroFornitore = ddtList.FirstOrDefault(d => d.FornitoreId != fattura.FornitoreId);
        if (ddtAltroFornitore != null)
            throw new ExecutionError($"Il DDT {ddtAltroFornitore.NumeroDdt} non appartiene al fornitore della fattura");

        // Associazione
        ddtList.ForEach(d => d.FatturaId = fatturaId);

        // Ricalcolo totali
        RicalcolaTotaliFattura(fattura);

        fattura.AggiornatoIl = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync();
        await _unitOfWork.CommitTransactionAsync();
        return fattura;
    }
    catch
    {
        await _unitOfWork.RollbackTransactionAsync();
        throw;
    }
}

private void RicalcolaTotaliFattura(FatturaAcquisto fattura)
{
    // Somma importi di TUTTI i DDT associati alla fattura
    List<DocumentoTrasporto> allDdt = _unitOfWork.DocumentiTrasporto
        .FindAsync(d => d.FatturaId == fattura.FatturaId).Result.ToList();

    decimal totale = allDdt.Sum(d => d.Importo ?? 0);
    decimal aliquota = fattura.ImportoIva != null && fattura.Imponibile > 0
        ? Math.Round(fattura.ImportoIva.Value / fattura.Imponibile * 100, 2)
        : 22m;

    fattura.TotaleConIva = totale;
    fattura.Imponibile = Math.Round(totale / (1 + aliquota / 100), 2);
    fattura.ImportoIva = totale - fattura.Imponibile;
}
```

### Frontend: Nuove query/mutation

```typescript
// queries.tsx
interface GetDocumentiTrasportoApertiData {
  fornitori: {
    documentiTrasportoAperti: DocumentoTrasporto[];
  };
}
interface GetDocumentiTrasportoApertiVariables {
  fornitoreId: number;
}
export const getDocumentiTrasportoAperti: TypedDocumentNode<
  GetDocumentiTrasportoApertiData,
  GetDocumentiTrasportoApertiVariables
> = gql`...`;

// mutations.tsx
interface AssociaDdtAFatturaData {
  fornitori: { associaDdtAFattura: FatturaAcquisto };
}
interface AssociaDdtAFatturaVariables {
  fatturaId: number;
  ddtIds: number[];
}
export const mutationAssociaDdtAFattura: TypedDocumentNode<...> = gql`...`;

interface DisassociaDdtDaFatturaData {
  fornitori: { disassociaDdtDaFattura: FatturaAcquisto };
}
interface DisassociaDdtDaFatturaVariables {
  fatturaId: number;
  ddtIds: number[];
}
export const mutationDisassociaDdtDaFattura: TypedDocumentNode<...> = gql`...`;
```

### Frontend: PrelevaDdtDialog props

```typescript
interface PrelevaDdtDialogProps {
  open: boolean;
  fornitoreId: number;
  onConfirm: (ddtIds: number[]) => Promise<void>;
  onClose: () => void;
}
```

## Testing Strategy

| Layer | Cosa testare | Approccio |
|-------|-------------|-----------|
| Backend | Build compiles | `dotnet build` |
| Frontend | TypeScript types | `npm run ts:check` |
| Frontend | Lint | `npm run lint` |
| Manuale | Flusso completo prelievo | Creare DDT per fornitore → creare fattura → prelevare DDT → verificare totali |
| Manuale | Disassociazione | Rimuovere DDT da fattura → verificare che torni disponibile |
| Manuale | Validazioni | Tentare di prelevare DDT di altro fornitore, DDT gia associati |

## Migration / Rollout

Nessuna migrazione DB necessaria. Il campo `DocumentoTrasporto.FatturaId` (FK nullable) e la relazione 1:N con `FatturaAcquisto` esistono gia nel database.

## Open Questions

- [x] Il "Preleva DDT" funziona solo in UPDATE → confermato nella proposta
- [ ] L'aliquota IVA per il ricalcolo: usare quella della fattura o quella del fornitore? → Design usa l'aliquota corrente della fattura (derivata dal rapporto ImportoIva/Imponibile, fallback 22%)
