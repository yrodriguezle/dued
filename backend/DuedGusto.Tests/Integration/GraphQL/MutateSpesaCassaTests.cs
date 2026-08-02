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
/// Tests delle mutation per-riga sulle spese non tracciate (<c>mutateSpesaCassa</c> /
/// <c>eliminaSpesaCassa</c>), usate dalla griglia spese della Chiusura Mensile.
/// Copre: creazione del registro "leggero" se il giorno è scoperto, bypass del guard sul giorno
/// operativo con mantenimento di quello sul mese chiuso, blocco su RECONCILED, spostamento di
/// registro al cambio data (con ricalcolo di ENTRAMBI), eliminazione e auto-link alla chiusura
/// in BOZZA.
/// </summary>
public class MutateSpesaCassaTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly MutateSpesaCassaOrchestrator _orchestrator;

    public MutateSpesaCassaTests()
    {
        _dbContext = TestDbContextFactory.Create();
        IUnitOfWork uow = new UnitOfWork(_dbContext);
        var chiusuraService = new ChiusuraMensileService(_dbContext, new ChiusuraMensileValidator(_dbContext));
        var syncService = new RegistroCassaSyncService(uow);
        var eventBus = new Mock<IEventBus>();
        _orchestrator = new MutateSpesaCassaOrchestrator(uow, chiusuraService, syncService, eventBus.Object);
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

    private static SpesaCassaMutateInput Input(
        DateTime data,
        decimal importo = 100m,
        string descrizione = "Affitto",
        CategoriaSpesa categoria = CategoriaSpesa.Affitto,
        int? spesaId = null) => new()
        {
            SpesaId = spesaId,
            Data = data,
            Descrizione = descrizione,
            Importo = importo,
            Categoria = categoria,
        };

    private RegistroCassa RegistroAllaData(DateTime data) =>
        _dbContext.RegistriCassa.First(r => r.Data.Date == data.Date);

    #endregion

    #region Creazione

    [Fact]
    public async Task Create_SuGiornoSenzaRegistro_CreaRegistroDraftESpesa()
    {
        Utente utente = SeedUtente();
        var data = new DateTime(2026, 3, 10);

        SpesaCassa spesa = await _orchestrator.ExecuteAsync(Input(data, 250m), utente.Id);

        spesa.Id.Should().BeGreaterThan(0);
        spesa.Categoria.Should().Be(CategoriaSpesa.Affitto);

        RegistroCassa registro = RegistroAllaData(data);
        registro.Stato.Should().Be("DRAFT");
        registro.SpeseGiornaliere.Should().Be(250m);
        spesa.RegistroCassaId.Should().Be(registro.Id);
    }

    /// <summary>
    /// Una spesa fissa deve poter cadere su un giorno di chiusura (qui una domenica):
    /// GuardGiornoOperativoConPeriodi NON si applica.
    /// </summary>
    [Fact]
    public async Task Create_SuGiornoNonOperativo_NonApplicaIlGuardGiornoOperativo()
    {
        Utente utente = SeedUtente();
        var domenica = new DateTime(2026, 3, 1);
        domenica.DayOfWeek.Should().Be(DayOfWeek.Sunday);

        SpesaCassa spesa = await _orchestrator.ExecuteAsync(Input(domenica), utente.Id);

        spesa.Id.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Create_MeseChiuso_LanciaExecutionError()
    {
        Utente utente = SeedUtente();
        _dbContext.ChiusureMensili.Add(new ChiusuraMensile { Anno = 2026, Mese = 4, Stato = "CHIUSA" });
        await _dbContext.SaveChangesAsync();

        Func<Task> act = () => _orchestrator.ExecuteAsync(Input(new DateTime(2026, 4, 15)), utente.Id);

        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*chiuso*");
    }

    [Fact]
    public async Task Create_RegistroRiconciliato_LanciaExecutionError()
    {
        Utente utente = SeedUtente();
        var data = new DateTime(2026, 3, 12);
        _dbContext.RegistriCassa.Add(new RegistroCassa
        {
            Data = data,
            UtenteId = utente.Id,
            Stato = "RECONCILED",
        });
        await _dbContext.SaveChangesAsync();

        Func<Task> act = () => _orchestrator.ExecuteAsync(Input(data), utente.Id);

        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*riconciliato*");
    }

    [Fact]
    public async Task Create_DueSpeseStessoGiorno_RiusanoLoStessoRegistro()
    {
        Utente utente = SeedUtente();
        var data = new DateTime(2026, 3, 10);

        SpesaCassa prima = await _orchestrator.ExecuteAsync(Input(data, 100m, "Affitto"), utente.Id);
        SpesaCassa seconda = await _orchestrator.ExecuteAsync(
            Input(data, 50m, "Luce", CategoriaSpesa.Utenze), utente.Id);

        prima.RegistroCassaId.Should().Be(seconda.RegistroCassaId);
        _dbContext.RegistriCassa.Count(r => r.Data.Date == data.Date).Should().Be(1);
        RegistroAllaData(data).SpeseGiornaliere.Should().Be(150m);
    }

    #endregion

    #region Aggiornamento

    [Fact]
    public async Task Update_CambiaImportoEDescrizione_RicalcolaMantenendoLId()
    {
        Utente utente = SeedUtente();
        var data = new DateTime(2026, 3, 10);
        SpesaCassa creata = await _orchestrator.ExecuteAsync(Input(data, 100m), utente.Id);

        SpesaCassa aggiornata = await _orchestrator.ExecuteAsync(
            Input(data, 180m, "Affitto marzo", spesaId: creata.Id), utente.Id);

        aggiornata.Id.Should().Be(creata.Id);
        aggiornata.Descrizione.Should().Be("Affitto marzo");
        RegistroAllaData(data).SpeseGiornaliere.Should().Be(180m);
    }

    [Fact]
    public async Task Update_CambioData_SpostaLaSpesaERicalcolaEntrambiIRegistri()
    {
        Utente utente = SeedUtente();
        var origine = new DateTime(2026, 3, 10);
        var destinazione = new DateTime(2026, 3, 20);

        SpesaCassa creata = await _orchestrator.ExecuteAsync(Input(origine, 300m), utente.Id);
        int registroOrigineId = creata.RegistroCassaId;

        SpesaCassa spostata = await _orchestrator.ExecuteAsync(
            Input(destinazione, 300m, spesaId: creata.Id), utente.Id);

        spostata.RegistroCassaId.Should().NotBe(registroOrigineId);
        RegistroAllaData(destinazione).SpeseGiornaliere.Should().Be(300m);
        RegistroAllaData(origine).SpeseGiornaliere.Should().Be(0m);
    }

    [Fact]
    public async Task Update_VersoMeseChiuso_LanciaExecutionError()
    {
        Utente utente = SeedUtente();
        var data = new DateTime(2026, 3, 10);
        SpesaCassa creata = await _orchestrator.ExecuteAsync(Input(data), utente.Id);

        _dbContext.ChiusureMensili.Add(new ChiusuraMensile { Anno = 2026, Mese = 4, Stato = "CHIUSA" });
        await _dbContext.SaveChangesAsync();

        Func<Task> act = () => _orchestrator.ExecuteAsync(
            Input(new DateTime(2026, 4, 5), spesaId: creata.Id), utente.Id);

        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*chiuso*");
    }

    [Fact]
    public async Task Update_SpesaInesistente_LanciaExecutionError()
    {
        Utente utente = SeedUtente();

        Func<Task> act = () => _orchestrator.ExecuteAsync(
            Input(new DateTime(2026, 3, 10), spesaId: 9999), utente.Id);

        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*non trovata*");
    }

    #endregion

    #region Eliminazione

    [Fact]
    public async Task Elimina_RimuoveLaRigaERicalcolaITotali()
    {
        Utente utente = SeedUtente();
        var data = new DateTime(2026, 3, 10);
        await _orchestrator.ExecuteAsync(Input(data, 100m, "Affitto"), utente.Id);
        SpesaCassa daEliminare = await _orchestrator.ExecuteAsync(
            Input(data, 40m, "Luce", CategoriaSpesa.Utenze), utente.Id);

        bool esito = await _orchestrator.EliminaAsync(daEliminare.Id);

        esito.Should().BeTrue();
        _dbContext.SpeseCassa.Any(s => s.Id == daEliminare.Id).Should().BeFalse();
        RegistroAllaData(data).SpeseGiornaliere.Should().Be(100m);
    }

    [Fact]
    public async Task Elimina_SpesaInesistente_LanciaExecutionError()
    {
        Func<Task> act = () => _orchestrator.EliminaAsync(4242);

        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*non trovata*");
    }

    #endregion

    #region Auto-link alla chiusura in BOZZA

    [Fact]
    public async Task Create_ConChiusuraBozzaDelMese_CollegaIlRegistroAllaChiusura()
    {
        Utente utente = SeedUtente();
        var chiusura = new ChiusuraMensile { Anno = 2026, Mese = 3, Stato = "BOZZA" };
        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        SpesaCassa spesa = await _orchestrator.ExecuteAsync(Input(new DateTime(2026, 3, 10)), utente.Id);

        RegistroCassaMensile link = _dbContext.RegistriCassaMensili
            .Single(rm => rm.ChiusuraId == chiusura.ChiusuraId);
        link.RegistroId.Should().Be(spesa.RegistroCassaId);
        link.Incluso.Should().BeTrue();
    }

    [Fact]
    public async Task Create_SecondaSpesaStessoGiorno_NonDuplicaIlLink()
    {
        Utente utente = SeedUtente();
        var chiusura = new ChiusuraMensile { Anno = 2026, Mese = 3, Stato = "BOZZA" };
        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();
        var data = new DateTime(2026, 3, 10);

        await _orchestrator.ExecuteAsync(Input(data, 100m, "Affitto"), utente.Id);
        await _orchestrator.ExecuteAsync(Input(data, 50m, "Luce", CategoriaSpesa.Utenze), utente.Id);

        _dbContext.RegistriCassaMensili
            .Count(rm => rm.ChiusuraId == chiusura.ChiusuraId).Should().Be(1);
    }

    [Fact]
    public async Task Create_SenzaChiusuraBozza_NonCreaAlcunLink()
    {
        Utente utente = SeedUtente();

        await _orchestrator.ExecuteAsync(Input(new DateTime(2026, 3, 10)), utente.Id);

        _dbContext.RegistriCassaMensili.Should().BeEmpty();
    }

    #endregion
}
