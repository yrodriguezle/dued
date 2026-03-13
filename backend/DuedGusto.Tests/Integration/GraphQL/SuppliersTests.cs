using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Tests for supplier CRUD operations (data access layer).
/// Covers suppliers, soft-delete, and query filtering.
/// </summary>
public class SuppliersTests : IDisposable
{
    private readonly AppDbContext _dbContext;

    public SuppliersTests()
    {
        _dbContext = TestDbContextFactory.Create();
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Helpers

    private Fornitore SeedFornitore(
        string ragioneSociale = "Fornitore Test",
        bool attivo = true,
        string? partitaIva = "IT12345678901",
        string? email = "test@fornitore.it")
    {
        var fornitore = new Fornitore
        {
            RagioneSociale = ragioneSociale,
            PartitaIva = partitaIva,
            Email = email,
            Attivo = attivo,
            Paese = "IT"
        };
        _dbContext.Fornitori.Add(fornitore);
        _dbContext.SaveChanges();
        return fornitore;
    }

    #endregion

    #region Create Supplier

    [Fact]
    public async Task CreateSupplier_WithValidData_PersistsToDatabase()
    {
        // Arrange & Act
        var fornitore = new Fornitore
        {
            RagioneSociale = "Pasta Fresca SRL",
            PartitaIva = "IT98765432100",
            CodiceFiscale = "RSSMRA85M01H501Z",
            Email = "info@pastafresca.it",
            Telefono = "+39 06 12345678",
            Indirizzo = "Via Roma 1",
            Citta = "Roma",
            Cap = "00100",
            Provincia = "RM",
            Paese = "IT",
            Note = "Fornitore principale pasta",
            Attivo = true
        };
        _dbContext.Fornitori.Add(fornitore);
        await _dbContext.SaveChangesAsync();

        // Assert
        var persisted = await _dbContext.Fornitori
            .FirstOrDefaultAsync(f => f.FornitoreId == fornitore.FornitoreId);
        persisted.Should().NotBeNull();
        persisted!.RagioneSociale.Should().Be("Pasta Fresca SRL");
        persisted.PartitaIva.Should().Be("IT98765432100");
        persisted.Email.Should().Be("info@pastafresca.it");
        persisted.Citta.Should().Be("Roma");
        persisted.Attivo.Should().BeTrue();
    }

    #endregion

    #region Update Supplier

    [Fact]
    public async Task UpdateSupplier_ChangesFields_PersistsUpdates()
    {
        // Arrange
        var fornitore = SeedFornitore("Vecchio Nome SRL");

        // Act — replicate mutation update logic
        var loaded = await _dbContext.Fornitori.FirstAsync(f => f.FornitoreId == fornitore.FornitoreId);
        loaded.RagioneSociale = "Nuovo Nome SRL";
        loaded.Email = "nuovo@email.it";
        loaded.Telefono = "+39 02 9876543";
        loaded.AggiornatoIl = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        // Assert
        var result = await _dbContext.Fornitori.FirstAsync(f => f.FornitoreId == fornitore.FornitoreId);
        result.RagioneSociale.Should().Be("Nuovo Nome SRL");
        result.Email.Should().Be("nuovo@email.it");
        result.Telefono.Should().Be("+39 02 9876543");
    }

    #endregion

    #region Soft Delete Supplier

    [Fact]
    public async Task DeleteSupplier_SoftDelete_SetsAttivoToFalse()
    {
        // Arrange
        var fornitore = SeedFornitore();
        fornitore.Attivo.Should().BeTrue();

        // Act — replicate soft-delete mutation logic
        var loaded = await _dbContext.Fornitori.FirstAsync(f => f.FornitoreId == fornitore.FornitoreId);
        loaded.Attivo = false;
        loaded.AggiornatoIl = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        // Assert
        var result = await _dbContext.Fornitori.FirstAsync(f => f.FornitoreId == fornitore.FornitoreId);
        result.Attivo.Should().BeFalse();
    }

    #endregion

    #region Query Suppliers

    [Fact]
    public async Task QuerySuppliers_OnlyActive_FiltersInactive()
    {
        // Arrange
        SeedFornitore("Attivo SRL", attivo: true);
        SeedFornitore("Inattivo SRL", attivo: false);
        SeedFornitore("Altro Attivo SRL", attivo: true);

        // Act — mirrors the query resolver logic: only active, ordered by name
        var results = await _dbContext.Fornitori
            .Where(s => s.Attivo)
            .OrderBy(s => s.RagioneSociale)
            .ToListAsync();

        // Assert
        results.Should().HaveCount(2);
        results[0].RagioneSociale.Should().Be("Altro Attivo SRL");
        results[1].RagioneSociale.Should().Be("Attivo SRL");
    }

    [Fact]
    public async Task QuerySupplierById_WithIncludes_LoadsNavigationProperties()
    {
        // Arrange
        var fornitore = SeedFornitore("Con Fatture SRL");

        _dbContext.FattureAcquisto.Add(new FatturaAcquisto
        {
            FornitoreId = fornitore.FornitoreId,
            NumeroFattura = "FA-001",
            DataFattura = new DateTime(2026, 3, 1),
            Imponibile = 1000m,
            Stato = "DA_PAGARE"
        });
        _dbContext.DocumentiTrasporto.Add(new DocumentoTrasporto
        {
            FornitoreId = fornitore.FornitoreId,
            NumeroDdt = "DDT-001",
            DataDdt = new DateTime(2026, 3, 5),
            Importo = 500m
        });
        await _dbContext.SaveChangesAsync();

        // Act — mirrors the single supplier query with includes
        var result = await _dbContext.Fornitori
            .Include(s => s.FattureAcquisto)
            .Include(s => s.DocumentiTrasporto)
            .FirstOrDefaultAsync(s => s.FornitoreId == fornitore.FornitoreId);

        // Assert
        result.Should().NotBeNull();
        result!.FattureAcquisto.Should().HaveCount(1);
        result.FattureAcquisto.First().NumeroFattura.Should().Be("FA-001");
        result.DocumentiTrasporto.Should().HaveCount(1);
        result.DocumentiTrasporto.First().NumeroDdt.Should().Be("DDT-001");
    }

    [Fact]
    public async Task QuerySupplierById_NonExisting_ReturnsNull()
    {
        // Act
        var result = await _dbContext.Fornitori
            .FirstOrDefaultAsync(s => s.FornitoreId == 999);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region Default Values

    [Fact]
    public void CreateSupplier_DefaultValues_AreCorrect()
    {
        // Arrange & Act
        var fornitore = new Fornitore
        {
            RagioneSociale = "Default Test SRL"
        };

        // Assert
        fornitore.Attivo.Should().BeTrue();
        fornitore.Paese.Should().Be("IT");
    }

    #endregion
}
