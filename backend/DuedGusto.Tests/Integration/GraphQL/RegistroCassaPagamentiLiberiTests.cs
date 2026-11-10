using DuedGusto.Tests.Helpers;
using Microsoft.Extensions.Logging.Abstractions;

using duedgusto.GraphQL.GestioneCassa;
using duedgusto.GraphQL.GestioneCassa.Types;
using duedgusto.Repositories.Implementations;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;
using duedgusto.Services.Fornitori;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Pagamenti "liberi": senza fattura né DDT, con causale e categoria (affitto, utenze, stipendi).
/// Nascono dalla griglia spese fisse della chiusura mensile ma stanno sul registro del giorno,
/// dove il form li ricarica insieme a tutte le altre spese. Il salvataggio del registro è la
/// verità del giorno: una riga che il form rimanda resta (e si aggiorna), una che non rimanda
/// sparisce. Caso reale (10/11/2026): il form non rimandava i bonifici inseriti dalla chiusura
/// e il salvataggio li ha cancellati tutti.
/// </summary>
public class RegistroCassaPagamentiLiberiTests : IDisposable
{
    private static readonly DateTime Giorno = new(2026, 10, 31);

    private readonly AppDbContext _dbContext;
    private readonly MutateRegistroCassaOrchestrator _orchestrator;

    public RegistroCassaPagamentiLiberiTests()
    {
        _dbContext = TestDbContextFactory.Create();
        var unitOfWork = new UnitOfWork(_dbContext);
        var documenti = new DocumentiFornitoreService(_dbContext);
        _orchestrator = new MutateRegistroCassaOrchestrator(
            unitOfWork,
            new ChiusuraMensileService(_dbContext, new ChiusuraMensileValidator(_dbContext), documenti),
            documenti,
            new CategoriaSpesaService(_dbContext),
            new EventBus(),
            NullLogger<MutateRegistroCassaOrchestrator>.Instance);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Helpers

    private (RegistroCassa Registro, int UtenteId) SeedRegistro()
    {
        _dbContext.BusinessSettings.Add(new BusinessSettings
        {
            BusinessName = "DuedGusto Test",
            OperatingDays = "[true,true,true,true,true,true,true]",
            VatRate = 0.10m,
        });
        var ruolo = new Ruolo { Nome = "Cassiere", Descrizione = "Cassiere" };
        _dbContext.Ruoli.Add(ruolo);
        _dbContext.SaveChanges();
        Utente utente = JwtTestHelper.CreateTestUtente(id: 0, username: JwtTestHelper.E2eUsername);
        utente.RuoloId = ruolo.Id;
        _dbContext.Utenti.Add(utente);
        _dbContext.SaveChanges();

        var registro = new RegistroCassa { Data = Giorno, UtenteId = utente.Id, Stato = "DRAFT" };
        _dbContext.RegistriCassa.Add(registro);
        _dbContext.SaveChanges();
        return (registro, utente.Id);
    }

    private PagamentoFornitore SeedPagamentoLibero(int registroId, decimal importo, string descrizione)
    {
        var pagamento = new PagamentoFornitore
        {
            RegistroCassaId = registroId,
            DataPagamento = Giorno,
            Importo = importo,
            MetodoPagamento = "Bonifico",
            Descrizione = descrizione,
            Note = null,
        };
        _dbContext.PagamentiFornitori.Add(pagamento);
        _dbContext.SaveChanges();
        return pagamento;
    }

    private static RegistroCassaInput InputRegistro(int registroId, int utenteId, params PagamentoFornitoreRegistroInput[] pagamenti) => new()
    {
        Id = registroId,
        Data = Giorno,
        UtenteId = utenteId,
        Stato = "DRAFT",
        PagamentiFornitori = [.. pagamenti],
    };

    #endregion

    [Fact]
    public async Task ExecuteAsync_PagamentoLiberoRimandatoDalForm_RestaEVieneAggiornato()
    {
        (RegistroCassa registro, int utenteId) = SeedRegistro();
        PagamentoFornitore affitto = SeedPagamentoLibero(registro.Id, 932m, "Canone Affitto");

        await _orchestrator.ExecuteAsync(InputRegistro(registro.Id, utenteId, new PagamentoFornitoreRegistroInput
        {
            PagamentoId = affitto.PagamentoId,
            FornitoreId = null,
            Importo = 950m,
            MetodoPagamento = "Contanti",
            Categoria = "Affitto",
            Descrizione = "Canone Affitto ottobre",
        }));

        PagamentoFornitore salvato = _dbContext.PagamentiFornitori.Single(p => p.PagamentoId == affitto.PagamentoId);
        salvato.Importo.Should().Be(950m);
        salvato.MetodoPagamento.Should().Be("Contanti");
        salvato.Descrizione.Should().Be("Canone Affitto ottobre");
        salvato.FatturaId.Should().BeNull();
        salvato.DdtId.Should().BeNull();
        _dbContext.RegistriCassa.Single(r => r.Id == registro.Id).SpeseFornitori.Should().Be(950m);
    }

    [Fact]
    public async Task ExecuteAsync_PagamentoLiberoNonRimandatoDalForm_VieneEliminato()
    {
        // Comportamento invariato: il form è la verità del giorno, una riga tolta dall'operatore sparisce.
        (RegistroCassa registro, int utenteId) = SeedRegistro();
        SeedPagamentoLibero(registro.Id, 932m, "Canone Affitto");

        await _orchestrator.ExecuteAsync(InputRegistro(registro.Id, utenteId));

        _dbContext.PagamentiFornitori.Where(p => p.RegistroCassaId == registro.Id).Should().BeEmpty();
    }

    [Fact]
    public async Task ExecuteAsync_NuovoPagamentoSenzaFornitore_EErroreEsplicito()
    {
        (RegistroCassa registro, int utenteId) = SeedRegistro();

        Func<Task> azione = () => _orchestrator.ExecuteAsync(InputRegistro(registro.Id, utenteId, new PagamentoFornitoreRegistroInput
        {
            PagamentoId = null,
            FornitoreId = null,
            Importo = 10m,
        }));

        await azione.Should().ThrowAsync<global::GraphQL.ExecutionError>().WithMessage("*fornitore*");
        _dbContext.PagamentiFornitori.Should().BeEmpty();
    }
}
