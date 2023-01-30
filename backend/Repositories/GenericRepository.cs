using DueD.DataAccess;

namespace DueD.Repositories
{

    public interface IGenericRepository<TEntity>
    {
        DataContext DbContext { get; }

        IGenericRepository<TEntity> Entity { get; }

        void SaveChanges();
        Task<int> SaveChangesAsync();
    }

    public class GenericRepository<TEntity> : IGenericRepository<TEntity> where TEntity : class
    {
        protected readonly IConfiguration _configuration;
        private DataContext _repoContext;

        public IGenericRepository<TEntity> Entity
        {
            get
            {
                _repoContext = new DataContext(_configuration);
                return new GenericRepository<TEntity>(_repoContext);
            }
        }

        public GenericRepository(IConfiguration configuration, DataContext repositoryContext)
        {
            _configuration = configuration;
            _repoContext = repositoryContext;
        }
        public DataContext DbContext { get { return _repoContext; } }
        public void SaveChanges()
        {
            _repoContext.SaveChanges();
        }
        public async Task<int> SaveChangesAsync()
        {
            return await _repoContext.SaveChangesAsync();
        }
    }
}
