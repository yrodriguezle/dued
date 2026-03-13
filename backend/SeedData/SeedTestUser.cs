using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services.HashPassword;

namespace duedgusto.SeedData;

/// <summary>
/// Crea un utente di test con privilegi SuperAdmin per i test e2e.
/// Attivo SOLO in ambiente Development.
/// Credenziali: e2e-admin / e2e-test-password
/// </summary>
public static class SeedTestUser
{
    public const string TestUsername = "e2e-admin";
    public const string TestPassword = "e2e-test-password";

    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Recupera il ruolo SuperAdmin (deve già esistere, creato da SeedSuperadmin)
        var superAdminRole = dbContext.Ruoli.FirstOrDefault(r => r.Nome == "SuperAdmin");
        if (superAdminRole == null)
        {
            return; // SeedSuperadmin non è ancora stato eseguito
        }

        // Crea l'utente test solo se non esiste già
        if (dbContext.Utenti.Any(u => u.NomeUtente == TestUsername))
        {
            return;
        }

        PasswordService.HashPassword(TestPassword, out byte[] hash, out byte[] salt);

        var testUser = new Utente
        {
            NomeUtente = TestUsername,
            Nome = "E2E",
            Cognome = "Test Admin",
            Descrizione = "Utente di test per e2e — NON usare in produzione",
            Hash = hash,
            Salt = salt,
            RuoloId = superAdminRole.Id,
            Ruolo = superAdminRole
        };

        dbContext.Utenti.Add(testUser);
        await dbContext.SaveChangesAsync();
    }
}
