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
/// Orchestrator della mutation <c>aggiungiSpesaSuGiorno</c> (registro "leggero", Decision 3).
/// Registra una spesa fissa su un giorno anche senza registro operativo:
/// mantiene <see cref="GestioneCassaGuards.GuardMeseChiuso"/> ma NON applica
/// <see cref="GestioneCassaGuards.GuardGiornoOperativoConPeriodi"/>. Il registro viene
/// creato/riusato via <see cref="RegistroCassaSyncService.FindOrCreateRegistroCassaAsync"/>
/// (idempotente, indice UNIQUE su Data). La formula <c>ContanteAtteso</c> resta INVARIATA.
/// </summary>
public class AggiungiSpesaSuGiornoOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ChiusuraMensileService _chiusuraService;
    private readonly RegistroCassaSyncService _syncService;
    private readonly IEventBus _eventBus;

    public AggiungiSpesaSuGiornoOrchestrator(
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

    public async Task<RegistroCassa> ExecuteAsync(AggiungiSpesaSuGiornoInput input)
    {
        AppDbContext db = _unitOfWork.Context;

        // === Guard: mese chiuso (mantenuto). NON si applica GuardGiornoOperativoConPeriodi. ===
        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, input.Data);

        // === Blocco su registro RECONCILED alla data (coerente col frontend). ===
        RegistroCassa? esistente = await db.RegistriCassa
            .FirstOrDefaultAsync(r => r.Data.Date == input.Data.Date);
        if (esistente != null
            && string.Equals(esistente.Stato, "RECONCILED", StringComparison.OrdinalIgnoreCase))
        {
            throw new ExecutionError(
                $"Impossibile aggiungere una spesa: il registro del {input.Data:dd/MM/yyyy} è riconciliato.");
        }

        RegistroCassa registro = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            // === Find-or-create idempotente (crea DRAFT se assente). ===
            RegistroCassa reg = await _syncService.FindOrCreateRegistroCassaAsync(input.Data, input.UtenteId);

            // === Guard Decision 9: dopo il find-or-create il registro DEVE avere un Id valido. ===
            if (reg.Id <= 0)
            {
                throw new ExecutionError(
                    "Impossibile determinare il registro cassa per la data: spesa/pagamento non registrabile.");
            }

            if (input.Tracciata)
            {
                // === Ramo TRACCIATA → PagamentoFornitore (nessuna fattura/DDT). ===
                var pagamento = new PagamentoFornitore
                {
                    DataPagamento = input.Data,
                    Importo = input.Importo,
                    MetodoPagamento = string.IsNullOrWhiteSpace(input.MetodoPagamento)
                        ? "Bonifico"
                        : input.MetodoPagamento,
                    Categoria = input.Categoria,
                    RegistroCassaId = reg.Id,
                    FatturaId = null,
                    DdtId = null,
                    Note = $"Spesa fissa tracciata del {input.Data:dd/MM/yyyy}",
                };

                // === Guard Decision 9: RegistroCassaId sempre valorizzato sul pagamento creato. ===
                if (pagamento.RegistroCassaId == null)
                {
                    throw new ExecutionError(
                        "Pagamento fornitore senza registro cassa collegato: operazione non consentita.");
                }

                db.PagamentiFornitori.Add(pagamento);
                await _unitOfWork.SaveChangesAsync();

                // SpeseFornitori + ContanteAtteso/Differenza (formula invariata).
                await _syncService.RecalculateSpeseFornitoriAsync(reg.Id);
            }
            else
            {
                // === Ramo NON TRACCIATA → SpesaCassa (contanti). ===
                db.SpeseCassa.Add(new SpesaCassa
                {
                    RegistroCassaId = reg.Id,
                    Descrizione = input.Descrizione,
                    Importo = input.Importo,
                    Categoria = input.Categoria,
                });
                await _unitOfWork.SaveChangesAsync();

                // Ricalcolo SpeseGiornaliere + CalcolaTotali (formula INVARIATA, fonte unica).
                decimal totaleSpese = await db.SpeseCassa
                    .Where(s => s.RegistroCassaId == reg.Id)
                    .SumAsync(s => s.Importo);
                MutateRegistroCassaOrchestrator.CalcolaTotali(reg, totaleSpese);
                reg.UpdatedAt = DateTime.UtcNow;
                await _unitOfWork.SaveChangesAsync();
            }

            return reg;
        });

        // Evento pubblicato DOPO il commit della transazione.
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

        // Reload per i DataLoader dei subfield.
        return (await db.RegistriCassa.FirstOrDefaultAsync(r => r.Id == registro.Id))!;
    }
}
