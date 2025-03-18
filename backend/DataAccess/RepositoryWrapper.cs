namespace duedgusto.DataAccess;

public interface IRepositoryWrapper
{
    ApplicationDbContext DbContext { get; }
    IUserRepository Users { get; }
}
public class RepositoryWrapper : IRepositoryWrapper
{
    private readonly ApplicationDbContext _context;
    private readonly IUserRepository UserRepository;
    public RepositoryWrapper(ApplicationDbContext Context,
        IUserRepository userRepository)
    {
        _context = Context;
        UserRepository = userRepository;
    }
    public ApplicationDbContext DbContext { get { return _context; } }
    public IUserRepository Users => UserRepository;
}
