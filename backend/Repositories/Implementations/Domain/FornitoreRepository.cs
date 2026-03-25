using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Repositories.Implementations.Domain;

public class FornitoreRepository : Repository<Fornitore>, IFornitoreRepository
{
    public FornitoreRepository(AppDbContext context) : base(context)
    {
    }
}
