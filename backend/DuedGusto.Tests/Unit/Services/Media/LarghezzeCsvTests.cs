using duedgusto.Controllers;
using duedgusto.GraphQL.Vetrina.Types;
using duedgusto.Services.Media;

namespace DuedGusto.Tests.Unit.Services.Media;

/// <summary>
/// La conversione dell'elenco delle larghezze è <b>una sola</b> ed è <b>tollerante</b>.
///
/// <para>🔴 Prima della change ne esistevano due, divergenti: quella di
/// <c>MediaController</c> usava <c>int.Parse</c> e sollevava su un CSV sporco, quella di
/// <c>MediaAssetType</c> scartava il valore e proseguiva. La stessa conversione viene ora
/// eseguita anche dalla rotta <b>anonima</b> del menu pubblico, dove un'eccezione su una riga
/// malformata non è un errore di validazione: è un <b>500 servito a un visitatore</b> per
/// colpa di un'immagine su cento.</para>
/// </summary>
public class LarghezzeCsvTests
{
    [Fact]
    public void Leggi_ConValoreVuoto_RestituisceElencoVuoto()
    {
        LarghezzeCsv.Leggi("").Should().BeEmpty();
    }

    [Fact]
    public void Leggi_ConValoreNullo_RestituisceElencoVuoto()
    {
        LarghezzeCsv.Leggi(null).Should().BeEmpty();
    }

    [Fact]
    public void Leggi_ConSoliSpazi_RestituisceElencoVuoto()
    {
        LarghezzeCsv.Leggi("   ").Should().BeEmpty();
    }

    [Fact]
    public void Leggi_ConValoreSporco_ScartaIlNonNumericoESalvaIlResto()
    {
        LarghezzeCsv.Leggi("400,x,800").Should().Equal(400, 800);
    }

    [Fact]
    public void Leggi_ConValoreRegolare_RestituisceTuttiINumeriNellOrdineScritto()
    {
        LarghezzeCsv.Leggi("400,800,1200,1600").Should().Equal(400, 800, 1200, 1600);
    }

    [Fact]
    public void Leggi_TolleraSpaziESeparatoriVuoti()
    {
        LarghezzeCsv.Leggi(" 400 , ,800 ").Should().Equal(400, 800);
    }

    /// <summary>
    /// 🔴 Il test che descrive il motivo per cui la classe esiste: <b>nessun input solleva</b>.
    /// Se un giorno la semantica tornasse a <c>int.Parse</c>, questo diventa rosso prima che
    /// se ne accorga un visitatore del sito.
    /// </summary>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(",,,")]
    [InlineData("abc")]
    [InlineData("400,x,800")]
    [InlineData("-400,800")]
    [InlineData("99999999999999999999")]
    [InlineData("400.5")]
    public void Leggi_NonSollevaMaiSuAlcunInput(string? csv)
    {
        Action lettura = () => LarghezzeCsv.Leggi(csv);

        lettura.Should().NotThrow();
    }

    // ── I due consumatori preesistenti (task 2.2, 2.3) ───────────────────────────────────

    /// <summary>
    /// Su un valore regolare i due consumatori restituiscono <b>gli stessi numeri di prima
    /// della change</b>: la deduplicazione non doveva cambiare il contratto di nessuno dei due,
    /// solo far sparire la divergenza sui valori sporchi.
    /// </summary>
    [Fact]
    public void IDueConsumatoriPreesistenti_SuUnValoreRegolare_RestituisconoGliStessiNumeri()
    {
        const string regolare = "400,800,1200";

        MediaController.LeggiLarghezze(regolare).Should().Equal(400, 800, 1200);
        MediaAssetType.LeggiLarghezze(regolare).Should().Equal(400, 800, 1200);
    }

    /// <summary>
    /// 🔴 La variante che sollevava non sopravvive. Prima della change questa chiamata
    /// lanciava <see cref="FormatException"/> dentro <c>MediaController</c> e restituiva
    /// <c>[400, 800]</c> in <c>MediaAssetType</c>: due comportamenti diversi sullo stesso dato.
    /// </summary>
    [Fact]
    public void IDueConsumatoriPreesistenti_SuUnValoreSporco_ScartanoEntrambiSenzaSollevare()
    {
        const string sporco = "400,x,800";

        MediaController.LeggiLarghezze(sporco).Should().Equal(400, 800);
        MediaAssetType.LeggiLarghezze(sporco).Should().Equal(400, 800);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("400")]
    [InlineData("400,x,800")]
    [InlineData("400,800,1200,1600")]
    public void IDueConsumatoriPreesistenti_DeleganoAllaStessaSede(string? csv)
    {
        int[] atteso = LarghezzeCsv.Leggi(csv);

        MediaController.LeggiLarghezze(csv).Should().Equal(atteso);
        MediaAssetType.LeggiLarghezze(csv).Should().Equal(atteso);
    }
}
