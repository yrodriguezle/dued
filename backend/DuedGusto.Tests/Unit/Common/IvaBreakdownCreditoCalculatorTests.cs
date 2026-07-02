using duedgusto.Common;
using duedgusto.Models;

namespace DuedGusto.Tests.Unit.Common;

/// <summary>
/// Tests for IvaBreakdownCreditoCalculator — IVA a credito (acquisti) calcolata al volo
/// dai pagamenti fornitori. Dato gestionale di cassa (scorporo del pagato), non fiscale.
/// FATTURA con ImportoIva = dato certo (Stimato=false); DDT e fatture senza IVA = stima.
/// </summary>
public class IvaBreakdownCreditoCalculatorTests
{
    private static PagamentoFornitore PagamentoDaFattura(
        decimal importo, decimal imponibileFattura, decimal? ivaFattura, decimal aliquotaFornitore = 22m)
        => new()
        {
            Importo = importo,
            FatturaId = 1,
            Fattura = new FatturaAcquisto
            {
                Imponibile = imponibileFattura,
                ImportoIva = ivaFattura,
                Fornitore = new Fornitore { AliquotaIva = aliquotaFornitore },
            },
        };

    private static PagamentoFornitore PagamentoDaDdt(decimal importo, decimal? aliquotaFornitore = 22m)
        => new()
        {
            Importo = importo,
            DdtId = 1,
            Ddt = new DocumentoTrasporto
            {
                Fornitore = new Fornitore { AliquotaIva = aliquotaFornitore },
            },
        };

    [Fact]
    public void Calcola_FatturaConIva_ScorporoDaCertoNonStimato()
    {
        // Fattura 22%: pagamento lordo 122.00 → imponibile 100.00, iva 22.00, Stimato=false
        var pagamenti = new[] { PagamentoDaFattura(122.00m, imponibileFattura: 100m, ivaFattura: 22m) };

        IReadOnlyList<RigaBreakdownIvaCredito> righe = IvaBreakdownCreditoCalculator.Calcola(pagamenti);

        righe.Should().ContainSingle();
        righe[0].Aliquota.Should().Be(22.00m);
        righe[0].Imponibile.Should().Be(100.00m);
        righe[0].Imposta.Should().Be(22.00m);
        righe[0].Fonte.Should().Be(RigaBreakdownIvaCredito.FonteFattura);
        righe[0].Stimato.Should().BeFalse();
        righe[0].AliquotaMista.Should().BeFalse();
    }

    [Fact]
    public void Calcola_Ddt_MarcatoStimatoConAliquotaFornitore()
    {
        // DDT non fatturato: nessun diritto certo di detrazione → Stimato=true, aliquota presuntiva
        var pagamenti = new[] { PagamentoDaDdt(110.00m, aliquotaFornitore: 10m) };

        IReadOnlyList<RigaBreakdownIvaCredito> righe = IvaBreakdownCreditoCalculator.Calcola(pagamenti);

        righe.Should().ContainSingle();
        righe[0].Aliquota.Should().Be(10.00m);
        righe[0].Imponibile.Should().Be(100.00m);
        righe[0].Imposta.Should().Be(10.00m);
        righe[0].Fonte.Should().Be(RigaBreakdownIvaCredito.FonteDdt);
        righe[0].Stimato.Should().BeTrue();
    }

    [Fact]
    public void Calcola_FatturaSenzaImportoIva_FallbackAliquotaFornitoreStimato()
    {
        // Fattura priva di ImportoIva persistito → stima su aliquota fornitore
        var pagamenti = new[] { PagamentoDaFattura(122.00m, imponibileFattura: 100m, ivaFattura: null, aliquotaFornitore: 22m) };

        IReadOnlyList<RigaBreakdownIvaCredito> righe = IvaBreakdownCreditoCalculator.Calcola(pagamenti);

        righe.Should().ContainSingle();
        righe[0].Aliquota.Should().Be(22.00m);
        righe[0].Fonte.Should().Be(RigaBreakdownIvaCredito.FonteFattura);
        righe[0].Stimato.Should().BeTrue();
    }

    [Fact]
    public void Calcola_FatturaMultialiquota_AliquotaMistaFlaggata()
    {
        // Fattura con IVA/imponibile che dà un'aliquota implicita non di legge (15.30%)
        // imponibile 100, iva 15.30 → 15.30% non ∈ {0,4,5,10,22} → AliquotaMista=true
        var pagamenti = new[] { PagamentoDaFattura(115.30m, imponibileFattura: 100m, ivaFattura: 15.30m) };

        IReadOnlyList<RigaBreakdownIvaCredito> righe = IvaBreakdownCreditoCalculator.Calcola(pagamenti);

        righe.Should().ContainSingle();
        righe[0].Aliquota.Should().Be(15.30m);
        righe[0].AliquotaMista.Should().BeTrue();
        righe[0].Stimato.Should().BeFalse();
    }

    [Fact]
    public void Calcola_MixFatturaEDdt_FattureOrdinatePrimaSommaPerAliquota()
    {
        // 2 pagamenti FA 22% (122+61=183) + 1 DDT 10% (110); FA prima, DDT dopo (stima)
        var pagamenti = new[]
        {
            PagamentoDaFattura(122.00m, imponibileFattura: 100m, ivaFattura: 22m),
            PagamentoDaFattura(61.00m, imponibileFattura: 50m, ivaFattura: 11m),
            PagamentoDaDdt(110.00m, aliquotaFornitore: 10m),
        };

        IReadOnlyList<RigaBreakdownIvaCredito> righe = IvaBreakdownCreditoCalculator.Calcola(pagamenti);

        righe.Should().HaveCount(2);
        // Riga FATTURA 22% aggregata (Σ scorpori: 100+50 imponibile, 22+11 iva)
        righe[0].Fonte.Should().Be(RigaBreakdownIvaCredito.FonteFattura);
        righe[0].Aliquota.Should().Be(22.00m);
        righe[0].Imponibile.Should().Be(150.00m);
        righe[0].Imposta.Should().Be(33.00m);
        righe[0].Stimato.Should().BeFalse();
        // Riga DDT 10% stimata, dopo la fattura
        righe[1].Fonte.Should().Be(RigaBreakdownIvaCredito.FonteDdt);
        righe[1].Aliquota.Should().Be(10.00m);
        righe[1].Stimato.Should().BeTrue();
    }

    [Fact]
    public void Calcola_PagamentoSenzaFatturaNeDdt_Ignorato()
    {
        var pagamenti = new[] { new PagamentoFornitore { Importo = 50m } };

        IReadOnlyList<RigaBreakdownIvaCredito> righe = IvaBreakdownCreditoCalculator.Calcola(pagamenti);

        righe.Should().BeEmpty();
    }
}
