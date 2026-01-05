using System.Security.Claims;

using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.Services.Jwt;

namespace duedgusto.GraphQL.Authentication;

public class AuthQueries : ObjectGraphType
{
    public AuthQueries()
    {
        this.Authorize();
        Field<UserType, User>(Name = "currentUser")
            .ResolveAsync(async (context) =>
            {
                GraphQLUserContext? userContext = context.UserContext as GraphQLUserContext;
                ClaimsPrincipal principal = userContext?.User ?? throw new Exception("No claims");
                JwtHelper jwtHelper = GraphQLService.GetService<JwtHelper>(context);
                int userId = jwtHelper.GetUserID(principal);

                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.User.FirstOrDefaultAsync((x) => x.UserId == userId);
            });

        Field<UserType, User>(Name = "user")
            .Argument<NonNullGraphType<IntGraphType>>("userId", "ID dell'utente da recuperare")
            .ResolveAsync(async (context) =>
            {
                int userId = context.GetArgument<int>("userId");
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.User
                    .Include(u => u.Role)
                    .FirstOrDefaultAsync((x) => x.UserId == userId);
            });
    }
}
