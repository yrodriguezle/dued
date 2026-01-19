using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services.HashPassword;

namespace duedgusto.SeedData;

public static class SeedSuperadmin
{
    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await dbContext.Database.MigrateAsync();

        if (!dbContext.Ruoli.Any(r => r.Nome == "SuperAdmin"))
        {
            var superAdminRole = new Ruolo
            {
                Nome = "SuperAdmin",
                Descrizione = "Administrator with full access"
            };
            dbContext.Ruoli.Add(superAdminRole);
            await dbContext.SaveChangesAsync();
        }

        var role = dbContext.Ruoli.FirstOrDefault(r => r.Nome == "SuperAdmin");

        if (!dbContext.Utenti.Any(u => u.NomeUtente == "superadmin"))
        {
            // SECURITY FIX: Read password from environment variable
            string superadminPassword = Environment.GetEnvironmentVariable("SUPERADMIN_PASSWORD")
                ?? throw new InvalidOperationException(
                    "SUPERADMIN_PASSWORD environment variable must be set. " +
                    "Set it with: export SUPERADMIN_PASSWORD='YourSecurePassword'"
                );

            PasswordService.HashPassword(superadminPassword, out byte[] hash, out byte[] salt);
            var superAdmin = new Utente
            {
                NomeUtente = "superadmin",
                Nome = "Super Admin",
                Hash = hash,
                Salt = salt,
                RuoloId = role!.Id,
                Ruolo = role
            };

            dbContext.Utenti.Add(superAdmin);
            await dbContext.SaveChangesAsync();
        }
    }
}

