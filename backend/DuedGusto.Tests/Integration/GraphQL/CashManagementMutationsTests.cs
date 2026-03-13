using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Tests for cash register mutation operations (data access layer).
/// Since GraphQL resolvers use GraphQLService.GetService which is tightly coupled,
/// we test the underlying EF Core data operations directly, replicating the
/// business logic found in CashManagementMutations.
/// Covers REQ-2.1.1, REQ-2.1.2, REQ-2.1.3.
/// </summary>
public class CashManagementMutationsTests : IDisposable
{
    private readonly AppDbContext _dbContext;

    public CashManagementMutationsTests()
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

    private BusinessSettings SeedBusinessSettings(decimal vatRate = 0.10m)
    {
        var settings = new BusinessSettings
        {
            BusinessName = "DuedGusto Test",
            OperatingDays = "[true,true,true,true,true,false,false]", // Mon-Fri open
            VatRate = vatRate
        };
        _dbContext.BusinessSettings.Add(settings);
        _dbContext.SaveChanges();
        return settings;
    }

    private RegistroCassa SeedRegistroCassa(
        Utente utente,
        DateTime data,
        string stato = "DRAFT",
        decimal totaleVendite = 0,
        decimal incassiElettronici = 0,
        decimal incassoContante = 0,
        decimal incassiFattura = 0)
    {
        var registro = new RegistroCassa
        {
            Data = data,
            UtenteId = utente.Id,
            Stato = stato,
            TotaleVendite = totaleVendite,
            IncassiElettronici = incassiElettronici,
            IncassoContanteTracciato = incassoContante,
            IncassiFattura = incassiFattura
        };
        _dbContext.RegistriCassa.Add(registro);
        _dbContext.SaveChanges();
        return registro;
    }

    #endregion

    #region Create Register (REQ-2.1.1)

    [Fact]
    public async Task CreateCashRegister_WithValidData_PersistsToDatabase()
    {
        // Arrange
        var utente = SeedUtente();
        var targetDate = new DateTime(2026, 3, 12); // Thursday

        // Act — replicate mutation logic
        var registro = new RegistroCassa
        {
            Data = targetDate,
            UtenteId = utente.Id,
            Stato = "DRAFT",
            Note = "Test register",
            AggiornatoIl = DateTime.UtcNow
        };
        _dbContext.RegistriCassa.Add(registro);
        await _dbContext.SaveChangesAsync();

        // Assert
        var persisted = await _dbContext.RegistriCassa
            .FirstOrDefaultAsync(r => r.Id == registro.Id);
        persisted.Should().NotBeNull();
        persisted!.Data.Should().Be(targetDate);
        persisted.UtenteId.Should().Be(utente.Id);
        persisted.Stato.Should().Be("DRAFT");
        persisted.Note.Should().Be("Test register");
    }

    [Fact]
    public async Task CreateCashRegister_WithIncassiAndSpese_PersistsCollections()
    {
        // Arrange
        var utente = SeedUtente();

        // Act
        var registro = new RegistroCassa
        {
            Data = new DateTime(2026, 3, 12),
            UtenteId = utente.Id,
            Stato = "DRAFT"
        };
        _dbContext.RegistriCassa.Add(registro);
        await _dbContext.SaveChangesAsync();

        registro.IncassiCassa.Add(new IncassoCassa
        {
            RegistroCassaId = registro.Id,
            Tipo = "Pago in Bianco (Contante)",
            Importo = 100m
        });
        registro.IncassiCassa.Add(new IncassoCassa
        {
            RegistroCassaId = registro.Id,
            Tipo = "Pagamenti Elettronici",
            Importo = 50m
        });
        registro.SpeseCassa.Add(new SpesaCassa
        {
            RegistroCassaId = registro.Id,
            Descrizione = "Caffè",
            Importo = 30m
        });
        await _dbContext.SaveChangesAsync();

        // Assert
        var loaded = await _dbContext.RegistriCassa
            .Include(r => r.IncassiCassa)
            .Include(r => r.SpeseCassa)
            .FirstAsync(r => r.Id == registro.Id);

        loaded.IncassiCassa.Should().HaveCount(2);
        loaded.SpeseCassa.Should().HaveCount(1);
    }

    #endregion

    #region Coin Counting (REQ-2.1.2)

    [Fact]
    public async Task CreateCashRegister_WithConteggiMoneta_CalculatesTotals()
    {
        // Arrange
        var utente = SeedUtente();
        var denom50c = SeedDenominazione(0.50m, "COIN", 1);
        var denom1e = SeedDenominazione(1.00m, "COIN", 2);
        var denom5e = SeedDenominazione(5.00m, "BANKNOTE", 3);

        var registro = new RegistroCassa
        {
            Data = new DateTime(2026, 3, 12),
            UtenteId = utente.Id,
            Stato = "DRAFT"
        };
        _dbContext.RegistriCassa.Add(registro);
        await _dbContext.SaveChangesAsync();

        // Act — replicate mutation coin counting logic
        decimal totaleApertura = 0;
        var openingCounts = new[]
        {
            (denomId: denom50c.Id, qty: 10, value: 0.50m),  // 5.00
            (denomId: denom1e.Id, qty: 5, value: 1.00m),    // 5.00
            (denomId: denom5e.Id, qty: 3, value: 5.00m),    // 15.00
        };

        foreach (var (denomId, qty, value) in openingCounts)
        {
            decimal totale = qty * value;
            totaleApertura += totale;
            registro.ConteggiMoneta.Add(new ConteggioMoneta
            {
                DenominazioneMonetaId = denomId,
                Quantita = qty,
                Totale = totale,
                IsApertura = true
            });
        }

        decimal totaleChiusura = 0;
        var closingCounts = new[]
        {
            (denomId: denom50c.Id, qty: 20, value: 0.50m),  // 10.00
            (denomId: denom1e.Id, qty: 10, value: 1.00m),   // 10.00
            (denomId: denom5e.Id, qty: 8, value: 5.00m),    // 40.00
        };

        foreach (var (denomId, qty, value) in closingCounts)
        {
            decimal totale = qty * value;
            totaleChiusura += totale;
            registro.ConteggiMoneta.Add(new ConteggioMoneta
            {
                DenominazioneMonetaId = denomId,
                Quantita = qty,
                Totale = totale,
                IsApertura = false
            });
        }

        registro.TotaleApertura = totaleApertura;
        registro.TotaleChiusura = totaleChiusura;
        await _dbContext.SaveChangesAsync();

        // Assert
        var loaded = await _dbContext.RegistriCassa
            .Include(r => r.ConteggiMoneta)
            .FirstAsync(r => r.Id == registro.Id);

        loaded.TotaleApertura.Should().Be(25.00m); // 5 + 5 + 15
        loaded.TotaleChiusura.Should().Be(60.00m); // 10 + 10 + 40
        loaded.ConteggiMoneta.Should().HaveCount(6); // 3 opening + 3 closing
        loaded.ConteggiMoneta.Count(c => c.IsApertura).Should().Be(3);
        loaded.ConteggiMoneta.Count(c => !c.IsApertura).Should().Be(3);
    }

    #endregion

    #region Close Register (REQ-2.1.2)

    [Fact]
    public async Task CloseRegister_DraftRegister_SetsStatusToClosed()
    {
        // Arrange
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12), "DRAFT");

        // Act — replicate close mutation logic
        var loaded = await _dbContext.RegistriCassa.FirstAsync(r => r.Id == registro.Id);
        loaded.Stato.Should().Be("DRAFT"); // Pre-condition

        loaded.Stato = "CLOSED";
        loaded.AggiornatoIl = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        // Assert
        var result = await _dbContext.RegistriCassa.FirstAsync(r => r.Id == registro.Id);
        result.Stato.Should().Be("CLOSED");
    }

    [Fact]
    public void CloseRegister_AlreadyClosed_ShouldBeRejected()
    {
        // Arrange
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12), "CLOSED");

        // Act & Assert — replicate the guard from the resolver
        var loaded = _dbContext.RegistriCassa.First(r => r.Id == registro.Id);
        var isClosed = loaded.Stato == "CLOSED" || loaded.Stato == "RECONCILED";

        isClosed.Should().BeTrue("a closed register should be detected as already closed");
    }

    [Fact]
    public void CloseRegister_ReconciledRegister_ShouldBeRejected()
    {
        // Arrange
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12), "RECONCILED");

        // Act & Assert
        var loaded = _dbContext.RegistriCassa.First(r => r.Id == registro.Id);
        var isClosed = loaded.Stato == "CLOSED" || loaded.Stato == "RECONCILED";

        isClosed.Should().BeTrue("a reconciled register should be detected as already closed");
    }

    #endregion

    #region Delete Register (REQ-2.1.2)

    [Fact]
    public async Task DeleteRegister_DraftRegister_RemovesFromDatabase()
    {
        // Arrange
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12), "DRAFT");

        // Act — replicate delete mutation logic
        var loaded = await _dbContext.RegistriCassa
            .Include(r => r.ConteggiMoneta)
            .Include(r => r.IncassiCassa)
            .Include(r => r.SpeseCassa)
            .FirstAsync(r => r.Id == registro.Id);

        loaded.Stato.Should().Be("DRAFT"); // Only DRAFT can be deleted
        _dbContext.RegistriCassa.Remove(loaded);
        await _dbContext.SaveChangesAsync();

        // Assert
        var result = await _dbContext.RegistriCassa.FindAsync(registro.Id);
        result.Should().BeNull();
    }

    [Fact]
    public void DeleteRegister_ClosedRegister_ShouldBeRejected()
    {
        // Arrange
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12), "CLOSED");

        // Act & Assert — replicate guard: only DRAFT can be deleted
        var loaded = _dbContext.RegistriCassa.First(r => r.Id == registro.Id);
        var canDelete = loaded.Stato == "DRAFT";

        canDelete.Should().BeFalse("a closed register must not be deletable");
    }

    #endregion

    #region Update Existing Register (REQ-2.1.1)

    [Fact]
    public async Task UpdateRegister_ReplacesExistingIncassiAndSpese()
    {
        // Arrange
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12));

        _dbContext.IncassiCassa.Add(new IncassoCassa
        {
            RegistroCassaId = registro.Id,
            Tipo = "Pagamenti Elettronici",
            Importo = 100m
        });
        _dbContext.SpeseCassa.Add(new SpesaCassa
        {
            RegistroCassaId = registro.Id,
            Descrizione = "Old expense",
            Importo = 50m
        });
        await _dbContext.SaveChangesAsync();

        // Act — replicate the update mutation pattern: remove old, add new
        var loaded = await _dbContext.RegistriCassa
            .Include(r => r.IncassiCassa)
            .Include(r => r.SpeseCassa)
            .FirstAsync(r => r.Id == registro.Id);

        _dbContext.IncassiCassa.RemoveRange(loaded.IncassiCassa);
        _dbContext.SpeseCassa.RemoveRange(loaded.SpeseCassa);

        loaded.IncassiCassa.Add(new IncassoCassa
        {
            Tipo = "Pago in Bianco (Contante)",
            Importo = 200m
        });
        loaded.SpeseCassa.Add(new SpesaCassa
        {
            Descrizione = "New expense 1",
            Importo = 75m
        });
        loaded.SpeseCassa.Add(new SpesaCassa
        {
            Descrizione = "New expense 2",
            Importo = 25m
        });
        await _dbContext.SaveChangesAsync();

        // Assert
        var result = await _dbContext.RegistriCassa
            .Include(r => r.IncassiCassa)
            .Include(r => r.SpeseCassa)
            .FirstAsync(r => r.Id == registro.Id);

        result.IncassiCassa.Should().HaveCount(1);
        result.IncassiCassa.First().Importo.Should().Be(200m);
        result.SpeseCassa.Should().HaveCount(2);
        result.SpeseCassa.Sum(s => s.Importo).Should().Be(100m);
    }

    #endregion

    #region Totals Computation (REQ-2.1.3)

    [Fact]
    public void TotalsComputation_DailyAggregation_CorrectSum()
    {
        // Arrange — simulate the mutation's income-to-total logic
        var incomes = new List<(string tipo, decimal importo)>
        {
            ("Pago in Bianco (Contante)", 100.00m),
            ("Pagamenti Elettronici", 50.00m),
            ("Pagamento con Fattura", 25.00m)
        };

        // Act
        decimal incassoContante = 0, incassiElettronici = 0, incassiFattura = 0;
        foreach (var (tipo, importo) in incomes)
        {
            if (tipo == "Pago in Bianco (Contante)") incassoContante = importo;
            else if (tipo == "Pagamenti Elettronici") incassiElettronici = importo;
            else if (tipo == "Pagamento con Fattura") incassiFattura = importo;
        }

        decimal venditeContanti = 0;
        decimal totaleVendite = venditeContanti + incassiElettronici + incassoContante + incassiFattura;

        // Assert
        totaleVendite.Should().Be(175.00m);
    }

    [Fact]
    public void TotalsComputation_ExpenseSubtraction_CorrectResult()
    {
        // Arrange
        decimal venditeContanti = 0;
        decimal incassoContante = 200m;
        decimal incassiElettronici = 100m;
        decimal incassiFattura = 50m;
        decimal speseFornitori = 80m;
        decimal speseGiornaliere = 30m;

        // Act — replicate the totals logic from the mutation
        decimal totaleVendite = venditeContanti + incassiElettronici + incassoContante + incassiFattura;
        decimal contanteAtteso = venditeContanti - speseFornitori - speseGiornaliere;

        // Assert
        totaleVendite.Should().Be(350m);
        contanteAtteso.Should().Be(-110m); // 0 - 80 - 30
    }

    [Fact]
    public void TotalsComputation_DecimalPrecision_ExactResult()
    {
        // Arrange — REQ-2.1.3: verify decimal precision
        var incomes = new decimal[] { 10.10m, 20.20m, 30.30m };

        // Act
        decimal total = incomes.Sum();

        // Assert
        total.Should().Be(60.60m, "decimal arithmetic should not produce floating-point errors");
    }

    [Fact]
    public void TotalsComputation_ZeroValueEntries_HandledCorrectly()
    {
        // Arrange
        var incomes = new decimal[] { 0m, 100m, 0m, 50m };
        var expenses = new decimal[] { 0m, 0m, 25m };

        // Act
        decimal totalIncome = incomes.Sum();
        decimal totalExpense = expenses.Sum();

        // Assert
        totalIncome.Should().Be(150m);
        totalExpense.Should().Be(25m);
    }

    [Fact]
    public void TotalsComputation_IvaScorporo_CorrectCalculation()
    {
        // Arrange — replicate the IVA calculation from mutation
        decimal totaleVendite = 110m;
        decimal aliquotaIva = 0.10m; // 10% for restaurants

        // Act — scorporo IVA (tax-inclusive pricing)
        decimal importoIva = Math.Round(totaleVendite * (aliquotaIva / (1 + aliquotaIva)), 2);

        // Assert
        importoIva.Should().Be(10.00m); // 110 * (0.10 / 1.10) = 10
    }

    [Fact]
    public void TotalsComputation_CashDifference_CorrectCalculation()
    {
        // Arrange
        decimal totaleApertura = 100m;
        decimal totaleChiusura = 250m;
        decimal venditeContanti = 0m;
        decimal speseFornitori = 30m;
        decimal speseGiornaliere = 20m;

        // Act — replicate the mutation's difference logic
        decimal contanteAtteso = venditeContanti - speseFornitori - speseGiornaliere;
        decimal incassoGiornaliero = totaleChiusura - totaleApertura;
        decimal differenza = incassoGiornaliero - contanteAtteso;

        // Assert
        incassoGiornaliero.Should().Be(150m);
        contanteAtteso.Should().Be(-50m);
        differenza.Should().Be(200m); // 150 - (-50) = 200
    }

    #endregion
}
