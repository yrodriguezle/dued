using GraphQL;
using GraphQL.Server.Transports.AspNetCore.Errors;

using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Contratto di autorizzazione dello schema GraphQL.
///
/// L'endpoint /graphql è montato con <c>AuthorizationRequired = false</c> (Program.cs): la
/// protezione è interamente per-campo, quindi un modulo che nasce senza <c>this.Authorize()</c>
/// è pubblico per default. È già successo: <c>AuthMutations</c> esponeva <c>mutateUtente</c>
/// in anonimo, permettendo di riscrivere Hash e Salt del superadmin e poi accedere da
/// /api/auth/signin.
///
/// Questi test enumerano i rami root <b>dallo schema</b>, non da una lista scritta a mano:
/// un modulo aggiunto domani è coperto automaticamente e rompe la CI se dimentica
/// l'autorizzazione.
///
/// Se un ramo deve davvero essere raggiungibile senza login, NON aggiungerlo a un'allowlist
/// qui: esponilo come endpoint REST sotto /api/public/*, dove la superficie è chiusa per
/// costruzione invece che aperta per default.
/// </summary>
public class AutorizzazioneAnonimaTests
{
    private static IEnumerable<object[]> NomiCampiRoot(Func<GraphQLTestHost, IEnumerable<string>> selettore)
    {
        using var host = new GraphQLTestHost();
        return selettore(host).Select(nome => new object[] { nome }).ToList();
    }

    public static IEnumerable<object[]> RamiQuery() =>
        NomiCampiRoot(host => host.Schema.Query!.Fields.Select(f => f.Name));

    public static IEnumerable<object[]> RamiMutation() =>
        NomiCampiRoot(host => host.Schema.Mutation!.Fields.Select(f => f.Name));

    public static IEnumerable<object[]> RamiSubscription() =>
        NomiCampiRoot(host => host.Schema.Subscription!.Fields.Select(f => f.Name));

    private static void AssertAccessoNegato(ExecutionResult result, string ramo)
    {
        result.Errors.Should().NotBeNullOrEmpty(
            $"il ramo root '{ramo}' risponde in anonimo: manca this.Authorize() nella classe che lo implementa");

        result.Errors!.Any(errore => errore is AccessDeniedError).Should().BeTrue(
            $"il ramo root '{ramo}' fallisce in anonimo ma non per autorizzazione — errori: "
            + GraphQLTestHost.DescriviErrori(result));
    }

    [Theory]
    [MemberData(nameof(RamiQuery))]
    public async Task OgniRamoQuery_InAnonimo_NegaAccesso(string ramo)
    {
        using var host = new GraphQLTestHost();
        ExecutionResult result = await host.EseguiAsync(
            $"query {{ {ramo} {{ __typename }} }}", GraphQLTestHost.Anonimo());

        AssertAccessoNegato(result, $"Query.{ramo}");
    }

    [Theory]
    [MemberData(nameof(RamiMutation))]
    public async Task OgniRamoMutation_InAnonimo_NegaAccesso(string ramo)
    {
        using var host = new GraphQLTestHost();
        ExecutionResult result = await host.EseguiAsync(
            $"mutation {{ {ramo} {{ __typename }} }}", GraphQLTestHost.Anonimo());

        AssertAccessoNegato(result, $"Mutation.{ramo}");
    }

    /// <summary>
    /// Il ramo Subscription è protetto in un punto diverso dagli altri due: in Query e Mutation
    /// ogni campo root ha per tipo un modulo che porta <c>this.Authorize()</c>, mentre qui i campi
    /// stanno direttamente su <c>GraphQLSubscriptions</c>, che è il tipo autorizzato. La copertura
    /// resta comunque per campo e derivata dallo schema: una subscription aggiunta domani entra da
    /// sola in questa Theory, e se qualcuno togliesse l'autorizzazione dal tipo la CI rompe qui.
    /// </summary>
    [Theory]
    [MemberData(nameof(RamiSubscription))]
    public async Task OgniRamoSubscription_InAnonimo_NegaAccesso(string ramo)
    {
        using var host = new GraphQLTestHost();
        ExecutionResult result = await host.EseguiAsync(
            $"subscription {{ {ramo} {{ __typename }} }}", GraphQLTestHost.Anonimo());

        AssertAccessoNegato(result, $"Subscription.{ramo}");
    }

    [Fact]
    public void SchemaEspone_TuttiIRamiRootAttesi()
    {
        // Se questo test fallisce è perché un ramo root è stato aggiunto o rinominato.
        // Aggiornare l'elenco è corretto; farlo senza aver verificato che il nuovo ramo
        // abbia this.Authorize() non lo è — ci pensano le tre Theory qui sopra.
        using var host = new GraphQLTestHost();

        host.Schema.Query!.Fields.Select(f => f.Name).Should().BeEquivalentTo(
            "authentication", "connection", "gestioneCassa", "vendite",
            "settings", "fornitori", "chiusureMensili");

        host.Schema.Mutation!.Fields.Select(f => f.Name).Should().BeEquivalentTo(
            "authentication", "gestioneCassa", "vendite",
            "settings", "fornitori", "chiusureMensili", "vetrina");

        host.Schema.Subscription!.Fields.Select(f => f.Name).Should().BeEquivalentTo(
            "onRegistroCassaUpdated", "onVenditaCreated",
            "onChiusuraCassaCompleted", "onSettingsUpdated");
    }

    /// <summary>
    /// Regressione puntuale sull'escalation reale: un anonimo riscriveva la password di un
    /// utente esistente passando il suo id, e poi entrava da /api/auth/signin.
    /// </summary>
    [Fact]
    public async Task MutateUtente_InAnonimo_NonPuoResettareLaPassword()
    {
        using var host = new GraphQLTestHost();
        ExecutionResult result = await host.EseguiAsync(
            """
            mutation {
              authentication {
                mutateUtente(utente: {
                  id: 1, nomeUtente: "superadmin", nome: "x", cognome: "y",
                  ruoloId: 1, password: "pwned"
                }) { id }
              }
            }
            """,
            GraphQLTestHost.Anonimo());

        AssertAccessoNegato(result, "Mutation.authentication.mutateUtente");
    }
}
