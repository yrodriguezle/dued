using GraphQL.Types;

using duedgusto.GraphQL.Authentication;
using duedgusto.GraphQL.Connection;
using duedgusto.GraphQL.CashManagement;

namespace duedgusto.GraphQL;

public class GraphQLQueries : ObjectGraphType
{
    public GraphQLQueries()
    {
        Field<AuthQueries>("authentication").Resolve(context => new { });
        Field<ConnectionQueries>("connection").Resolve(context => new { });
        Field<CashManagementQueries>("cashManagement").Resolve(context => new { });
    }
}
