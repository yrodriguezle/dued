namespace duedgusto.Controllers.Public.Dto;

/// <summary>
/// L'identità del locale come la legge un visitatore.
///
/// <para>🔴 <b>È il punto di composizione fra due entità, ed è qui che un campo di troppo
/// salirebbe a bordo senza che nessuno lo scriva.</b> Identità, indirizzo, coordinate, contatti,
/// social, meta di default e ora del tema serale arrivano da <c>ImpostazioniVetrina</c>; orari,
/// giorni operativi e fuso arrivano da <c>BusinessSettings</c>, che porta con sé aliquota IVA,
/// importi del giornale, identificativo e marche temporali. Nessuno di quei campi ha una
/// property qui dentro: non vengono omessi in serializzazione, <b>non esistono</b>.</para>
///
/// <para>⚠️ Gli orari hanno <b>una sola sorgente</b> e questa non è la vetrina: è ciò che rende
/// impossibile per costruzione la classe di bug «il sito dice aperto fino alle 21, la cassa alle
/// 19». Per la stessa ragione <c>ImpostazioniVetrina</c> non possiede alcun campo di orario.</para>
///
/// <para>Non compaiono nemmeno i <b>ganci spenti</b> delle fasi successive
/// (<c>TurnstileSiteKey</c>, i tre campi delle prenotazioni): esistono a database perché la
/// migrazione è una sola, ma non fanno parte del contratto pubblico di questa fase.</para>
/// </summary>
public record SitoPubblicoDto(
    string Insegna,
    IndirizzoPubblicoDto Indirizzo,
    GeoPubblicaDto? Geo,
    ContattiPubbliciDto Contatti,
    SocialPubbliciDto Social,
    OrariPubbliciDto Orari,
    SeoPubblicaDto Seo,
    string OraInizioTemaSera);

/// <summary>
/// L'indirizzo <b>scomposto</b>, perché lo pretende <c>schema.org/PostalAddress</c>: un campo
/// unico costringerebbe il consumatore a spezzarlo con una regex per generare i dati strutturati,
/// e la SEO locale è una delle ragioni per cui il sito esiste.
/// </summary>
public record IndirizzoPubblicoDto(
    string Via,
    string Cap,
    string Citta,
    string Provincia,
    string Paese);

/// <summary>
/// Le coordinate della sede. 🔴 L'oggetto <b>intero</b> è <c>null</c> quando non sono impostate:
/// mai una coppia di zeri, che sarebbe una mappa capace di indicare con sicurezza il posto
/// sbagliato — un punto nel Golfo di Guinea. Le due coordinate si valorizzano insieme o nessuna
/// delle due, ed è il resolver di amministrazione a garantirlo.
/// </summary>
public record GeoPubblicaDto(decimal Latitudine, decimal Longitudine);

public record ContattiPubbliciDto(string? Telefono, string? Email);

/// <summary>
/// URL <b>completi</b> dei profili, non gli identificativi utente: nessun consumatore deve sapere
/// come si costruisce un indirizzo Instagram, e il <c>sameAs</c> dei dati strutturati è una copia
/// diretta invece di una ricomposizione.
/// </summary>
public record SocialPubbliciDto(string? Instagram, string? Facebook);

/// <summary>
/// Gli orari, dalla loro unica sorgente — le impostazioni operative che cassa e chiusure mensili
/// leggono e scrivono.
///
/// <para>⚠️ <see cref="GiorniOperativi"/> è <b>nullable</b>: il valore persistito è un JSON in
/// stringa e può non essere leggibile come sequenza di sette booleani. In quel caso il campo vale
/// <c>null</c> e il server registra un avviso — <b>omettere gli orari settimanali è meglio che
/// dichiararne di sbagliati</b>. Il consumatore che genera i dati strutturati deve omettere la
/// sezione degli orari quando il campo è nullo, cosa che va detta adesso perché lì sembrerà un
/// campo sempre presente.</para>
/// </summary>
public record OrariPubbliciDto(
    string Apertura,
    string Chiusura,
    IReadOnlyList<bool>? GiorniOperativi,
    string Timezone);

/// <summary>I meta di default del sito, con l'immagine di anteprima social (Open Graph).</summary>
public record SeoPubblicaDto(
    string? TitoloDefault,
    string? DescrizioneDefault,
    ImmaginePubblicaDto? ImmagineOg);
