using GraphQL;
using GraphQL.Types;

using duedgusto.GraphQL.Authentication;
using duedgusto.Services.GraphQL;
using duedgusto.Models;

namespace duedgusto.GraphQL.Management;

public class ManagementQueries : ObjectGraphType
{
    public ManagementQueries()
    {
        Connection<UserType>("users")
            .Argument<StringGraphType>("where")
            .Argument<StringGraphType>("orderBy")
            .Argument<IntGraphType>("cursor")
            .ResolveAsync(async (context) =>
            {
                Connection<User> connection = await GraphQLService.GetConnectionAsync<User>(
                    context,
                    context.GetArgument<string>("where"),
                    context.GetArgument<string>("orderBy"),
                    user =>
                    {
                        return user.UserId.ToString();
                    });
                return connection;
            });
        Connection<MenuType>("menus")
            .Argument<StringGraphType>("where")
            .Argument<StringGraphType>("orderBy")
            .Argument<IntGraphType>("cursor")
            .ResolveAsync(async (context) =>
            {
                Connection<Menu> connection = await GraphQLService.GetConnectionAsync<Menu>(
                    context,
                    context.GetArgument<string>("where"),
                    context.GetArgument<string>("orderBy"),
                    menu =>
                    {
                        return menu.MenuId.ToString();
                    });
                return connection;
            });
        Connection<RoleType>("roles")
            .Argument<StringGraphType>("where")
            .Argument<StringGraphType>("orderBy")
            .Argument<IntGraphType>("cursor")
            .ResolveAsync(async (context) =>
            {
                Connection<Role> connection = await GraphQLService.GetConnectionAsync<Role>(
                    context,
                    context.GetArgument<string>("where"),
                    context.GetArgument<string>("orderBy"),
                    menu =>
                    {
                        return menu.RoleId.ToString();
                    });
                return connection;
            });
    }
}
