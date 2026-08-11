using GraphQL;
using GraphQL.Validation;

using duedgusto.GraphQL.Validation;

using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Contratto sull'introspezione dello schema.
///
/// <para>L'endpoint /graphql è montato con <c>AuthorizationRequired = false</c>: uno schema
/// introspezionabile regala a chiunque la mappa completa del gestionale — nomi dei rami, campi,
/// argomenti. Fuori da Development l'introspezione va quindi rifiutata; in Development deve
/// restare accesa, altrimenti si perdono autocompletamento e strumenti di esplorazione.</para>
///
/// <para>A differenza di <c>NoIntrospectionValidationRuleTests</c>, che ispeziona la regola in
/// isolamento, qui le query di introspezione vengono <b>eseguite davvero</b> attraverso il motore
/// GraphQL con la stessa catena di validation rule di produzione: è l'unico modo per osservare il
/// blocco effettivo e il codice d'errore invece del solo cablaggio.</para>
/// </summary>
public class IntrospezioneTests
{
    /// <summary>
    /// Identificatore dell'errore richiesto dalla spec. In GraphQL.NET finisce in
    /// <see cref="ValidationError.Number"/>, che è il parametro a cui
    /// <c>NoIntrospectionError</c> lo passa.
    /// </summary>
    private const string NumeroAtteso = "INTROSPEZIONE_DISABILITATA";

    /// <summary>
    /// <see cref="ExecutionError.Code"/> non è l'identificatore scritto nella rule: GraphQL.NET
    /// lo deriva dal nome della classe (<c>NoIntrospectionError</c> → <c>NO_INTROSPECTION</c>).
    /// È asserito per pinnare il contratto realmente osservabile dal client: se un domani
    /// qualcuno valorizzasse <c>Code</c> a mano, questo test lo intercetta e obbliga ad
    /// allineare anche la spec.
    /// </summary>
    private const string CodiceDerivato = "NO_INTROSPECTION";

    private const string QuerySchema = "query { __schema { types { name } } }";

    /// <remarks>
    /// Su un input object i campi stanno in <c>inputFields</c>: <c>fields</c> è null per
    /// definizione, quindi non proverebbe nulla nel caso permesso.
    /// </remarks>
    private const string QueryType =
        """query { __type(name: "UtenteInput") { name inputFields { name } } }""";

    /// <summary>
    /// L'introspezione non dipende dall'autenticazione: la si esegue autenticati perché un
    /// eventuale <c>AccessDeniedError</c> non possa essere scambiato per il blocco che si vuole
    /// osservare.
    /// </summary>
    private static async Task<ExecutionResult> EseguiAsync(string query, string ambiente)
    {
        using var host = new GraphQLTestHost(environmentName: ambiente);
        return await host.EseguiAsync(query, GraphQLTestHost.Autenticato(1));
    }

    private static void AssertBloccata(ExecutionResult result, string ambiente)
    {
        result.Errors.Should().NotBeNullOrEmpty(
            $"in ambiente '{ambiente}' l'introspezione deve essere rifiutata — "
            + "la regola non è registrata nella catena di validazione?");

        ValidationError errore = result.Errors!.OfType<ValidationError>()
            .FirstOrDefault(e => e is NoIntrospectionError)!;

        errore.Should().NotBeNull(
            "il rifiuto deve venire dalla regola sull'introspezione, non da un errore generico "
            + "— errori: " + GraphQLTestHost.DescriviErrori(result));

        errore.Number.Should().Be(NumeroAtteso,
            "è l'identificatore che la spec impone per distinguere questo rifiuto");

        errore.Code.Should().Be(CodiceDerivato,
            "GraphQL.NET deriva Code dal nome della classe di errore");

        result.Data.Should().BeNull(
            "il rifiuto avviene in fase di validazione, quindi nessun dato dello schema "
            + "viene prodotto");
    }

    #region Scenario: Introspezione in produzione

    [Theory]
    [InlineData("Production")]
    [InlineData("Staging")]
    public async Task FuoriDaDevelopment_QuerySchema_Bloccata(string ambiente)
    {
        ExecutionResult result = await EseguiAsync(QuerySchema, ambiente);

        AssertBloccata(result, ambiente);
    }

    #endregion

    #region Scenario: Introspezione puntuale su un tipo in produzione

    [Theory]
    [InlineData("Production")]
    [InlineData("Staging")]
    public async Task FuoriDaDevelopment_QueryType_Bloccata(string ambiente)
    {
        ExecutionResult result = await EseguiAsync(QueryType, ambiente);

        AssertBloccata(result, ambiente);
    }

    #endregion

    #region Scenario: Introspezione in Development

    [Fact]
    public async Task InDevelopment_QuerySchema_RestituisceLoSchema()
    {
        using var host = new GraphQLTestHost(environmentName: "Development");
        ExecutionResult result = await host.EseguiAsync(QuerySchema, GraphQLTestHost.Autenticato(1));

        result.Errors.Should().BeNullOrEmpty(
            "in sviluppo l'introspezione resta disponibile — errori: "
            + GraphQLTestHost.DescriviErrori(result));

        host.Serializza(result).Should().Contain("UtenteInput",
            "la risposta deve contenere davvero i nomi dei tipi, non solo essere priva di errori");
    }

    [Fact]
    public async Task InDevelopment_QueryType_RestituisceICampiDelTipo()
    {
        using var host = new GraphQLTestHost(environmentName: "Development");
        ExecutionResult result = await host.EseguiAsync(QueryType, GraphQLTestHost.Autenticato(1));

        result.Errors.Should().BeNullOrEmpty(
            "in sviluppo l'introspezione resta disponibile — errori: "
            + GraphQLTestHost.DescriviErrori(result));

        host.Serializza(result).Should().Contain("nomeUtente",
            "l'introspezione puntuale deve rivelare davvero i campi di UtenteInput");
    }

    #endregion

    #region Scenario: __typename resta disponibile

    /// <summary>
    /// <c>__typename</c> non espone la mappa dello schema ed è usato dalle librerie client e dal
    /// test di contratto sull'autorizzazione (che seleziona <c>__typename</c> su ogni ramo root).
    /// Se la regola iniziasse a intercettarlo per prefisso invece che per nome esatto, questo test
    /// e l'intera <c>AutorizzazioneAnonimaTests</c> diventerebbero rossi.
    /// </summary>
    [Theory]
    [InlineData("Production")]
    [InlineData("Staging")]
    [InlineData("Development")]
    public async Task Typename_NonBloccatoInNessunAmbiente(string ambiente)
    {
        using var host = new GraphQLTestHost(environmentName: ambiente);
        ExecutionResult result = await host.EseguiAsync(
            "query { __typename }", GraphQLTestHost.Autenticato(1));

        result.Errors.Should().BeNullOrEmpty(
            $"in ambiente '{ambiente}' __typename non deve essere bloccato — errori: "
            + GraphQLTestHost.DescriviErrori(result));

        host.Serializza(result).Should().Contain("__typename");
    }

    #endregion
}
