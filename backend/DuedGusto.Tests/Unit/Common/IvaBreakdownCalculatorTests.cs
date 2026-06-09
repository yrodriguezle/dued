using duedgusto.Common;

namespace DuedGusto.Tests.Unit.Common;

/// <summary>
/// Tests for IvaBreakdownCalculator (iva-multialiquota-fase3, spec gestione-cassa).
/// Calculator puro: parte esatta = somma degli scorpori di riga per aliquota
/// (MAI scorporo della somma), residuo non itemizzato stimato all'aliquota di default,
/// clamp a 0 del residuo negativo (mai bloccare il salvataggio).
/// </summary>
public class IvaBreakdownCalculatorTests
{
    private static Vendita CreaVendita(decimal prezzoTotale, decimal aliquotaPercentuale)
    {
        RisultatoIva scorporo = IvaCalculator.ScorporaDaLordo(
            prezzoTotale, IvaCalculator.AliquotaDaPercentuale(aliquotaPercentuale));
        return new Vendita
        {
            PrezzoTotale = prezzoTotale,
            AliquotaIva = aliquotaPercentuale,
            Imponibile = scorporo.Imponibile,
            ImportoIva = scorporo.Iva,
        };
    }

    [Fact]
    public void Calcola_SenzaVendite_RigaUnicaStimataIdenticaAlloScorporoLegacy()
    {
        // Scenario spec "Registro senza vendite itemizzate": 80.00 al 10% → (10.00, 72.73, 7.27, stimato)
        EsitoBreakdownIva esito = IvaBreakdownCalculator.Calcola([], 80.00m, 0.10m);

        esito.Righe.Should().ContainSingle();
        esito.Righe[0].Should().Be(new RigaBreakdownIva(10.00m, 72.73m, 7.27m, true));
        esito.TotaleItemizzato.Should().Be(0m);
        esito.ResiduoOriginale.Should().Be(80.00m);
        esito.ResiduoClampato.Should().BeFalse();

        // ImportoIva equivalente al calcolo single-rate pre-change
        esito.Righe[0].Imposta.Should().Be(IvaCalculator.ScorporaDaLordo(80.00m, 0.10m).Iva);
    }

    [Fact]
    public void Calcola_VenditeMultialiquota_RigheEsattePerAliquotaPiuResiduoStimato()
    {
        // Scenario spec "Registro con vendite ad aliquote miste":
        // totale 100.00, vendite 36.60 @22 (30.00/6.60) e 22.00 @10 (20.00/2.00) → residuo 41.40
        List<Vendita> vendite = [CreaVendita(36.60m, 22m), CreaVendita(22.00m, 10m)];

        EsitoBreakdownIva esito = IvaBreakdownCalculator.Calcola(vendite, 100.00m, 0.22m);

        esito.Righe.Should().HaveCount(3);
        esito.Righe[0].Should().Be(new RigaBreakdownIva(22.00m, 30.00m, 6.60m, false));
        esito.Righe[1].Should().Be(new RigaBreakdownIva(10.00m, 20.00m, 2.00m, false));

        // Residuo 41.40 scorporato all'aliquota di default (22%)
        RisultatoIva residuoAtteso = IvaCalculator.ScorporaDaLordo(41.40m, 0.22m);
        esito.Righe[2].Should().Be(new RigaBreakdownIva(
            22.00m, residuoAtteso.Imponibile, residuoAtteso.Iva, true));

        esito.TotaleItemizzato.Should().Be(58.60m);
        esito.ResiduoOriginale.Should().Be(41.40m);
        esito.ResiduoClampato.Should().BeFalse();

        // Invariante: Σ (Imponibile + Imposta) == TotaleVendite al centesimo
        esito.Righe.Sum(r => r.Imponibile + r.Imposta).Should().Be(100.00m);
    }

    [Fact]
    public void Calcola_RegistroInteramenteItemizzato_NessunaRigaStimata()
    {
        // Scenario spec "Registro interamente itemizzato": Σ PrezzoTotale == TotaleVendite
        List<Vendita> vendite = [CreaVendita(36.60m, 22m), CreaVendita(22.00m, 10m)];

        EsitoBreakdownIva esito = IvaBreakdownCalculator.Calcola(vendite, 58.60m, 0.22m);

        esito.Righe.Should().HaveCount(2);
        esito.Righe.Should().OnlyContain(r => !r.Stimato);
        esito.ResiduoOriginale.Should().Be(0m);
        esito.ResiduoClampato.Should().BeFalse();
    }

    [Fact]
    public void Calcola_ResiduoNegativo_ClampSenzaRigaStimata()
    {
        // Scenario spec "Residuo negativo": totale 50.00, vendite per 60.00
        List<Vendita> vendite = [CreaVendita(60.00m, 22m)];

        EsitoBreakdownIva esito = IvaBreakdownCalculator.Calcola(vendite, 50.00m, 0.22m);

        esito.Righe.Should().ContainSingle(r => !r.Stimato);
        esito.ResiduoOriginale.Should().Be(-10.00m);
        esito.ResiduoClampato.Should().BeTrue();

        // ImportoIva == Σ imposte esatte (nessun contributo stimato)
        esito.Righe.Sum(r => r.Imposta).Should().Be(vendite.Sum(v => v.ImportoIva));
    }

    [Fact]
    public void Calcola_VenditeAdAliquotaDefaultPiuResiduo_DueRigheStessaAliquotaConStimatoDiverso()
    {
        // Aliquota vendite == aliquota default: l'unique (RegistroCassaId, Aliquota, Stimato)
        // ammette DUE righe alla stessa aliquota purché con Stimato diverso
        List<Vendita> vendite = [CreaVendita(36.60m, 22m)];

        EsitoBreakdownIva esito = IvaBreakdownCalculator.Calcola(vendite, 100.00m, 0.22m);

        esito.Righe.Should().HaveCount(2);
        esito.Righe.Should().OnlyContain(r => r.Aliquota == 22.00m);
        esito.Righe.Count(r => r.Stimato).Should().Be(1);
        esito.Righe.Count(r => !r.Stimato).Should().Be(1);
    }

    [Fact]
    public void Calcola_VenditeAdAliquotaZero_RigaConImpostaZero()
    {
        // Scenario spec "Vendite ad aliquota zero": 5.00 a 0% → (0.00, 5.00, 0.00)
        List<Vendita> vendite = [CreaVendita(5.00m, 0m)];

        EsitoBreakdownIva esito = IvaBreakdownCalculator.Calcola(vendite, 5.00m, 0.22m);

        esito.Righe.Should().ContainSingle();
        esito.Righe[0].Should().Be(new RigaBreakdownIva(0.00m, 5.00m, 0.00m, false));
    }

    [Fact]
    public void Calcola_SommaScorporiDiRiga_NonScorporoDellaSomma()
    {
        // Scenario spec "Coerenza al centesimo": tre vendite da 0.18 al 22% —
        // gli scorpori di riga sommati (0.45/0.09) divergono dallo scorporo
        // del totale 0.54 (0.44/0.10): la riga esatta DEVE riportare la somma di riga
        List<Vendita> vendite = [CreaVendita(0.18m, 22m), CreaVendita(0.18m, 22m), CreaVendita(0.18m, 22m)];

        RisultatoIva scorporoDellaSomma = IvaCalculator.ScorporaDaLordo(0.54m, 0.22m);
        RigaBreakdownIva riga = IvaBreakdownCalculator.Calcola(vendite, 0.54m, 0.22m).Righe.Single();

        riga.Imponibile.Should().Be(0.45m);
        riga.Imposta.Should().Be(0.09m);
        riga.Imponibile.Should().NotBe(scorporoDellaSomma.Imponibile,
            "la riga esatta è la SOMMA degli scorpori di riga, non lo scorporo della somma");

        // Coerenza con il dettaglio: imponibile + imposta == Σ PrezzoTotale dell'aliquota
        (riga.Imponibile + riga.Imposta).Should().Be(0.54m);
    }

    [Theory]
    // (totaleVendite, lordo1@22, lordo2@10): invariante senza clamp
    [InlineData("100.00", "36.60", "22.00")]
    [InlineData("58.60", "36.60", "22.00")]
    [InlineData("123.45", "0.18", "1.20")]
    [InlineData("99.99", "10.01", "0.05")]
    public void Calcola_SenzaClamp_SommaRigheUgualeTotaleVendite(
        string totaleStr, string lordo22Str, string lordo10Str)
    {
        decimal totale = decimal.Parse(totaleStr, System.Globalization.CultureInfo.InvariantCulture);
        decimal lordo22 = decimal.Parse(lordo22Str, System.Globalization.CultureInfo.InvariantCulture);
        decimal lordo10 = decimal.Parse(lordo10Str, System.Globalization.CultureInfo.InvariantCulture);
        List<Vendita> vendite = [CreaVendita(lordo22, 22m), CreaVendita(lordo10, 10m)];

        EsitoBreakdownIva esito = IvaBreakdownCalculator.Calcola(vendite, totale, 0.22m);

        esito.ResiduoClampato.Should().BeFalse();
        esito.Righe.Sum(r => r.Imponibile + r.Imposta).Should().Be(totale,
            "senza clamp Σ (Imponibile + Imposta) deve coincidere con TotaleVendite al centesimo");
    }

    [Fact]
    public void Calcola_VenditaAImportoZero_RigaNonEmessa()
    {
        // Righe a importi tutti zero non vengono emesse
        List<Vendita> vendite = [CreaVendita(0m, 22m)];

        EsitoBreakdownIva esito = IvaBreakdownCalculator.Calcola(vendite, 0m, 0.22m);

        esito.Righe.Should().BeEmpty();
    }
}
