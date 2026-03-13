using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Tests for business settings CRUD operations (data access layer).
/// Covers creation, update with partial fields, and singleton pattern.
/// </summary>
public class SettingsTests : IDisposable
{
    private readonly AppDbContext _dbContext;

    public SettingsTests()
    {
        _dbContext = TestDbContextFactory.Create();
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Query Settings

    [Fact]
    public async Task QuerySettings_NoSettings_ReturnsNull()
    {
        // Act
        var result = await _dbContext.BusinessSettings.FirstOrDefaultAsync();

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task QuerySettings_ExistingSettings_ReturnsRecord()
    {
        // Arrange
        var settings = new BusinessSettings
        {
            BusinessName = "DuedGusto Ristorante",
            OpeningTime = "10:00",
            ClosingTime = "23:00",
            VatRate = 0.10m,
            Currency = "EUR",
            Timezone = "Europe/Rome"
        };
        _dbContext.BusinessSettings.Add(settings);
        await _dbContext.SaveChangesAsync();

        // Act — mirrors the settings query resolver
        var result = await _dbContext.BusinessSettings.FirstOrDefaultAsync();

        // Assert
        result.Should().NotBeNull();
        result!.BusinessName.Should().Be("DuedGusto Ristorante");
        result.OpeningTime.Should().Be("10:00");
        result.ClosingTime.Should().Be("23:00");
        result.VatRate.Should().Be(0.10m);
        result.Currency.Should().Be("EUR");
    }

    #endregion

    #region Create Settings

    [Fact]
    public async Task CreateSettings_WithAllFields_PersistsCorrectly()
    {
        // Arrange & Act
        var settings = new BusinessSettings
        {
            BusinessName = "Test Pizzeria",
            OpeningTime = "11:30",
            ClosingTime = "22:00",
            OperatingDays = "[true,true,true,true,true,true,false]",
            Timezone = "Europe/Rome",
            Currency = "EUR",
            VatRate = 0.22m
        };
        _dbContext.BusinessSettings.Add(settings);
        await _dbContext.SaveChangesAsync();

        // Assert
        var persisted = await _dbContext.BusinessSettings.FirstAsync();
        persisted.BusinessName.Should().Be("Test Pizzeria");
        persisted.OperatingDays.Should().Be("[true,true,true,true,true,true,false]");
        persisted.VatRate.Should().Be(0.22m);
    }

    #endregion

    #region Update Settings (Singleton Pattern)

    [Fact]
    public async Task UpdateSettings_PartialUpdate_OnlyChangesProvidedFields()
    {
        // Arrange — create initial settings
        var settings = new BusinessSettings
        {
            BusinessName = "Nome Originale",
            OpeningTime = "09:00",
            ClosingTime = "18:00",
            VatRate = 0.22m,
            Currency = "EUR",
            Timezone = "Europe/Rome"
        };
        _dbContext.BusinessSettings.Add(settings);
        await _dbContext.SaveChangesAsync();

        // Act — replicate the mutation's partial update logic
        var loaded = await _dbContext.BusinessSettings.FirstOrDefaultAsync();
        loaded.Should().NotBeNull();

        // Simulate partial input: only businessName and vatRate changed
        string newBusinessName = "Nome Aggiornato";
        decimal? newVatRate = 0.10m;

        if (!string.IsNullOrEmpty(newBusinessName))
            loaded!.BusinessName = newBusinessName;

        if (newVatRate.HasValue && newVatRate.Value > 0)
            loaded!.VatRate = newVatRate.Value;

        loaded!.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        // Assert
        var result = await _dbContext.BusinessSettings.FirstAsync();
        result.BusinessName.Should().Be("Nome Aggiornato");
        result.VatRate.Should().Be(0.10m);
        // Unchanged fields should remain
        result.OpeningTime.Should().Be("09:00");
        result.ClosingTime.Should().Be("18:00");
        result.Currency.Should().Be("EUR");
    }

    #endregion

    #region Default Values

    [Fact]
    public void BusinessSettings_DefaultValues_AreCorrect()
    {
        // Arrange & Act
        var settings = new BusinessSettings();

        // Assert
        settings.OpeningTime.Should().Be("09:00");
        settings.ClosingTime.Should().Be("18:00");
        settings.Timezone.Should().Be("Europe/Rome");
        settings.Currency.Should().Be("EUR");
        settings.VatRate.Should().Be(0.22m);
        settings.OperatingDays.Should().Be("[true,true,true,true,true,false,false]");
    }

    #endregion
}
