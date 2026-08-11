using Microsoft.Extensions.Logging;

using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Metadata.Profiles.Exif;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

using duedgusto.Services.Media;
using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Unit.Services.Media;

/// <summary>
/// La pipeline immagini provata sul comportamento, non sulla forma del codice: l'ordine dei
/// nove passi è la specifica, e ogni inversione produce un guasto <b>silenzioso</b> — nessun
/// errore, solo foto ruotate o memoria bruciata.
/// </summary>
public class ImmagineProcessorTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly string _radice;
    private readonly ImmagineProcessor _processor;

    public ImmagineProcessorTests()
    {
        _dbContext = TestDbContextFactory.Create();
        _radice = Path.Combine(Path.GetTempPath(), "duedgusto-media-test", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_radice);

        var storage = new FileSystemMediaStorage(
            new MediaRoot(_radice),
            new Mock<ILogger<FileSystemMediaStorage>>().Object);

        _processor = new ImmagineProcessor(storage, _dbContext, new Mock<ILogger<ImmagineProcessor>>().Object);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        if (Directory.Exists(_radice)) Directory.Delete(_radice, recursive: true);
        GC.SuppressFinalize(this);
    }

    // ── Sorgenti sintetiche ──────────────────────────────────────────────────────────────

    private static byte[] Jpeg(int larghezza, int altezza, Action<Image<Rgba32>>? personalizza = null)
    {
        using var immagine = new Image<Rgba32>(larghezza, altezza);
        immagine.Mutate(x => x.BackgroundColor(Color.CornflowerBlue));
        personalizza?.Invoke(immagine);

        using var buffer = new MemoryStream();
        immagine.Save(buffer, new JpegEncoder { Quality = 90 });
        return buffer.ToArray();
    }

    /// <summary>
    /// Un JPEG vero la cui <b>intestazione dichiara il falso</b>: i dati sono quelli di
    /// un'immagine piccola, ma il marcatore SOF annuncia 12000×10000. Serve a provare che il
    /// rifiuto arriva dalla lettura dell'intestazione e non dalla decodifica — decodificare
    /// questi byte non produrrebbe mai 120 megapixel.
    /// </summary>
    private static byte[] JpegCheDichiaraDimensioniEnormi(int larghezza, int altezza)
    {
        byte[] byteJpeg = Jpeg(300, 200);

        int sof = Enumerable
            .Range(0, byteJpeg.Length - 1)
            .First(i => byteJpeg[i] == 0xFF && (byteJpeg[i + 1] == 0xC0 || byteJpeg[i + 1] == 0xC2));

        // FF Cx | lunghezza (2) | precisione (1) | altezza (2) | larghezza (2)
        byteJpeg[sof + 5] = (byte)(altezza >> 8);
        byteJpeg[sof + 6] = (byte)(altezza & 0xFF);
        byteJpeg[sof + 7] = (byte)(larghezza >> 8);
        byteJpeg[sof + 8] = (byte)(larghezza & 0xFF);

        return byteJpeg;
    }

    private Task<RisultatoElaborazione> Elabora(byte[] contenuto, string nome = "foto.jpg") =>
        _processor.ElaboraAsync(new MemoryStream(contenuto), contenuto.Length, "image/jpeg", nome, null, null);

    private string PercorsoVariante(MediaAsset asset, string nomeFile) =>
        Path.Combine(_radice, asset.Chiave.Replace('/', Path.DirectorySeparatorChar), nomeFile);

    // ── 7.2 — rifiuto oltre soglia SENZA decodifica ──────────────────────────────────────

    [Fact]
    public async Task Immagine_ConTroppiPixel_RifiutataSullaSolaIntestazione()
    {
        byte[] bugiardo = JpegCheDichiaraDimensioniEnormi(12000, 10000);

        RisultatoElaborazione risultato = await Elabora(bugiardo);

        risultato.Esito.Should().Be(EsitoElaborazione.InputNonValido);
        // Il messaggio nomina i megapixel: è la prova che a fermarla è stato Image.Identify.
        // Se la pipeline avesse decodificato, l'errore sarebbe stato "danneggiata" — questi
        // byte non contengono 120 megapixel di dati.
        risultato.Messaggio.Should().Contain("megapixel");
        risultato.Asset.Should().BeNull();

        _dbContext.MediaAssets.Should().BeEmpty();
        Directory.GetFileSystemEntries(_radice).Should().BeEmpty();
    }

    [Fact]
    public async Task Immagine_TroppoPiccola_Rifiutata()
    {
        RisultatoElaborazione risultato = await Elabora(Jpeg(150, 150));

        risultato.Esito.Should().Be(EsitoElaborazione.InputNonValido);
        risultato.Messaggio.Should().Contain("troppo piccola");
        _dbContext.MediaAssets.Should().BeEmpty();
    }

    [Fact]
    public async Task File_DiTipoNonAmmesso_RifiutatoPrimaDiLeggerloTutto()
    {
        byte[] contenuto = Jpeg(400, 300);

        RisultatoElaborazione risultato = await _processor.ElaboraAsync(
            new MemoryStream(contenuto), contenuto.Length, "application/zip", "archivio.zip", null, null);

        risultato.Esito.Should().Be(EsitoElaborazione.InputNonValido);
        risultato.Messaggio.Should().Contain("non supportato");
    }

    [Fact]
    public async Task File_CheDichiaraJpegMaNonLoE_RifiutatoSulContenuto()
    {
        // Un archivio rinominato foto.jpg dichiara image/jpeg: il MIME del client non è una
        // garanzia, la verifica vera è sull'intestazione reale.
        byte[] finto = "PK questo non è un JPEG"u8.ToArray();

        RisultatoElaborazione risultato = await Elabora(finto);

        risultato.Esito.Should().Be(EsitoElaborazione.InputNonValido);
        _dbContext.MediaAssets.Should().BeEmpty();
    }

    // ── 7.3 — AutoOrient PRIMA dello strip ───────────────────────────────────────────────

    [Fact]
    public async Task FotoConOrientamento6_EsceRuotataEPrivaDiExif()
    {
        // 🔴 È l'errore classico: azzerare l'ExifProfile prima di AutoOrient rende AutoOrient
        // un no-op silenzioso, e tutte le foto verticali escono ruotate di 90° senza che nulla
        // segnali un problema. Se l'ordine fosse invertito questo test troverebbe 600×400.
        byte[] verticale = Jpeg(600, 400, immagine =>
        {
            var exif = new ExifProfile();
            exif.SetValue(ExifTag.Orientation, (ushort)6);
            exif.SetValue(ExifTag.GPSLatitudeRef, "N");
            immagine.Metadata.ExifProfile = exif;
        });

        RisultatoElaborazione risultato = await Elabora(verticale, "verticale.jpg");

        risultato.Esito.Should().Be(EsitoElaborazione.Ok);
        MediaAsset asset = risultato.Asset!;

        // Le dimensioni persistite sono quelle DOPO la rotazione: sono quelle che il browser
        // vedrà, ed è ciò che azzera il salto di layout.
        asset.Larghezza.Should().Be(400);
        asset.Altezza.Should().Be(600);
        asset.LarghezzeDisponibili.Should().Be("400");

        using Image prodotta = await Image.LoadAsync(PercorsoVariante(asset, "400.jpg"));
        prodotta.Width.Should().Be(400);
        prodotta.Height.Should().Be(600);
        prodotta.Metadata.ExifProfile.Should().BeNull();
    }

    // ── 7.4 — strip completo e mai upscaling ─────────────────────────────────────────────

    [Fact]
    public async Task Elaborazione_RimuoveOgniProfiloEIlGps()
    {
        byte[] conGps = Jpeg(900, 600, immagine =>
        {
            var exif = new ExifProfile();
            exif.SetValue(ExifTag.GPSLatitudeRef, "N");
            exif.SetValue(ExifTag.GPSLongitudeRef, "E");
            exif.SetValue(ExifTag.Make, "DuedGusto Phone");
            immagine.Metadata.ExifProfile = exif;
        });

        RisultatoElaborazione risultato = await Elabora(conGps, "con-gps.jpg");
        MediaAsset asset = risultato.Asset!;

        // Le foto del locale sono scatti da smartphone: portano le coordinate del bar.
        // Nessun file servito pubblicamente deve conservarle.
        new[] { "400.jpg", "400.webp", "800.jpg", "800.webp" }
            .Select(nome => Image.Identify(PercorsoVariante(asset, nome)))
            .ToList()
            .ForEach(prodotta =>
            {
                prodotta.Metadata.ExifProfile.Should().BeNull();
                prodotta.Metadata.IptcProfile.Should().BeNull();
                prodotta.Metadata.XmpProfile.Should().BeNull();
                prodotta.Metadata.IccProfile.Should().BeNull();
            });
    }

    [Fact]
    public async Task Sorgente900px_GeneraSolo400E800()
    {
        RisultatoElaborazione risultato = await Elabora(Jpeg(900, 600), "media.jpg");
        MediaAsset asset = risultato.Asset!;

        // Ingrandire produce file più grandi E più sfocati dell'originale.
        asset.LarghezzeDisponibili.Should().Be("400,800");

        File.Exists(PercorsoVariante(asset, "1200.webp")).Should().BeFalse();
        File.Exists(PercorsoVariante(asset, "1600.webp")).Should().BeFalse();

        Directory.GetFiles(Path.GetDirectoryName(PercorsoVariante(asset, "400.webp"))!)
            .Should().HaveCount(4);
    }

    [Fact]
    public async Task SorgenteSottoLaLarghezzaMinima_RicadeSullaVarianteNativa()
    {
        RisultatoElaborazione risultato = await Elabora(Jpeg(300, 240), "minuscola.jpg");
        MediaAsset asset = risultato.Asset!;

        // L'insieme delle varianti non è MAI vuoto: il frontend deve sempre avere un indirizzo
        // valido da mettere nel srcset.
        asset.LarghezzeDisponibili.Should().Be("300");
        File.Exists(PercorsoVariante(asset, "300.webp")).Should().BeTrue();
        File.Exists(PercorsoVariante(asset, "300.jpg")).Should().BeTrue();
    }

    [Fact]
    public async Task OgniLarghezzaDichiarata_HaEntrambiIFormatiSuDisco()
    {
        RisultatoElaborazione risultato = await Elabora(Jpeg(1000, 800), "coppie.jpg");
        MediaAsset asset = risultato.Asset!;

        asset.LarghezzeDisponibili
            .Split(',')
            .SelectMany(larghezza => new[] { $"{larghezza}.webp", $"{larghezza}.jpg" })
            .ToList()
            .ForEach(nome => File.Exists(PercorsoVariante(asset, nome)).Should().BeTrue($"manca {nome}"));
    }

    [Fact]
    public async Task Elaborazione_ProduceUnPlaceholderMinuscoloEUsabileComeDataUri()
    {
        RisultatoElaborazione risultato = await Elabora(Jpeg(1000, 800));
        MediaAsset asset = risultato.Asset!;

        asset.Placeholder.Should().StartWith("data:image/webp;base64,");
        // Viaggia dentro OGNI risposta che include l'asset: deve restare trascurabile.
        asset.Placeholder!.Length.Should().BeLessThan(2048);
    }

    [Fact]
    public async Task Elaborazione_NonConservaMaiIlFileOriginale()
    {
        RisultatoElaborazione risultato = await Elabora(Jpeg(1000, 800), "originale-da-non-tenere.jpg");
        MediaAsset asset = risultato.Asset!;

        Directory.GetFiles(Path.GetDirectoryName(PercorsoVariante(asset, "400.webp"))!)
            .Select(Path.GetFileName)
            .Should().OnlyContain(nome => nome!.EndsWith(".webp") || nome.EndsWith(".jpg"));

        Directory.GetFiles(_radice, "originale-da-non-tenere*", SearchOption.AllDirectories)
            .Should().BeEmpty();
    }

    // ── 7.6 — atomicità vista dal processor ──────────────────────────────────────────────

    [Fact]
    public async Task ScritturaFallita_NonLasciaAlcunRecord()
    {
        var storageRotto = new Mock<IMediaStorage>();
        storageRotto
            .Setup(s => s.ScriviVariantiAsync(It.IsAny<string>(), It.IsAny<IReadOnlyList<VarianteMedia>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new IOException("disco pieno"));

        var processor = new ImmagineProcessor(
            storageRotto.Object, _dbContext, new Mock<ILogger<ImmagineProcessor>>().Object);

        byte[] contenuto = Jpeg(900, 600);
        RisultatoElaborazione risultato = await processor.ElaboraAsync(
            new MemoryStream(contenuto), contenuto.Length, "image/jpeg", "foto.jpg", null, null);

        // Riga senza file = immagine rotta nella UI e nel sito. Meglio nessuna riga.
        risultato.Esito.Should().Be(EsitoElaborazione.ErrorePersistenza);
        risultato.Messaggio.Should().NotBeNullOrWhiteSpace();
        _dbContext.MediaAssets.Should().BeEmpty();
    }
}
