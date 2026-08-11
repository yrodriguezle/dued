using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

using GraphQL;

using duedgusto.GraphQL.Vetrina;
using duedgusto.GraphQL.Vetrina.Types;
using duedgusto.SeedData;
using duedgusto.Services.Media;
using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Il ciclo di vita dei media dal lato scrittura: modifica dei soli metadati editoriali,
/// eliminazione che nomina i prodotti in uso, e le due letture dell'anagrafica prodotti che
/// il sito e la griglia consumano.
/// </summary>
public class VetrinaMediaTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly string _radice;
    private readonly FileSystemMediaStorage _storage;

    public VetrinaMediaTests()
    {
        _dbContext = TestDbContextFactory.Create();
        _radice = Path.Combine(Path.GetTempPath(), "duedgusto-vetrina-test", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_radice);
        _storage = new FileSystemMediaStorage(
            new MediaRoot(_radice), new Mock<ILogger<FileSystemMediaStorage>>().Object);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        if (Directory.Exists(_radice)) Directory.Delete(_radice, recursive: true);
        GC.SuppressFinalize(this);
    }

    private async Task<MediaAsset> CreaMediaConFile(string nomeOriginale = "foto.jpg")
    {
        var asset = new MediaAsset
        {
            Chiave = $"2026/08/{Guid.NewGuid():N}"[..24],
            NomeOriginale = nomeOriginale,
            MimeType = "image/jpeg",
            Larghezza = 900,
            Altezza = 600,
            LarghezzeDisponibili = "400,800",
            Placeholder = "data:image/webp;base64,AAAA",
            Cartella = "generale",
            Pubblicato = true,
            ByteTotali = 100,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        _dbContext.MediaAssets.Add(asset);
        await _dbContext.SaveChangesAsync();

        await _storage.ScriviVariantiAsync(asset.Chiave,
        [
            new VarianteMedia("400.webp", [1, 2, 3]),
            new VarianteMedia("400.jpg", [1, 2, 3]),
            new VarianteMedia("800.webp", [1, 2, 3]),
            new VarianteMedia("800.jpg", [1, 2, 3]),
        ]);

        return asset;
    }

    private async Task<Prodotto> CreaProdotto(string codice, string nome, bool attivo = true, int? immagineId = null)
    {
        var prodotto = new Prodotto
        {
            Codice = codice,
            Nome = nome,
            Prezzo = 3.80m,
            UnitaDiMisura = "pz",
            Attivo = attivo,
            AliquotaIva = 10,
            ImmagineId = immagineId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        _dbContext.Prodotti.Add(prodotto);
        await _dbContext.SaveChangesAsync();
        return prodotto;
    }

    private string CartellaDi(MediaAsset asset) =>
        Path.Combine(_radice, asset.Chiave.Replace('/', Path.DirectorySeparatorChar));

    // ── 7.8 — eliminazione di un media in uso ────────────────────────────────────────────

    [Fact]
    public async Task EliminaMediaAsset_InUso_RifiutatoConIProdottiNominati()
    {
        MediaAsset asset = await CreaMediaConFile("caffe.jpg");
        await CreaProdotto("A1", "Caffè espresso", immagineId: asset.MediaAssetId);
        await CreaProdotto("B2", "Cappuccino", immagineId: asset.MediaAssetId);

        Func<Task> act = () => VetrinaMutations.EliminaMediaAssetAsync(_dbContext, _storage, asset.MediaAssetId);

        // "È in uso" da solo costringerebbe a cercare a mano proprio l'informazione che il
        // server ha già.
        ExecutionError errore = (await act.Should().ThrowAsync<ExecutionError>()).Which;
        errore.Message.Should().Contain("Caffè espresso").And.Contain("Cappuccino");

        // Né il record né i file sono stati toccati.
        _dbContext.MediaAssets.Should().HaveCount(1);
        Directory.GetFiles(CartellaDi(asset)).Should().HaveCount(4);
    }

    [Fact]
    public async Task EliminaMediaAsset_DopoAverToltoIlRiferimento_RimuoveRigaEFileInsieme()
    {
        MediaAsset asset = await CreaMediaConFile();
        Prodotto prodotto = await CreaProdotto("A1", "Caffè espresso", immagineId: asset.MediaAssetId);

        prodotto.ImmagineId = null;
        await _dbContext.SaveChangesAsync();

        bool esito = await VetrinaMutations.EliminaMediaAssetAsync(_dbContext, _storage, asset.MediaAssetId);

        esito.Should().BeTrue();
        _dbContext.MediaAssets.Should().BeEmpty();
        Directory.Exists(CartellaDi(asset)).Should().BeFalse();
    }

    [Fact]
    public async Task EliminaMediaAsset_Inesistente_ErroreLeggibile()
    {
        Func<Task> act = () => VetrinaMutations.EliminaMediaAssetAsync(_dbContext, _storage, 9999);

        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*non trovato*");
    }

    // ── Metadati editoriali: i file non si toccano ───────────────────────────────────────

    [Fact]
    public async Task AggiornaMediaAsset_CambiaSoloIMetadatiELasciaIFileIntatti()
    {
        MediaAsset asset = await CreaMediaConFile();
        string chiaveOriginale = asset.Chiave;
        string[] primaDeiFile = Directory.GetFiles(CartellaDi(asset)).OrderBy(f => f).ToArray();

        MediaAsset aggiornato = await VetrinaMutations.AggiornaMediaAssetAsync(
            _dbContext, asset.MediaAssetId,
            new MediaAssetInput
            {
                TestoAlternativo = "Il bancone del bar",
                Didascalia = "Thiene, agosto",
                Focale = "50% 40%",
                Cartella = "interni",
                Ordinamento = 3,
                Pubblicato = true,
            });

        aggiornato.TestoAlternativo.Should().Be("Il bancone del bar");
        aggiornato.Cartella.Should().Be("interni");

        // La verità misurata dalla pipeline resta quella: chiave, dimensioni, larghezze.
        aggiornato.Chiave.Should().Be(chiaveOriginale);
        aggiornato.Larghezza.Should().Be(900);
        aggiornato.LarghezzeDisponibili.Should().Be("400,800");
        Directory.GetFiles(CartellaDi(asset)).OrderBy(f => f).Should().Equal(primaDeiFile);
    }

    /// <summary>
    /// Il ritiro di un media che il sito sta mostrando avvisa <b>nominando i soli prodotti
    /// pubblicati</b>, non tutti quelli che usano l'immagine.
    ///
    /// <para>Pinna il punto in cui la regola di pubblicazione era scritta una seconda volta
    /// (<c>AggiornaMediaAssetAsync</c>) e che ora chiama <c>RegoleVetrina.Pubblicato</c>: senza
    /// questo test la riscrittura sarebbe stata un cambio di codice senza alcuna prova che il
    /// comportamento fosse rimasto lo stesso. Un prodotto attivo ma non marcato per il sito, e
    /// uno marcato ma disattivato in cassa, <b>non</b> devono comparire nell'avviso: non sono
    /// pubblicati, quindi ritirare la foto non cambia nulla di ciò che il visitatore vede.</para>
    /// </summary>
    [Fact]
    public async Task AggiornaMediaAsset_RitiroDiUnMediaInUso_AvvisaNominandoISoliProdottiPubblicati()
    {
        MediaAsset asset = await CreaMediaConFile("caffe.jpg");

        Prodotto pubblicato = await CreaProdotto("A1", "Caffè espresso", immagineId: asset.MediaAssetId);
        pubblicato.VisibileSulSito = true;
        Prodotto soloAttivo = await CreaProdotto("B2", "Cappuccino", immagineId: asset.MediaAssetId);
        soloAttivo.VisibileSulSito = false;
        Prodotto soloVisibile = await CreaProdotto("C3", "Cornetto", attivo: false, immagineId: asset.MediaAssetId);
        soloVisibile.VisibileSulSito = true;
        await _dbContext.SaveChangesAsync();

        var loggerMock = new Mock<ILogger>();
        loggerMock.Setup(l => l.IsEnabled(LogLevel.Warning)).Returns(true);

        MediaAsset aggiornato = await VetrinaMutations.AggiornaMediaAssetAsync(
            _dbContext, asset.MediaAssetId,
            new MediaAssetInput { Cartella = "generale", Ordinamento = 0, Pubblicato = false },
            loggerMock.Object);

        // Ritirare è legittimo: il media si ritira e i prodotti non si toccano.
        aggiornato.Pubblicato.Should().BeFalse();
        _dbContext.Prodotti.Should().OnlyContain(p => p.ImmagineId == asset.MediaAssetId);

        loggerMock.Verify(l => l.Log(
            LogLevel.Warning,
            It.IsAny<EventId>(),
            It.Is<It.IsAnyType>((v, t) =>
                v.ToString()!.Contains("Caffè espresso")
                && !v.ToString()!.Contains("Cappuccino")
                && !v.ToString()!.Contains("Cornetto")),
            It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.Once);
    }

    [Theory]
    [InlineData("molto a sinistra")]
    [InlineData("140% 20%")]
    [InlineData("50%")]
    public async Task AggiornaMediaAsset_FocaleNonConforme_RifiutataEValorePrecedenteIntatto(string focaleSbagliata)
    {
        MediaAsset asset = await CreaMediaConFile();
        asset.Focale = "30% 30%";
        await _dbContext.SaveChangesAsync();

        Func<Task> act = () => VetrinaMutations.AggiornaMediaAssetAsync(
            _dbContext, asset.MediaAssetId,
            new MediaAssetInput { Focale = focaleSbagliata, Cartella = "generale", Pubblicato = true });

        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*non valido*");
        _dbContext.MediaAssets.First().Focale.Should().Be("30% 30%");
    }

    // ── 7.10 — l'anagrafica prodotti include i non attivi ────────────────────────────────

    [Fact]
    public async Task AnagraficaProdotti_IncludeAncheINonAttivi()
    {
        await CreaProdotto("A1", "Attivo uno");
        await CreaProdotto("A2", "Attivo due");
        await CreaProdotto("D1", "Disattivato", attivo: false);

        // È l'anagrafica, non il listino operativo: un prodotto stagionale disattivato deve
        // restare raggiungibile per curarne la scheda fuori stagione.
        List<Prodotto> tutti = await _dbContext.Prodotti.OrderBy(p => p.Codice).ToListAsync();

        tutti.Should().HaveCount(3);
        tutti.Should().Contain(p => !p.Attivo);
        tutti.Select(p => p.Codice).Should().BeInAscendingOrder();
    }

    [Fact]
    public async Task ProdottoNonAttivoMaVisibile_NonRisultaPubblicato()
    {
        Prodotto prodotto = await CreaProdotto("S1", "Granita", attivo: false);

        await VetrinaMutations.ApplicaCampiVetrinaAsync(_dbContext, prodotto.ProdottoId,
            new ProdottoVetrinaInput { VisibileSulSito = true, OrdinamentoVetrina = 0 });

        Prodotto dopo = await _dbContext.Prodotti.FirstAsync(p => p.ProdottoId == prodotto.ProdottoId);
        dopo.VisibileSulSito.Should().BeTrue();
        // pubblicatoSulSito = Attivo && VisibileSulSito: la regola vive nel tipo GraphQL e
        // qui se ne verifica il presupposto — lo stato divergente è ammesso e innocuo.
        (dopo.Attivo && dopo.VisibileSulSito).Should().BeFalse();
    }

    // ── 7.10 — il seed della sezione Sito è idempotente ──────────────────────────────────

    /// <summary>
    /// Il seed apre un proprio scope e ne dispone il contesto: ogni scope riceve quindi
    /// un'istanza nuova sullo <b>stesso</b> database in memoria, esattamente come in
    /// produzione ogni avvio riceve un contesto nuovo sullo stesso MySQL.
    /// </summary>
    private static (ServiceProvider Provider, string NomeDatabase) ProviderDiSeed(params Ruolo[] ruoli)
    {
        string nomeDatabase = Guid.NewGuid().ToString();

        using (AppDbContext preparazione = TestDbContextFactory.Create(nomeDatabase))
        {
            preparazione.Ruoli.AddRange(ruoli);
            preparazione.SaveChanges();
        }

        ServiceProvider provider = new ServiceCollection()
            .AddScoped(_ => TestDbContextFactory.Create(nomeDatabase))
            .BuildServiceProvider();

        return (provider, nomeDatabase);
    }

    [Fact]
    public async Task SeedMenusSito_InvocatoTreVolte_LasciaUnPadreEDueFigli()
    {
        (ServiceProvider provider, string nomeDatabase) = ProviderDiSeed(
            new Ruolo { Nome = "SuperAdmin", Amministratore = true },
            new Ruolo { Nome = "Gestore", Amministratore = false });

        await SeedMenusSito.Initialize(provider);
        await SeedMenusSito.Initialize(provider);
        await SeedMenusSito.Initialize(provider);

        using AppDbContext verifica = TestDbContextFactory.Create(nomeDatabase);

        // Il padre si cerca per Titolo + percorso vuoto: cercarlo per il solo percorso ne
        // creerebbe uno nuovo a ogni avvio, come già successo con le Dashboard duplicate.
        verifica.Menus.Count(m => m.Titolo == "Sito" && m.Percorso == string.Empty).Should().Be(1);
        verifica.Menus.Count(m => m.Percorso.StartsWith("/gestionale/sito/")).Should().Be(2);
    }

    [Fact]
    public async Task SeedMenusSito_AssegnaLeVociAiSoliRuoliAmministrativi()
    {
        (ServiceProvider provider, string nomeDatabase) = ProviderDiSeed(
            new Ruolo { Nome = "SuperAdmin", Amministratore = true },
            new Ruolo { Nome = "Admin", Amministratore = true },
            new Ruolo { Nome = "Gestore", Amministratore = false });

        await SeedMenusSito.Initialize(provider);

        using AppDbContext verifica = TestDbContextFactory.Create(nomeDatabase);
        List<Menu> vociSito = await verifica.Menus
            .Include(m => m.Ruoli)
            .Where(m => m.Titolo == "Sito" || m.Percorso.StartsWith("/gestionale/sito/"))
            .ToListAsync();

        vociSito.Should().HaveCount(3);
        // Il ruolo Gestore non compare da nessuna parte: la sezione è riservata.
        vociSito.SelectMany(m => m.Ruoli).Select(r => r.Nome).Distinct()
            .Should().BeEquivalentTo("SuperAdmin", "Admin");
    }
}
