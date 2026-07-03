using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.Models;

namespace duedgusto.SeedData;

/// <summary>
/// Data-fix una tantum: riallinea TotaleVendite dei registri esistenti alla formula
/// (TotaleChiusura - TotaleApertura) + IncassiElettronici + IncassiFattura
/// (stessa del KPI giornaliero). Delega a BreakdownIvaApplier, che ricalcola anche
/// breakdown IVA e ImportoIva. Idempotente: processa solo i registri il cui valore
/// persistito differisce dalla formula, quindi ai riavvii successivi non fa nulla.
/// </summary>
public static class SeedRicalcoloTotaleVendite
{
    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        ILogger logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger(nameof(SeedRicalcoloTotaleVendite));

        BusinessSettings? settings = await dbContext.BusinessSettings.FirstOrDefaultAsync();
        if (settings is null)
        {
            return;
        }

        List<RegistroCassa> daRicalcolare = await dbContext.RegistriCassa
            .Where(r => r.TotaleVendite !=
                (r.TotaleChiusura - r.TotaleApertura) + r.IncassiElettronici + r.IncassiFattura)
            .ToListAsync();

        if (daRicalcolare.Count == 0)
        {
            return;
        }

        foreach (RegistroCassa registro in daRicalcolare)
        {
            await BreakdownIvaApplier.ApplicaAsync(dbContext, registro, settings.VatRate, logger);
        }

        await dbContext.SaveChangesAsync();

        logger.LogInformation(
            "Ricalcolo TotaleVendite completato: {Count} registri aggiornati (breakdown IVA rigenerato).",
            daRicalcolare.Count);
    }
}
