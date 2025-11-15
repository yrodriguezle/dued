using GraphQL.Types;

using duedgusto.GraphQL.Authentication;
using duedgusto.GraphQL.CashManagement;

namespace duedgusto.GraphQL;

public class GraphQLMutations : ObjectGraphType
{
    public GraphQLMutations()
    {
        Field<AuthMutations>("authentication").Resolve(context => new { });
        Field<CashManagementMutations>("cashManagement").Resolve(context => new { });
    }
}
