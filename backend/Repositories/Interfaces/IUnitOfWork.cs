using duedgusto.DataAccess;

namespace duedgusto.Repositories.Interfaces;

public interface IUnitOfWork : IDisposable
{
    // === Accesso al DbContext ===
    // Per entity satellite senza repository dedicato (es. PagamentiFornitori, DenominazioniMoneta).
    // Usare con parsimonia — preferire i repository tipizzati quando disponibili.
    AppDbContext Context { get; }

    // === Repository di Dominio (lazy-initialized) ===
    // Vedi ADR-2 per la motivazione delle proprieta tipizzate.

    IRegistroCassaRepository RegistriCassa { get; }
    IFornitoreRepository Fornitori { get; }
    IFatturaAcquistoRepository FattureAcquisto { get; }
    IDocumentoTrasportoRepository DocumentiTrasporto { get; }
    IPagamentoFornitoreRepository PagamentiFornitori { get; }
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

    /// <summary>
    /// Esegue <paramref name="operation"/> dentro una transazione esplicita:
    /// begin → operation → commit; in caso di eccezione: rollback + rethrow (eccezione originale, non wrappata).
    /// Se una transazione è già attiva sul DbContext (CurrentTransaction != null),
    /// esegue l'operazione direttamente senza aprirne una nuova (la transazione esterna governa commit/rollback).
    /// </summary>
    Task<T> ExecuteInTransactionAsync<T>(Func<Task<T>> operation);

    /// <summary>
    /// Overload senza valore di ritorno di <see cref="ExecuteInTransactionAsync{T}"/>:
    /// stessa semantica (begin → operation → commit; rollback + rethrow su eccezione;
    /// passthrough se una transazione è già attiva sul DbContext).
    /// </summary>
    Task ExecuteInTransactionAsync(Func<Task> operation);
}
