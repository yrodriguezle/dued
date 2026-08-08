using Microsoft.EntityFrameworkCore;

using GraphQL;

using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;
using duedgusto.GraphQL.Subscriptions.Types;
using duedgusto.DataAccess;

namespace duedgusto.GraphQL.GestioneCassa;

/// <summary>
/// Riporta a DRAFT un registro cassa già chiuso, per permettere la correzione di
/// dati errati (es. importazioni incomplete). Operazione riservata ai ruoli con
/// flag <see cref="Ruolo.Amministratore"/>.
/// </summary>
public class RiapriRegistroCassaOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ChiusuraMensileService _chiusuraService;
    private readonly IEventBus _eventBus;

    public RiapriRegistroCassaOrchestrator(
        IUnitOfWork unitOfWork,
        ChiusuraMensileService chiusuraService,
        IEventBus eventBus)
    {
        _unitOfWork = unitOfWork;
        _chiusuraService = chiusuraService;
        _eventBus = eventBus;
    }

    public async Task<RegistroCassa> ExecuteAsync(int registroCassaId, int utenteId)
    {
        AppDbContext db = _unitOfWork.Context;

        await GestioneCassaGuards.GuardUtenteAmministratore(db, utenteId);

        RegistroCassa registroCassa = await db.RegistriCassa
                .FirstOrDefaultAsync(r => r.Id == registroCassaId)
                ?? throw new ExecutionError($"Registro cassa con ID {registroCassaId} non trovato");

        if (registroCassa.Stato == "DRAFT")
            throw new ExecutionError("Il registro cassa è già in bozza");

        // Un registro riconciliato ha già prodotto effetti contabili a valle:
        // la riapertura passa da un annullamento esplicito della riconciliazione.
        if (registroCassa.Stato == "RECONCILED")
            throw new ExecutionError("Il registro cassa è riconciliato e non può essere riaperto");

        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, registroCassa.Data);

        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            registroCassa.Stato = "DRAFT";
            registroCassa.UpdatedAt = DateTime.UtcNow;

            await _unitOfWork.SaveChangesAsync();
        });

        // Evento pubblicato DOPO il commit della transazione
        _eventBus.Publish(new RegistroCassaUpdatedEvent
        {
            RegistroCassaId = registroCassa.Id,
            Data = registroCassa.Data,
            Stato = registroCassa.Stato,
            TotaleVendite = registroCassa.TotaleVendite,
            TotaleApertura = registroCassa.TotaleApertura,
            TotaleChiusura = registroCassa.TotaleChiusura,
            Azione = "REOPENED"
        });

        return registroCassa;
    }
}
