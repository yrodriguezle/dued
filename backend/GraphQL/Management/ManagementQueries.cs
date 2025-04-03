using Microsoft.EntityFrameworkCore;

using GraphQL.Types;
using GraphQL.Relay.Types;
using GraphQL.Relay.Utilities;  // ✅ IMPORTANTE: Aggiungi questa using directive

using duedgusto.DataAccess;
using duedgusto.GraphQL.Authentication;
using duedgusto.Services.GraphQL;

namespace duedgusto.GraphQL.Management;

public class ManagementQueries : ObjectGraphType
{
    public ManagementQueries()
    {
        Connection<UserType>("users")
            .PageSize(10)
            .ResolveAsync(async (context) =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                // Recupera gli argomenti di paginazione
                var first = context.First;
                var after = context.After;

                // Query base
                var query = dbContext.User.AsQueryable();

                // Se abbiamo un cursore "after", convertiamolo in un ID numerico
                if (!string.IsNullOrEmpty(after))
                {
                    if (int.TryParse(after, out int afterId))
                    {
                        query = query.Where(user => user.UserId > afterId);
                    }
                }

                // Applica paginazione
                var users = await query
                    .OrderBy(user => user.UserId) // Ordinamento necessario per la paginazione
                    .Take(first ?? 10)
                    .ToListAsync();

                // Genera i nodi per GraphQL Relay
                // return users.ToConnection(user => user.UserId.ToString(), context);
                return ConnectionUtils.ToConnection(users, context);
            });
    }
}
