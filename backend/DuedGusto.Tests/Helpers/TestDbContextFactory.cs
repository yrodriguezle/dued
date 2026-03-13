using Microsoft.Extensions.Configuration;

namespace DuedGusto.Tests.Helpers;

/// <summary>
/// Factory per creare istanze di AppDbContext con InMemory database per i test.
/// Ogni test usa un databaseName univoco per garantire l'isolamento.
/// </summary>
public static class TestDbContextFactory
{
    /// <summary>
    /// Crea un AppDbContext con InMemory database.
    /// Ogni test usa un databaseName univoco per l'isolamento.
    /// </summary>
    public static AppDbContext Create(string? databaseName = null)
    {
        databaseName ??= Guid.NewGuid().ToString();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName)
            .Options;

        // IConfiguration mock minimale — AppDbContext.OnConfiguring ha un guard
        // `if (!optionsBuilder.IsConfigured)` che impedisce di sovrascrivere con MySQL.
        // GetConnectionString is an extension method that reads from
        // IConfiguration.GetSection("ConnectionStrings")[name], so we mock the indexer.
        var configMock = new Mock<IConfiguration>();
        var connectionStringsSection = new Mock<IConfigurationSection>();
        connectionStringsSection.Setup(s => s[It.IsAny<string>()]).Returns("Server=test;Database=test");
        configMock.Setup(c => c.GetSection("ConnectionStrings")).Returns(connectionStringsSection.Object);

        var context = new AppDbContext(options, configMock.Object);
        context.Database.EnsureCreated();
        return context;
    }

    /// <summary>
    /// Crea un contesto e lo popola con dati seed.
    /// </summary>
    public static AppDbContext CreateWithSeed(Action<AppDbContext> seedAction, string? databaseName = null)
    {
        var context = Create(databaseName);
        seedAction(context);
        context.SaveChanges();
        return context;
    }
}
