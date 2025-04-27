using GraphQL.Types;

using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;
using duedgusto.Services.GraphQL;

namespace duedgusto.GraphQL.Authentication;

public class RoleType : ObjectGraphType<Role>
{
    public RoleType()
    {
        Name = "Role";
        Description = "Role";
        Field(x => x.RoleId, typeof(IntGraphType));
        Field(x => x.RoleName, typeof(StringGraphType));
        Field(x => x.RoleDescription, typeof(StringGraphType));
        Field<ListGraphType<IntGraphType>>("menuIds")
            .ResolveAsync(async (context) =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.Roles
                    .Where(r => r.RoleId == context.Source.RoleId)
                    .SelectMany(r => r.Menus.Select(m => m.MenuId))
                    .ToListAsync();
            });
    }
}
