using System.Security.Claims;

using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.Services.Jwt;
using duedgusto.DataAccess;
using Microsoft.EntityFrameworkCore;

namespace duedgusto.GraphQL.Authentication;

public class AuthQueries : ObjectGraphType
{
    public AuthQueries(IJwtService jwtService)
    {
        Field<UserType, User>(Name = "currentUser")
            .ResolveAsync(async (context) =>
            {
                GraphQLUserContext? userContext = context.UserContext as GraphQLUserContext;
                ClaimsPrincipal principal = userContext?.User ?? throw new Exception("No claims");
                IServiceProvider services = GraphQLService.GetIServiceProvider(context);
                int userId = jwtService.GetUserID(principal);

                AppDbContext dbContext = services.GetService<AppDbContext>() ?? throw new Exception("No service AppDbContext");
                return await dbContext.User.FirstOrDefaultAsync((x) => x.UserId == userId);
            });
    }
}
