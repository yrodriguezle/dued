using DueD.Models;

namespace DueD.Repositories
{
    public interface IUserRepository : IRepositoryBase<User>
    {
        Task<User?> GetByUsername(string username);
    }
}
