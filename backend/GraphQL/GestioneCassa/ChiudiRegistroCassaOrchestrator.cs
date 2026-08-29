using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;
using duedgusto.GraphQL.Subscriptions.Types;
using duedgusto.DataAccess;

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
        AppDbContext db = _unitOfWork.Context;

        RegistroCassa registroCassa = await db.RegistriCassa
                .FirstOrDefaultAsync(r => r.Id == registroCassaId)
                ?? throw new Exception($"Registro cassa con ID {registroCassaId} non trovato");

        if (registroCassa.Stato == "CLOSED" || registroCassa.Stato == "RECONCILED")
            throw new Exception("Il registro cassa è già chiuso");

        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, registroCassa.Data);
        await GestioneCassaGuards.GuardGiornoOperativoConPeriodi(db, registroCassa.Data, "chiudere");

        // ⚠️ In coda alle due preesistenti, mai davanti: l'ordine dei guard è l'ordine in cui
        // l'operatore vede gli errori, e un mese chiuso o un giorno non operativo restano il
        // motivo più forte per cui questa giornata non si chiude. Un ordine aperto è invece
        // risolvibile sul momento — è l'unico blocco con una via d'uscita immediata.
        await GestioneCassaGuards.GuardNessunOrdineAperto(db, registroCassa.Id);

        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            // 🔴 Secondo controllo, e non è una ridondanza. Fra il guard qui sopra e il commit
            // c'è una finestra in cui un altro dispositivo può aprire un ordine: la finestra è
            // chiusa a monte da ApriOrdineOrchestrator, che rifiuta su un registro già CLOSED,
            // ma quel rifiuto vale solo per gli ordini aperti DOPO la scrittura dello stato.
            // Il costo è una COUNT su indice; il costo dell'alternativa è un incasso non
            // dichiarato su una giornata già chiusa, che si scopre a fine mese.
            //
            // ⚠️ Nessun test sorveglia QUESTA riga, ed è misurato, non supposto: togliendola la
            // suite resta interamente verde. La corsa che protegge non è riproducibile su
            // InMemory, dove le transazioni sono un no-op. Chi la cancellasse per «duplicazione»
            // non vedrebbe nulla diventare rosso — perciò sta scritto qui e non altrove.
            await GestioneCassaGuards.GuardNessunOrdineAperto(db, registroCassa.Id);

            registroCassa.Stato = "CLOSED";
            registroCassa.UpdatedAt = DateTime.UtcNow;

            await _unitOfWork.SaveChangesAsync();
        });

        // Eventi pubblicati DOPO il commit della transazione
        _eventBus.Publish(new ChiusuraCassaCompletedEvent
        {
            RegistroCassaId = registroCassa.Id,
            Data = registroCassa.Data,
            TotaleChiusura = registroCassa.TotaleChiusura,
            Resto = registroCassa.Resto
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
