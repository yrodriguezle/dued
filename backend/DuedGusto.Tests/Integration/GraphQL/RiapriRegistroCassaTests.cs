using DuedGusto.Tests.Helpers;

using GraphQL;

using duedgusto.GraphQL.GestioneCassa;
using duedgusto.Repositories.Implementations;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Tests della mutation <c>riapriRegistroCassa</c>: riporta a DRAFT un giorno già chiuso
/// per correggerne i dati. Copre il guard sul ruolo amministrativo (flag
/// <c>Ruolo.Amministratore</c>, non il nome del ruolo), i vincoli di stato e il guard
/// sul mese chiuso.
/// </summary>
public class RiapriRegistroCassaTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly RiapriRegistroCassaOrchestrator _orchestrator;
    private readonly Mock<IEventBus> _eventBus;

    public RiapriRegistroCassaTests()
    {
        _dbContext = TestDbContextFactory.Create();
        IUnitOfWork uow = new UnitOfWork(_dbContext);
        var chiusuraService = new ChiusuraMensileService(_dbContext, new ChiusuraMensileValidator(_dbContext));
        _eventBus = new Mock<IEventBus>();
        _orchestrator = new RiapriRegistroCassaOrchestrator(uow, chiusuraService, _eventBus.Object);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Helpers

    private Utente SeedUtente(bool amministratore, string nomeRuolo = "Cassiere")
    {
        var ruolo = new Ruolo
        {
            Nome = nomeRuolo,
            Descrizione = $"Ruolo {nomeRuolo}",
            Amministratore = amministratore
        };
        _dbContext.Ruoli.Add(ruolo);
        _dbContext.SaveChanges();

        var utente = JwtTestHelper.CreateTestUtente(id: 0, username: $"utente-{nomeRuolo}");
        utente.RuoloId = ruolo.Id;
        _dbContext.Utenti.Add(utente);
        _dbContext.SaveChanges();
        return utente;
    }

    private RegistroCassa SeedRegistroCassa(Utente utente, DateTime data, string stato)
    {
        var registro = new RegistroCassa
        {
            Data = data,
            UtenteId = utente.Id,
            Stato = stato,
            TotaleVendite = 168.10m,
            TotaleApertura = 45.85m,
            TotaleChiusura = 213.95m
        };
        _dbContext.RegistriCassa.Add(registro);
        _dbContext.SaveChanges();
        return registro;
    }

    private void SeedChiusuraMensile(int anno, int mese, string stato)
    {
        _dbContext.ChiusureMensili.Add(new ChiusuraMensile { Anno = anno, Mese = mese, Stato = stato });
        _dbContext.SaveChanges();
    }

    #endregion

    [Fact]
    public async Task RiapriRegistroCassa_ConRuoloAmministratore_RiportaLoStatoADraft()
    {
        Utente admin = SeedUtente(amministratore: true, nomeRuolo: "Admin");
        RegistroCassa registro = SeedRegistroCassa(admin, new DateTime(2026, 7, 4), "CLOSED");

        RegistroCassa risultato = await _orchestrator.ExecuteAsync(registro.Id, admin.Id);

        Assert.Equal("DRAFT", risultato.Stato);
        Assert.Equal("DRAFT", _dbContext.RegistriCassa.Single(r => r.Id == registro.Id).Stato);
    }

    [Fact]
    public async Task RiapriRegistroCassa_ConRuoloNonAmministratore_Fallisce()
    {
        Utente gestore = SeedUtente(amministratore: false, nomeRuolo: "Gestore");
        RegistroCassa registro = SeedRegistroCassa(gestore, new DateTime(2026, 7, 4), "CLOSED");

        ExecutionError errore = await Assert.ThrowsAsync<ExecutionError>(
            () => _orchestrator.ExecuteAsync(registro.Id, gestore.Id));

        Assert.Contains("amministratori", errore.Message);
        Assert.Equal("CLOSED", _dbContext.RegistriCassa.Single(r => r.Id == registro.Id).Stato);
    }

    [Fact]
    public async Task RiapriRegistroCassa_IlPrivilegioDipendeDalFlagNonDalNomeDelRuolo()
    {
        // Un ruolo che si chiama "Admin" ma senza il flag NON deve poter riaprire.
        Utente finto = SeedUtente(amministratore: false, nomeRuolo: "Admin");
        RegistroCassa registro = SeedRegistroCassa(finto, new DateTime(2026, 7, 4), "CLOSED");

        await Assert.ThrowsAsync<ExecutionError>(
            () => _orchestrator.ExecuteAsync(registro.Id, finto.Id));

        // Viceversa un ruolo con nome qualunque ma con il flag attivo deve riuscire.
        Utente autorizzato = SeedUtente(amministratore: true, nomeRuolo: "Responsabile");
        RegistroCassa altro = SeedRegistroCassa(autorizzato, new DateTime(2026, 7, 6), "CLOSED");

        RegistroCassa risultato = await _orchestrator.ExecuteAsync(altro.Id, autorizzato.Id);

        Assert.Equal("DRAFT", risultato.Stato);
    }

    [Fact]
    public async Task RiapriRegistroCassa_GiaInDraft_Fallisce()
    {
        Utente admin = SeedUtente(amministratore: true, nomeRuolo: "Admin");
        RegistroCassa registro = SeedRegistroCassa(admin, new DateTime(2026, 7, 4), "DRAFT");

        ExecutionError errore = await Assert.ThrowsAsync<ExecutionError>(
            () => _orchestrator.ExecuteAsync(registro.Id, admin.Id));

        Assert.Contains("già in bozza", errore.Message);
    }

    [Fact]
    public async Task RiapriRegistroCassa_Riconciliato_Fallisce()
    {
        Utente admin = SeedUtente(amministratore: true, nomeRuolo: "Admin");
        RegistroCassa registro = SeedRegistroCassa(admin, new DateTime(2026, 7, 4), "RECONCILED");

        ExecutionError errore = await Assert.ThrowsAsync<ExecutionError>(
            () => _orchestrator.ExecuteAsync(registro.Id, admin.Id));

        Assert.Contains("riconciliato", errore.Message);
        Assert.Equal("RECONCILED", _dbContext.RegistriCassa.Single(r => r.Id == registro.Id).Stato);
    }

    [Fact]
    public async Task RiapriRegistroCassa_ConMeseChiuso_Fallisce()
    {
        Utente admin = SeedUtente(amministratore: true, nomeRuolo: "Admin");
        RegistroCassa registro = SeedRegistroCassa(admin, new DateTime(2026, 7, 4), "CLOSED");
        SeedChiusuraMensile(2026, 7, "CHIUSA");

        ExecutionError errore = await Assert.ThrowsAsync<ExecutionError>(
            () => _orchestrator.ExecuteAsync(registro.Id, admin.Id));

        Assert.Contains("mese", errore.Message);
        Assert.Equal("CLOSED", _dbContext.RegistriCassa.Single(r => r.Id == registro.Id).Stato);
    }

    [Fact]
    public async Task RiapriRegistroCassa_RegistroInesistente_Fallisce()
    {
        Utente admin = SeedUtente(amministratore: true, nomeRuolo: "Admin");

        await Assert.ThrowsAsync<ExecutionError>(
            () => _orchestrator.ExecuteAsync(9999, admin.Id));
    }

    [Fact]
    public async Task RiapriRegistroCassa_PubblicaEventoReopened()
    {
        Utente admin = SeedUtente(amministratore: true, nomeRuolo: "Admin");
        RegistroCassa registro = SeedRegistroCassa(admin, new DateTime(2026, 7, 4), "CLOSED");

        await _orchestrator.ExecuteAsync(registro.Id, admin.Id);

        _eventBus.Verify(b => b.Publish(It.Is<duedgusto.GraphQL.Subscriptions.Types.RegistroCassaUpdatedEvent>(
            e => e.RegistroCassaId == registro.Id && e.Azione == "REOPENED" && e.Stato == "DRAFT")), Times.Once);
    }
}
