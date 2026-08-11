using Microsoft.EntityFrameworkCore;

using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Memory;
using SixLabors.ImageSharp.Metadata;
using SixLabors.ImageSharp.Processing;

using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.Services.Media;

/// <summary>Esito dell'elaborazione, che il controller traduce nei codici HTTP del contratto REST.</summary>
public enum EsitoElaborazione
{
    /// <summary>201 — asset creato.</summary>
    Ok,

    /// <summary>400 — MIME non ammesso, oltre i limiti, animata, non decodificabile.</summary>
    InputNonValido,

    /// <summary>503 — semaforo saturo: il client può riprovare fra qualche secondo.</summary>
    ServizioSaturo,

    /// <summary>409 — collisione di chiave non risolta dopo i tentativi previsti.</summary>
    CollisioneChiave,

    /// <summary>500 — la scrittura su disco o la persistenza sono fallite.</summary>
    ErrorePersistenza,
}

/// <summary>Risultato della pipeline: o l'asset creato, o il motivo leggibile del rifiuto.</summary>
public sealed record RisultatoElaborazione(EsitoElaborazione Esito, string Messaggio, MediaAsset? Asset)
{
    public static RisultatoElaborazione Riuscito(MediaAsset asset) =>
        new(EsitoElaborazione.Ok, "Immagine elaborata correttamente.", asset);

    public static RisultatoElaborazione Rifiutato(EsitoElaborazione esito, string messaggio) =>
        new(esito, messaggio, null);
}

/// <summary>
/// La pipeline di elaborazione delle immagini. <b>L'ordine dei nove passi è la specifica</b>
/// (design.md §D11), non un dettaglio implementativo: invertire (5) e (6) ruota silenziosamente
/// ogni foto verticale, saltare (3) manda in OOM il container — cioè mette la cassa offline.
///
/// <code>
/// 1. Pre-volo, zero I/O   MIME dichiarato in allow-list · lunghezza &lt;= 20 MB      → 400
/// 2. Semaforo             SemaphoreSlim(2).WaitAsync(30s)                         → 503
/// 3. Identify             SOLO header, nessun decode: Mpx · lato minimo · 1 frame  → 400
/// 4. Decode ridotto       DecoderOptions { TargetSize = 1600 }
/// 5. AutoOrient           PRIMA di ogni resize
/// 6. Strip metadati       Exif = Iptc = Xmp = Icc = null — DOPO AutoOrient
/// 7. Varianti             per w &lt;= sorgente: Lanczos3 → WebP q80 + JPEG q82
/// 8. LQIP                 20 px → WebP q40 → base64
/// 9. Persistenza          "{chiave}.tmp/" → Move → INSERT MediaAsset
/// </code>
/// </summary>
public class ImmagineProcessor(
    IMediaStorage storage,
    AppDbContext dbContext,
    ILogger<ImmagineProcessor> logger)
{
    /// <summary>
    /// Limita le decodifiche <b>concorrenti</b>: è process-wide di proposito, perché la memoria
    /// che protegge è quella del processo. Insieme al tetto sull'allocatore (Program.cs) forma
    /// il doppio freno: il semaforo limita quanti file insieme, l'allocatore quanto può costare
    /// uno solo. Nessuno dei due sostituisce l'altro.
    /// </summary>
    private static readonly SemaphoreSlim Semaforo =
        new(MediaLimiti.DecodificheConcorrenti, MediaLimiti.DecodificheConcorrenti);

    /// <summary>Tentativi di generazione della chiave prima di dichiarare la collisione irrisolta.</summary>
    private const int TentativiChiave = 3;

    public async Task<RisultatoElaborazione> ElaboraAsync(
        Stream contenuto,
        long lunghezza,
        string? mimeDichiarato,
        string nomeOriginale,
        string? cartella,
        string? testoAlternativo,
        CancellationToken cancellationToken = default)
    {
        // ── (1) Pre-volo, zero I/O ───────────────────────────────────────────────────────
        // Prima di toccare il contenuto: se il MIME dichiarato non è nemmeno nell'allow-list,
        // o la lunghezza è fuori soglia, non c'è ragione di leggere un byte. Il MIME dichiarato
        // NON è però una garanzia — un ZIP rinominato foto.jpg lo dichiara image/jpeg: la
        // verifica sul contenuto reale è il passo (3).
        if (lunghezza <= 0)
        {
            return RisultatoElaborazione.Rifiutato(
                EsitoElaborazione.InputNonValido, "Il file caricato è vuoto.");
        }

        if (lunghezza > MediaLimiti.MaxByteFile)
        {
            return RisultatoElaborazione.Rifiutato(
                EsitoElaborazione.InputNonValido,
                $"Il file supera la dimensione massima consentita di {MediaLimiti.MaxByteFile / (1024 * 1024)} MB.");
        }

        if (!MediaLimiti.MimeAmmessi.Contains(mimeDichiarato, StringComparer.OrdinalIgnoreCase))
        {
            return RisultatoElaborazione.Rifiutato(
                EsitoElaborazione.InputNonValido,
                $"Tipo di file non supportato. Formati ammessi: {string.Join(", ", MediaLimiti.MimeAmmessi)}.");
        }

        // ── (2) Semaforo ─────────────────────────────────────────────────────────────────
        if (!await Semaforo.WaitAsync(MediaLimiti.TimeoutSemaforo, cancellationToken))
        {
            return RisultatoElaborazione.Rifiutato(
                EsitoElaborazione.ServizioSaturo,
                "Il server sta già elaborando altre immagini: riprova fra qualche secondo.");
        }

        try
        {
            return await ElaboraSottoSemaforoAsync(
                contenuto, nomeOriginale, cartella, testoAlternativo, cancellationToken);
        }
        finally
        {
            Semaforo.Release();
        }
    }

    private async Task<RisultatoElaborazione> ElaboraSottoSemaforoAsync(
        Stream contenuto,
        string nomeOriginale,
        string? cartella,
        string? testoAlternativo,
        CancellationToken cancellationToken)
    {
        // Identify e Load leggono lo stesso stream due volte: se non è riavvolgibile
        // (caso raro ma possibile a seconda di come il corpo multipart è stato bufferizzato)
        // se ne prende una copia in memoria — a valle del controllo di lunghezza del passo (1),
        // quindi con un tetto noto e non con "quanto arriva".
        Stream sorgente = contenuto;
        MemoryStream? copia = null;
        if (!contenuto.CanSeek)
        {
            copia = new MemoryStream();
            await contenuto.CopyToAsync(copia, cancellationToken);
            copia.Position = 0;
            sorgente = copia;
        }

        try
        {
            // ── (3) Identify — SOLO header, nessun decode ────────────────────────────────
            // 🔴 Questo passo è ciò che tiene in piedi il container: Image.Identify legge
            // l'intestazione e restituisce Width/Height/FrameCount SENZA allocare il bitmap.
            // Un JPEG da 12 Mpx decompresso occupa ~48 MB, a 50 Mpx sarebbero ~150 MB:
            // rifiutare DOPO il decode significa aver già pagato la memoria che si voleva
            // evitare, e alcuni upload concorrenti su un VPS piccolo mandano il backend in OOM.
            sorgente.Position = 0;
            ImageInfo informazioni;
            try
            {
                informazioni = Image.Identify(sorgente);
            }
            catch (Exception ex) when (ex is ImageFormatException or NotSupportedException)
            {
                // Se l'header non è quello di un'immagine, non è un'immagine: qualunque cosa
                // dica il Content-Type dichiarato dal client (ZIP rinominato .jpg, PDF, ecc.).
                return RisultatoElaborazione.Rifiutato(
                    EsitoElaborazione.InputNonValido,
                    "Il file non è un'immagine supportata.");
            }

            RisultatoElaborazione? rifiuto = ValidaIntestazione(informazioni);
            if (rifiuto is not null) return rifiuto;

            string mimeReale = informazioni.Metadata.DecodedImageFormat!.DefaultMimeType;

            // ── (4) Decode ridotto ───────────────────────────────────────────────────────
            // TargetSize fa fare al decoder JPEG lo scaling IDCT durante la decompressione: un
            // 4000x3000 viene decodificato già ridotto invece di materializzare 36 MB. Non è
            // una nostra ottimizzazione, è una feature del decoder.
            // ⚠️ Vale per JPEG: PNG e WebP decodificano a piena risoluzione e poi scalano, ed è
            // esattamente per loro che il tetto del passo (3) resta la garanzia dura.
            // ⚠️ SkipMetadata resta FALSE: senza EXIF, AutoOrient non avrebbe nulla da leggere.
            //
            // 🔴 Due trappole di TargetSize, verificate sul campo e non evidenti dal nome:
            //
            //   a) NON è un tetto. ImageSharp decodifica *dentro* il riquadro, quindi
            //      INGRANDISCE una sorgente più piccola: con un riquadro fisso 1600x1600 una
            //      foto da 900 px usciva decodificata a 1600 px, e la pipeline generava
            //      quattro varianti tutte più grandi e più sfocate dell'originale — cioè
            //      esattamente ciò che la regola "mai upscaling" esiste per impedire. Il
            //      riquadro si calcola quindi da un fattore <= 1: quando la sorgente è già
            //      piccola, TargetSize non si imposta affatto.
            //
            //   b) Il riquadro va dimensionato sul lato CORTO, non sul lato lungo. Una foto
            //      verticale sul sensore è orizzontale, con Orientation = 6: riducendo il lato
            //      lungo a 1600 la larghezza dopo la rotazione scenderebbe a ~1200, e la
            //      variante 1600 — che la sorgente permetteva — non nascerebbe mai. Portando a
            //      1600 il lato corto, qualunque dei due lati diventi la larghezza dopo
            //      AutoOrient la larghezza massima del set resta generabile senza ingrandire.
            int larghezzaMassima = MediaLimiti.LarghezzeVarianti.Max();
            var opzioni = new DecoderOptions
            {
                MaxFrames = 1,
                TargetSize = RiquadroDecodifica(informazioni, larghezzaMassima),
            };

            sorgente.Position = 0;
            using Image immagine = await Image.LoadAsync(opzioni, sorgente, cancellationToken);

            // ── (5) AutoOrient — PRIMA di ogni resize ────────────────────────────────────
            // Una foto verticale da telefono è orizzontale sul sensore, con Orientation = 6.
            // Ridimensionarla prima di raddrizzarla la ridurrebbe sull'asse sbagliato e la
            // farebbe uscire schiacciata.
            immagine.Mutate(x => x.AutoOrient());

            // ── (6) Strip dei metadati — DOPO AutoOrient, ed è l'errore classico ─────────
            // 🔴 Azzerare l'ExifProfile PRIMA di AutoOrient rende AutoOrient un no-op
            // silenzioso: nessun errore, e tutte le foto verticali ruotate di 90°. Dopo (5)
            // l'orientamento è cotto nei pixel e l'EXIF non serve più a niente.
            // Le foto del locale sono scatti da smartphone e portano con sé le coordinate GPS
            // del bar dentro l'ExifProfile: nessun file servito da nginx deve conservarle.
            StripMetadati(immagine);

            // Dimensioni persistite: quelle DOPO AutoOrient, cioè quelle che il browser vedrà.
            // Sono ciò che rende corretti gli attributi width/height e azzera il layout shift.
            int larghezza = immagine.Width;
            int altezza = immagine.Height;

            // ── (7) Varianti — mai upscaling ─────────────────────────────────────────────
            // Solo le larghezze <= sorgente: ingrandire produce file più grandi E più sfocati
            // dell'originale. Se la sorgente è più stretta della minima del set, nessuna
            // larghezza qualifica e scatta il fallback alla larghezza nativa, così l'insieme
            // delle varianti non è MAI vuoto e il frontend ha sempre almeno un URL valido.
            int[] larghezzeDaGenerare = MediaLimiti.LarghezzeVarianti
                .Where(w => w <= larghezza)
                .ToArray();

            if (larghezzeDaGenerare.Length == 0) larghezzeDaGenerare = [larghezza];

            List<VarianteMedia> varianti = larghezzeDaGenerare
                .SelectMany(w => GeneraCoppiaVarianti(immagine, w))
                .ToList();

            // ── (8) LQIP ─────────────────────────────────────────────────────────────────
            string placeholder = GeneraPlaceholder(immagine);

            // ── (9) Persistenza: file prima, riga dopo ───────────────────────────────────
            // I due modi di fallire non sono equivalenti: file senza riga = spazzatura
            // invisibile e ripulibile; riga senza file = immagine rotta nella UI e nel sito.
            // Si sceglie deliberatamente il fallimento che non mente.
            return await PersistiAsync(
                varianti, larghezzeDaGenerare, placeholder, mimeReale,
                nomeOriginale, cartella, testoAlternativo, larghezza, altezza, cancellationToken);
        }
        catch (Exception ex) when (ex is ImageFormatException or NotSupportedException)
        {
            return RisultatoElaborazione.Rifiutato(
                EsitoElaborazione.InputNonValido,
                "Il file non è un'immagine supportata o è danneggiato.");
        }
        catch (InvalidMemoryOperationException ex)
        {
            // Il tetto dell'allocatore ha fermato un file patologico: è una difesa che ha
            // funzionato, non un bug — ma il client deve leggerne una versione comprensibile.
            logger.LogWarning(ex, "Limite di allocazione superato elaborando {Nome}", nomeOriginale);
            return RisultatoElaborazione.Rifiutato(
                EsitoElaborazione.InputNonValido,
                "L'immagine è troppo complessa da elaborare: riducila e riprova.");
        }
        finally
        {
            copia?.Dispose();
        }
    }

    /// <summary>
    /// Riquadro da passare a <see cref="DecoderOptions.TargetSize"/>, oppure <c>null</c> quando
    /// la sorgente è già abbastanza piccola: si veda il commento del passo (4) per le due
    /// trappole che questo calcolo evita (TargetSize ingrandisce, e va misurato sul lato corto).
    /// </summary>
    private static Size? RiquadroDecodifica(ImageInfo informazioni, int larghezzaMassima)
    {
        int latoCorto = Math.Min(informazioni.Width, informazioni.Height);
        if (latoCorto <= larghezzaMassima) return null;

        double fattore = larghezzaMassima / (double)latoCorto;
        return new Size(
            Math.Max(1, (int)Math.Round(informazioni.Width * fattore)),
            Math.Max(1, (int)Math.Round(informazioni.Height * fattore)));
    }

    /// <summary>
    /// Le tre soglie che si possono decidere leggendo la sola intestazione. Ogni rifiuto ha un
    /// messaggio distinto: "troppo grande in pixel", "troppo piccola" e "animata" sono problemi
    /// diversi e l'utente deve sapere quale dei tre ha davanti.
    /// </summary>
    private static RisultatoElaborazione? ValidaIntestazione(ImageInfo informazioni)
    {
        IImageFormat? formato = informazioni.Metadata.DecodedImageFormat;
        if (formato is null || !MediaLimiti.MimeAmmessi.Contains(formato.DefaultMimeType, StringComparer.OrdinalIgnoreCase))
        {
            return RisultatoElaborazione.Rifiutato(
                EsitoElaborazione.InputNonValido,
                $"Il contenuto del file non è un'immagine di un formato supportato ({string.Join(", ", MediaLimiti.MimeAmmessi)}).");
        }

        // long: 12000 * 10000 sfonda l'int a 32 bit ben prima di arrivare al confronto.
        long pixel = (long)informazioni.Width * informazioni.Height;
        if (pixel > (long)MediaLimiti.MaxMegapixel * 1_000_000)
        {
            return RisultatoElaborazione.Rifiutato(
                EsitoElaborazione.InputNonValido,
                $"L'immagine è troppo grande: {pixel / 1_000_000d:0.#} megapixel, il massimo consentito è {MediaLimiti.MaxMegapixel}.");
        }

        if (informazioni.Width < MediaLimiti.LatoMinimoPx || informazioni.Height < MediaLimiti.LatoMinimoPx)
        {
            return RisultatoElaborazione.Rifiutato(
                EsitoElaborazione.InputNonValido,
                $"L'immagine è troppo piccola: ogni lato deve misurare almeno {MediaLimiti.LatoMinimoPx} pixel.");
        }

        if (informazioni.FrameMetadataCollection.Count > 1)
        {
            return RisultatoElaborazione.Rifiutato(
                EsitoElaborazione.InputNonValido,
                "Le immagini animate non sono supportate.");
        }

        return null;
    }

    /// <summary>
    /// Rimuove EXIF (dove vive il GPS), IPTC, XMP e ICC dall'immagine e da ogni suo frame.
    /// L'ICC se ne va anch'esso: consegnare sul web un profilo colore sconosciuto è peggio che
    /// assumere sRGB. Le varianti si clonano DOPO questa chiamata, quindi nascono già pulite.
    /// </summary>
    private static void StripMetadati(Image immagine)
    {
        ImageMetadata metadati = immagine.Metadata;
        metadati.ExifProfile = null;
        metadati.IptcProfile = null;
        metadati.XmpProfile = null;
        metadati.IccProfile = null;

        immagine.Frames
            .Select(frame => frame.Metadata)
            .ToList()
            .ForEach(frame =>
            {
                frame.ExifProfile = null;
                frame.IptcProfile = null;
                frame.XmpProfile = null;
                frame.IccProfile = null;
            });
    }

    /// <summary>
    /// La coppia WebP + JPEG di una larghezza. Il JPEG non è ridondante: è il fallback per i
    /// pochi user agent senza WebP, ed esiste perché un <c>&lt;picture&gt;</c> senza sorgente
    /// alternativa non degrada, si rompe.
    /// </summary>
    private static IEnumerable<VarianteMedia> GeneraCoppiaVarianti(Image immagine, int larghezza)
    {
        // Height 0 = altezza calcolata dal rapporto d'aspetto della sorgente. Si chiama solo
        // con larghezza <= sorgente, quindi è sempre una riduzione: mai un ingrandimento.
        using Image ridotta = immagine.Clone(x => x.Resize(larghezza, 0, KnownResamplers.Lanczos3));

        return
        [
            new VarianteMedia($"{larghezza}.webp", Codifica(ridotta, new WebpEncoder { Quality = MediaLimiti.QualitaWebp })),
            new VarianteMedia($"{larghezza}.jpg", Codifica(ridotta, new JpegEncoder { Quality = MediaLimiti.QualitaJpeg })),
        ];
    }

    /// <summary>
    /// LQIP: 20 px di larghezza in WebP a qualità 40, restituito come data URI già pronto per
    /// un <c>background-image</c>. Viaggia dentro ogni risposta che include l'asset, quindi
    /// deve restare minuscolo; in cambio il client mostra qualcosa subito, senza una seconda
    /// richiesta HTTP e senza salto di layout.
    /// </summary>
    private static string GeneraPlaceholder(Image immagine)
    {
        using Image miniatura = immagine.Clone(x =>
            x.Resize(MediaLimiti.LarghezzaPlaceholderPx, 0, KnownResamplers.Box));

        byte[] byteWebp = Codifica(miniatura, new WebpEncoder { Quality = MediaLimiti.QualitaPlaceholder });
        return $"data:image/webp;base64,{Convert.ToBase64String(byteWebp)}";
    }

    private static byte[] Codifica(Image immagine, IImageEncoder encoder)
    {
        using var buffer = new MemoryStream();
        immagine.Save(buffer, encoder);
        return buffer.ToArray();
    }

    /// <summary>
    /// Scrive le varianti e inserisce il record. La chiave si rigenera in caso di collisione:
    /// il suffisso casuale la rende improbabile, ma l'indice UNIQUE è l'unica garanzia vera e
    /// va gestito invece che sperato. Se la <c>INSERT</c> fallisce si rimuovono i file appena
    /// scritti: sarebbero comunque spazzatura ripulibile, ma lasciarli è una scelta, non un caso.
    /// </summary>
    private async Task<RisultatoElaborazione> PersistiAsync(
        IReadOnlyList<VarianteMedia> varianti,
        IReadOnlyList<int> larghezzeGenerate,
        string placeholder,
        string mimeReale,
        string nomeOriginale,
        string? cartella,
        string? testoAlternativo,
        int larghezza,
        int altezza,
        CancellationToken cancellationToken)
    {
        DateTime adesso = DateTime.UtcNow;

        foreach (int tentativo in Enumerable.Range(1, TentativiChiave))
        {
            string chiave = SlugGenerator.CreaChiave(nomeOriginale, adesso);

            if (await dbContext.MediaAssets.AnyAsync(m => m.Chiave == chiave, cancellationToken))
            {
                logger.LogWarning("Collisione di chiave media '{Chiave}' al tentativo {Tentativo}", chiave, tentativo);
                continue;
            }

            long byteTotali;
            try
            {
                byteTotali = await storage.ScriviVariantiAsync(chiave, varianti, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Scrittura delle varianti fallita per la chiave {Chiave}", chiave);
                return RisultatoElaborazione.Rifiutato(
                    EsitoElaborazione.ErrorePersistenza,
                    "Salvataggio dell'immagine non riuscito: riprova, e se il problema persiste contatta l'amministratore.");
            }

            var asset = new MediaAsset
            {
                Chiave = chiave,
                NomeOriginale = Tronca(nomeOriginale, 255),
                MimeType = mimeReale,
                Larghezza = larghezza,
                Altezza = altezza,
                LarghezzeDisponibili = string.Join(',', larghezzeGenerate),
                TestoAlternativo = TroncaOpzionale(NullSeVuoto(testoAlternativo), 500),
                Placeholder = placeholder,
                Cartella = Tronca(NormalizzaCartella(cartella), 100),
                Ordinamento = 0,
                Pubblicato = true,
                ByteTotali = byteTotali,
                CreatedAt = adesso,
                UpdatedAt = adesso,
            };

            try
            {
                dbContext.MediaAssets.Add(asset);
                await dbContext.SaveChangesAsync(cancellationToken);
                return RisultatoElaborazione.Riuscito(asset);
            }
            catch (DbUpdateException ex)
            {
                // Il record non deve restare a puntare a file che nessuno userà, e i file non
                // devono restare senza record: si torna allo stato di partenza e si riprova.
                logger.LogError(ex, "Inserimento del MediaAsset fallito per la chiave {Chiave}", chiave);
                dbContext.Entry(asset).State = EntityState.Detached;
                await storage.EliminaAsync(chiave, cancellationToken);
            }
        }

        return RisultatoElaborazione.Rifiutato(
            EsitoElaborazione.CollisioneChiave,
            "Impossibile assegnare un identificativo univoco all'immagine: riprova.");
    }

    private static string NormalizzaCartella(string? cartella) =>
        string.IsNullOrWhiteSpace(cartella) ? "generale" : cartella.Trim();

    private static string? NullSeVuoto(string? valore) =>
        string.IsNullOrWhiteSpace(valore) ? null : valore.Trim();

    private static string Tronca(string valore, int massimo) =>
        valore.Length > massimo ? valore[..massimo] : valore;

    private static string? TroncaOpzionale(string? valore, int massimo) =>
        valore is null ? null : Tronca(valore, massimo);
}
