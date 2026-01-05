using GraphQL.Types;

using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;
using duedgusto.Services.GraphQL;

namespace duedgusto.GraphQL.Authentication;

public class UserType : ObjectGraphType<User>
{
    public UserType()
    {
        Name = "User";
        Field(x => x.UserId, typeof(IntGraphType));
        Field(x => x.UserName, typeof(StringGraphType));
        Field(x => x.FirstName, typeof(StringGraphType));
        Field(x => x.LastName, typeof(StringGraphType));
        Field(x => x.Description, typeof(StringGraphType));
        Field(x => x.Disabled, typeof(BooleanGraphType));
        Field(x => x.RoleId, typeof(IntGraphType));
        Field<RoleType>("role")
            .ResolveAsync(async (context) =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int roleId = context.Source.RoleId;
                return await dbContext.Roles.FirstOrDefaultAsync(r => r.RoleId == roleId);
            });
        Field<ListGraphType<MenuType>>("menus")
            .ResolveAsync(async (context) =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int roleId = context.Source.RoleId;
                return await dbContext.Menus
                    .Where(m => m.Roles.Any(r => r.RoleId == roleId))
                    .OrderBy(m => m.Position)
                    .ToListAsync();
            });
    }
}
