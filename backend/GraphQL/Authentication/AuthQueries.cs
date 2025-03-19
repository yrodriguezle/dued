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
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int userId = jwtService.GetUserID(principal);
                return await dbContext.User.FirstOrDefaultAsync((x) => x.UserId == userId);
            });
    }
}
