using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Tests for cash register query operations (data access layer).
/// Since GraphQL resolvers use GraphQLService.GetService which is tightly coupled,
/// we test the underlying EF Core data operations directly.
/// Covers REQ-2.1.1: Cash Register CRUD (query side).
/// </summary>
public class CashManagementQueriesTests : IDisposable
{
    private readonly AppDbContext _dbContext;

    public CashManagementQueriesTests()
    {
        _dbContext = TestDbContextFactory.Create();
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Helpers

    private Ruolo SeedRuolo(string nome = "Cassiere")
    {
        var ruolo = new Ruolo { Nome = nome, Descrizione = $"Ruolo {nome}" };
        _dbContext.Ruoli.Add(ruolo);
        _dbContext.SaveChanges();
        return ruolo;
    }

    private Utente SeedUtente(string nome = JwtTestHelper.E2eUsername, Ruolo? ruolo = null)
    {
        ruolo ??= SeedRuolo();
        var utente = JwtTestHelper.CreateTestUtente(id: 0, username: nome);
        utente.RuoloId = ruolo.Id;
        _dbContext.Utenti.Add(utente);
        _dbContext.SaveChanges();
        return utente;
    }

    private DenominazioneMoneta SeedDenominazione(decimal valore, string tipo = "COIN", int ordine = 0)
    {
        var denom = new DenominazioneMoneta { Valore = valore, Tipo = tipo, OrdineVisualizzazione = ordine };
        _dbContext.DenominazioniMoneta.Add(denom);
        _dbContext.SaveChanges();
        return denom;
    }

    private RegistroCassa SeedRegistroCassa(
        Utente utente,
        DateTime data,
        string stato = "DRAFT",
        decimal totaleVendite = 0,
        decimal incassiElettronici = 0,
        decimal incassoContante = 0,
        decimal incassiFattura = 0,
        decimal speseGiornaliere = 0,
        decimal speseFornitori = 0)
    {
        var registro = new RegistroCassa
        {
            Data = data,
            UtenteId = utente.Id,
            Stato = stato,
            TotaleVendite = totaleVendite,
            IncassiElettronici = incassiElettronici,
            IncassoContanteTracciato = incassoContante,
            IncassiFattura = incassiFattura,
            SpeseGiornaliere = speseGiornaliere,
            SpeseFornitori = speseFornitori
        };
        _dbContext.RegistriCassa.Add(registro);
        _dbContext.SaveChanges();
        return registro;
    }

    #endregion

    #region Query by Date (REQ-2.1.1)

    [Fact]
    public async Task QueryByDate_ExistingRegister_ReturnsCorrectRecord()
    {
        // Arrange
        var utente = SeedUtente();
        var targetDate = new DateTime(2026, 3, 12);
        var registro = SeedRegistroCassa(utente, targetDate, totaleVendite: 500m);

        // Act — mirrors the resolver logic: query by date with includes
        var result = await _dbContext.RegistriCassa
            .Include(r => r.Utente)
            .Include(r => r.ConteggiMoneta)
            .Include(r => r.SpeseCassa)
            .Where(r => r.Data == targetDate)
            .FirstOrDefaultAsync();

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(registro.Id);
        result.Data.Should().Be(targetDate);
        result.TotaleVendite.Should().Be(500m);
        result.Utente.Should().NotBeNull();
        result.Utente.NomeUtente.Should().Be(JwtTestHelper.E2eUsername);
    }

    [Fact]
    public async Task QueryByDate_NonExistingDate_ReturnsNull()
    {
        // Arrange
        var utente = SeedUtente();
        SeedRegistroCassa(utente, new DateTime(2026, 3, 12));

        // Act
        var result = await _dbContext.RegistriCassa
            .Where(r => r.Data == new DateTime(2026, 3, 15))
            .FirstOrDefaultAsync();

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region Query by Date Range (REQ-2.1.1)

    [Fact]
    public async Task QueryByDateRange_MultipleRegisters_ReturnsFilteredResults()
    {
        // Arrange
        var utente = SeedUtente();
        SeedRegistroCassa(utente, new DateTime(2026, 2, 15), totaleVendite: 100m); // February
        SeedRegistroCassa(utente, new DateTime(2026, 3, 1), totaleVendite: 200m);  // March
        SeedRegistroCassa(utente, new DateTime(2026, 3, 10), totaleVendite: 300m); // March
        SeedRegistroCassa(utente, new DateTime(2026, 3, 20), totaleVendite: 400m); // March
        SeedRegistroCassa(utente, new DateTime(2026, 4, 5), totaleVendite: 500m);  // April

        var startDate = new DateTime(2026, 3, 1);
        var endDate = new DateTime(2026, 3, 31);

        // Act
        var results = await _dbContext.RegistriCassa
            .Where(r => r.Data >= startDate && r.Data <= endDate)
            .OrderBy(r => r.Data)
            .ToListAsync();

        // Assert
        results.Should().HaveCount(3);
        results[0].TotaleVendite.Should().Be(200m);
        results[1].TotaleVendite.Should().Be(300m);
        results[2].TotaleVendite.Should().Be(400m);
    }

    [Fact]
    public async Task QueryByMonth_ReturnsOnlyMatchingMonth()
    {
        // Arrange — 3 in March 2026, 2 in February 2026
        var utente = SeedUtente();
        SeedRegistroCassa(utente, new DateTime(2026, 2, 10));
        SeedRegistroCassa(utente, new DateTime(2026, 2, 20));
        SeedRegistroCassa(utente, new DateTime(2026, 3, 5));
        SeedRegistroCassa(utente, new DateTime(2026, 3, 15));
        SeedRegistroCassa(utente, new DateTime(2026, 3, 25));

        var startOfMonth = new DateTime(2026, 3, 1);
        var endOfMonth = new DateTime(2026, 3, 31);

        // Act
        var results = await _dbContext.RegistriCassa
            .Where(r => r.Data >= startOfMonth && r.Data <= endOfMonth)
            .ToListAsync();

        // Assert
        results.Should().HaveCount(3);
    }

    #endregion

    #region Include Navigation Properties (REQ-2.1.1)

    [Fact]
    public async Task QueryWithIncludes_LoadsIncassiAndSpese()
    {
        // Arrange
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12),
            incassiElettronici: 150m);

        _dbContext.SpeseCassa.Add(new SpesaCassa
        {
            RegistroCassaId = registro.Id,
            Descrizione = "Spesa fornitore",
            Importo = 50m
        });
        await _dbContext.SaveChangesAsync();

        // Act
        var result = await _dbContext.RegistriCassa
            .Include(r => r.SpeseCassa)
            .FirstOrDefaultAsync(r => r.Id == registro.Id);

        // Assert
        result.Should().NotBeNull();
        result!.IncassiElettronici.Should().Be(150m);
        result.SpeseCassa.Should().HaveCount(1);
        result.SpeseCassa.First().Importo.Should().Be(50m);
    }

    [Fact]
    public async Task QueryWithIncludes_LoadsConteggiMoneta()
    {
        // Arrange
        var utente = SeedUtente();
        var denom = SeedDenominazione(0.50m, "COIN", 1);
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12));

        _dbContext.ConteggiMoneta.Add(new ConteggioMoneta
        {
            RegistroCassaId = registro.Id,
            DenominazioneMonetaId = denom.Id,
            Quantita = 10,
            Totale = 5.00m,
            IsApertura = true
        });
        await _dbContext.SaveChangesAsync();

        // Act
        var result = await _dbContext.RegistriCassa
            .Include(r => r.ConteggiMoneta)
                .ThenInclude(c => c.Denominazione)
            .FirstOrDefaultAsync(r => r.Id == registro.Id);

        // Assert
        result.Should().NotBeNull();
        result!.ConteggiMoneta.Should().HaveCount(1);
        var conteggio = result.ConteggiMoneta.First();
        conteggio.Quantita.Should().Be(10);
        conteggio.Totale.Should().Be(5.00m);
        conteggio.IsApertura.Should().BeTrue();
        conteggio.Denominazione.Valore.Should().Be(0.50m);
    }

    #endregion

    #region Denominations Query (REQ-2.1.1)

    [Fact]
    public async Task QueryDenominazioni_ReturnsOrderedByDisplay()
    {
        // Arrange
        SeedDenominazione(0.50m, "COIN", 2);
        SeedDenominazione(0.10m, "COIN", 1);
        SeedDenominazione(5.00m, "BANKNOTE", 3);

        // Act — mirrors the resolver logic
        var results = await _dbContext.DenominazioniMoneta
            .OrderBy(d => d.OrdineVisualizzazione)
            .ToListAsync();

        // Assert
        results.Should().HaveCount(3);
        results[0].Valore.Should().Be(0.10m);
        results[1].Valore.Should().Be(0.50m);
        results[2].Valore.Should().Be(5.00m);
    }

    #endregion

    #region Dashboard KPIs (REQ-2.1.1)

    [Fact]
    public async Task DashboardKPIs_AggregatesMonthData()
    {
        // Arrange
        var utente = SeedUtente();
        var today = DateTime.Today;
        var startOfMonth = new DateTime(today.Year, today.Month, 1);

        SeedRegistroCassa(utente, today, totaleVendite: 100m);
        SeedRegistroCassa(utente, today.AddDays(-1), totaleVendite: 200m);
        SeedRegistroCassa(utente, today.AddDays(-2), totaleVendite: 300m);

        // Act — mirrors the KPI resolver logic
        var monthRegisters = await _dbContext.RegistriCassa
            .Where(r => r.Data >= startOfMonth && r.Data <= today)
            .ToListAsync();

        var monthSales = monthRegisters.Sum(r => r.TotaleVendite);
        var monthAverage = monthRegisters.Any() ? monthRegisters.Average(r => r.TotaleVendite) : 0;

        // Assert
        monthSales.Should().Be(600m);
        monthAverage.Should().Be(200m);
    }

    [Fact]
    public async Task DashboardKPIs_EmptyMonth_ReturnsZero()
    {
        // Arrange — no registers seeded
        var today = DateTime.Today;
        var startOfMonth = new DateTime(today.Year, today.Month, 1);

        // Act
        var monthRegisters = await _dbContext.RegistriCassa
            .Where(r => r.Data >= startOfMonth && r.Data <= today)
            .ToListAsync();

        var monthSales = monthRegisters.Sum(r => r.TotaleVendite);
        var monthAverage = monthRegisters.Any() ? monthRegisters.Average(r => r.TotaleVendite) : 0;

        // Assert
        monthSales.Should().Be(0m);
        monthAverage.Should().Be(0m);
    }

    #endregion
}
