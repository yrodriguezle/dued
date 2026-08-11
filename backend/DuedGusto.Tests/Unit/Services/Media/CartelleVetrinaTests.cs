using Microsoft.Extensions.Configuration;

using duedgusto.GraphQL.Vetrina;
using duedgusto.GraphQL.Vetrina.Types;
using duedgusto.Services.Media;

using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Unit.Services.Media;

/// <summary>
/// La cartella di un media ha <b>una sola forma canonica</b>, e la normalizzazione avviene in
/// scrittura.
///
/// <para>Senza questo, <c>"Galleria"</c> e <c>"galleria"</c> sono due raggruppamenti distinti
/// nella libreria e sul sito ne compare uno solo, senza alcun errore da nessuna parte. E non
/// basta affidarsi alla collazione del database: MySQL confronta ignorando le maiuscole, il
/// provider InMemory dei test confronta in modo <b>ordinale</b> — un test verde non direbbe
/// nulla sulla produzione, e viceversa.</para>
/// </summary>
public class CartelleVetrinaTests
{
    // ── Normalizza (task 2.4, 2.7) ───────────────────────────────────────────────────────

    [Fact]
    public void Normalizza_TogliGliSpaziEPortaAMinuscolo()
    {
        CartelleVetrina.Normalizza("  Galleria ").Should().Be("galleria");
    }

    [Fact]
    public void Normalizza_ConValoreNullo_RicadeSulDefault()
    {
        CartelleVetrina.Normalizza(null).Should().Be(CartelleVetrina.Generale);
    }

    [Fact]
    public void Normalizza_ConSoliSpazi_RicadeSulDefault()
    {
        CartelleVetrina.Normalizza("   ").Should().Be(CartelleVetrina.Generale);
    }

    /// <summary>
    /// 🔴 L'insieme è <b>aperto</b>: le fasi successive porteranno almeno <c>eventi</c>,
    /// <c>promozioni</c> e <c>hero</c>. Una lista chiusa richiederebbe una migrazione e un
    /// deploy per ognuna, mentre il problema vero è la scopribilità, non il vincolo.
    /// </summary>
    [Fact]
    public void Normalizza_AccettaUnaCartellaNonSuggerita_ENonSoloQuelleNote()
    {
        CartelleVetrina.Normalizza("  Eventi ").Should().Be("eventi");
        CartelleVetrina.Suggerite.Should().NotContain("eventi",
            "l'insieme resta aperto: 'eventi' è accettata pur non essendo suggerita");
    }

    [Fact]
    public void Suggerite_ContengonoIlDefaultELaGalleria()
    {
        CartelleVetrina.Suggerite.Should().Contain(CartelleVetrina.Generale)
            .And.Contain(CartelleVetrina.Galleria);
    }

    /// <summary>
    /// L'etichetta è italiana e minuscola: sarebbe l'unico valore di dato in inglese del
    /// progetto, e la rotta che lo filtra si chiama <c>/api/public/galleria</c>.
    /// </summary>
    [Fact]
    public void Galleria_EItalianaEMinuscola()
    {
        CartelleVetrina.Galleria.Should().Be("galleria");
        CartelleVetrina.Suggerite.Should().NotContain("gallery");
        CartelleVetrina.Suggerite.Should().OnlyContain(c => c == c.ToLowerInvariant());
    }

    // ── Normalizzazione nel percorso di modifica (task 2.5) ──────────────────────────────

    [Fact]
    public async Task AggiornaMediaAsset_ConCartellaInMaiuscoloEConSpazi_PersisteLaFormaCanonica()
    {
        using AppDbContext dbContext = TestDbContextFactory.Create();
        MediaAsset asset = AssetDiProva(dbContext);

        await VetrinaMutations.AggiornaMediaAssetAsync(dbContext, asset.MediaAssetId, new MediaAssetInput
        {
            Cartella = "  Galleria ",
            Ordinamento = 0,
            Pubblicato = true,
        });

        dbContext.MediaAssets.Single().Cartella.Should().Be("galleria");
    }

    [Fact]
    public async Task AggiornaMediaAsset_ConCartellaVuota_RicadeSulDefault()
    {
        using AppDbContext dbContext = TestDbContextFactory.Create();
        MediaAsset asset = AssetDiProva(dbContext);

        await VetrinaMutations.AggiornaMediaAssetAsync(dbContext, asset.MediaAssetId, new MediaAssetInput
        {
            Cartella = "   ",
            Ordinamento = 0,
            Pubblicato = true,
        });

        dbContext.MediaAssets.Single().Cartella.Should().Be(CartelleVetrina.Generale);
    }

    /// <summary>
    /// Due grafie non producono due raggruppamenti: è la conseguenza osservabile della
    /// normalizzazione in scrittura, e quella che il visitatore del sito percepisce.
    /// </summary>
    [Fact]
    public async Task DueGrafieDellaStessaCartella_ProduconoUnSoloRaggruppamento()
    {
        using AppDbContext dbContext = TestDbContextFactory.Create();
        MediaAsset primo = AssetDiProva(dbContext, "2026/08/uno");
        MediaAsset secondo = AssetDiProva(dbContext, "2026/08/due");

        foreach ((MediaAsset asset, string grafia) in new[] { (primo, "Galleria"), (secondo, "galleria") })
        {
            await VetrinaMutations.AggiornaMediaAssetAsync(dbContext, asset.MediaAssetId, new MediaAssetInput
            {
                Cartella = grafia,
                Ordinamento = 0,
                Pubblicato = true,
            });
        }

        dbContext.MediaAssets.Select(m => m.Cartella).Distinct()
            .Should().ContainSingle().Which.Should().Be("galleria");
    }

    // ── La lettura NON normalizza (task 2.5, spec "La lettura non normalizza") ────────────

    /// <summary>
    /// ⚠️ Il confronto in lettura deve restare un'uguaglianza <b>secca</b> sulla colonna:
    /// <c>.Where(m =&gt; m.Cartella.ToLower() == …)</c> diventerebbe <c>LOWER(Cartella) = …</c>
    /// in SQL — non sargabile — e l'indice <c>(Cartella, Ordinamento)</c> smetterebbe di essere
    /// utilizzabile per la selezione ordinata della galleria.
    /// </summary>
    [Fact]
    public void LaSelezionePerCartella_NonApplicaAlcunaFunzioneAllaColonna()
    {
        using AppDbContext dbContext = ContestoRelazionaleSenzaConnessione();

        string sql = dbContext.MediaAssets
            .Where(m => m.Cartella == CartelleVetrina.Galleria)
            .ToQueryString();

        sql.Should().Contain("Cartella");
        sql.Should().NotContain("LOWER(", "una funzione sulla colonna renderebbe inutilizzabile l'indice");
        sql.Should().NotContain("UPPER(");
    }

    private static MediaAsset AssetDiProva(AppDbContext dbContext, string chiave = "2026/08/prova-a1b2c3")
    {
        var asset = new MediaAsset
        {
            Chiave = chiave,
            NomeOriginale = "prova.jpg",
            MimeType = "image/jpeg",
            Larghezza = 900,
            Altezza = 600,
            LarghezzeDisponibili = "400,800",
            Cartella = CartelleVetrina.Generale,
            Pubblicato = true,
        };

        dbContext.MediaAssets.Add(asset);
        dbContext.SaveChanges();
        return asset;
    }

    /// <summary>
    /// Contesto sul provider MySQL reale, usato solo per <b>generare</b> SQL: né
    /// <c>UseMySql</c> con versione esplicita né <c>ToQueryString()</c> aprono una connessione.
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
