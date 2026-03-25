using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Repositories.Implementations.Domain;

public class FatturaAcquistoRepository : Repository<FatturaAcquisto>, IFatturaAcquistoRepository
{
    public FatturaAcquistoRepository(AppDbContext context) : base(context)
    {
    }
}
