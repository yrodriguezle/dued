using GraphQL;
using GraphQL.DataLoader;
using Microsoft.EntityFrameworkCore;
using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.GraphQL.DataLoaders;

public static class GestioneCassaDataLoaders
{
    public static IDataLoaderResult<IEnumerable<ConteggioMoneta>> GetConteggiAperturaByRegistroId(
        this IResolveFieldContext context, int registroId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, IEnumerable<ConteggioMoneta>> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddCollectionBatchLoader<int, ConteggioMoneta>(
                    "ConteggiAperturaByRegistroId",
                    (ids, ct) => LoadConteggiApertura(services, ids, ct));
        return loader.LoadAsync(registroId);
    }

    public static IDataLoaderResult<IEnumerable<ConteggioMoneta>> GetConteggiChiusuraByRegistroId(
        this IResolveFieldContext context, int registroId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, IEnumerable<ConteggioMoneta>> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddCollectionBatchLoader<int, ConteggioMoneta>(
                    "ConteggiChiusuraByRegistroId",
                    (ids, ct) => LoadConteggiChiusura(services, ids, ct));
        return loader.LoadAsync(registroId);
    }

    public static IDataLoaderResult<IEnumerable<SpesaCassa>> GetSpeseByRegistroId(
        this IResolveFieldContext context, int registroId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, IEnumerable<SpesaCassa>> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddCollectionBatchLoader<int, SpesaCassa>(
                    "SpeseByRegistroId",
                    (ids, ct) => LoadSpese(services, ids, ct));
        return loader.LoadAsync(registroId);
    }

    public static IDataLoaderResult<IEnumerable<RegistroCassaIva>> GetBreakdownIvaByRegistroId(
        this IResolveFieldContext context, int registroId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, IEnumerable<RegistroCassaIva>> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddCollectionBatchLoader<int, RegistroCassaIva>(
                    "BreakdownIvaByRegistroId",
                    (ids, ct) => LoadBreakdownIva(services, ids, ct));
        return loader.LoadAsync(registroId);
    }

    public static IDataLoaderResult<IEnumerable<PagamentoFornitore>> GetPagamentiFornitoriByRegistroId(
        this IResolveFieldContext context, int registroId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, IEnumerable<PagamentoFornitore>> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddCollectionBatchLoader<int, PagamentoFornitore>(
                    "PagamentiFornitoriByRegistroId",
                    (ids, ct) => LoadPagamentiFornitori(services, ids, ct));
        return loader.LoadAsync(registroId);
    }

    private static async Task<ILookup<int, ConteggioMoneta>> LoadConteggiApertura(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        List<ConteggioMoneta> items = await db.ConteggiMoneta
                .Include(c => c.Denominazione)
                .Where(c => c.IsApertura && ids.Contains(c.RegistroCassaId))
                .ToListAsync(ct);
        return items.ToLookup(c => c.RegistroCassaId);
    }

    private static async Task<ILookup<int, ConteggioMoneta>> LoadConteggiChiusura(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        List<ConteggioMoneta> items = await db.ConteggiMoneta
                .Include(c => c.Denominazione)
                .Where(c => !c.IsApertura && ids.Contains(c.RegistroCassaId))
                .ToListAsync(ct);
        return items.ToLookup(c => c.RegistroCassaId);
    }

    private static async Task<ILookup<int, SpesaCassa>> LoadSpese(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        List<SpesaCassa> items = await db.SpeseCassa
                .Where(s => ids.Contains(s.RegistroCassaId))
                .ToListAsync(ct);
        return items.ToLookup(s => s.RegistroCassaId);
    }

    private static async Task<ILookup<int, RegistroCassaIva>> LoadBreakdownIva(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        List<RegistroCassaIva> items = await db.RegistriCassaIva
                .Where(r => ids.Contains(r.RegistroCassaId))
                .OrderByDescending(r => r.Aliquota)
                .ThenBy(r => r.Stimato)
                .ToListAsync(ct);
        return items.ToLookup(r => r.RegistroCassaId);
    }

    private static async Task<ILookup<int, PagamentoFornitore>> LoadPagamentiFornitori(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        List<PagamentoFornitore> items = await db.PagamentiFornitori
                .Where(p => p.RegistroCassaId.HasValue && ids.Contains(p.RegistroCassaId.Value))
                .ToListAsync(ct);
        return items.ToLookup(p => p.RegistroCassaId!.Value);
    }
}
