using GraphQL;
using GraphQL.DataLoader;
using Microsoft.EntityFrameworkCore;
using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.GraphQL.DataLoaders;

public static class VenditeDataLoaders
{
    public static IDataLoaderResult<Prodotto?> GetProdottoById(
        this IResolveFieldContext context, int prodottoId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, Prodotto?> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddBatchLoader<int, Prodotto?>(
                    "ProdottoById",
                    (ids, ct) => LoadProdottiByIds(services, ids, ct));
        return loader.LoadAsync(prodottoId);
    }

    private static async Task<IDictionary<int, Prodotto?>> LoadProdottiByIds(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var idList = ids.ToList();
        List<Prodotto> items = await db.Prodotti
                .Where(p => idList.Contains(p.ProdottoId))
                .ToListAsync(ct);
        var found = items.ToDictionary(p => p.ProdottoId);
        return idList.ToDictionary(
            id => id,
            id => found.TryGetValue(id, out Prodotto? p) ? p : null
        );
    }
}
