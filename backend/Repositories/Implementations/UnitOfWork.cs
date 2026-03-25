using Microsoft.EntityFrameworkCore.Storage;

using duedgusto.DataAccess;
using duedgusto.Repositories.Implementations.Domain;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Repositories.Implementations;

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;
    private IDbContextTransaction? _transaction;

    // Backing fields per lazy initialization
    private IRegistroCassaRepository? _registriCassa;
    private IFornitoreRepository? _fornitori;
    private IFatturaAcquistoRepository? _fattureAcquisto;
    private IVenditaRepository? _vendite;
    private IProdottoRepository? _prodotti;
    private IUtenteRepository? _utenti;
    private IChiusuraMensileRepository? _chiusureMensili;
    private IRuoloRepository? _ruoli;
    private IMenuRepository? _menus;
    private IBusinessSettingsRepository? _businessSettings;

    public UnitOfWork(AppDbContext context)
    {
        _context = context;
    }

    // === Repository di Dominio (lazy-initialized) ===

    public IRegistroCassaRepository RegistriCassa =>
        _registriCassa ??= new RegistroCassaRepository(_context);

    public IFornitoreRepository Fornitori =>
        _fornitori ??= new FornitoreRepository(_context);

    public IFatturaAcquistoRepository FattureAcquisto =>
        _fattureAcquisto ??= new FatturaAcquistoRepository(_context);

    public IVenditaRepository Vendite =>
        _vendite ??= new VenditaRepository(_context);

    public IProdottoRepository Prodotti =>
        _prodotti ??= new ProdottoRepository(_context);

    public IUtenteRepository Utenti =>
        _utenti ??= new UtenteRepository(_context);

    public IChiusuraMensileRepository ChiusureMensili =>
        _chiusureMensili ??= new ChiusuraMensileRepository(_context);

    public IRuoloRepository Ruoli =>
        _ruoli ??= new RuoloRepository(_context);

    public IMenuRepository Menus =>
        _menus ??= new MenuRepository(_context);

    public IBusinessSettingsRepository BusinessSettings =>
        _businessSettings ??= new BusinessSettingsRepository(_context);

    // === Persistenza ===

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        => await _context.SaveChangesAsync(cancellationToken);

    // === Transazioni Esplicite ===

    public async Task BeginTransactionAsync()
    {
        _transaction = await _context.Database.BeginTransactionAsync();
    }

    public async Task CommitTransactionAsync()
    {
        if (_transaction != null)
        {
            await _transaction.CommitAsync();
        }
    }

    public async Task RollbackTransactionAsync()
    {
        if (_transaction != null)
        {
            await _transaction.RollbackAsync();
        }
    }

    // === Dispose ===

    public void Dispose()
    {
        _transaction?.Dispose();
        // Non disponiamo AppDbContext — il suo ciclo di vita e gestito da DI
        GC.SuppressFinalize(this);
    }
}
