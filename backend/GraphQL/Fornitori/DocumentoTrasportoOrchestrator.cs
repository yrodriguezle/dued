using GraphQL;

using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.GraphQL.Fornitori.Types;

namespace duedgusto.GraphQL.Fornitori;

public class DocumentoTrasportoOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;

    public DocumentoTrasportoOrchestrator(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<DocumentoTrasporto> MutateAsync(DocumentoTrasportoInput input)
    {
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            DocumentoTrasporto? ddt;

            if (input.DdtId.HasValue)
            {
                ddt = await _unitOfWork.DocumentiTrasporto.GetByIdAsync(input.DdtId.Value)
                    ?? throw new ExecutionError($"Documento di trasporto con ID {input.DdtId} non trovato");
            }
            else
            {
                ddt = new DocumentoTrasporto();
                _unitOfWork.DocumentiTrasporto.Add(ddt);
            }

            ddt.FatturaId = input.FatturaId;
            ddt.FornitoreId = input.FornitoreId;
            ddt.NumeroDdt = input.NumeroDdt;
            ddt.DataDdt = input.DataDdt;
            ddt.Importo = input.Importo;
            ddt.Note = input.Note;
            ddt.AggiornatoIl = DateTime.UtcNow;

            await _unitOfWork.SaveChangesAsync();

            // Crea pagamenti se forniti (INSERT con DDT già pagato)
            if (input.Pagamenti?.Count > 0)
            {
                foreach (var pagInput in input.Pagamenti)
                {
                    _unitOfWork.PagamentiFornitori.Add(new PagamentoFornitore
                    {
                        DdtId = ddt.DdtId,
                        DataPagamento = pagInput.DataPagamento,
                        Importo = pagInput.Importo,
                        MetodoPagamento = pagInput.MetodoPagamento,
                        Note = pagInput.Note,
                    });
                }
                await _unitOfWork.SaveChangesAsync();
            }

            await _unitOfWork.CommitTransactionAsync();

            return ddt;
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync();
            throw;
        }
    }

    public async Task<bool> EliminaAsync(int ddtId)
    {
        var ddt = await _unitOfWork.DocumentiTrasporto.GetByIdAsync(ddtId)
            ?? throw new ExecutionError($"Documento di trasporto con ID {ddtId} non trovato");

        _unitOfWork.DocumentiTrasporto.Remove(ddt);
        await _unitOfWork.SaveChangesAsync();

        return true;
    }
}
