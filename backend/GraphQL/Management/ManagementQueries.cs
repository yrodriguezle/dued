using GraphQL.Types;

using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.GraphQL.Authentication;
using duedgusto.Services.GraphQL;

namespace duedgusto.GraphQL.Management;

public class ManagementQueries : ObjectGraphType
{
    public ManagementQueries()
    {
        Connection<UserType>("users")
            .PageSize(10)
            .ResolveAsync(async (context) =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var loader = accessor.Context.GetOrAddLoader("GetUsers", dbContext.User.ToListAsync);
                return ConnectionUtils.ToConnection(await loader.LoadAsync().GetResultAsync(), context);
            });
    }
}
