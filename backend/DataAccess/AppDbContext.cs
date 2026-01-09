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

    // Products and Sales
    public DbSet<Product> Products { get; set; }
    public DbSet<Sale> Sales { get; set; }

    // Cash Management
    public DbSet<CashDenomination> CashDenominations { get; set; }
    public DbSet<CashRegister> CashRegisters { get; set; }
    public DbSet<CashCount> CashCounts { get; set; }
    public DbSet<CashIncome> CashIncomes { get; set; }
    public DbSet<CashExpense> CashExpenses { get; set; }

    // Business Settings
    public DbSet<BusinessSettings> BusinessSettings { get; set; }

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

            entity.HasMany(x => x.CashIncomes)
                .WithOne(x => x.CashRegister)
                .HasForeignKey(x => x.RegisterId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(x => x.CashExpenses)
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

        modelBuilder.Entity<CashIncome>(entity =>
        {
            entity
                .ToTable("CashIncomes")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.IncomeId);

            entity.Property(x => x.IncomeId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Type)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.Amount)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.HasOne(x => x.CashRegister)
                .WithMany(x => x.CashIncomes)
                .HasForeignKey(x => x.RegisterId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CashExpense>(entity =>
        {
            entity
                .ToTable("CashExpenses")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.ExpenseId);

            entity.Property(x => x.ExpenseId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Description)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(x => x.Amount)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.HasOne(x => x.CashRegister)
                .WithMany(x => x.CashExpenses)
                .HasForeignKey(x => x.RegisterId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Product Configuration
        modelBuilder.Entity<Product>(entity =>
        {
            entity
                .ToTable("Products")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.ProductId);

            entity.Property(x => x.ProductId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Code)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.Name)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(x => x.Description)
                .HasColumnType("text");

            entity.Property(x => x.Price)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.Category)
                .HasMaxLength(100);

            entity.Property(x => x.UnitOfMeasure)
                .HasMaxLength(20)
                .HasDefaultValue("pz");

            entity.Property(x => x.IsActive)
                .HasDefaultValue(true);

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasMany(x => x.Sales)
                .WithOne(x => x.Product)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            // Index on Code for faster lookups
            entity.HasIndex(x => x.Code)
                .IsUnique();
        });

        // Business Settings Configuration
        modelBuilder.Entity<BusinessSettings>(entity =>
        {
            entity
                .ToTable("BusinessSettings")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.SettingsId);

            entity.Property(x => x.SettingsId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.BusinessName)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(x => x.OpeningTime)
                .HasMaxLength(5)
                .IsRequired()
                .HasDefaultValue("09:00");

            entity.Property(x => x.ClosingTime)
                .HasMaxLength(5)
                .IsRequired()
                .HasDefaultValue("18:00");

            entity.Property(x => x.OperatingDays)
                .HasColumnType("json")
                .IsRequired()
                .HasDefaultValue("[true,true,true,true,true,false,false]");

            entity.Property(x => x.Timezone)
                .HasMaxLength(50)
                .IsRequired()
                .HasDefaultValue("Europe/Rome");

            entity.Property(x => x.Currency)
                .HasMaxLength(3)
                .IsRequired()
                .HasDefaultValue("EUR");

            entity.Property(x => x.VatRate)
                .HasColumnType("decimal(5,4)")
                .IsRequired()
                .HasDefaultValue(0.22m);

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        });

        // Sale Configuration
        modelBuilder.Entity<Sale>(entity =>
        {
            entity
                .ToTable("Sales")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.SaleId);

            entity.Property(x => x.SaleId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Quantity)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.UnitPrice)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.TotalPrice)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.Notes)
                .HasColumnType("text");

            entity.Property(x => x.Timestamp)
                .HasColumnType("datetime")
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(x => x.CashRegister)
                .WithMany()
                .HasForeignKey(x => x.RegisterId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Product)
                .WithMany(x => x.Sales)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            // Index on RegisterId for faster queries by register
            entity.HasIndex(x => x.RegisterId);

            // Index on Timestamp for time-based filtering
            entity.HasIndex(x => x.Timestamp);
        });
    }
}
