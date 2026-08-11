namespace duedgusto.Services.Media;

/// <summary>
/// Soglie e parametri della pipeline immagini. <b>Unico punto del backend in cui questi
/// numeri esistono</b>: il client non ha una propria copia, li legge da
/// <c>GET /api/media/configurazione</c>, quindi non ha un valore da far divergere.
///
/// 🔴 I limiti vivono in quattro punti, in ordine DECRESCENTE di permissività dall'esterno
/// verso l'interno, così che a rifiutare sia sempre lo strato che sa produrre un messaggio
/// leggibile e mai il web server con un 413 nudo (design.md §D1):
///
///   client (pre-check su file.size)  20 MB  ← l'unico che l'utente incontra davvero
///   nginx  location /api/media       24M    ← <c>deploy/nginx/duedgusto.conf</c>
///   Kestrel/MVC  [RequestSizeLimit]  22 MB  ← <c>MediaController</c>
///   applicazione  MaxByteFile        20 MB  ← QUI
///
/// ⚠️ Cambiare <see cref="MaxByteFile"/> obbliga ad aggiornare <c>deploy/nginx/duedgusto.conf</c>
/// e l'attributo <c>[RequestSizeLimit]</c> del controller, mantenendo il margine: con limiti
/// numericamente uguali l'overhead della codifica multipart (boundary + header di parte)
/// fa rifiutare da nginx un file esattamente al limite, prima che l'app possa dire perché.
/// Un test xUnit pinna il valore proprio per rendere il cambiamento un gesto deliberato.
/// </summary>
public static class MediaLimiti
{
    /// <summary>Dimensione massima del singolo file caricato: 20 MB. Un file per richiesta.</summary>
    public const long MaxByteFile = 20 * 1024 * 1024;

    /// <summary>
    /// Megapixel massimi della sorgente. 50 Mpx copre ogni fotocamera di smartphone in
    /// circolazione (48 Mpx è il massimo comune) e resta nel budget di memoria del container:
    /// un JPEG da 12 Mpx decompresso occupa ~48 MB, a 50 Mpx sarebbero ~150 MB. Il tetto è
    /// verificato sul solo header, prima di allocare qualunque bitmap.
    /// </summary>
    public const int MaxMegapixel = 50;

    /// <summary>Lato minimo della sorgente: sotto i 200 px non è una foto utilizzabile in vetrina.</summary>
    public const int LatoMinimoPx = 200;

    /// <summary>
    /// Larghezze delle varianti responsive. Si generano solo quelle <c>&lt;=</c> larghezza
    /// della sorgente: ingrandire produce file più grandi <i>e</i> più sfocati dell'originale.
    /// </summary>
    public static readonly int[] LarghezzeVarianti = [400, 800, 1200, 1600];

    /// <summary>MIME ammessi, verificati sul contenuto reale del file e non sull'estensione.</summary>
    public static readonly string[] MimeAmmessi = ["image/jpeg", "image/png", "image/webp"];

    /// <summary>Qualità di compressione WebP delle varianti.</summary>
    public const int QualitaWebp = 80;

    /// <summary>Qualità di compressione JPEG delle varianti.</summary>
    public const int QualitaJpeg = 82;

    /// <summary>Larghezza massima del placeholder LQIP: viaggia dentro ogni risposta.</summary>
    public const int LarghezzaPlaceholderPx = 20;

    /// <summary>Qualità del placeholder LQIP: bassissima di proposito, deve restare sotto i 2 KB.</summary>
    public const int QualitaPlaceholder = 40;

    /// <summary>
    /// Decodifiche concorrenti ammesse. Insieme al tetto sull'allocatore è il doppio freno
    /// alla memoria: il semaforo limita <i>quanti</i> file insieme, l'allocatore
    /// <i>quanto</i> può costare uno solo. Nessuno dei due sostituisce l'altro.
    /// </summary>
    public const int DecodificheConcorrenti = 2;

    /// <summary>Attesa massima al semaforo prima di rispondere 503 "riprova fra qualche secondo".</summary>
    public static readonly TimeSpan TimeoutSemaforo = TimeSpan.FromSeconds(30);
}
