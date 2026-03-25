using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Repositories.Implementations.Domain;

public class ProdottoRepository : Repository<Prodotto>, IProdottoRepository
{
    public ProdottoRepository(AppDbContext context) : base(context)
    {
    }
}
