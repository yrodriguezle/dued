using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Repositories.Implementations.Domain;

public class MenuRepository : Repository<Menu>, IMenuRepository
{
    public MenuRepository(AppDbContext context) : base(context)
    {
    }
}
