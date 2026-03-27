using GraphQL;

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
            fattura.Imponibile = input.Imponibile;
            fattura.ImportoIva = Math.Round(input.Imponibile * input.AliquotaIva / 100, 2);
            fattura.TotaleConIva = input.Imponibile + fattura.ImportoIva;
            fattura.DataScadenza = input.DataScadenza;
            fattura.Note = input.Note;
            fattura.Stato = input.Stato;
            fattura.AggiornatoIl = DateTime.UtcNow;

            await _unitOfWork.SaveChangesAsync();

            // Crea pagamenti se forniti (INSERT con fattura già pagata)
            if (input.Pagamenti?.Count > 0)
            {
                foreach (var pagInput in input.Pagamenti)
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

    public async Task<bool> EliminaAsync(int fatturaId)
    {
        var fattura = await _unitOfWork.FattureAcquisto.GetByIdAsync(fatturaId)
            ?? throw new ExecutionError($"Fattura acquisto con ID {fatturaId} non trovata");

        _unitOfWork.FattureAcquisto.Remove(fattura);
        await _unitOfWork.SaveChangesAsync();

        return true;
    }
}
