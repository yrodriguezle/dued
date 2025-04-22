using System.Security.Claims;

using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services.HashPassword;
using duedgusto.Services.Jwt;
using duedgusto.Helpers;

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

        Field<RoleType, Role>("mutateRole")
            .Argument<NonNullGraphType<RoleInputType>>("role", "Dati del ruolo da creare o aggiornare")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                Role input = context.GetArgument<Role>("role");

                Role? existing = await dbContext.Roles.FindAsync(input.RoleId);
                Role updated = await dbContext.AddOrUpdateAsync(input);
                await dbContext.SaveChangesAsync();
                return updated;
            });

        Field<UserType, User>("mutateUser")
            .Argument<NonNullGraphType<UserInputType>>("user", "Dati dell'utente da creare o aggiornare")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                User input = context.GetArgument<User>("user");

                User? existingUser = await dbContext.User.FindAsync(input.UserId);
                User updatedUser = await dbContext.AddOrUpdateAsync(input);
                await dbContext.SaveChangesAsync();
                return updatedUser;
            });
    }
}
