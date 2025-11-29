using GraphQL.Types;

using duedgusto.GraphQL.Authentication;
using duedgusto.GraphQL.Connection;
using duedgusto.GraphQL.CashManagement;
using duedgusto.GraphQL.Settings;

namespace duedgusto.GraphQL;

public class GraphQLQueries : ObjectGraphType
{
    public GraphQLQueries()
    {
        Field<AuthQueries>("authentication").Resolve(context => new { });
        Field<ConnectionQueries>("connection").Resolve(context => new { });
        Field<CashManagementQueries>("cashManagement").Resolve(context => new { });
        Field<SettingsQueries>("settings").Resolve(context => new { });
    }
}
