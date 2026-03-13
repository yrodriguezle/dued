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

    private Prodotto SeedProdotto(string codice = "P001", string nome = "Prodotto Test", decimal prezzo = 10.00m, string? categoria = "Bevande")
    {
        var prodotto = new Prodotto
        {
            Codice = codice,
            Nome = nome,
            Prezzo = prezzo,
            Categoria = categoria,
            Attivo = true
        };
        _dbContext.Prodotti.Add(prodotto);
        _dbContext.SaveChanges();
        return prodotto;
    }

    #endregion

    #region Create Sale

    [Fact]
    public async Task CreateSale_WithValidData_PersistsAndCalculatesTotal()
    {
        // Arrange
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12));
        var prodotto = SeedProdotto("CAFFE", "Caffe Espresso", 1.20m);

        // Act — replicate the create sale mutation logic
        var vendita = new Vendita
        {
            RegistroCassaId = registro.Id,
            ProdottoId = prodotto.ProdottoId,
            Quantita = 3,
            PrezzoUnitario = prodotto.Prezzo,
            PrezzoTotale = 3 * prodotto.Prezzo,
            DataOra = DateTime.UtcNow
        };
        _dbContext.Vendite.Add(vendita);

        // Update register totals (as the mutation does)
        registro.VenditeContanti += vendita.PrezzoTotale;
        registro.TotaleVendite = registro.VenditeContanti + registro.IncassiElettronici;
        await _dbContext.SaveChangesAsync();

        // Assert
        var persistedVendita = await _dbContext.Vendite
            .Include(s => s.Prodotto)
            .FirstOrDefaultAsync(s => s.VenditaId == vendita.VenditaId);
        persistedVendita.Should().NotBeNull();
        persistedVendita!.Quantita.Should().Be(3);
        persistedVendita.PrezzoUnitario.Should().Be(1.20m);
        persistedVendita.PrezzoTotale.Should().Be(3.60m);
        persistedVendita.Prodotto.Should().NotBeNull();
        persistedVendita.Prodotto.Nome.Should().Be("Caffe Espresso");

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
        var prodotto = SeedProdotto("ACQUA", "Acqua Naturale", 2.00m);

        var vendita = new Vendita
        {
            RegistroCassaId = registro.Id,
            ProdottoId = prodotto.ProdottoId,
            Quantita = 5,
            PrezzoUnitario = prodotto.Prezzo,
            PrezzoTotale = 5 * prodotto.Prezzo,
            DataOra = DateTime.UtcNow
        };
        _dbContext.Vendite.Add(vendita);
        registro.VenditeContanti = 10.00m;
        registro.TotaleVendite = 10.00m;
        await _dbContext.SaveChangesAsync();

        // Act — replicate the delete sale mutation logic
        var loadedVendita = await _dbContext.Vendite.FirstAsync(s => s.VenditaId == vendita.VenditaId);
        var loadedRegister = await _dbContext.RegistriCassa.FirstAsync(r => r.Id == registro.Id);
        loadedRegister.VenditeContanti -= loadedVendita.PrezzoTotale;
        loadedRegister.TotaleVendite = loadedRegister.VenditeContanti + loadedRegister.IncassiElettronici;
        _dbContext.Vendite.Remove(loadedVendita);
        await _dbContext.SaveChangesAsync();

        // Assert
        var deletedVendita = await _dbContext.Vendite.FindAsync(vendita.VenditaId);
        deletedVendita.Should().BeNull();

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
        var prodotto = SeedProdotto();

        _dbContext.Vendite.Add(new Vendita
        {
            RegistroCassaId = registro1.Id,
            ProdottoId = prodotto.ProdottoId,
            Quantita = 1,
            PrezzoUnitario = 10m,
            PrezzoTotale = 10m,
            DataOra = DateTime.UtcNow
        });
        _dbContext.Vendite.Add(new Vendita
        {
            RegistroCassaId = registro1.Id,
            ProdottoId = prodotto.ProdottoId,
            Quantita = 2,
            PrezzoUnitario = 10m,
            PrezzoTotale = 20m,
            DataOra = DateTime.UtcNow
        });
        _dbContext.Vendite.Add(new Vendita
        {
            RegistroCassaId = registro2.Id,
            ProdottoId = prodotto.ProdottoId,
            Quantita = 3,
            PrezzoUnitario = 10m,
            PrezzoTotale = 30m,
            DataOra = DateTime.UtcNow
        });
        await _dbContext.SaveChangesAsync();

        // Act — mirrors the sales query resolver: filter by registerId
        var results = await _dbContext.Vendite
            .Where(s => s.RegistroCassaId == registro1.Id)
            .Include(s => s.Prodotto)
            .OrderByDescending(s => s.DataOra)
            .ToListAsync();

        // Assert
        results.Should().HaveCount(2);
        results.Sum(s => s.PrezzoTotale).Should().Be(30m);
    }

    #endregion

    #region Products Query

    [Fact]
    public async Task QueryProducts_FilterByCategory_ReturnsMatchingProducts()
    {
        // Arrange
        SeedProdotto("P001", "Caffe", 1.20m, "Bevande");
        SeedProdotto("P002", "Acqua", 1.00m, "Bevande");
        SeedProdotto("P003", "Pizza Margherita", 8.00m, "Pizze");
        SeedProdotto("P004", "Inattivo", 5.00m, "Bevande");

        // Deactivate last product
        var inactive = await _dbContext.Prodotti.FirstAsync(p => p.Codice == "P004");
        inactive.Attivo = false;
        await _dbContext.SaveChangesAsync();

        // Act — mirrors the products query with category filter
        var category = "Bevande";
        var results = await _dbContext.Prodotti
            .Where(p => p.Attivo)
            .Where(p => p.Categoria == category)
            .OrderBy(p => p.Codice)
            .ToListAsync();

        // Assert
        results.Should().HaveCount(2);
        results[0].Codice.Should().Be("P001");
        results[1].Codice.Should().Be("P002");
    }

    [Fact]
    public async Task QueryProductCategories_ReturnsDistinctCategories()
    {
        // Arrange
        SeedProdotto("P001", "Caffe", 1.20m, "Bevande");
        SeedProdotto("P002", "Pizza", 8.00m, "Pizze");
        SeedProdotto("P003", "Acqua", 1.00m, "Bevande");
        SeedProdotto("P004", "Tiramisu", 5.00m, "Dolci");

        // Act — mirrors productCategories query
        var categories = await _dbContext.Prodotti
            .Where(p => p.Attivo && p.Categoria != null)
            .Select(p => p.Categoria)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();

        // Assert
        categories.Should().HaveCount(3);
        categories.Should().ContainInOrder("Bevande", "Dolci", "Pizze");
    }

    #endregion
}
