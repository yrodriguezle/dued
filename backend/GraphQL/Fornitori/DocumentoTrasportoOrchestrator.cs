using GraphQL;

using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.GraphQL.Fornitori.Types;
using duedgusto.Services.Fornitori;

namespace duedgusto.GraphQL.Fornitori;

public class DocumentoTrasportoOrchestrator(IUnitOfWork unitOfWork, RegistroCassaSyncService syncService)
{
    private readonly IUnitOfWork _unitOfWork = unitOfWork;
    private readonly RegistroCassaSyncService _syncService = syncService;

    public async Task<DocumentoTrasporto> MutateAsync(DocumentoTrasportoInput input, int utenteId)
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
                // Raggruppa per data per sincronizzare con i registri cassa
                var registriPerData = new Dictionary<DateTime, RegistroCassa>();

                foreach (PagamentoFornitoreInput pagInput in input.Pagamenti)
                {
                    DateTime dataKey = pagInput.DataPagamento.Date;
                    if (!registriPerData.TryGetValue(dataKey, out RegistroCassa? registro))
                    {
                        registro = await _syncService.FindOrCreateRegistroCassaAsync(pagInput.DataPagamento, utenteId);
                        registriPerData[dataKey] = registro;
                    }

                    _unitOfWork.PagamentiFornitori.Add(new PagamentoFornitore
                    {
                        DdtId = ddt.DdtId,
                        DataPagamento = pagInput.DataPagamento,
                        Importo = pagInput.Importo,
                        MetodoPagamento = pagInput.MetodoPagamento,
                        Note = pagInput.Note,
                        RegistroCassaId = registro.Id,
                    });
                }
                await _unitOfWork.SaveChangesAsync();

                // Ricalcola SpeseFornitori per ogni registro coinvolto
                await Task.WhenAll(registriPerData.Values.Select(r =>
                    _syncService.RecalculateSpeseFornitoriAsync(r.Id)));
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
        DocumentoTrasporto ddt = await _unitOfWork.DocumentiTrasporto.GetByIdAsync(ddtId)
                ?? throw new ExecutionError($"Documento di trasporto con ID {ddtId} non trovato");

        _unitOfWork.DocumentiTrasporto.Remove(ddt);
        await _unitOfWork.SaveChangesAsync();

        return true;
    }
}
