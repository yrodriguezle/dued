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
                IServiceProvider services = GraphQLService.GetIServiceProvider(context);
                AppDbContext dbContext = services.GetService<AppDbContext>() ?? throw new Exception("No service AppDbContext");
                PasswordService passwordService = services.GetService<PasswordService>() ?? throw new Exception("No service PasswordService");
                IJwtService jwtService = services.GetService<IJwtService>() ?? throw new Exception("No service IJwtService");

                string username = context.GetArgument<string>("username");
                string password = context.GetArgument<string>("password");

                User? user = await dbContext.User.FirstOrDefaultAsync((x) => x.UserName == username);
                if (user == null || !passwordService.VerifyPassword(passwordService.HashPassword(password), user.PasswordHash ?? string.Empty))
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
