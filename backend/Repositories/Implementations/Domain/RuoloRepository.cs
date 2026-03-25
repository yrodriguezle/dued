using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Repositories.Implementations.Domain;

public class RuoloRepository : Repository<Ruolo>, IRuoloRepository
{
    public RuoloRepository(AppDbContext context) : base(context)
    {
    }
}
