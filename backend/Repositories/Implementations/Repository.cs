using System.Linq.Expressions;

using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.Helpers;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Repositories.Implementations;

public class Repository<T> : IRepository<T> where T : class
{
    protected readonly AppDbContext _context;
    protected readonly DbSet<T> _dbSet;

    public Repository(AppDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }

    // === Query ===

    public virtual async Task<T?> GetByIdAsync(params object[] keyValues)
        => await _context.FindAsync<T>(keyValues);

    public virtual async Task<IEnumerable<T>> GetAllAsync()
        => await _dbSet.ToListAsync();

    public virtual async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate)
        => await _dbSet.Where(predicate).ToListAsync();

    public virtual IQueryable<T> Query()
        => _dbSet.AsQueryable();

    public virtual async Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate)
        => await _dbSet.AnyAsync(predicate);

    public virtual async Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null)
        => predicate == null
            ? await _dbSet.CountAsync()
            : await _dbSet.CountAsync(predicate);

    // === Commands ===

    public virtual void Add(T entity) => _dbSet.Add(entity);
    public virtual void AddRange(IEnumerable<T> entities) => _dbSet.AddRange(entities);
    public virtual void Update(T entity) => _dbSet.Update(entity);
    public virtual void UpdateRange(IEnumerable<T> entities) => _dbSet.UpdateRange(entities);
    public virtual void Remove(T entity) => _dbSet.Remove(entity);
    public virtual void RemoveRange(IEnumerable<T> entities) => _dbSet.RemoveRange(entities);

    // === Bulk Operations (delegano a EntityFrameworkHelper — vedi ADR-3) ===

    public virtual async Task<T> UpsertGraphAsync(
        T entity,
        IEnumerable<string>? ignoreProperties = null,
        IEnumerable<string>? forceProperties = null)
        => await _context.UpsertEntityGraphAsync(entity, ignoreProperties, forceProperties);

    public virtual void BulkUpdate(IEnumerable<T> incomingRows, IEnumerable<T> existingRows)
        => _context.UpdateBulk(incomingRows, existingRows);
}
