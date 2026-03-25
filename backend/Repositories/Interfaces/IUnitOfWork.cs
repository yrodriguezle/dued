namespace duedgusto.Repositories.Interfaces;

public interface IUnitOfWork : IDisposable
{
    // === Repository di Dominio (lazy-initialized) ===
    // Vedi ADR-2 per la motivazione delle proprieta tipizzate.

    IRegistroCassaRepository RegistriCassa { get; }
    IFornitoreRepository Fornitori { get; }
    IFatturaAcquistoRepository FattureAcquisto { get; }
    IVenditaRepository Vendite { get; }
    IProdottoRepository Prodotti { get; }
    IUtenteRepository Utenti { get; }
    IChiusuraMensileRepository ChiusureMensili { get; }
    IRuoloRepository Ruoli { get; }
    IMenuRepository Menus { get; }
    IBusinessSettingsRepository BusinessSettings { get; }

    // === Persistenza ===

    /// <summary>
    /// Salva tutte le modifiche pendenti in una singola transazione implicita EF Core.
    /// Wrappa AppDbContext.SaveChangesAsync().
    /// </summary>
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    // === Transazioni Esplicite ===

    /// <summary>
    /// Avvia una transazione esplicita. Necessario per operazioni multi-step
    /// come ChiusuraMensileService.CreaChiusuraAsync() che fa due SaveChangesAsync().
    /// </summary>
    Task BeginTransactionAsync();
    Task CommitTransactionAsync();
    Task RollbackTransactionAsync();
}
