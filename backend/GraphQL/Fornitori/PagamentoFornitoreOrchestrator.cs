using Microsoft.EntityFrameworkCore;

using GraphQL;

using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.GraphQL.Fornitori.Types;
using duedgusto.Services.Fornitori;

namespace duedgusto.GraphQL.Fornitori;

public class PagamentoFornitoreOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly RegistroCassaSyncService _syncService;

    public PagamentoFornitoreOrchestrator(
        IUnitOfWork unitOfWork,
        RegistroCassaSyncService syncService)
    {
        _unitOfWork = unitOfWork;
        _syncService = syncService;
    }

    public async Task<PagamentoFornitore> MutateAsync(PagamentoFornitoreInput input, int utenteId)
    {
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            PagamentoFornitore? payment;
            int? oldRegistroCassaId = null;

            if (input.PagamentoId.HasValue)
            {
                payment = await _unitOfWork.PagamentiFornitori.GetByIdAsync(input.PagamentoId.Value)
                    ?? throw new ExecutionError($"Pagamento fornitore con ID {input.PagamentoId} non trovato");

                // Cattura il vecchio registro per ricalcolo se la data cambia
                if (payment.DataPagamento.Date != input.DataPagamento.Date)
                {
                    oldRegistroCassaId = payment.RegistroCassaId;
                }
            }
            else
            {
                payment = new PagamentoFornitore();
                _unitOfWork.PagamentiFornitori.Add(payment);
            }

            payment.FatturaId = input.FatturaId;
            payment.DdtId = input.DdtId;
            payment.DataPagamento = input.DataPagamento;
            payment.Importo = input.Importo;
            payment.MetodoPagamento = input.MetodoPagamento;
            payment.Note = input.Note;
            payment.AggiornatoIl = DateTime.UtcNow;

            await _unitOfWork.SaveChangesAsync();

            // Aggiorna stato fattura se collegata
            if (payment.FatturaId.HasValue)
            {
                var invoice = await _unitOfWork.FattureAcquisto.Query()
                    .Include(i => i.Pagamenti)
                    .FirstOrDefaultAsync(i => i.FatturaId == payment.FatturaId.Value);

                if (invoice != null)
                {
                    FatturaAcquistoStatusHelper.RecalculateStato(invoice);
                    await _unitOfWork.SaveChangesAsync();
                }
            }

            // Sincronizza con il registro cassa
            var registro = await _syncService.FindOrCreateRegistroCassaAsync(input.DataPagamento, utenteId);
            payment.RegistroCassaId = registro.Id;
            await _unitOfWork.SaveChangesAsync();

            await _syncService.RecalculateSpeseFornitoriAsync(registro.Id);

            // Se la data è cambiata, ricalcola anche il vecchio registro
            if (oldRegistroCassaId.HasValue)
            {
                await _syncService.RecalculateSpeseFornitoriAsync(oldRegistroCassaId.Value);
            }

            await _unitOfWork.CommitTransactionAsync();

            return payment;
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync();
            throw;
        }
    }

    public async Task<bool> EliminaAsync(int pagamentoId)
    {
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            var payment = await _unitOfWork.PagamentiFornitori.GetByIdAsync(pagamentoId)
                ?? throw new ExecutionError($"Pagamento fornitore con ID {pagamentoId} non trovato");

            var fatturaId = payment.FatturaId;
            var registroCassaId = payment.RegistroCassaId;

            _unitOfWork.PagamentiFornitori.Remove(payment);
            await _unitOfWork.SaveChangesAsync();

            // Aggiorna stato fattura se era collegata
            if (fatturaId.HasValue)
            {
                var invoice = await _unitOfWork.FattureAcquisto.Query()
                    .Include(i => i.Pagamenti)
                    .FirstOrDefaultAsync(i => i.FatturaId == fatturaId.Value);

                if (invoice != null)
                {
                    FatturaAcquistoStatusHelper.RecalculateStato(invoice);
                    await _unitOfWork.SaveChangesAsync();
                }
            }

            // Ricalcola SpeseFornitori sul registro cassa se era linkato
            if (registroCassaId.HasValue)
            {
                await _syncService.RecalculateSpeseFornitoriAsync(registroCassaId.Value);
            }

            await _unitOfWork.CommitTransactionAsync();

            return true;
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync();
            throw;
        }
    }
}
