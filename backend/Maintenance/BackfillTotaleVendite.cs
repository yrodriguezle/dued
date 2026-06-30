using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.Models;

namespace duedgusto.Maintenance;

/// <summary>
/// Backfill one-shot del campo <see cref="RegistroCassa.TotaleVendite"/> (e di conseguenza
/// ImportoIva + righe RegistriCassaIva) per i registri pregressi, salvati con la vecchia
/// formula errata (VenditeContanti + IncassiElettronici + IncassoContanteTracciato +
/// IncassiFattura, con VenditeContanti sempre 0).
///
/// Riusa il punto di calcolo UNICO <see cref="BreakdownIvaApplier.ApplicaAsync"/> così la
/// nuova formula (contante reale = TotaleChiusura - TotaleApertura, + elettronico + fattura)
/// e il breakdown IVA restano coerenti col flusso runtime.
///
/// ONE-SHOT: gira incondizionatamente allo startup. Idempotente (ricalcolo deterministico,
/// rieseguibile senza effetti collaterali). RIMUOVERE questo file e la chiamata in
/// Program.cs al prossimo deploy.
/// </summary>
public static class BackfillTotaleVendite
{
    public static async Task<int> Initialize(IServiceProvider services)
    {
        AppDbContext db = services.GetRequiredService<AppDbContext>();
        ILoggerFactory loggerFactory = services.GetRequiredService<ILoggerFactory>();
        ILogger logger = loggerFactory.CreateLogger(nameof(BackfillTotaleVendite));

        BusinessSettings? settings = await db.BusinessSettings.FirstOrDefaultAsync();
        if (settings is null)
        {
            logger.LogWarning("Backfill TotaleVendite saltato: BusinessSettings assente.");
            return 0;
        }

        List<RegistroCassa> registri = await db.RegistriCassa.ToListAsync();
        logger.LogInformation("Backfill TotaleVendite: avvio ricalcolo su {Count} registri.", registri.Count);

        int aggiornati = 0;
        foreach (RegistroCassa registro in registri)
        {
            decimal totalePrecedente = registro.TotaleVendite;
            decimal ivaPrecedente = registro.ImportoIva;

            await BreakdownIvaApplier.ApplicaAsync(db, registro, settings.VatRate, logger);

            if (registro.TotaleVendite != totalePrecedente || registro.ImportoIva != ivaPrecedente)
            {
                logger.LogInformation(
                    "Registro {Id} ({Data:yyyy-MM-dd}): TotaleVendite {Vecchio} -> {Nuovo}, ImportoIva {IvaVecchia} -> {IvaNuova}.",
                    registro.Id, registro.Data, totalePrecedente, registro.TotaleVendite, ivaPrecedente, registro.ImportoIva);
                aggiornati++;
            }
        }

        await db.SaveChangesAsync();
        logger.LogInformation("Backfill TotaleVendite completato: {Aggiornati}/{Totale} registri modificati.",
            aggiornati, registri.Count);

        return aggiornati;
    }
}
