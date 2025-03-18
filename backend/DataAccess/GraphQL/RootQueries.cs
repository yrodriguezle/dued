using GraphQL.Types;

namespace duedgusto.DataAccess.GraphQL;

public class RootQueries : ObjectGraphType
{
    public RootQueries()
    {
        Field<AuthQueries>("authentication").Resolve(context => new { });
    }
}
