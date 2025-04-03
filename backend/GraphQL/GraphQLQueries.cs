using GraphQL.Types;

using duedgusto.GraphQL.Management;
using duedgusto.GraphQL.Authentication;

namespace duedgusto.GraphQL;

public class GraphQLQueries : ObjectGraphType
{
    public GraphQLQueries()
    {
        Field<AuthQueries>("authentication").Resolve(context => new { });
        Field<ManagementQueries>("management").Resolve(context => new { });
    }
}
