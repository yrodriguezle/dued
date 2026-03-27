using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Repositories.Implementations.Domain;

public class PagamentoFornitoreRepository : Repository<PagamentoFornitore>, IPagamentoFornitoreRepository
{
    public PagamentoFornitoreRepository(AppDbContext context) : base(context)
    {
    }
}
