using GraphQL;
using GraphQL.DataLoader;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.GraphQL.DataLoaders;

public static class GestioneCassaDataLoaders
{
    public static IDataLoaderResult<IEnumerable<ConteggioMoneta>> GetConteggiAperturaByRegistroId(
        this IResolveFieldContext context, int registroId)
    {
        var loader = context.RequestServices!
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddCollectionBatchLoader<int, ConteggioMoneta>(
                "ConteggiAperturaByRegistroId",
                async (IEnumerable<int> ids, CancellationToken ct) =>
                {
                    using var scope = context.RequestServices!
                        .GetRequiredService<IServiceScopeFactory>()
                        .CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var items = await db.ConteggiMoneta
                        .Include(c => c.Denominazione)
                        .Where(c => c.IsApertura && ids.Contains(c.RegistroCassaId))
                        .ToListAsync(ct);
                    return items.ToLookup(c => c.RegistroCassaId);
                });
        return loader.LoadAsync(registroId);
    }

    public static IDataLoaderResult<IEnumerable<ConteggioMoneta>> GetConteggiChiusuraByRegistroId(
        this IResolveFieldContext context, int registroId)
    {
        var loader = context.RequestServices!
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddCollectionBatchLoader<int, ConteggioMoneta>(
                "ConteggiChiusuraByRegistroId",
                async (IEnumerable<int> ids, CancellationToken ct) =>
                {
                    using var scope = context.RequestServices!
                        .GetRequiredService<IServiceScopeFactory>()
                        .CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var items = await db.ConteggiMoneta
                        .Include(c => c.Denominazione)
                        .Where(c => !c.IsApertura && ids.Contains(c.RegistroCassaId))
                        .ToListAsync(ct);
                    return items.ToLookup(c => c.RegistroCassaId);
                });
        return loader.LoadAsync(registroId);
    }

    public static IDataLoaderResult<IEnumerable<SpesaCassa>> GetSpeseByRegistroId(
        this IResolveFieldContext context, int registroId)
    {
        var loader = context.RequestServices!
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddCollectionBatchLoader<int, SpesaCassa>(
                "SpeseByRegistroId",
                async (IEnumerable<int> ids, CancellationToken ct) =>
                {
                    using var scope = context.RequestServices!
                        .GetRequiredService<IServiceScopeFactory>()
                        .CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var items = await db.SpeseCassa
                        .Where(s => ids.Contains(s.RegistroCassaId))
                        .ToListAsync(ct);
                    return items.ToLookup(s => s.RegistroCassaId);
                });
        return loader.LoadAsync(registroId);
    }

    public static IDataLoaderResult<IEnumerable<PagamentoFornitore>> GetPagamentiFornitoriByRegistroId(
        this IResolveFieldContext context, int registroId)
    {
        var loader = context.RequestServices!
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddCollectionBatchLoader<int, PagamentoFornitore>(
                "PagamentiFornitoriByRegistroId",
                async (IEnumerable<int> ids, CancellationToken ct) =>
                {
                    using var scope = context.RequestServices!
                        .GetRequiredService<IServiceScopeFactory>()
                        .CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var items = await db.PagamentiFornitori
                        .Where(p => p.RegistroCassaId.HasValue && ids.Contains(p.RegistroCassaId.Value))
                        .ToListAsync(ct);
                    return items.ToLookup(p => p.RegistroCassaId!.Value);
                });
        return loader.LoadAsync(registroId);
    }
}
