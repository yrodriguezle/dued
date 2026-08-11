using System.Security.Claims;

using GraphQL;
using GraphQL.MicrosoftDI;
using GraphQL.Relay.Types;
using GraphQL.Server.Transports.AspNetCore;
using GraphQL.Types;
using GraphQL.Types.Relay;

using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

using duedgusto.GraphQL;
using duedgusto.GraphQL.Authentication;
using duedgusto.GraphQL.Validation;
using duedgusto.Services.Events;

namespace DuedGusto.Tests.Helpers;

/// <summary>
/// Costruisce lo schema GraphQL con lo stesso cablaggio di Program.cs ed esegue query
/// in-process.
///
/// Quasi tutti i test di questo progetto chiamano i resolver o gli orchestrator
/// direttamente, il che è più veloce. Qui serve invece il motore vero, perché
/// l'autorizzazione vive nelle validation rule: saltarle vorrebbe dire testare
/// tutto tranne la cosa che ci interessa.
/// </summary>
public sealed class GraphQLTestHost : IDisposable
{
    private readonly ServiceProvider _provider;

    /// <param name="dbContext">DbContext da esporre ai resolver, se il test ne ha bisogno.</param>
    /// <param name="environmentName">
    /// Ambiente visto da <c>NoIntrospectionValidationRule</c>. Il default è <c>Production</c>,
    /// cioè la configurazione in cui i controlli di sicurezza sono attivi: è quella che i test
    /// devono esercitare per difetto. I test sull'introspezione passano <c>Development</c> per
    /// coprire anche il ramo permissivo.
    /// </param>
    public GraphQLTestHost(AppDbContext? dbContext = null, string environmentName = "Production")
    {
        var services = new ServiceCollection();
        services.AddLogging();
        // Fornisce IAuthorizationService, che AuthorizationValidationRule risolve da RequestServices.
        services.AddAuthorization();
        // Richiesto dal costruttore di NoIntrospectionValidationRule, che decide in base
        // all'ambiente: senza questa registrazione la rule non si costruirebbe.
        services.AddSingleton<IWebHostEnvironment>(
            new FakeWebHostEnvironment { EnvironmentName = environmentName });
        // Richiesto dal costruttore di GraphQLSubscriptions, attivato da GraphQLSchema.
        services.AddSingleton<IEventBus, EventBus>();
        services.AddSingleton(JwtTestHelper.CreateJwtHelper());

        if (dbContext is not null)
        {
            services.AddSingleton(dbContext);
        }

        // Da qui in giù è il cablaggio di Program.cs, da replicare per intero: senza
        // AddGraphTypes i graph type con dipendenze nel costruttore (VenditaType richiede
        // ProdottoType) non si risolvono e lo schema non inizializza.
        services.AddSingleton<ISchema, GraphQLSchema>(sp => new GraphQLSchema(new SelfActivatingServiceProvider(sp)));
        services.AddTransient(typeof(ConnectionType<>));
        services.AddTransient(typeof(EdgeType<>));
        services.AddTransient<NodeInterface>();
        services.AddTransient<PageInfoType>();

        services.AddGraphQL(builder => builder
            .AddSchema<GraphQLSchema>()
            .AddAutoClrMappings()
            // Stessa catena di validation rule di Program.cs: se qui ne mancasse una, i test
            // girerebbero su una pipeline che in produzione non esiste.
            .AddValidationRule<NoIntrospectionValidationRule>()
            .AddSystemTextJson()
            .AddDataLoader()
            .AddAuthorizationRule()
            .AddGraphTypes(typeof(GraphQLSchema).Assembly));

        _provider = services.BuildServiceProvider();
    }

    public GraphQLSchema Schema => (GraphQLSchema)_provider.GetRequiredService<ISchema>();

    /// <summary>Identità vuota: IsAuthenticated == false, cioè una richiesta anonima.</summary>
    public static ClaimsPrincipal Anonimo() => new(new ClaimsIdentity());

    /// <summary>
    /// Principal autenticato. Il claim "UserId" è quello che <c>JwtHelper.GetUserID</c> legge;
    /// l'authenticationType non vuoto è ciò che rende <c>IsAuthenticated</c> true.
    /// </summary>
    public static ClaimsPrincipal Autenticato(int utenteId) =>
        new(new ClaimsIdentity([new Claim("UserId", utenteId.ToString())], "Test"));

    public async Task<ExecutionResult> EseguiAsync(string query, ClaimsPrincipal utente)
    {
        using IServiceScope scope = _provider.CreateScope();

        // L'executer arriva dal container, quindi le validation rule sono quelle registrate
        // da AddAuthorizationRule() — le stesse che girano in produzione, non una lista
        // ricostruita a mano che potrebbe divergere.
        var executer = scope.ServiceProvider.GetRequiredService<IDocumentExecuter<GraphQLSchema>>();
        return await executer.ExecuteAsync(options =>
        {
            options.Query = query;
            options.RequestServices = scope.ServiceProvider;
            options.User = utente;
            options.UserContext = new GraphQLUserContext(
                utente.Identity?.IsAuthenticated == true ? utente : null);
        });
    }

    /// <summary>
    /// Serializza il payload della risposta con il serializer registrato nel container.
    /// Serve per asserire su <b>cosa</b> è stato restituito, non solo sull'assenza di errori:
    /// una query di introspezione ammessa deve davvero riportare i nomi dei tipi.
    /// </summary>
    public string Serializza(ExecutionResult result) =>
        _provider.GetRequiredService<IGraphQLTextSerializer>().Serialize(result);

    public static string Descrivi(ExecutionError errore) =>
        errore.InnerException is null
            ? $"{errore.GetType().Name}: {errore.Message}"
            : $"{errore.GetType().Name}: {errore.Message} <- {errore.InnerException}";

    public static string DescriviErrori(ExecutionResult result) =>
        result.Errors is null or { Count: 0 }
            ? "(nessun errore)"
            : string.Join(" | ", result.Errors.Select(Descrivi));

    public void Dispose() => _provider.Dispose();
}
