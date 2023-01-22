using Microsoft.EntityFrameworkCore;
using DueD.DataAccess;
using DueD.Models;
using System.Data.SqlTypes;
using System.Linq.Expressions;

namespace DueD.Repositories
{
    public class UserRepository : RepositoryBase<User>, IUserRepository
    {
        private new readonly DataContext _dataContext;
        public UserRepository(DataContext dataContext, IConfiguration configuration) : base(dataContext)
        {
            _dataContext = dataContext;
        }
        public async Task<User?> GetByUsername(string userName)
        {
            return await _dataContext.Users.FirstOrDefaultAsync((x) => x.UserName == userName);
        }
    }
}
