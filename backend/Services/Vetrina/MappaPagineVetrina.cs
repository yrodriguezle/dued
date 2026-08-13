namespace duedgusto.Services.Vetrina;

/// <summary>
/// Dove un testo compare sul sito: una delle cinque pagine, oppure la <b>cornice</b> condivisa.
///
/// <para>🔴 <see cref="Cornice"/> non è una pagina e non è un ripiego: è ciò che
/// <c>Base.astro</c> e i suoi componenti — intestazione, piè di pagina, barra mobile, dati
/// strutturati — rendono su <b>tutte</b> le pagine. Senza questo valore la mappa avrebbe due
/// forme entrambe sbagliate: ripetere sedici voci su cinque pagine (e far dire alla scheda
/// «Menu» che quella pagina possiede l'indirizzo), oppure tacerle del tutto (e far dire alla
/// stessa scheda che <c>/menu</c> mostra solo l'insegna, mentre il piè di pagina mostra
/// indirizzo e orari). La distinzione fra <i>«lo mostra il corpo di questa pagina»</i> e
/// <i>«lo mostra la cornice di ogni pagina»</i> è un'informazione che l'amministratore usa.</para>
/// </summary>
public enum PaginaVetrina
{
    /// <summary>Intestazione, piè di pagina e dati strutturati: su ogni pagina del sito.</summary>
    Cornice,
    Home,
    Menu,
    Aperitivo,
    Locale,
    Contatti,
}

/// <summary>
/// Dove si <b>modifica</b> un testo, cioè chi lo possiede.
///
/// <para>⚠️ Non tutte le sedi sono schede del sito: gli orari vivono nelle impostazioni della
/// <b>cassa</b> e le citazioni dei clienti nell'anagrafica delle recensioni. Tacere quelle due
/// renderebbe la mappa incompleta proprio sui due valori che l'amministratore cerca più spesso
/// e che non trova in nessuna scheda di pagina.</para>
/// </summary>
public enum SchedaVetrina
{
    /// <summary>«Impostazioni sito»: identità, indirizzo, contatti, social, SEO di default.</summary>
    Impostazioni,
    Home,
    Locale,
    Aperitivo,

    /// <summary>Le impostazioni operative della cassa: gli orari hanno UNA sola sorgente.</summary>
    ImpostazioniCassa,

    /// <summary>L'anagrafica delle recensioni riportate sul sito.</summary>
    RecensioniSito,
}

/// <summary>
/// Una riga della mappa: <b>dove compare</b> un valore, <b>quale campo</b> lo porta,
/// <b>quale percorso</b> del DTO pubblico lo trasporta e <b>dove si modifica</b>.
/// </summary>
/// <param name="Pagina">La pagina che lo mostra, o <see cref="PaginaVetrina.Cornice"/>.</param>
/// <param name="Campo">
/// Il campo del modello. Per i valori della vetrina è il nome <b>esatto</b> di una proprietà di
/// <c>ImpostazioniVetrina</c>, e un test lo verifica per riflessione: un nome storpiato qui non
/// darebbe alcun errore, farebbe soltanto sparire il valore dalla scheda.
/// </param>
/// <param name="Percorso">
/// Il percorso dentro il DTO di <c>/api/public/site</c> — <c>testi.storia.testo</c> — cioè
/// <b>esattamente ciò che i sorgenti del sito scrivono</b>. È il campo che rende la verifica
/// meccanica possibile: i <c>.astro</c> non nominano mai <c>StoriaTesto</c>.
/// </param>
/// <param name="Scheda">Dove si modifica.</param>
/// <param name="Etichetta">Come si chiama in pagina, per chi legge la scheda.</param>
/// <param name="Nota">Cosa c'è da sapere, quando c'è. <c>null</c> quando l'etichetta basta.</param>
public sealed record VoceMappaPagina(
    PaginaVetrina Pagina,
    string Campo,
    string Percorso,
    SchedaVetrina Scheda,
    string Etichetta,
    string? Nota);

/// <summary>
/// Quali testi governano quale pagina del sito. 🔴 <b>Sede UNICA della corrispondenza</b>: la
/// leggono le cinque schede del pannello (via <c>vetrina { mappaPagine }</c>) e la verifica
/// <c>sito/test/mappa-pagine.test.mjs</c> contro i sorgenti del sito.
///
/// <para>🔴 <b>PERCHÉ ESISTE, e perché senza la sua verifica sarebbe peggio di niente.</b>
/// Renderla esplicita crea una <b>seconda scrittura</b> — la prima sono i <c>.astro</c> — e due
/// scritture divergono: qualcuno aggiunge un campo a <c>locale.astro</c>, la scheda «Il locale»
/// non lo impara mai, e l'amministratore ha una mappa che <b>mente con sicurezza</b>. Per uno
/// strumento di orientamento è il modo peggiore di sbagliare: non lascia sospettare nulla.</para>
///
/// <para>🔴 <b>LA FORMA TESTUALE DI QUESTO ELENCO È VINCOLANTE.</b>
/// <c>sito/test/mappa-pagine.test.mjs</c> legge questo file <b>con una regex</b>, e pretende
/// <b>una voce per riga</b> nella forma
/// <c>new(PaginaVetrina.X, "Campo", "percorso", SchedaVetrina.Y, …)</c>. Spezzare una voce su due
/// righe, o cambiarne l'ordine dei primi quattro argomenti, renderebbe quel test <b>cieco invece
/// che rosso</b> — cioè verde e rassicurante mentre non verifica più nulla. È la modalità di
/// guasto peggiore di un test di scansione, e la difesa è dichiarata: il test asserisce anche il
/// <b>numero</b> di voci trovate, quindi una regex che ne perde anche una sola fa scattare il
/// conteggio prima di ogni altra asserzione.</para>
///
/// <para>⚠️ <b>Il terzo campo è la prima documentazione della mappatura modello → DTO</b>, che
/// fino a qui esisteva solo dentro <c>PublicController.TestiDa</c> e dentro la costruzione di
/// <c>SitoPubblicoDto</c>. Serve perché i sorgenti del sito leggono <c>sito.testi.storia.testo</c>
/// e non conoscono alcun <c>StoriaTesto</c>: senza la traduzione, il confronto meccanico fra le
/// due dichiarazioni non sarebbe scrivibile.</para>
///
/// <para>⚠️ <b>Cosa questa mappa NON dichiara, e perché.</b> I quattro ganci spenti
/// (<c>TurnstileSiteKey</c> e i tre delle prenotazioni) non compaiono: nessuna pagina li rende,
/// e una voce «letta da nessuno» invecchierebbe senza che nulla la contraddica. Non compaiono
/// nemmeno i <b>tre slot immagine</b>: le immagini hanno una dichiarazione propria — il piano di
/// <see cref="RuoliImmaginiVetrina"/> — e ripeterle qui sarebbe la seconda scrittura che questo
/// file esiste per togliere.</para>
/// </summary>
public static class MappaPagineVetrina
{
    /// <summary>
    /// Le voci, nell'ordine in cui la scheda le mostra. 🔴 Una per riga: vedi la nota sulla forma.
    /// </summary>
    private static readonly VoceMappaPagina[] Elenco =
    [
        // ── La cornice: ciò che OGNI pagina del sito rende, dentro Base.astro e i suoi componenti ──
        // Sono i valori trasversali di «Impostazioni sito», più gli orari, che vivono nella cassa.
        new(PaginaVetrina.Cornice, "InsegnaPubblica", "insegna", SchedaVetrina.Impostazioni, "Insegna pubblica", "Il nome del locale: intestazione, piè di pagina e dati strutturati di ogni pagina."),
        new(PaginaVetrina.Cornice, "Via", "indirizzo.via", SchedaVetrina.Impostazioni, "Via", "Il piè di pagina e i dati strutturati la mostrano su ogni pagina."),
        new(PaginaVetrina.Cornice, "Cap", "indirizzo.cap", SchedaVetrina.Impostazioni, "CAP", null),
        new(PaginaVetrina.Cornice, "Citta", "indirizzo.citta", SchedaVetrina.Impostazioni, "Città", null),
        new(PaginaVetrina.Cornice, "Provincia", "indirizzo.provincia", SchedaVetrina.Impostazioni, "Provincia", null),
        new(PaginaVetrina.Cornice, "Paese", "indirizzo.paese", SchedaVetrina.Impostazioni, "Paese", "Non è scritto in pagina: lo leggono i soli dati strutturati."),
        new(PaginaVetrina.Cornice, "Latitudine", "geo.latitudine", SchedaVetrina.Impostazioni, "Latitudine", "Serve alle due mappe (Home e Contatti) e ai dati strutturati di ogni pagina. Senza entrambe le coordinate la mappa non si mostra."),
        new(PaginaVetrina.Cornice, "Longitudine", "geo.longitudine", SchedaVetrina.Impostazioni, "Longitudine", "Va valorizzata insieme alla latitudine, o nessuna delle due."),
        new(PaginaVetrina.Cornice, "Telefono", "contatti.telefono", SchedaVetrina.Impostazioni, "Telefono", "È il pulsante «chiama» dell'intestazione e della barra mobile, su ogni pagina."),
        new(PaginaVetrina.Cornice, "Email", "contatti.email", SchedaVetrina.Impostazioni, "Email", null),
        new(PaginaVetrina.Cornice, "UrlInstagram", "social.instagram", SchedaVetrina.Impostazioni, "Instagram", "Nel piè di pagina di ogni pagina."),
        new(PaginaVetrina.Cornice, "UrlFacebook", "social.facebook", SchedaVetrina.Impostazioni, "Facebook", "Nel piè di pagina di ogni pagina."),
        new(PaginaVetrina.Cornice, "MetaTitoloDefault", "seo.titoloDefault", SchedaVetrina.Impostazioni, "Titolo per i motori di ricerca", "Il valore predefinito del sito: nessuna pagina ne possiede uno proprio."),
        new(PaginaVetrina.Cornice, "MetaDescrizioneDefault", "seo.descrizioneDefault", SchedaVetrina.Impostazioni, "Descrizione per i motori di ricerca", "Vale per tutte le pagine tranne «Menu», che ha la propria scritta nel sorgente del sito."),
        new(PaginaVetrina.Cornice, "ImmagineOgId", "seo.immagineOg", SchedaVetrina.Impostazioni, "Immagine di anteprima social", "Condivisa da tutte le pagine: non conta fra i posti immagine di nessuna."),
        new(PaginaVetrina.Cornice, "OraInizioTemaSera", "oraInizioTemaSera", SchedaVetrina.Impostazioni, "Ora di inizio del tema serale", "Da quell'ora il sito passa al tema scuro."),
        new(PaginaVetrina.Cornice, "OpeningTime", "orari.apertura", SchedaVetrina.ImpostazioniCassa, "Orario di apertura", "Gli orari hanno una sola sorgente, e non è il sito: sono quelli della cassa."),
        new(PaginaVetrina.Cornice, "ClosingTime", "orari.chiusura", SchedaVetrina.ImpostazioniCassa, "Orario di chiusura", null),
        new(PaginaVetrina.Cornice, "OperatingDays", "orari.giorniOperativi", SchedaVetrina.ImpostazioniCassa, "Giorni di apertura", null),
        new(PaginaVetrina.Cornice, "GiorniNonLavorativi", "chiusure", SchedaVetrina.ImpostazioniCassa, "Ferie e chiusure straordinarie", "L'avviso in cima al sito compare da solo quando una chiusura si avvicina. Come gli orari, vivono nel calendario della cassa e non nel sito."),

        // ── La home ──────────────────────────────────────────────────────────────────────────
        new(PaginaVetrina.Home, "InsegnaPubblica", "insegna", SchedaVetrina.Impostazioni, "Insegna pubblica", "La home la scrive anche nel proprio titolo."),
        new(PaginaVetrina.Home, "ClaimVetrina", "testi.claim", SchedaVetrina.Home, "Frase sotto il titolo", "Vuota: la home mostra solo il titolo. È anche la descrizione della home per i motori di ricerca."),
        new(PaginaVetrina.Home, "PunteggioGoogle", "reputazione.punteggio", SchedaVetrina.Home, "Punteggio Google", "Da 1 a 5, insieme al numero di recensioni o nessuno dei due."),
        new(PaginaVetrina.Home, "NumeroRecensioniGoogle", "reputazione.numero", SchedaVetrina.Home, "Numero di recensioni", null),
        new(PaginaVetrina.Home, "UrlProfiloGoogle", "reputazione.urlProfilo", SchedaVetrina.Home, "Profilo Google", null),
        new(PaginaVetrina.Home, "AperitivoTitolo", "testi.aperitivo.titolo", SchedaVetrina.Aperitivo, "Titolo dell'aperitivo", "La home lo mostra nel richiamo all'aperitivo, ma appartiene alla scheda dell'aperitivo."),
        new(PaginaVetrina.Home, "AperitivoTesto", "testi.aperitivo.testo", SchedaVetrina.Aperitivo, "Testo dell'aperitivo", "È anche il testo che decide se la pagina «Aperitivo» esiste."),
        new(PaginaVetrina.Home, "AperitivoPunti", "testi.aperitivo.punti", SchedaVetrina.Aperitivo, "Cosa è compreso nell'aperitivo", null),
        new(PaginaVetrina.Home, "AperitivoCategorie", "testi.aperitivo.categorie", SchedaVetrina.Aperitivo, "Categorie di vetrina mostrate nell'aperitivo", null),
        new(PaginaVetrina.Home, "Via", "indirizzo.via", SchedaVetrina.Impostazioni, "Via", "La home scrive l'indirizzo accanto alla mappa."),
        new(PaginaVetrina.Home, "Cap", "indirizzo.cap", SchedaVetrina.Impostazioni, "CAP", null),
        new(PaginaVetrina.Home, "Citta", "indirizzo.citta", SchedaVetrina.Impostazioni, "Città", null),
        new(PaginaVetrina.Home, "Provincia", "indirizzo.provincia", SchedaVetrina.Impostazioni, "Provincia", null),
        new(PaginaVetrina.Home, "OraInizioTemaSera", "oraInizioTemaSera", SchedaVetrina.Impostazioni, "Ora di inizio del tema serale", "La home la mostra anche nel richiamo all'aperitivo."),
        new(PaginaVetrina.Home, "OpeningTime", "orari.apertura", SchedaVetrina.ImpostazioniCassa, "Orario di apertura", "La home mostra gli orari della settimana per esteso."),
        new(PaginaVetrina.Home, "ClosingTime", "orari.chiusura", SchedaVetrina.ImpostazioniCassa, "Orario di chiusura", null),
        new(PaginaVetrina.Home, "OperatingDays", "orari.giorniOperativi", SchedaVetrina.ImpostazioniCassa, "Giorni di apertura", null),
        new(PaginaVetrina.Home, "RecensioniVetrina", "recensioni", SchedaVetrina.RecensioniSito, "Citazioni dei clienti", "Solo quelle pubblicate, nell'ordine scelto: si aggiungono e si riordinano da «Recensioni sito»."),

        // ── Menu ─────────────────────────────────────────────────────────────────────────────
        // 🔴 UNA sola voce, ed è il punto della scheda: questa pagina non possiede alcun testo.
        //    La descrizione per i motori di ricerca è scritta NEL SORGENTE del sito e non ha
        //    alcun campo: la scheda lo dichiara invece di fingere un campo che non esiste.
        new(PaginaVetrina.Menu, "InsegnaPubblica", "insegna", SchedaVetrina.Impostazioni, "Insegna pubblica", "È l'unico valore del sito che il corpo di questa pagina legge."),

        // ── Aperitivo ────────────────────────────────────────────────────────────────────────
        new(PaginaVetrina.Aperitivo, "InsegnaPubblica", "insegna", SchedaVetrina.Impostazioni, "Insegna pubblica", null),
        new(PaginaVetrina.Aperitivo, "AperitivoTitolo", "testi.aperitivo.titolo", SchedaVetrina.Aperitivo, "Titolo dell'aperitivo", "Da solo NON fa esistere la pagina: è il testo a farlo."),
        new(PaginaVetrina.Aperitivo, "AperitivoTesto", "testi.aperitivo.testo", SchedaVetrina.Aperitivo, "Testo dell'aperitivo", "Svuotandolo, /aperitivo risponde 404 e sparisce dalla navigazione del sito."),
        new(PaginaVetrina.Aperitivo, "AperitivoPunti", "testi.aperitivo.punti", SchedaVetrina.Aperitivo, "Cosa è compreso nell'aperitivo", "Una voce per riga. Ne vengono pubblicate al massimo sei."),
        new(PaginaVetrina.Aperitivo, "AperitivoCategorie", "testi.aperitivo.categorie", SchedaVetrina.Aperitivo, "Categorie di vetrina mostrate nell'aperitivo", "Una per riga, col nome esatto della categoria: il sito non indovina per somiglianza."),
        new(PaginaVetrina.Aperitivo, "OraInizioTemaSera", "oraInizioTemaSera", SchedaVetrina.Impostazioni, "Ora di inizio del tema serale", "Da quell'ora questa pagina passa al tema scuro."),

        // ── Il locale ────────────────────────────────────────────────────────────────────────
        new(PaginaVetrina.Locale, "InsegnaPubblica", "insegna", SchedaVetrina.Impostazioni, "Insegna pubblica", null),
        new(PaginaVetrina.Locale, "StoriaTitolo", "testi.storia.titolo", SchedaVetrina.Locale, "Titolo della storia", "Da solo NON fa esistere la pagina: è il testo a farlo."),
        new(PaginaVetrina.Locale, "StoriaTesto", "testi.storia.testo", SchedaVetrina.Locale, "Storia del locale", "Svuotandolo, /locale risponde 404 e sparisce dalla navigazione del sito."),

        // ── Contatti ─────────────────────────────────────────────────────────────────────────
        // Nessun testo di proprietà: è una mappa di ciò che la governa altrove.
        new(PaginaVetrina.Contatti, "InsegnaPubblica", "insegna", SchedaVetrina.Impostazioni, "Insegna pubblica", null),
        new(PaginaVetrina.Contatti, "Via", "indirizzo.via", SchedaVetrina.Impostazioni, "Via", "L'indirizzo è il contenuto principale di questa pagina."),
        new(PaginaVetrina.Contatti, "Cap", "indirizzo.cap", SchedaVetrina.Impostazioni, "CAP", null),
        new(PaginaVetrina.Contatti, "Citta", "indirizzo.citta", SchedaVetrina.Impostazioni, "Città", null),
        new(PaginaVetrina.Contatti, "Provincia", "indirizzo.provincia", SchedaVetrina.Impostazioni, "Provincia", null),
        new(PaginaVetrina.Contatti, "Telefono", "contatti.telefono", SchedaVetrina.Impostazioni, "Telefono", null),
        new(PaginaVetrina.Contatti, "Email", "contatti.email", SchedaVetrina.Impostazioni, "Email", null),
        new(PaginaVetrina.Contatti, "UrlInstagram", "social.instagram", SchedaVetrina.Impostazioni, "Instagram", null),
        new(PaginaVetrina.Contatti, "UrlFacebook", "social.facebook", SchedaVetrina.Impostazioni, "Facebook", null),
        new(PaginaVetrina.Contatti, "OpeningTime", "orari.apertura", SchedaVetrina.ImpostazioniCassa, "Orario di apertura", "La pagina mostra gli orari della settimana per esteso."),
        new(PaginaVetrina.Contatti, "ClosingTime", "orari.chiusura", SchedaVetrina.ImpostazioniCassa, "Orario di chiusura", null),
        new(PaginaVetrina.Contatti, "OperatingDays", "orari.giorniOperativi", SchedaVetrina.ImpostazioniCassa, "Giorni di apertura", null),
    ];

    /// <summary>La mappa per intero, nell'ordine dichiarato.</summary>
    public static IReadOnlyList<VoceMappaPagina> Voci => Elenco;

    /// <summary>
    /// Le voci di una pagina, cornice esclusa. La cornice si chiede a parte, perché la scheda la
    /// presenta come un gruppo distinto: <i>«questo lo mostra ogni pagina del sito»</i> non è la
    /// stessa informazione di <i>«questo lo mostra questa pagina»</i>.
    /// </summary>
    public static IReadOnlyList<VoceMappaPagina> Della(PaginaVetrina pagina) =>
        Elenco.Where(voce => voce.Pagina == pagina).ToList();
}
