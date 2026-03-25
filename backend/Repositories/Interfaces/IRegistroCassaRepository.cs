using duedgusto.Models;

namespace duedgusto.Repositories.Interfaces;

/// <summary>
/// Repository per l'aggregato RegistroCassa.
/// Include logica per: conteggi moneta, incassi, spese cassa, pagamenti fornitori.
/// Metodi domain-specific verranno aggiunti durante la migrazione del modulo GestioneCassa.
/// </summary>
public interface IRegistroCassaRepository : IRepository<RegistroCassa>
{
}
