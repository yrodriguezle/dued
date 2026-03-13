using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Tests for management dashboard aggregate queries (data access layer).
/// Covers daily/weekly/monthly KPI aggregations from register data.
/// </summary>
public class ManagementQueriesTests : IDisposable
{
    private readonly AppDbContext _dbContext;

    public ManagementQueriesTests()
    {
        _dbContext = TestDbContextFactory.Create();
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Helpers

    private Ruolo SeedRuolo(string nome = "Manager")
    {
        var ruolo = new Ruolo { Nome = nome, Descrizione = $"Ruolo {nome}" };
        _dbContext.Ruoli.Add(ruolo);
        _dbContext.SaveChanges();
        return ruolo;
    }

    private Utente SeedUtente(string nome = "manager", Ruolo? ruolo = null)
    {
        ruolo ??= SeedRuolo();
        var utente = JwtTestHelper.CreateTestUtente(id: 0, username: nome);
        utente.RuoloId = ruolo.Id;
        _dbContext.Utenti.Add(utente);
        _dbContext.SaveChanges();
        return utente;
    }

    private RegistroCassa SeedRegistroCassa(
        Utente utente,
        DateTime data,
        decimal totaleVendite = 0,
        decimal venditeContanti = 0,
        decimal incassiElettronici = 0,
        decimal speseFornitori = 0,
        decimal speseGiornaliere = 0,
        string stato = "CLOSED")
    {
        var registro = new RegistroCassa
        {
            Data = data,
            UtenteId = utente.Id,
            Stato = stato,
            TotaleVendite = totaleVendite,
            VenditeContanti = venditeContanti,
            IncassiElettronici = incassiElettronici,
            SpeseFornitori = speseFornitori,
            SpeseGiornaliere = speseGiornaliere
        };
        _dbContext.RegistriCassa.Add(registro);
        _dbContext.SaveChanges();
        return registro;
    }

    #endregion

    #region Monthly Aggregation

    [Fact]
    public async Task MonthlyAggregation_MultipleRegisters_CorrectSumsAndAverages()
    {
        // Arrange
        var utente = SeedUtente();
        SeedRegistroCassa(utente, new DateTime(2026, 3, 1), totaleVendite: 500m, speseFornitori: 100m);
        SeedRegistroCassa(utente, new DateTime(2026, 3, 10), totaleVendite: 800m, speseFornitori: 200m);
        SeedRegistroCassa(utente, new DateTime(2026, 3, 20), totaleVendite: 700m, speseFornitori: 150m);
        // Outside month
        SeedRegistroCassa(utente, new DateTime(2026, 2, 28), totaleVendite: 1000m);

        var startOfMonth = new DateTime(2026, 3, 1);
        var endOfMonth = new DateTime(2026, 3, 31);

        // Act — replicate dashboard KPI aggregation logic
        var monthRegisters = await _dbContext.RegistriCassa
            .Where(r => r.Data >= startOfMonth && r.Data <= endOfMonth)
            .ToListAsync();

        var totaleSales = monthRegisters.Sum(r => r.TotaleVendite);
        var averageSales = monthRegisters.Any() ? monthRegisters.Average(r => r.TotaleVendite) : 0;
        var totaleSpeseFornitori = monthRegisters.Sum(r => r.SpeseFornitori);

        // Assert
        monthRegisters.Should().HaveCount(3);
        totaleSales.Should().Be(2000m);
        averageSales.Should().BeApproximately(666.67m, 0.01m);
        totaleSpeseFornitori.Should().Be(450m);
    }

    #endregion

    #region Weekly Aggregation

    [Fact]
    public async Task WeeklyAggregation_CurrentWeek_CorrectTotals()
    {
        // Arrange — seed a known week (Monday 2026-03-09 to Sunday 2026-03-15)
        var utente = SeedUtente();
        SeedRegistroCassa(utente, new DateTime(2026, 3, 9), totaleVendite: 300m);   // Monday
        SeedRegistroCassa(utente, new DateTime(2026, 3, 10), totaleVendite: 400m);  // Tuesday
        SeedRegistroCassa(utente, new DateTime(2026, 3, 11), totaleVendite: 350m);  // Wednesday
        // Outside week
        SeedRegistroCassa(utente, new DateTime(2026, 3, 16), totaleVendite: 600m);  // Next Monday

        var weekStart = new DateTime(2026, 3, 9);
        var weekEnd = new DateTime(2026, 3, 15);

        // Act
        var weekRegisters = await _dbContext.RegistriCassa
            .Where(r => r.Data >= weekStart && r.Data <= weekEnd)
            .ToListAsync();

        var weekTotal = weekRegisters.Sum(r => r.TotaleVendite);

        // Assert
        weekRegisters.Should().HaveCount(3);
        weekTotal.Should().Be(1050m);
    }

    #endregion

    #region Supplier Expense Aggregation

    [Fact]
    public async Task SupplierExpenseAggregation_MonthlyTotal_CorrectSum()
    {
        // Arrange
        var utente = SeedUtente();
        SeedRegistroCassa(utente, new DateTime(2026, 3, 5),
            totaleVendite: 1000m, speseFornitori: 200m, speseGiornaliere: 50m);
        SeedRegistroCassa(utente, new DateTime(2026, 3, 15),
            totaleVendite: 1200m, speseFornitori: 300m, speseGiornaliere: 75m);
        SeedRegistroCassa(utente, new DateTime(2026, 3, 25),
            totaleVendite: 800m, speseFornitori: 150m, speseGiornaliere: 60m);

        var startOfMonth = new DateTime(2026, 3, 1);
        var endOfMonth = new DateTime(2026, 3, 31);

        // Act
        var registers = await _dbContext.RegistriCassa
            .Where(r => r.Data >= startOfMonth && r.Data <= endOfMonth)
            .ToListAsync();

        var totaleVendite = registers.Sum(r => r.TotaleVendite);
        var totaleSpeseFornitori = registers.Sum(r => r.SpeseFornitori);
        var totaleSpeseGiornaliere = registers.Sum(r => r.SpeseGiornaliere);
        var margineNetto = totaleVendite - totaleSpeseFornitori - totaleSpeseGiornaliere;

        // Assert
        totaleVendite.Should().Be(3000m);
        totaleSpeseFornitori.Should().Be(650m);
        totaleSpeseGiornaliere.Should().Be(185m);
        margineNetto.Should().Be(2165m);
    }

    #endregion

    #region Empty Data

    [Fact]
    public async Task DashboardAggregation_NoData_ReturnsZeros()
    {
        // Arrange — no registers seeded
        var startOfMonth = new DateTime(2026, 3, 1);
        var endOfMonth = new DateTime(2026, 3, 31);

        // Act
        var registers = await _dbContext.RegistriCassa
            .Where(r => r.Data >= startOfMonth && r.Data <= endOfMonth)
            .ToListAsync();

        var totaleSales = registers.Sum(r => r.TotaleVendite);
        var averageSales = registers.Any() ? registers.Average(r => r.TotaleVendite) : 0;

        // Assert
        registers.Should().HaveCount(0);
        totaleSales.Should().Be(0m);
        averageSales.Should().Be(0m);
    }

    #endregion
}
