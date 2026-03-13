using DuedGusto.Tests.Helpers;
using duedgusto.Services.ChiusureMensili;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Tests for monthly closure query operations (data access layer).
/// Since GraphQL resolvers use GraphQLService.GetService which is tightly coupled,
/// we test the underlying EF Core data operations directly, mirroring MonthlyClosuresQueries.
/// Covers REQ-2.2.2: Monthly closure queries.
/// </summary>
public class MonthlyClosuresQueriesTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly ChiusuraMensileService _service;

    public MonthlyClosuresQueriesTests()
    {
        _dbContext = TestDbContextFactory.Create();
        _service = new ChiusuraMensileService(_dbContext);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Helpers

    private Ruolo SeedRuolo()
    {
        var ruolo = new Ruolo { Nome = "Cassiere", Descrizione = "Ruolo Cassiere" };
        _dbContext.Ruoli.Add(ruolo);
        _dbContext.SaveChanges();
        return ruolo;
    }

    private Utente SeedUtente(Ruolo? ruolo = null)
    {
        ruolo ??= SeedRuolo();
        var utente = JwtTestHelper.CreateTestUtente(id: 0);
        utente.RuoloId = ruolo.Id;
        _dbContext.Utenti.Add(utente);
        _dbContext.SaveChanges();
        return utente;
    }

    private BusinessSettings SeedBusinessSettings()
    {
        var settings = new BusinessSettings
        {
            BusinessName = "DuedGusto Test",
            OperatingDays = "[true,true,true,true,true,false,false]",
            VatRate = 0.10m
        };
        _dbContext.BusinessSettings.Add(settings);
        _dbContext.SaveChanges();
        return settings;
    }

    private RegistroCassa SeedRegistroCassa(
        Utente utente,
        DateTime data,
        string stato = "CLOSED",
        decimal totaleVendite = 0,
        decimal incassoContante = 0,
        decimal incassiElettronici = 0,
        decimal incassiFattura = 0,
        decimal importoIva = 0)
    {
        var registro = new RegistroCassa
        {
            Data = data,
            UtenteId = utente.Id,
            Stato = stato,
            TotaleVendite = totaleVendite,
            IncassoContanteTracciato = incassoContante,
            IncassiElettronici = incassiElettronici,
            IncassiFattura = incassiFattura,
            ImportoIva = importoIva
        };
        _dbContext.RegistriCassa.Add(registro);
        _dbContext.SaveChanges();
        return registro;
    }

    /// <summary>
    /// Creates a ChiusuraMensile with associated registers for a given month.
    /// </summary>
    private async Task<ChiusuraMensile> SeedChiusuraWithRegisters(
        Utente utente,
        int anno,
        int mese,
        decimal[] venditePerGiorno,
        string stato = "BOZZA")
    {
        int day = 1;
        foreach (var vendite in venditePerGiorno)
        {
            SeedRegistroCassa(utente, new DateTime(anno, mese, day), "CLOSED", totaleVendite: vendite);
            day++;
        }

        var chiusura = await _service.CreaChiusuraAsync(anno, mese);

        if (stato != "BOZZA")
        {
            // Directly update state for test purposes
            chiusura.Stato = stato;
            await _dbContext.SaveChangesAsync();
        }

        return chiusura;
    }

    #endregion

    #region Query by Year (REQ-2.2.2)

    [Fact]
    public async Task QueryByYear_MultipleClosures_ReturnsFilteredByYear()
    {
        // Arrange
        var utente = SeedUtente();
        SeedBusinessSettings();

        await SeedChiusuraWithRegisters(utente, 2026, 1, [100m, 200m]);
        await SeedChiusuraWithRegisters(utente, 2026, 2, [300m]);
        await SeedChiusuraWithRegisters(utente, 2025, 12, [400m]);

        // Act — mirrors the resolver: query by year with includes
        var results = await _dbContext.ChiusureMensili
            .Include(c => c.RegistriInclusi)
                .ThenInclude(r => r.Registro)
            .Include(c => c.SpeseLibere)
            .Include(c => c.PagamentiInclusi)
                .ThenInclude(p => p.Pagamento)
            .Where(c => c.Anno == 2026)
            .OrderByDescending(c => c.Anno)
                .ThenByDescending(c => c.Mese)
            .ToListAsync();

        // Assert
        results.Should().HaveCount(2);
        results[0].Mese.Should().Be(2); // Descending order
        results[1].Mese.Should().Be(1);
    }

    [Fact]
    public async Task QueryByYear_NoClosures_ReturnsEmptyList()
    {
        // Arrange — no closures seeded for 2027

        // Act
        var results = await _dbContext.ChiusureMensili
            .Where(c => c.Anno == 2027)
            .ToListAsync();

        // Assert
        results.Should().BeEmpty();
    }

    #endregion

    #region Query by Specific Month/Year (REQ-2.2.2)

    [Fact]
    public async Task QueryByMonthYear_ExistingClosure_ReturnsCorrectData()
    {
        // Arrange
        var utente = SeedUtente();
        SeedBusinessSettings();

        await SeedChiusuraWithRegisters(utente, 2026, 3, [500m, 300m, 200m]);

        // Act — mirrors the resolver: query by ID with includes
        var chiusura = await _dbContext.ChiusureMensili
            .Include(c => c.RegistriInclusi)
                .ThenInclude(r => r.Registro)
            .FirstOrDefaultAsync(c => c.Anno == 2026 && c.Mese == 3);

        // Assert
        chiusura.Should().NotBeNull();
        chiusura!.Anno.Should().Be(2026);
        chiusura.Mese.Should().Be(3);
        chiusura.RegistriInclusi.Should().HaveCount(3);
        chiusura.RicavoTotaleCalcolato.Should().Be(1000m);
    }

    [Fact]
    public async Task QueryByMonthYear_NonExisting_ReturnsNull()
    {
        // Act
        var chiusura = await _dbContext.ChiusureMensili
            .FirstOrDefaultAsync(c => c.Anno == 2026 && c.Mese == 11);

        // Assert
        chiusura.Should().BeNull();
    }

    #endregion

    #region Yearly Summary Aggregation (REQ-2.2.2)

    [Fact]
    public async Task YearlySummary_AggregatesAllMonths()
    {
        // Arrange — create closures for Jan, Feb, Mar 2026
        var utente = SeedUtente();
        SeedBusinessSettings();

        await SeedChiusuraWithRegisters(utente, 2026, 1, [1000m]);
        await SeedChiusuraWithRegisters(utente, 2026, 2, [2000m]);
        await SeedChiusuraWithRegisters(utente, 2026, 3, [3000m]);

        // Act
        var closures = await _dbContext.ChiusureMensili
            .Include(c => c.RegistriInclusi)
                .ThenInclude(r => r.Registro)
            .Include(c => c.SpeseLibere)
            .Include(c => c.PagamentiInclusi)
                .ThenInclude(p => p.Pagamento)
            .Where(c => c.Anno == 2026)
            .OrderBy(c => c.Mese)
            .ToListAsync();

        // Assert
        closures.Should().HaveCount(3);

        // Calculate yearly totals
        var yearlyTotal = closures.Sum(c => c.RicavoTotaleCalcolato);
        yearlyTotal.Should().Be(6000m); // 1000 + 2000 + 3000

        closures[0].RicavoTotaleCalcolato.Should().Be(1000m);
        closures[1].RicavoTotaleCalcolato.Should().Be(2000m);
        closures[2].RicavoTotaleCalcolato.Should().Be(3000m);
    }

    [Fact]
    public async Task YearlySummary_WithExpenses_CalculatesNetCorrectly()
    {
        // Arrange
        var utente = SeedUtente();
        SeedBusinessSettings();

        var chiusura = await SeedChiusuraWithRegisters(utente, 2026, 1, [5000m]);

        // Add expenses
        await _service.AggiungiSpesaLiberaAsync(chiusura.ChiusuraId, "Affitto", 1000m, CategoriaSpesa.Affitto);
        await _service.AggiungiSpesaLiberaAsync(chiusura.ChiusuraId, "Utenze", 300m, CategoriaSpesa.Utenze);

        // Act
        var loaded = await _dbContext.ChiusureMensili
            .Include(c => c.RegistriInclusi)
                .ThenInclude(r => r.Registro)
            .Include(c => c.SpeseLibere)
            .Include(c => c.PagamentiInclusi)
                .ThenInclude(p => p.Pagamento)
            .FirstAsync(c => c.ChiusuraId == chiusura.ChiusuraId);

        // Assert
        loaded.RicavoTotaleCalcolato.Should().Be(5000m);
        loaded.SpeseAggiuntiveCalcolate.Should().Be(1300m);
        loaded.RicavoNettoCalcolato.Should().Be(3700m);
    }

    #endregion

    #region Query by ID with Full Relations (REQ-2.2.2)

    [Fact]
    public async Task QueryById_LoadsAllRelations()
    {
        // Arrange
        var utente = SeedUtente();
        SeedBusinessSettings();

        var chiusura = await SeedChiusuraWithRegisters(utente, 2026, 8, [1000m]);
        await _service.AggiungiSpesaLiberaAsync(chiusura.ChiusuraId, "Stipendi", 2000m, CategoriaSpesa.Stipendi);

        // Act — mirrors the resolver: use service to load with all relations
        var loaded = await _service.GetChiusuraConRelazioniAsync(chiusura.ChiusuraId);

        // Assert
        loaded.Should().NotBeNull();
        loaded!.RegistriInclusi.Should().HaveCount(1);
        loaded.SpeseLibere.Should().HaveCount(1);
        loaded.SpeseLibere.First().Descrizione.Should().Be("Stipendi");
    }

    #endregion
}
