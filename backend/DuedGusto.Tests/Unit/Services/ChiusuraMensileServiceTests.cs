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
        decimal resto = 0)
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
            Resto = resto
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
        chiusura.SpeseTracciateRegistriCalcolate.Should().Be(0m);
        chiusura.SpeseGiornaliereRegistriCalcolate.Should().Be(0m);
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
    public async Task ComputedProperties_KpiPuri_NettoComeAggregazione()
    {
        // Arrange — chiusura = pura aggregazione (Decision 4): il netto deriva solo dai
        // registri inclusi. Tracciato = Σ SpeseFornitori, non tracciato = Σ SpeseGiornaliere.
        var utente = SeedUtente();
        SeedBusinessSettings();

        SeedRegistroCassa(utente, new DateTime(2026, 5, 4), "CLOSED",
            totaleVendite: 1000m, speseGiornaliere: 50m, speseFornitori: 200m);

        var chiusura = await _service.CreaChiusuraAsync(2026, 5);

        // Act — reload with relations
        var loaded = await _service.GetChiusuraConRelazioniAsync(chiusura.ChiusuraId);

        // Assert — nessuna spesa fuori-registro; ogni spesa contata una volta via registro
        loaded.Should().NotBeNull();
        loaded!.SpeseTracciateRegistriCalcolate.Should().Be(200m);   // Σ SpeseFornitori
        loaded.SpeseGiornaliereRegistriCalcolate.Should().Be(50m);   // Σ SpeseGiornaliere
        loaded.RicavoNettoCalcolato.Should().Be(750m);               // 1000 - 200 - 50
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

        SeedRegistroCassa(utente, new DateTime(2026, 6, 1), "CLOSED", totaleVendite: 500m, resto: 10m);
        SeedRegistroCassa(utente, new DateTime(2026, 6, 2), "CLOSED", totaleVendite: 300m, resto: -5m);

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

    // NOTE: la region "AggiungiSpesaLiberaAsync" è stata rimossa: le spese libere di chiusura
    // non esistono più (change spese-su-registro-giornaliero, Decision 4/5). Le spese ora si
    // registrano sul registro giornaliero (SpesaCassa / PagamentoFornitore) — vedi
    // AggiungiSpesaSuGiornoTests per la nuova mutation aggiungiSpesaSuGiorno.

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

    // NOTE: le region "Formula anti-doppio-conteggio", "Validazione Data nel mese" e
    // "AggiungiPagamentoFornitoreInChiusura" sono state rimosse: dopo il change
    // spese-su-registro-giornaliero non esistono più spese fuori-registro
    // (SpeseLibere/PagamentiInclusi), i KPI anti-doppio-conteggio PR #7
    // (SpeseAggiuntiveNonDuplicateCalcolate/TotaleSpeseCalcolato/DifferenzaCalcolata) né la
    // mutation aggiungiPagamentoFornitoreInChiusura. Ogni spesa è ora contata esattamente
    // una volta via il suo registro (Decision 4).

    #region Decision 8 — Differenza fantasma registro a sole spese

    [Fact]
    public async Task TotaleDifferenzeCassa_EscludeRegistriASoleSpese_MantieneDifferenzeReali()
    {
        // Arrange — un mese con:
        //  - R1: registro di vendita con differenza REALE (deve concorrere al totale)
        //  - R2: registro "leggero" a sole spese (TotaleVendite==0, Apertura==Chiusura):
        //        la sua "Differenza fantasma" NON deve inquinare il totale (Decision 8).
        var utente = SeedUtente();
        SeedBusinessSettings();

        // R1: vendite → Resto reale X = 10
        SeedRegistroCassa(utente, new DateTime(2026, 10, 5), "CLOSED",
            totaleVendite: 500m, resto: 10m);

        // R2: registro a sole spese. TotaleApertura == TotaleChiusura (entrambi 0),
        // nessuna vendita, ma Differenza "fantasma" Y = 30 (come da formula ContanteAtteso=−Importo).
        SeedRegistroCassa(utente, new DateTime(2026, 10, 6), "CLOSED",
            totaleVendite: 0m, speseGiornaliere: 30m, resto: 30m);

        // Act
        var chiusura = await _service.CreaChiusuraAsync(2026, 10);

        // Assert — totale = X (10), NON X+Y (40): la differenza fantasma di R2 è esclusa
        chiusura.TotaleDifferenzeCassaCalcolato.Should().Be(10m);
    }

    #endregion

    #region Guard completezza non bloccante — registri non inclusi

    [Fact]
    public async Task ChiudiMensile_RegistroChiusoDelMeseNonIncluso_ProduceWarningMaNonBlocca()
    {
        // Arrange — mese completo (giorni 1-27 coperti alla creazione), tutti i giorni operativi
        var utente = SeedUtente();
        SeedBusinessSettings("[true,true,true,true,true,true,true]");
        for (int day = 1; day <= 27; day++)
        {
            SeedRegistroCassa(utente, new DateTime(2026, 2, day), "CLOSED", totaleVendite: 500m);
        }

        var chiusura = await _service.CreaChiusuraAsync(2026, 2);

        // Registro CLOSED del mese (giorno 28) creato DOPO la chiusura → NON collegato ai
        // RegistriInclusi: dà origine al warning di completezza sopravvissuto (Decision 4).
        SeedRegistroCassa(utente, new DateTime(2026, 2, 28), "CLOSED", totaleVendite: 500m);

        // Act — la chiusura NON deve essere bloccata dal warning di completezza
        var result = await _service.ChiudiMensileAsync(chiusura.ChiusuraId, utente.Id);

        // Assert — chiusura avvenuta
        result.Should().BeTrue();
        var loaded = await _service.GetChiusuraConRelazioniAsync(chiusura.ChiusuraId);
        loaded!.Stato.Should().Be("CHIUSA");

        // Il warning di completezza è comunque prodotto (non bloccante): registro non incluso
        var warnings = await _service.ValidaCompletezzaChiusuraWarningsAsync(chiusura.ChiusuraId);
        warnings.Should().NotBeEmpty();
        warnings.Should().Contain(w => w.Contains("registro"));
    }

    #endregion
}
