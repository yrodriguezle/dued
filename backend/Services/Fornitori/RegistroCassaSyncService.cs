using Microsoft.EntityFrameworkCore;
using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.Services.Fornitori;

/// <summary>
/// Servizio per sincronizzare i pagamenti fornitori con il registro cassa.
/// Quando un pagamento viene creato/aggiornato/eliminato dalla pagina fatture,
/// questo servizio garantisce che il registro cassa della data corrispondente
/// venga aggiornato di conseguenza.
/// </summary>
public class RegistroCassaSyncService
{
    private readonly AppDbContext _dbContext;

    public RegistroCassaSyncService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Trova il RegistroCassa per la data specificata o ne crea uno DRAFT.
    /// </summary>
    public async Task<RegistroCassa> FindOrCreateRegistroCassaAsync(DateTime dataPagamento, int utenteId)
    {
        var registro = await _dbContext.RegistriCassa
            .FirstOrDefaultAsync(r => r.Data.Date == dataPagamento.Date);

        if (registro != null)
            return registro;

        registro = new RegistroCassa
        {
            Data = dataPagamento.Date,
            UtenteId = utenteId,
            Stato = "DRAFT",
        };
        _dbContext.RegistriCassa.Add(registro);
        await _dbContext.SaveChangesAsync();

        return registro;
    }

    /// <summary>
    /// Ricalcola SpeseFornitori sul registro cassa sommando tutti i pagamenti linkati.
    /// Aggiorna anche ContanteAtteso e Differenza per mantenere la quadratura.
    /// </summary>
    public async Task RecalculateSpeseFornitoriAsync(int registroCassaId)
    {
        var registro = await _dbContext.RegistriCassa
            .FirstOrDefaultAsync(r => r.Id == registroCassaId);

        if (registro == null)
            return;

        var totaleSpeseFornitori = await _dbContext.PagamentiFornitori
            .Where(p => p.RegistroCassaId == registroCassaId)
            .SumAsync(p => p.Importo);

        registro.SpeseFornitori = totaleSpeseFornitori;
        registro.ContanteAtteso = registro.VenditeContanti - registro.SpeseFornitori - registro.SpeseGiornaliere;
        decimal incassoGiornaliero = registro.TotaleChiusura - registro.TotaleApertura;
        registro.Differenza = incassoGiornaliero - registro.ContanteAtteso;
        registro.AggiornatoIl = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
    }

    /// <summary>
    /// Determina se un pagamento è stato creato dal registro cassa (non dalla pagina fatture).
    /// Usa il pattern nel campo Note come discriminatore.
    /// </summary>
    public static bool IsRegisterCreatedPayment(PagamentoFornitore payment)
    {
        return payment.Note != null && payment.Note.Contains("Pagamento da registro cassa");
    }
}
