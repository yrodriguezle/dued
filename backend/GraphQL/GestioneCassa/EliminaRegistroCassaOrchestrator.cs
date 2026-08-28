using Microsoft.EntityFrameworkCore;

using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;
using duedgusto.DataAccess;
using duedgusto.Models;

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
        AppDbContext db = _unitOfWork.Context;

        RegistroCassa registroCassa = await db.RegistriCassa
                .Include(r => r.ConteggiMoneta)
                .Include(r => r.SpeseCassa)
                .FirstOrDefaultAsync(r => r.Id == registroCassaId)
                ?? throw new Exception($"Registro cassa con ID {registroCassaId} non trovato");

        if (registroCassa.Stato != "DRAFT")
            throw new Exception("Solo i registri cassa in bozza possono essere eliminati");

        await GestioneCassaGuards.GuardMeseChiusoPerEliminazione(_chiusuraService, registroCassa.Data);

        // Gli ordini NON cascatano con il registro (FK Restrict): senza questo controllo il
        // rifiuto arriverebbe dal database come un 500 opaco invece che come un errore leggibile.
        await GestioneCassaGuards.GuardNessunOrdineSulRegistro(db, registroCassaId);

        return await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            db.RegistriCassa.Remove(registroCassa);
            await _unitOfWork.SaveChangesAsync();

            return true;
        });
    }
}
