using System.Data;
using System.Linq.Expressions;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.ChangeTracking;

using duedgusto.Helpers;


namespace duedgusto.DataAccess;

public interface IRepositoryBase<T>
{
    Task<T?> GetByIds(object[] keys);
    IQueryable<T> Filter(Expression<Func<T, bool>> whereExpression);
    Task<IEnumerable<T>> FilterAsync(Expression<Func<T, bool>> whereExpression);
    IQueryable<T> GetBySql(string sql);
    Task<IEnumerable<T>> FilterBySql(string sql);
    Task<T> Save(T entity);
    Task<T?> Delete(T entity);
    Task<T?> First();
    Task<T?> First(Expression<Func<T, bool>> expression);
    Task<T?> Last();
    Task<T?> Last(Expression<Func<T, bool>> expression);
    Task<List<string>> IsDeletable(T entity);
    EntityEntry GetEntityEntry();
}
public abstract class RepositoryBase<T> : IRepositoryBase<T> where T : class
{
    protected readonly DbContext _context;
    public RepositoryBase(DbContext context)
    {
        _context = context;
    }
    public async Task<T?> GetByIds(object[] keys)
    {
        try
        {
            return await _context.Set<T>().FindAsync(keys);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Si è verificato un errore durante GetByIds: {ex.Message}");
            return null;
        }
    }
    private Expression<Func<T, bool>> GenerateLambdaExpression(object idKey)
    {
        IEntityType entityType = _context.Model.FindEntityType(typeof(T))!;
        IKey primaryKey = entityType.FindPrimaryKey()!;
        string keyPropertyName = primaryKey.Properties[0].Name;

        ParameterExpression parameter = Expression.Parameter(typeof(T), "entity");
        MemberExpression property = Expression.Property(parameter, keyPropertyName);
        BinaryExpression equals = Expression.Equal(property, Expression.Constant(idKey));

        return Expression.Lambda<Func<T, bool>>(equals, parameter);
    }
    public IQueryable<T> Filter(Expression<Func<T, bool>> whereExpression) => _context.Set<T>().Where(whereExpression);
    public async Task<IEnumerable<T>> FilterAsync(Expression<Func<T, bool>> whereExpression) => await _context.Set<T>().Where(whereExpression).ToListAsync();
    public IQueryable<T> GetBySql(string sql)
    {
        return _context.Set<T>().FromSqlRaw(sql).AsNoTracking();
    }
    public async Task<IEnumerable<T>> FilterBySql(string sql) => await GetBySql(sql).ToListAsync();
    public async Task<T> Save(T entity)
    {
        T updatedEntity = await EFHelper.AddOrUpdate(entity, _context);
        try
        {
            await _context.SaveChangesAsync();
            return updatedEntity;
        }
        catch (DbUpdateException ex)
        {
            Console.WriteLine("Errore di aggiornamento nel database:");
            Console.WriteLine(ex.Message);

            if (ex.InnerException != null)
            {
                Console.WriteLine($"Dettaglio: {ex.InnerException.Message}");
                if (ex.InnerException.InnerException != null)
                {
                    Console.WriteLine($"Dettaglio interno: {ex.InnerException.InnerException.Message}");
                }
            }

            throw new Exception("Errore durante il salvataggio dell'entità. Vedi log per dettagli.", ex);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Errore generico: {ex.Message}");
            if (ex.InnerException != null)
            {
                Console.WriteLine($"Dettaglio: {ex.InnerException.Message}");
            }

            throw; // Propaga l'errore
        }
    }

    public async Task<T?> Delete(T entity) => await EFHelper.Delete(entity, _context);
    public async Task<T?> First() => await _context.Set<T>().FirstOrDefaultAsync();
    public async Task<T?> First(Expression<Func<T, bool>> expression) => await _context.Set<T>().FirstOrDefaultAsync(expression);
    public async Task<T?> Last() => await _context.Set<T>().OrderByDescending(x => x).FirstOrDefaultAsync();
    public async Task<T?> Last(Expression<Func<T, bool>> expression) => await _context.Set<T>().OrderByDescending(x => x).FirstOrDefaultAsync(expression);
    public async Task<List<string>> IsDeletable(T entity)
    {
        await Task.Delay(0);
        return [];
    }
    public EntityEntry GetEntityEntry()
    {
        T entity = Activator.CreateInstance<T>();
        return _context.Set<T>().Entry(entity);
    }
}
