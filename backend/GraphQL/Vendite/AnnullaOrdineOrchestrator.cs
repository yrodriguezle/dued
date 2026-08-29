using GraphQL;
using Microsoft.EntityFrameworkCore;

using duedgusto.Common;
using duedgusto.DataAccess;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;

namespace duedgusto.GraphQL.Vendite;

/// <summary>
/// Butta via un conto aperto che nessuno incasserà: <see cref="StatiOrdine.Aperto"/> →
/// <see cref="StatiOrdine.Annullato"/>.
///
/// <para>🔴 <b>Nessun delta, e non per una scelta di prudenza.</b> Un ordine aperto non ha mai
/// toccato un secchio né una riga IVA: non c'è nulla da disfare perché non c'era nulla da fare. È
/// il vincolo della issue reso <b>strutturale</b> invece che condizionale — non esiste un ramo di
/// codice che decide di saltare il delta, esiste un percorso che il delta non lo attraversa
/// proprio.</para>
///
/// <para><b>Perché non è riservato agli amministratori</b>, a differenza dello storno. Questa è la
/// via d'uscita dal blocco della chiusura di cassa: se aprirla richiedesse un amministratore,
/// l'operatore smetterebbe di aprire ordini invece di chiedere aiuto — che è peggio del rischio
/// che il vincolo evita. La risposta al rischio è <b>tracciare</b>: chi, quando, e un motivo
/// obbligatorio. L'ordine non sparisce, resta consultabile, e una scappatoia con la traccia non è
/// più una scappatoia silenziosa.</para>
/// </summary>
public class AnnullaOrdineOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ChiusuraMensileService _chiusuraService;

    public AnnullaOrdineOrchestrator(IUnitOfWork unitOfWork, ChiusuraMensileService chiusuraService)
    {
        _unitOfWork = unitOfWork;
        _chiusuraService = chiusuraService;
    }

    public async Task<Ordine> ExecuteAsync(int ordineId, string motivo, int? utenteId)
    {
        AppDbContext db = _unitOfWork.Context;

        Ordine ordine = await db.Ordini
                .FirstOrDefaultAsync(o => o.OrdineId == ordineId)
            ?? throw new ExecutionError($"Ordine con ID {ordineId} non trovato.");

        RegistroCassa registro = await db.RegistriCassa
                .FirstOrDefaultAsync(r => r.Id == ordine.RegistroCassaId)
            ?? throw new ExecutionError($"Registro cassa con ID {ordine.RegistroCassaId} non trovato.");

        string identificativo = TransizioneOrdine.Identificativo(ordine, registro.Data);

        TransizioneOrdine.GuardStatoAtteso(ordine, StatiOrdine.Aperto, identificativo);

        if (string.IsNullOrWhiteSpace(motivo))
        {
            // Un motivo vuoto salvato varrebbe quanto nessun motivo, ma somiglierebbe a una
            // traccia: peggio che rifiutare.
            throw new ExecutionError(
                $"Per annullare l'ordine {identificativo} serve un motivo: è ciò che distingue una " +
                "correzione da un incasso fatto sparire.");
        }

        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, registro.Data);

        DateTime adesso = DateTime.UtcNow;

        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            ordine.Stato = StatiOrdine.Annullato;
            ordine.AnnullatoDa = utenteId;
            ordine.AnnullatoIl = adesso;
            ordine.MotivoAnnullamento = motivo.Trim();
            ordine.UpdatedAt = adesso;

            // Stessa guardia della chiusura: due annulli concorrenti — o un annullo che corre
            // contro una chiusura — devono produrne uno solo e un errore parlante.
            await TransizioneOrdine.SalvaTransizioneAsync(_unitOfWork, identificativo);
        });

        // Nessun evento: il registro non è cambiato di un centesimo, e annunciare un
        // aggiornamento che non c'è stato farebbe ricaricare la cassa per niente.
        return ordine;
    }
}
