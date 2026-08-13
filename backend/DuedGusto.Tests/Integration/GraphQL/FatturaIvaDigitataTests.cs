using DuedGusto.Tests.Helpers;

using duedgusto.GraphQL.Fornitori;
using duedgusto.GraphQL.Fornitori.Types;
using duedgusto.Repositories.Implementations;
using duedgusto.Services.Fornitori;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Fatture la cui IVA è un DATO letto dal documento invece del risultato di un'aliquota.
/// Caso reale: un Cash &amp; Carry vende righe a 4/10/22% e sulla fattura stampa un solo
/// TOTALE IVA — nessuna aliquota unica esiste, quindi l'operatore toglie la spunta
/// "Calcola IVA dall'aliquota" e digita l'importo.
///
/// <para>La modalità è persistita in <c>FatturaAcquisto.IvaCalcolata</c>: gli importi da soli
/// non basterebbero, perché 22,00 su 100,00 è identico che sia calcolato o digitato. Questi
/// test coprono i percorsi che RISCRIVONO gli importi di una fattura già salvata — prelievo
/// DDT e pagamento da registro cassa — dove riscorporare distruggerebbe il dato digitato.</para>
/// </summary>
public class FatturaIvaDigitataTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly FatturaAcquistoOrchestrator _orchestrator;

    /// <summary>
    /// L'utenteId serve solo a intestare il registro cassa creato quando la fattura arriva con
    /// dei pagamenti: qui nessun test ne passa, quindi il valore non viene mai letto.
    /// </summary>
    private const int UtenteIdNonUsato = 1;

    public FatturaIvaDigitataTests()
    {
        _dbContext = TestDbContextFactory.Create();
        var unitOfWork = new UnitOfWork(_dbContext);
        _orchestrator = new FatturaAcquistoOrchestrator(unitOfWork, new RegistroCassaSyncService(unitOfWork));
    }

    private Task<FatturaAcquisto> MutateFattura(FatturaAcquistoInput input)
        => _orchestrator.MutateAsync(input, UtenteIdNonUsato);

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Helpers

    private Fornitore SeedFornitore(decimal? aliquotaIva = 22m)
    {
        var fornitore = new Fornitore
        {
            RagioneSociale = "Cash & Carry Test",
            PartitaIva = "IT12345678901",
            AliquotaIva = aliquotaIva,
            Attivo = true,
        };
        _dbContext.Fornitori.Add(fornitore);
        _dbContext.SaveChanges();
        return fornitore;
    }

    private DocumentoTrasporto SeedDdt(Fornitore fornitore, string numero, decimal importo)
    {
        var ddt = new DocumentoTrasporto
        {
            FornitoreId = fornitore.FornitoreId,
            NumeroDdt = numero,
            DataDdt = new DateTime(2026, 4, 2),
            Importo = importo,
        };
        _dbContext.DocumentiTrasporto.Add(ddt);
        _dbContext.SaveChanges();
        return ddt;
    }

    private static FatturaAcquistoInput InputFattura(
        int fornitoreId,
        decimal imponibile,
        decimal aliquotaIva,
        decimal? importoIva = null,
        int? fatturaId = null) => new()
        {
            FatturaId = fatturaId,
            FornitoreId = fornitoreId,
            NumeroFattura = "FA-CC-001",
            DataFattura = new DateTime(2026, 4, 1),
            Imponibile = imponibile,
            AliquotaIva = aliquotaIva,
            ImportoIva = importoIva,
            Stato = "DA_PAGARE",
        };

    #endregion

    #region Inserimento fattura

    [Fact]
    public async Task MutateAsync_ConImportoIva_UsaLIvaDigitataEIgnoraLAliquota()
    {
        Fornitore fornitore = SeedFornitore();

        // Fattura Cash & Carry: 204,42 di imponibile e 23,08 di IVA stampata (≈11,29%,
        // nessuna aliquota di legge). L'aliquota 22 nell'input non deve entrare nel calcolo.
        FatturaAcquisto fattura = await MutateFattura(
            InputFattura(fornitore.FornitoreId, imponibile: 204.42m, aliquotaIva: 22m, importoIva: 23.08m));

        fattura.Imponibile.Should().Be(204.42m);
        fattura.ImportoIva.Should().Be(23.08m);
        fattura.TotaleConIva.Should().Be(227.50m);
        fattura.IvaCalcolata.Should().BeFalse();
    }

    [Fact]
    public async Task MutateAsync_SenzaImportoIva_CalcolaDallAliquotaComePrima()
    {
        Fornitore fornitore = SeedFornitore();

        FatturaAcquisto fattura = await MutateFattura(
            InputFattura(fornitore.FornitoreId, imponibile: 300m, aliquotaIva: 22m));

        fattura.Imponibile.Should().Be(300m);
        fattura.ImportoIva.Should().Be(66m);
        fattura.TotaleConIva.Should().Be(366m);
        fattura.IvaCalcolata.Should().BeTrue();
    }

    [Fact]
    public async Task MutateAsync_RimettendoLaSpunta_TornaACalcolareDallAliquota()
    {
        Fornitore fornitore = SeedFornitore();
        FatturaAcquisto fattura = await MutateFattura(
            InputFattura(fornitore.FornitoreId, imponibile: 204.42m, aliquotaIva: 22m, importoIva: 23.08m));

        FatturaAcquisto riscritta = await MutateFattura(
            InputFattura(fornitore.FornitoreId, imponibile: 204.42m, aliquotaIva: 22m,
                fatturaId: fattura.FatturaId));

        riscritta.IvaCalcolata.Should().BeTrue();
        riscritta.ImportoIva.Should().Be(44.97m);
    }

    #endregion

    #region Prelievo DDT

    [Fact]
    public async Task AssociaDdt_SuFatturaConIvaDigitata_CongelaLIvaEMuoveLImponibile()
    {
        Fornitore fornitore = SeedFornitore();
        FatturaAcquisto fattura = await MutateFattura(
            InputFattura(fornitore.FornitoreId, imponibile: 204.42m, aliquotaIva: 22m, importoIva: 23.08m));
        DocumentoTrasporto ddt = SeedDdt(fornitore, "DDT-CC-1", 300m);

        FatturaAcquisto aggiornata = await _orchestrator.AssociaDdtAsync(
            fattura.FatturaId, [ddt.DdtId]);

        // Il totale segue i DDT, l'IVA resta quella letta dal documento, l'imponibile è il resto.
        aggiornata.TotaleConIva.Should().Be(300m);
        aggiornata.ImportoIva.Should().Be(23.08m);
        aggiornata.Imponibile.Should().Be(276.92m);
        (aggiornata.Imponibile + aggiornata.ImportoIva!.Value).Should().Be(300m);
    }

    [Fact]
    public async Task AssociaDdt_ConIvaDigitataPariAUnAliquotaDiLegge_CongelaComunque()
    {
        // Il flag persistito chiude il buco che la deduzione dagli importi lasciava aperto:
        // 22,00 su 100,00 è aritmeticamente un 22% ma l'operatore l'ha digitato, quindi resta.
        Fornitore fornitore = SeedFornitore();
        FatturaAcquisto fattura = await MutateFattura(
            InputFattura(fornitore.FornitoreId, imponibile: 100m, aliquotaIva: 22m, importoIva: 22m));
        DocumentoTrasporto ddt = SeedDdt(fornitore, "DDT-CC-22", 300m);

        FatturaAcquisto aggiornata = await _orchestrator.AssociaDdtAsync(
            fattura.FatturaId, [ddt.DdtId]);

        aggiornata.TotaleConIva.Should().Be(300m);
        aggiornata.ImportoIva.Should().Be(22m);
        aggiornata.Imponibile.Should().Be(278m);
    }

    [Fact]
    public async Task AssociaDdt_SuFatturaMonoaliquota_RiscorporaComePrima()
    {
        Fornitore fornitore = SeedFornitore();
        FatturaAcquisto fattura = await MutateFattura(
            InputFattura(fornitore.FornitoreId, imponibile: 200m, aliquotaIva: 22m));
        DocumentoTrasporto ddt = SeedDdt(fornitore, "DDT-MONO-1", 244m);

        FatturaAcquisto aggiornata = await _orchestrator.AssociaDdtAsync(
            fattura.FatturaId, [ddt.DdtId]);

        // Scenario della spec calcoli-iva: 244 al 22% → 200 / 44. Comportamento invariato.
        aggiornata.TotaleConIva.Should().Be(244m);
        aggiornata.Imponibile.Should().Be(200m);
        aggiornata.ImportoIva.Should().Be(44m);
    }

    [Fact]
    public async Task DisassociaDdt_SuFatturaConIvaDigitata_CongelaLIva()
    {
        Fornitore fornitore = SeedFornitore();
        FatturaAcquisto fattura = await MutateFattura(
            InputFattura(fornitore.FornitoreId, imponibile: 204.42m, aliquotaIva: 22m, importoIva: 23.08m));
        DocumentoTrasporto primo = SeedDdt(fornitore, "DDT-CC-A", 300m);
        DocumentoTrasporto secondo = SeedDdt(fornitore, "DDT-CC-B", 120m);
        await _orchestrator.AssociaDdtAsync(fattura.FatturaId, [primo.DdtId, secondo.DdtId]);

        FatturaAcquisto aggiornata = await _orchestrator.DisassociaDdtAsync(
            fattura.FatturaId, [secondo.DdtId]);

        aggiornata.TotaleConIva.Should().Be(300m);
        aggiornata.ImportoIva.Should().Be(23.08m);
        aggiornata.Imponibile.Should().Be(276.92m);
    }

    #endregion

    #region Pagamento fornitore da registro cassa

    [Fact]
    public async Task CreaOCollega_ConImportoIva_RipartisceIlLordoConLIvaDigitata()
    {
        Fornitore fornitore = SeedFornitore();
        var service = new DocumentiFornitoreService(_dbContext);

        var dati = new DocumentiFornitoreService.DatiDocumento(
            FornitoreId: fornitore.FornitoreId,
            TipoDocumento: "FA",
            Numero: "FA-CASSA-1",
            DataDocumento: new DateTime(2026, 4, 5),
            Importo: 227.50m,
            AliquotaIva: 22m,
            FatturaIdCollegata: null,
            DdtIdCollegato: null,
            ImportoIva: 23.08m);

        (int? fatturaId, int? ddtId) = await service.CreaOCollegaAsync(
            dati, new DateTime(2026, 4, 5), registroCassaCorrente: null, [], []);

        ddtId.Should().BeNull();
        FatturaAcquisto creata = await _dbContext.FattureAcquisto.FirstAsync(f => f.FatturaId == fatturaId);
        creata.TotaleConIva.Should().Be(227.50m);
        creata.ImportoIva.Should().Be(23.08m);
        creata.Imponibile.Should().Be(204.42m);
        creata.IvaCalcolata.Should().BeFalse();
    }

    [Fact]
    public async Task CreaOCollega_SenzaImportoIva_ScorporaDallAliquotaComePrima()
    {
        Fornitore fornitore = SeedFornitore(aliquotaIva: 10m);
        var service = new DocumentiFornitoreService(_dbContext);

        var dati = new DocumentiFornitoreService.DatiDocumento(
            FornitoreId: fornitore.FornitoreId,
            TipoDocumento: "FA",
            Numero: "FA-CASSA-2",
            DataDocumento: new DateTime(2026, 4, 5),
            Importo: 250m,
            AliquotaIva: null,
            FatturaIdCollegata: null,
            DdtIdCollegato: null);

        (int? fatturaId, _) = await service.CreaOCollegaAsync(
            dati, new DateTime(2026, 4, 5), registroCassaCorrente: null, [], []);

        // Scenario della spec calcoli-iva: 250 al 10% (aliquota fornitore) → 227,27 / 22,73.
        FatturaAcquisto creata = await _dbContext.FattureAcquisto.FirstAsync(f => f.FatturaId == fatturaId);
        creata.Imponibile.Should().Be(227.27m);
        creata.ImportoIva.Should().Be(22.73m);
        creata.TotaleConIva.Should().Be(250m);
        creata.IvaCalcolata.Should().BeTrue();
    }

    #endregion
}
