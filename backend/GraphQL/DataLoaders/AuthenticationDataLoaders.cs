using GraphQL;
using GraphQL.DataLoader;
using Microsoft.EntityFrameworkCore;
using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.GraphQL.DataLoaders;

public static class AuthenticationDataLoaders
{
    public static IDataLoaderResult<Utente?> GetUtenteById(this IResolveFieldContext context, int utenteId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, Utente?> loader = services
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddBatchLoader<int, Utente?>(
                "UtenteById",
                (ids, ct) => LoadUtentiByIds(services, ids, ct));
        return loader.LoadAsync(utenteId);
    }

    private static async Task<IDictionary<int, Utente?>> LoadUtentiByIds(IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        List<int> idList = [.. ids];
        List<Utente> items = await db.Utenti
            .Include(u => u.Ruolo)
            .Where(u => idList.Contains(u.Id))
            .ToListAsync(ct);
        Dictionary<int, Utente> found = items.ToDictionary(u => u.Id);
        return idList.ToDictionary(
            id => id,
            id => found.TryGetValue(id, out Utente? u) ? u : null
        );
    }
}
