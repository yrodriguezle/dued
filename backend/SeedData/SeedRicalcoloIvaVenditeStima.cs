using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services;

namespace duedgusto.SeedData;

/// <summary>
/// Rettifica gestionale una-tantum (issue #6) del residuo IVA stimato dei registri storici.
///
/// <para>A differenza di <see cref="SeedRicalcoloTotaleVendite"/> (che gira ad ogni avvio),
/// questa routine è <b>disattivata per default</b> e va abilitata esplicitamente via variabile
/// d'ambiente <c>RICALCOLO_IVA_STIMA</c> — così è una rettifica deliberata e tracciata, non un
/// riscrittura retroattiva silenziosa ad ogni riavvio o cambio di aliquota.</para>
///
/// <list type="bullet">
/// <item><c>RICALCOLO_IVA_STIMA=dryrun</c> → calcola e logga i cambiamenti senza salvare.</item>
/// <item><c>RICALCOLO_IVA_STIMA=1</c> (o <c>apply</c>) → applica e persiste.</item>
/// <item>non impostata / altro valore → no-op.</item>
/// </list>
/// </summary>
public static class SeedRicalcoloIvaVenditeStima
{
    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        string? mode = Environment.GetEnvironmentVariable("RICALCOLO_IVA_STIMA")?.ToLowerInvariant();
        bool apply = mode is "1" or "apply";
        bool dryRun = mode is "dryrun";
        if (!apply && !dryRun)
        {
            return; // default OFF
        }

        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        ILoggerFactory loggerFactory = scope.ServiceProvider.GetRequiredService<ILoggerFactory>();
        ILogger logger = loggerFactory.CreateLogger(nameof(SeedRicalcoloIvaVenditeStima));

        BusinessSettings? settings = await db.BusinessSettings.FirstOrDefaultAsync();
        if (settings == null)
        {
            logger.LogWarning("Ricalcolo IVA stima saltato: nessun BusinessSettings configurato.");
            return;
        }

        logger.LogInformation(
            "Ricalcolo IVA stima (issue #6) avviato in modalità {Modalita}. VatRate corrente: {VatRate} ({Percent}%).",
            dryRun ? "DRY-RUN" : "APPLY", settings.VatRate, settings.VatRate * 100m);

        await RicalcoloIvaStimaService.EseguiAsync(db, settings.VatRate, dryRun, DateTime.UtcNow, logger);
    }
}
