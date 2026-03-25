using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Repositories.Implementations.Domain;

public class UtenteRepository : Repository<Utente>, IUtenteRepository
{
    public UtenteRepository(AppDbContext context) : base(context)
    {
    }
}
