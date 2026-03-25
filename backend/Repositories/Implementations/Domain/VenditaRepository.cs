using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Repositories.Implementations.Domain;

public class VenditaRepository : Repository<Vendita>, IVenditaRepository
{
    public VenditaRepository(AppDbContext context) : base(context)
    {
    }
}
