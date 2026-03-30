using GraphQL;
using GraphQL.DataLoader;
using Microsoft.EntityFrameworkCore;
using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.GraphQL.DataLoaders;

public static class FornitoriDataLoaders
{
    public static IDataLoaderResult<Fornitore?> GetFornitoreById(
        this IResolveFieldContext context, int fornitoreId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, Fornitore?> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddBatchLoader<int, Fornitore?>(
                    "FornitoreById",
                    (ids, ct) => LoadFornitoriByIds(services, ids, ct));
        return loader.LoadAsync(fornitoreId);
    }

    public static IDataLoaderResult<FatturaAcquisto?> GetFatturaById(
        this IResolveFieldContext context, int fatturaId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, FatturaAcquisto?> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddBatchLoader<int, FatturaAcquisto?>(
                    "FatturaById",
                    (ids, ct) => LoadFattureByIds(services, ids, ct));
        return loader.LoadAsync(fatturaId);
    }

    public static IDataLoaderResult<DocumentoTrasporto?> GetDdtById(
        this IResolveFieldContext context, int ddtId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, DocumentoTrasporto?> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddBatchLoader<int, DocumentoTrasporto?>(
                    "DdtById",
                    (ids, ct) => LoadDdtByIds(services, ids, ct));
        return loader.LoadAsync(ddtId);
    }

    public static IDataLoaderResult<IEnumerable<FatturaAcquisto>> GetFattureByFornitoreId(
        this IResolveFieldContext context, int fornitoreId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, IEnumerable<FatturaAcquisto>> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddCollectionBatchLoader<int, FatturaAcquisto>(
                    "FattureByFornitoreId",
                    (ids, ct) => LoadFattureByFornitoreId(services, ids, ct));
        return loader.LoadAsync(fornitoreId);
    }

    public static IDataLoaderResult<IEnumerable<DocumentoTrasporto>> GetDdtByFornitoreId(
        this IResolveFieldContext context, int fornitoreId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, IEnumerable<DocumentoTrasporto>> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddCollectionBatchLoader<int, DocumentoTrasporto>(
                    "DdtByFornitoreId",
                    (ids, ct) => LoadDdtByFornitoreId(services, ids, ct));
        return loader.LoadAsync(fornitoreId);
    }

    public static IDataLoaderResult<IEnumerable<PagamentoFornitore>> GetPagamentiByFatturaId(
        this IResolveFieldContext context, int fatturaId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, IEnumerable<PagamentoFornitore>> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddCollectionBatchLoader<int, PagamentoFornitore>(
                    "PagamentiByFatturaId",
                    (ids, ct) => LoadPagamentiByFatturaId(services, ids, ct));
        return loader.LoadAsync(fatturaId);
    }

    public static IDataLoaderResult<IEnumerable<PagamentoFornitore>> GetPagamentiByDdtId(
        this IResolveFieldContext context, int ddtId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, IEnumerable<PagamentoFornitore>> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddCollectionBatchLoader<int, PagamentoFornitore>(
                    "PagamentiByDdtId",
                    (ids, ct) => LoadPagamentiByDdtId(services, ids, ct));
        return loader.LoadAsync(ddtId);
    }

    public static IDataLoaderResult<IEnumerable<DocumentoTrasporto>> GetDdtByFatturaId(
        this IResolveFieldContext context, int fatturaId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, IEnumerable<DocumentoTrasporto>> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddCollectionBatchLoader<int, DocumentoTrasporto>(
                    "DdtByFatturaId",
                    (ids, ct) => LoadDdtByFatturaId(services, ids, ct));
        return loader.LoadAsync(fatturaId);
    }

    // --- Batch loaders (single item) ---

    private static async Task<IDictionary<int, Fornitore?>> LoadFornitoriByIds(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var idList = ids.ToList();
        List<Fornitore> items = await db.Fornitori
                .Where(f => idList.Contains(f.FornitoreId))
                .ToListAsync(ct);
        var found = items.ToDictionary(f => f.FornitoreId);
        return idList.ToDictionary(
            id => id,
            id => found.TryGetValue(id, out Fornitore? f) ? f : null
        );
    }

    private static async Task<IDictionary<int, FatturaAcquisto?>> LoadFattureByIds(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var idList = ids.ToList();
        List<FatturaAcquisto> items = await db.FattureAcquisto
                .Where(f => idList.Contains(f.FatturaId))
                .ToListAsync(ct);
        var found = items.ToDictionary(f => f.FatturaId);
        return idList.ToDictionary(
            id => id,
            id => found.TryGetValue(id, out FatturaAcquisto? f) ? f : null
        );
    }

    private static async Task<IDictionary<int, DocumentoTrasporto?>> LoadDdtByIds(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var idList = ids.ToList();
        List<DocumentoTrasporto> items = await db.DocumentiTrasporto
                .Where(d => idList.Contains(d.DdtId))
                .ToListAsync(ct);
        var found = items.ToDictionary(d => d.DdtId);
        return idList.ToDictionary(
            id => id,
            id => found.TryGetValue(id, out DocumentoTrasporto? d) ? d : null
        );
    }

    // --- Collection batch loaders ---

    private static async Task<ILookup<int, FatturaAcquisto>> LoadFattureByFornitoreId(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        List<FatturaAcquisto> items = await db.FattureAcquisto
                .Where(f => ids.Contains(f.FornitoreId))
                .ToListAsync(ct);
        return items.ToLookup(f => f.FornitoreId);
    }

    private static async Task<ILookup<int, DocumentoTrasporto>> LoadDdtByFornitoreId(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        List<DocumentoTrasporto> items = await db.DocumentiTrasporto
                .Where(d => ids.Contains(d.FornitoreId))
                .ToListAsync(ct);
        return items.ToLookup(d => d.FornitoreId);
    }

    private static async Task<ILookup<int, PagamentoFornitore>> LoadPagamentiByFatturaId(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        List<PagamentoFornitore> items = await db.PagamentiFornitori
                .Where(p => p.FatturaId.HasValue && ids.Contains(p.FatturaId.Value))
                .ToListAsync(ct);
        return items.ToLookup(p => p.FatturaId!.Value);
    }

    private static async Task<ILookup<int, PagamentoFornitore>> LoadPagamentiByDdtId(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        List<PagamentoFornitore> items = await db.PagamentiFornitori
                .Where(p => p.DdtId.HasValue && ids.Contains(p.DdtId.Value))
                .ToListAsync(ct);
        return items.ToLookup(p => p.DdtId!.Value);
    }

    private static async Task<ILookup<int, DocumentoTrasporto>> LoadDdtByFatturaId(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        List<DocumentoTrasporto> items = await db.DocumentiTrasporto
                .Where(d => d.FatturaId.HasValue && ids.Contains(d.FatturaId.Value))
                .ToListAsync(ct);
        return items.ToLookup(d => d.FatturaId!.Value);
    }
}
