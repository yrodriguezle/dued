using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using DueD.DataAccess;

namespace DueD.Repositories
{
    public class Repository : IRepository, IDisposable
    {
        private bool _disposed = false;
        public bool DbContextSingle = false;
        private readonly DataContext _dataContext;
        protected readonly IConfiguration _configuration;

        public IUserRepository User
        {
            get
            {
                return new UserRepository(GetNewDbContext(), _configuration);
            }
        }
        public Repository(DataContext dataContext, IConfiguration configuration)
        {
            _dataContext = dataContext;
            _configuration = configuration;
        }
        public DataContext DbContext
        {
            get { return _dataContext; }
        }
        private DataContext GetNewDbContext()
        {
            if (DbContextSingle)
            {
                return _dataContext;
            }
            return new DataContext(_configuration);
        }
        protected virtual void Dispose(bool disposing)
        {
            if (!_disposed && disposing)
            {
                _dataContext.Dispose();
            }
            _disposed = true;
        }
        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }
        public int Save()
        {
            return _dataContext.SaveChanges();
        }
        public async Task<int> SaveAsync()
        {
            return await _dataContext.SaveChangesAsync();
        }
    }
}
