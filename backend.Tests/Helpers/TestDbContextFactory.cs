using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using duedgusto.DataAccess;

namespace backend.Tests.Helpers;

/// <summary>
/// Factory per creare istanze InMemory di AppDbContext per i test.
/// Usa il provider InMemory di EF Core al posto di MySQL.
/// </summary>
public static class TestDbContextFactory
{
    /// <summary>
    /// Crea un nuovo AppDbContext con un database InMemory isolato.
    /// Ogni chiamata con un databaseName diverso crea un database separato.
    /// </summary>
    /// <param name="databaseName">
    /// Nome univoco per il database InMemory.
    /// Usare nomi diversi per ogni test per evitare collisioni.
    /// </param>
    public static AppDbContext Create(string? databaseName = null)
    {
        databaseName ??= Guid.NewGuid().ToString();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName)
            .Options;

        // Creare una configurazione minimale per il costruttore di AppDbContext
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "ConnectionStrings:Default", "Server=localhost;Database=test;User=test;Password=test" },
                { "Jwt:Key", "====*-o-*-dued-json-web-key-*-o-*====" },
                { "Jwt:Issuer", "duedgusto-api" },
                { "Jwt:Audience", "duedgusto-clients" }
            })
            .Build();

        var context = new AppDbContext(options, configuration);
        context.Database.EnsureCreated();
        return context;
    }

    /// <summary>
    /// Crea un utente di test nel database InMemory con credenziali note.
    /// </summary>
    public static duedgusto.Models.Utente CreateTestUser(
        AppDbContext context,
        string username = "testuser",
        string password = "TestPassword123!")
    {
        // Creare un ruolo di test
        var ruolo = new duedgusto.Models.Ruolo
        {
            Id = 1,
            Nome = "Admin",
            Descrizione = "Ruolo amministratore di test"
        };

        // Verificare se il ruolo esiste gia'
        if (!context.Ruoli.Any(r => r.Id == 1))
        {
            context.Ruoli.Add(ruolo);
            context.SaveChanges();
        }

        // Hash della password
        duedgusto.Services.HashPassword.PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);

        var utente = new duedgusto.Models.Utente
        {
            NomeUtente = username,
            Nome = "Test",
            Cognome = "User",
            Hash = hash,
            Salt = salt,
            RuoloId = 1,
            Disabilitato = false
        };

        context.Utenti.Add(utente);
        context.SaveChanges();
        return utente;
    }
}
