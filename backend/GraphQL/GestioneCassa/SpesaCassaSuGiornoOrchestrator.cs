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
/// CRUD granulare per-riga delle SpeseCassa (non tracciate) instradate al registro del GIORNO.
/// La chiusura mensile non possiede le spese: ogni riga vive sul registro della sua Data.
/// Guardie (Decision 4): GuardMeseChiuso + blocco RECONCILED su origine e destinazione.
/// Registro "leggero" vuoto auto-eliminato (Decision 3) dopo delete/spostamento.
/// La formula ContanteAtteso/Differenza resta la fonte unica <see cref="MutateRegistroCassaOrchestrator.CalcolaTotali"/>.
/// </summary>
public class SpesaCassaSuGiornoOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ChiusuraMensileService _chiusuraService;
    private readonly RegistroCassaSyncService _syncService;
    private readonly IEventBus _eventBus;

    public SpesaCassaSuGiornoOrchestrator(
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

    // ───────────────────────────────────────────────
    // CREATE
    // ───────────────────────────────────────────────
    public async Task<SpesaCassa> AggiungiAsync(AggiungiSpesaCassaSuGiornoInput input, int utenteId)
    {
        AppDbContext db = _unitOfWork.Context;

        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, input.Data);

        RegistroCassa? esistente = await db.RegistriCassa
            .FirstOrDefaultAsync(r => r.Data.Date == input.Data.Date);
        GestioneCassaGuards.GuardRegistroReconciled(esistente, input.Data);

        SpesaCassa spesa = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            RegistroCassa reg = await _syncService.FindOrCreateRegistroCassaAsync(input.Data, utenteId);
            if (reg.Id <= 0)
                throw new ExecutionError("Impossibile determinare il registro cassa per la data: spesa non registrabile.");

            var nuova = new SpesaCassa
            {
                RegistroCassaId = reg.Id,
                Descrizione = input.Descrizione,
                Importo = input.Importo,
                Categoria = input.Categoria,
            };
            db.SpeseCassa.Add(nuova);
            await _unitOfWork.SaveChangesAsync();

            await RicalcolaSpeseGiornaliereAsync(reg.Id);
            return nuova;
        });

        PubblicaAggiornamento(spesa.RegistroCassaId);
        return (await db.SpeseCassa.FirstOrDefaultAsync(s => s.Id == spesa.Id))!;
    }

    // ───────────────────────────────────────────────
    // UPDATE (in loco o spostamento su cambio Data)
    // ───────────────────────────────────────────────
    public async Task<SpesaCassa> AggiornaAsync(AggiornaSpesaCassaSuGiornoInput input, int utenteId)
    {
        AppDbContext db = _unitOfWork.Context;

        SpesaCassa spesa = await db.SpeseCassa
            .Include(s => s.RegistroCassa)
            .FirstOrDefaultAsync(s => s.Id == input.SpesaId)
            ?? throw new ExecutionError($"Spesa cassa con ID {input.SpesaId} non trovata.");

        RegistroCassa registroOrigine = spesa.RegistroCassa;
        bool cambiaData = registroOrigine.Data.Date != input.Data.Date;

        // Guardie su origine (e destinazione se la data cambia).
        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, registroOrigine.Data);
        GestioneCassaGuards.GuardRegistroReconciled(registroOrigine, registroOrigine.Data);
        if (cambiaData)
        {
            await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, input.Data);
            RegistroCassa? destinoEsistente = await db.RegistriCassa
                .FirstOrDefaultAsync(r => r.Data.Date == input.Data.Date);
            GestioneCassaGuards.GuardRegistroReconciled(destinoEsistente, input.Data);
        }

        int idOrigine = registroOrigine.Id;
        int idDestinazione = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            spesa.Descrizione = input.Descrizione;
            spesa.Importo = input.Importo;
            spesa.Categoria = input.Categoria;

            if (!cambiaData)
            {
                await _unitOfWork.SaveChangesAsync();
                await RicalcolaSpeseGiornaliereAsync(idOrigine);
                return idOrigine;
            }

            RegistroCassa destino = await _syncService.FindOrCreateRegistroCassaAsync(input.Data, utenteId);
            if (destino.Id <= 0)
                throw new ExecutionError("Impossibile determinare il registro cassa di destinazione: spesa non spostabile.");

            spesa.RegistroCassaId = destino.Id;
            await _unitOfWork.SaveChangesAsync();

            await RicalcolaSpeseGiornaliereAsync(destino.Id);
            await RicalcolaSpeseGiornaliereAsync(idOrigine);
            await _syncService.CleanupRegistroLeggeroVuotoAsync(idOrigine);
            return destino.Id;
        });

        PubblicaAggiornamento(idDestinazione);
        if (idDestinazione != idOrigine)
            PubblicaAggiornamento(idOrigine);

        return (await db.SpeseCassa.FirstOrDefaultAsync(s => s.Id == spesa.Id))!;
    }

    // ───────────────────────────────────────────────
    // DELETE
    // ───────────────────────────────────────────────
    public async Task<bool> EliminaAsync(int spesaId)
    {
        AppDbContext db = _unitOfWork.Context;

        SpesaCassa spesa = await db.SpeseCassa
            .Include(s => s.RegistroCassa)
            .FirstOrDefaultAsync(s => s.Id == spesaId)
            ?? throw new ExecutionError($"Spesa cassa con ID {spesaId} non trovata.");

        RegistroCassa registro = spesa.RegistroCassa;
        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, registro.Data);
        GestioneCassaGuards.GuardRegistroReconciled(registro, registro.Data);

        int idRegistro = registro.Id;
        bool registroEliminato = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            db.SpeseCassa.Remove(spesa);
            await _unitOfWork.SaveChangesAsync();

            await RicalcolaSpeseGiornaliereAsync(idRegistro);
            return await _syncService.CleanupRegistroLeggeroVuotoAsync(idRegistro);
        });

        if (!registroEliminato)
            PubblicaAggiornamento(idRegistro);

        return true;
    }

    // ───────────────────────────────────────────────
    // Helpers
    // ───────────────────────────────────────────────

    /// <summary>
    /// Ricalcola SpeseGiornaliere e i totali di quadratura del registro sommando le SpeseCassa
    /// persistite. Usa la fonte unica <see cref="MutateRegistroCassaOrchestrator.CalcolaTotali"/>.
    /// </summary>
    private async Task RicalcolaSpeseGiornaliereAsync(int registroCassaId)
    {
        AppDbContext db = _unitOfWork.Context;
        RegistroCassa? reg = await db.RegistriCassa.FirstOrDefaultAsync(r => r.Id == registroCassaId);
        if (reg == null)
            return;

        decimal totaleSpese = await db.SpeseCassa
            .Where(s => s.RegistroCassaId == registroCassaId)
            .SumAsync(s => s.Importo);

        MutateRegistroCassaOrchestrator.CalcolaTotali(reg, totaleSpese);
        reg.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync();
    }

    private void PubblicaAggiornamento(int registroCassaId)
    {
        AppDbContext db = _unitOfWork.Context;
        RegistroCassa? reg = db.RegistriCassa.FirstOrDefault(r => r.Id == registroCassaId);
        if (reg == null)
            return;

        _eventBus.Publish(new RegistroCassaUpdatedEvent
        {
            RegistroCassaId = reg.Id,
            Data = reg.Data,
            Stato = reg.Stato ?? string.Empty,
            TotaleVendite = reg.TotaleVendite,
            TotaleApertura = reg.TotaleApertura,
            TotaleChiusura = reg.TotaleChiusura,
            Azione = "UPDATED"
        });
    }
}
