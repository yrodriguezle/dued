using System.Linq.Expressions;

namespace DueD.Repositories
{
    public interface IRepositoryBase<T>
    {
        Task<IEnumerable<T>> GetAll();
        Task<IEnumerable<T>> GetFiltered(Expression<Func<T, bool>> expression);
        Task<IEnumerable<T>> GetBySqlAsync(string sql);
        Task<T> AddOrUpdate(T entity);
        Task<T?> Delete(T entity);
    }
}
