using Microsoft.EntityFrameworkCore;

using GraphQL;

using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;
using duedgusto.Services.Fornitori;
using duedgusto.GraphQL.Fornitori;
using duedgusto.GraphQL.Fornitori.Types;
using duedgusto.GraphQL.GestioneCassa.Types;
using duedgusto.GraphQL.Subscriptions.Types;

namespace duedgusto.GraphQL.GestioneCassa;

/// <summary>
/// CRUD granulare per-riga dei PagamentoFornitori instradati al registro del GIORNO.
/// La creazione riusa <see cref="DocumentiFornitoreService"/> ("FA", DDT esclusi — Decision 2).
/// Update/delete/cambio-data delegano a <see cref="PagamentoFornitoreOrchestrator"/> aggiungendo
/// GuardMeseChiuso + blocco RECONCILED (origine e destinazione) + cleanup registro leggero (Decision 3/4).
/// </summary>
public class PagamentoFornitoreSuGiornoOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ChiusuraMensileService _chiusuraService;
    private readonly RegistroCassaSyncService _syncService;
    private readonly DocumentiFornitoreService _documentiService;
    private readonly PagamentoFornitoreOrchestrator _pagamentoOrchestrator;
    private readonly IEventBus _eventBus;

    public PagamentoFornitoreSuGiornoOrchestrator(
        IUnitOfWork unitOfWork,
        ChiusuraMensileService chiusuraService,
        RegistroCassaSyncService syncService,
        DocumentiFornitoreService documentiService,
        PagamentoFornitoreOrchestrator pagamentoOrchestrator,
        IEventBus eventBus)
    {
        _unitOfWork = unitOfWork;
        _chiusuraService = chiusuraService;
        _syncService = syncService;
        _documentiService = documentiService;
        _pagamentoOrchestrator = pagamentoOrchestrator;
        _eventBus = eventBus;
    }

    // ───────────────────────────────────────────────
    // CREATE
    // ───────────────────────────────────────────────
    public async Task<PagamentoFornitore> AggiungiAsync(AggiungiPagamentoFornitoreSuGiornoInput input, int utenteId)
    {
        AppDbContext db = _unitOfWork.Context;

        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, input.Data);

        RegistroCassa? esistente = await db.RegistriCassa
            .FirstOrDefaultAsync(r => r.Data.Date == input.Data.Date);
        GestioneCassaGuards.GuardRegistroReconciled(esistente, input.Data);

        PagamentoFornitore pagamento = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            RegistroCassa reg = await _syncService.FindOrCreateRegistroCassaAsync(input.Data, utenteId);
            if (reg.Id <= 0)
                throw new ExecutionError("Impossibile determinare il registro cassa per la data: pagamento non registrabile.");

            // Fattura opzionale (solo "FA", DDT esclusi). Attiva quando è indicato il fornitore.
            int? fatturaId = null;
            if (input.FornitoreId.HasValue)
            {
                var dati = new DocumentiFornitoreService.DatiDocumento(
                    FornitoreId: input.FornitoreId.Value,
                    TipoDocumento: "FA",
                    Numero: input.NumeroFattura,
                    DataDocumento: input.DataFattura,
                    Importo: input.Importo,
                    AliquotaIva: input.AliquotaIva,
                    FatturaIdCollegata: null,
                    DdtIdCollegato: null);

                (fatturaId, _) = await _documentiService.CreaOCollegaAsync(
                    dati, input.Data, reg.Id, [], []);
            }

            var nuovo = new PagamentoFornitore
            {
                DataPagamento = input.Data,
                Importo = input.Importo,
                MetodoPagamento = string.IsNullOrWhiteSpace(input.MetodoPagamento)
                    ? "Bonifico"
                    : input.MetodoPagamento,
                Categoria = input.Categoria,
                RegistroCassaId = reg.Id,
                FatturaId = fatturaId,
                DdtId = null,
                Note = $"Pagamento da registro cassa del {input.Data:dd/MM/yyyy}",
            };
            db.PagamentiFornitori.Add(nuovo);
            await _unitOfWork.SaveChangesAsync();

            await _syncService.RecalculateSpeseFornitoriAsync(reg.Id);
            return nuovo;
        });

        if (pagamento.RegistroCassaId.HasValue)
            PubblicaAggiornamento(pagamento.RegistroCassaId.Value);
        return (await db.PagamentiFornitori.FirstOrDefaultAsync(p => p.PagamentoId == pagamento.PagamentoId))!;
    }

    // ───────────────────────────────────────────────
    // UPDATE (delega + guardie + cleanup su cambio data)
    // ───────────────────────────────────────────────
    public async Task<PagamentoFornitore> AggiornaAsync(PagamentoFornitoreInput input, int utenteId)
    {
        AppDbContext db = _unitOfWork.Context;

        PagamentoFornitore? esistente = input.PagamentoId.HasValue
            ? await db.PagamentiFornitori
                .Include(p => p.RegistroCassa)
                .FirstOrDefaultAsync(p => p.PagamentoId == input.PagamentoId.Value)
            : null;

        int? idOrigine = esistente?.RegistroCassaId;

        // Guardia mese chiuso su vecchia e nuova data.
        if (esistente != null)
        {
            await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, esistente.DataPagamento);
            GestioneCassaGuards.GuardRegistroReconciled(esistente.RegistroCassa, esistente.DataPagamento);
        }
        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, input.DataPagamento);

        RegistroCassa? destinoEsistente = await db.RegistriCassa
            .FirstOrDefaultAsync(r => r.Data.Date == input.DataPagamento.Date);
        GestioneCassaGuards.GuardRegistroReconciled(destinoEsistente, input.DataPagamento);

        PagamentoFornitore pagamento = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            // MutateAsync gestisce create/update, spostamento di registro e ricalcolo di entrambi.
            // Essendo già in transazione, il suo ExecuteInTransactionAsync fa passthrough.
            PagamentoFornitore result = await _pagamentoOrchestrator.MutateAsync(input, utenteId);

            // Cleanup del registro d'origine se la riga si è spostata su un altro registro.
            if (idOrigine.HasValue && idOrigine.Value != result.RegistroCassaId)
                await _syncService.CleanupRegistroLeggeroVuotoAsync(idOrigine.Value);

            return result;
        });

        if (pagamento.RegistroCassaId.HasValue)
            PubblicaAggiornamento(pagamento.RegistroCassaId.Value);
        if (idOrigine.HasValue && idOrigine.Value != pagamento.RegistroCassaId)
            PubblicaAggiornamento(idOrigine.Value);

        return (await db.PagamentiFornitori.FirstOrDefaultAsync(p => p.PagamentoId == pagamento.PagamentoId))!;
    }

    // ───────────────────────────────────────────────
    // DELETE (delega + guardie + cleanup)
    // ───────────────────────────────────────────────
    public async Task<bool> EliminaAsync(int pagamentoId)
    {
        AppDbContext db = _unitOfWork.Context;

        PagamentoFornitore pagamento = await db.PagamentiFornitori
            .Include(p => p.RegistroCassa)
            .FirstOrDefaultAsync(p => p.PagamentoId == pagamentoId)
            ?? throw new ExecutionError($"Pagamento fornitore con ID {pagamentoId} non trovato.");

        int? idRegistro = pagamento.RegistroCassaId;
        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, pagamento.DataPagamento);
        GestioneCassaGuards.GuardRegistroReconciled(pagamento.RegistroCassa, pagamento.DataPagamento);

        bool registroEliminato = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _pagamentoOrchestrator.EliminaAsync(pagamentoId);

            if (idRegistro.HasValue)
                return await _syncService.CleanupRegistroLeggeroVuotoAsync(idRegistro.Value);

            return false;
        });

        if (idRegistro.HasValue && !registroEliminato)
            PubblicaAggiornamento(idRegistro.Value);

        return true;
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
