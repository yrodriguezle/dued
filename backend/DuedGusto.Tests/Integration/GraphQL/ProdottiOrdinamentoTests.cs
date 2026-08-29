using System.Text.Json;

using GraphQL;

using duedgusto.GraphQL.Vendite;
using duedgusto.GraphQL.Vendite.Types;
using duedgusto.Models;
using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// L'ordine con cui le tessere dei prodotti si presentano al bancone.
///
/// <para>🔴 <b>Perché serve un campo e non basta il codice.</b> Prima di
/// <c>Prodotto.Ordinamento</c> la query <c>prodotti</c> ordinava per <c>Codice</c>, quindi la
/// posizione di un pulsante era decisa dalla convenzione <c>CATEGORIA-NOME</c> — cioè
/// dall'alfabeto. L'espresso, che è la voce più battuta della giornata, stava dove capita.</para>
///
/// <para>⚠️ Da non confondere con <c>OrdinamentoVetrina</c>, che dispone i piatti sul sito
/// pubblico: sono due assi distinti e devono restare tali. L'ordine con cui i piatti si
/// presentano al cliente e l'ordine con cui la mano li trova al banco non hanno motivo di
/// coincidere.</para>
/// </summary>
public class ProdottiOrdinamentoTests : IDisposable
{
    private const int UtenteId = 1;

    private readonly AppDbContext _dbContext;
    private readonly GraphQLTestHost _host;

    public ProdottiOrdinamentoTests()
    {
        _dbContext = TestDbContextFactory.Create();
        _host = new GraphQLTestHost(_dbContext);
    }

    public void Dispose()
    {
        _host.Dispose();
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    // ── Seed ─────────────────────────────────────────────────────────────────────────────────

    private Prodotto SeedProdotto(string codice, int ordinamento = 0, string categoria = "CAFETERIA")
    {
        var prodotto = new Prodotto
        {
            Codice = codice,
            Nome = $"Prodotto {codice}",
            Prezzo = 1.20m,
            AliquotaIva = 10m,
            Categoria = categoria,
            Ordinamento = ordinamento,
            Attivo = true,
        };
        _dbContext.Prodotti.Add(prodotto);
        _dbContext.SaveChanges();
        return prodotto;
    }

    private async Task<string[]> CodiciDalListino(string? categoria = null)
    {
        string argomento = categoria == null ? "" : $"(categoria: \"{categoria}\")";
        ExecutionResult result = await _host.EseguiAsync(
            $"query {{ vendite {{ prodotti{argomento} {{ codice ordinamento }} }} }}",
            GraphQLTestHost.Autenticato(UtenteId));

        result.Errors.Should().BeNullOrEmpty(
            $"la query deve riuscire, invece: {GraphQLTestHost.DescriviErrori(result)}");

        using JsonDocument documento = JsonDocument.Parse(_host.Serializza(result));
        return documento.RootElement.GetProperty("data").GetProperty("vendite").GetProperty("prodotti")
            .EnumerateArray()
            .Select(p => p.GetProperty("codice").GetString()!)
            .ToArray();
    }

    // ── La query rispetta l'ordinamento scelto ───────────────────────────────────────────────

    [Fact]
    public async Task Prodotti_SeguonoLOrdinamentoScelto_NonLAlfabeto()
    {
        // I codici sono deliberatamente in ordine alfabetico inverso rispetto a quello voluto:
        // se la query ignorasse `Ordinamento` il test passerebbe per caso con codici allineati.
        SeedProdotto("CAF-ZETA", ordinamento: 1);
        SeedProdotto("CAF-ALFA", ordinamento: 2);
        SeedProdotto("CAF-MIKE", ordinamento: 3);

        string[] codici = await CodiciDalListino();

        codici.Should().Equal("CAF-ZETA", "CAF-ALFA", "CAF-MIKE");
    }

    [Fact]
    public async Task Prodotti_SenzaOrdinamento_RestanoInOrdineDiCodice()
    {
        // 🔴 È il caso del giorno del deploy: nessun prodotto è ancora stato ordinato, tutti
        //    stanno a 0, e la griglia deve presentarsi ESATTAMENTE come prima. Il pareggio su
        //    `Codice` è ciò che lo garantisce; senza, l'ordine fra i pari sarebbe quello che
        //    il database decide di restituire.
        SeedProdotto("CAF-MIKE");
        SeedProdotto("CAF-ALFA");
        SeedProdotto("CAF-ZETA");

        string[] codici = await CodiciDalListino();

        codici.Should().Equal("CAF-ALFA", "CAF-MIKE", "CAF-ZETA");
    }

    [Fact]
    public async Task Prodotti_OrdinatiENonOrdinati_ConvivonoSenzaAmbiguita()
    {
        // Chi non ha un numero resta a 0 e viene prima di chi ne ha uno: è la conseguenza
        // diretta del default, e va vista una volta invece che scoperta al banco.
        SeedProdotto("CAF-ZETA", ordinamento: 5);
        SeedProdotto("CAF-MIKE");
        SeedProdotto("CAF-ALFA");

        string[] codici = await CodiciDalListino();

        codici.Should().Equal("CAF-ALFA", "CAF-MIKE", "CAF-ZETA");
    }

    [Fact]
    public async Task Prodotti_LOrdinamentoValeAncheDentroIlFiltroDiCategoria()
    {
        // La griglia mostra una categoria per volta: è lì che l'ordine si vede davvero.
        SeedProdotto("CAF-ZETA", ordinamento: 1);
        SeedProdotto("CAF-ALFA", ordinamento: 2);
        SeedProdotto("BIB-ALFA", ordinamento: 1, categoria: "BIBITE");

        string[] codici = await CodiciDalListino("CAFETERIA");

        codici.Should().Equal("CAF-ZETA", "CAF-ALFA");
    }

    // ── L'upsert non rimescola la griglia ────────────────────────────────────────────────────

    [Fact]
    public async Task Upsert_SenzaOrdinamento_NonAzzeraQuelloEsistente()
    {
        // 🔴 La trappola dell'int non nullable. `UpsertProdottoAsync` assegna OGNI campo
        //    esplicitamente: se `Ordinamento` fosse un `int` secco nell'input, il primo
        //    salvataggio di prezzo dalla griglia dell'anagrafica lo riporterebbe a 0 — e
        //    l'ordine scelto al banco si perderebbe in silenzio, un prodotto per volta.
        Prodotto prodotto = SeedProdotto("CAF-ESPR", ordinamento: 1);

        await VenditeMutations.UpsertProdottoAsync(_dbContext, new ProdottoInput
        {
            ProdottoId = prodotto.ProdottoId,
            Codice = "CAF-ESPR",
            Nome = "Caffè espresso",
            Prezzo = 1.30m,
            Categoria = "CAFETERIA",
            AliquotaIva = 10m,
            Attivo = true,
        });

        Prodotto salvato = await _dbContext.Prodotti.FirstAsync(p => p.ProdottoId == prodotto.ProdottoId);
        salvato.Ordinamento.Should().Be(1);
        salvato.Prezzo.Should().Be(1.30m, "il resto dell'upsert continua a funzionare");
    }

    [Fact]
    public async Task Upsert_ConOrdinamento_LoPersiste()
    {
        Prodotto prodotto = SeedProdotto("CAF-ESPR", ordinamento: 1);

        await VenditeMutations.UpsertProdottoAsync(_dbContext, new ProdottoInput
        {
            ProdottoId = prodotto.ProdottoId,
            Codice = "CAF-ESPR",
            Nome = "Caffè espresso",
            Prezzo = 1.20m,
            Categoria = "CAFETERIA",
            AliquotaIva = 10m,
            Attivo = true,
            Ordinamento = 7,
        });

        Prodotto salvato = await _dbContext.Prodotti.FirstAsync(p => p.ProdottoId == prodotto.ProdottoId);
        salvato.Ordinamento.Should().Be(7);
    }

    [Fact]
    public async Task Upsert_InCreazioneSenzaOrdinamento_NasceAZero()
    {
        // L'assenza significa «mai ordinato», e mai ordinato vuol dire in coda per codice:
        // un prodotto nuovo non deve scavalcare quelli che qualcuno ha disposto a mano.
        Prodotto creato = await VenditeMutations.UpsertProdottoAsync(_dbContext, new ProdottoInput
        {
            Codice = "CAF-NUOVO",
            Nome = "Prodotto nuovo",
            Prezzo = 1.00m,
            Categoria = "CAFETERIA",
            AliquotaIva = 10m,
            Attivo = true,
        });

        creato.Ordinamento.Should().Be(0);
    }

    // ── Il confine con la vetrina ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Upsert_NonTocaLOrdinamentoDiVetrina()
    {
        // ⚠️ I due ordinamenti sono indipendenti e devono restarlo: disporre le tessere per la
        //    mano non deve riordinare il menu che il cliente legge sul sito.
        Prodotto prodotto = SeedProdotto("CAF-ESPR", ordinamento: 1);
        prodotto.OrdinamentoVetrina = 9;
        await _dbContext.SaveChangesAsync();

        await VenditeMutations.UpsertProdottoAsync(_dbContext, new ProdottoInput
        {
            ProdottoId = prodotto.ProdottoId,
            Codice = "CAF-ESPR",
            Nome = "Caffè espresso",
            Prezzo = 1.20m,
            Categoria = "CAFETERIA",
            AliquotaIva = 10m,
            Attivo = true,
            Ordinamento = 4,
        });

        Prodotto salvato = await _dbContext.Prodotti.FirstAsync(p => p.ProdottoId == prodotto.ProdottoId);
        salvato.Ordinamento.Should().Be(4);
        salvato.OrdinamentoVetrina.Should().Be(9);
    }
}
