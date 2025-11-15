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

        if (!dbContext.CashDenominations.Any())
        {
            var denominations = new List<CashDenomination>
            {
                // Monete
                new() { Value = 0.01m, Type = "COIN", DisplayOrder = 1 },
                new() { Value = 0.02m, Type = "COIN", DisplayOrder = 2 },
                new() { Value = 0.05m, Type = "COIN", DisplayOrder = 3 },
                new() { Value = 0.10m, Type = "COIN", DisplayOrder = 4 },
                new() { Value = 0.20m, Type = "COIN", DisplayOrder = 5 },
                new() { Value = 0.50m, Type = "COIN", DisplayOrder = 6 },
                new() { Value = 1.00m, Type = "COIN", DisplayOrder = 7 },
                new() { Value = 2.00m, Type = "COIN", DisplayOrder = 8 },

                // Banconote
                new() { Value = 5.00m, Type = "BANKNOTE", DisplayOrder = 9 },
                new() { Value = 10.00m, Type = "BANKNOTE", DisplayOrder = 10 },
                new() { Value = 20.00m, Type = "BANKNOTE", DisplayOrder = 11 },
                new() { Value = 50.00m, Type = "BANKNOTE", DisplayOrder = 12 },
                new() { Value = 100.00m, Type = "BANKNOTE", DisplayOrder = 13 },
                new() { Value = 200.00m, Type = "BANKNOTE", DisplayOrder = 14 },
                new() { Value = 500.00m, Type = "BANKNOTE", DisplayOrder = 15 }
            };

            dbContext.CashDenominations.AddRange(denominations);
            await dbContext.SaveChangesAsync();
        }
    }
}
