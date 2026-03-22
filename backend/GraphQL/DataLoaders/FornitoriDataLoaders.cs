using GraphQL;
using GraphQL.DataLoader;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.GraphQL.DataLoaders;

public static class FornitoriDataLoaders
{
    public static IDataLoaderResult<Fornitore?> GetFornitoreById(
        this IResolveFieldContext context, int fornitoreId)
    {
        var loader = context.RequestServices!
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddBatchLoader<int, Fornitore?>(
                "FornitoreById",
                async (IEnumerable<int> ids, CancellationToken ct) =>
                {
                    using var scope = context.RequestServices!
                        .GetRequiredService<IServiceScopeFactory>()
                        .CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var items = await db.Fornitori
                        .Where(f => ids.Contains(f.FornitoreId))
                        .ToListAsync(ct);
                    return items.ToDictionary(f => f.FornitoreId, f => (Fornitore?)f);
                });
        return loader.LoadAsync(fornitoreId);
    }

    public static IDataLoaderResult<FatturaAcquisto?> GetFatturaById(
        this IResolveFieldContext context, int fatturaId)
    {
        var loader = context.RequestServices!
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddBatchLoader<int, FatturaAcquisto?>(
                "FatturaById",
                async (IEnumerable<int> ids, CancellationToken ct) =>
                {
                    using var scope = context.RequestServices!
                        .GetRequiredService<IServiceScopeFactory>()
                        .CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var items = await db.FattureAcquisto
                        .Where(f => ids.Contains(f.FatturaId))
                        .ToListAsync(ct);
                    return items.ToDictionary(f => f.FatturaId, f => (FatturaAcquisto?)f);
                });
        return loader.LoadAsync(fatturaId);
    }

    public static IDataLoaderResult<DocumentoTrasporto?> GetDdtById(
        this IResolveFieldContext context, int ddtId)
    {
        var loader = context.RequestServices!
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddBatchLoader<int, DocumentoTrasporto?>(
                "DdtById",
                async (IEnumerable<int> ids, CancellationToken ct) =>
                {
                    using var scope = context.RequestServices!
                        .GetRequiredService<IServiceScopeFactory>()
                        .CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var items = await db.DocumentiTrasporto
                        .Where(d => ids.Contains(d.DdtId))
                        .ToListAsync(ct);
                    return items.ToDictionary(d => d.DdtId, d => (DocumentoTrasporto?)d);
                });
        return loader.LoadAsync(ddtId);
    }

    public static IDataLoaderResult<IEnumerable<FatturaAcquisto>> GetFattureByFornitoreId(
        this IResolveFieldContext context, int fornitoreId)
    {
        var loader = context.RequestServices!
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddCollectionBatchLoader<int, FatturaAcquisto>(
                "FattureByFornitoreId",
                async (IEnumerable<int> ids, CancellationToken ct) =>
                {
                    using var scope = context.RequestServices!
                        .GetRequiredService<IServiceScopeFactory>()
                        .CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var items = await db.FattureAcquisto
                        .Where(f => ids.Contains(f.FornitoreId))
                        .ToListAsync(ct);
                    return items.ToLookup(f => f.FornitoreId);
                });
        return loader.LoadAsync(fornitoreId);
    }

    public static IDataLoaderResult<IEnumerable<DocumentoTrasporto>> GetDdtByFornitoreId(
        this IResolveFieldContext context, int fornitoreId)
    {
        var loader = context.RequestServices!
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddCollectionBatchLoader<int, DocumentoTrasporto>(
                "DdtByFornitoreId",
                async (IEnumerable<int> ids, CancellationToken ct) =>
                {
                    using var scope = context.RequestServices!
                        .GetRequiredService<IServiceScopeFactory>()
                        .CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var items = await db.DocumentiTrasporto
                        .Where(d => ids.Contains(d.FornitoreId))
                        .ToListAsync(ct);
                    return items.ToLookup(d => d.FornitoreId);
                });
        return loader.LoadAsync(fornitoreId);
    }

    public static IDataLoaderResult<IEnumerable<PagamentoFornitore>> GetPagamentiByFatturaId(
        this IResolveFieldContext context, int fatturaId)
    {
        var loader = context.RequestServices!
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddCollectionBatchLoader<int, PagamentoFornitore>(
                "PagamentiByFatturaId",
                async (IEnumerable<int> ids, CancellationToken ct) =>
                {
                    using var scope = context.RequestServices!
                        .GetRequiredService<IServiceScopeFactory>()
                        .CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var items = await db.PagamentiFornitori
                        .Where(p => p.FatturaId.HasValue && ids.Contains(p.FatturaId.Value))
                        .ToListAsync(ct);
                    return items.ToLookup(p => p.FatturaId!.Value);
                });
        return loader.LoadAsync(fatturaId);
    }

    public static IDataLoaderResult<IEnumerable<PagamentoFornitore>> GetPagamentiByDdtId(
        this IResolveFieldContext context, int ddtId)
    {
        var loader = context.RequestServices!
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddCollectionBatchLoader<int, PagamentoFornitore>(
                "PagamentiByDdtId",
                async (IEnumerable<int> ids, CancellationToken ct) =>
                {
                    using var scope = context.RequestServices!
                        .GetRequiredService<IServiceScopeFactory>()
                        .CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var items = await db.PagamentiFornitori
                        .Where(p => p.DdtId.HasValue && ids.Contains(p.DdtId.Value))
                        .ToListAsync(ct);
                    return items.ToLookup(p => p.DdtId!.Value);
                });
        return loader.LoadAsync(ddtId);
    }

    public static IDataLoaderResult<IEnumerable<DocumentoTrasporto>> GetDdtByFatturaId(
        this IResolveFieldContext context, int fatturaId)
    {
        var loader = context.RequestServices!
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddCollectionBatchLoader<int, DocumentoTrasporto>(
                "DdtByFatturaId",
                async (IEnumerable<int> ids, CancellationToken ct) =>
                {
                    using var scope = context.RequestServices!
                        .GetRequiredService<IServiceScopeFactory>()
                        .CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var items = await db.DocumentiTrasporto
                        .Where(d => d.FatturaId.HasValue && ids.Contains(d.FatturaId.Value))
                        .ToListAsync(ct);
                    return items.ToLookup(d => d.FatturaId!.Value);
                });
        return loader.LoadAsync(fatturaId);
    }
}
