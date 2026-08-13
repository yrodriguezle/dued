using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

using FluentAssertions.Execution;

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

    // ── I referenti 2-5: i quattro slot immagine delle impostazioni del sito ─────────────

    /// <summary>
    /// I quattro slot immagine delle impostazioni del sito, cioè i referenti dei media diversi
    /// dai prodotti. Un enum e non quattro test copiati: il giorno in cui ne nasce un quinto, si
    /// aggiunge una voce qui e il compilatore indica <b>i due punti</b> da completare — la
    /// scrittura e la lettura — invece di lasciare che il caso manchi in silenzio.
    /// </summary>
    public enum SlotSito
    {
        AnteprimaSocial,
        EroeHome,
        RitrattoLocale,
        EroeAperitivo,
    }

    private async Task<ImpostazioniVetrina> CreaImpostazioni(int? immagineOgId = null)
    {
        var impostazioni = new ImpostazioniVetrina
        {
            InsegnaPubblica = "2D Gusto Bar",
            Via = "Via del Costo 99",
            Cap = "36016",
            Citta = "Thiene",
            Provincia = "VI",
            ImmagineOgId = immagineOgId,
        };
        _dbContext.ImpostazioniVetrina.Add(impostazioni);
        await _dbContext.SaveChangesAsync();
        return impostazioni;
    }

    private async Task<ImpostazioniVetrina> CreaImpostazioniConSlot(SlotSito slot, int mediaAssetId)
    {
        ImpostazioniVetrina impostazioni = await CreaImpostazioni();
        Assegna(impostazioni, slot, mediaAssetId);
        await _dbContext.SaveChangesAsync();
        return impostazioni;
    }

    private static void Assegna(ImpostazioniVetrina impostazioni, SlotSito slot, int? mediaAssetId)
    {
        switch (slot)
        {
            case SlotSito.AnteprimaSocial: impostazioni.ImmagineOgId = mediaAssetId; break;
            case SlotSito.EroeHome: impostazioni.ImmagineEroeHomeId = mediaAssetId; break;
            case SlotSito.RitrattoLocale: impostazioni.ImmagineRitrattoLocaleId = mediaAssetId; break;
            case SlotSito.EroeAperitivo: impostazioni.ImmagineEroeAperitivoId = mediaAssetId; break;
            default: throw new ArgumentOutOfRangeException(nameof(slot));
        }
    }

    private static int? Legge(ImpostazioniVetrina impostazioni, SlotSito slot) => slot switch
    {
        SlotSito.AnteprimaSocial => impostazioni.ImmagineOgId,
        SlotSito.EroeHome => impostazioni.ImmagineEroeHomeId,
        SlotSito.RitrattoLocale => impostazioni.ImmagineRitrattoLocaleId,
        SlotSito.EroeAperitivo => impostazioni.ImmagineEroeAperitivoId,
        _ => throw new ArgumentOutOfRangeException(nameof(slot)),
    };

    /// <summary>
    /// 🔴 <b>L'asserzione che conta è quella sui file, non quella sul rifiuto.</b>
    ///
    /// <para>In produzione, con il controllo rimosso, la foreign key <c>Restrict</c> rifiuterebbe
    /// <b>comunque</b> — solo <b>dopo</b> che i file sono spariti dal disco. Un test che si
    /// accontentasse di "l'operazione fallisce" resterebbe quindi verde certificando come
    /// corretto lo stato «riga presente, file cancellati, immagine di anteprima rotta su ogni
    /// condivisione social».</para>
    ///
    /// <para>⚠️ <b>Perché le asserzioni stanno dentro un <c>AssertionScope</c>, con il disco per
    /// primo.</b> Nell'ordine naturale, una verifica per mutazione (task 3.9) si fermerebbe alla
    /// prima riga rossa e direbbe soltanto "non è stata sollevata alcuna eccezione" — il sintomo
    /// invece del guasto. Con lo scope si raccolgono <b>tutte</b> le asserzioni in un giro solo,
    /// quindi il rapporto di fallimento dice a chi rimuove il controllo <b>quali</b> proprietà
    /// sono cadute e quali no. È la differenza fra una prova e un'impressione.</para>
    ///
    /// <para>🔴 <b>Una <c>[Theory]</c> sui quattro slot, e non il caso dell'anteprima social
    /// copiato quattro volte.</b> Quattro copie sarebbero quattro posti in cui aggiornare la
    /// stessa asserzione, e il modo in cui divergerebbero è noto: se ne aggiorna una, le altre
    /// tre restano verdi <b>certificando la regola vecchia</b>. Parametrizzato, il caso nuovo è
    /// una riga di <c>InlineData</c> e non può essere scritto a metà.</para>
    ///
    /// <para>⚠️ Il messaggio si verifica sul <b>ruolo in italiano</b> e mai sul nome della
    /// colonna: "ImmagineRitrattoLocaleId" non dice a nessuno dove andare a togliere il
    /// riferimento, <i>«il ritratto della pagina Il locale»</i> sì.</para>
    /// </summary>
    [Theory]
    [InlineData(SlotSito.AnteprimaSocial, "anteprima social")]
    [InlineData(SlotSito.EroeHome, "l'immagine grande della pagina Home")]
    [InlineData(SlotSito.RitrattoLocale, "il ritratto della pagina «Il locale»")]
    [InlineData(SlotSito.EroeAperitivo, "l'immagine grande della pagina «Aperitivo»")]
    public async Task EliminaMediaAsset_UsataDaUnoSlotDelSito_RifiutataEIFileRestanoSulDisco(
        SlotSito slot, string ruoloAtteso)
    {
        MediaAsset asset = await CreaMediaConFile($"slot-{slot}.jpg");
        ImpostazioniVetrina impostazioni = await CreaImpostazioniConSlot(slot, asset.MediaAssetId);

        string[] primaDeiFile = FileDi(asset);
        primaDeiFile.Should().HaveCount(4, "il presupposto del test è che i file esistano");

        Exception? sollevata = await Record.ExceptionAsync(() =>
            VetrinaMutations.EliminaMediaAssetAsync(_dbContext, _storage, asset.MediaAssetId));

        using var scope = new AssertionScope();

        // 🔴 PRIMA il disco: è l'asserzione che si dimentica e l'unica che il guasto vero fa
        //    fallire. Il rifiuto, da solo, non prova nulla — in produzione la foreign key
        //    rifiuta comunque, solo dopo che i file sono spariti.
        FileDi(asset).Should().Equal(primaDeiFile,
            "il rifiuto deve lasciare il sistema esattamente come era: nessun file toccato, "
            + "perché la verifica di TUTTI i referenti precede qualunque scrittura su disco");

        // E poi il rifiuto: il messaggio nomina il media, il ruolo che ricopre e cosa fare, come
        // quello dei prodotti nomina i prodotti.
        sollevata.Should().BeOfType<ExecutionError>();
        sollevata?.Message.Should().Contain($"slot-{slot}.jpg")
            .And.Contain(ruoloAtteso)
            .And.Contain("impostazioni del sito");

        _dbContext.MediaAssets.Should().HaveCount(1);
        Legge(_dbContext.ImpostazioniVetrina.First(), slot)
            .Should().Be(Legge(impostazioni, slot), "il riferimento non deve essere stato toccato");
    }

    /// <summary>
    /// Il complemento della <c>[Theory]</c>: tolto il riferimento, <b>quello stesso slot</b> non
    /// rifiuta più. Senza, un controllo che rifiutasse sempre — per esempio una <c>Where</c> che
    /// confronta la colonna sbagliata e trova comunque la riga — passerebbe inosservato su tutti
    /// e quattro i casi.
    /// </summary>
    [Theory]
    [InlineData(SlotSito.AnteprimaSocial)]
    [InlineData(SlotSito.EroeHome)]
    [InlineData(SlotSito.RitrattoLocale)]
    [InlineData(SlotSito.EroeAperitivo)]
    public async Task EliminaMediaAsset_DopoAverAzzeratoLoSlot_RimuoveRigaETuttiIFile(SlotSito slot)
    {
        MediaAsset asset = await CreaMediaConFile();
        ImpostazioniVetrina impostazioni = await CreaImpostazioniConSlot(slot, asset.MediaAssetId);

        Assegna(impostazioni, slot, null);
        await _dbContext.SaveChangesAsync();

        bool esito = await VetrinaMutations.EliminaMediaAssetAsync(
            _dbContext, _storage, asset.MediaAssetId);

        esito.Should().BeTrue();
        _dbContext.MediaAssets.Should().BeEmpty();
        Directory.Exists(CartellaDi(asset)).Should().BeFalse();
    }

    /// <summary>
    /// 🔴 <b>Gli slot non si confondono fra loro.</b> Con quattro colonne sulla stessa riga, il
    /// guasto plausibile non è più "il controllo manca" ma "il controllo guarda la colonna
    /// sbagliata": tre slot occupati da altre foto e il quarto libero devono lasciare eliminare
    /// il media <b>libero</b>. Un <c>Where</c> che ignorasse la colonna e trovasse comunque la
    /// riga singleton renderebbe ineliminabile qualunque media appena il sito ha un'immagine.
    /// </summary>
    [Fact]
    public async Task EliminaMediaAsset_ConAltriSlotOccupatiDaAltreFoto_Riesce()
    {
        MediaAsset daEliminare = await CreaMediaConFile("da-eliminare.jpg");
        MediaAsset eroeHome = await CreaMediaConFile("eroe-home.jpg");
        MediaAsset ritratto = await CreaMediaConFile("ritratto.jpg");
        MediaAsset eroeAperitivo = await CreaMediaConFile("eroe-aperitivo.jpg");

        ImpostazioniVetrina impostazioni = await CreaImpostazioni();
        Assegna(impostazioni, SlotSito.EroeHome, eroeHome.MediaAssetId);
        Assegna(impostazioni, SlotSito.RitrattoLocale, ritratto.MediaAssetId);
        Assegna(impostazioni, SlotSito.EroeAperitivo, eroeAperitivo.MediaAssetId);
        await _dbContext.SaveChangesAsync();

        bool esito = await VetrinaMutations.EliminaMediaAssetAsync(
            _dbContext, _storage, daEliminare.MediaAssetId);

        esito.Should().BeTrue();
        Directory.Exists(CartellaDi(daEliminare)).Should().BeFalse();
        Directory.GetFiles(CartellaDi(eroeHome)).Should().HaveCount(4);
        Directory.GetFiles(CartellaDi(ritratto)).Should().HaveCount(4);
        Directory.GetFiles(CartellaDi(eroeAperitivo)).Should().HaveCount(4);
    }

    /// <summary>
    /// I file delle varianti, o un elenco vuoto se la cartella non esiste più. Enumerare
    /// direttamente solleverebbe <c>DirectoryNotFoundException</c> quando i file <b>sono</b> stati
    /// cancellati, cioè proprio nel caso che questo test deve saper descrivere: il rapporto
    /// direbbe "percorso non trovato" invece di "mi aspettavo quattro file e non ce n'è nessuno".
    /// </summary>
    private string[] FileDi(MediaAsset asset) =>
        Directory.Exists(CartellaDi(asset))
            ? Directory.GetFiles(CartellaDi(asset)).OrderBy(f => f).ToArray()
            : [];

    [Fact]
    public async Task EliminaMediaAsset_UsataDaUnProdottoEComeImmagineOg_RifiutataEIntatta()
    {
        MediaAsset asset = await CreaMediaConFile("caffe.jpg");
        await CreaProdotto("A1", "Caffè espresso", immagineId: asset.MediaAssetId);
        await CreaImpostazioni(asset.MediaAssetId);

        string[] primaDeiFile = Directory.GetFiles(CartellaDi(asset)).OrderBy(f => f).ToArray();

        Func<Task> act = () => VetrinaMutations.EliminaMediaAssetAsync(
            _dbContext, _storage, asset.MediaAssetId);

        // Con entrambi i referenti presenti vince il messaggio dei prodotti, che è il più
        // azionabile: chi lo legge deve comunque passare dalle schede prima di poter eliminare.
        ExecutionError errore = (await act.Should().ThrowAsync<ExecutionError>()).Which;
        errore.Message.Should().Contain("Caffè espresso");

        Directory.GetFiles(CartellaDi(asset)).OrderBy(f => f).Should().Equal(primaDeiFile);
        _dbContext.MediaAssets.Should().HaveCount(1);
        _dbContext.ImpostazioniVetrina.First().ImmagineOgId.Should().Be(asset.MediaAssetId);
    }

    /// <summary>
    /// Il complemento indispensabile: senza, un controllo che rifiutasse <b>sempre</b>
    /// passerebbe inosservato e nessun media sarebbe più eliminabile.
    /// </summary>
    [Fact]
    public async Task EliminaMediaAsset_ConImpostazioniCheNeReferenzianoUnAltro_Riesce()
    {
        MediaAsset daEliminare = await CreaMediaConFile("da-eliminare.jpg");
        MediaAsset anteprima = await CreaMediaConFile("anteprima.jpg");
        await CreaImpostazioni(anteprima.MediaAssetId);

        bool esito = await VetrinaMutations.EliminaMediaAssetAsync(
            _dbContext, _storage, daEliminare.MediaAssetId);

        esito.Should().BeTrue();
        _dbContext.MediaAssets.Select(m => m.MediaAssetId)
            .Should().BeEquivalentTo([anteprima.MediaAssetId]);
        Directory.Exists(CartellaDi(daEliminare)).Should().BeFalse();
        Directory.GetFiles(CartellaDi(anteprima)).Should().HaveCount(4);
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
    public async Task SeedMenusSito_InvocatoTreVolte_LasciaUnPadreENoveFigli()
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
        // Nove, non ventisette: il conteggio è ciò che distingue un seed idempotente da un seed
        // che riscrive. Il numero cresce con le voci ed è l'unica riga che va toccata quando ne
        // arriva una — l'elenco dei percorsi qui sotto dice quali sono, così un duplicato non
        // può nascondersi dietro un conteggio giusto per caso.
        verifica.Menus.Count(m => m.Percorso.StartsWith("/gestionale/sito/")).Should().Be(9);
        verifica.Menus.Where(m => m.Percorso.StartsWith("/gestionale/sito/"))
            .Select(m => m.Percorso)
            .Should().BeEquivalentTo(
                "/gestionale/sito/pagine/home",
                "/gestionale/sito/pagine/menu",
                "/gestionale/sito/pagine/aperitivo",
                "/gestionale/sito/pagine/locale",
                "/gestionale/sito/pagine/contatti",
                "/gestionale/sito/media",
                "/gestionale/sito/prodotti",
                "/gestionale/sito/recensioni",
                "/gestionale/sito/impostazioni");

        // 🔴 L'ordine è il valore del change, non un dettaglio: prima le PAGINE del sito, poi le
        //    risorse trasversali. E resta lo stesso dopo il terzo avvio — `UpdateMenuIfNeeded`
        //    riscrive `Posizione` a ogni avvio, quindi un ordine che «si assesta» dopo il primo
        //    giro sarebbe un ordine che cambia sotto le mani di chi guarda.
        verifica.Menus.Where(m => m.Percorso.StartsWith("/gestionale/sito/"))
            .OrderBy(m => m.Posizione)
            .Select(m => m.Titolo)
            .Should().Equal(
                "Home", "Menu", "Aperitivo", "Il locale", "Contatti",
                "Libreria media", "Prodotti vetrina", "Recensioni sito", "Impostazioni sito");
        verifica.Menus.Where(m => m.Percorso.StartsWith("/gestionale/sito/"))
            .Select(m => m.Posizione)
            .OrderBy(posizione => posizione)
            .Should().Equal(1, 2, 3, 4, 5, 6, 7, 8, 9);
    }

    /// <summary>
    /// 🔴 Il riordino <b>aggiorna</b> le quattro voci preesistenti, non le ricrea.
    ///
    /// <para>È la prima volta che il seed viene usato per <b>riordinare</b> invece che per
    /// <b>creare</b>, e la proprietà va provata su un'installazione che ha già la forma
    /// precedente — non dedotta dall'idempotenza della creazione, che è un'altra cosa. Se il
    /// riordino ricreasse una voce, la vecchia resterebbe orfana in navigazione e i ruoli
    /// assegnati a mano dall'anagrafica sparirebbero con lei.</para>
    /// </summary>
    [Fact]
    public async Task SeedMenusSito_SuUnaSezioneNellaFormaPrecedente_RiordinaSenzaRicreare()
    {
        string nomeDatabase = Guid.NewGuid().ToString();
        int idMedia;
        int idImpostazioni;

        using (AppDbContext preparazione = TestDbContextFactory.Create(nomeDatabase))
        {
            preparazione.Ruoli.Add(new Ruolo { Nome = "SuperAdmin", Amministratore = true });
            Menu padre = new()
            {
                Titolo = "Sito",
                Percorso = string.Empty,
                Icona = "Globe",
                Visibile = true,
                Posizione = 9,
                NomeVista = string.Empty,
                PercorsoFile = string.Empty
            };
            preparazione.Menus.Add(padre);
            preparazione.SaveChanges();

            // La forma PRECEDENTE: quattro figli alle posizioni 1-4, media per prima.
            Menu media = new()
            {
                Titolo = "Libreria media",
                Percorso = "/gestionale/sito/media",
                Icona = "Images",
                Visibile = true,
                Posizione = 1,
                NomeVista = "MediaLibrary",
                PercorsoFile = "sito/MediaLibrary.tsx",
                MenuPadreId = padre.Id
            };
            Menu impostazioni = new()
            {
                Titolo = "Impostazioni sito",
                Percorso = "/gestionale/sito/impostazioni",
                Icona = "Store",
                Visibile = true,
                Posizione = 3,
                NomeVista = "ImpostazioniVetrinaPage",
                PercorsoFile = "sito/ImpostazioniVetrinaPage.tsx",
                MenuPadreId = padre.Id
            };
            preparazione.Menus.AddRange(media, impostazioni);
            preparazione.SaveChanges();
            idMedia = media.Id;
            idImpostazioni = impostazioni.Id;
        }

        ServiceProvider provider = new ServiceCollection()
            .AddScoped(_ => TestDbContextFactory.Create(nomeDatabase))
            .BuildServiceProvider();

        await SeedMenusSito.Initialize(provider);

        using AppDbContext verifica = TestDbContextFactory.Create(nomeDatabase);
        Menu media2 = await verifica.Menus.FirstAsync(m => m.Percorso == "/gestionale/sito/media");
        Menu impostazioni2 = await verifica.Menus.FirstAsync(m => m.Percorso == "/gestionale/sito/impostazioni");

        // 🔴 Stesso identificativo: sono le RIGHE di prima, aggiornate.
        media2.Id.Should().Be(idMedia);
        impostazioni2.Id.Should().Be(idImpostazioni);
        // Titolo, vista e file invariati: è cambiata soltanto la posizione.
        media2.Titolo.Should().Be("Libreria media");
        media2.NomeVista.Should().Be("MediaLibrary");
        media2.PercorsoFile.Should().Be("sito/MediaLibrary.tsx");
        media2.Posizione.Should().Be(6);
        impostazioni2.Posizione.Should().Be(9);
        // E nessun duplicato: le due voci restano una ciascuna.
        verifica.Menus.Count(m => m.Percorso == "/gestionale/sito/media").Should().Be(1);
        verifica.Menus.Count(m => m.Percorso == "/gestionale/sito/impostazioni").Should().Be(1);
    }

    /// <summary>
    /// Il <c>PercorsoFile</c> è ciò che <c>ProtectedRoutes.loadDynamicComponent()</c> importa a
    /// runtime, ed è relativo a <c>src/components/pages/</c>: un percorso sbagliato non rompe
    /// alcun test — rompe la voce di menu, con una pagina che non si apre. È l'errore classico
    /// di questo seed, quindi si pinna qui invece di scoprirlo cliccando.
    /// </summary>
    /// <summary>
    /// Ogni voce punta al componente giusto.
    ///
    /// <para>⚠️ Il <c>PercorsoFile</c> è ciò che <c>ProtectedRoutes.loadDynamicComponent()</c>
    /// importa a runtime, ed è relativo a <c>src/components/pages/</c>: un percorso sbagliato
    /// non rompe alcun test — rompe la voce di menu, con una pagina che non si apre. È l'errore
    /// classico di questo seed, e con cinque componenti nuovi in una sottocartella nuova le
    /// occasioni sono cinque in più.</para>
    /// </summary>
    [Theory]
    [InlineData("/gestionale/sito/pagine/home", "Home", "PaginaHome", "sito/pagine/PaginaHome.tsx", 1, "House")]
    [InlineData("/gestionale/sito/pagine/menu", "Menu", "PaginaMenu", "sito/pagine/PaginaMenu.tsx", 2, "UtensilsCrossed")]
    [InlineData("/gestionale/sito/pagine/aperitivo", "Aperitivo", "PaginaAperitivo", "sito/pagine/PaginaAperitivo.tsx", 3, "Martini")]
    [InlineData("/gestionale/sito/pagine/locale", "Il locale", "PaginaLocale", "sito/pagine/PaginaLocale.tsx", 4, "Armchair")]
    [InlineData("/gestionale/sito/pagine/contatti", "Contatti", "PaginaContatti", "sito/pagine/PaginaContatti.tsx", 5, "MapPin")]
    [InlineData("/gestionale/sito/media", "Libreria media", "MediaLibrary", "sito/MediaLibrary.tsx", 6, "Images")]
    [InlineData("/gestionale/sito/prodotti", "Prodotti vetrina", "VetrinaProdottiList", "sito/VetrinaProdottiList.tsx", 7, "ShoppingBag")]
    [InlineData("/gestionale/sito/recensioni", "Recensioni sito", "RecensioniVetrinaList", "sito/RecensioniVetrinaList.tsx", 8, "Star")]
    [InlineData("/gestionale/sito/impostazioni", "Impostazioni sito", "ImpostazioniVetrinaPage", "sito/ImpostazioniVetrinaPage.tsx", 9, "Store")]
    public async Task SeedMenusSito_OgniVoce_PuntaAlProprioComponente(
        string percorso, string titolo, string nomeVista, string percorsoFile, int posizione, string icona)
    {
        (ServiceProvider provider, string nomeDatabase) = ProviderDiSeed(
            new Ruolo { Nome = "SuperAdmin", Amministratore = true });

        await SeedMenusSito.Initialize(provider);

        using AppDbContext verifica = TestDbContextFactory.Create(nomeDatabase);
        Menu voce = await verifica.Menus.FirstAsync(m => m.Percorso == percorso);

        voce.Titolo.Should().Be(titolo);
        voce.NomeVista.Should().Be(nomeVista);
        voce.PercorsoFile.Should().Be(percorsoFile);
        voce.Posizione.Should().Be(posizione);
        voce.Visibile.Should().BeTrue();
        // ⚠️ L'icona è una stringa e un nome sconosciuto NON dà errore: la voce compare senza
        // icona. Che esistano davvero in `iconMapping.tsx` lo verifica il test frontend
        // `iconeDelSeed.test.tsx`; qui si pinna quale nome porta ciascuna voce.
        voce.Icona.Should().Be(icona);

        Menu padre = await verifica.Menus.FirstAsync(m => m.Titolo == "Sito" && m.Percorso == string.Empty);
        voce.MenuPadreId.Should().Be(padre.Id);
    }

    /// <summary>
    /// ⚠️ Non "Settings": quella è già la sezione Impostazioni della cassa, e le due voci
    /// sarebbero indistinguibili proprio dove non vanno confuse — gli orari si modificano solo
    /// in una delle due. Stessa regola per le nove icone della sezione, che devono essere
    /// tutte diverse fra loro.
    /// </summary>
    [Fact]
    public async Task SeedMenusSito_LeNoveIcone_SonoTutteDiverseENessunaEQuellaDellaCassa()
    {
        (ServiceProvider provider, string nomeDatabase) = ProviderDiSeed(
            new Ruolo { Nome = "SuperAdmin", Amministratore = true });

        await SeedMenusSito.Initialize(provider);

        using AppDbContext verifica = TestDbContextFactory.Create(nomeDatabase);
        List<string> icone = await verifica.Menus
            .Where(m => m.Percorso.StartsWith("/gestionale/sito/"))
            .Select(m => m.Icona)
            .ToListAsync();

        icone.Should().HaveCount(9);
        icone.Should().OnlyHaveUniqueItems();
        icone.Should().NotContain("Settings");
        // ⚠️ E nemmeno `Menu`, che nella libreria è l'hamburger di navigazione e non un listino:
        // darebbe alla pagina «Menu» del sito l'icona dell'altra cosa che quella parola
        // significa in questo gestionale.
        icone.Should().NotContain("Menu");
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

        vociSito.Should().HaveCount(10);
        // Le voci nuove non fanno eccezione: il gating si semina insieme alla voce, non dopo.
        // 🔴 Le cinque schede di pagina sono la superficie nuova, e sono quelle da cui si
        //    scrivono i testi del sito: se una nascesse senza ruoli, sarebbe invisibile anche a
        //    un amministratore — o, peggio, visibile a chiunque se il gating fosse per assenza.
        vociSito.Where(m => m.Percorso.StartsWith("/gestionale/sito/pagine/")).Should().HaveCount(5);
        vociSito.Where(m => m.Percorso.StartsWith("/gestionale/sito/pagine/"))
            .Should().OnlyContain(m => m.Ruoli.Count == 2);
        vociSito.Should().Contain(m => m.Percorso == "/gestionale/sito/impostazioni");
        vociSito.Should().Contain(m => m.Percorso == "/gestionale/sito/recensioni");
        // Il ruolo Gestore non compare da nessuna parte: la sezione è riservata.
        vociSito.SelectMany(m => m.Ruoli).Select(r => r.Nome).Distinct()
            .Should().BeEquivalentTo("SuperAdmin", "Admin");
    }
}
