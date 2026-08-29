using GraphQL;
using Microsoft.EntityFrameworkCore;

using duedgusto.Common;
using duedgusto.DataAccess;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.GraphQL.Subscriptions.Types;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;

namespace duedgusto.GraphQL.Vendite;

/// <summary>
/// Disfa un incasso già dichiarato: <see cref="StatiOrdine.Chiuso"/> →
/// <see cref="StatiOrdine.Stornato"/>, con delta <b>inverso</b> sui secchi.
///
/// <para>🔴 <b>È l'operazione pericolosa del punto vendita.</b>
/// <c>SecchiIncassiApplier.ApplicaDelta</c> non è idempotente: applicare due volte il delta
/// inverso sottrarrebbe l'importo due volte, e il registro andrebbe in un valore che nessuna
/// quadratura smentisce. Ciò che rende sicuro questo file non è un controllo scritto qui, è la
/// guardia di <see cref="TransizioneOrdine"/>: <c>CHIUSO</c> è il token, e un secondo storno non
/// trova più nulla da transire.</para>
///
/// <para>🔴 <b>Le <c>Vendita</c> si CANCELLANO, non si marcano.</b>
/// <c>BreakdownIvaApplier</c> ricalcola <c>VenditeContanti</c> e le righe IVA da
/// <c>vendite.Sum(v =&gt; v.PrezzoTotale)</c> sulle vendite <b>persistite</b>: un flag
/// <c>Stornata</c> obbligherebbe ad aggiungere un <c>Where(v =&gt; !v.Stornata)</c> negli applier,
/// cioè a rimettere «uno stato sulla vendita più un filtro in chi la legge» — l'accoppiata che
/// questo change esiste per togliere, rientrata dalla finestra su un percorso meno battuto.
/// Cancellare tiene l'invariante: <b>una <c>Vendita</c> che esiste è una riga incassata
/// adesso</b>.</para>
///
/// <para>⚠️ <b>Le <c>RigaOrdine</c> non si toccano.</b> Il libro mastro è l'<c>Ordine</c>, che
/// conserva le voci, gli importi, chi ha stornato e perché. Cancellare anche le righe renderebbe
/// uno storno indistinguibile da un ordine mai esistito, che è esattamente ciò che uno storno non
/// deve poter sembrare.</para>
/// </summary>
public class StornaOrdineOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ChiusuraMensileService _chiusuraService;
    private readonly IEventBus _eventBus;
    private readonly ILogger<StornaOrdineOrchestrator> _logger;

    public StornaOrdineOrchestrator(
        IUnitOfWork unitOfWork,
        ChiusuraMensileService chiusuraService,
        IEventBus eventBus,
        ILogger<StornaOrdineOrchestrator> logger)
    {
        _unitOfWork = unitOfWork;
        _chiusuraService = chiusuraService;
        _eventBus = eventBus;
        _logger = logger;
    }

    public async Task<Ordine> ExecuteAsync(int ordineId, string motivo, int utenteId)
    {
        AppDbContext db = _unitOfWork.Context;

        // Il controllo del ruolo è il primo: chi non può stornare non deve nemmeno sapere se
        // l'ordine esiste, né in che stato sia.
        await GestioneCassaGuards.GuardUtenteAmministratore(db, utenteId);

        Ordine ordine = await db.Ordini
                .Include(o => o.Vendite)
                .FirstOrDefaultAsync(o => o.OrdineId == ordineId)
            ?? throw new ExecutionError($"Ordine con ID {ordineId} non trovato.");

        RegistroCassa registro = await db.RegistriCassa
                .FirstOrDefaultAsync(r => r.Id == ordine.RegistroCassaId)
            ?? throw new ExecutionError($"Registro cassa con ID {ordine.RegistroCassaId} non trovato.");

        string identificativo = TransizioneOrdine.Identificativo(ordine, registro.Data);

        // Copre da sé anche il padre di uno split: SPLITTATO non è CHIUSO, e il messaggio manda
        // ai figli. Un solo gesto che applicasse n delta inversi trasformerebbe «una volta sola»
        // in n ragionamenti da tenere insieme.
        TransizioneOrdine.GuardStatoAtteso(ordine, StatiOrdine.Chiuso, identificativo);

        if (string.IsNullOrWhiteSpace(motivo))
        {
            // Lo storno cancella le vendite: senza motivo, l'unica traccia che resta di un incasso
            // sparito sarebbe «qualcuno, a quest'ora». Non basta.
            throw new ExecutionError(
                $"Per stornare l'ordine {identificativo} serve un motivo: le vendite vengono cancellate " +
                "e l'ordine resta l'unica traccia di ciò che era stato incassato.");
        }

        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, registro.Data);

        string? metodoStornato = ordine.MetodoPagamento;
        decimal importoStornato = ordine.TotaleOrdine;
        DateTime adesso = DateTime.UtcNow;

        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            ordine.Stato = StatiOrdine.Stornato;
            ordine.StornatoDa = utenteId;
            ordine.StornatoIl = adesso;
            ordine.MotivoStorno = motivo.Trim();
            ordine.UpdatedAt = adesso;

            // Le vendite spariscono; le righe dell'ordine restano dove sono.
            db.Vendite.RemoveRange(ordine.Vendite);

            // 🔴 La guardia scatta qui, PRIMA del delta inverso: se un altro storno è già passato,
            //    l'eccezione arriva senza che nulla sia stato sottratto ai secchi.
            //    È anche il SaveChanges obbligatorio del vincolo d'ordine: BreakdownIvaApplier
            //    rilegge le vendite dal database, e senza questo salvataggio le vedrebbe ancora
            //    tutte, ricostruendo un breakdown che comprende l'ordine appena stornato.
            await TransizioneOrdine.SalvaTransizioneAsync(_unitOfWork, identificativo);

            SecchiIncassiApplier.ApplicaDelta(registro, metodoStornato, -importoStornato, _logger);

            BusinessSettings settings = await db.BusinessSettings.FirstAsync();
            await BreakdownIvaApplier.ApplicaAsync(db, registro, settings.VatRate, _logger);

            registro.UpdatedAt = adesso;
            await _unitOfWork.SaveChangesAsync();
        });

        _eventBus.Publish(new RegistroCassaUpdatedEvent
        {
            RegistroCassaId = registro.Id,
            Data = registro.Data,
            Stato = registro.Stato,
            TotaleVendite = registro.TotaleVendite,
            TotaleApertura = registro.TotaleApertura,
            TotaleChiusura = registro.TotaleChiusura,
            Azione = "ORDINE_STORNATO"
        });

        return ordine;
    }
}
