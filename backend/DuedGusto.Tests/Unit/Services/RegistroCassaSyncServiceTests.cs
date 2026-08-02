using DuedGusto.Tests.Helpers;

using duedgusto.GraphQL.GestioneCassa;
using duedgusto.Repositories.Implementations;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.Fornitori;

namespace DuedGusto.Tests.Unit.Services;

/// <summary>
/// Regressione: la quadratura del registro deve venire da un solo punto di calcolo.
/// <para>
/// <c>RecalculateSpeseFornitoriAsync</c> conteneva una copia divergente della formula (partiva da
/// <c>VenditeContanti</c> anziché dal contante dichiarato e non aggiornava <c>ContanteNetto</c>):
/// lo stesso registro assumeva valori diversi a seconda che l'ultima mutation fosse il salvataggio
/// del giorno o un tocco a un pagamento fornitore.
/// </para>
/// </summary>
public class RegistroCassaSyncServiceTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly RegistroCassaSyncService _service;

    public RegistroCassaSyncServiceTests()
    {
        _dbContext = TestDbContextFactory.Create();
        IUnitOfWork uow = new UnitOfWork(_dbContext);
        _service = new RegistroCassaSyncService(uow);
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

    [Fact]
    public async Task Recalculate_ProduceGliStessiValoriDiCalcolaTotali()
    {
        Utente utente = SeedUtente();

        // VenditeContanti ≠ IncassoContanteTracciato: è il caso in cui le due formule divergevano.
        var registro = new RegistroCassa
        {
            Data = new DateTime(2026, 5, 12),
            UtenteId = utente.Id,
            TotaleApertura = 100m,
            TotaleChiusura = 400m,
            IncassoContanteTracciato = 220m,
            VenditeContanti = 999m,
            SpeseGiornaliere = 40m,
            Stato = "DRAFT",
        };
        _dbContext.RegistriCassa.Add(registro);
        await _dbContext.SaveChangesAsync();

        _dbContext.PagamentiFornitori.Add(new PagamentoFornitore
        {
            DataPagamento = registro.Data,
            Importo = 60m,
            RegistroCassaId = registro.Id,
        });
        await _dbContext.SaveChangesAsync();

        await _service.RecalculateSpeseFornitoriAsync(registro.Id);

        // Riferimento: gli stessi input passati per la fonte unica della formula.
        var atteso = new RegistroCassa
        {
            TotaleApertura = 100m,
            TotaleChiusura = 400m,
            IncassoContanteTracciato = 220m,
            VenditeContanti = 999m,
            SpeseFornitori = 60m,
        };
        MutateRegistroCassaOrchestrator.CalcolaTotali(atteso, totaleSpese: 40m);

        registro.SpeseFornitori.Should().Be(60m);
        registro.ContanteNetto.Should().Be(atteso.ContanteNetto);
        registro.RestoFornitore.Should().Be(atteso.RestoFornitore);
        registro.Ecc.Should().Be(atteso.Ecc);
        registro.Resto.Should().Be(atteso.Resto);

        // Valori attesi in chiaro, per non dipendere solo dal confronto incrociato.
        registro.ContanteNetto.Should().Be(300m);        // Y  = 400 − 100
        registro.RestoFornitore.Should().Be(160m);       // AD = 220 − 60
        registro.Ecc.Should().Be(80m);                   // AE = 300 − 220
        registro.Resto.Should().Be(40m);                 // AG = 80 − 40
    }
}
