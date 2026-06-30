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

    public static IDataLoaderResult<IEnumerable<int>> GetMenuIdsByRuoloId(this IResolveFieldContext context, int ruoloId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, IEnumerable<int>> loader = services
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddCollectionBatchLoader<int, int>(
                "MenuIdsByRuoloId",
                (ids, ct) => LoadMenuIdsByRuoloIds(services, ids, ct));
        return loader.LoadAsync(ruoloId);
    }

    private static async Task<ILookup<int, int>> LoadMenuIdsByRuoloIds(IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        List<int> idList = [.. ids];
        var pairs = await db.Ruoli
            .Where(r => idList.Contains(r.Id))
            .SelectMany(r => r.Menus.Select(m => new { RuoloId = r.Id, MenuId = m.Id }))
            .ToListAsync(ct);
        return pairs.ToLookup(p => p.RuoloId, p => p.MenuId);
    }

    public static IDataLoaderResult<Ruolo?> GetRuoloById(this IResolveFieldContext context, int ruoloId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, Ruolo?> loader = services
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddBatchLoader<int, Ruolo?>(
                "RuoloById",
                (ids, ct) => LoadRuoliByIds(services, ids, ct));
        return loader.LoadAsync(ruoloId);
    }

    private static async Task<IDictionary<int, Ruolo?>> LoadRuoliByIds(IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        List<int> idList = [.. ids];
        List<Ruolo> items = await db.Ruoli.Where(r => idList.Contains(r.Id)).ToListAsync(ct);
        Dictionary<int, Ruolo> found = items.ToDictionary(r => r.Id);
        return idList.ToDictionary(id => id, id => found.TryGetValue(id, out Ruolo? r) ? r : null);
    }

    public static IDataLoaderResult<IEnumerable<Menu>> GetMenusByRuoloId(this IResolveFieldContext context, int ruoloId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, IEnumerable<Menu>> loader = services
            .GetRequiredService<IDataLoaderContextAccessor>()
            .Context!
            .GetOrAddCollectionBatchLoader<int, Menu>(
                "MenusByRuoloId",
                (ids, ct) => LoadMenusByRuoloIds(services, ids, ct));
        return loader.LoadAsync(ruoloId);
    }

    private static async Task<ILookup<int, Menu>> LoadMenusByRuoloIds(IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        List<int> idList = [.. ids];

        // 2 query totali (non N+1): associazioni ruolo->menu + tutti i menu (tabella piccola)
        var roleMenuIds = await db.Ruoli
            .Where(r => idList.Contains(r.Id))
            .Select(r => new { RuoloId = r.Id, MenuIds = r.Menus.Select(m => m.Id).ToList() })
            .ToListAsync(ct);
        List<Menu> allMenus = await db.Menus.ToListAsync(ct);
        Dictionary<int, Menu> byId = allMenus.ToDictionary(m => m.Id);

        List<(int RuoloId, Menu Menu)> pairs = [];
        foreach (var rm in roleMenuIds)
        {
            HashSet<int> selected = [.. rm.MenuIds];
            // include i menu padre mancanti (per costruire l'albero della sidebar)
            foreach (int mid in rm.MenuIds)
            {
                if (byId.TryGetValue(mid, out Menu? m) && m.MenuPadreId is int pid)
                {
                    selected.Add(pid);
                }
            }
            foreach (Menu m in selected.Where(byId.ContainsKey).Select(i => byId[i]).OrderBy(m => m.Posizione))
            {
                pairs.Add((rm.RuoloId, m));
            }
        }
        return pairs.ToLookup(p => p.RuoloId, p => p.Menu);
    }
}
