using DuedGusto.Tests.Helpers;

using duedgusto.GraphQL.Fornitori;
using duedgusto.GraphQL.Fornitori.Types;
using duedgusto.Repositories.Implementations;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.Fornitori;

namespace DuedGusto.Tests.Unit.GraphQL;

/// <summary>
/// Regressione: una fattura creata dalla gestione fatture con i pagamenti già compilati
/// spariva da ogni chiusura mensile.
/// <para>
/// L'orchestrator inseriva il <c>PagamentoFornitore</c> senza valorizzare
/// <c>RegistroCassaId</c>, mentre la chiusura mensile aggrega esclusivamente per registro
/// giornaliero (<c>SUM(RegistroCassa.SpeseFornitori)</c> sui registri inclusi) e non guarda
/// mai <c>DataPagamento</c>. Il pagamento restava quindi orfano e invisibile al mese,
/// qualunque fosse la sua data — senza nessun avviso in chiusura.
/// </para>
/// </summary>
public class FatturaAcquistoOrchestratorTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly FatturaAcquistoOrchestrator _orchestrator;

    public FatturaAcquistoOrchestratorTests()
    {
        _dbContext = TestDbContextFactory.Create();
        IUnitOfWork uow = new UnitOfWork(_dbContext);
        _orchestrator = new FatturaAcquistoOrchestrator(uow, new RegistroCassaSyncService(uow));
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

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

    private Fornitore SeedFornitore()
    {
        var fornitore = new Fornitore
        {
            RagioneSociale = "Fornitore Test",
            PartitaIva = "IT12345678901",
            Attivo = true,
        };
        _dbContext.Fornitori.Add(fornitore);
        _dbContext.SaveChanges();
        return fornitore;
    }

    private static FatturaAcquistoInput BuildInput(int fornitoreId, DateTime dataPagamento, decimal importo)
        => new()
        {
            FornitoreId = fornitoreId,
            NumeroFattura = "FA-731",
            DataFattura = new DateTime(2026, 7, 20),
            Imponibile = 100m,
            AliquotaIva = 22m,
            Stato = "PAGATA",
            Pagamenti =
            [
                new PagamentoFornitoreInput
                {
                    DataPagamento = dataPagamento,
                    Importo = importo,
                    MetodoPagamento = "CONTANTI",
                },
            ],
        };

    [Fact]
    public async Task NuovaFattura_ConPagamento_CollegaIlPagamentoAlRegistroDelGiorno()
    {
        Utente utente = SeedUtente();
        Fornitore fornitore = SeedFornitore();
        var dataPagamento = new DateTime(2026, 7, 31);

        await _orchestrator.MutateAsync(BuildInput(fornitore.FornitoreId, dataPagamento, 122m), utente.Id);

        PagamentoFornitore pagamento = await _dbContext.PagamentiFornitori.SingleAsync();

        // Il punto del bug: senza questa FK la chiusura mensile non vede mai la spesa.
        pagamento.RegistroCassaId.Should().NotBeNull();

        RegistroCassa registro = await _dbContext.RegistriCassa
            .SingleAsync(r => r.Id == pagamento.RegistroCassaId);
        registro.Data.Date.Should().Be(dataPagamento.Date);
    }

    [Fact]
    public async Task NuovaFattura_ConPagamento_CreaIlRegistroMancanteEAggiornaSpeseFornitori()
    {
        Utente utente = SeedUtente();
        Fornitore fornitore = SeedFornitore();
        var dataPagamento = new DateTime(2026, 7, 31);

        await _orchestrator.MutateAsync(BuildInput(fornitore.FornitoreId, dataPagamento, 122m), utente.Id);

        RegistroCassa registro = await _dbContext.RegistriCassa.SingleAsync();
        registro.Data.Date.Should().Be(dataPagamento.Date);
        registro.Stato.Should().Be("DRAFT");
        // È il campo denormalizzato che la chiusura somma: se resta a zero il mese non quadra.
        registro.SpeseFornitori.Should().Be(122m);
    }

    [Fact]
    public async Task NuovaFattura_ConPagamento_RiusaIlRegistroEsistenteDelGiorno()
    {
        Utente utente = SeedUtente();
        Fornitore fornitore = SeedFornitore();
        var dataPagamento = new DateTime(2026, 7, 31);

        var registroEsistente = new RegistroCassa
        {
            Data = dataPagamento,
            UtenteId = utente.Id,
            Stato = "DRAFT",
        };
        _dbContext.RegistriCassa.Add(registroEsistente);
        await _dbContext.SaveChangesAsync();

        await _orchestrator.MutateAsync(BuildInput(fornitore.FornitoreId, dataPagamento, 50m), utente.Id);

        _dbContext.RegistriCassa.Count().Should().Be(1);
        PagamentoFornitore pagamento = await _dbContext.PagamentiFornitori.SingleAsync();
        pagamento.RegistroCassaId.Should().Be(registroEsistente.Id);
        registroEsistente.SpeseFornitori.Should().Be(50m);
    }
}
