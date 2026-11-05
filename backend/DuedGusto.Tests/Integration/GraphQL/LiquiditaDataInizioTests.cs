using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// La liquidità cumulativa parte dalla data configurata nelle impostazioni (<c>DataInizioLiquidita</c>):
/// le spese pregresse non sono state inserite, quindi i registri precedenti non devono concorrere.
/// </summary>
public class LiquiditaDataInizioTests : IDisposable
{
    private const string Query = "{ gestioneCassa { liquiditaCassa { totaleVendite totaleSpese saldoIniziale dataInizio liquidita } } }";

    private readonly AppDbContext _dbContext = TestDbContextFactory.Create();
    private readonly GraphQLTestHost _host;
    private readonly int _utenteId;

    public LiquiditaDataInizioTests()
    {
        _host = new GraphQLTestHost(_dbContext);
        var ruolo = new Ruolo { Nome = "Cassiere", Descrizione = "Ruolo Cassiere" };
        _dbContext.Ruoli.Add(ruolo);
        _dbContext.SaveChanges();
        var utente = JwtTestHelper.CreateTestUtente(id: 0);
        utente.RuoloId = ruolo.Id;
        _dbContext.Utenti.Add(utente);
        _dbContext.SaveChanges();
        _utenteId = utente.Id;

        AddRegistro(new DateTime(2026, 1, 10), vendite: 1000m, spese: 100m); // pregresso
        AddRegistro(new DateTime(2026, 2, 1), vendite: 500m, spese: 50m);    // il giorno di partenza
        AddRegistro(new DateTime(2026, 2, 2), vendite: 300m, spese: 20m);
    }

    public void Dispose()
    {
        _host.Dispose();
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    private void AddRegistro(DateTime data, decimal vendite, decimal spese)
    {
        _dbContext.RegistriCassa.Add(new RegistroCassa
        {
            Data = data,
            UtenteId = _utenteId,
            Stato = "CLOSED",
            TotaleVendite = vendite,
            SpeseGiornaliere = spese,
        });
        _dbContext.SaveChanges();
    }

    private void Configura(DateOnly? dataInizio)
    {
        _dbContext.BusinessSettings.Add(new BusinessSettings { SaldoInizialeCassa = 200m, DataInizioLiquidita = dataInizio });
        _dbContext.SaveChanges();
    }

    private async Task<System.Text.Json.JsonElement> LeggiLiquidita()
    {
        var result = await _host.EseguiAsync(Query, GraphQLTestHost.Autenticato(_utenteId));
        result.Errors.Should().BeNullOrEmpty(GraphQLTestHost.DescriviErrori(result));
        using var doc = System.Text.Json.JsonDocument.Parse(_host.Serializza(result));
        return doc.RootElement.GetProperty("data").GetProperty("gestioneCassa").GetProperty("liquiditaCassa").Clone();
    }

    [Fact]
    public async Task SenzaDataDiPartenza_ConsideraTuttoLoStorico()
    {
        Configura(null);

        var liq = await LeggiLiquidita();

        liq.GetProperty("totaleVendite").GetDecimal().Should().Be(1800m);
        liq.GetProperty("totaleSpese").GetDecimal().Should().Be(170m);
        liq.GetProperty("liquidita").GetDecimal().Should().Be(1830m);
        liq.GetProperty("dataInizio").ValueKind.Should().Be(System.Text.Json.JsonValueKind.Null);
    }

    [Fact]
    public async Task ConDataDiPartenza_EscludePrimaDiEssa_EIncludeIlGiornoStesso()
    {
        Configura(new DateOnly(2026, 2, 1));

        var liq = await LeggiLiquidita();

        liq.GetProperty("totaleVendite").GetDecimal().Should().Be(800m);
        liq.GetProperty("totaleSpese").GetDecimal().Should().Be(70m);
        liq.GetProperty("saldoIniziale").GetDecimal().Should().Be(200m);
        liq.GetProperty("liquidita").GetDecimal().Should().Be(930m);
        liq.GetProperty("dataInizio").GetString().Should().Be("2026-02-01");
    }
}
