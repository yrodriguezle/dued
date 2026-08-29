using GraphQL;
using GraphQL.DataLoader;
using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.GraphQL.DataLoaders;

/// <summary>
/// I caricatori dei subfield di <c>OrdineType</c>.
///
/// <para>🔴 <b>Perché passano tutti da un DataLoader e non da <c>context.Source.Navigazione</c>.</b>
/// Gli ordini si leggono quasi sempre <b>in lista</b> — l'elenco degli aperti, gli ordini di un
/// registro, i figli di uno split — e un subfield risolto con una query per riga significa una
/// query per ordine. Il pattern del progetto è quello della skill sui subfield: ogni campo di
/// navigazione risolve i propri dati da sé, e chi legge una lista li batcha.</para>
///
/// <para>⚠️ Il lazy loading è disabilitato in questo progetto: <c>context.Source.Righe</c> senza un
/// <c>Include</c> a monte risponderebbe con una collezione <b>vuota</b>, non con un errore. È il
/// modo peggiore di sbagliare, perché un ordine senza voci è uno stato legittimo e il client non
/// distingue «non caricato» da «non c'è». Da qui la regola: mai la navigazione, sempre il
/// loader.</para>
/// </summary>
public static class OrdiniDataLoaders
{
    /// <summary>
    /// Le voci di un ordine, ordinate come sono state battute: è l'ordine in cui l'operatore le
    /// ha dette al cliente, e l'unico che si possa rileggere sullo scontrino.
    /// </summary>
    public static IDataLoaderResult<IEnumerable<RigaOrdine>> GetRigheByOrdineId(
        this IResolveFieldContext context, int ordineId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, IEnumerable<RigaOrdine>> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddCollectionBatchLoader<int, RigaOrdine>(
                    "RigheByOrdineId",
                    (ids, ct) => LoadRighe(services, ids, ct));
        return loader.LoadAsync(ordineId);
    }

    /// <summary>I tagli nati da uno split. Collezione vuota su ogni altro ordine.</summary>
    public static IDataLoaderResult<IEnumerable<Ordine>> GetFigliByOrdinePadreId(
        this IResolveFieldContext context, int ordinePadreId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, IEnumerable<Ordine>> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddCollectionBatchLoader<int, Ordine>(
                    "OrdiniFigliByPadreId",
                    (ids, ct) => LoadFigli(services, ids, ct));
        return loader.LoadAsync(ordinePadreId);
    }

    /// <summary>
    /// Il registro a cui l'ordine appartiene.
    ///
    /// <para>🔴 Serve a <c>identificativo</c> e a <c>dataRegistro</c>, e in una lista di ordini
    /// aperti i registri distinti sono pochissimi — spesso uno o due. Senza batch sarebbe una
    /// query per riga per ricavare una data che si ripete.</para>
    /// </summary>
    public static IDataLoaderResult<RegistroCassa?> GetRegistroCassaById(
        this IResolveFieldContext context, int registroCassaId)
    {
        IServiceProvider services = context.RequestServices!;
        IDataLoader<int, RegistroCassa?> loader = services
                .GetRequiredService<IDataLoaderContextAccessor>()
                .Context!
                .GetOrAddBatchLoader<int, RegistroCassa?>(
                    "RegistroCassaById",
                    (ids, ct) => LoadRegistri(services, ids, ct));
        return loader.LoadAsync(registroCassaId);
    }

    private static async Task<ILookup<int, RigaOrdine>> LoadRighe(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var idList = ids.ToList();
        List<RigaOrdine> righe = await db.RigheOrdine
                .Where(r => idList.Contains(r.OrdineId))
                .OrderBy(r => r.DataOra)
                .ThenBy(r => r.RigaOrdineId)
                .ToListAsync(ct);
        return righe.ToLookup(r => r.OrdineId);
    }

    private static async Task<ILookup<int, Ordine>> LoadFigli(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var idList = ids.ToList();
        List<Ordine> figli = await db.Ordini
                .Where(o => o.OrdinePadreId != null && idList.Contains(o.OrdinePadreId.Value))
                .OrderBy(o => o.SuffissoSplit)
                .ToListAsync(ct);
        return figli.ToLookup(o => o.OrdinePadreId!.Value);
    }

    private static async Task<IDictionary<int, RegistroCassa?>> LoadRegistri(
        IServiceProvider services, IEnumerable<int> ids, CancellationToken ct)
    {
        using IServiceScope scope = services.GetRequiredService<IServiceScopeFactory>().CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var idList = ids.ToList();
        List<RegistroCassa> registri = await db.RegistriCassa
                .Where(r => idList.Contains(r.Id))
                .ToListAsync(ct);
        var trovati = registri.ToDictionary(r => r.Id);
        return idList.ToDictionary(
            id => id,
            id => trovati.TryGetValue(id, out RegistroCassa? registro) ? registro : null);
    }
}
