using System.Security.Claims;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

using duedgusto.Controllers;
using duedgusto.Services.Jwt;
using duedgusto.Services.Media;
using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Unit.Controllers;

/// <summary>
/// 🔴 <c>POST /api/media</c> è l'unico livello di gating che sia davvero sicurezza: il menu
/// nascosto e il guard nella pagina sono cosmesi, e un utente autenticato non amministratore
/// può chiamare questa rotta direttamente saltandoli entrambi.
///
/// Il rifiuto deve essere un <b>403 con corpo JSON</b> e non un 500 opaco: è la forma che
/// <c>uploadRequest</c> sa leggere per mostrare all'utente il motivo vero.
/// </summary>
public class MediaControllerTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly string _radice;
    private readonly MediaController _controller;

    private const int IdAmministratore = 1;
    private const int IdOperatore = 2;

    public MediaControllerTests()
    {
        _dbContext = TestDbContextFactory.Create();
        _radice = Path.Combine(Path.GetTempPath(), "duedgusto-controller-test", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_radice);

        var ruoloAmministratore = new Ruolo { Nome = "Amministratore", Amministratore = true };
        var ruoloOperatore = new Ruolo { Nome = "Operatore", Amministratore = false };
        _dbContext.Ruoli.AddRange(ruoloAmministratore, ruoloOperatore);
        _dbContext.SaveChanges();

        _dbContext.Utenti.AddRange(
            new Utente { Id = IdAmministratore, NomeUtente = "admin", Hash = [1], Salt = [1], Ruolo = ruoloAmministratore },
            new Utente { Id = IdOperatore, NomeUtente = "operatore", Hash = [1], Salt = [1], Ruolo = ruoloOperatore });
        _dbContext.SaveChanges();

        var storage = new FileSystemMediaStorage(
            new MediaRoot(_radice), new Mock<ILogger<FileSystemMediaStorage>>().Object);
        var processor = new ImmagineProcessor(
            storage, _dbContext, new Mock<ILogger<ImmagineProcessor>>().Object);

        _controller = new MediaController(
            _dbContext,
            JwtTestHelper.CreateJwtHelper(),
            processor,
            new Mock<ILogger<MediaController>>().Object);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        if (Directory.Exists(_radice)) Directory.Delete(_radice, recursive: true);
        GC.SuppressFinalize(this);
    }

    private void AutenticaCome(int utenteId)
    {
        var identita = new ClaimsIdentity(
            [new Claim("UserId", utenteId.ToString()), new Claim(ClaimTypes.Name, $"utente-{utenteId}")],
            "Test");

        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identita) },
        };
    }

    private static IFormFile FotoDiProva(string nome = "foto.jpg")
    {
        using var immagine = new Image<Rgba32>(900, 600);
        immagine.Mutate(x => x.BackgroundColor(Color.SeaGreen));
        var buffer = new MemoryStream();
        immagine.Save(buffer, new JpegEncoder { Quality = 85 });
        buffer.Position = 0;

        return new FormFile(buffer, 0, buffer.Length, "file", nome)
        {
            Headers = new HeaderDictionary(),
            ContentType = "image/jpeg",
        };
    }

    private static string? MessaggioDi(object? corpo) =>
        corpo?.GetType().GetProperty("message")?.GetValue(corpo) as string;

    [Fact]
    public async Task Operatore_Carica_Rifiutato403ConCorpoJson()
    {
        AutenticaCome(IdOperatore);

        IActionResult risultato = await _controller.Carica(FotoDiProva(), null, null, CancellationToken.None);

        var oggetto = risultato.Should().BeOfType<ObjectResult>().Subject;
        oggetto.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        // Non un 500 e non un corpo vuoto: uploadRequest legge { message } e lo mostra.
        MessaggioDi(oggetto.Value).Should().Contain("amministratori");
    }

    [Fact]
    public async Task Operatore_Carica_NonLasciaAlcunEffettoCollaterale()
    {
        AutenticaCome(IdOperatore);

        await _controller.Carica(FotoDiProva(), "generale", "prova", CancellationToken.None);

        _dbContext.MediaAssets.Should().BeEmpty();
        Directory.GetFileSystemEntries(_radice).Should().BeEmpty();
    }

    [Fact]
    public async Task Amministratore_Carica_Riesce()
    {
        AutenticaCome(IdAmministratore);

        IActionResult risultato = await _controller.Carica(FotoDiProva(), "generale", "caffè", CancellationToken.None);

        var oggetto = risultato.Should().BeOfType<ObjectResult>().Subject;
        oggetto.StatusCode.Should().Be(StatusCodes.Status201Created);
        _dbContext.MediaAssets.Should().HaveCount(1);
    }

    [Fact]
    public async Task Amministratore_SenzaFile_Riceve400ConCorpoJson()
    {
        AutenticaCome(IdAmministratore);

        IActionResult risultato = await _controller.Carica(null, null, null, CancellationToken.None);

        var oggetto = risultato.Should().BeOfType<BadRequestObjectResult>().Subject;
        MessaggioDi(oggetto.Value).Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void Configurazione_EspostaSenzaGuardAmministratore()
    {
        // Espone solo costanti, e serve a ogni client che debba validare prima di inviare:
        // è il motivo per cui il frontend non ha una copia propria dei limiti.
        AutenticaCome(IdOperatore);

        ActionResult<MediaConfigurazioneDto> risultato = _controller.Configurazione();

        var ok = risultato.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<MediaConfigurazioneDto>().Subject;
        dto.MaxByteFile.Should().Be(MediaLimiti.MaxByteFile);
        dto.MimeAmmessi.Should().BeEquivalentTo(MediaLimiti.MimeAmmessi);
    }
}
