using GraphQL.Types;

using duedgusto.GraphQL.Authentication;
using duedgusto.GraphQL.CashManagement;
using duedgusto.GraphQL.Settings;
using duedgusto.GraphQL.Suppliers;
using duedgusto.GraphQL.MonthlyClosures;

namespace duedgusto.GraphQL;

public class GraphQLMutations : ObjectGraphType
{
    public GraphQLMutations()
    {
        Field<AuthMutations>("authentication").Resolve(context => new { });
        Field<CashManagementMutations>("cashManagement").Resolve(context => new { });
        Field<SettingsMutations>("settings").Resolve(context => new { });
        Field<SuppliersMutations>("suppliers").Resolve(context => new { });
        Field<MonthlyClosuresMutations>("monthlyClosures").Resolve(context => new { });
    }
}
