using Microsoft.EntityFrameworkCore;

using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;

namespace duedgusto.GraphQL.GestioneCassa;

public class EliminaRegistroCassaOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ChiusuraMensileService _chiusuraService;

    public EliminaRegistroCassaOrchestrator(
        IUnitOfWork unitOfWork,
        ChiusuraMensileService chiusuraService)
    {
        _unitOfWork = unitOfWork;
        _chiusuraService = chiusuraService;
    }

    public async Task<bool> ExecuteAsync(int registroCassaId)
    {
        var db = _unitOfWork.Context;

        var registroCassa = await db.RegistriCassa
            .Include(r => r.ConteggiMoneta)
            .Include(r => r.SpeseCassa)
            .FirstOrDefaultAsync(r => r.Id == registroCassaId)
            ?? throw new Exception($"Registro cassa con ID {registroCassaId} non trovato");

        if (registroCassa.Stato != "DRAFT")
            throw new Exception("Solo i registri cassa in bozza possono essere eliminati");

        await GestioneCassaGuards.GuardMeseChiusoPerEliminazione(_chiusuraService, registroCassa.Data);

        await _unitOfWork.BeginTransactionAsync();
        try
        {
            db.RegistriCassa.Remove(registroCassa);
            await _unitOfWork.SaveChangesAsync();
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
