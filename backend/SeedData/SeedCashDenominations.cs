using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.SeedData;

public static class SeedCashDenominations
{
    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await dbContext.Database.MigrateAsync();

        // Delete old denominations if they exist (0.01, 0.02, 200, 500)
        var oldDenominations = await dbContext.DenominazioniMoneta
            .Where(d => d.Valore == 0.01m || d.Valore == 0.02m || d.Valore == 200.00m || d.Valore == 500.00m)
            .ToListAsync();

        if (oldDenominations.Any())
        {
            dbContext.DenominazioniMoneta.RemoveRange(oldDenominations);
            await dbContext.SaveChangesAsync();
        }

        if (!dbContext.DenominazioniMoneta.Any())
        {
            var denominazioni = new List<DenominazioneMoneta>
            {
                // Monete
                new() { Valore = 0.05m, Tipo = "COIN", OrdineVisualizzazione = 1 },
                new() { Valore = 0.10m, Tipo = "COIN", OrdineVisualizzazione = 2 },
                new() { Valore = 0.20m, Tipo = "COIN", OrdineVisualizzazione = 3 },
                new() { Valore = 0.50m, Tipo = "COIN", OrdineVisualizzazione = 4 },
                new() { Valore = 1.00m, Tipo = "COIN", OrdineVisualizzazione = 5 },
                new() { Valore = 2.00m, Tipo = "COIN", OrdineVisualizzazione = 6 },

                // Banconote
                new() { Valore = 5.00m, Tipo = "BANKNOTE", OrdineVisualizzazione = 7 },
                new() { Valore = 10.00m, Tipo = "BANKNOTE", OrdineVisualizzazione = 8 },
                new() { Valore = 20.00m, Tipo = "BANKNOTE", OrdineVisualizzazione = 9 },
                new() { Valore = 50.00m, Tipo = "BANKNOTE", OrdineVisualizzazione = 10 },
                new() { Valore = 100.00m, Tipo = "BANKNOTE", OrdineVisualizzazione = 11 }
            };

            dbContext.DenominazioniMoneta.AddRange(denominazioni);
            await dbContext.SaveChangesAsync();
        }
    }
}
