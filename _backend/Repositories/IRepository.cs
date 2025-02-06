using Microsoft.EntityFrameworkCore;

using DueD.DataAccess;
using DueD.Models;

namespace DueD.Repositories
{
    public interface IRepository
    {
        DataContext DbContext { get; }
        IUserRepository User { get; }
        int Save();
        Task<int> SaveAsync();
    }
}
