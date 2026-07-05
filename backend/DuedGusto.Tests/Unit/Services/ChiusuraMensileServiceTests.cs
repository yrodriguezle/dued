using DuedGusto.Tests.Helpers;
using duedgusto.Services.ChiusureMensili;

namespace DuedGusto.Tests.Unit.Services;

/// <summary>
/// Tests for ChiusuraMensileService.
/// Covers REQ-2.2.1: Monthly closure calculation, aggregation, and validation.
/// </summary>
public class ChiusuraMensileServiceTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly ChiusuraMensileService _service;

    public ChiusuraMensileServiceTests()
    {
        _dbContext = TestDbContextFactory.Create();
        _service = new ChiusuraMensileService(_dbContext, new ChiusuraMensileValidator(_dbContext));
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

    private Utente SeedUtente(Ruolo? ruolo = null)
    {
        ruolo ??= SeedRuolo();
        var utente = JwtTestHelper.CreateTestUtente(id: 0);
        utente.RuoloId = ruolo.Id;
        _dbContext.Utenti.Add(utente);
        _dbContext.SaveChanges();
        return utente;
    }

    private BusinessSettings SeedBusinessSettings(string operatingDays = "[true,true,true,true,true,false,false]")
    {
        var settings = new BusinessSettings
        {
            BusinessName = "DuedGusto Test",
            OperatingDays = operatingDays,
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
        decimal incassiElettronici = 0,
        decimal incassoContante = 0,
        decimal incassiFattura = 0,
        decimal speseGiornaliere = 0,
        decimal speseFornitori = 0,
        decimal importoIva = 0,
        decimal differenza = 0)
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
            ImportoIva = importoIva,
            Differenza = differenza
        };
        _dbContext.RegistriCassa.Add(registro);
        _dbContext.SaveChanges();
        return registro;
    }

    #endregion

    #region CreaChiusuraAsync (REQ-2.2.1)

    [Fact]
    public async Task CreaChiusura_CompletMonth_AggregatesAllRegisters()
    {
        // Arrange — seed closed registers for February 2026
        var utente = SeedUtente();
        SeedBusinessSettings();

        // Seed a few closed registers in Feb 2026
        SeedRegistroCassa(utente, new DateTime(2026, 2, 2), "CLOSED", totaleVendite: 500m, incassoContante: 200m, incassiElettronici: 200m, incassiFattura: 100m, importoIva: 45.45m);
        SeedRegistroCassa(utente, new DateTime(2026, 2, 3), "CLOSED", totaleVendite: 300m, incassoContante: 100m, incassiElettronici: 150m, incassiFattura: 50m, importoIva: 27.27m);
        SeedRegistroCassa(utente, new DateTime(2026, 2, 4), "CLOSED", totaleVendite: 200m, incassoContante: 100m, incassiElettronici: 50m, incassiFattura: 50m, importoIva: 18.18m);

        // Act
        var chiusura = await _service.CreaChiusuraAsync(2026, 2);

        // Assert
        chiusura.Should().NotBeNull();
        chiusura.Anno.Should().Be(2026);
        chiusura.Mese.Should().Be(2);
        chiusura.Stato.Should().Be("BOZZA");
        chiusura.RegistriInclusi.Should().HaveCount(3);
        chiusura.RegistriInclusi.All(r => r.Incluso).Should().BeTrue();

        // Verify calculated properties
        chiusura.RicavoTotaleCalcolato.Should().Be(1000m); // 500 + 300 + 200
        chiusura.TotaleContantiCalcolato.Should().Be(400m); // 200 + 100 + 100
        chiusura.TotaleElettroniciCalcolato.Should().Be(400m); // 200 + 150 + 50
        chiusura.TotaleFattureCalcolato.Should().Be(200m); // 100 + 50 + 50
        chiusura.TotaleIvaCalcolato.Should().Be(90.90m); // 45.45 + 27.27 + 18.18
    }

    [Fact]
    public async Task CreaChiusura_EmptyMonth_ReturnsZeroValueClosure()
    {
        // Arrange — no registers for April 2026
        SeedBusinessSettings();
        SeedUtente(); // need at least a user for the test DB

        // Act
        var chiusura = await _service.CreaChiusuraAsync(2026, 4);

        // Assert
        chiusura.Should().NotBeNull();
        chiusura.Anno.Should().Be(2026);
        chiusura.Mese.Should().Be(4);
        chiusura.RegistriInclusi.Should().BeEmpty();
        chiusura.RicavoTotaleCalcolato.Should().Be(0m);
        chiusura.TotaleContantiCalcolato.Should().Be(0m);
        chiusura.TotaleElettroniciCalcolato.Should().Be(0m);
        chiusura.SpeseAggiuntiveCalcolate.Should().Be(0m);
    }

    [Fact]
    public async Task CreaChiusura_PartialMonth_IncludesOnlyClosedRegisters()
    {
        // Arrange — mix of DRAFT and CLOSED registers
        var utente = SeedUtente();
        SeedBusinessSettings();

        SeedRegistroCassa(utente, new DateTime(2026, 3, 2), "CLOSED", totaleVendite: 100m);
        SeedRegistroCassa(utente, new DateTime(2026, 3, 3), "DRAFT", totaleVendite: 200m);  // DRAFT — should be excluded
        SeedRegistroCassa(utente, new DateTime(2026, 3, 4), "CLOSED", totaleVendite: 300m);
        SeedRegistroCassa(utente, new DateTime(2026, 3, 5), "RECONCILED", totaleVendite: 150m); // RECONCILED — should be included

        // Act
        var chiusura = await _service.CreaChiusuraAsync(2026, 3);

        // Assert
        chiusura.RegistriInclusi.Should().HaveCount(3); // 2 CLOSED + 1 RECONCILED
        chiusura.RicavoTotaleCalcolato.Should().Be(550m); // 100 + 300 + 150
    }

    [Fact]
    public async Task CreaChiusura_DuplicateMonth_ThrowsInvalidOperationException()
    {
        // Arrange
        var utente = SeedUtente();
        SeedBusinessSettings();
        SeedRegistroCassa(utente, new DateTime(2026, 2, 2), "CLOSED", totaleVendite: 100m);

        await _service.CreaChiusuraAsync(2026, 2);

        // Act & Assert
        var act = () => _service.CreaChiusuraAsync(2026, 2);
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*già esistente*");
    }

    [Fact]
    public async Task CreaChiusura_InvalidMonth_ThrowsArgumentException()
    {
        // Act & Assert
        var actZero = () => _service.CreaChiusuraAsync(2026, 0);
        await actZero.Should().ThrowAsync<ArgumentException>();

        var actThirteen = () => _service.CreaChiusuraAsync(2026, 13);
        await actThirteen.Should().ThrowAsync<ArgumentException>();
    }

    #endregion

    #region Computed Properties (REQ-2.2.1)

    [Fact]
    public async Task ComputedProperties_SpeseAggiuntive_IncludesLiberePlusPagamenti()
    {
        // Arrange
        var utente = SeedUtente();
        SeedBusinessSettings();

        // speseGiornaliere > 0: il nuovo RicavoNettoCalcolato le sottrae
        SeedRegistroCassa(utente, new DateTime(2026, 5, 4), "CLOSED", totaleVendite: 1000m, speseGiornaliere: 50m);

        var chiusura = await _service.CreaChiusuraAsync(2026, 5);

        // Add free expense
        await _service.AggiungiSpesaLiberaAsync(chiusura.ChiusuraId, "Affitto", 500m, CategoriaSpesa.Affitto);

        // Add a PagamentoFornitore and link it
        var pagamento = new PagamentoFornitore
        {
            DataPagamento = new DateTime(2026, 5, 5),
            Importo = 200m,
            MetodoPagamento = "Contanti"
        };
        _dbContext.PagamentiFornitori.Add(pagamento);
        await _dbContext.SaveChangesAsync();

        await _service.IncludiPagamentoFornitoreAsync(chiusura.ChiusuraId, pagamento.PagamentoId);

        // Act — reload with relations
        var loaded = await _service.GetChiusuraConRelazioniAsync(chiusura.ChiusuraId);

        // Assert
        loaded.Should().NotBeNull();
        loaded!.SpeseLibere.Should().HaveCount(1);
        loaded.PagamentiInclusi.Should().HaveCount(1);
        loaded.SpeseAggiuntiveCalcolate.Should().Be(700m); // 500 + 200
        loaded.SpeseGiornaliereRegistriCalcolate.Should().Be(50m);
        loaded.RicavoNettoCalcolato.Should().Be(250m); // 1000 - 700 - 50
    }

    [Fact]
    public async Task ComputedProperties_SpeseGiornaliere_RegistroEsclusoNonContribuisce()
    {
        // Arrange — due registri con spese giornaliere, uno verrà escluso dalla chiusura
        var utente = SeedUtente();
        SeedBusinessSettings();

        SeedRegistroCassa(utente, new DateTime(2026, 9, 7), "CLOSED", totaleVendite: 600m, speseGiornaliere: 40m);
        var r2 = SeedRegistroCassa(utente, new DateTime(2026, 9, 8), "CLOSED", totaleVendite: 400m, speseGiornaliere: 60m);

        var chiusura = await _service.CreaChiusuraAsync(2026, 9);

        // Escludi R2 dalla chiusura (Incluso = false)
        var linkR2 = await _dbContext.RegistriCassaMensili
            .FirstAsync(l => l.ChiusuraId == chiusura.ChiusuraId && l.RegistroId == r2.Id);
        linkR2.Incluso = false;
        await _dbContext.SaveChangesAsync();

        // Act
        var loaded = await _service.GetChiusuraConRelazioniAsync(chiusura.ChiusuraId);

        // Assert — R2 non contribuisce né al ricavo né alle spese giornaliere
        loaded.Should().NotBeNull();
        loaded!.RicavoTotaleCalcolato.Should().Be(600m); // solo R1
        loaded.SpeseGiornaliereRegistriCalcolate.Should().Be(40m); // solo R1, i 60 di R2 esclusi
        loaded.RicavoNettoCalcolato.Should().Be(560m); // 600 - 0 - 40
    }

    [Fact]
    public async Task ComputedProperties_DifferenzeCassa_AggregatesFromRegisters()
    {
        // Arrange
        var utente = SeedUtente();
        SeedBusinessSettings();

        SeedRegistroCassa(utente, new DateTime(2026, 6, 1), "CLOSED", totaleVendite: 500m, differenza: 10m);
        SeedRegistroCassa(utente, new DateTime(2026, 6, 2), "CLOSED", totaleVendite: 300m, differenza: -5m);

        // Act
        var chiusura = await _service.CreaChiusuraAsync(2026, 6);

        // Assert
        chiusura.TotaleDifferenzeCassaCalcolato.Should().Be(5m); // 10 + (-5)
    }

    #endregion

    #region ChiudiMensileAsync (REQ-2.2.1)

    [Fact]
    public async Task ChiudiMensile_ValidBozza_TransitionsToChiusa()
    {
        // Arrange — create a month with all operating days covered
        var utente = SeedUtente();
        // All days are operating days for simplicity
        SeedBusinessSettings("[true,true,true,true,true,true,true]");

        // Seed a closed register for every day in Feb 2026 (28 days)
        for (int day = 1; day <= 28; day++)
        {
            SeedRegistroCassa(utente, new DateTime(2026, 2, day), "CLOSED", totaleVendite: 500m);
        }

        var chiusura = await _service.CreaChiusuraAsync(2026, 2);

        // Act
        var result = await _service.ChiudiMensileAsync(chiusura.ChiusuraId, utente.Id);

        // Assert
        result.Should().BeTrue();
        var loaded = await _service.GetChiusuraConRelazioniAsync(chiusura.ChiusuraId);
        loaded!.Stato.Should().Be("CHIUSA");
        loaded.ChiusaDa.Should().Be(utente.Id);
        loaded.ChiusaIl.Should().NotBeNull();
    }

    [Fact]
    public async Task ChiudiMensile_AlreadyChiusa_ThrowsInvalidOperationException()
    {
        // Arrange
        var utente = SeedUtente();
        SeedBusinessSettings("[true,true,true,true,true,true,true]");

        for (int day = 1; day <= 28; day++)
        {
            SeedRegistroCassa(utente, new DateTime(2026, 2, day), "CLOSED", totaleVendite: 500m);
        }

        var chiusura = await _service.CreaChiusuraAsync(2026, 2);
        await _service.ChiudiMensileAsync(chiusura.ChiusuraId);

        // Act & Assert
        var act = () => _service.ChiudiMensileAsync(chiusura.ChiusuraId);
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*deve essere 'BOZZA'*");
    }

    #endregion

    #region DataAppartieneAMeseChiusoAsync (REQ-2.2.1)

    [Fact]
    public async Task DataAppartieneAMeseChiuso_ClosedMonth_ReturnsTrue()
    {
        // Arrange — manually create a CHIUSA closure
        var chiusura = new ChiusuraMensile
        {
            Anno = 2026,
            Mese = 1,
            Stato = "CHIUSA"
        };
        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        // Act
        var result = await _service.DataAppartieneAMeseChiusoAsync(new DateTime(2026, 1, 15));

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task DataAppartieneAMeseChiuso_BozzaMonth_ReturnsFalse()
    {
        // Arrange
        var chiusura = new ChiusuraMensile
        {
            Anno = 2026,
            Mese = 1,
            Stato = "BOZZA"
        };
        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        // Act
        var result = await _service.DataAppartieneAMeseChiusoAsync(new DateTime(2026, 1, 15));

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task DataAppartieneAMeseChiuso_NoClosureExists_ReturnsFalse()
    {
        // Act
        var result = await _service.DataAppartieneAMeseChiusoAsync(new DateTime(2026, 3, 15));

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region AggiungiSpesaLiberaAsync (REQ-2.2.1)

    [Fact]
    public async Task AggiungiSpesaLibera_ValidData_PersistsExpense()
    {
        // Arrange
        SeedBusinessSettings();
        var chiusura = new ChiusuraMensile { Anno = 2026, Mese = 7, Stato = "BOZZA" };
        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        // Act
        var spesa = await _service.AggiungiSpesaLiberaAsync(
            chiusura.ChiusuraId, "Affitto locale", 1200m, CategoriaSpesa.Affitto);

        // Assert
        spesa.Should().NotBeNull();
        spesa.Descrizione.Should().Be("Affitto locale");
        spesa.Importo.Should().Be(1200m);
        spesa.Categoria.Should().Be(CategoriaSpesa.Affitto);
    }

    [Fact]
    public async Task AggiungiSpesaLibera_ChiusuraChiusa_ThrowsInvalidOperationException()
    {
        // Arrange
        var chiusura = new ChiusuraMensile { Anno = 2026, Mese = 7, Stato = "CHIUSA" };
        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        // Act & Assert
        var act = () => _service.AggiungiSpesaLiberaAsync(
            chiusura.ChiusuraId, "Affitto", 1200m, CategoriaSpesa.Affitto);
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*stato*BOZZA*");
    }

    [Fact]
    public async Task AggiungiSpesaLibera_ZeroImporto_ThrowsArgumentException()
    {
        // Arrange
        var chiusura = new ChiusuraMensile { Anno = 2026, Mese = 7, Stato = "BOZZA" };
        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        // Act & Assert
        var act = () => _service.AggiungiSpesaLiberaAsync(
            chiusura.ChiusuraId, "Spesa", 0m, CategoriaSpesa.Altro);
        await act.Should().ThrowAsync<ArgumentException>();
    }

    #endregion

    #region ValidaCompletezzaRegistriAsync (REQ-2.2.1)

    [Fact]
    public async Task ValidaCompletezza_AllDaysCovered_ReturnsEmptyList()
    {
        // Arrange — all 7 days operating, all days in Feb have a register
        var utente = SeedUtente();
        SeedBusinessSettings("[true,true,true,true,true,true,true]");

        for (int day = 1; day <= 28; day++)
        {
            SeedRegistroCassa(utente, new DateTime(2026, 2, day), "CLOSED");
        }

        // Act
        var missing = await _service.ValidaCompletezzaRegistriAsync(2026, 2);

        // Assert
        missing.Should().BeEmpty();
    }

    [Fact]
    public async Task ValidaCompletezza_MissingDays_ReturnsMissingDates()
    {
        // Arrange — all 7 days operating, only some days covered
        var utente = SeedUtente();
        SeedBusinessSettings("[true,true,true,true,true,true,true]");

        SeedRegistroCassa(utente, new DateTime(2026, 2, 1), "CLOSED");
        SeedRegistroCassa(utente, new DateTime(2026, 2, 3), "CLOSED");
        // Day 2 is missing

        // Act
        var missing = await _service.ValidaCompletezzaRegistriAsync(2026, 2);

        // Assert — should list all operating days without a CLOSED register
        missing.Should().Contain(new DateTime(2026, 2, 2));
        missing.Count.Should().BeGreaterThanOrEqualTo(25); // 28 total - 2 covered = 26 missing, plus day 2
    }

    [Fact]
    public async Task ValidaCompletezza_SkipsNonOperatingDays()
    {
        // Arrange — Mon-Fri operating, Sat-Sun closed
        var utente = SeedUtente();
        SeedBusinessSettings("[true,true,true,true,true,false,false]");

        // Feb 2026: 1=Sun (non-op), 2=Mon (op), 3=Tue (op), ...
        // Seed only Monday Feb 2
        SeedRegistroCassa(utente, new DateTime(2026, 2, 2), "CLOSED");

        // Act
        var missing = await _service.ValidaCompletezzaRegistriAsync(2026, 2);

        // Assert — Saturdays (7,14,21,28) and Sundays (1,8,15,22) should NOT appear
        missing.Should().NotContain(new DateTime(2026, 2, 1));  // Sunday
        missing.Should().NotContain(new DateTime(2026, 2, 7));  // Saturday
        missing.Should().NotContain(new DateTime(2026, 2, 8));  // Sunday
        missing.Should().Contain(new DateTime(2026, 2, 3));     // Tuesday — missing
    }

    #endregion

    #region Formula anti-doppio-conteggio (Issue #3)

    [Fact]
    public async Task ComputedProperties_TotaleSpese_NonDuplicaPagamentiDeiRegistriInclusi()
    {
        // Arrange — un registro incluso con SpeseFornitori (che GIA' contengono il pagamento P1
        // linkato al registro) + un pagamento origine-chiusura P2 (RegistroCassaId = null).
        var utente = SeedUtente();
        SeedBusinessSettings();

        var r1 = SeedRegistroCassa(utente, new DateTime(2026, 5, 4), "CLOSED",
            totaleVendite: 1000m, speseGiornaliere: 50m, speseFornitori: 150m);

        var chiusura = new ChiusuraMensile { Anno = 2026, Mese = 5, Stato = "BOZZA" };
        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        _dbContext.RegistriCassaMensili.Add(new RegistroCassaMensile
        {
            ChiusuraId = chiusura.ChiusuraId,
            RegistroId = r1.Id,
            Incluso = true
        });

        // P1: appartiene a R1 (RegistroCassaId = r1.Id) → già conteggiato in R1.SpeseFornitori
        var p1 = new PagamentoFornitore { DataPagamento = new DateTime(2026, 5, 5), Importo = 150m, RegistroCassaId = r1.Id };
        // P2: origine-chiusura (RegistroCassaId = null) → spesa aggiuntiva reale
        var p2 = new PagamentoFornitore { DataPagamento = new DateTime(2026, 5, 6), Importo = 80m, RegistroCassaId = null };
        _dbContext.PagamentiFornitori.AddRange(p1, p2);
        await _dbContext.SaveChangesAsync();

        _dbContext.PagamentiMensiliFornitori.AddRange(
            new PagamentoMensileFornitori { ChiusuraId = chiusura.ChiusuraId, PagamentoId = p1.PagamentoId, InclusoInChiusura = true },
            new PagamentoMensileFornitori { ChiusuraId = chiusura.ChiusuraId, PagamentoId = p2.PagamentoId, InclusoInChiusura = true });
        await _dbContext.SaveChangesAsync();

        // Act
        var loaded = await _service.GetChiusuraConRelazioniAsync(chiusura.ChiusuraId);

        // Assert
        loaded.Should().NotBeNull();
        // Solo P2 conta come spesa aggiuntiva non duplicata; P1 è già in R1.SpeseFornitori
        loaded!.SpeseAggiuntiveNonDuplicateCalcolate.Should().Be(80m);
        // TotaleSpese = (150 fornitori + 50 giornaliere) dei registri inclusi + 80 non duplicati
        loaded.TotaleSpeseCalcolato.Should().Be(280m);
        // Differenza = 1000 - 280
        loaded.DifferenzaCalcolata.Should().Be(720m);
    }

    [Fact]
    public async Task ComputedProperties_TotaleSpese_PagamentoDiRegistroEsclusoTornaSpesaAggiuntiva()
    {
        // Arrange — un pagamento con RegistroCassaId che punta a un registro NON incluso nella
        // chiusura: non essendo nel totale spese di alcun registro incluso, va conteggiato.
        var utente = SeedUtente();
        SeedBusinessSettings();

        var rEscluso = SeedRegistroCassa(utente, new DateTime(2026, 5, 7), "CLOSED", totaleVendite: 0m, speseFornitori: 90m);

        var chiusura = new ChiusuraMensile { Anno = 2026, Mese = 5, Stato = "BOZZA" };
        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        // Registro collegato ma ESCLUSO (Incluso = false) → le sue spese NON entrano nei registri
        _dbContext.RegistriCassaMensili.Add(new RegistroCassaMensile
        {
            ChiusuraId = chiusura.ChiusuraId,
            RegistroId = rEscluso.Id,
            Incluso = false
        });

        var p = new PagamentoFornitore { DataPagamento = new DateTime(2026, 5, 8), Importo = 90m, RegistroCassaId = rEscluso.Id };
        _dbContext.PagamentiFornitori.Add(p);
        await _dbContext.SaveChangesAsync();

        _dbContext.PagamentiMensiliFornitori.Add(new PagamentoMensileFornitori
        {
            ChiusuraId = chiusura.ChiusuraId,
            PagamentoId = p.PagamentoId,
            InclusoInChiusura = true
        });
        await _dbContext.SaveChangesAsync();

        // Act
        var loaded = await _service.GetChiusuraConRelazioniAsync(chiusura.ChiusuraId);

        // Assert — il pagamento del registro escluso è una spesa aggiuntiva a tutti gli effetti
        loaded!.SpeseAggiuntiveNonDuplicateCalcolate.Should().Be(90m);
        loaded.TotaleSpeseCalcolato.Should().Be(90m); // nessun registro incluso, solo il pagamento
    }

    #endregion

    #region Validazione Data nel mese (Issue #3)

    [Fact]
    public async Task AggiungiSpesaLibera_DataFuoriMese_ThrowsInvalidOperationException()
    {
        // Arrange
        SeedBusinessSettings();
        var chiusura = new ChiusuraMensile { Anno = 2026, Mese = 7, Stato = "BOZZA" };
        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        // Act & Assert — data ad agosto, fuori dal mese 7
        var act = () => _service.AggiungiSpesaLiberaAsync(
            chiusura.ChiusuraId, "Affitto", 100m, CategoriaSpesa.Affitto, new DateTime(2026, 8, 1));
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*non appartiene al mese*");
    }

    [Fact]
    public async Task AggiungiSpesaLibera_DataNelMese_PersisteData()
    {
        // Arrange
        SeedBusinessSettings();
        var chiusura = new ChiusuraMensile { Anno = 2026, Mese = 7, Stato = "BOZZA" };
        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        // Act
        var spesa = await _service.AggiungiSpesaLiberaAsync(
            chiusura.ChiusuraId, "Affitto", 100m, CategoriaSpesa.Affitto, new DateTime(2026, 7, 15));

        // Assert
        spesa.Data.Should().Be(new DateTime(2026, 7, 15));
    }

    #endregion

    #region AggiungiPagamentoFornitoreInChiusura (Issue #3)

    [Fact]
    public async Task AggiungiPagamentoInChiusura_ValidDdt_CreaPagamentoOrigineChiusuraEJoin()
    {
        // Arrange
        SeedBusinessSettings();
        var fornitore = new Fornitore { RagioneSociale = "Fornitore Test", AliquotaIva = 22m };
        _dbContext.Fornitori.Add(fornitore);
        var chiusura = new ChiusuraMensile { Anno = 2026, Mese = 5, Stato = "BOZZA" };
        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        var dati = new ChiusuraMensileService.DatiPagamentoChiusura(
            FornitoreId: fornitore.FornitoreId,
            TipoDocumento: "DDT",
            NumeroDocumento: "DDT-001",
            DataPagamento: new DateTime(2026, 5, 10),
            Importo: 120m,
            AliquotaIva: null,
            MetodoPagamento: "Contanti",
            FatturaIdCollegata: null,
            DdtIdCollegato: null);

        // Act
        var pagamento = await _service.AggiungiPagamentoFornitoreInChiusuraAsync(chiusura.ChiusuraId, dati);

        // Assert — pagamento di origine-chiusura con documento DDT reale
        pagamento.Should().NotBeNull();
        pagamento.RegistroCassaId.Should().BeNull();
        pagamento.DdtId.Should().NotBeNull();
        pagamento.FatturaId.Should().BeNull();
        pagamento.Importo.Should().Be(120m);

        // Join con la chiusura, InclusoInChiusura = true
        var link = await _dbContext.PagamentiMensiliFornitori
            .FirstOrDefaultAsync(pm => pm.PagamentoId == pagamento.PagamentoId);
        link.Should().NotBeNull();
        link!.ChiusuraId.Should().Be(chiusura.ChiusuraId);
        link.InclusoInChiusura.Should().BeTrue();
    }

    [Fact]
    public async Task AggiungiPagamentoInChiusura_ChiusuraChiusa_ThrowsInvalidOperationException()
    {
        // Arrange
        SeedBusinessSettings();
        var chiusura = new ChiusuraMensile { Anno = 2026, Mese = 5, Stato = "CHIUSA" };
        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        var dati = new ChiusuraMensileService.DatiPagamentoChiusura(
            FornitoreId: 1, TipoDocumento: "DDT", NumeroDocumento: "DDT-1",
            DataPagamento: new DateTime(2026, 5, 10), Importo: 50m,
            AliquotaIva: null, MetodoPagamento: null, FatturaIdCollegata: null, DdtIdCollegato: null);

        // Act & Assert
        var act = () => _service.AggiungiPagamentoFornitoreInChiusuraAsync(chiusura.ChiusuraId, dati);
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*BOZZA*");
    }

    [Fact]
    public async Task AggiungiPagamentoInChiusura_DataFuoriMese_ThrowsInvalidOperationException()
    {
        // Arrange
        SeedBusinessSettings();
        var chiusura = new ChiusuraMensile { Anno = 2026, Mese = 5, Stato = "BOZZA" };
        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        var dati = new ChiusuraMensileService.DatiPagamentoChiusura(
            FornitoreId: 1, TipoDocumento: "DDT", NumeroDocumento: "DDT-1",
            DataPagamento: new DateTime(2026, 6, 10), Importo: 50m, // giugno, fuori dal mese 5
            AliquotaIva: null, MetodoPagamento: null, FatturaIdCollegata: null, DdtIdCollegato: null);

        // Act & Assert
        var act = () => _service.AggiungiPagamentoFornitoreInChiusuraAsync(chiusura.ChiusuraId, dati);
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*non appartiene al mese*");
    }

    #endregion

    #region Guard completezza non bloccante (Issue #3)

    [Fact]
    public async Task ChiudiMensile_PagamentoDelMeseNonIncluso_ProduceWarningMaNonBlocca()
    {
        // Arrange — mese completo (nessun giorno mancante), tutti i giorni operativi
        var utente = SeedUtente();
        SeedBusinessSettings("[true,true,true,true,true,true,true]");
        for (int day = 1; day <= 28; day++)
        {
            SeedRegistroCassa(utente, new DateTime(2026, 2, day), "CLOSED", totaleVendite: 500m);
        }

        var chiusura = await _service.CreaChiusuraAsync(2026, 2);

        // Pagamento del mese aggiunto DOPO la creazione → non collegato alla chiusura
        var pagamento = new PagamentoFornitore { DataPagamento = new DateTime(2026, 2, 15), Importo = 100m, RegistroCassaId = null };
        _dbContext.PagamentiFornitori.Add(pagamento);
        await _dbContext.SaveChangesAsync();

        // Act — la chiusura NON deve essere bloccata dal warning di completezza
        var result = await _service.ChiudiMensileAsync(chiusura.ChiusuraId, utente.Id);

        // Assert — chiusura avvenuta
        result.Should().BeTrue();
        var loaded = await _service.GetChiusuraConRelazioniAsync(chiusura.ChiusuraId);
        loaded!.Stato.Should().Be("CHIUSA");

        // Il warning di completezza è comunque prodotto (non bloccante)
        var warnings = await _service.ValidaCompletezzaChiusuraWarningsAsync(chiusura.ChiusuraId);
        warnings.Should().NotBeEmpty();
        warnings.Should().Contain(w => w.Contains("pagamento"));
    }

    #endregion
}
