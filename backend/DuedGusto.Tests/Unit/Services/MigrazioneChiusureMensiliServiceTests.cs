using DuedGusto.Tests.Helpers;
using duedgusto.Services.ChiusureMensili;

namespace DuedGusto.Tests.Unit.Services;

/// <summary>
/// Tests for MigrazioneChiusureMensiliService.
/// The migration service has been deprecated — the old denormalized model has been removed.
/// We test the remaining behavior: the stub MigraDatiAsync and the report generator.
/// Covers REQ-2.2.3 (adapted: migration is no longer available).
/// </summary>
public class MigrazioneChiusureMensiliServiceTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly MigrazioneChiusureMensiliService _service;

    public MigrazioneChiusureMensiliServiceTests()
    {
        _dbContext = TestDbContextFactory.Create();
        _service = new MigrazioneChiusureMensiliService(_dbContext);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    #region MigraDatiAsync (REQ-2.2.3)

    [Fact]
    public async Task MigraDati_ReturnsDeprecationResult()
    {
        // Act
        var result = await _service.MigraDatiAsync();

        // Assert
        result.Should().NotBeNull();
        result.ErroreGlobale.Should().NotBeNullOrEmpty();
        result.ErroreGlobale.Should().Contain("non più disponibile");
        result.Successo.Should().BeFalse();
    }

    [Fact]
    public async Task MigraDati_IsIdempotent_ReturnsSameResultOnMultipleCalls()
    {
        // Act
        var result1 = await _service.MigraDatiAsync();
        var result2 = await _service.MigraDatiAsync();

        // Assert
        result1.ErroreGlobale.Should().Be(result2.ErroreGlobale);
        result1.Successo.Should().Be(result2.Successo);
        result1.TotaleChiusureDaMigrare.Should().Be(result2.TotaleChiusureDaMigrare);
    }

    [Fact]
    public async Task MigraDati_HasZeroDuration()
    {
        // Act
        var result = await _service.MigraDatiAsync();

        // Assert — since the migration is a no-op, duration should be zero
        result.DurataTotale.Should().Be(TimeSpan.Zero);
        result.TotaleChiusureDaMigrare.Should().Be(0);
        result.ChiusureMigrateConSuccesso.Should().Be(0);
    }

    #endregion

    #region GeneraReportMigrazione (REQ-2.2.3)

    [Fact]
    public async Task GeneraReport_DeprecatedMigration_ContainsErrorMessage()
    {
        // Arrange
        var result = await _service.MigraDatiAsync();

        // Act
        var report = _service.GeneraReportMigrazione(result);

        // Assert
        report.Should().NotBeNullOrEmpty();
        report.Should().Contain("REPORT MIGRAZIONE CHIUSURE MENSILI");
        report.Should().Contain("ERRORE GLOBALE");
        report.Should().Contain("non più disponibile");
    }

    [Fact]
    public void GeneraReport_SuccessfulResult_ContainsStatistics()
    {
        // Arrange — simulate a successful migration result
        var result = new MigrazioneResult
        {
            DataInizio = new DateTime(2026, 3, 1, 10, 0, 0),
            DataFine = new DateTime(2026, 3, 1, 10, 0, 5),
            DurataTotale = TimeSpan.FromSeconds(5),
            TotaleChiusureDaMigrare = 3,
            ChiusureMigrateConSuccesso = 3,
            RegistriCassaAssociati = 60,
            SpeseLibereMigrate = 9,
            PagamentiFornitoriMigrati = 12
        };

        // Act
        var report = _service.GeneraReportMigrazione(result);

        // Assert
        report.Should().Contain("Totale chiusure da migrare: 3");
        report.Should().Contain("Chiusure migrate con successo: 3");
        report.Should().Contain("Registri cassa associati: 60");
        report.Should().Contain("Spese libere migrate: 9");
        report.Should().Contain("Pagamenti fornitori migrati: 12");
        report.Should().NotContain("ERRORE GLOBALE");
    }

    [Fact]
    public void GeneraReport_ResultWithErrors_IncludesErrorDetails()
    {
        // Arrange
        var result = new MigrazioneResult
        {
            DataInizio = DateTime.UtcNow,
            DataFine = DateTime.UtcNow,
            DurataTotale = TimeSpan.FromSeconds(1),
            TotaleChiusureDaMigrare = 2,
            ChiusureMigrateConSuccesso = 1,
            ErroriTotali = 2,
            ChiusureConErrori = new Dictionary<int, List<string>>
            {
                { 5, new List<string> { "Errore spesa: importo negativo", "Errore pagamento: fornitore non trovato" } }
            }
        };

        // Act
        var report = _service.GeneraReportMigrazione(result);

        // Assert
        report.Should().Contain("Chiusure con errori: 1");
        report.Should().Contain("Errori totali rilevati: 2");
        report.Should().Contain("DETTAGLIO ERRORI PER CHIUSURA");
        report.Should().Contain("Chiusura ID 5");
        report.Should().Contain("Errore spesa: importo negativo");
        report.Should().Contain("Errore pagamento: fornitore non trovato");
    }

    #endregion

    #region MigrazioneResult Model (REQ-2.2.3)

    [Fact]
    public void MigrazioneResult_Successo_TrueWhenNoErrors()
    {
        var result = new MigrazioneResult();
        result.Successo.Should().BeTrue();
    }

    [Fact]
    public void MigrazioneResult_Successo_FalseWhenGlobalError()
    {
        var result = new MigrazioneResult { ErroreGlobale = "Something went wrong" };
        result.Successo.Should().BeFalse();
    }

    [Fact]
    public void MigrazioneResult_Successo_FalseWhenChiusureErrors()
    {
        var result = new MigrazioneResult
        {
            ChiusureConErrori = new Dictionary<int, List<string>>
            {
                { 1, new List<string> { "Error" } }
            }
        };
        result.Successo.Should().BeFalse();
    }

    #endregion
}
