using duedgusto.Common;

namespace DuedGusto.Tests.Unit.Common;

/// <summary>
/// Tests for GiorniNonLavorativiEliminazionePlanner: normalizzazione degli ID richiesti
/// e separazione fra giorni effettivamente eliminabili e ID non più presenti a database.
/// </summary>
public class GiorniNonLavorativiEliminazionePlannerTests
{
    #region Normalizza

    [Fact]
    public void Normalizza_ConDuplicati_LiRimuove()
    {
        IReadOnlyList<int> risultato = GiorniNonLavorativiEliminazionePlanner.Normalizza([3, 1, 3, 1, 2]);

        risultato.Should().Equal(1, 2, 3);
    }

    [Fact]
    public void Normalizza_ConIdNonValidi_LiScarta()
    {
        IReadOnlyList<int> risultato = GiorniNonLavorativiEliminazionePlanner.Normalizza([0, -5, 7]);

        risultato.Should().Equal(7);
    }

    [Fact]
    public void Normalizza_ListaVuota_RestituisceVuota()
    {
        GiorniNonLavorativiEliminazionePlanner.Normalizza([]).Should().BeEmpty();
    }

    #endregion

    #region Pianifica

    [Fact]
    public void Pianifica_TuttiEsistenti_NessunoNonTrovato()
    {
        GiorniNonLavorativiEliminazionePlanner.Piano piano =
            GiorniNonLavorativiEliminazionePlanner.Pianifica([1, 2, 3], [1, 2, 3, 9]);

        piano.DaEliminare.Should().Equal(1, 2, 3);
        piano.NonTrovati.Should().BeEmpty();
    }

    [Fact]
    public void Pianifica_ParzialmenteEsistenti_SeparaIDueInsiemi()
    {
        GiorniNonLavorativiEliminazionePlanner.Piano piano =
            GiorniNonLavorativiEliminazionePlanner.Pianifica([1, 2, 3], [2]);

        piano.DaEliminare.Should().Equal(2);
        piano.NonTrovati.Should().Equal(1, 3);
    }

    [Fact]
    public void Pianifica_NessunoEsistente_DaEliminareVuoto()
    {
        GiorniNonLavorativiEliminazionePlanner.Piano piano =
            GiorniNonLavorativiEliminazionePlanner.Pianifica([4, 5], []);

        piano.DaEliminare.Should().BeEmpty();
        piano.NonTrovati.Should().Equal(4, 5);
    }

    [Fact]
    public void Pianifica_RichiestiConDuplicati_NonDuplicaGliEsiti()
    {
        GiorniNonLavorativiEliminazionePlanner.Piano piano =
            GiorniNonLavorativiEliminazionePlanner.Pianifica([1, 1, 2, 2, 2], [1]);

        piano.DaEliminare.Should().Equal(1);
        piano.NonTrovati.Should().Equal(2);
    }

    [Fact]
    public void Pianifica_RichiestiVuoti_PianoVuoto()
    {
        GiorniNonLavorativiEliminazionePlanner.Piano piano =
            GiorniNonLavorativiEliminazionePlanner.Pianifica([], [1, 2]);

        piano.DaEliminare.Should().BeEmpty();
        piano.NonTrovati.Should().BeEmpty();
    }

    [Fact]
    public void MaxGiorni_AllineatoAlLimiteDellaCreazioneRange()
    {
        GiorniNonLavorativiEliminazionePlanner.MaxGiorni
            .Should().Be(GiorniNonLavorativiRangePlanner.MaxGiorni);
    }

    #endregion
}
