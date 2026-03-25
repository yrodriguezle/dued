using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Repositories.Implementations.Domain;

public class ChiusuraMensileRepository : Repository<ChiusuraMensile>, IChiusuraMensileRepository
{
    public ChiusuraMensileRepository(AppDbContext context) : base(context)
    {
    }
}
