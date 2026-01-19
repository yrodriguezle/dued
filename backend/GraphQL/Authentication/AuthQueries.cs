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
        Field<UtenteType, Utente>(Name = "currentUser")
            .ResolveAsync(async (context) =>
            {
                GraphQLUserContext? userContext = context.UserContext as GraphQLUserContext;
                ClaimsPrincipal principal = userContext?.Principal ?? throw new Exception("No claims");
                JwtHelper jwtHelper = GraphQLService.GetService<JwtHelper>(context);
                int userId = jwtHelper.GetUserID(principal);

                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.Utenti.FirstOrDefaultAsync((x) => x.Id == userId);
            });

        Field<UtenteType, Utente>(Name = "utente")
            .Argument<NonNullGraphType<IntGraphType>>("id", "ID dell'utente da recuperare")
            .ResolveAsync(async (context) =>
            {
                int userId = context.GetArgument<int>("id");
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.Utenti
                    .Include(u => u.Ruolo)
                    .FirstOrDefaultAsync((x) => x.Id == userId);
            });

        Field<ListGraphType<UtenteType>, IEnumerable<Utente>>(Name = "utenti")
            .ResolveAsync(async (context) =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.Utenti.ToListAsync();
            });

        Field<RuoloType, Ruolo>(Name = "ruolo")
            .Argument<NonNullGraphType<IntGraphType>>("id", "ID del ruolo da recuperare")
            .ResolveAsync(async (context) =>
            {
                int roleId = context.GetArgument<int>("id");
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.Ruoli
                    .FirstOrDefaultAsync((x) => x.Id == roleId);
            });

        Field<ListGraphType<RuoloType>, IEnumerable<Ruolo>>(Name = "ruoli")
            .ResolveAsync(async (context) =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.Ruoli.ToListAsync();
            });




    }
}
