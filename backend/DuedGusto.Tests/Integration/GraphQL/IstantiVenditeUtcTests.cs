using System.Text.Json;

using GraphQL;

using duedgusto.Common;
using duedgusto.GraphQL.Vendite.Types;
using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Gli istanti del punto vendita (apertura e chiusura dell'ordine, ora della riga e della vendita)
/// devono uscire da GraphQL <b>marcati UTC</b>.
///
/// <para>🔴 <b>Il difetto che questi test tengono chiuso.</b> Il backend scrive con
/// <c>DateTime.UtcNow</c>, ma la colonna <c>datetime</c> non conserva il fuso: EF rileggeva il
/// valore con <c>Kind=Unspecified</c>, GraphQL lo serializzava senza <c>Z</c> e il browser lo
/// prendeva per ora locale. Lo scontrino del giorno mostrava così le 08:33 per una vendita delle
/// 10:33. Nessun errore, solo un orario sbagliato di due ore.</para>
///
/// <para>⚠️ <b>Sqlite e non InMemory</b>, e rilettura da un contesto nuovo: InMemory conserva
/// l'oggetto <c>DateTime</c> così com'è, Kind compreso, e il difetto sparirebbe dal test pur
/// restando in produzione. Serve un provider che passi da una colonna vera e la rilegga.</para>
/// </summary>
public class IstantiVenditeUtcTests
{
    private static ChiudiOrdineInput Taglio(Ordine ordine, string metodo) => new()
    {
        OrdineId = ordine.OrdineId,
        Tagli =
        [
            new TaglioOrdineInput
            {
                MetodoPagamento = metodo,
                RigheOrdineId = ordine.Righe.Select(r => r.RigaOrdineId).ToList(),
            }
        ],
    };

    [Fact]
    public async Task IstantiRiletti_HannoKindUtc()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);
        (Utente utente, Ordine ordine) = SeminaOrdine(db);

        await ScenarioOrdini.Chiusura(db)
            .ExecuteAsync(Taglio(ordine, MetodiPagamentoVendita.Elettronico), utente.Id);

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        Ordine riletto = await lettura.Ordini.Include(o => o.Righe).SingleAsync();
        Vendita vendita = await lettura.Vendite.SingleAsync();

        riletto.ApertoIl.Kind.Should().Be(DateTimeKind.Utc);
        riletto.ChiusoIl!.Value.Kind.Should().Be(DateTimeKind.Utc);
        riletto.Righe.Should().OnlyContain(r => r.DataOra.Kind == DateTimeKind.Utc);
        vendita.DataOra.Kind.Should().Be(DateTimeKind.Utc);

        // Il valore non si sposta: si rimette solo il Kind con cui era stato scritto.
        riletto.ApertoIl.Should().Be(new DateTime(2026, 8, 26, 19, 30, 0, DateTimeKind.Utc));
        vendita.DataOra.Should().Be(new DateTime(2026, 8, 26, 19, 31, 0, DateTimeKind.Utc));
    }

    [Fact]
    public async Task GraphQL_SerializzaGliIstantiConLaZ()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);
        (Utente utente, Ordine ordine) = SeminaOrdine(db);

        await ScenarioOrdini.Chiusura(db)
            .ExecuteAsync(Taglio(ordine, MetodiPagamentoVendita.Elettronico), utente.Id);

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        using var host = new GraphQLTestHost(lettura);

        ExecutionResult result = await host.EseguiAsync($$"""
            query {
              vendite {
                ordine(id: {{ordine.OrdineId}}) { apertoIl chiusoIl righe { dataOra } }
                vendite(registroCassaId: {{ordine.RegistroCassaId}}) { dataOra }
              }
            }
            """, GraphQLTestHost.Autenticato(utente.Id));

        result.Errors.Should().BeNullOrEmpty(GraphQLTestHost.DescriviErrori(result));

        using JsonDocument documento = JsonDocument.Parse(host.Serializza(result));
        JsonElement vendite = documento.RootElement.GetProperty("data").GetProperty("vendite");
        JsonElement letto = vendite.GetProperty("ordine");

        var istanti = new List<string?>
        {
            letto.GetProperty("apertoIl").GetString(),
            letto.GetProperty("chiusoIl").GetString(),
        };
        istanti.AddRange(letto.GetProperty("righe").EnumerateArray().Select(r => r.GetProperty("dataOra").GetString()));
        istanti.AddRange(vendite.GetProperty("vendite").EnumerateArray().Select(v => v.GetProperty("dataOra").GetString()));

        istanti.Should().NotBeEmpty().And.OnlyContain(
            s => s != null && s.EndsWith('Z'),
            "senza il designatore UTC il browser interpreta l'istante come ora locale");

        DateTimeOffset.Parse(letto.GetProperty("apertoIl").GetString()!)
            .Should().Be(new DateTimeOffset(2026, 8, 26, 19, 30, 0, TimeSpan.Zero));
    }

    private static (Utente Utente, Ordine Ordine) SeminaOrdine(AppDbContext db)
    {
        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 6.00m);

        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1, (spritz, 1m));
        db.Entry(ordine).Collection(o => o.Righe).Load();
        return (utente, ordine);
    }
}
