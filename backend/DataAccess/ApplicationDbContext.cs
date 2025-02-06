using Microsoft.EntityFrameworkCore;

using duedgusto.Models;

namespace duedgusto.DataAccess;

public class ApplicationDbContext : DbContext
{
    private readonly IConfiguration Configuration;
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options, IConfiguration configuration) : base(options)
    {
        Configuration = configuration;
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Role> Roles { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        if (!optionsBuilder.IsConfigured)
        {
            string connectionString = Configuration.GetConnectionString("Default") ?? string.Empty;
            optionsBuilder.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString));
        }
    }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        // Configurazioni aggiuntive se necessarie (ad esempio relazioni, indici, etc.)
    }
}
