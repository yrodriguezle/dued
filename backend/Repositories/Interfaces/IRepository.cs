using System.Linq.Expressions;

namespace duedgusto.Repositories.Interfaces;

public interface IRepository<T> where T : class
{
    // === Query ===

    /// <summary>
    /// Recupera un'entita per chiave primaria (supporta chiavi composite).
    /// Usa internamente DbContext.FindAsync().
    /// </summary>
    Task<T?> GetByIdAsync(params object[] keyValues);

    /// <summary>
    /// Recupera tutte le entita. ATTENZIONE: usare con cautela su tabelle grandi.
    /// Usa internamente DbContext.Set&lt;T&gt;().ToListAsync().
    /// </summary>
    Task<IEnumerable<T>> GetAllAsync();

    /// <summary>
    /// Filtra entita con un predicato LINQ.
    /// Usa internamente DbContext.Set&lt;T&gt;().Where(predicate).ToListAsync().
    /// </summary>
    Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate);

    /// <summary>
    /// Espone IQueryable per query complesse (Include, OrderBy, paginazione, etc.).
    /// Vedi ADR-1 per la motivazione.
    /// </summary>
    IQueryable<T> Query();

    /// <summary>
    /// Verifica l'esistenza di almeno un'entita che soddisfa il predicato.
    /// </summary>
    Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate);

    /// <summary>
    /// Conta le entita, opzionalmente filtrate.
    /// </summary>
    Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null);

    // === Commands ===

    /// <summary>
    /// Marca l'entita per inserimento. Il salvataggio effettivo avviene con UnitOfWork.SaveChangesAsync().
    /// </summary>
    void Add(T entity);
    void AddRange(IEnumerable<T> entities);

    /// <summary>
    /// Marca l'entita per aggiornamento.
    /// </summary>
    void Update(T entity);
    void UpdateRange(IEnumerable<T> entities);

    /// <summary>
    /// Marca l'entita per eliminazione.
    /// </summary>
    void Remove(T entity);
    void RemoveRange(IEnumerable<T> entities);

    // === Bulk Operations (da EntityFrameworkHelper) ===

    /// <summary>
    /// Deep merge/upsert di un grafo di entita con sincronizzazione delle navigation properties.
    /// Delega a EntityFrameworkHelper.UpsertEntityGraphAsync().
    /// Usato dai resolver GraphQL per mutation complesse (es. mutateRegistroCassa).
    /// </summary>
    Task<T> UpsertGraphAsync(T entity, IEnumerable<string>? ignoreProperties = null, IEnumerable<string>? forceProperties = null);

    /// <summary>
    /// Confronta incoming vs existing rows per chiave primaria e applica add/update/delete.
    /// Delega a EntityFrameworkHelper.UpdateBulk().
    /// </summary>
    void BulkUpdate(IEnumerable<T> incomingRows, IEnumerable<T> existingRows);
}
