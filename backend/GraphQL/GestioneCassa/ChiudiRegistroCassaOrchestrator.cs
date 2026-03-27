using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;
using duedgusto.GraphQL.Subscriptions.Types;

namespace duedgusto.GraphQL.GestioneCassa;

public class ChiudiRegistroCassaOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ChiusuraMensileService _chiusuraService;
    private readonly IEventBus _eventBus;

    public ChiudiRegistroCassaOrchestrator(
        IUnitOfWork unitOfWork,
        ChiusuraMensileService chiusuraService,
        IEventBus eventBus)
    {
        _unitOfWork = unitOfWork;
        _chiusuraService = chiusuraService;
        _eventBus = eventBus;
    }

    public async Task<RegistroCassa> ExecuteAsync(int registroCassaId)
    {
        var db = _unitOfWork.Context;

        var registroCassa = await db.RegistriCassa
            .FirstOrDefaultAsync(r => r.Id == registroCassaId)
            ?? throw new Exception($"Registro cassa con ID {registroCassaId} non trovato");

        if (registroCassa.Stato == "CLOSED" || registroCassa.Stato == "RECONCILED")
            throw new Exception("Il registro cassa è già chiuso");

        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, registroCassa.Data);
        await GestioneCassaGuards.GuardGiornoOperativoSoloGlobale(db, registroCassa.Data);

        await _unitOfWork.BeginTransactionAsync();
        try
        {
            registroCassa.Stato = "CLOSED";
            registroCassa.AggiornatoIl = DateTime.UtcNow;

            await _unitOfWork.SaveChangesAsync();
            await _unitOfWork.CommitTransactionAsync();
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync();
            throw;
        }

        // Eventi pubblicati DOPO il commit della transazione
        _eventBus.Publish(new ChiusuraCassaCompletedEvent
        {
            RegistroCassaId = registroCassa.Id,
            Data = registroCassa.Data,
            TotaleChiusura = registroCassa.TotaleChiusura,
            Differenza = registroCassa.Differenza
        });

        _eventBus.Publish(new RegistroCassaUpdatedEvent
        {
            RegistroCassaId = registroCassa.Id,
            Data = registroCassa.Data,
            Stato = registroCassa.Stato,
            TotaleVendite = registroCassa.TotaleVendite,
            TotaleApertura = registroCassa.TotaleApertura,
            TotaleChiusura = registroCassa.TotaleChiusura,
            Azione = "CLOSED"
        });

        return registroCassa;
    }
}
