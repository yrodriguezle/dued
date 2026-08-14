using System.Text.Json;

using FluentAssertions.Execution;

using GraphQL;

using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Il <b>contratto del cursore</b> del ramo <c>connection</c>, che è una cosa sola: il valore che
/// esce da <c>pageInfo.endCursor</c> deve essere lo stesso valore che si può rimandare dentro come
/// <c>cursor</c>/<c>after</c> per ottenere la pagina successiva.
///
/// <para>🔴 Non è pignoleria di conformità Relay: è il guasto che ha fatto sparire quindici
/// prodotti dalla griglia del gestionale mentre il sito li mostrava tutti. Il server paginava con
/// <c>Skip(offset)</c> ma dichiarava come cursore la <b>chiave primaria</b> dell'ultima riga; il
/// client rimandava indietro quella chiave, e dalla seconda pagina in poi lo <c>Skip</c> saltava a
/// una posizione arbitraria. Su 122 prodotti ordinati per codice, le righe 86-105 non venivano
/// richieste mai — ed erano, per pura coincidenza alfabetica, tutta la cucina.</para>
///
/// <para>⚠️ Il guasto è <b>silenzioso e dipendente dai dati</b>: si manifesta solo quando i record
/// superano la dimensione di pagina e l'ordinamento diverge dall'ordine delle chiavi. Un test che
/// paginasse su righe già ordinate per id passerebbe con il bug dentro. Per questo il dato di
/// questi test è costruito apposta perché l'ordine per <c>Codice</c> <b>non</b> coincida con
/// l'ordine dei <c>ProdottoId</c>.</para>
///
/// <para>⚠️ E si asserisce sull'<b>insieme completo</b>, non su "la prima pagina è giusta": con il
/// bug la prima pagina era corretta, l'ultima pure, e <c>hasNextPage</c> — calcolato su un offset
/// falso — dichiarava la lista finita. La griglia sembrava completa.</para>
/// </summary>
public class PaginazioneConnectionTests : IDisposable
{
    private const int UtenteId = 1;

    private readonly AppDbContext _dbContext;
    private readonly GraphQLTestHost _host;

    public PaginazioneConnectionTests()
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

    /// <summary>
    /// Sette prodotti il cui ordine alfabetico per <c>Codice</c> è il contrario di quello dei
    /// <c>ProdottoId</c>: l'id 1 ha il codice "G", l'id 7 il codice "A". È la forma minima in cui
    /// scambiare cursore e offset produce un salto visibile — con i codici in ordine di id il bug
    /// resterebbe invisibile.
    /// </summary>
    private async Task<IReadOnlyList<string>> SeedSetteProdottiConOrdineInvertito()
    {
        string[] codiciPerId = ["G", "F", "E", "D", "C", "B", "A"];

        _dbContext.Prodotti.AddRange(codiciPerId.Select((codice, indice) => new Prodotto
        {
            Codice = codice,
            Nome = $"Prodotto {codice}",
            Prezzo = 1m + indice,
            Categoria = "CUCINA",
        }));
        await _dbContext.SaveChangesAsync();

        // L'atteso è l'ordine con cui il resolver ordina — per Codice — non quello di inserimento.
        return [.. codiciPerId.OrderBy(codice => codice, StringComparer.Ordinal)];
    }

    private static string QueryProdotti(int primi, int cursore, string argomento = "cursor") =>
        $$"""
        query {
          connection {
            prodotti(first: {{primi}}, {{argomento}}: {{(argomento == "after" ? $"\"{cursore}\"" : cursore.ToString())}}) {
              totalCount
              pageInfo { hasNextPage endCursor startCursor hasPreviousPage }
              edges { cursor node { prodottoId codice } }
            }
          }
        }
        """;

    /// <summary>
    /// Naviga il payload serializzato fino al nodo della connection. Si asserisce sul JSON che il
    /// client riceve davvero, non su un oggetto intermedio: fra i due c'è la serializzazione dei
    /// cursori, che è esattamente il punto in discussione.
    /// </summary>
    private async Task<JsonElement> EseguiELeggiConnection(string query)
    {
        ExecutionResult result = await _host.EseguiAsync(query, GraphQLTestHost.Autenticato(UtenteId));

        result.Errors.Should().BeNullOrEmpty(
            $"la query deve riuscire, invece: {GraphQLTestHost.DescriviErrori(result)}");

        using JsonDocument documento = JsonDocument.Parse(_host.Serializza(result));
        return documento.RootElement
            .GetProperty("data").GetProperty("connection").GetProperty("prodotti")
            .Clone();
    }

    private static IReadOnlyList<string> CodiciDi(JsonElement connection) =>
        [.. connection.GetProperty("edges").EnumerateArray()
            .Select(edge => edge.GetProperty("node").GetProperty("codice").GetString()!)];

    /// <summary>
    /// Il ciclo di <c>useGetAll</c>, riprodotto qui riga per riga: parte da cursore 0, accumula gli
    /// elementi, rimanda indietro <c>endCursor</c> come cursore successivo e si ferma quando
    /// <c>hasNextPage</c> è falso.
    ///
    /// <para>🔴 Non è una semplificazione del client: è <b>il</b> client. Se questo ciclo perde
    /// righe, la griglia perde righe. Il tetto sulle iterazioni protegge solo dal ciclo infinito in
    /// caso di regressione, non fa parte del contratto.</para>
    /// </summary>
    private async Task<IReadOnlyList<string>> ScorriTutteLePagineCome_useGetAll(int dimensionePagina)
    {
        List<string> raccolti = [];
        int cursore = 0;
        bool altrePagine = true;

        while (altrePagine && raccolti.Count <= 100)
        {
            JsonElement connection = await EseguiELeggiConnection(QueryProdotti(dimensionePagina, cursore));
            raccolti.AddRange(CodiciDi(connection));

            JsonElement pageInfo = connection.GetProperty("pageInfo");
            altrePagine = pageInfo.GetProperty("hasNextPage").GetBoolean();
            string? endCursor = pageInfo.GetProperty("endCursor").GetString();
            if (endCursor is null)
            {
                break;
            }
            cursore = int.Parse(endCursor);
        }

        return raccolti;
    }

    /// <summary>
    /// Il test della regressione vera e propria: paginando come fa il gestionale si devono
    /// ottenere <b>tutti</b> i prodotti, ciascuno <b>una volta sola</b>.
    /// </summary>
    [Fact]
    public async Task ScorrendoLePagine_SiOttengonoTuttiIProdottiUnaVoltaSola()
    {
        IReadOnlyList<string> attesi = await SeedSetteProdottiConOrdineInvertito();

        IReadOnlyList<string> raccolti = await ScorriTutteLePagineCome_useGetAll(dimensionePagina: 3);

        using var _ = new AssertionScope();
        raccolti.Should().OnlyHaveUniqueItems(
            "una riga letta due volte comparirebbe doppia in griglia");
        raccolti.Should().BeEquivalentTo(attesi,
            "nessun prodotto deve restare fuori dalla paginazione: è il guasto che nascondeva "
            + "tutta la cucina al gestionale mentre il sito la mostrava");
        raccolti.Should().ContainInOrder(attesi,
            "le pagine si concatenano nell'ordine del resolver, per Codice");
    }

    /// <summary>
    /// La causa, isolata dall'effetto: il cursore emesso è una <b>posizione</b> nella sequenza
    /// ordinata, non la chiave primaria della riga.
    ///
    /// <para>🔴 Questo test è ciò che impedisce di "aggiustare" il bug lato client incrementando il
    /// cursore a mano: il server deve dichiarare un cursore che il server stesso sa rileggere.
    /// I codici sono in ordine inverso rispetto agli id proprio perché i due valori non possano
    /// coincidere per caso.</para>
    /// </summary>
    [Fact]
    public async Task EndCursor_EUnaPosizione_NonLaChiavePrimaria()
    {
        await SeedSetteProdottiConOrdineInvertito();

        JsonElement connection = await EseguiELeggiConnection(QueryProdotti(primi: 3, cursore: 0));

        using var _ = new AssertionScope();
        connection.GetProperty("totalCount").GetInt32().Should().Be(7);
        connection.GetProperty("pageInfo").GetProperty("startCursor").GetString().Should().Be("1",
            "il primo elemento della prima pagina occupa la posizione 1");
        connection.GetProperty("pageInfo").GetProperty("endCursor").GetString().Should().Be("3",
            "dopo tre elementi il cursore vale 3, cioè quanti elementi saltare per la pagina dopo");

        IReadOnlyList<string> cursori =
            [.. connection.GetProperty("edges").EnumerateArray()
                .Select(edge => edge.GetProperty("cursor").GetString()!)];
        cursori.Should().Equal(["1", "2", "3"],
            "anche il cursore del singolo edge è una posizione: un client Relay che rimandasse "
            + "indietro edges.last.cursor deve ottenere la stessa pagina di endCursor");

        IReadOnlyList<int> chiavi =
            [.. connection.GetProperty("edges").EnumerateArray()
                .Select(edge => edge.GetProperty("node").GetProperty("prodottoId").GetInt32())];
        chiavi.Should().Equal([7, 6, 5],
            "il dato è costruito perché la chiave primaria NON coincida con la posizione: senza "
            + "questa divergenza le due asserzioni qui sopra passerebbero anche col bug dentro");
    }

    /// <summary>
    /// I due argomenti di ingresso — <c>cursor</c> (legacy, intero) e <c>after</c> (stringa Relay)
    /// — sono la stessa cosa e devono restare tali: <c>useGetAll</c> usa il primo,
    /// <c>useFetchData</c> il secondo, e una divergenza fra i due romperebbe una metà delle liste
    /// lasciando l'altra sana.
    /// </summary>
    [Fact]
    public async Task CursorEAfter_SonoLoStessoOffset()
    {
        await SeedSetteProdottiConOrdineInvertito();

        JsonElement conCursor = await EseguiELeggiConnection(QueryProdotti(primi: 3, cursore: 3));
        JsonElement conAfter = await EseguiELeggiConnection(QueryProdotti(primi: 3, cursore: 3, argomento: "after"));

        using var _ = new AssertionScope();
        CodiciDi(conCursor).Should().Equal(["D", "E", "F"],
            "saltare 3 elementi su A,B,C,D,E,F,G deve dare la seconda terzina");
        CodiciDi(conAfter).Should().Equal(CodiciDi(conCursor));
        conAfter.GetProperty("pageInfo").GetProperty("endCursor").GetString().Should().Be("6");
    }

    /// <summary>
    /// L'ultima pagina, che con il bug era l'unica a "tornare a posto" per caso: il cursore finale
    /// deve valere il totale, e <c>hasNextPage</c> deve essere falso perché la lista è finita
    /// davvero e non perché un offset sbagliato l'ha superata.
    /// </summary>
    [Fact]
    public async Task UltimaPagina_ChiudeSulTotale()
    {
        await SeedSetteProdottiConOrdineInvertito();

        JsonElement ultima = await EseguiELeggiConnection(QueryProdotti(primi: 3, cursore: 6));

        using var _ = new AssertionScope();
        CodiciDi(ultima).Should().Equal(["G"]);
        ultima.GetProperty("pageInfo").GetProperty("hasNextPage").GetBoolean().Should().BeFalse();
        ultima.GetProperty("pageInfo").GetProperty("hasPreviousPage").GetBoolean().Should().BeTrue();
        ultima.GetProperty("pageInfo").GetProperty("endCursor").GetString().Should().Be("7",
            "il cursore dell'ultimo elemento è la sua posizione, che qui coincide col totale");
    }

    /// <summary>
    /// Una pagina oltre la fine non ha elementi, e quindi non ha cursori: <c>endCursor</c> null è
    /// ciò che fa uscire dal ciclo il client anche se <c>hasNextPage</c> mentisse.
    /// </summary>
    [Fact]
    public async Task PaginaOltreLaFine_NonHaCursori()
    {
        await SeedSetteProdottiConOrdineInvertito();

        JsonElement oltre = await EseguiELeggiConnection(QueryProdotti(primi: 3, cursore: 7));

        using var _ = new AssertionScope();
        CodiciDi(oltre).Should().BeEmpty();
        oltre.GetProperty("pageInfo").GetProperty("endCursor").ValueKind.Should().Be(JsonValueKind.Null);
        oltre.GetProperty("pageInfo").GetProperty("hasNextPage").GetBoolean().Should().BeFalse();
    }
}
