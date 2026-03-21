using GraphQL.Types;
using duedgusto.GraphQL.Subscriptions;

namespace duedgusto.GraphQL;

public class GraphQLSchema : Schema
{
    public GraphQLSchema(IServiceProvider provider) : base(provider)
    {
        Query = provider.GetRequiredService<GraphQLQueries>();
        Mutation = provider.GetRequiredService<GraphQLMutations>();
        Subscription = provider.GetRequiredService<GraphQLSubscriptions>();
    }
}
