using Microsoft.Extensions.Logging;

using duedgusto.Services.Media;

namespace DuedGusto.Tests.Unit.Services.Media;

/// <summary>
/// L'atomicità della scrittura: una chiave o ha <b>tutte</b> le sue varianti o non esiste.
/// Un sottoinsieme sarebbe peggio di un fallimento — il record a database punterebbe a una
/// cartella che c'è, e il srcset emetterebbe 404 solo su alcune larghezze, cioè solo su
/// alcuni schermi.
/// </summary>
public class FileSystemMediaStorageTests : IDisposable
{
    private readonly string _radice;
    private readonly FileSystemMediaStorage _storage;

    public FileSystemMediaStorageTests()
    {
        _radice = Path.Combine(Path.GetTempPath(), "duedgusto-storage-test", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_radice);
        _storage = new FileSystemMediaStorage(
            new MediaRoot(_radice),
            new Mock<ILogger<FileSystemMediaStorage>>().Object);
    }

    public void Dispose()
    {
        if (Directory.Exists(_radice)) Directory.Delete(_radice, recursive: true);
        GC.SuppressFinalize(this);
    }

    private static VarianteMedia Variante(string nome, int byteTotali = 16) =>
        new(nome, Enumerable.Repeat((byte)7, byteTotali).ToArray());

    private string Cartella(string chiave) =>
        Path.Combine(_radice, chiave.Replace('/', Path.DirectorySeparatorChar));

    [Fact]
    public async Task ScriviVarianti_ScriveTuttoERestituisceIByteTotali()
    {
        long totale = await _storage.ScriviVariantiAsync(
            "2026/08/foto-abc123",
            [Variante("400.webp", 10), Variante("400.jpg", 20)]);

        totale.Should().Be(30);
        Directory.GetFiles(Cartella("2026/08/foto-abc123")).Should().HaveCount(2);
    }

    [Fact]
    public async Task ScritturaFallitaAMeta_NonLasciaNullaSottoLaRadice()
    {
        // La seconda variante ha un nome che non può essere scritto: il fallimento avviene
        // dopo che la prima è già su disco, che è esattamente il caso pericoloso.
        Func<Task> act = () => _storage.ScriviVariantiAsync(
            "2026/08/foto-parziale",
            [Variante("400.webp"), Variante("sottocartella-inesistente/800.webp")]);

        await act.Should().ThrowAsync<Exception>();

        Directory.Exists(Cartella("2026/08/foto-parziale")).Should().BeFalse();
        Directory.Exists(Cartella("2026/08/foto-parziale") + ".tmp").Should().BeFalse();
        // Nessuna cartella temporanea residua: la radice è come prima.
        Directory.GetFiles(_radice, "*", SearchOption.AllDirectories).Should().BeEmpty();
    }

    [Fact]
    public async Task ScriviVarianti_SuUnaChiaveEsistente_Rifiuta()
    {
        // I file non si sovrascrivono MAI: è la regola su cui poggiano la cache "immutable"
        // di un anno e la correttezza banale del backup incrementale.
        await _storage.ScriviVariantiAsync("2026/08/foto-unica", [Variante("400.webp")]);

        Func<Task> act = () => _storage.ScriviVariantiAsync("2026/08/foto-unica", [Variante("400.webp")]);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*esiste già*");
    }

    [Fact]
    public async Task Elimina_RimuoveTuttiIFileDellaChiave()
    {
        await _storage.ScriviVariantiAsync(
            "2026/08/foto-da-togliere",
            [Variante("400.webp"), Variante("400.jpg"), Variante("800.webp")]);

        await _storage.EliminaAsync("2026/08/foto-da-togliere");

        Directory.Exists(Cartella("2026/08/foto-da-togliere")).Should().BeFalse();
    }

    [Fact]
    public async Task Elimina_SuChiaveInesistente_NonEsplode()
    {
        Func<Task> act = () => _storage.EliminaAsync("2026/08/mai-esistita");

        await act.Should().NotThrowAsync();
    }

    /// <summary>
    /// 🔴 Difesa in profondità: lo slug già neutralizza i separatori, ma la chiave attraversa
    /// il database e questo è l'ultimo punto prima di toccare il disco.
    /// </summary>
    [Theory]
    [InlineData("../fuori")]
    [InlineData("2026/../../fuori")]
    public async Task ChiaveCheEsceDallaRadice_Rifiutata(string chiaveOstile)
    {
        Func<Task> act = () => _storage.ScriviVariantiAsync(chiaveOstile, [Variante("400.webp")]);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*fuori dalla radice*");
    }
}
