using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Repositories.Implementations.Domain;

public class DocumentoTrasportoRepository(AppDbContext context) : Repository<DocumentoTrasporto>(context), IDocumentoTrasportoRepository
{
}
