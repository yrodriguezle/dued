using GraphQL.Types;
using Microsoft.Extensions.DependencyInjection;

namespace duedgusto.GraphQL;

public class GraphQLSchema : Schema
{
    public GraphQLSchema(IServiceProvider provider) : base(provider)
    {
        Query = provider.GetRequiredService<GraphQLQueries>();
        Mutation = provider.GetRequiredService<GraphQLMutations>();
    }
}
