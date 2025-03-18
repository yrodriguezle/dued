using System.Security.Claims;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services;

namespace duedgusto.DataAccess.GraphQL;

public class AuthQueries : ObjectGraphType
{
    public AuthQueries(IJwtService jwtService)
    {
        this.Authorize();
        Field<UserType, User>("authenticatedUser")
            .ResolveAsync(async context =>
            {
                using IServiceScope? scope = context.RequestServices?.CreateScope();
                IServiceProvider? services = scope?.ServiceProvider;
                IRepositoryWrapper? repository = services?.GetRequiredService<IRepositoryWrapper>();
                if (repository == null) return null;

                UserContext? userContext = context.UserContext as UserContext;
                ClaimsPrincipal principal = userContext?.ClaimsPrincipal ?? throw new Exception("No claims");

                int IDUtente = jwtService.GetUserID(principal);
                return await repository.Users.First((x) => x.IDUtente == IDUtente);
            });
    }
}
