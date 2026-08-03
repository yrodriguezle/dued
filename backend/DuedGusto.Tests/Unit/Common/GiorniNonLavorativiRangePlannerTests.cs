using duedgusto.Common;

namespace DuedGusto.Tests.Unit.Common;

/// <summary>
/// Tests for GiorniNonLavorativiRangePlanner: espansione di un intervallo di date
/// (es. ferie) in giorni da creare, con esclusione delle date già configurate.
/// </summary>
public class GiorniNonLavorativiRangePlannerTests
{
    #region ContaGiorni

    [Theory]
    // Stesso giorno → 1 (estremi inclusi)
    [InlineData("2026-08-10", "2026-08-10", 1)]
    // Settimana piena
    [InlineData("2026-08-10", "2026-08-16", 7)]
    // Attraversa il cambio mese
    [InlineData("2026-08-28", "2026-09-02", 6)]
    // Attraversa il 29 febbraio di un anno bisestile
    [InlineData("2028-02-27", "2028-03-01", 4)]
    public void ContaGiorni_IntervalliVari_RestituisceGiorniInclusivi(string inizio, string fine, int atteso)
    {
        DateOnly dataInizio = DateOnly.Parse(inizio);
        DateOnly dataFine = DateOnly.Parse(fine);

        GiorniNonLavorativiRangePlanner.ContaGiorni(dataInizio, dataFine).Should().Be(atteso);
    }

    #endregion

    #region Pianifica

    [Fact]
    public void Pianifica_NessunaDataEsistente_CreaTuttoIntervallo()
    {
        DateOnly inizio = new(2026, 8, 10);
        DateOnly fine = new(2026, 8, 14);

        GiorniNonLavorativiRangePlanner.Piano piano =
            GiorniNonLavorativiRangePlanner.Pianifica(inizio, fine, []);

        piano.DaCreare.Should().HaveCount(5);
        piano.DaCreare.First().Should().Be(inizio);
        piano.DaCreare.Last().Should().Be(fine);
        piano.Saltate.Should().BeEmpty();
        piano.GiorniTotali.Should().Be(5);
    }

    [Fact]
    public void Pianifica_ConDateEsistenti_LeEscludeELeRiporta()
    {
        DateOnly inizio = new(2026, 8, 10);
        DateOnly fine = new(2026, 8, 14);
        DateOnly[] esistenti = [new(2026, 8, 11), new(2026, 8, 13)];

        GiorniNonLavorativiRangePlanner.Piano piano =
            GiorniNonLavorativiRangePlanner.Pianifica(inizio, fine, esistenti);

        piano.DaCreare.Should().BeEquivalentTo(new DateOnly[]
        {
            new(2026, 8, 10), new(2026, 8, 12), new(2026, 8, 14)
        });
        piano.Saltate.Should().BeEquivalentTo(esistenti);
        piano.GiorniTotali.Should().Be(5);
    }

    [Fact]
    public void Pianifica_DateEsistentiFuoriIntervallo_NonInfluenzanoIlPiano()
    {
        DateOnly inizio = new(2026, 8, 10);
        DateOnly fine = new(2026, 8, 12);
        DateOnly[] esistenti = [new(2026, 8, 1), new(2026, 12, 25)];

        GiorniNonLavorativiRangePlanner.Piano piano =
            GiorniNonLavorativiRangePlanner.Pianifica(inizio, fine, esistenti);

        piano.DaCreare.Should().HaveCount(3);
        piano.Saltate.Should().BeEmpty();
    }

    [Fact]
    public void Pianifica_TutteLeDateEsistenti_NonCreaNulla()
    {
        DateOnly inizio = new(2026, 8, 10);
        DateOnly fine = new(2026, 8, 12);
        DateOnly[] esistenti = [new(2026, 8, 10), new(2026, 8, 11), new(2026, 8, 12)];

        GiorniNonLavorativiRangePlanner.Piano piano =
            GiorniNonLavorativiRangePlanner.Pianifica(inizio, fine, esistenti);

        piano.DaCreare.Should().BeEmpty();
        piano.Saltate.Should().HaveCount(3);
    }

    [Fact]
    public void Pianifica_StessoGiorno_CreaUnSoloGiorno()
    {
        DateOnly giorno = new(2026, 8, 15);

        GiorniNonLavorativiRangePlanner.Piano piano =
            GiorniNonLavorativiRangePlanner.Pianifica(giorno, giorno, []);

        piano.DaCreare.Should().ContainSingle().Which.Should().Be(giorno);
    }

    [Fact]
    public void Pianifica_DateDuplicateInIngresso_NonDuplicaGliSkip()
    {
        DateOnly inizio = new(2026, 8, 10);
        DateOnly fine = new(2026, 8, 11);
        DateOnly[] esistenti = [new(2026, 8, 10), new(2026, 8, 10)];

        GiorniNonLavorativiRangePlanner.Piano piano =
            GiorniNonLavorativiRangePlanner.Pianifica(inizio, fine, esistenti);

        piano.Saltate.Should().ContainSingle().Which.Should().Be(new DateOnly(2026, 8, 10));
        piano.DaCreare.Should().ContainSingle().Which.Should().Be(new DateOnly(2026, 8, 11));
    }

    [Fact]
    public void Pianifica_DataFinePrecedenteAInizio_Lancia()
    {
        DateOnly inizio = new(2026, 8, 15);
        DateOnly fine = new(2026, 8, 14);

        Action act = () => GiorniNonLavorativiRangePlanner.Pianifica(inizio, fine, []);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Pianifica_IntervalloAnnuale_RispettaIlLimiteMassimo()
    {
        DateOnly inizio = new(2026, 1, 1);
        DateOnly fine = new(2026, 12, 31);

        GiorniNonLavorativiRangePlanner.Piano piano =
            GiorniNonLavorativiRangePlanner.Pianifica(inizio, fine, []);

        piano.DaCreare.Should().HaveCount(365);
        piano.GiorniTotali.Should().BeLessThanOrEqualTo(GiorniNonLavorativiRangePlanner.MaxGiorni);
    }

    #endregion
}
