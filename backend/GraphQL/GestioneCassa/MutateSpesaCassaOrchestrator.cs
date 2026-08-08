using Microsoft.EntityFrameworkCore;

using GraphQL;

using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;
using duedgusto.Services.Fornitori;
using duedgusto.GraphQL.GestioneCassa.Types;
using duedgusto.GraphQL.Subscriptions.Types;

namespace duedgusto.GraphQL.GestioneCassa;

/// <summary>
/// Orchestrator delle mutation per-riga sulle spese non tracciate (<see cref="SpesaCassa"/>).
/// <para>
/// Serve la griglia spese della Chiusura Mensile, che scrive una riga alla volta su un giorno
/// scelto dall'utente: <c>mutateRegistroCassa</c> non va bene perché sostituisce le spese in
/// blocco e non preserva gli id.
/// </para>
/// Mantiene <see cref="GestioneCassaGuards.GuardMeseChiuso"/> ma NON applica
/// <see cref="GestioneCassaGuards.GuardGiornoOperativoConPeriodi"/>: una spesa fissa (affitto,
/// stipendi) deve poter cadere anche su un giorno di chiusura.
/// </summary>
public class MutateSpesaCassaOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ChiusuraMensileService _chiusuraService;
    private readonly RegistroCassaSyncService _syncService;
    private readonly IEventBus _eventBus;

    public MutateSpesaCassaOrchestrator(
        IUnitOfWork unitOfWork,
        ChiusuraMensileService chiusuraService,
        RegistroCassaSyncService syncService,
        IEventBus eventBus)
    {
        _unitOfWork = unitOfWork;
        _chiusuraService = chiusuraService;
        _syncService = syncService;
        _eventBus = eventBus;
    }

    public async Task<SpesaCassa> ExecuteAsync(SpesaCassaMutateInput input, int utenteId)
    {
        AppDbContext db = _unitOfWork.Context;

        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, input.Data);
        await GuardRegistroNonRiconciliato(db, input.Data);

        // In aggiornamento il registro di PARTENZA può stare in un altro giorno (o mese):
        // uno spostamento tocca due registri, entrambi devono essere modificabili.
        SpesaCassa? esistente = null;
        if (input.SpesaId is { } spesaId)
        {
            esistente = await db.SpeseCassa
                .Include(s => s.RegistroCassa)
                .FirstOrDefaultAsync(s => s.Id == spesaId)
                ?? throw new ExecutionError($"Spesa con id {spesaId} non trovata.");

            DateTime dataOrigine = esistente.RegistroCassa!.Data;
            if (dataOrigine.Date != input.Data.Date)
            {
                await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, dataOrigine);
                await GuardRegistroNonRiconciliato(db, dataOrigine);
            }
        }

        var registriDaNotificare = new List<RegistroCassa>();

        SpesaCassa spesa = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            RegistroCassa destinazione = await _syncService.FindOrCreateRegistroCassaAsync(input.Data, utenteId);

            if (destinazione.Id <= 0)
            {
                throw new ExecutionError(
                    "Impossibile determinare il registro cassa per la data: spesa non registrabile.");
            }

            RegistroCassa? origine = null;

            if (esistente == null)
            {
                esistente = new SpesaCassa { RegistroCassaId = destinazione.Id };
                db.SpeseCassa.Add(esistente);
            }
            else if (esistente.RegistroCassaId != destinazione.Id)
            {
                origine = esistente.RegistroCassa;
                esistente.RegistroCassaId = destinazione.Id;
            }

            esistente.Descrizione = input.Descrizione;
            esistente.Importo = input.Importo;
            esistente.Categoria = input.Categoria;
            esistente.Note = input.Note;

            await _unitOfWork.SaveChangesAsync();

            await RicalcolaRegistroAsync(db, destinazione);
            registriDaNotificare.Add(destinazione);

            // Il registro di partenza resterebbe con SpeseGiornaliere gonfiate.
            if (origine != null)
            {
                await RicalcolaRegistroAsync(db, origine);
                registriDaNotificare.Add(origine);
            }

            // Senza il link alla chiusura in BOZZA la riga non sarebbe visibile in Chiusura
            // Mensile, che legge le spese solo attraverso i registri inclusi.
            await _chiusuraService.EnsureRegistroLinkedToBozzaAsync(destinazione);

            await _unitOfWork.SaveChangesAsync();
            return esistente;
        });

        PubblicaEventi(registriDaNotificare);

        return spesa;
    }

    public async Task<bool> EliminaAsync(int spesaId)
    {
        AppDbContext db = _unitOfWork.Context;

        SpesaCassa spesa = await db.SpeseCassa
            .Include(s => s.RegistroCassa)
            .FirstOrDefaultAsync(s => s.Id == spesaId)
            ?? throw new ExecutionError($"Spesa con id {spesaId} non trovata.");

        RegistroCassa registro = spesa.RegistroCassa!;

        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, registro.Data);
        await GuardRegistroNonRiconciliato(db, registro.Data);

        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            db.SpeseCassa.Remove(spesa);
            await _unitOfWork.SaveChangesAsync();

            await RicalcolaRegistroAsync(db, registro);
            await _unitOfWork.SaveChangesAsync();
            return true;
        });

        PubblicaEventi([registro]);

        return true;
    }

    // ───────────────────────────────────────────────

    private static async Task GuardRegistroNonRiconciliato(AppDbContext db, DateTime data)
    {
        RegistroCassa? registro = await db.RegistriCassa
            .FirstOrDefaultAsync(r => r.Data.Date == data.Date);

        if (registro != null
            && string.Equals(registro.Stato, "RECONCILED", StringComparison.OrdinalIgnoreCase))
        {
            throw new ExecutionError(
                $"Impossibile modificare le spese: il registro del {data:dd/MM/yyyy} è riconciliato.");
        }
    }

    /// <summary>
    /// Riallinea SpeseGiornaliere e la quadratura del registro passando dalla fonte unica
    /// della formula (<see cref="MutateRegistroCassaOrchestrator.CalcolaTotali"/>).
    /// </summary>
    private static async Task RicalcolaRegistroAsync(AppDbContext db, RegistroCassa registro)
    {
        decimal totaleSpese = await db.SpeseCassa
            .Where(s => s.RegistroCassaId == registro.Id)
            .SumAsync(s => s.Importo);

        MutateRegistroCassaOrchestrator.CalcolaTotali(registro, totaleSpese);
        registro.UpdatedAt = DateTime.UtcNow;
    }

    private void PubblicaEventi(IEnumerable<RegistroCassa> registri)
    {
        // Dopo il commit: i subscriber rileggono dal DB.
        foreach (RegistroCassa registro in registri)
        {
            _eventBus.Publish(new RegistroCassaUpdatedEvent
            {
                RegistroCassaId = registro.Id,
                Data = registro.Data,
                Stato = registro.Stato ?? string.Empty,
                TotaleVendite = registro.TotaleVendite,
                TotaleApertura = registro.TotaleApertura,
                TotaleChiusura = registro.TotaleChiusura,
                Azione = "UPDATED"
            });
        }
    }
}
