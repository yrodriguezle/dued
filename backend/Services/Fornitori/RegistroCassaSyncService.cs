using Microsoft.EntityFrameworkCore;
using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Services.Fornitori;

/// <summary>
/// Servizio per sincronizzare i pagamenti fornitori con il registro cassa.
/// Quando un pagamento viene creato/aggiornato/eliminato dalla pagina fatture,
/// questo servizio garantisce che il registro cassa della data corrispondente
/// venga aggiornato di conseguenza.
/// </summary>
public class RegistroCassaSyncService
{
    private readonly IUnitOfWork _unitOfWork;

    public RegistroCassaSyncService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    /// <summary>
    /// Trova il RegistroCassa per la data specificata o ne crea uno DRAFT.
    /// </summary>
    public async Task<RegistroCassa> FindOrCreateRegistroCassaAsync(DateTime dataPagamento, int utenteId)
    {
        RegistroCassa? registro = await _unitOfWork.RegistriCassa.Query()
                .FirstOrDefaultAsync(r => r.Data.Date == dataPagamento.Date);

        if (registro != null)
            return registro;

        registro = new RegistroCassa
        {
            Data = dataPagamento.Date,
            UtenteId = utenteId,
            Stato = "DRAFT",
        };
        _unitOfWork.RegistriCassa.Add(registro);
        await _unitOfWork.SaveChangesAsync();

        return registro;
    }

    /// <summary>
    /// Ricalcola SpeseFornitori sul registro cassa sommando tutti i pagamenti linkati.
    /// Aggiorna anche ContanteAtteso e Differenza per mantenere la quadratura.
    /// </summary>
    public async Task RecalculateSpeseFornitoriAsync(int registroCassaId)
    {
        RegistroCassa? registro = await _unitOfWork.RegistriCassa.GetByIdAsync(registroCassaId);

        if (registro == null)
            return;

        var totaleSpeseFornitori = await _unitOfWork.PagamentiFornitori.Query()
            .Where(p => p.RegistroCassaId == registroCassaId)
            .SumAsync(p => p.Importo);

        registro.SpeseFornitori = totaleSpeseFornitori;
        registro.ContanteAtteso = registro.VenditeContanti - registro.SpeseFornitori - registro.SpeseGiornaliere;
        decimal incassoGiornaliero = registro.TotaleChiusura - registro.TotaleApertura;
        registro.Differenza = incassoGiornaliero - registro.ContanteAtteso;
        registro.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync();
    }

    /// <summary>
    /// Determina se un pagamento è stato creato dal registro cassa (non dalla pagina fatture).
    /// Usa il pattern nel campo Note come discriminatore.
    /// </summary>
    public static bool IsRegisterCreatedPayment(PagamentoFornitore payment)
    {
        return payment.Note != null && payment.Note.Contains("Pagamento da registro cassa");
    }

    /// <summary>
    /// Auto-elimina un registro "leggero" rimasto vuoto (Decision 3). Un <see cref="RegistroCassa"/>
    /// in stato DRAFT viene rimosso quando, dopo una cancellazione o uno spostamento di riga, non ha
    /// più: SpeseCassa, PagamentiFornitori, Vendite, ConteggiMoneta né totali apertura/chiusura impostati.
    /// Idempotente e sicuro: se una qualunque condizione non è soddisfatta non elimina nulla.
    /// Ritorna <c>true</c> se il registro è stato eliminato.
    /// </summary>
    public async Task<bool> CleanupRegistroLeggeroVuotoAsync(int registroCassaId)
    {
        AppDbContext db = _unitOfWork.Context;

        RegistroCassa? registro = await db.RegistriCassa
            .FirstOrDefaultAsync(r => r.Id == registroCassaId);

        if (registro == null)
            return false;

        // Solo i registri in bozza sono eliminabili (coerente con EliminaRegistroCassaOrchestrator).
        if (!string.Equals(registro.Stato, "DRAFT", StringComparison.OrdinalIgnoreCase))
            return false;

        // Totali apertura/chiusura impostati → il registro è operativo, non "leggero".
        if (registro.TotaleApertura != 0 || registro.TotaleChiusura != 0)
            return false;

        bool haContenuto =
            await db.SpeseCassa.AnyAsync(s => s.RegistroCassaId == registroCassaId)
            || await db.PagamentiFornitori.AnyAsync(p => p.RegistroCassaId == registroCassaId)
            || await db.Vendite.AnyAsync(v => v.RegistroCassaId == registroCassaId)
            || await db.ConteggiMoneta.AnyAsync(c => c.RegistroCassaId == registroCassaId);

        if (haContenuto)
            return false;

        db.RegistriCassa.Remove(registro);
        await _unitOfWork.SaveChangesAsync();
        return true;
    }
}
