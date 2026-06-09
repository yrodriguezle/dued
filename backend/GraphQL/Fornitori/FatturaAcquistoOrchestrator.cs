using GraphQL;

using duedgusto.Common;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.GraphQL.Fornitori.Types;

namespace duedgusto.GraphQL.Fornitori;

public class FatturaAcquistoOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;

    public FatturaAcquistoOrchestrator(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<FatturaAcquisto> MutateAsync(FatturaAcquistoInput input)
    {
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            FatturaAcquisto? fattura;

            if (input.FatturaId.HasValue)
            {
                fattura = await _unitOfWork.FattureAcquisto.GetByIdAsync(input.FatturaId.Value)
                    ?? throw new ExecutionError($"Fattura acquisto con ID {input.FatturaId} non trovata");
            }
            else
            {
                fattura = new FatturaAcquisto();
                _unitOfWork.FattureAcquisto.Add(fattura);
            }

            fattura.FornitoreId = input.FornitoreId;
            fattura.NumeroFattura = input.NumeroFattura;
            fattura.DataFattura = input.DataFattura;
            RisultatoIva applicazione = IvaCalculator.ApplicaSuImponibile(
                input.Imponibile, IvaCalculator.AliquotaDaPercentuale(input.AliquotaIva));
            fattura.Imponibile = applicazione.Imponibile;
            fattura.ImportoIva = applicazione.Iva;
            fattura.TotaleConIva = applicazione.Totale;
            fattura.DataScadenza = input.DataScadenza;
            fattura.Note = input.Note;
            fattura.Stato = input.Stato;
            fattura.UpdatedAt = DateTime.UtcNow;

            await _unitOfWork.SaveChangesAsync();

            // Crea pagamenti se forniti (INSERT con fattura già pagata)
            if (input.Pagamenti?.Count > 0)
            {
                foreach (PagamentoFornitoreInput pagInput in input.Pagamenti)
                {
                    _unitOfWork.PagamentiFornitori.Add(new PagamentoFornitore
                    {
                        FatturaId = fattura.FatturaId,
                        DataPagamento = pagInput.DataPagamento,
                        Importo = pagInput.Importo,
                        MetodoPagamento = pagInput.MetodoPagamento,
                        Note = pagInput.Note,
                    });
                }

                await _unitOfWork.SaveChangesAsync();

                // Ricalcola stato fattura dopo i pagamenti
                fattura.Pagamenti = (await _unitOfWork.PagamentiFornitori
                    .FindAsync(p => p.FatturaId == fattura.FatturaId)).ToList();
                FatturaAcquistoStatusHelper.RecalculateStato(fattura);

                await _unitOfWork.SaveChangesAsync();
            }

            await _unitOfWork.CommitTransactionAsync();

            return fattura;
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync();
            throw;
        }
    }

    public async Task<FatturaAcquisto> AssociaDdtAsync(int fatturaId, List<int> ddtIds)
    {
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            FatturaAcquisto fattura = await _unitOfWork.FattureAcquisto.GetByIdAsync(fatturaId)
                ?? throw new ExecutionError($"Fattura acquisto con ID {fatturaId} non trovata");

            List<DocumentoTrasporto> ddtList = (await _unitOfWork.DocumentiTrasporto
                .FindAsync(d => ddtIds.Contains(d.DdtId))).ToList();

            if (ddtList.Count != ddtIds.Count)
                throw new ExecutionError("Uno o più DDT non trovati");

            DocumentoTrasporto? ddtGiaAssociato = ddtList.FirstOrDefault(d => d.FatturaId != null);
            if (ddtGiaAssociato != null)
                throw new ExecutionError($"Il DDT {ddtGiaAssociato.NumeroDdt} è già associato a un'altra fattura");

            DocumentoTrasporto? ddtAltroFornitore = ddtList.FirstOrDefault(d => d.FornitoreId != fattura.FornitoreId);
            if (ddtAltroFornitore != null)
                throw new ExecutionError($"Il DDT {ddtAltroFornitore.NumeroDdt} non appartiene al fornitore della fattura");

            ddtList.ForEach(d => d.FatturaId = fatturaId);

            await RicalcolaTotaliFatturaAsync(fattura);

            fattura.UpdatedAt = DateTime.UtcNow;
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

    public async Task<FatturaAcquisto> DisassociaDdtAsync(int fatturaId, List<int> ddtIds)
    {
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            FatturaAcquisto fattura = await _unitOfWork.FattureAcquisto.GetByIdAsync(fatturaId)
                ?? throw new ExecutionError($"Fattura acquisto con ID {fatturaId} non trovata");

            List<DocumentoTrasporto> ddtList = (await _unitOfWork.DocumentiTrasporto
                .FindAsync(d => ddtIds.Contains(d.DdtId) && d.FatturaId == fatturaId)).ToList();

            if (ddtList.Count != ddtIds.Count)
                throw new ExecutionError("Uno o più DDT non trovati o non associati a questa fattura");

            ddtList.ForEach(d => d.FatturaId = null);

            await RicalcolaTotaliFatturaAsync(fattura);

            fattura.UpdatedAt = DateTime.UtcNow;
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

    private async Task RicalcolaTotaliFatturaAsync(FatturaAcquisto fattura)
    {
        List<DocumentoTrasporto> allDdt = (await _unitOfWork.DocumentiTrasporto
            .FindAsync(d => d.FatturaId == fattura.FatturaId)).ToList();

        decimal totale = allDdt.Sum(d => d.Importo ?? 0);

        // Derivazione inversa dell'aliquota dalla fattura (non è una formula IVA: resta invariata)
        decimal aliquota = fattura.ImportoIva != null && fattura.Imponibile > 0
            ? Math.Round(fattura.ImportoIva.Value / fattura.Imponibile * 100, 2)
            : 22m;

        RisultatoIva scorporo = IvaCalculator.ScorporaDaLordo(
            totale, IvaCalculator.AliquotaDaPercentuale(aliquota));
        fattura.TotaleConIva = scorporo.Totale;
        fattura.Imponibile = scorporo.Imponibile;
        fattura.ImportoIva = scorporo.Iva;
    }

    public async Task<bool> EliminaAsync(int fatturaId)
    {
        FatturaAcquisto fattura = await _unitOfWork.FattureAcquisto.GetByIdAsync(fatturaId)
                ?? throw new ExecutionError($"Fattura acquisto con ID {fatturaId} non trovata");

        _unitOfWork.FattureAcquisto.Remove(fattura);
        await _unitOfWork.SaveChangesAsync();

        return true;
    }
}
