using duedgusto.Models;
using duedgusto.Services.Calendario;

namespace DuedGusto.Tests.Unit.Services.Calendario;

/// <summary>
/// La regola che trasforma le righe di <c>GiorniNonLavorativi</c> in <b>date</b>.
///
/// <para>È la regola che cassa e vetrina condividono: la chiusura mensile la usa per non pretendere
/// il registro del 25 dicembre, la rotta pubblica per non far dire al sito «aperto» durante le
/// ferie. Un test che la incrina le incrina entrambe, ed è precisamente il motivo per cui vive in
/// un posto solo.</para>
/// </summary>
public class ChiusureProgrammateTests
{
    // ─────────────────────────────────────────────────────────────────────────────────────
    //  CadeIl — la ricorrenza
    // ─────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public void CadeIl_NonRicorrente_SoloSullaDataEsatta()
    {
        GiornoNonLavorativo ferie = Giorno(new DateOnly(2026, 8, 13), ricorrente: false);

        ChiusureProgrammate.CadeIl(ferie, new DateOnly(2026, 8, 13)).Should().BeTrue();
        ChiusureProgrammate.CadeIl(ferie, new DateOnly(2026, 8, 14)).Should().BeFalse();
        ChiusureProgrammate.CadeIl(ferie, new DateOnly(2027, 8, 13))
            .Should().BeFalse("senza il flag di ricorrenza l'anno conta");
    }

    [Fact]
    public void CadeIl_Ricorrente_IgnoraLAnnoEConfrontaMeseEGiorno()
    {
        // 🔴 È il caso che rende il filtro SQL per data insufficiente: la riga porta il 2025 e
        //    deve cadere nel 2026, nel 2027 e in ogni anno successivo.
        GiornoNonLavorativo natale = Giorno(new DateOnly(2025, 12, 25), ricorrente: true);

        ChiusureProgrammate.CadeIl(natale, new DateOnly(2026, 12, 25)).Should().BeTrue();
        ChiusureProgrammate.CadeIl(natale, new DateOnly(2030, 12, 25)).Should().BeTrue();
        ChiusureProgrammate.CadeIl(natale, new DateOnly(2026, 12, 26)).Should().BeFalse();
    }

    /// <summary>
    /// ⚠️ Conseguenza dichiarata, non un difetto scoperto per caso: un ricorrente al 29 febbraio
    /// non cade negli anni non bisestili, perché quel giorno lì non esiste.
    /// </summary>
    [Fact]
    public void CadeIl_RicorrenteAl29Febbraio_NonCadeNegliAnniNonBisestili()
    {
        GiornoNonLavorativo bisestile = Giorno(new DateOnly(2024, 2, 29), ricorrente: true);

        ChiusureProgrammate.CadeIl(bisestile, new DateOnly(2028, 2, 29)).Should().BeTrue();
        ChiusureProgrammate.CadeIl(bisestile, new DateOnly(2026, 2, 28)).Should().BeFalse();
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  NellaFinestra — la proiezione su calendario
    // ─────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public void NellaFinestra_RestituisceUnaVocePerGiornoInOrdineCrescente()
    {
        // Le ferie del 10–22 agosto 2026: tredici righe a database, tredici date qui.
        List<GiornoNonLavorativo> ferie = Enumerable
            .Range(10, 13)
            .Select(giorno => Giorno(new DateOnly(2026, 8, giorno), descrizione: "Ferie"))
            .ToList();

        IReadOnlyList<(DateOnly Data, GiornoNonLavorativo Giorno)> chiuse =
            ChiusureProgrammate.NellaFinestra(ferie, new DateOnly(2026, 8, 13), perGiorni: 30);

        chiuse.Select(c => c.Data).Should().Equal(
            Enumerable.Range(13, 10).Select(giorno => new DateOnly(2026, 8, giorno)),
            "la finestra comincia OGGI: il 10, 11 e 12 sono passati e non riguardano un visitatore");
        chiuse.Should().OnlyContain(c => c.Giorno.Descrizione == "Ferie");
    }

    [Fact]
    public void NellaFinestra_FuoriDallaFinestra_NonCompare()
    {
        GiornoNonLavorativo lontano = Giorno(new DateOnly(2026, 12, 25));

        ChiusureProgrammate
            .NellaFinestra([lontano], new DateOnly(2026, 8, 13), perGiorni: 60)
            .Should().BeEmpty();
    }

    /// <summary>
    /// 🔴 Una data coperta due volte produce <b>una</b> voce: senza, l'avviso in pagina mostrerebbe
    /// «Ferie» e «Ferragosto» sullo stesso 15 agosto e chi legge non saprebbe quale sia.
    /// </summary>
    [Fact]
    public void NellaFinestra_DueRigheSullaStessaData_ProduconoUnaVoceSola()
    {
        GiornoNonLavorativo specifica = Giorno(new DateOnly(2026, 8, 15), descrizione: "Ferie");
        GiornoNonLavorativo ricorrente =
            Giorno(new DateOnly(2020, 8, 15), descrizione: "Ferragosto", ricorrente: true);

        IReadOnlyList<(DateOnly Data, GiornoNonLavorativo Giorno)> chiuse =
            ChiusureProgrammate.NellaFinestra([specifica, ricorrente], new DateOnly(2026, 8, 15), perGiorni: 1);

        chiuse.Should().HaveCount(1);
        chiuse[0].Giorno.Descrizione.Should().Be(
            "Ferie",
            "a pari data vince chi arriva prima nell'elenco, e il chiamante mette i non ricorrenti davanti");
    }

    [Fact]
    public void NellaFinestra_IlPrimoGiornoEIncluso_ELUltimoAnche()
    {
        GiornoNonLavorativo oggi = Giorno(new DateOnly(2026, 8, 13));
        GiornoNonLavorativo ultimo = Giorno(new DateOnly(2026, 8, 15));
        GiornoNonLavorativo appenaFuori = Giorno(new DateOnly(2026, 8, 16));

        IReadOnlyList<(DateOnly Data, GiornoNonLavorativo Giorno)> chiuse =
            ChiusureProgrammate.NellaFinestra(
                [oggi, ultimo, appenaFuori], new DateOnly(2026, 8, 13), perGiorni: 3);

        chiuse.Select(c => c.Data).Should().Equal(
            new DateOnly(2026, 8, 13),
            new DateOnly(2026, 8, 15));
    }

    private static GiornoNonLavorativo Giorno(
        DateOnly data,
        string descrizione = "Chiusura",
        bool ricorrente = false) => new()
        {
            Data = data,
            Descrizione = descrizione,
            CodiceMotivo = ricorrente ? "FESTIVITA_NAZIONALE" : "FERIE",
            Ricorrente = ricorrente,
        };
}
