using duedgusto.Models;

namespace duedgusto.Repositories.Interfaces;

/// <summary>
/// Repository per l'aggregato RegistroCassa.
/// Include logica per: conteggi moneta, incassi, spese cassa, pagamenti fornitori.
/// </summary>
public interface IRegistroCassaRepository : IRepository<RegistroCassa>
{
    /// <summary>
    /// Carica il registro per data con ConteggiMoneta, IncassiCassa e SpeseCassa.
    /// </summary>
    Task<RegistroCassa?> GetByDataWithCollectionsAsync(DateTime data);

    /// <summary>
    /// Carica il registro per ID (senza Include — per chiusura).
    /// </summary>
    Task<RegistroCassa?> GetByIdPlainAsync(int id);

    /// <summary>
    /// Carica il registro per ID con ConteggiMoneta, IncassiCassa e SpeseCassa (per eliminazione).
    /// </summary>
    Task<RegistroCassa?> GetByIdWithCollectionsAsync(int id);
}
