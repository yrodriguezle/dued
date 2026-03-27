using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Repositories.Implementations.Domain;

public class RegistroCassaRepository : Repository<RegistroCassa>, IRegistroCassaRepository
{
    public RegistroCassaRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<RegistroCassa?> GetByDataWithCollectionsAsync(DateTime data)
    {
        return await _context.RegistriCassa
            .Include(r => r.ConteggiMoneta)

            .Include(r => r.SpeseCassa)
            .FirstOrDefaultAsync(r => r.Data.Date == data.Date);
    }

    public async Task<RegistroCassa?> GetByIdPlainAsync(int id)
    {
        return await _context.RegistriCassa
            .FirstOrDefaultAsync(r => r.Id == id);
    }

    public async Task<RegistroCassa?> GetByIdWithCollectionsAsync(int id)
    {
        return await _context.RegistriCassa
            .Include(r => r.ConteggiMoneta)

            .Include(r => r.SpeseCassa)
            .FirstOrDefaultAsync(r => r.Id == id);
    }
}
