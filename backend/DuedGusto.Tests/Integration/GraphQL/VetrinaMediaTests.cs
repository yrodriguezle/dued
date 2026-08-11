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

    // ── Il SECONDO referente: l'immagine di anteprima social ─────────────────────────────

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
    /// primo.</b> Nell'ordine naturale, una verifica per mutazione (task 7.4) si fermerebbe alla
    /// prima riga rossa e direbbe soltanto "non è stata sollevata alcuna eccezione" — il sintomo
    /// invece del guasto. Con lo scope si raccolgono <b>tutte</b> le asserzioni in un giro solo,
    /// quindi il rapporto di fallimento dice a chi rimuove il controllo <b>quali</b> proprietà
    /// sono cadute e quali no. È la differenza fra una prova e un'impressione.</para>
    /// </summary>
    [Fact]
    public async Task EliminaMediaAsset_UsataComeImmagineOg_RifiutataEIFileRestanoSulDisco()
    {
        MediaAsset asset = await CreaMediaConFile("anteprima-social.jpg");
        ImpostazioniVetrina impostazioni = await CreaImpostazioni(asset.MediaAssetId);

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
            + "perché entrambe le verifiche dei referenti precedono qualunque scrittura su disco");

        // E poi il rifiuto: il messaggio nomina il media e dice cosa fare, come quello dei
        // prodotti.
        sollevata.Should().BeOfType<ExecutionError>();
        sollevata?.Message.Should().Contain("anteprima-social.jpg")
            .And.Contain("anteprima social")
            .And.Contain("impostazioni del sito");

        _dbContext.MediaAssets.Should().HaveCount(1);
        _dbContext.ImpostazioniVetrina.First().ImmagineOgId
            .Should().Be(impostazioni.ImmagineOgId, "il riferimento non deve essere stato toccato");
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

    [Fact]
    public async Task EliminaMediaAsset_DopoAverAzzeratoIlRiferimentoOg_RimuoveRigaETuttiIFile()
    {
        MediaAsset asset = await CreaMediaConFile();
        ImpostazioniVetrina impostazioni = await CreaImpostazioni(asset.MediaAssetId);

        impostazioni.ImmagineOgId = null;
        await _dbContext.SaveChangesAsync();

        bool esito = await VetrinaMutations.EliminaMediaAssetAsync(
            _dbContext, _storage, asset.MediaAssetId);

        esito.Should().BeTrue();
        _dbContext.MediaAssets.Should().BeEmpty();
        Directory.Exists(CartellaDi(asset)).Should().BeFalse(
            "senza referenti l'eliminazione rimuove il record e TUTTI i file delle varianti");
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
    public async Task SeedMenusSito_InvocatoTreVolte_LasciaUnPadreETreFigli()
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
        // Tre, non nove: il conteggio è ciò che distingue un seed idempotente da un seed che
        // riscrive. Il numero cresce con le voci ed è l'unica riga che va toccata quando ne
        // arriva una — l'elenco dei percorsi qui sotto dice quali sono, così un duplicato non
        // può nascondersi dietro un conteggio giusto per caso.
        verifica.Menus.Count(m => m.Percorso.StartsWith("/gestionale/sito/")).Should().Be(3);
        verifica.Menus.Where(m => m.Percorso.StartsWith("/gestionale/sito/"))
            .Select(m => m.Percorso)
            .Should().BeEquivalentTo(
                "/gestionale/sito/media", "/gestionale/sito/prodotti", "/gestionale/sito/impostazioni");
    }

    /// <summary>
    /// Il <c>PercorsoFile</c> è ciò che <c>ProtectedRoutes.loadDynamicComponent()</c> importa a
    /// runtime, ed è relativo a <c>src/components/pages/</c>: un percorso sbagliato non rompe
    /// alcun test — rompe la voce di menu, con una pagina che non si apre. È l'errore classico
    /// di questo seed, quindi si pinna qui invece di scoprirlo cliccando.
    /// </summary>
    [Fact]
    public async Task SeedMenusSito_TerzaVoce_PuntaAlComponenteDelleImpostazioniDelSito()
    {
        (ServiceProvider provider, string nomeDatabase) = ProviderDiSeed(
            new Ruolo { Nome = "SuperAdmin", Amministratore = true });

        await SeedMenusSito.Initialize(provider);

        using AppDbContext verifica = TestDbContextFactory.Create(nomeDatabase);
        Menu voce = await verifica.Menus.FirstAsync(m => m.Percorso == "/gestionale/sito/impostazioni");

        voce.Titolo.Should().Be("Impostazioni sito");
        voce.NomeVista.Should().Be("ImpostazioniVetrinaPage");
        voce.PercorsoFile.Should().Be("sito/ImpostazioniVetrinaPage.tsx");
        voce.Posizione.Should().Be(3);
        // ⚠️ Non "Settings": quella è già la sezione Impostazioni della cassa, e le due voci
        // sarebbero indistinguibili proprio dove non vanno confuse.
        voce.Icona.Should().Be("Store");
        voce.Icona.Should().NotBe("Settings");

        Menu padre = await verifica.Menus.FirstAsync(m => m.Titolo == "Sito" && m.Percorso == string.Empty);
        voce.MenuPadreId.Should().Be(padre.Id);
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

        vociSito.Should().HaveCount(4);
        // La terza voce non fa eccezione: il gating si semina insieme alla voce, non dopo.
        vociSito.Should().Contain(m => m.Percorso == "/gestionale/sito/impostazioni");
        // Il ruolo Gestore non compare da nessuna parte: la sezione è riservata.
        vociSito.SelectMany(m => m.Ruoli).Select(r => r.Nome).Distinct()
            .Should().BeEquivalentTo("SuperAdmin", "Admin");
    }
}
