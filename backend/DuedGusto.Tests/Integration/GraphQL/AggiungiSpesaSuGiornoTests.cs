using DuedGusto.Tests.Helpers;

using GraphQL;

using duedgusto.GraphQL.GestioneCassa;
using duedgusto.GraphQL.GestioneCassa.Types;
using duedgusto.Repositories.Implementations;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;
using duedgusto.Services.Fornitori;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Tests per la mutation <c>aggiungiSpesaSuGiorno</c> (registro "leggero", Decision 3/8/9 del
/// change spese-su-registro-giornaliero). Copre: bypass di GuardGiornoOperativoConPeriodi,
/// mantenimento di GuardMeseChiuso, blocco su registro RECONCILED, ramo cash (SpesaCassa) e ramo
/// tracciata (PagamentoFornitore) con Categoria, integrità RegistroCassaId (Decision 9) e
/// idempotenza del find-or-create.
/// </summary>
public class AggiungiSpesaSuGiornoTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly AggiungiSpesaSuGiornoOrchestrator _orchestrator;

    public AggiungiSpesaSuGiornoTests()
    {
        _dbContext = TestDbContextFactory.Create();
        IUnitOfWork uow = new UnitOfWork(_dbContext);
        var chiusuraService = new ChiusuraMensileService(_dbContext, new ChiusuraMensileValidator(_dbContext));
        var syncService = new RegistroCassaSyncService(uow);
        var eventBus = new Mock<IEventBus>();
        _orchestrator = new AggiungiSpesaSuGiornoOrchestrator(uow, chiusuraService, syncService, eventBus.Object);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Helpers

    private Utente SeedUtente()
    {
        var ruolo = new Ruolo { Nome = "Cassiere", Descrizione = "Ruolo Cassiere" };
        _dbContext.Ruoli.Add(ruolo);
        _dbContext.SaveChanges();

        var utente = JwtTestHelper.CreateTestUtente(id: 0);
        utente.RuoloId = ruolo.Id;
        _dbContext.Utenti.Add(utente);
        _dbContext.SaveChanges();
        return utente;
    }

    #endregion

    #region Ramo NON tracciata (SpesaCassa) + bypass giorno operativo

    [Fact]
    public async Task AggiungiSpesaSuGiorno_NonTracciata_CreaRegistroLeggeroConSpesaCassaECategoria()
    {
        // Arrange — 2026-02-01 è una domenica (giorno di chiusura con i default): la mutation
        // NON applica GuardGiornoOperativoConPeriodi, quindi la spesa è registrabile lo stesso.
        var utente = SeedUtente();
        var data = new DateTime(2026, 2, 1); // domenica

        var input = new AggiungiSpesaSuGiornoInput
        {
            Data = data,
            Descrizione = "Affitto locale",
            Importo = 800m,
            Categoria = CategoriaSpesa.Affitto,
            Tracciata = false,
            UtenteId = utente.Id,
        };

        // Act
        var registro = await _orchestrator.ExecuteAsync(input);

        // Assert — registro leggero DRAFT creato dal nulla
        registro.Should().NotBeNull();
        registro.Stato.Should().Be("DRAFT");
        registro.Data.Date.Should().Be(data.Date);

        // SpesaCassa persistita con Categoria
        var spese = await _dbContext.SpeseCassa
            .Where(s => s.RegistroCassaId == registro.Id).ToListAsync();
        spese.Should().ContainSingle();
        spese[0].Descrizione.Should().Be("Affitto locale");
        spese[0].Importo.Should().Be(800m);
        spese[0].Categoria.Should().Be(CategoriaSpesa.Affitto);

        // SpeseGiornaliere ricalcolate (CalcolaTotali, formula invariata)
        registro.SpeseGiornaliere.Should().Be(800m);
    }

    [Fact]
    public async Task AggiungiSpesaSuGiorno_NonTracciata_CategoriaDefaultAltro()
    {
        // Arrange — nessuna Categoria esplicita: il default dell'input è Altro (Decision 1)
        var utente = SeedUtente();
        var input = new AggiungiSpesaSuGiornoInput
        {
            Data = new DateTime(2026, 3, 3),
            Descrizione = "Spesa varia",
            Importo = 15m,
            Tracciata = false,
            UtenteId = utente.Id,
        };

        // Act
        var registro = await _orchestrator.ExecuteAsync(input);

        // Assert
        var spesa = await _dbContext.SpeseCassa.FirstAsync(s => s.RegistroCassaId == registro.Id);
        spesa.Categoria.Should().Be(CategoriaSpesa.Altro);
    }

    #endregion

    #region Ramo tracciata (PagamentoFornitore) + Decision 9

    [Fact]
    public async Task AggiungiSpesaSuGiorno_Tracciata_CreaPagamentoFornitoreConCategoriaSenzaFatturaEDdt()
    {
        // Arrange
        var utente = SeedUtente();
        var data = new DateTime(2026, 4, 10);
        var input = new AggiungiSpesaSuGiornoInput
        {
            Data = data,
            Descrizione = "Stipendio",
            Importo = 1500m,
            Categoria = CategoriaSpesa.Stipendi,
            Tracciata = true,
            MetodoPagamento = "Bonifico",
            UtenteId = utente.Id,
        };

        // Act
        var registro = await _orchestrator.ExecuteAsync(input);

        // Assert — PagamentoFornitore tracciato, nessuna fattura/DDT, Categoria valorizzata
        var pagamento = await _dbContext.PagamentiFornitori
            .FirstAsync(p => p.RegistroCassaId == registro.Id);
        pagamento.Importo.Should().Be(1500m);
        pagamento.Categoria.Should().Be(CategoriaSpesa.Stipendi);
        pagamento.MetodoPagamento.Should().Be("Bonifico");
        pagamento.FatturaId.Should().BeNull();
        pagamento.DdtId.Should().BeNull();

        // SpeseFornitori ricalcolate sul registro
        registro.SpeseFornitori.Should().Be(1500m);
    }

    [Fact]
    public async Task AggiungiSpesaSuGiorno_Tracciata_RegistroCassaIdSempreValorizzato_Decision9()
    {
        // Arrange
        var utente = SeedUtente();
        var input = new AggiungiSpesaSuGiornoInput
        {
            Data = new DateTime(2026, 4, 12),
            Descrizione = "Utenze",
            Importo = 200m,
            Categoria = CategoriaSpesa.Utenze,
            Tracciata = true,
            UtenteId = utente.Id,
        };

        // Act
        var registro = await _orchestrator.ExecuteAsync(input);

        // Assert — Decision 9: il pagamento creato è SEMPRE linkato a un registro (no orfani)
        var pagamento = await _dbContext.PagamentiFornitori
            .FirstAsync(p => p.Categoria == CategoriaSpesa.Utenze);
        pagamento.RegistroCassaId.Should().NotBeNull();
        pagamento.RegistroCassaId.Should().Be(registro.Id);
        registro.Id.Should().BeGreaterThan(0);
    }

    #endregion

    #region Guard: mese chiuso mantenuto, RECONCILED bloccato

    [Fact]
    public async Task AggiungiSpesaSuGiorno_MeseChiuso_LanciaExecutionError()
    {
        // Arrange — chiusura mensile CHIUSA sul mese target: GuardMeseChiuso deve bloccare
        var utente = SeedUtente();
        _dbContext.ChiusureMensili.Add(new ChiusuraMensile { Anno = 2026, Mese = 5, Stato = "CHIUSA" });
        await _dbContext.SaveChangesAsync();

        var input = new AggiungiSpesaSuGiornoInput
        {
            Data = new DateTime(2026, 5, 10),
            Descrizione = "Affitto",
            Importo = 800m,
            Categoria = CategoriaSpesa.Affitto,
            Tracciata = false,
            UtenteId = utente.Id,
        };

        // Act & Assert
        var act = () => _orchestrator.ExecuteAsync(input);
        await act.Should().ThrowAsync<ExecutionError>()
            .WithMessage("*chiuso*");
    }

    [Fact]
    public async Task AggiungiSpesaSuGiorno_RegistroReconciled_LanciaExecutionError()
    {
        // Arrange — registro RECONCILED alla data: la spesa non è aggiungibile
        var utente = SeedUtente();
        var data = new DateTime(2026, 6, 15);
        _dbContext.RegistriCassa.Add(new RegistroCassa
        {
            Data = data,
            UtenteId = utente.Id,
            Stato = "RECONCILED",
        });
        await _dbContext.SaveChangesAsync();

        var input = new AggiungiSpesaSuGiornoInput
        {
            Data = data,
            Descrizione = "Affitto",
            Importo = 800m,
            Categoria = CategoriaSpesa.Affitto,
            Tracciata = false,
            UtenteId = utente.Id,
        };

        // Act & Assert
        var act = () => _orchestrator.ExecuteAsync(input);
        await act.Should().ThrowAsync<ExecutionError>()
            .WithMessage("*riconciliato*");
    }

    #endregion

    #region Idempotenza find-or-create

    [Fact]
    public async Task AggiungiSpesaSuGiorno_DueSpeseStessaData_RiusaLoStessoRegistro()
    {
        // Arrange
        var utente = SeedUtente();
        var data = new DateTime(2026, 7, 20);

        AggiungiSpesaSuGiornoInput MakeInput(string desc, decimal importo) => new()
        {
            Data = data,
            Descrizione = desc,
            Importo = importo,
            Categoria = CategoriaSpesa.Altro,
            Tracciata = false,
            UtenteId = utente.Id,
        };

        // Act — due spese sullo stesso giorno
        var r1 = await _orchestrator.ExecuteAsync(MakeInput("Spesa 1", 10m));
        var r2 = await _orchestrator.ExecuteAsync(MakeInput("Spesa 2", 25m));

        // Assert — stesso registro riusato (find-or-create idempotente su Data)
        r2.Id.Should().Be(r1.Id);
        var registriAllaData = await _dbContext.RegistriCassa
            .Where(r => r.Data.Date == data.Date).ToListAsync();
        registriAllaData.Should().ContainSingle();

        var spese = await _dbContext.SpeseCassa
            .Where(s => s.RegistroCassaId == r1.Id).ToListAsync();
        spese.Should().HaveCount(2);
        r2.SpeseGiornaliere.Should().Be(35m); // 10 + 25
    }

    #endregion
}
