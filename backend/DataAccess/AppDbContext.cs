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

    public DbSet<Utente> Utenti { get; set; }
    public DbSet<Ruolo> Ruoli { get; set; }
    public DbSet<Menu> Menus { get; set; }

    // Products and Sales
    public DbSet<Product> Products { get; set; }
    public DbSet<Sale> Sales { get; set; }

    // Cash Management
    public DbSet<DenominazioneMoneta> DenominazioniMoneta { get; set; }
    public DbSet<RegistroCassa> RegistriCassa { get; set; }
    public DbSet<ConteggioMoneta> ConteggiMoneta { get; set; }
    public DbSet<IncassoCassa> IncassiCassa { get; set; }
    public DbSet<SpesaCassa> SpeseCassa { get; set; }

    // Business Settings
    public DbSet<BusinessSettings> BusinessSettings { get; set; }

    // Supplier Management
    public DbSet<Fornitore> Fornitori { get; set; }
    public DbSet<FatturaAcquisto> FattureAcquisto { get; set; }
    public DbSet<DocumentoTrasporto> DocumentiTrasporto { get; set; }
    public DbSet<PagamentoFornitore> PagamentiFornitori { get; set; }

    // Monthly Closure
    public DbSet<ChiusuraMensile> ChiusureMensili { get; set; }
    public DbSet<SpesaMensile> SpeseMensili { get; set; }

    // Monthly Closure - New Referential Model
    public DbSet<RegistroCassaMensile> RegistriCassaMensili { get; set; }
    public DbSet<SpesaMensileLibera> SpeseMensiliLibere { get; set; }
    public DbSet<PagamentoMensileFornitori> PagamentiMensiliFornitori { get; set; }

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
        modelBuilder.Entity<Utente>(entity =>
        {
            entity
                .ToTable("Utenti")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedOnAdd();

            entity.HasOne(x => x.Ruolo)
                .WithMany(r => r.Utenti)
                .HasForeignKey(x => x.RuoloId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Ruolo>(entity =>
        {
            entity
                .ToTable("Ruoli")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedOnAdd();
        });

        modelBuilder.Entity<Ruolo>()
            .HasMany(r => r.Menus)
            .WithMany(m => m.Ruoli)
            .UsingEntity<Dictionary<string, object>>(
                "RuoloMenu",
                j => j.HasOne<Menu>()
                      .WithMany()
                      .HasForeignKey("MenuId")
                      .OnDelete(DeleteBehavior.Cascade),
                j => j.HasOne<Ruolo>()
                      .WithMany()
                      .HasForeignKey("RuoloId")
                      .OnDelete(DeleteBehavior.Cascade)
            );

        modelBuilder.Entity<Menu>(entity =>
        {
            entity
                .ToTable("Menus")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedOnAdd();

            entity.HasOne(m => m.MenuPadre)
                .WithMany(m => m.Figli)
                .HasForeignKey(m => m.MenuPadreId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Cash Management Configuration
        modelBuilder.Entity<DenominazioneMoneta>(entity =>
        {
            entity
                .ToTable("DenominazioniMoneta")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Valore)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.Tipo)
                .HasMaxLength(10)
                .IsRequired();

            entity.Property(x => x.OrdineVisualizzazione)
                .IsRequired();
        });

        modelBuilder.Entity<RegistroCassa>(entity =>
        {
            entity
                .ToTable("RegistriCassa")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Data)
                .HasColumnType("date")
                .IsRequired();

            // Unique index on Data to prevent duplicate cash registers for the same date
            entity.HasIndex(x => x.Data)
                .IsUnique();

            entity.Property(x => x.TotaleApertura)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.TotaleChiusura)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.VenditeContanti)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.IncassiElettronici)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.TotaleVendite)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.SpeseFornitori)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.SpeseGiornaliere)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.ContanteAtteso)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.Differenza)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.ContanteNetto)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.ImportoIva)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.Note)
                .HasColumnType("text");

            entity.Property(x => x.Stato)
                .HasMaxLength(20)
                .HasDefaultValue("DRAFT");

            entity.Property(x => x.CreatoIl)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.AggiornatoIl)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(x => x.Utente)
                .WithMany()
                .HasForeignKey(x => x.UtenteId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(x => x.ConteggiMoneta)
                .WithOne(x => x.RegistroCassa)
                .HasForeignKey(x => x.RegistroCassaId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(x => x.IncassiCassa)
                .WithOne(x => x.RegistroCassa)
                .HasForeignKey(x => x.RegistroCassaId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(x => x.SpeseCassa)
                .WithOne(x => x.RegistroCassa)
                .HasForeignKey(x => x.RegistroCassaId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ConteggioMoneta>(entity =>
        {
            entity
                .ToTable("ConteggiMoneta")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Quantita)
                .IsRequired();

            entity.Property(x => x.Totale)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.IsApertura)
                .IsRequired();

            entity.HasOne(x => x.RegistroCassa)
                .WithMany(x => x.ConteggiMoneta)
                .HasForeignKey(x => x.RegistroCassaId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Denominazione)
                .WithMany(x => x.ConteggiMoneta)
                .HasForeignKey(x => x.DenominazioneMonetaId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<IncassoCassa>(entity =>
        {
            entity
                .ToTable("IncassiCassa")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Tipo)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.Importo)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.HasOne(x => x.RegistroCassa)
                .WithMany(x => x.IncassiCassa)
                .HasForeignKey(x => x.RegistroCassaId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SpesaCassa>(entity =>
        {
            entity
                .ToTable("SpeseCassa")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Descrizione)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(x => x.Importo)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.HasOne(x => x.RegistroCassa)
                .WithMany(x => x.SpeseCassa)
                .HasForeignKey(x => x.RegistroCassaId)
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

            entity.HasOne(x => x.RegistroCassa)
                .WithMany()
                .HasForeignKey(x => x.RegistroCassaId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Product)
                .WithMany(x => x.Sales)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            // Index on RegistroCassaId for faster queries by register
            entity.HasIndex(x => x.RegistroCassaId);

            // Index on Timestamp for time-based filtering
            entity.HasIndex(x => x.Timestamp);
        });

        // Supplier Management Configuration
        modelBuilder.Entity<Fornitore>(entity =>
        {
            entity
                .ToTable("Fornitori")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.FornitoreId);

            entity.Property(x => x.FornitoreId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.RagioneSociale)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(x => x.PartitaIva)
                .HasMaxLength(20);

            entity.Property(x => x.CodiceFiscale)
                .HasMaxLength(16);

            entity.Property(x => x.Indirizzo)
                .HasColumnType("text");

            entity.Property(x => x.Citta)
                .HasMaxLength(100);

            entity.Property(x => x.Cap)
                .HasMaxLength(10);

            entity.Property(x => x.Paese)
                .HasMaxLength(2)
                .HasDefaultValue("IT");

            entity.Property(x => x.Email)
                .HasMaxLength(255);

            entity.Property(x => x.Telefono)
                .HasMaxLength(50);

            entity.Property(x => x.Note)
                .HasColumnType("text");

            entity.Property(x => x.Attivo)
                .HasDefaultValue(true);

            entity.Property(x => x.CreatoIl)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.AggiornatoIl)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            // Indice univoco su PartitaIva (solo se presente)
            entity.HasIndex(x => x.PartitaIva)
                .IsUnique()
                .HasFilter("[PartitaIva] IS NOT NULL");

            // Indice su RagioneSociale per ricerca
            entity.HasIndex(x => x.RagioneSociale);

            // Indice su Attivo per filtrare fornitori attivi
            entity.HasIndex(x => x.Attivo);
        });

        modelBuilder.Entity<FatturaAcquisto>(entity =>
        {
            entity
                .ToTable("FattureAcquisto")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.FatturaId);

            entity.Property(x => x.FatturaId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.NumeroFattura)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.DataFattura)
                .HasColumnType("date")
                .IsRequired();

            entity.Property(x => x.DataScadenza)
                .HasColumnType("date");

            entity.Property(x => x.Imponibile)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.ImportoIva)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.TotaleConIva)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.Stato)
                .HasMaxLength(20)
                .HasDefaultValue("DA_PAGARE");

            entity.Property(x => x.Note)
                .HasColumnType("text");

            entity.Property(x => x.CreatoIl)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.AggiornatoIl)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(x => x.Fornitore)
                .WithMany(f => f.FattureAcquisto)
                .HasForeignKey(x => x.FornitoreId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indice univoco su FornitoreId + NumeroFattura
            entity.HasIndex(x => new { x.FornitoreId, x.NumeroFattura })
                .IsUnique();

            // Indice su DataFattura per ordinamento/filtri
            entity.HasIndex(x => x.DataFattura);

            // Indice su Stato per filtri
            entity.HasIndex(x => x.Stato);
        });

        modelBuilder.Entity<DocumentoTrasporto>(entity =>
        {
            entity
                .ToTable("DocumentiTrasporto")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.DdtId);

            entity.Property(x => x.DdtId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.NumeroDdt)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.DataDdt)
                .HasColumnType("date")
                .IsRequired();

            entity.Property(x => x.Importo)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.Note)
                .HasColumnType("text");

            entity.Property(x => x.CreatoIl)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.AggiornatoIl)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(x => x.Fornitore)
                .WithMany(f => f.DocumentiTrasporto)
                .HasForeignKey(x => x.FornitoreId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Fattura)
                .WithMany(f => f.DocumentiTrasporto)
                .HasForeignKey(x => x.FatturaId)
                .OnDelete(DeleteBehavior.SetNull);

            // Indice univoco su FornitoreId + NumeroDdt
            entity.HasIndex(x => new { x.FornitoreId, x.NumeroDdt })
                .IsUnique();

            // Indice su DataDdt per ordinamento/filtri
            entity.HasIndex(x => x.DataDdt);

            // Indice su FatturaId per join
            entity.HasIndex(x => x.FatturaId);
        });

        modelBuilder.Entity<PagamentoFornitore>(entity =>
        {
            entity
                .ToTable("PagamentiFornitori")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.PagamentoId);

            entity.Property(x => x.PagamentoId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.DataPagamento)
                .HasColumnType("date")
                .IsRequired();

            entity.Property(x => x.Importo)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.MetodoPagamento)
                .HasMaxLength(50);

            entity.Property(x => x.Note)
                .HasColumnType("text");

            entity.Property(x => x.CreatoIl)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.AggiornatoIl)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(x => x.Fattura)
                .WithMany(f => f.Pagamenti)
                .HasForeignKey(x => x.FatturaId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Ddt)
                .WithMany(d => d.Pagamenti)
                .HasForeignKey(x => x.DdtId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indice su DataPagamento per ordinamento/filtri
            entity.HasIndex(x => x.DataPagamento);

            // Indice su FatturaId per join
            entity.HasIndex(x => x.FatturaId);

            // Indice su DdtId per join
            entity.HasIndex(x => x.DdtId);
        });

        modelBuilder.Entity<ChiusuraMensile>(entity =>
        {
            entity
                .ToTable("ChiusureMensili")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.ChiusuraId);

            entity.Property(x => x.ChiusuraId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Anno)
                .IsRequired();

            entity.Property(x => x.Mese)
                .IsRequired();

            entity.Property(x => x.UltimoGiornoLavorativo)
                .HasColumnType("date")
                .IsRequired();

            entity.Property(x => x.RicavoTotale)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.TotaleContanti)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.TotaleElettronici)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.TotaleFatture)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.SpeseAggiuntive)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.RicavoNetto)
                .HasColumnType("decimal(10,2)");

            entity.Property(x => x.Stato)
                .HasMaxLength(20)
                .HasDefaultValue("BOZZA");

            entity.Property(x => x.Note)
                .HasColumnType("text");

            entity.Property(x => x.ChiusaIl)
                .HasColumnType("datetime");

            entity.Property(x => x.CreatoIl)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.AggiornatoIl)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(x => x.ChiusaDaUtente)
                .WithMany()
                .HasForeignKey(x => x.ChiusaDa)
                .OnDelete(DeleteBehavior.SetNull);

            // Indice univoco su Anno + Mese
            entity.HasIndex(x => new { x.Anno, x.Mese })
                .IsUnique();

            // Indice su Stato per filtri
            entity.HasIndex(x => x.Stato);

            // Ignorare proprietà calcolate (NotMapped)
            entity.Ignore(e => e.RicavoTotaleCalcolato);
            entity.Ignore(e => e.TotaleContantiCalcolato);
            entity.Ignore(e => e.TotaleElettroniciCalcolato);
            entity.Ignore(e => e.TotaleFattureCalcolato);
            entity.Ignore(e => e.SpeseAggiuntiveCalcolate);
            entity.Ignore(e => e.RicavoNettoCalcolato);
        });

        modelBuilder.Entity<SpesaMensile>(entity =>
        {
            entity
                .ToTable("SpeseMensili")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci")
                .HasKey(x => x.SpesaId);

            entity.Property(x => x.SpesaId)
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Descrizione)
                .IsRequired();

            entity.Property(x => x.Importo)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(x => x.Categoria)
                .HasMaxLength(50);

            entity.Property(x => x.CreatoIl)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(x => x.AggiornatoIl)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(x => x.Chiusura)
                .WithMany(c => c.Spese)
                .HasForeignKey(x => x.ChiusuraId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Pagamento)
                .WithMany(p => p.SpeseMensili)
                .HasForeignKey(x => x.PagamentoId)
                .OnDelete(DeleteBehavior.SetNull);

            // Indice su ChiusuraId per join
            entity.HasIndex(x => x.ChiusuraId);

            // Indice su PagamentoId per join
            entity.HasIndex(x => x.PagamentoId);

            // Indice su Categoria per filtri
            entity.HasIndex(x => x.Categoria);
        });

        // ✅ NEW REFERENTIAL MODEL CONFIGURATIONS

        // RegistroCassaMensile (Join Table)
        modelBuilder.Entity<RegistroCassaMensile>(entity =>
        {
            entity.ToTable("RegistriCassaMensili")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci");

            // Chiave composita
            entity.HasKey(e => new { e.ChiusuraId, e.RegistroId });

            entity.Property(e => e.Incluso)
                .HasDefaultValue(true);

            entity.HasOne(e => e.Chiusura)
                .WithMany(c => c.RegistriInclusi)
                .HasForeignKey(e => e.ChiusuraId)
                .OnDelete(DeleteBehavior.Restrict); // Impedisce eliminazione chiusura

            entity.HasOne(e => e.Registro)
                .WithMany()
                .HasForeignKey(e => e.RegistroId)
                .OnDelete(DeleteBehavior.Restrict); // Impedisce eliminazione registro incluso

            // Indici per performance
            entity.HasIndex(e => e.ChiusuraId);
            entity.HasIndex(e => e.RegistroId);
        });

        // SpesaMensileLibera
        modelBuilder.Entity<SpesaMensileLibera>(entity =>
        {
            entity.ToTable("SpeseMensiliLibere")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci");

            entity.HasKey(e => e.SpesaId);

            entity.Property(e => e.SpesaId)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.Descrizione)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(e => e.Importo)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            // Enum to string conversion
            entity.Property(e => e.Categoria)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(e => e.CreatoIl)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.AggiornatoIl)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

            entity.HasOne(e => e.Chiusura)
                .WithMany(c => c.SpeseLibere)
                .HasForeignKey(e => e.ChiusuraId)
                .OnDelete(DeleteBehavior.Cascade); // Elimina in cascata

            // Indici per performance
            entity.HasIndex(e => e.ChiusuraId);
            entity.HasIndex(e => e.Categoria);
        });

        // PagamentoMensileFornitori (Join Table)
        modelBuilder.Entity<PagamentoMensileFornitori>(entity =>
        {
            entity.ToTable("PagamentiMensiliFornitori")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci");

            // Chiave composita
            entity.HasKey(e => new { e.ChiusuraId, e.PagamentoId });

            entity.Property(e => e.InclusoInChiusura)
                .HasDefaultValue(true);

            entity.HasOne(e => e.Chiusura)
                .WithMany(c => c.PagamentiInclusi)
                .HasForeignKey(e => e.ChiusuraId)
                .OnDelete(DeleteBehavior.Restrict); // Impedisce eliminazione chiusura

            entity.HasOne(e => e.Pagamento)
                .WithMany()
                .HasForeignKey(e => e.PagamentoId)
                .OnDelete(DeleteBehavior.Restrict); // Impedisce eliminazione pagamento

            // Indici per performance
            entity.HasIndex(e => e.ChiusuraId);
            entity.HasIndex(e => e.PagamentoId);
        });
    }
}