using Microsoft.EntityFrameworkCore;

using duedgusto.Models;

namespace duedgusto.DataAccess;

public class AppDbContext : DbContext
{
    private readonly IConfiguration _configuration;
    public AppDbContext(DbContextOptions<AppDbContext> options, IConfiguration configuration) : base(options)
    {
        _configuration = configuration;
    }

    public DbSet<User> User { get; set; }
    public DbSet<Role> Roles { get; set; }
    public DbSet<Menu> Menus { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        if (!optionsBuilder.IsConfigured)
        {
            string connectionString = _configuration.GetConnectionString("Default") ?? string.Empty;
            optionsBuilder.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString));
        }
    }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity
                .ToTable("Users")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey((x) => x.UserId);
            entity.Property(x => x.UserId)
                .ValueGeneratedOnAdd();
            entity.HasOne(x => x.Role)
                .WithMany(r => r.Users)
                .HasForeignKey(x => x.RoleId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("Roles")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.RoleId);
            entity.Property(x => x.RoleId)
                .ValueGeneratedOnAdd();
        });
        modelBuilder.Entity<Role>()
            .HasMany(r => r.Menus)
            .WithMany(m => m.Roles)
            .UsingEntity<Dictionary<string, object>>(
                "RoleMenu",
                j => j.HasOne<Menu>().WithMany().HasForeignKey("MenuId"),
                j => j.HasOne<Role>().WithMany().HasForeignKey("RoleId")
            );
        modelBuilder.Entity<Menu>(entity =>
        {
            entity.ToTable("Menus")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.MenuId);

            entity.Property(x => x.MenuId)
                .ValueGeneratedOnAdd();
            entity.HasOne(m => m.ParentMenu)
                .WithMany(m => m.Children)
                .HasForeignKey(m => m.ParentMenuId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
