using GraphQL.Types;

namespace duedgusto.DataAccess.GraphQL;

public class AppSchema : Schema
{
    public AppSchema(IServiceProvider provider) : base(provider)
    {
        Query = provider.GetRequiredService<RootQueries>();
        Mutation = provider.GetRequiredService<RootMutations>();
    }
}
