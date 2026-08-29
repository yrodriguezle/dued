using duedgusto.Common;

namespace DuedGusto.Tests.Unit.Common;

/// <summary>
/// L'insieme degli stati dell'ordine è <b>chiuso</b>, e sono cinque.
///
/// <para>Non è un test di cortesia su un elenco di costanti. <c>SPLITTATO</c> è arrivato tardi, e
/// la sua assenza aveva prodotto un guasto vero: senza uno stato per il padre di uno split, quel
/// padre sarebbe rimasto <c>APERTO</c> per sempre — bloccando la chiusura di cassa su un incasso
/// <b>già dichiarato</b> dai figli, e senza via d'uscita, perché annullarlo avrebbe scritto una
/// falsità. Questo test pinna il fatto che siano cinque, così che una riscrittura distratta non
/// possa toglierne uno senza rompere qualcosa di visibile.</para>
/// </summary>
public class StatiOrdineTests
{
    [Theory]
    [InlineData("APERTO")]
    [InlineData("CHIUSO")]
    [InlineData("ANNULLATO")]
    [InlineData("SPLITTATO")]
    [InlineData("STORNATO")]
    public void IsAmmesso_AccettaTuttiECinqueGliStati(string stato)
    {
        StatiOrdine.IsAmmesso(stato).Should().BeTrue();
    }

    [Theory]
    [InlineData("PAGATO")]
    [InlineData("aperto")]      // l'insieme è case sensitive: il confronto è Ordinal
    [InlineData("APERTO ")]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("DRAFT")]       // è uno stato del REGISTRO, non dell'ordine
    public void IsAmmesso_RifiutaQualunqueAltraStringa(string? stato)
    {
        StatiOrdine.IsAmmesso(stato).Should().BeFalse();
    }

    [Fact]
    public void Ammessi_ContieneEsattamenteICinqueStatiDellaMacchina()
    {
        StatiOrdine.Ammessi.Should().Equal(
            StatiOrdine.Aperto,
            StatiOrdine.Chiuso,
            StatiOrdine.Annullato,
            StatiOrdine.Splittato,
            StatiOrdine.Stornato);
    }

    [Fact]
    public void Ammessi_NonHaDuplicati()
    {
        StatiOrdine.Ammessi.Should().OnlyHaveUniqueItems();
    }
}
