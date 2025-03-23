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
                JwtHelper jwtHelper = GraphQLService.GetService<JwtHelper>(context);

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
                    new Claim("UserId", user.UserId.ToString()),
                ];

                var (RefreshToken, Token) = jwtHelper.CreateSignedToken(usersClaims);

                user.RefreshToken = RefreshToken;

                await dbContext.SaveChangesAsync();
                return new TokenResponse(Token, RefreshToken);
            });
        Field<TokenResponseType, TokenResponse>("refreshToken")
              .Argument<NonNullGraphType<StringGraphType>>("refreshToken")
              .ResolveAsync(async context =>
              {
                  AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                  JwtHelper jwtHelper = GraphQLService.GetService<JwtHelper>(context);

                  string refreshToken = context.GetArgument<string>("refreshToken");
                  User? user = await dbContext.User.FirstOrDefaultAsync(u => u.RefreshToken == refreshToken);

                  if (user == null)
                  {
                      context.Errors.Add(new ExecutionError("Invalid refresh token"));
                      return null;
                  }
                  Claim[] userClaims = [
                      new Claim(ClaimTypes.Name, user.UserName),
                      new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                      new Claim("UserId", user.UserId.ToString()),
                  ];
                  var (RefreshToken, Token) = jwtHelper.CreateSignedToken(userClaims);
                  user.RefreshToken = RefreshToken;

                  await dbContext.SaveChangesAsync();
                  return new TokenResponse(Token, RefreshToken);
              });
    }
}
