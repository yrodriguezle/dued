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
/// <para>🔴 <b>E per la stessa ragione esiste <see cref="Chiusure"/>.</b> L'orario settimanale da
/// solo non è l'orario del locale: nel gestionale le eccezioni — ferie, festività, chiusure
/// straordinarie — vivono in <c>GiorniNonLavorativi</c>, e finché non erano in questo contratto il
/// sito non aveva modo di saperle. Il guasto non era transitorio e non lasciava traccia: il 13
/// agosto 2026, con il bar in ferie dal 10 al 22 registrate in cassa, la vetrina scriveva «Giovedì
/// 07:00 — 20:00» e accendeva «Aperto», senza un avviso in pagina né una riga nei log.</para>
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
    IReadOnlyList<ChiusuraPubblicaDto> Chiusure,
    SeoPubblicaDto Seo,
    string OraInizioTemaSera,
    TestiPubbliciDto Testi,
    ReputazionePubblicaDto? Reputazione,
    IReadOnlyList<RecensionePubblicaDto> Recensioni);

/// <summary>
/// I testi che il sito scrive in prima persona sul locale.
///
/// <para>🔴 <b>Ogni campo è nullable, e il consumatore che riceve <c>null</c> non rende la sezione
/// — non la riempie con un ripiego.</b> È la sola forma che tiene l'informazione onesta: una frase
/// sul locale scritta dentro un componente del sito è una verità che invecchia lontano da chi la
/// conosce, e il giorno in cui smette di essere vera chi lo sa non ha modo di dirlo.</para>
/// </summary>
public record TestiPubbliciDto(
    string? Claim,
    StoriaPubblicaDto? Storia,
    AperitivoPubblicoDto? Aperitivo);

/// <summary>La storia del locale. Esiste solo se c'è il testo: un titolo da solo non è una storia.</summary>
public record StoriaPubblicaDto(string? Titolo, string Testo);

/// <param name="Punti">
/// Cosa è compreso, già <b>normalizzato</b>: righe vuote e spazi tolti, ordine conservato.
///
/// <para>⚠️ La sorgente è un campo di testo con una voce per riga — una scelta deliberata contro
/// un'entità da quattro righe — e il prezzo di quella scelta è che <b>la difesa sta qui</b>. Il
/// consumatore riceve una lista pulita e non deve sapere che dall'altra parte c'era una stringa.</para>
/// </param>
/// <param name="Categorie">
/// I nomi delle categorie di vetrina che la pagina dell'aperitivo mostra, nell'ordine scelto
/// dall'amministratore.
///
/// <para>🔴 Sono <b>dichiarati</b> e non dedotti. Cercare la parola «cocktail» nel nome di una
/// categoria smette di funzionare il giorno in cui si chiama «Drink»; prendere «le ultime due»
/// smette il giorno in cui se ne aggiunge una. Nessuna delle due deduzioni lascerebbe traccia: la
/// pagina mostrerebbe le cose sbagliate, e nessuno collegherebbe la cosa a una rinomina.</para>
///
/// <para>⚠️ Un nome che non corrisponde ad alcuna categoria <b>non è un errore</b>: semplicemente
/// non porta prodotti. È testo libero da entrambe le parti, e irrigidirlo vorrebbe dire un'entità
/// categoria che oggi non esiste.</para>
/// </param>
public record AperitivoPubblicoDto(
    string? Titolo,
    string Testo,
    IReadOnlyList<string> Punti,
    IReadOnlyList<string> Categorie);

/// <summary>
/// Il giudizio medio, quando c'è.
///
/// <para>🔴 L'oggetto <b>intero</b> è <c>null</c> se manca uno dei due numeri, per la stessa
/// ragione per cui <c>Geo</c> lo è quando manca una coordinata: presi da soli non sono un dato
/// incompleto, sono un dato <b>fuorviante</b>. «4,7» senza conteggio nasconde che le recensioni
/// potrebbero essere tre; «180 recensioni» senza media nasconde che la media potrebbe essere 2,1.</para>
/// </summary>
public record ReputazionePubblicaDto(decimal Punteggio, int Numero, string? UrlProfilo);

/// <summary>
/// Una recensione <b>riportata</b>: una citazione scelta dall'amministratore da ciò che un cliente
/// ha scritto altrove. Il sito non raccoglie giudizi e non esiste alcuna rotta che scriva qui.
/// </summary>
public record RecensionePubblicaDto(int Id, string Autore, string Testo, string? Fonte, int Punteggio);

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

/// <summary>
/// Un giorno in cui il locale è chiuso <b>nonostante</b> l'orario settimanale: ferie, festività,
/// chiusura straordinaria.
///
/// <para>🔴 <b>Una voce per DATA, non per riga di database.</b> A database una chiusura è una riga
/// che può essere ricorrente — «25 dicembre, ogni anno» — e quindi non è una data finché qualcuno
/// non la proietta su un calendario. La proiezione la fa il server, una volta, con la stessa
/// regola che usa la chiusura mensile (<c>ChiusureProgrammate</c>): il consumatore riceve date
/// vere e non deve conoscere il concetto di ricorrenza. È anche ciò che permette allo script del
/// sito di rispondere «sono chiuso oggi?» con un confronto di stringhe.</para>
///
/// <para>⚠️ <see cref="Data"/> è <c>yyyy-MM-dd</c> nel fuso del <b>locale</b>, non in UTC: il
/// container gira a UTC salvo che qualcuno imposti <c>TZ</c>, e una chiusura calcolata lì
/// cambierebbe due ore prima di mezzanotte in estate. Il fuso vero è
/// <c>BusinessSettings.Timezone</c>, lo stesso che questa risposta espone in
/// <see cref="OrariPubbliciDto.Timezone"/>.</para>
///
/// <para>⚠️ <see cref="Motivo"/> è il codice grezzo (<c>FERIE</c>, <c>FESTIVITA_NAZIONALE</c>,
/// <c>CHIUSURA_STRAORDINARIA</c>) e <b>non</b> un'etichetta da mostrare: la parola che il
/// visitatore legge è <see cref="Descrizione"/>, che l'amministratore scrive. Un'etichetta decisa
/// qui sarebbe testo del sito nascosto in un DTO.</para>
/// </summary>
public record ChiusuraPubblicaDto(
    string Data,
    string Descrizione,
    string Motivo);

/// <summary>I meta di default del sito, con l'immagine di anteprima social (Open Graph).</summary>
public record SeoPubblicaDto(
    string? TitoloDefault,
    string? DescrizioneDefault,
    ImmaginePubblicaDto? ImmagineOg);
