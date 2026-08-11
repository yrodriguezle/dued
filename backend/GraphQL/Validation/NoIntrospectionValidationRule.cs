using GraphQL.Validation;

using GraphQLParser;
using GraphQLParser.AST;

namespace duedgusto.GraphQL.Validation;

public class NoIntrospectionError : ValidationError
{
    public NoIntrospectionError(ROM originalQuery, ASTNode node)
        : base(originalQuery, "INTROSPEZIONE_DISABILITATA",
            "L'introspezione dello schema non è disponibile in questo ambiente.", node)
    {
    }
}

/// <summary>
/// Blocca le query di introspezione (<c>__schema</c>, <c>__type</c>) fuori dallo sviluppo.
///
/// Non è una vulnerabilità di per sé, ma l'endpoint /graphql è raggiungibile in anonimo
/// (<c>AuthorizationRequired = false</c>) e lo schema introspezionabile regala a chiunque
/// la mappa completa del gestionale: nomi dei rami, campi, argomenti. In sviluppo resta
/// attiva, altrimenti si perdono autocompletamento e strumenti di esplorazione.
/// </summary>
public class NoIntrospectionValidationRule : ValidationRuleBase
{
    private readonly bool _attiva;
    private readonly MatchingNodeVisitor<GraphQLField> _visitor;

    public NoIntrospectionValidationRule(IWebHostEnvironment environment)
    {
        _attiva = !environment.IsDevelopment();
        _visitor = new MatchingNodeVisitor<GraphQLField>((field, context) =>
        {
            if (field.Name.Value == "__schema" || field.Name.Value == "__type")
            {
                context.ReportError(new NoIntrospectionError(context.Document.Source, field));
            }
        });
    }

    public override ValueTask<INodeVisitor?> GetPreNodeVisitorAsync(ValidationContext context) =>
        _attiva ? new ValueTask<INodeVisitor?>(_visitor) : default;
}
