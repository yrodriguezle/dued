using duedgusto.Common;

namespace DuedGusto.Tests.Unit.Common;

/// <summary>
/// Tests for IvaCalculator (coerenza-calcoli-fase2, spec calcoli-iva).
/// Verifica scorporo da lordo (IVA per differenza), applicazione su imponibile,
/// convenzione aliquota FRAZIONE con conversione esplicita da percentuale,
/// MidpointRounding.ToEven esplicito e l'equivalenza con le vecchie formule inline.
/// </summary>
public class IvaCalculatorTests
{
    #region ScorporaDaLordo

    [Theory]
    // Scorporo esatto: lordo 122, aliquota 22% → 100 / 22
    [InlineData("122.00", "0.22", "100.00", "22.00")]
    // Scorporo con arrotondamento — l'IVA è la differenza, non un Round indipendente
    [InlineData("100.00", "0.22", "81.97", "18.03")]
    // Fattura da pagamento al 10% (scenario spec): 250 → 227.27 / 22.73
    [InlineData("250.00", "0.10", "227.27", "22.73")]
    // Ricalcolo da DDT (scenario spec): 244 al 22% → 200 / 44
    [InlineData("244.00", "0.22", "200.00", "44.00")]
    // Importi negativi simmetrici (storni/rettifiche)
    [InlineData("-122.00", "0.22", "-100.00", "-22.00")]
    [InlineData("-100.00", "0.22", "-81.97", "-18.03")]
    public void ScorporaDaLordo_ReturnsExpectedAmounts(
        string lordoStr, string aliquotaStr, string imponibileStr, string ivaStr)
    {
        decimal lordo = decimal.Parse(lordoStr, System.Globalization.CultureInfo.InvariantCulture);
        decimal aliquota = decimal.Parse(aliquotaStr, System.Globalization.CultureInfo.InvariantCulture);
        decimal imponibileAtteso = decimal.Parse(imponibileStr, System.Globalization.CultureInfo.InvariantCulture);
        decimal ivaAttesa = decimal.Parse(ivaStr, System.Globalization.CultureInfo.InvariantCulture);

        RisultatoIva risultato = IvaCalculator.ScorporaDaLordo(lordo, aliquota);

        risultato.Imponibile.Should().Be(imponibileAtteso);
        risultato.Iva.Should().Be(ivaAttesa);
        risultato.Totale.Should().Be(lordo);
        // Invariante: imponibile + IVA = lordo al centesimo, sempre
        (risultato.Imponibile + risultato.Iva).Should().Be(lordo);
    }

    [Fact]
    public void ScorporaDaLordo_AliquotaZero_ReturnsLordoSenzaIva()
    {
        RisultatoIva risultato = IvaCalculator.ScorporaDaLordo(50m, 0m);

        risultato.Imponibile.Should().Be(50m);
        risultato.Iva.Should().Be(0m);
        risultato.Totale.Should().Be(50m);
    }

    [Fact]
    public void ScorporaDaLordo_AliquotaNegativa_Throws()
    {
        Action act = () => IvaCalculator.ScorporaDaLordo(100m, -0.22m);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    #endregion

    #region ApplicaSuImponibile

    [Theory]
    // Applicazione esatta: imponibile 100, aliquota 22% → IVA 22, totale 122
    [InlineData("100.00", "0.22", "22.00", "122.00")]
    // Scenario spec fattura acquisto: imponibile 300 al 22% → 66 / 366
    [InlineData("300.00", "0.22", "66.00", "366.00")]
    // Importi negativi simmetrici
    [InlineData("-100.00", "0.22", "-22.00", "-122.00")]
    public void ApplicaSuImponibile_ReturnsExpectedAmounts(
        string imponibileStr, string aliquotaStr, string ivaStr, string totaleStr)
    {
        decimal imponibile = decimal.Parse(imponibileStr, System.Globalization.CultureInfo.InvariantCulture);
        decimal aliquota = decimal.Parse(aliquotaStr, System.Globalization.CultureInfo.InvariantCulture);
        decimal ivaAttesa = decimal.Parse(ivaStr, System.Globalization.CultureInfo.InvariantCulture);
        decimal totaleAtteso = decimal.Parse(totaleStr, System.Globalization.CultureInfo.InvariantCulture);

        RisultatoIva risultato = IvaCalculator.ApplicaSuImponibile(imponibile, aliquota);

        risultato.Imponibile.Should().Be(imponibile);
        risultato.Iva.Should().Be(ivaAttesa);
        risultato.Totale.Should().Be(totaleAtteso);
        (risultato.Imponibile + risultato.Iva).Should().Be(risultato.Totale);
    }

    [Fact]
    public void ApplicaSuImponibile_AliquotaZero_ReturnsImponibileSenzaIva()
    {
        RisultatoIva risultato = IvaCalculator.ApplicaSuImponibile(50m, 0m);

        risultato.Iva.Should().Be(0m);
        risultato.Totale.Should().Be(50m);
    }

    [Fact]
    public void ApplicaSuImponibile_AliquotaNegativa_Throws()
    {
        Action act = () => IvaCalculator.ApplicaSuImponibile(100m, -0.10m);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void ApplicaSuImponibile_Midpoint_UsaToEven()
    {
        // 1.25 × 0.02 = 0.025 → midpoint: ToEven arrotonda a 0.02 (AwayFromZero darebbe 0.03).
        // Documenta il MidpointRounding scelto (identico al default delle vecchie formule inline).
        RisultatoIva risultato = IvaCalculator.ApplicaSuImponibile(1.25m, 0.02m);

        risultato.Iva.Should().Be(0.02m);
        risultato.Totale.Should().Be(1.27m);
    }

    #endregion

    #region AliquotaDaPercentuale e identità di convenzione

    [Fact]
    public void AliquotaDaPercentuale_ConverteInFrazione()
    {
        IvaCalculator.AliquotaDaPercentuale(22m).Should().Be(0.22m);
        IvaCalculator.AliquotaDaPercentuale(10m).Should().Be(0.10m);
        IvaCalculator.AliquotaDaPercentuale(0m).Should().Be(0m);
    }

    [Theory]
    [InlineData("122.00", 22)]
    [InlineData("100.00", 22)]
    [InlineData("250.00", 10)]
    [InlineData("99.99", 4)]
    public void ScorporaDaLordo_FrazioneEPercentualeConvertita_StessoRisultato(
        string lordoStr, int percentuale)
    {
        // Scenario spec: VatRate frazione (0.22) e AliquotaIva percentuale (22)
        // normalizzate verso la stessa convenzione producono risultati identici al centesimo.
        decimal lordo = decimal.Parse(lordoStr, System.Globalization.CultureInfo.InvariantCulture);
        decimal frazione = percentuale / 100m;

        RisultatoIva daFrazione = IvaCalculator.ScorporaDaLordo(lordo, frazione);
        RisultatoIva daPercentuale = IvaCalculator.ScorporaDaLordo(
            lordo, IvaCalculator.AliquotaDaPercentuale(percentuale));

        daPercentuale.Should().Be(daFrazione);
    }

    #endregion

    #region IsAliquotaAmmessa (iva-multialiquota-fase3)

    [Theory]
    [InlineData("0", true)]
    [InlineData("4", true)]
    [InlineData("5", true)]
    [InlineData("10", true)]
    [InlineData("22", true)]
    [InlineData("7", false)]
    [InlineData("21", false)]
    [InlineData("-1", false)]
    [InlineData("22.5", false)]
    public void IsAliquotaAmmessa_SoloSetChiuso(string percentualeStr, bool attesa)
    {
        decimal percentuale = decimal.Parse(percentualeStr, System.Globalization.CultureInfo.InvariantCulture);

        IvaCalculator.IsAliquotaAmmessa(percentuale).Should().Be(attesa);
    }

    [Fact]
    public void AliquoteAmmessePercentuali_SetChiusoCentralizzato()
    {
        IvaCalculator.AliquoteAmmessePercentuali.Should().BeEquivalentTo(new[] { 0m, 4m, 5m, 10m, 22m });
    }

    #endregion

    #region Equivalenza con le vecchie formule inline (design, Decisione 2)

    [Theory]
    // Lordi con ≤2 decimali su aliquote reali: con 22%/10%/4% il quoziente non produce
    // mai un midpoint esatto (es. al 22% servirebbe un denominatore 61, primo), quindi
    // l'equivalenza vale per complementarità delle parti frazionarie.
    [InlineData("100.00", "0.22")]
    [InlineData("123.45", "0.22")]
    [InlineData("99.99", "0.22")]
    [InlineData("0.01", "0.22")]
    [InlineData("250.00", "0.10")]
    [InlineData("33.33", "0.10")]
    [InlineData("77.77", "0.04")]
    // Casi midpoint costruiti (aliquota 300%): lordo/4 produce imponibile x.xx5 esatto.
    // 0.10/4 = 0.025 → ToEven 0.02 (IVA 0.08); 0.30/4 = 0.075 → ToEven 0.08 (IVA 0.22).
    [InlineData("0.10", "3.00")]
    [InlineData("0.30", "3.00")]
    [InlineData("0.50", "3.00")]
    public void ScorporaDaLordo_EquivaleAllaVecchiaFormulaDiCalcolaTotali(
        string lordoStr, string aliquotaStr)
    {
        decimal lordo = decimal.Parse(lordoStr, System.Globalization.CultureInfo.InvariantCulture);
        decimal aliquota = decimal.Parse(aliquotaStr, System.Globalization.CultureInfo.InvariantCulture);

        // Vecchia formula di MutateRegistroCassaOrchestrator.CalcolaTotali:
        // arrotondava l'IVA direttamente invece dell'imponibile.
        decimal ivaVecchiaFormula = Math.Round(
            lordo * (aliquota / (1 + aliquota)), 2, MidpointRounding.ToEven);

        RisultatoIva risultato = IvaCalculator.ScorporaDaLordo(lordo, aliquota);

        risultato.Iva.Should().Be(ivaVecchiaFormula,
            "lordo − Round(lordo/(1+a), 2) deve coincidere con Round(lordo·a/(1+a), 2) con ToEven");
        (risultato.Imponibile + risultato.Iva).Should().Be(lordo);
    }

    [Theory]
    [InlineData("100.00", 22)]
    [InlineData("123.45", 22)]
    [InlineData("250.00", 10)]
    [InlineData("0.01", 22)]
    public void ApplicaSuImponibile_EquivaleAllaVecchiaFormulaInline(
        string imponibileStr, int aliquotaPercentuale)
    {
        decimal imponibile = decimal.Parse(imponibileStr, System.Globalization.CultureInfo.InvariantCulture);

        // Vecchia formula di FatturaAcquistoOrchestrator.MutateAsync
        decimal ivaVecchiaFormula = Math.Round(imponibile * aliquotaPercentuale / 100, 2);

        RisultatoIva risultato = IvaCalculator.ApplicaSuImponibile(
            imponibile, IvaCalculator.AliquotaDaPercentuale(aliquotaPercentuale));

        risultato.Iva.Should().Be(ivaVecchiaFormula);
        risultato.Totale.Should().Be(imponibile + ivaVecchiaFormula);
    }

    #endregion
}
