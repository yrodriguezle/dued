using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Tests for sales operations (data access layer).
/// Covers sale creation with line items, register total updates, and queries.
/// </summary>
public class SalesTests : IDisposable
{
    private readonly AppDbContext _dbContext;

    public SalesTests()
    {
        _dbContext = TestDbContextFactory.Create();
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Helpers

    private Ruolo SeedRuolo(string nome = "Cassiere")
    {
        var ruolo = new Ruolo { Nome = nome, Descrizione = $"Ruolo {nome}" };
        _dbContext.Ruoli.Add(ruolo);
        _dbContext.SaveChanges();
        return ruolo;
    }

    private Utente SeedUtente(string nome = JwtTestHelper.E2eUsername, Ruolo? ruolo = null)
    {
        ruolo ??= SeedRuolo();
        var utente = JwtTestHelper.CreateTestUtente(id: 0, username: nome);
        utente.RuoloId = ruolo.Id;
        _dbContext.Utenti.Add(utente);
        _dbContext.SaveChanges();
        return utente;
    }

    private RegistroCassa SeedRegistroCassa(Utente utente, DateTime data)
    {
        var registro = new RegistroCassa
        {
            Data = data,
            UtenteId = utente.Id,
            Stato = "DRAFT"
        };
        _dbContext.RegistriCassa.Add(registro);
        _dbContext.SaveChanges();
        return registro;
    }

    private Product SeedProduct(string code = "P001", string name = "Prodotto Test", decimal price = 10.00m, string? category = "Bevande")
    {
        var product = new Product
        {
            Code = code,
            Name = name,
            Price = price,
            Category = category,
            IsActive = true
        };
        _dbContext.Products.Add(product);
        _dbContext.SaveChanges();
        return product;
    }

    #endregion

    #region Create Sale

    [Fact]
    public async Task CreateSale_WithValidData_PersistsAndCalculatesTotal()
    {
        // Arrange
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12));
        var product = SeedProduct("CAFFE", "Caffe Espresso", 1.20m);

        // Act — replicate the create sale mutation logic
        var sale = new Sale
        {
            RegistroCassaId = registro.Id,
            ProductId = product.ProductId,
            Quantity = 3,
            UnitPrice = product.Price,
            TotalPrice = 3 * product.Price,
            Timestamp = DateTime.UtcNow
        };
        _dbContext.Sales.Add(sale);

        // Update register totals (as the mutation does)
        registro.VenditeContanti += sale.TotalPrice;
        registro.TotaleVendite = registro.VenditeContanti + registro.IncassiElettronici;
        await _dbContext.SaveChangesAsync();

        // Assert
        var persistedSale = await _dbContext.Sales
            .Include(s => s.Product)
            .FirstOrDefaultAsync(s => s.SaleId == sale.SaleId);
        persistedSale.Should().NotBeNull();
        persistedSale!.Quantity.Should().Be(3);
        persistedSale.UnitPrice.Should().Be(1.20m);
        persistedSale.TotalPrice.Should().Be(3.60m);
        persistedSale.Product.Should().NotBeNull();
        persistedSale.Product.Name.Should().Be("Caffe Espresso");

        var updatedRegister = await _dbContext.RegistriCassa.FirstAsync(r => r.Id == registro.Id);
        updatedRegister.VenditeContanti.Should().Be(3.60m);
        updatedRegister.TotaleVendite.Should().Be(3.60m);
    }

    #endregion

    #region Delete Sale

    [Fact]
    public async Task DeleteSale_UpdatesRegisterTotals()
    {
        // Arrange
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12));
        var product = SeedProduct("ACQUA", "Acqua Naturale", 2.00m);

        var sale = new Sale
        {
            RegistroCassaId = registro.Id,
            ProductId = product.ProductId,
            Quantity = 5,
            UnitPrice = product.Price,
            TotalPrice = 5 * product.Price,
            Timestamp = DateTime.UtcNow
        };
        _dbContext.Sales.Add(sale);
        registro.VenditeContanti = 10.00m;
        registro.TotaleVendite = 10.00m;
        await _dbContext.SaveChangesAsync();

        // Act — replicate the delete sale mutation logic
        var loadedSale = await _dbContext.Sales.FirstAsync(s => s.SaleId == sale.SaleId);
        var loadedRegister = await _dbContext.RegistriCassa.FirstAsync(r => r.Id == registro.Id);
        loadedRegister.VenditeContanti -= loadedSale.TotalPrice;
        loadedRegister.TotaleVendite = loadedRegister.VenditeContanti + loadedRegister.IncassiElettronici;
        _dbContext.Sales.Remove(loadedSale);
        await _dbContext.SaveChangesAsync();

        // Assert
        var deletedSale = await _dbContext.Sales.FindAsync(sale.SaleId);
        deletedSale.Should().BeNull();

        var resultRegister = await _dbContext.RegistriCassa.FirstAsync(r => r.Id == registro.Id);
        resultRegister.VenditeContanti.Should().Be(0m);
        resultRegister.TotaleVendite.Should().Be(0m);
    }

    #endregion

    #region Query Sales

    [Fact]
    public async Task QuerySalesByRegister_ReturnsSalesForSpecificRegister()
    {
        // Arrange
        var utente = SeedUtente();
        var registro1 = SeedRegistroCassa(utente, new DateTime(2026, 3, 12));
        var registro2 = SeedRegistroCassa(utente, new DateTime(2026, 3, 13));
        var product = SeedProduct();

        _dbContext.Sales.Add(new Sale
        {
            RegistroCassaId = registro1.Id,
            ProductId = product.ProductId,
            Quantity = 1,
            UnitPrice = 10m,
            TotalPrice = 10m,
            Timestamp = DateTime.UtcNow
        });
        _dbContext.Sales.Add(new Sale
        {
            RegistroCassaId = registro1.Id,
            ProductId = product.ProductId,
            Quantity = 2,
            UnitPrice = 10m,
            TotalPrice = 20m,
            Timestamp = DateTime.UtcNow
        });
        _dbContext.Sales.Add(new Sale
        {
            RegistroCassaId = registro2.Id,
            ProductId = product.ProductId,
            Quantity = 3,
            UnitPrice = 10m,
            TotalPrice = 30m,
            Timestamp = DateTime.UtcNow
        });
        await _dbContext.SaveChangesAsync();

        // Act — mirrors the sales query resolver: filter by registerId
        var results = await _dbContext.Sales
            .Where(s => s.RegistroCassaId == registro1.Id)
            .Include(s => s.Product)
            .OrderByDescending(s => s.Timestamp)
            .ToListAsync();

        // Assert
        results.Should().HaveCount(2);
        results.Sum(s => s.TotalPrice).Should().Be(30m);
    }

    #endregion

    #region Products Query

    [Fact]
    public async Task QueryProducts_FilterByCategory_ReturnsMatchingProducts()
    {
        // Arrange
        SeedProduct("P001", "Caffe", 1.20m, "Bevande");
        SeedProduct("P002", "Acqua", 1.00m, "Bevande");
        SeedProduct("P003", "Pizza Margherita", 8.00m, "Pizze");
        SeedProduct("P004", "Inattivo", 5.00m, "Bevande");

        // Deactivate last product
        var inactive = await _dbContext.Products.FirstAsync(p => p.Code == "P004");
        inactive.IsActive = false;
        await _dbContext.SaveChangesAsync();

        // Act — mirrors the products query with category filter
        var category = "Bevande";
        var results = await _dbContext.Products
            .Where(p => p.IsActive)
            .Where(p => p.Category == category)
            .OrderBy(p => p.Code)
            .ToListAsync();

        // Assert
        results.Should().HaveCount(2);
        results[0].Code.Should().Be("P001");
        results[1].Code.Should().Be("P002");
    }

    [Fact]
    public async Task QueryProductCategories_ReturnsDistinctCategories()
    {
        // Arrange
        SeedProduct("P001", "Caffe", 1.20m, "Bevande");
        SeedProduct("P002", "Pizza", 8.00m, "Pizze");
        SeedProduct("P003", "Acqua", 1.00m, "Bevande");
        SeedProduct("P004", "Tiramisu", 5.00m, "Dolci");

        // Act — mirrors productCategories query
        var categories = await _dbContext.Products
            .Where(p => p.IsActive && p.Category != null)
            .Select(p => p.Category)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();

        // Assert
        categories.Should().HaveCount(3);
        categories.Should().ContainInOrder("Bevande", "Dolci", "Pizze");
    }

    #endregion
}
