using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.SeedData;

public static class SeedBusinessSettings
{
    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await dbContext.Database.MigrateAsync();

        // Check if settings already exist
        if (!dbContext.BusinessSettings.Any())
        {
            var settings = new BusinessSettings
            {
                BusinessName = "DuedGusto",
                OpeningTime = "09:00",
                ClosingTime = "18:00",
                OperatingDays = "[true,true,true,true,true,false,false]", // Monday-Friday open, Saturday-Sunday closed
                Timezone = "Europe/Rome",
                Currency = "EUR",
                VatRate = 0.22m,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            dbContext.BusinessSettings.Add(settings);
            await dbContext.SaveChangesAsync();
        }
    }
}
