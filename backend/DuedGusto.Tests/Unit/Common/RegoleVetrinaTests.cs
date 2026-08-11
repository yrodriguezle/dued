using Microsoft.Extensions.Configuration;

using duedgusto.Common;

using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Unit.Common;

/// <summary>
/// La regola condivisa della vetrina è <b>giusta</b>.
///
/// <para>È il complemento di <see cref="RegolaPubblicazioneUnicaTests"/>, che invece prova che
/// è <b>una sola</b>: la scansione dei sorgenti dice che non esiste una seconda copia, questa
/// matrice dice che la copia che esiste calcola la cosa corretta. Nessuna delle due sostituisce
/// l'altra — una regola unica e sbagliata è comunque sbagliata ovunque.</para>
/// </summary>
public class RegoleVetrinaTests
{
    private static Prodotto Prodotto(bool attivo, bool visibile, decimal prezzo = 1.20m,
        decimal? prezzoVetrina = null, int id = 0) =>
        new()
        {
            ProdottoId = id,
            Codice = $"P{id:D3}",
            Nome = $"Prodotto {id}",
            Prezzo = prezzo,
            PrezzoVetrina = prezzoVetrina,
            Attivo = attivo,
            VisibileSulSito = visibile,
        };

    // ── Matrice della pubblicazione (task 1.4) ───────────────────────────────────────────

    [Fact]
    public void EPubblicato_EVeroSoloQuandoAttivoEVisibile()
    {
        RegoleVetrina.EPubblicato(Prodotto(attivo: true, visibile: true)).Should().BeTrue();
    }

    [Fact]
    public void EPubblicato_EFalsoSeAttivoMaNonVisibile()
    {
        RegoleVetrina.EPubblicato(Prodotto(attivo: true, visibile: false)).Should().BeFalse();
    }

    [Fact]
    public void EPubblicato_EFalsoSeVisibileMaNonAttivo()
    {
        // 🔴 Il caso che il change precedente ha reso possibile E diagnosticabile: l'intenzione
        //    editoriale resta scritta ("lo voglio sul sito") mentre la cassa ha ritirato il
        //    prodotto. Il sito NON lo mostra, ma il flag non viene azzerato: riattivare il
        //    prodotto lo rimette online senza rifare la scheda.
        RegoleVetrina.EPubblicato(Prodotto(attivo: false, visibile: true)).Should().BeFalse();
    }

    [Fact]
    public void EPubblicato_EFalsoSeNeAttivoNeVisibile()
    {
        RegoleVetrina.EPubblicato(Prodotto(attivo: false, visibile: false)).Should().BeFalse();
    }

    // ── Matrice del prezzo (task 1.5) ────────────────────────────────────────────────────

    [Fact]
    public void PrezzoEffettivo_ConVetrinaAssente_RicadeSulListino()
    {
        RegoleVetrina.PrezzoEffettivo(null, 1.20m).Should().Be(1.20m);
    }

    [Fact]
    public void PrezzoEffettivo_ConVetrinaValorizzata_UsaQuellaDiVetrina()
    {
        RegoleVetrina.PrezzoEffettivo(0.90m, 1.20m).Should().Be(0.90m);
    }

    /// <summary>
    /// 🔴 Il test che ci si dimentica, e che <b>deve poter fallire da solo</b>: sta in un Fact
    /// separato e non in una riga di Theory insieme al caso <c>null</c> proprio perché la
    /// verifica per mutazione (task 1.6) possa mostrare che è l'unico a diventare rosso quando
    /// il fallback viene riscritto con <c>&gt; 0</c>.
    ///
    /// <para>Zero è un <b>omaggio</b>: un prezzo dichiarato, non un prezzo mancante. Trattarlo
    /// come assenza mostrerebbe al cliente il prezzo pieno di listino su un prodotto che il
    /// locale ha deciso di regalare — senza alcun errore da nessuna parte.</para>
    /// </summary>
    [Fact]
    public void PrezzoEffettivo_ConVetrinaAZero_ValeZeroENonIlListino()
    {
        decimal effettivo = RegoleVetrina.PrezzoEffettivo(0m, 1.20m);

        effettivo.Should().Be(0m);
        effettivo.Should().NotBe(1.20m);
    }

    [Fact]
    public void PrezzoEffettivo_LaFormaDiComodoCoincideConQuellaADueValori()
    {
        // La forma che accetta l'entità DELEGA a quella che accetta i due valori: se un giorno
        // reimplementasse il fallback, questa matrice le vedrebbe divergere.
        (decimal? vetrina, decimal listino)[] matrice =
            [(null, 1.20m), (0m, 1.20m), (0.90m, 1.20m)];

        foreach ((decimal? vetrina, decimal listino) in matrice)
        {
            Prodotto prodotto = Prodotto(attivo: true, visibile: true, prezzo: listino,
                prezzoVetrina: vetrina);

            RegoleVetrina.PrezzoEffettivo(prodotto)
                .Should().Be(RegoleVetrina.PrezzoEffettivo(vetrina, listino),
                    "la forma di comodo deve delegare, non reimplementare");
        }
    }

    // ── La stessa regola in memoria e in SQL (task 1.9) ──────────────────────────────────

    [Fact]
    public async Task Pubblicato_FiltraComeEPubblicato_ProdottoPerProdotto()
    {
        using AppDbContext dbContext = TestDbContextFactory.Create();
        dbContext.Prodotti.AddRange(
            Prodotto(attivo: true, visibile: true, id: 1),
            Prodotto(attivo: true, visibile: false, id: 2),
            Prodotto(attivo: false, visibile: true, id: 3),
            Prodotto(attivo: false, visibile: false, id: 4));
        await dbContext.SaveChangesAsync();

        // I due usi della stessa espressione: applicata alla query e valutata in memoria.
        List<int> daQuery = await dbContext.Prodotti
            .Where(RegoleVetrina.Pubblicato)
            .Select(p => p.ProdottoId)
            .ToListAsync();

        List<int> daMemoria = (await dbContext.Prodotti.ToListAsync())
            .Where(RegoleVetrina.EPubblicato)
            .Select(p => p.ProdottoId)
            .ToList();

        daQuery.Should().BeEquivalentTo(daMemoria,
            "il filtro e la valutazione in memoria sono la stessa espressione: se divergono, "
            + "una delle due è stata riscritta");
        daQuery.Should().BeEquivalentTo([1]);
    }

    /// <summary>
    /// Il filtro deve girare <b>nel database</b>, non dopo la materializzazione: altrimenti una
    /// richiesta anonima porta a casa l'intero listino per scartarne la maggior parte, e il
    /// guasto è invisibile finché il listino resta piccolo.
    ///
    /// <para>⚠️ Il provider InMemory dei test non genera SQL, quindi qui si costruisce un
    /// contesto sul provider <b>relazionale</b> reale con una versione di server fissa: né
    /// <c>UseMySql</c> con <c>MySqlServerVersion</c> esplicita né <c>ToQueryString()</c> aprono
    /// una connessione, quindi il test non richiede alcun MySQL in esecuzione.</para>
    /// </summary>
    [Fact]
    public void Pubblicato_VieneTradottaNellaClausolaWhere()
    {
        using AppDbContext dbContext = ContestoRelazionaleSenzaConnessione();

        string sql = dbContext.Prodotti.Where(RegoleVetrina.Pubblicato).ToQueryString();

        string dopoWhere = sql[(sql.IndexOf("WHERE", StringComparison.Ordinal) + 5)..];
        sql.Should().Contain("WHERE", "il predicato deve essere tradotto, non applicato in memoria");
        dopoWhere.Should().Contain("Attivo").And.Contain("VisibileSulSito");
    }

    /// <summary>
    /// Contesto sul provider MySQL reale, usato solo per <b>generare</b> SQL. La versione del
    /// server è fissa (come a design-time in <c>Program.cs</c>) perché <c>AutoDetect</c>
    /// aprirebbe una connessione.
    /// </summary>
    private static AppDbContext ContestoRelazionaleSenzaConnessione()
    {
        DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
            .UseMySql("server=nessuno;database=nessuno;user=nessuno;password=nessuno",
                new MySqlServerVersion(new Version(8, 0, 32)))
            .Options;

        var configMock = new Mock<IConfiguration>();
        return new AppDbContext(options, configMock.Object);
    }
}
