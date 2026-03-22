using GraphQL;
using GraphQL.DataLoader;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.GraphQL.DataLoaders;

public static class AuthenticationDataLoaders
{
    public static IDataLoaderResult<Utente?> GetUtenteById(
        this IResolveFieldContext context, int utenteId)
    {
        var loader = context.RequestServices!
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddBatchLoader<int, Utente?>(
                "UtenteById",
                async (IEnumerable<int> ids, CancellationToken ct) =>
                {
                    using var scope = context.RequestServices!
                        .GetRequiredService<IServiceScopeFactory>()
                        .CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var items = await db.Utenti
                        .Include(u => u.Ruolo)
                        .Where(u => ids.Contains(u.Id))
                        .ToListAsync(ct);
                    return items.ToDictionary(u => u.Id, u => (Utente?)u);
                });
        return loader.LoadAsync(utenteId);
    }
}
