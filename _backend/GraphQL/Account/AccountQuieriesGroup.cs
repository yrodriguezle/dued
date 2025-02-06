using GraphQL.Types;

using DueD.Models;
using DueD.Repositories;
using DueD.Services;
using AMICO4forWEB.DataAccess.GraphQL;
using GraphQL.Builders;
using GraphQL.Reflection;
using GraphQL;
using Microsoft.Extensions.Configuration;
using DueD.Helpers;
using GraphQL.DataLoader;

namespace DueD.GraphQL
{
    public class AccountQuieriesGroup : ObjectGraphType
    {
        const int MAX_PAGE_SIZE = 10;

        public AccountQuieriesGroup(Defer<IRepository> repository, Defer<IAuthenticationService> authService, IDataLoaderContextAccessor accessor, IConfiguration configuration, DbService dbService, ILogger<DueDQueries> logger)
        {
            Field<UserType, User>(Name = "currentUser")
                .ResolveAsync(async (context) =>
                {
                    string username = authService.Value.GetUserName();
                    return await repository.Value.User.GetByUsername(username);
                });
            // Users
            Connection<UserType>()
                .Name("users")
                .Argument<StringGraphType>("select", "SQL SELECT clause")
                .Argument<StringGraphType>("join", "SQL JOIN clause")
                .Argument<StringGraphType>("where", "SQL WHERE clause")
                .Argument<StringGraphType>("orderBy", "SQL ORDER BY clause")
                .Argument<StringGraphType>("param", "additional param")
                .Argument<StringGraphType>("typedValue", "valore digitato dall'utente")
                .Bidirectional()
                .PageSize(MAX_PAGE_SIZE)
                .ResolveAsync(async context =>
                {
                    ConnectionArguments sqlModel = new ConnectionArguments
                    {
                        Join = context.GetArgument<string>("join"),
                        Where = context.GetArgument<string>("where"),
                        OrderBy = context.GetArgument<string>("orderBy"),
                        ExceptSubQuery = $"EXCEPT SELECT * FROM Users WHERE UserName = '{Globals.ADMIN_INTERNAL_USER}'",
                    };
                    return await Enumerable.Empty<User>().Connection((ResolveConnectionContext<object>)context, accessor, repository.Value, configuration, sqlModel, dbService, logger);
                });
        }
    }
}
