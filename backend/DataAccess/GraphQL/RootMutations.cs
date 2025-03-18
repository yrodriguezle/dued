using GraphQL.Types;

namespace duedgusto.DataAccess.GraphQL;

public class RootMutations : ObjectGraphType
{
    public RootMutations()
    {
        Field<AuthMutations>("authentication").Resolve(context => new { });
    }
}
