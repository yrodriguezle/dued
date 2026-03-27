using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Repositories.Implementations.Domain;

public class DocumentoTrasportoRepository : Repository<DocumentoTrasporto>, IDocumentoTrasportoRepository
{
    public DocumentoTrasportoRepository(AppDbContext context) : base(context)
    {
    }
}
