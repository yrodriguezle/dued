using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Tests for purchase invoice and delivery note operations (data access layer).
/// Covers invoice CRUD, IVA calculation, delivery notes, and payment status tracking.
/// </summary>
public class PurchaseInvoicesTests : IDisposable
{
    private readonly AppDbContext _dbContext;

    public PurchaseInvoicesTests()
    {
        _dbContext = TestDbContextFactory.Create();
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Helpers

    private Fornitore SeedFornitore(string ragioneSociale = "Fornitore Test")
    {
        var fornitore = new Fornitore
        {
            RagioneSociale = ragioneSociale,
            PartitaIva = "IT12345678901",
            Attivo = true
        };
        _dbContext.Fornitori.Add(fornitore);
        _dbContext.SaveChanges();
        return fornitore;
    }

    private FatturaAcquisto SeedFattura(
        Fornitore fornitore,
        string numero = "FA-001",
        decimal imponibile = 1000m,
        string stato = "DA_PAGARE")
    {
        var fattura = new FatturaAcquisto
        {
            FornitoreId = fornitore.FornitoreId,
            NumeroFattura = numero,
            DataFattura = new DateTime(2026, 3, 1),
            Imponibile = imponibile,
            ImportoIva = Math.Round(imponibile * 0.22m, 2),
            TotaleConIva = imponibile + Math.Round(imponibile * 0.22m, 2),
            Stato = stato
        };
        _dbContext.FattureAcquisto.Add(fattura);
        _dbContext.SaveChanges();
        return fattura;
    }

    #endregion

    #region Create Invoice

    [Fact]
    public async Task CreateInvoice_WithIvaCalculation_PersistsCorrectTotals()
    {
        // Arrange
        var fornitore = SeedFornitore();
        decimal imponibile = 1000m;
        decimal vatRate = 22m; // percentage

        // Act — replicate mutation IVA logic
        var fattura = new FatturaAcquisto
        {
            FornitoreId = fornitore.FornitoreId,
            NumeroFattura = "FA-100",
            DataFattura = new DateTime(2026, 3, 10),
            Imponibile = imponibile,
            ImportoIva = Math.Round(imponibile * vatRate / 100, 2),
            Stato = "DA_PAGARE"
        };
        fattura.TotaleConIva = imponibile + fattura.ImportoIva;
        _dbContext.FattureAcquisto.Add(fattura);
        await _dbContext.SaveChangesAsync();

        // Assert
        var persisted = await _dbContext.FattureAcquisto
            .FirstOrDefaultAsync(f => f.FatturaId == fattura.FatturaId);
        persisted.Should().NotBeNull();
        persisted!.Imponibile.Should().Be(1000m);
        persisted.ImportoIva.Should().Be(220m);
        persisted.TotaleConIva.Should().Be(1220m);
        persisted.Stato.Should().Be("DA_PAGARE");
    }

    #endregion

    #region Query Invoice with Includes

    [Fact]
    public async Task QueryInvoice_WithIncludes_LoadsFornitoreAndDocumenti()
    {
        // Arrange
        var fornitore = SeedFornitore("Fornitore Fattura");
        var fattura = SeedFattura(fornitore, "FA-200");

        _dbContext.DocumentiTrasporto.Add(new DocumentoTrasporto
        {
            FornitoreId = fornitore.FornitoreId,
            FatturaId = fattura.FatturaId,
            NumeroDdt = "DDT-200",
            DataDdt = new DateTime(2026, 3, 5),
            Importo = 500m
        });
        await _dbContext.SaveChangesAsync();

        // Act — mirrors the query resolver with includes
        var result = await _dbContext.FattureAcquisto
            .Include(i => i.Fornitore)
            .Include(i => i.DocumentiTrasporto)
            .Include(i => i.Pagamenti)
            .FirstOrDefaultAsync(i => i.FatturaId == fattura.FatturaId);

        // Assert
        result.Should().NotBeNull();
        result!.Fornitore.Should().NotBeNull();
        result.Fornitore.RagioneSociale.Should().Be("Fornitore Fattura");
        result.DocumentiTrasporto.Should().HaveCount(1);
        result.DocumentiTrasporto.First().NumeroDdt.Should().Be("DDT-200");
        result.Pagamenti.Should().HaveCount(0);
    }

    #endregion

    #region Delete Invoice

    [Fact]
    public async Task DeleteInvoice_RemovesFromDatabase()
    {
        // Arrange
        var fornitore = SeedFornitore();
        var fattura = SeedFattura(fornitore, "FA-DEL");

        // Act — replicate delete mutation logic
        var loaded = await _dbContext.FattureAcquisto
            .FirstAsync(f => f.FatturaId == fattura.FatturaId);
        _dbContext.FattureAcquisto.Remove(loaded);
        await _dbContext.SaveChangesAsync();

        // Assert
        var result = await _dbContext.FattureAcquisto.FindAsync(fattura.FatturaId);
        result.Should().BeNull();
    }

    #endregion

    #region Delivery Notes

    [Fact]
    public async Task CreateDeliveryNote_LinkedToInvoice_PersistsRelationship()
    {
        // Arrange
        var fornitore = SeedFornitore();
        var fattura = SeedFattura(fornitore, "FA-DDT");

        // Act
        var ddt = new DocumentoTrasporto
        {
            FornitoreId = fornitore.FornitoreId,
            FatturaId = fattura.FatturaId,
            NumeroDdt = "DDT-300",
            DataDdt = new DateTime(2026, 3, 8),
            Importo = 750m,
            Note = "Consegna parziale"
        };
        _dbContext.DocumentiTrasporto.Add(ddt);
        await _dbContext.SaveChangesAsync();

        // Assert
        var result = await _dbContext.DocumentiTrasporto
            .Include(d => d.Fornitore)
            .Include(d => d.Fattura)
            .FirstOrDefaultAsync(d => d.DdtId == ddt.DdtId);

        result.Should().NotBeNull();
        result!.NumeroDdt.Should().Be("DDT-300");
        result.Importo.Should().Be(750m);
        result.Fornitore.Should().NotBeNull();
        result.Fattura.Should().NotBeNull();
        result.Fattura!.NumeroFattura.Should().Be("FA-DDT");
    }

    [Fact]
    public async Task CreateDeliveryNote_WithoutInvoice_PersistsIndependently()
    {
        // Arrange
        var fornitore = SeedFornitore();

        // Act
        var ddt = new DocumentoTrasporto
        {
            FornitoreId = fornitore.FornitoreId,
            FatturaId = null,
            NumeroDdt = "DDT-SOLO",
            DataDdt = new DateTime(2026, 3, 12),
            Importo = 300m
        };
        _dbContext.DocumentiTrasporto.Add(ddt);
        await _dbContext.SaveChangesAsync();

        // Assert
        var result = await _dbContext.DocumentiTrasporto
            .Include(d => d.Fattura)
            .FirstOrDefaultAsync(d => d.DdtId == ddt.DdtId);

        result.Should().NotBeNull();
        result!.FatturaId.Should().BeNull();
        result.Fattura.Should().BeNull();
        result.Importo.Should().Be(300m);
    }

    #endregion

    #region Payment Status Tracking

    [Fact]
    public async Task PaymentStatusTracking_FullPayment_UpdatesToPageata()
    {
        // Arrange
        var fornitore = SeedFornitore();
        var fattura = SeedFattura(fornitore, "FA-PAG", imponibile: 100m);
        // fattura.TotaleConIva = 100 + 22 = 122

        // Act — replicate payment mutation + status update logic
        var payment = new PagamentoFornitore
        {
            FatturaId = fattura.FatturaId,
            DataPagamento = new DateTime(2026, 3, 15),
            Importo = fattura.TotaleConIva!.Value,
            MetodoPagamento = "BONIFICO"
        };
        _dbContext.PagamentiFornitori.Add(payment);
        await _dbContext.SaveChangesAsync();

        // Replicate status update logic from mutation
        var invoice = await _dbContext.FattureAcquisto
            .Include(i => i.Pagamenti)
            .FirstAsync(i => i.FatturaId == fattura.FatturaId);

        var totalPaid = invoice.Pagamenti.Sum(p => p.Importo);
        var invoiceTotal = invoice.TotaleConIva ?? invoice.Imponibile;

        if (totalPaid >= invoiceTotal)
            invoice.Stato = "PAGATA";
        else if (totalPaid > 0)
            invoice.Stato = "PARZIALMENTE_PAGATA";
        else
            invoice.Stato = "DA_PAGARE";

        await _dbContext.SaveChangesAsync();

        // Assert
        var result = await _dbContext.FattureAcquisto.FirstAsync(i => i.FatturaId == fattura.FatturaId);
        result.Stato.Should().Be("PAGATA");
    }

    #endregion
}
