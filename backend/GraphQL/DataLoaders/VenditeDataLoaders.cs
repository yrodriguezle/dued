using GraphQL;
using GraphQL.DataLoader;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.GraphQL.DataLoaders;

public static class VenditeDataLoaders
{
    public static IDataLoaderResult<Prodotto?> GetProdottoById(
        this IResolveFieldContext context, int prodottoId)
    {
        var loader = context.RequestServices!
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddBatchLoader<int, Prodotto?>(
                "ProdottoById",
                async (IEnumerable<int> ids, CancellationToken ct) =>
                {
                    using var scope = context.RequestServices!
                        .GetRequiredService<IServiceScopeFactory>()
                        .CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var items = await db.Prodotti
                        .Where(p => ids.Contains(p.ProdottoId))
                        .ToListAsync(ct);
                    return items.ToDictionary(p => p.ProdottoId, p => (Prodotto?)p);
                });
        return loader.LoadAsync(prodottoId);
    }
}
