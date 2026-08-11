using GraphQL.Validation;

using duedgusto.GraphQL.Validation;

using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Unit.GraphQL;

/// <summary>
/// L'introspezione va spenta fuori dallo sviluppo: /graphql è raggiungibile in anonimo e
/// uno schema introspezionabile regala la mappa completa del gestionale. In sviluppo deve
/// però restare accesa, altrimenti si perdono autocompletamento e strumenti di esplorazione.
/// </summary>
public class NoIntrospectionValidationRuleTests
{
    private static NoIntrospectionValidationRule Rule(string environmentName) =>
        new(new FakeWebHostEnvironment { EnvironmentName = environmentName });

    [Theory]
    [InlineData("Production")]
    [InlineData("Staging")]
    public async Task FuoriDaDevelopment_LaRegolaVisita(string environmentName)
    {
        INodeVisitor? visitor = await Rule(environmentName).GetPreNodeVisitorAsync(null!);

        visitor.Should().NotBeNull(
            $"in ambiente '{environmentName}' l'introspezione deve essere ispezionata e bloccata");
    }

    [Fact]
    public async Task InDevelopment_LaRegolaNonVisita()
    {
        INodeVisitor? visitor = await Rule("Development").GetPreNodeVisitorAsync(null!);

        visitor.Should().BeNull(
            "in sviluppo l'introspezione resta disponibile per gli strumenti di esplorazione dello schema");
    }
}
