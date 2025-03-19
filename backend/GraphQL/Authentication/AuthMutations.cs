using System.Security.Claims;

using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services.HashPassword;
using duedgusto.Services.Jwt;

namespace duedgusto.GraphQL.Authentication;

public class AuthMutations : ObjectGraphType
{
    public AuthMutations()
    {
        Field<TokenResponseType, TokenResponse>("signIn")
            .Argument<NonNullGraphType<StringGraphType>>("username")
            .Argument<NonNullGraphType<StringGraphType>>("password")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                IJwtService jwtService = GraphQLService.GetService<IJwtService>(context);

                string username = context.GetArgument<string>("username");
                string password = context.GetArgument<string>("password");
                User? user = await dbContext.User.FirstOrDefaultAsync((x) => x.UserName == username);
                if (user == null || !PasswordService.VerifyPassword(password, user.Hash, user.Salt))
                {
                    return null;
                }

                Claim[] usersClaims = [
                    new Claim(ClaimTypes.Name, user.UserName),
                    new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                    new Claim("userId", user.UserId.ToString()),
                ];
                string jwtToken = jwtService.GenerateAccessToken(usersClaims);
                string jwtRefreshToken = jwtService.GenerateRefreshToken();
                user.RefreshToken = jwtRefreshToken;

                await dbContext.SaveChangesAsync();
                return new TokenResponse(jwtToken, jwtRefreshToken);
            });
    }
}
