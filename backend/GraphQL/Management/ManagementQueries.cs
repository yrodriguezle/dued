using GraphQL.Types;

namespace duedgusto.GraphQL.Management;
using duedgusto.GraphQL.Authentication;

public class ManagementQueries : ObjectGraphType
{
    public ManagementQueries()
    {
        Connection<UserType>()
            .Name("items")
            .PageSize(10)
            .ResolveAsync(async ctx =>
            {
                var loader = accessor.Context.GetOrAddLoader("GetAllItems", repository.GetItems);
                return ConnectionUtils.ToConnection(await loader.LoadAsync().GetResultAsync(), ctx);
            });
    }
}
