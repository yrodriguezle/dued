using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Repositories.Implementations.Domain;

public class RegistroCassaRepository : Repository<RegistroCassa>, IRegistroCassaRepository
{
    public RegistroCassaRepository(AppDbContext context) : base(context)
    {
    }
}
