using Microsoft.EntityFrameworkCore;
using DueD.DataAccess;
using DueD.Helpers;
using System.Linq.Expressions;

namespace DueD.Repositories
{
    public class RepositoryBase<T> : IRepositoryBase<T> where T : class
    {
        private readonly DbSet<T> _dbSet;
        protected DataContext _dataContext { get; set; }

        public RepositoryBase(DataContext dataContext)
        {
            _dbSet = dataContext.Set<T>();
            _dataContext = dataContext;
        }

        public async Task<IEnumerable<T>> GetAll()
        {
            return await _dbSet.ToListAsync();
        }
        public async Task<IEnumerable<T>> GetFiltered(Expression<Func<T, bool>> expression)
        {
            return await _dbSet.Where(expression).ToListAsync();
        }
        public async Task<T> AddOrUpdate(T entity)
        {
            T updatedEntity = await EntityFrameworkHelper.AddOrUpdate(entity, _dataContext);
            await _dataContext.SaveChangesAsync();
            return updatedEntity;
        }
        public async Task<T?> Delete(T entity)
        {
            return await EntityFrameworkHelper.Delete(entity, _dataContext);
        }
    }
}
