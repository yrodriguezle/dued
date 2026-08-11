using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using duedgusto.DataAccess;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.Services.Jwt;
using duedgusto.Services.Media;

namespace duedgusto.Controllers;

/// <summary>Costanti dei limiti, lette dal client per non averne una copia propria.</summary>
public record MediaConfigurazioneDto(
    long MaxByteFile,
    int MaxMegapixel,
    int[] LarghezzeVarianti,
    string[] MimeAmmessi);

/// <summary>Corpo della risposta 201 dell'upload.</summary>
public record MediaCaricatoDto(
    int MediaAssetId,
    string Chiave,
    int Larghezza,
    int Altezza,
    int[] LarghezzeDisponibili,
    string? Placeholder,
    string MimeType);

/// <summary>
/// L'unica superficie REST dei media: l'upload multipart e la lettura delle costanti.
/// Tutto il resto del CRUD (elenco, modifica dei metadati editoriali, eliminazione) è
/// privato e vive in GraphQL — <b>REST è la corsia del pubblico, GraphQL quella del
/// privato</b>, e qui REST ospita soltanto ciò che GraphQL non sa trasportare: il client
/// GraphQL del progetto non ha un link per il multipart, e il client HTTP generico hardcoda
/// <c>Content-Type: application/json</c>.
/// </summary>
[Authorize]
[Route("api/[controller]")]
[ApiController]
public class MediaController(
    AppDbContext dbContext,
    JwtHelper jwtHelper,
    ImmagineProcessor processor,
    ILogger<MediaController> logger) : ControllerBase
{
    /// <summary>
    /// 22 MB — il backstop di Kestrel/MVC contro un nginx bypassato (sviluppo, LAN).
    /// 🔴 Deliberatamente <b>maggiore</b> di <see cref="MediaLimiti.MaxByteFile"/> (20 MB) e
    /// <b>minore</b> del <c>client_max_body_size 24M</c> di <c>deploy/nginx/duedgusto.conf</c>:
    /// i limiti stanno in ordine decrescente di permissività dall'esterno verso l'interno, così
    /// che a rifiutare un file troppo grande sia sempre lo strato che sa dire <i>perché</i>.
    /// Il margine copre l'overhead della codifica multipart: con limiti numericamente uguali un
    /// file esattamente al limite produce un corpo più grande del limite e prende un 413 nudo.
    /// Resta sotto il <c>MaxRequestBodySize</c> di default di Kestrel (~28,6 MB), quindi non
    /// serve toccare il limite globale e ogni altro endpoint conserva la protezione di default.
    /// </summary>
    private const int LimiteCorpoRichiesta = 22 * 1024 * 1024;

    /// <summary>
    /// Le costanti dei limiti. <c>[Authorize]</c> ma <b>senza</b> guard amministratore: espone
    /// soltanto numeri, e serve a ogni client che debba validare prima di inviare. È il motivo
    /// per cui il frontend non può divergere dal backend — non ha un proprio valore da far
    /// divergere.
    /// </summary>
    [HttpGet("configurazione")]
    public ActionResult<MediaConfigurazioneDto> Configurazione() =>
        Ok(new MediaConfigurazioneDto(
            MediaLimiti.MaxByteFile,
            MediaLimiti.MaxMegapixel,
            MediaLimiti.LarghezzeVarianti,
            MediaLimiti.MimeAmmessi));

    /// <summary>
    /// Upload di <b>un solo</b> file per richiesta. Il limite multiplo diventerebbe "somma dei
    /// file", incomprensibile per l'utente ("ma la foto pesa 3 MB!"), e la barra di progresso
    /// non saprebbe a quale file si riferisce.
    /// </summary>
    [HttpPost]
    [RequestSizeLimit(LimiteCorpoRichiesta)]
    [RequestFormLimits(MultipartBodyLengthLimit = LimiteCorpoRichiesta)]
    public async Task<IActionResult> Carica(
        IFormFile? file,
        [FromForm] string? cartella,
        [FromForm] string? alt,
        CancellationToken cancellationToken)
    {
        // 🔴 L'unico livello di gating che sia sicurezza: il menu nascosto e il guard nella
        // pagina sono cosmesi, e un utente autenticato non amministratore può chiamare questa
        // rotta direttamente saltandoli entrambi. Si usa la forma booleana del guard perché
        // l'ExecutionError della variante GraphQL, dentro un controller, sarebbe un 500 opaco.
        int utenteId = jwtHelper.GetUserID(User);
        if (!await GestioneCassaGuards.IsUtenteAmministratore(dbContext, utenteId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Operazione riservata agli amministratori: il tuo ruolo non ha i privilegi necessari.",
            });
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Nessun file ricevuto: allega un'immagine al campo 'file'." });
        }

        await using Stream contenuto = file.OpenReadStream();

        RisultatoElaborazione risultato = await processor.ElaboraAsync(
            contenuto,
            file.Length,
            file.ContentType,
            file.FileName,
            cartella,
            alt,
            cancellationToken);

        if (risultato.Esito != EsitoElaborazione.Ok)
        {
            // Ogni errore ha un corpo JSON { message } in italiano, come AuthController: è la
            // forma che il client sa leggere e mostrare all'utente.
            logger.LogInformation(
                "Upload media rifiutato ({Esito}) per l'utente {UtenteId}: {Messaggio}",
                risultato.Esito, utenteId, risultato.Messaggio);

            return StatusCode(CodiceHttp(risultato.Esito), new { message = risultato.Messaggio });
        }

        Models.MediaAsset asset = risultato.Asset!;
        return StatusCode(StatusCodes.Status201Created, new MediaCaricatoDto(
            asset.MediaAssetId,
            asset.Chiave,
            asset.Larghezza,
            asset.Altezza,
            LeggiLarghezze(asset.LarghezzeDisponibili),
            asset.Placeholder,
            asset.MimeType));
    }

    private static int CodiceHttp(EsitoElaborazione esito) => esito switch
    {
        EsitoElaborazione.InputNonValido => StatusCodes.Status400BadRequest,
        EsitoElaborazione.CollisioneChiave => StatusCodes.Status409Conflict,
        EsitoElaborazione.ServizioSaturo => StatusCodes.Status503ServiceUnavailable,
        _ => StatusCodes.Status500InternalServerError,
    };

    private static int[] LeggiLarghezze(string csv) =>
        csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
           .Select(int.Parse)
           .ToArray();
}
