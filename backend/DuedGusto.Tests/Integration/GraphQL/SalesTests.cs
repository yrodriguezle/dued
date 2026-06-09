using DuedGusto.Tests.Helpers;
using GraphQL;
using Microsoft.Extensions.Logging;
using duedgusto.Common;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.GraphQL.Vendite;
using duedgusto.GraphQL.Vendite.Types;

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

    private Prodotto SeedProdotto(string codice = "P001", string nome = "Prodotto Test", decimal prezzo = 10.00m, string? categoria = "Bevande", decimal aliquotaIva = 22m)
    {
        var prodotto = new Prodotto
        {
            Codice = codice,
            Nome = nome,
            Prezzo = prezzo,
            Categoria = categoria,
            Attivo = true,
            AliquotaIva = aliquotaIva
        };
        _dbContext.Prodotti.Add(prodotto);
        _dbContext.SaveChanges();
        return prodotto;
    }

    private Vendita CreaVenditaConSnapshot(RegistroCassa registro, Prodotto prodotto, decimal quantita)
    {
        // Stesso percorso di codice della mutation creaVendita
        Vendita vendita = VenditeMutations.CostruisciVendita(prodotto, new CreaVenditaInput
        {
            RegistroCassaId = registro.Id,
            ProdottoId = prodotto.ProdottoId,
            Quantita = quantita,
        });
        _dbContext.Vendite.Add(vendita);
        _dbContext.SaveChanges();
        return vendita;
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

    #region Snapshot IVA sulla vendita (iva-multialiquota-fase3)

    [Fact]
    public async Task CreaVendita_PersisteSnapshotIvaConScorporoDiRiga()
    {
        // Scenario spec "Creazione vendita con scorporo per riga": 1.20 × 3 al 10% → 3.27 / 0.33
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12));
        var prodotto = SeedProdotto("CAFFE", "Caffe Espresso", 1.20m, aliquotaIva: 10m);

        var vendita = CreaVenditaConSnapshot(registro, prodotto, 3);

        var persisted = await _dbContext.Vendite.FirstAsync(s => s.VenditaId == vendita.VenditaId);
        persisted.PrezzoTotale.Should().Be(3.60m);
        persisted.AliquotaIva.Should().Be(10.00m);
        persisted.Imponibile.Should().Be(3.27m);
        persisted.ImportoIva.Should().Be(0.33m);
        (persisted.Imponibile + persisted.ImportoIva).Should().Be(persisted.PrezzoTotale);
    }

    [Fact]
    public async Task CreaVendita_AliquotaZero_SnapshotSenzaIva()
    {
        // Scenario spec "Creazione vendita con aliquota zero": 5.00 a 0% → 5.00 / 0.00
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12));
        var prodotto = SeedProdotto("ZERO", "Prodotto esente", 5.00m, aliquotaIva: 0m);

        var vendita = CreaVenditaConSnapshot(registro, prodotto, 1);

        var persisted = await _dbContext.Vendite.FirstAsync(s => s.VenditaId == vendita.VenditaId);
        persisted.AliquotaIva.Should().Be(0.00m);
        persisted.Imponibile.Should().Be(5.00m);
        persisted.ImportoIva.Should().Be(0.00m);
    }

    [Fact]
    public async Task AggiornaVendita_SoloNote_SnapshotIntatto()
    {
        // Scenario spec "Aggiornamento solo note": snapshot immutato anche se
        // l'aliquota del prodotto è nel frattempo cambiata
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12));
        var prodotto = SeedProdotto("CAFFE", "Caffe Espresso", 1.20m, aliquotaIva: 10m);
        var vendita = CreaVenditaConSnapshot(registro, prodotto, 3);

        prodotto.AliquotaIva = 22m; // cambio aliquota prodotto DOPO la vendita
        await _dbContext.SaveChangesAsync();

        await VenditeMutations.ApplicaAggiornamentoVenditaAsync(
            _dbContext, vendita, new AggiornaVenditaInput { Note = "nota aggiornata" });
        await _dbContext.SaveChangesAsync();

        vendita.Note.Should().Be("nota aggiornata");
        vendita.AliquotaIva.Should().Be(10.00m, "l'aliquota NON viene riletta dal prodotto");
        vendita.Imponibile.Should().Be(3.27m);
        vendita.ImportoIva.Should().Be(0.33m);
    }

    [Fact]
    public async Task AggiornaVendita_CambioQuantita_RicalcolaConAliquotaSnapshot()
    {
        // Scenario spec "Aggiornamento quantità senza cambio prodotto":
        // ricalcolo importi con l'aliquota SNAPSHOT (10), non quella corrente del prodotto (22)
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12));
        var prodotto = SeedProdotto("CAFFE", "Caffe Espresso", 1.20m, aliquotaIva: 10m);
        var vendita = CreaVenditaConSnapshot(registro, prodotto, 3);

        prodotto.AliquotaIva = 22m;
        await _dbContext.SaveChangesAsync();

        await VenditeMutations.ApplicaAggiornamentoVenditaAsync(
            _dbContext, vendita, new AggiornaVenditaInput { Quantita = 5 });
        await _dbContext.SaveChangesAsync();

        vendita.PrezzoTotale.Should().Be(6.00m);
        vendita.AliquotaIva.Should().Be(10.00m, "immutabilità dello storico");
        RisultatoIva atteso = IvaCalculator.ScorporaDaLordo(6.00m, IvaCalculator.AliquotaDaPercentuale(10m));
        vendita.Imponibile.Should().Be(atteso.Imponibile);
        vendita.ImportoIva.Should().Be(atteso.Iva);
        (vendita.Imponibile + vendita.ImportoIva).Should().Be(vendita.PrezzoTotale);
    }

    [Fact]
    public async Task AggiornaVendita_CambioProdotto_RiprendeAliquotaNuovoProdotto()
    {
        // Scenario spec "Cambio prodotto": riprende prezzo e aliquota correnti del nuovo prodotto
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12));
        var prodottoA = SeedProdotto("A22", "Prodotto A", 10.00m, aliquotaIva: 22m);
        var prodottoB = SeedProdotto("B04", "Prodotto B", 8.00m, aliquotaIva: 4m);
        var vendita = CreaVenditaConSnapshot(registro, prodottoA, 2);

        await VenditeMutations.ApplicaAggiornamentoVenditaAsync(
            _dbContext, vendita, new AggiornaVenditaInput { ProdottoId = prodottoB.ProdottoId });
        await _dbContext.SaveChangesAsync();

        vendita.ProdottoId.Should().Be(prodottoB.ProdottoId);
        vendita.PrezzoUnitario.Should().Be(8.00m);
        vendita.PrezzoTotale.Should().Be(16.00m);
        vendita.AliquotaIva.Should().Be(4.00m);
        RisultatoIva atteso = IvaCalculator.ScorporaDaLordo(16.00m, IvaCalculator.AliquotaDaPercentuale(4m));
        vendita.Imponibile.Should().Be(atteso.Imponibile);
        vendita.ImportoIva.Should().Be(atteso.Iva);
    }

    [Fact]
    public async Task EliminaVendita_BreakdownRegistroRicalcolato()
    {
        // Scenario spec "Ricalcolo su eliminazione vendita": la riga esatta
        // all'aliquota 10 sparisce dal breakdown rigenerato
        var settings = new BusinessSettings
        {
            BusinessName = "DuedGusto Test",
            OperatingDays = "[true,true,true,true,true,false,false]",
            VatRate = 0.22m
        };
        _dbContext.BusinessSettings.Add(settings);
        await _dbContext.SaveChangesAsync();

        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12));
        var prodotto22 = SeedProdotto("P22", "Prodotto 22", 36.60m, aliquotaIva: 22m);
        var prodotto10 = SeedProdotto("P10", "Prodotto 10", 22.00m, aliquotaIva: 10m);
        CreaVenditaConSnapshot(registro, prodotto22, 1);
        var vendita10 = CreaVenditaConSnapshot(registro, prodotto10, 1);

        await BreakdownIvaApplier.ApplicaAsync(_dbContext, registro, 0.22m, Mock.Of<ILogger>());
        await _dbContext.SaveChangesAsync();
        (await _dbContext.RegistriCassaIva
            .AnyAsync(r => r.RegistroCassaId == registro.Id && r.Aliquota == 10.00m)).Should().BeTrue();

        // Elimina e ricalcola (stesso flusso della mutation: save vendita, poi applier)
        _dbContext.Vendite.Remove(vendita10);
        await _dbContext.SaveChangesAsync();
        await BreakdownIvaApplier.ApplicaAsync(_dbContext, registro, 0.22m, Mock.Of<ILogger>());
        await _dbContext.SaveChangesAsync();

        var righe = await _dbContext.RegistriCassaIva
            .Where(r => r.RegistroCassaId == registro.Id).ToListAsync();
        righe.Should().NotContain(r => r.Aliquota == 10.00m);
        registro.VenditeContanti.Should().Be(36.60m);
        registro.ImportoIva.Should().Be(righe.Sum(r => r.Imposta));
    }

    #endregion

    #region mutateProdotto (iva-multialiquota-fase3)

    [Fact]
    public async Task MutateProdotto_Creazione_PersisteAliquotaValidata()
    {
        // Scenario spec "Creazione prodotto"
        Prodotto prodotto = await VenditeMutations.UpsertProdottoAsync(_dbContext, new ProdottoInput
        {
            Codice = "CAFFE01",
            Nome = "Caffè",
            Prezzo = 1.20m,
            AliquotaIva = 10m,
        });

        prodotto.ProdottoId.Should().BeGreaterThan(0);
        prodotto.AliquotaIva.Should().Be(10.00m);

        var persisted = await _dbContext.Prodotti.FirstAsync(p => p.Codice == "CAFFE01");
        persisted.AliquotaIva.Should().Be(10.00m);
    }

    [Fact]
    public async Task MutateProdotto_Aggiornamento_AggiornaAliquota()
    {
        // Scenario spec "Aggiornamento aliquota di un prodotto esistente"
        var esistente = SeedProdotto("P001", "Prodotto Test", 10.00m, aliquotaIva: 22m);

        Prodotto aggiornato = await VenditeMutations.UpsertProdottoAsync(_dbContext, new ProdottoInput
        {
            ProdottoId = esistente.ProdottoId,
            Codice = "P001",
            Nome = "Prodotto Test",
            Prezzo = 10.00m,
            AliquotaIva = 4m,
        });

        aggiornato.AliquotaIva.Should().Be(4.00m);
    }

    [Fact]
    public async Task MutateProdotto_AliquotaFuoriSet_ExecutionErrorConElencoAliquote()
    {
        // Scenario spec "Aliquota fuori set": 7 → errore esplicito, nessun prodotto creato
        Func<Task> act = () => VenditeMutations.UpsertProdottoAsync(_dbContext, new ProdottoInput
        {
            Codice = "NUOVO",
            Nome = "Nuovo",
            Prezzo = 1.00m,
            AliquotaIva = 7m,
        });

        (await act.Should().ThrowAsync<ExecutionError>())
            .WithMessage("*7*").WithMessage("*0, 4, 5, 10, 22*");
        (await _dbContext.Prodotti.AnyAsync(p => p.Codice == "NUOVO")).Should().BeFalse();
    }

    [Fact]
    public async Task MutateProdotto_ProdottoInesistente_ProdottoNonTrovato()
    {
        // Scenario spec "Aggiornamento di un prodotto inesistente"
        Func<Task> act = () => VenditeMutations.UpsertProdottoAsync(_dbContext, new ProdottoInput
        {
            ProdottoId = 999,
            Codice = "X",
            Nome = "X",
            Prezzo = 1.00m,
            AliquotaIva = 22m,
        });

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Prodotto non trovato");
    }

    [Fact]
    public async Task MutateProdotto_CodiceDuplicato_ErroreLeggibile()
    {
        SeedProdotto("P001", "Esistente", 10.00m);

        Func<Task> act = () => VenditeMutations.UpsertProdottoAsync(_dbContext, new ProdottoInput
        {
            Codice = "P001",
            Nome = "Doppione",
            Prezzo = 2.00m,
            AliquotaIva = 22m,
        });

        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*P001*");
    }

    [Fact]
    public async Task MutateProdotto_CambioAliquota_NonToccaSnapshotVenditeEsistenti()
    {
        // Scenario spec: gli snapshot IVA delle vendite già registrate NON vengono modificati
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente, new DateTime(2026, 3, 12));
        var prodotto = SeedProdotto("CAFFE", "Caffe Espresso", 1.20m, aliquotaIva: 22m);
        var vendita = CreaVenditaConSnapshot(registro, prodotto, 3);
        decimal imponibilePre = vendita.Imponibile;
        decimal ivaPre = vendita.ImportoIva;

        await VenditeMutations.UpsertProdottoAsync(_dbContext, new ProdottoInput
        {
            ProdottoId = prodotto.ProdottoId,
            Codice = "CAFFE",
            Nome = "Caffe Espresso",
            Prezzo = 1.20m,
            AliquotaIva = 10m,
        });

        var persisted = await _dbContext.Vendite.FirstAsync(s => s.VenditaId == vendita.VenditaId);
        persisted.AliquotaIva.Should().Be(22.00m);
        persisted.Imponibile.Should().Be(imponibilePre);
        persisted.ImportoIva.Should().Be(ivaPre);
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
