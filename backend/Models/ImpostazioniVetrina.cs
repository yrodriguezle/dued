namespace duedgusto.Models;

/// <summary>
/// I dati del locale che il <b>cliente</b> legge: insegna, indirizzo, posizione, contatti,
/// social, meta di default, immagine di anteprima social, ora di inizio del tema serale.
///
/// <para><b>Perché non stanno in <see cref="BusinessSettings"/>.</b> Quell'entità ha undici
/// campi, tutti <i>operativi</i> — orari, giorni, fuso, valuta, aliquota IVA, importi del
/// giornale — letti e scritti da cassa e chiusure mensili. Aggiungerci venti campi di
/// marketing significherebbe toccare un'entità critica a ogni modifica del sito, e mettere il
/// rischio di un errore di cassa sul percorso di "cambio il link Instagram".</para>
///
/// <para>🔴 <b>Ma due entità non devono diventare due verità</b>: qui dentro non c'è alcun
/// campo di orario, giorno operativo o fuso. Quelli restano in <see cref="BusinessSettings"/>,
/// con una sola sorgente, e la rotta pubblica dell'identità <b>compone</b> le due.</para>
/// </summary>
public class ImpostazioniVetrina
{
    /// <summary>
    /// L'identificativo della riga. Non è un contatore: è un valore di dominio che significa
    /// "la riga". Vedi la configurazione in <c>AppDbContext.OnModelCreating</c>, dove
    /// <c>ValueGeneratedNever()</c> e un <c>CHECK</c> a database rendono impossibile la seconda.
    /// </summary>
    public const int IdSingleton = 1;

    public int ImpostazioniVetrinaId { get; set; } = IdSingleton;

    // ── Identità pubblica ────────────────────────────────────────────────────────────────
    /// <summary>
    /// L'insegna che legge il cliente ("2D Gusto Bar"). Deliberatamente <b>distinta</b> da
    /// <c>BusinessSettings.BusinessName</c>, che resta il nome del gestionale ("DuedGusto") e
    /// compare nell'intestazione dell'applicazione di cassa: sono due nomi con due pubblici, e
    /// unirli costringerebbe a scegliere quale dei due mostrare nel posto sbagliato.
    /// </summary>
    public string InsegnaPubblica { get; set; } = string.Empty;

    // ── Indirizzo, scomposto perché lo pretende schema.org/PostalAddress ──────────────────
    // streetAddress / postalCode / addressLocality / addressRegion / addressCountry.
    // Un unico campo "indirizzo" costringerebbe il JSON-LD del sito a spezzarlo con una regex,
    // e la SEO locale è una delle ragioni per cui il sito esiste.
    public string Via { get; set; } = string.Empty;
    public string Cap { get; set; } = string.Empty;
    public string Citta { get; set; } = string.Empty;

    /// <summary>Sigla della provincia, es. "VI".</summary>
    public string Provincia { get; set; } = string.Empty;

    /// <summary>Codice paese ISO 3166-1 alpha-2, es. "IT".</summary>
    public string Paese { get; set; } = "IT";

    /// <summary>
    /// Coordinate della sede. 🔴 Si valorizzano <b>insieme o nessuna delle due</b>: mezza
    /// coordinata è un punto sull'equatore, cioè un dato peggiore di un dato mancante — una
    /// mappa che indica con sicurezza il posto sbagliato.
    /// </summary>
    public decimal? Latitudine { get; set; }
    public decimal? Longitudine { get; set; }

    // ── Contatti e social ────────────────────────────────────────────────────────────────
    public string? Telefono { get; set; }
    public string? Email { get; set; }

    /// <summary>
    /// URL <b>completo</b> del profilo, non l'identificativo utente: si persiste
    /// <c>https://www.instagram.com/2dgusto/</c> e non <c>@2dgusto</c>, così che nessun
    /// consumatore debba sapere come si costruisce un indirizzo Instagram e i dati strutturati
    /// del sito siano una copia diretta invece di una ricomposizione.
    /// </summary>
    public string? UrlInstagram { get; set; }
    public string? UrlFacebook { get; set; }

    // ── SEO di default ───────────────────────────────────────────────────────────────────
    public string? MetaTitoloDefault { get; set; }
    public string? MetaDescrizioneDefault { get; set; }

    /// <summary>
    /// Immagine di anteprima social (Open Graph). 🔴 È il <b>secondo referente</b> dei media,
    /// dopo i prodotti: la relazione è dichiarata con politica restrittiva e senza navigazione
    /// inversa, e la procedura di eliminazione dei media deve verificarlo <b>prima</b> di
    /// toccare il disco.
    /// </summary>
    public int? ImmagineOgId { get; set; }
    public MediaAsset? ImmagineOg { get; set; }

    // ── Tema ─────────────────────────────────────────────────────────────────────────────
    /// <summary>
    /// Ora in cui il sito passa al tema serale, nella forma <c>"HH:mm"</c> — lo stesso formato
    /// degli orari operativi. È un <b>dato</b>, non un calcolo: il confronto con l'ora corrente
    /// resta lato client, dove l'orologio è quello del visitatore.
    /// </summary>
    public string OraInizioTemaSera { get; set; } = "18:00";

    // ── Ganci SPENTI delle fasi successive ───────────────────────────────────────────────
    // Nascono adesso perché la migrazione è una sola e additiva: aggiungerli dopo costerebbe
    // una seconda migrazione su una tabella già in produzione. In questa fase nessun codice li
    // legge, e nessuno di essi compare in alcuna risposta pubblica.
    public bool PrenotazioniAttive { get; set; }
    public int PrenotazioniPreavvisoOre { get; set; } = 2;
    public int PrenotazioniCopertiMax { get; set; } = 20;

    /// <summary>Chiave pubblica del servizio antispam del form di prenotazione.</summary>
    public string? TurnstileSiteKey { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
