using DuedGusto.Tests.Helpers;
using Microsoft.Extensions.Logging;
using duedgusto.Common;
using duedgusto.GraphQL.GestioneCassa;

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
        decimal incassiFattura = 0,
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
            TotaleApertura = totaleApertura,
            TotaleChiusura = totaleChiusura
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
            UpdatedAt = DateTime.UtcNow
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
            Stato = "DRAFT",
            IncassoContanteTracciato = 100m,
            IncassiElettronici = 50m
        };
        _dbContext.RegistriCassa.Add(registro);
        await _dbContext.SaveChangesAsync();

        registro.SpeseCassa.Add(new SpesaCassa
        {
            RegistroCassaId = registro.Id,
            Descrizione = "Caffè",
            Importo = 30m
        });
        await _dbContext.SaveChangesAsync();

        // Assert
        var loaded = await _dbContext.RegistriCassa
            .Include(r => r.SpeseCassa)
            .FirstAsync(r => r.Id == registro.Id);

        loaded.IncassoContanteTracciato.Should().Be(100m);
        loaded.IncassiElettronici.Should().Be(50m);
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
        loaded.UpdatedAt = DateTime.UtcNow;
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
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12),
            incassiElettronici: 100m);

        _dbContext.SpeseCassa.Add(new SpesaCassa
        {
            RegistroCassaId = registro.Id,
            Descrizione = "Old expense",
            Importo = 50m
        });
        await _dbContext.SaveChangesAsync();

        // Act — replicate the update mutation pattern: update flat fields, remove old spese, add new
        var loaded = await _dbContext.RegistriCassa
            .Include(r => r.SpeseCassa)
            .FirstAsync(r => r.Id == registro.Id);

        _dbContext.SpeseCassa.RemoveRange(loaded.SpeseCassa);

        loaded.IncassoContanteTracciato = 200m;
        loaded.IncassiElettronici = 0m;
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
            .Include(r => r.SpeseCassa)
            .FirstAsync(r => r.Id == registro.Id);

        result.IncassoContanteTracciato.Should().Be(200m);
        result.IncassiElettronici.Should().Be(0m);
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

    /// <summary>
    /// Le spese incidono su due colonne DIVERSE del foglio: i pagamenti fornitori abbassano
    /// RestoFornitore (AD), le spese con scontrino abbassano Resto (AG). Nessuna delle due
    /// tocca l'altra.
    /// </summary>
    [Fact]
    public void CalcolaTotali_SpeseFornitoriEScontrino_ColpisconoColonneDiverse()
    {
        var registro = new RegistroCassa
        {
            TotaleApertura = 0m,
            TotaleChiusura = 250m,
            IncassoContanteTracciato = 200m,
            SpeseFornitori = 80m,
        };

        MutateRegistroCassaOrchestrator.CalcolaTotali(registro, totaleSpese: 30m);

        registro.ContanteNetto.Should().Be(250m);        // Y  = 250 − 0
        registro.RestoFornitore.Should().Be(120m);       // AD = 200 − 80
        registro.Ecc.Should().Be(50m);                   // AE = 250 − 200
        registro.Resto.Should().Be(20m);                 // AG = 50 − 30
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

    #region Breakdown IVA del registro (iva-multialiquota-fase3)

    private Vendita SeedVendita(RegistroCassa registro, Prodotto prodotto, decimal quantita)
    {
        // ⚠️ Costruita a mano: con gli ordini le Vendita nascono solo dentro
        //    ChiudiOrdineOrchestrator, e la factory CostruisciVendita è sparita insieme a
        //    creaVendita. Lo scorporo IVA resta quello di produzione.
        var vendita = new Vendita
        {
            RegistroCassaId = registro.Id,
            ProdottoId = prodotto.ProdottoId,
            Quantita = quantita,
            PrezzoUnitario = prodotto.Prezzo,
            PrezzoTotale = quantita * prodotto.Prezzo,
            AliquotaIva = prodotto.AliquotaIva,
            DataOra = DateTime.UtcNow,
            MetodoPagamento = duedgusto.Common.MetodiPagamentoVendita.ContanteNonTracciato,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        duedgusto.GraphQL.Vendite.VenditeMutations.RicalcolaImportiSnapshot(vendita);
        _dbContext.Vendite.Add(vendita);
        _dbContext.SaveChanges();
        return vendita;
    }

    private Prodotto SeedProdotto(string codice, decimal prezzo, decimal aliquotaIva)
    {
        var prodotto = new Prodotto
        {
            Codice = codice,
            Nome = $"Prodotto {codice}",
            Prezzo = prezzo,
            AliquotaIva = aliquotaIva,
            Attivo = true
        };
        _dbContext.Prodotti.Add(prodotto);
        _dbContext.SaveChanges();
        return prodotto;
    }

    [Fact]
    public async Task BreakdownIva_RegistroSenzaVendite_ImportoIvaIdenticoAlCalcoloLegacy()
    {
        // Scenario spec "Equivalenza con il calcolo pre-change": 123.45 al 10%
        SeedBusinessSettings(vatRate: 0.10m);
        var utente = SeedUtente();
        // Base IVA debito = movimento fisico (chiusura - apertura) + elettronico + fattura
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12), totaleChiusura: 123.45m);

        await BreakdownIvaApplier.ApplicaAsync(_dbContext, registro, 0.10m, Mock.Of<ILogger>());
        await _dbContext.SaveChangesAsync();

        // ImportoIva identico al centesimo al calcolo single-rate pre-change
        registro.VenditeContanti.Should().Be(0m);
        registro.TotaleVendite.Should().Be(123.45m);
        registro.ImportoIva.Should().Be(IvaCalculator.ScorporaDaLordo(123.45m, 0.10m).Iva);

        // Riga unica stimata che replica l'aggregato
        var righe = await _dbContext.RegistriCassaIva
            .Where(r => r.RegistroCassaId == registro.Id).ToListAsync();
        righe.Should().ContainSingle();
        righe[0].Stimato.Should().BeTrue();
        righe[0].Aliquota.Should().Be(10.00m);
        righe[0].Imposta.Should().Be(registro.ImportoIva);
        (righe[0].Imponibile + righe[0].Imposta).Should().Be(registro.TotaleVendite);
    }

    [Fact]
    public async Task BreakdownIva_VenditeMultialiquota_RigheEsatteEResiduoStimato()
    {
        // Scenario spec "Registro con vendite ad aliquote miste" + normalizzazione VenditeContanti
        SeedBusinessSettings(vatRate: 0.22m);
        var utente = SeedUtente();
        // Movimento fisico 58.60 (= Σ vendite itemizzate) + elettronico 41.40 = TotaleVendite 100
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12), incassiElettronici: 41.40m, totaleChiusura: 58.60m);
        var prodotto22 = SeedProdotto("P22", 36.60m, 22m);
        var prodotto10 = SeedProdotto("P10", 22.00m, 10m);
        SeedVendita(registro, prodotto22, 1);
        SeedVendita(registro, prodotto10, 1);

        await BreakdownIvaApplier.ApplicaAsync(_dbContext, registro, 0.22m, Mock.Of<ILogger>());
        await _dbContext.SaveChangesAsync();

        // VenditeContanti = Σ lordi (non più azzerato), TotaleVendite coerente
        registro.VenditeContanti.Should().Be(58.60m);
        registro.TotaleVendite.Should().Be(100.00m);

        var righe = await _dbContext.RegistriCassaIva
            .Where(r => r.RegistroCassaId == registro.Id)
            .OrderByDescending(r => r.Aliquota).ThenBy(r => r.Stimato)
            .ToListAsync();
        righe.Should().HaveCount(3);

        var riga22 = righe.Single(r => r.Aliquota == 22.00m && !r.Stimato);
        riga22.Imponibile.Should().Be(30.00m);
        riga22.Imposta.Should().Be(6.60m);

        var riga10 = righe.Single(r => r.Aliquota == 10.00m && !r.Stimato);
        riga10.Imponibile.Should().Be(20.00m);
        riga10.Imposta.Should().Be(2.00m);

        // Residuo 41.40 stimato all'aliquota di default
        var rigaStimata = righe.Single(r => r.Stimato);
        rigaStimata.Aliquota.Should().Be(22.00m);
        (rigaStimata.Imponibile + rigaStimata.Imposta).Should().Be(41.40m);

        // ImportoIva = Σ Imposta; Σ (imponibile + imposta) == TotaleVendite
        registro.ImportoIva.Should().Be(righe.Sum(r => r.Imposta));
        righe.Sum(r => r.Imponibile + r.Imposta).Should().Be(100.00m);
    }

    [Fact]
    public async Task BreakdownIva_Risalvataggio_RigenerazioneIdempotente()
    {
        // Scenario spec "Risalvataggio idempotente": stesse N righe, nessun duplicato
        SeedBusinessSettings(vatRate: 0.22m);
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12), incassiElettronici: 41.40m);
        var prodotto22 = SeedProdotto("P22", 36.60m, 22m);
        SeedVendita(registro, prodotto22, 1);

        await BreakdownIvaApplier.ApplicaAsync(_dbContext, registro, 0.22m, Mock.Of<ILogger>());
        await _dbContext.SaveChangesAsync();
        var primaEsecuzione = await _dbContext.RegistriCassaIva
            .Where(r => r.RegistroCassaId == registro.Id)
            .Select(r => new { r.Aliquota, r.Imponibile, r.Imposta, r.Stimato })
            .OrderByDescending(r => r.Aliquota).ThenBy(r => r.Stimato)
            .ToListAsync();

        await BreakdownIvaApplier.ApplicaAsync(_dbContext, registro, 0.22m, Mock.Of<ILogger>());
        await _dbContext.SaveChangesAsync();
        var secondaEsecuzione = await _dbContext.RegistriCassaIva
            .Where(r => r.RegistroCassaId == registro.Id)
            .Select(r => new { r.Aliquota, r.Imponibile, r.Imposta, r.Stimato })
            .OrderByDescending(r => r.Aliquota).ThenBy(r => r.Stimato)
            .ToListAsync();

        secondaEsecuzione.Should().Equal(primaEsecuzione);

        // Nessun duplicato per coppia (aliquota, stimato)
        secondaEsecuzione.GroupBy(r => new { r.Aliquota, r.Stimato })
            .Should().OnlyContain(g => g.Count() == 1);
    }

    [Fact]
    public async Task BreakdownIva_ResiduoNegativo_ClampConWarningESalvataggioOk()
    {
        // Scenario spec "Residuo negativo da dati storici incoerenti":
        // canale dichiarato negativo → TotaleVendite < Σ vendite
        SeedBusinessSettings(vatRate: 0.22m);
        var utente = SeedUtente();
        // Movimento fisico 60 + elettronico -10 = TotaleVendite 50 < Σ vendite 60 -> residuo negativo
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12), incassiElettronici: -10.00m, totaleChiusura: 60.00m);
        var prodotto22 = SeedProdotto("P22", 60.00m, 22m);
        var vendita = SeedVendita(registro, prodotto22, 1);

        var loggerMock = new Mock<ILogger>();
        loggerMock.Setup(l => l.IsEnabled(LogLevel.Warning)).Returns(true);

        EsitoBreakdownIva esito = await BreakdownIvaApplier.ApplicaAsync(
            _dbContext, registro, 0.22m, loggerMock.Object);
        await _dbContext.SaveChangesAsync(); // il salvataggio NON deve mai essere bloccato

        esito.ResiduoClampato.Should().BeTrue();
        esito.ResiduoOriginale.Should().Be(-10.00m);

        // Nessuna riga stimata; ImportoIva = Σ imposte esatte
        var righe = await _dbContext.RegistriCassaIva
            .Where(r => r.RegistroCassaId == registro.Id).ToListAsync();
        righe.Should().ContainSingle(r => !r.Stimato);
        registro.ImportoIva.Should().Be(vendita.ImportoIva);

        // Warning loggato con gli importi coinvolti
        loggerMock.Verify(l => l.Log(
            LogLevel.Warning,
            It.IsAny<EventId>(),
            It.Is<It.IsAnyType>((v, t) => true),
            It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.Once);
    }

    #endregion

    /// <summary>
    /// La quadratura NON dipende da <c>VenditeContanti</c> (somma delle Vendite persistite):
    /// il primo termine è il contante dichiarato. Pinna la correzione della formula divergente
    /// che stava in <c>RegistroCassaSyncService</c>.
    /// </summary>
    [Fact]
    public void CalcolaTotali_IgnoraVenditeContanti_UsaIlContanteDichiarato()
    {
        var registro = new RegistroCassa
        {
            TotaleApertura = 100m,
            TotaleChiusura = 250m,
            IncassoContanteTracciato = 120m,
            VenditeContanti = 999m,     // deve restare ininfluente
            SpeseFornitori = 30m,
        };

        MutateRegistroCassaOrchestrator.CalcolaTotali(registro, totaleSpese: 20m);

        registro.ContanteNetto.Should().Be(150m);        // Y  = 250 − 100
        registro.RestoFornitore.Should().Be(90m);        // AD = 120 − 30
        registro.Ecc.Should().Be(30m);                   // AE = 150 − 120
        registro.Resto.Should().Be(10m);                 // AG = 30 − 20
    }

    #endregion
}
