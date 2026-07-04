using DuedGusto.Tests.Helpers;

using duedgusto.GraphQL.GestioneCassa;

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
        decimal speseFornitori = 0,
        decimal totaleApertura = 0,
        decimal totaleChiusura = 0)
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
            SpeseFornitori = speseFornitori,
            TotaleApertura = totaleApertura,
            TotaleChiusura = totaleChiusura
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
        // Data di riferimento a metà mese: evita che AddDays(-1/-2) sconfini nel
        // mese precedente nei primi giorni del mese (altrimenti test flaky).
        var referenceDate = startOfMonth.AddDays(14);

        SeedRegistroCassa(utente, referenceDate, totaleVendite: 100m);
        SeedRegistroCassa(utente, referenceDate.AddDays(-1), totaleVendite: 200m);
        SeedRegistroCassa(utente, referenceDate.AddDays(-2), totaleVendite: 300m);

        // Act — mirrors the KPI resolver logic
        var monthRegisters = await _dbContext.RegistriCassa
            .Where(r => r.Data >= startOfMonth && r.Data <= referenceDate)
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

    #region Riepilogo Annuale (dashboard-charts-redesign, Fase 1)

    [Fact]
    public async Task RiepilogoAnnuale_AnnoConDatiParziali_Restituisce12MesiOrdinatiConZeriPerIMesiVuoti()
    {
        // Arrange — registri solo a gennaio e marzo 2026
        var utente = SeedUtente();
        SeedRegistroCassa(utente, new DateTime(2026, 1, 10), stato: "CLOSED",
            totaleVendite: 100.50m, incassoContante: 40.25m, incassiElettronici: 50.25m,
            incassiFattura: 10m, totaleApertura: 200m, totaleChiusura: 260.25m);
        SeedRegistroCassa(utente, new DateTime(2026, 3, 5), stato: "CLOSED",
            totaleVendite: 300m, speseFornitori: 45.10m, speseGiornaliere: 12.90m);

        // Act
        var risultato = await RiepilogoAnnualeCassa.AggregaAsync(_dbContext.RegistriCassa, 2026);

        // Assert — sempre 12 elementi ordinati 1-12
        risultato.Anno.Should().Be(2026);
        risultato.Mesi.Should().HaveCount(12);
        risultato.Mesi.Select(m => m.Mese).Should().Equal(Enumerable.Range(1, 12));
        risultato.Mesi.Should().OnlyContain(m => m.Anno == 2026);

        // Gennaio: aggregati corretti
        var gennaio = risultato.Mesi[0];
        gennaio.TotaleVendite.Should().Be(100.50m);
        gennaio.RicavoTracciato.Should().Be(40.25m + 50.25m + 10m);
        gennaio.RicavoNonTracciato.Should().Be((260.25m - 200m) - 40.25m);
        gennaio.Registri.Should().Be(1);

        // Marzo: aggregati corretti
        var marzo = risultato.Mesi[2];
        marzo.TotaleVendite.Should().Be(300m);
        marzo.SpeseTracciate.Should().Be(45.10m);
        marzo.SpeseNonTracciate.Should().Be(12.90m);

        // Tutti gli altri mesi: valori a zero
        var mesiVuoti = risultato.Mesi.Where(m => m.Mese != 1 && m.Mese != 3).ToList();
        mesiVuoti.Should().HaveCount(10);
        mesiVuoti.Should().OnlyContain(m =>
            m.TotaleVendite == 0 && m.RicavoTracciato == 0 && m.RicavoNonTracciato == 0 &&
            m.SpeseTracciate == 0 && m.SpeseNonTracciate == 0 &&
            m.IncassoContanteTracciato == 0 && m.IncassiElettronici == 0 && m.IncassiFattura == 0 &&
            m.Registri == 0 && m.Chiusi == 0 && m.Bozze == 0);
    }

    [Fact]
    public async Task RiepilogoAnnuale_ParitaAlCentesimo_AggregatoCoincideConSommaPerRegistro()
    {
        // Arrange — dataset misto: stati diversi, centesimi "scomodi", tutte le categorie
        // di incasso, non tracciato negativo, mesi multipli
        var utente = SeedUtente();
        var anno = 2026;
        SeedRegistroCassa(utente, new DateTime(anno, 2, 3), stato: "CLOSED",
            totaleVendite: 1234.56m, incassoContante: 400.01m, incassiElettronici: 700.02m,
            incassiFattura: 134.53m, speseFornitori: 250.99m, speseGiornaliere: 33.33m,
            totaleApertura: 150.00m, totaleChiusura: 583.34m);
        SeedRegistroCassa(utente, new DateTime(anno, 2, 14), stato: "RECONCILED",
            totaleVendite: 987.65m, incassoContante: 300.10m, incassiElettronici: 600.55m,
            incassiFattura: 87.00m, speseFornitori: 120.45m, speseGiornaliere: 0.01m,
            totaleApertura: 200.00m, totaleChiusura: 512.10m);
        // DRAFT con non tracciato negativo: (100 − 150) − 10 = −60
        SeedRegistroCassa(utente, new DateTime(anno, 2, 28), stato: "DRAFT",
            totaleVendite: 55.55m, incassoContante: 10.00m, incassiElettronici: 45.55m,
            totaleApertura: 150.00m, totaleChiusura: 100.00m);
        SeedRegistroCassa(utente, new DateTime(anno, 11, 30), stato: "CLOSED",
            totaleVendite: 0.01m, incassiFattura: 0.01m, speseGiornaliere: 99999.99m);
        // Registro di un altro anno: NON deve concorrere
        SeedRegistroCassa(utente, new DateTime(anno - 1, 2, 10), stato: "CLOSED", totaleVendite: 9999m);

        var registriAnno = _dbContext.RegistriCassa.AsEnumerable()
            .Where(r => r.Data.Year == anno)
            .ToList();

        // Act
        var risultato = await RiepilogoAnnualeCassa.AggregaAsync(_dbContext.RegistriCassa, anno);

        // Assert — per ogni mese, ogni campo coincide al centesimo con la somma
        // per-registro delle formule normative
        foreach (var mese in risultato.Mesi)
        {
            var attesi = registriAnno.Where(r => r.Data.Month == mese.Mese).ToList();
            mese.TotaleVendite.Should().Be(attesi.Sum(r => r.TotaleVendite));
            mese.RicavoTracciato.Should().Be(attesi.Sum(r => r.IncassoContanteTracciato + r.IncassiElettronici + r.IncassiFattura));
            mese.RicavoNonTracciato.Should().Be(attesi.Sum(r => (r.TotaleChiusura - r.TotaleApertura) - r.IncassoContanteTracciato));
            mese.SpeseTracciate.Should().Be(attesi.Sum(r => r.SpeseFornitori));
            mese.SpeseNonTracciate.Should().Be(attesi.Sum(r => r.SpeseGiornaliere));
            mese.IncassoContanteTracciato.Should().Be(attesi.Sum(r => r.IncassoContanteTracciato));
            mese.IncassiElettronici.Should().Be(attesi.Sum(r => r.IncassiElettronici));
            mese.IncassiFattura.Should().Be(attesi.Sum(r => r.IncassiFattura));
            mese.Registri.Should().Be(attesi.Count);
        }

        // Il registro dell'anno precedente non è incluso
        risultato.Mesi.Sum(m => m.TotaleVendite).Should().Be(registriAnno.Sum(r => r.TotaleVendite));
    }

    [Fact]
    public async Task RiepilogoAnnuale_DraftInclusiNeiTotali_EContatiSeparatamente()
    {
        // Arrange — febbraio: 1 CLOSED, 1 RECONCILED, 1 DRAFT
        var utente = SeedUtente();
        SeedRegistroCassa(utente, new DateTime(2026, 2, 1), stato: "CLOSED", totaleVendite: 100m);
        SeedRegistroCassa(utente, new DateTime(2026, 2, 2), stato: "RECONCILED", totaleVendite: 200m);
        SeedRegistroCassa(utente, new DateTime(2026, 2, 3), stato: "DRAFT", totaleVendite: 50m);

        // Act
        var risultato = await RiepilogoAnnualeCassa.AggregaAsync(_dbContext.RegistriCassa, 2026);

        // Assert — la bozza concorre ai totali monetari ed è contata in Bozze
        var febbraio = risultato.Mesi[1];
        febbraio.TotaleVendite.Should().Be(350m); // 100 + 200 + 50 (DRAFT incluso)
        febbraio.Registri.Should().Be(3);
        febbraio.Chiusi.Should().Be(2); // CLOSED + RECONCILED
        febbraio.Bozze.Should().Be(1);
    }

    [Fact]
    public async Task RiepilogoAnnuale_AnnoSenzaRegistri_Restituisce12MesiAZeroSenzaErrori()
    {
        // Arrange — nessun registro seedato per il 2030
        var utente = SeedUtente();
        SeedRegistroCassa(utente, new DateTime(2026, 5, 5), totaleVendite: 100m);

        // Act
        var risultato = await RiepilogoAnnualeCassa.AggregaAsync(_dbContext.RegistriCassa, 2030);

        // Assert
        risultato.Anno.Should().Be(2030);
        risultato.Mesi.Should().HaveCount(12);
        risultato.Mesi.Select(m => m.Mese).Should().Equal(Enumerable.Range(1, 12));
        risultato.Mesi.Should().OnlyContain(m =>
            m.Anno == 2030 &&
            m.TotaleVendite == 0 && m.RicavoTracciato == 0 && m.RicavoNonTracciato == 0 &&
            m.SpeseTracciate == 0 && m.SpeseNonTracciate == 0 &&
            m.IncassoContanteTracciato == 0 && m.IncassiElettronici == 0 && m.IncassiFattura == 0 &&
            m.Registri == 0 && m.Chiusi == 0 && m.Bozze == 0);
    }

    [Fact]
    public void CompletaDodiciMesi_ConAggregatiParziali_RestituisceSempre12ElementiOrdinati()
    {
        // Arrange — aggregati fuori ordine e parziali
        var aggregati = new List<duedgusto.GraphQL.GestioneCassa.RiepilogoMeseCassa>
        {
            new() { Anno = 2026, Mese = 7, TotaleVendite = 700m, Registri = 2 },
            new() { Anno = 2026, Mese = 2, TotaleVendite = 200m, Registri = 1 },
        };

        // Act
        var risultato = duedgusto.GraphQL.GestioneCassa.RiepilogoAnnualeCassa.CompletaDodiciMesi(2026, aggregati);

        // Assert
        risultato.Mesi.Should().HaveCount(12);
        risultato.Mesi.Select(m => m.Mese).Should().Equal(Enumerable.Range(1, 12));
        risultato.Mesi[1].TotaleVendite.Should().Be(200m);
        risultato.Mesi[6].TotaleVendite.Should().Be(700m);
        risultato.Mesi.Where(m => m.Mese != 2 && m.Mese != 7)
            .Should().OnlyContain(m => m.TotaleVendite == 0 && m.Registri == 0 && m.Anno == 2026);
    }

    [Fact]
    public void RiepilogoAnnuale_RichiedeAutorizzazione_ComeGliAltriFieldDiGestioneCassa()
    {
        // Arrange/Act — la classe GestioneCassaQueries applica this.Authorize() nel
        // costruttore: senza JWT il middleware GraphQL risponde ACCESS_DENIED per
        // tutti i field del namespace, incluso riepilogoAnnuale.
        var queries = new duedgusto.GraphQL.GestioneCassa.GestioneCassaQueries();

        // Assert
        global::GraphQL.AuthorizationExtensions.IsAuthorizationRequired(queries).Should().BeTrue();
        queries.Fields.Find("riepilogoAnnuale").Should().NotBeNull();
    }

    #endregion
}
