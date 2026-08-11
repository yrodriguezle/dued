namespace duedgusto.Models;

/// <summary>
/// Metadati di un'immagine della vetrina. I binari vivono sul filesystem sotto la radice
/// dei media: nel database non entra mai il contenuto dell'immagine, con l'unica eccezione
/// del placeholder LQIP, che è testo base64 largo 20 px e non un binario.
/// </summary>
public class MediaAsset
{
    public int MediaAssetId { get; set; }

    /// <summary>
    /// Cartella di storage relativa alla radice dei media, es. "2026/08/caffe-a1b2c3".
    /// NON contiene il prefisso "/media" né l'host: quelli sono dettagli di *serving*, non dati.
    /// Tenerli fuori significa che spostare i file su un CDN costa una costante e non
    /// l'aggiornamento di ogni riga della tabella, e che un dump di produzione ripristinato
    /// in locale non punta all'IP del VPS. Univoca a livello di database (indice UNIQUE).
    /// </summary>
    public string Chiave { get; set; } = string.Empty;

    public string NomeOriginale { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty; // MIME del file sorgente

    /// <summary>
    /// Dimensioni della sorgente DOPO l'applicazione dell'orientamento EXIF: sono quelle che
    /// il browser vedrà davvero, quindi quelle che rendono corretti gli attributi width/height
    /// e azzerano il layout shift. Salvare le dimensioni pre-rotazione darebbe una foto
    /// verticale dichiarata orizzontale, senza alcun errore visibile lato server.
    /// </summary>
    public int Larghezza { get; set; }
    public int Altezza { get; set; }

    /// <summary>
    /// Larghezze effettivamente generate su disco, in CSV ("400,800,1200,1600").
    /// Persistito e non dedotto da <see cref="Larghezza"/>: una sorgente da 900 px produce
    /// solo [400, 800], e un srcset costruito riapplicando la regola di generazione
    /// emetterebbe due URL che rispondono 404 — una rottura che degrada in modo silenzioso
    /// e diverso da browser a browser. Il consumatore legge un dato, non un'assunzione.
    /// </summary>
    public string LarghezzeDisponibili { get; set; } = string.Empty;

    public string? TestoAlternativo { get; set; }
    public string? Didascalia { get; set; }

    /// <summary>
    /// Punto focale nella forma già utilizzabile dal client per object-position, es. "50% 40%"
    /// (orizzontale, poi verticale). È deliberatamente la forma di destinazione e non una
    /// coppia di numeri da ricomporre: nessun consumatore deve formattare o ricordare
    /// l'ordine delle coordinate, quindi non esiste un punto in cui la conversione diverga.
    /// null significa "centro": l'assenza di scelta editoriale non persiste un default.
    /// </summary>
    public string? Focale { get; set; }

    /// <summary>
    /// LQIP base64 (immagine larga al massimo 20 px). Viaggia dentro ogni risposta che
    /// include l'asset, quindi resta sotto i 2 KB: è ciò che permette al client di mostrare
    /// qualcosa senza una seconda richiesta HTTP e senza salto di layout.
    /// </summary>
    public string? Placeholder { get; set; }

    /// <summary>
    /// Etichetta editoriale di raggruppamento nella libreria. NON influenza il percorso dei
    /// file su disco: rinominarla non invalida alcuna URL già emessa.
    /// </summary>
    public string Cartella { get; set; } = "generale";

    public int Ordinamento { get; set; }
    public bool Pubblicato { get; set; } = true;
    public long ByteTotali { get; set; }

    // Metadati
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    // Dichiarata insieme ai campi vetrina di Prodotto, non prima: da sola questa collezione
    // basta a far scoprire a EF la relazione uno-a-molti e a far nascere una FK verso Prodotti
    // dentro la migrazione della sola tabella dei media. Le due migrazioni devono restare
    // revertibili l'una senza l'altra — AddMediaAsset serve anche alle fasi che con il
    // listino non c'entrano nulla.
    public ICollection<Prodotto> Prodotti { get; set; } = new List<Prodotto>();

}
