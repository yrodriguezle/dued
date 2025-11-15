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

    // Cash Management
    public DbSet<CashDenomination> CashDenominations { get; set; }
    public DbSet<CashRegister> CashRegisters { get; set; }
    public DbSet<CashCount> CashCounts { get; set; }

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
                .HasKey(x => x.UserId);

            entity.Property(x => x.UserId)
                .ValueGeneratedOnAdd();

            entity.HasOne(x => x.Role)
                .WithMany(r => r.Users)
                .HasForeignKey(x => x.RoleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity
                .ToTable("Roles")
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
                j => j.HasOne<Menu>()
                      .WithMany()
                      .HasForeignKey("MenuId")
                      .OnDelete(DeleteBehavior.Cascade),
                j => j.HasOne<Role>()
                      .WithMany()
                      .HasForeignKey("RoleId")
                      .OnDelete(DeleteBehavior.Cascade)
            );

        modelBuilder.Entity<Menu>(entity =>
        {
            entity
                .ToTable("Menus")
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

        // Cash Management Configuration
        modelBuilder.Entity<CashDenomination>(entity =>
        {
            entity
                .ToTable("CashDenominations")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.DenominationId);

            entity.Property(x => x.DenominationId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Value)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.Type)
                .HasMaxLength(10)
                .IsRequired();

            entity.Property(x => x.DisplayOrder)
                .IsRequired();
        });

        modelBuilder.Entity<CashRegister>(entity =>
        {
            entity
                .ToTable("CashRegisters")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.RegisterId);

            entity.Property(x => x.RegisterId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Date)
                .HasColumnType("date")
                .IsRequired();

            entity.Property(x => x.OpeningTotal)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.ClosingTotal)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.CashSales)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.ElectronicPayments)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.TotalSales)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.SupplierExpenses)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.DailyExpenses)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.ExpectedCash)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.Difference)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.NetCash)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.VatAmount)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.Notes)
                .HasColumnType("text");

            entity.Property(x => x.Status)
                .HasMaxLength(20)
                .HasDefaultValue("DRAFT");

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(x => x.CashCounts)
                .WithOne(x => x.CashRegister)
                .HasForeignKey(x => x.RegisterId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CashCount>(entity =>
        {
            entity
                .ToTable("CashCounts")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.CountId);

            entity.Property(x => x.CountId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Quantity)
                .IsRequired();

            entity.Property(x => x.Total)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.IsOpening)
                .IsRequired();

            entity.HasOne(x => x.CashRegister)
                .WithMany(x => x.CashCounts)
                .HasForeignKey(x => x.RegisterId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Denomination)
                .WithMany(x => x.CashCounts)
                .HasForeignKey(x => x.DenominationId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
