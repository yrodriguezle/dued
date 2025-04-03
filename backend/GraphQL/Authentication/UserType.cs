using GraphQL;
using GraphQL.Types;
using GraphQL.Relay.Types;

using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;
using duedgusto.Services.GraphQL;

namespace duedgusto.GraphQL.Authentication;

public class UserType : AsyncNodeGraphType<User>
{
    public UserType()
    {
        Name = "User";
        Id(x => x.UserId);
        Field(x => x.UserName, typeof(StringGraphType));
        Field(x => x.FirstName, typeof(StringGraphType));
        Field(x => x.LastName, typeof(StringGraphType));
        Field(x => x.Description, typeof(StringGraphType));
        Field(x => x.Disabled, typeof(BooleanGraphType));
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
                    .ToListAsync();
            });
    }

    public override async Task<User> GetById(IResolveFieldContext<object> context, string id)
    {
        AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
        return await dbContext.User.FirstAsync((x) => x.UserId == Convert.ToInt32(id));
    }
}
