using DueD.DataAccess;

namespace DueD.Repositories
{
    public interface IGenericRepository<TEntity> : IRepositoryBase<TEntity> { }

    public class GenericRepository<TEntity> : RepositoryBase<TEntity>, IGenericRepository<TEntity> where TEntity : class
    {
        private DataContext _dbContext;
        public GenericRepository(DataContext dbContext) : base(dbContext)
        {
            _dbContext = dbContext;
        }
    }

    public interface IGenericRepositoryWrapper<TEntity>
    {
        DataContext DbContext { get; }
        IGenericRepository<TEntity> Entity { get; }
    }

    public class GenericService<TEntity> : IGenericRepositoryWrapper<TEntity> where TEntity : class
    {
        protected readonly IConfiguration _configuration;
        
        private DataContext _dbContext;

        public IGenericRepository<TEntity> Entity
        {
            get
            {
                _dbContext = new DataContext(_configuration);
                return new GenericRepository<TEntity>(_dbContext);
            }
        }
        public GenericService(IConfiguration configuration, DataContext dbContext)
        {
            _configuration = configuration;
            _dbContext = dbContext;
        }
        public DataContext DbContext { get { return _dbContext; } }
    }
}
