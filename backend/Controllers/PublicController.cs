using System.Linq.Expressions;
using System.Text.Json;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using duedgusto.Common;
using duedgusto.Controllers.Public.Dto;
using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services.Media;
using duedgusto.Services.Vetrina;

namespace duedgusto.Controllers;

/// <summary>
/// L'unica superficie che risponde a un visitatore <b>senza alcuna credenziale</b>: tre GET in
/// sola lettura, e nient'altro.
///
/// <para>🔴 <b>Qui la difesa non è un controllo, è la forma della risposta.</b> Nel resto del
/// sistema si autentica, si verifica un ruolo e si nega; qui non c'è nulla da negare, quindi un
/// campo contabile non finisce fuori perché qualcuno si ricorda di filtrarlo, ma perché la query
/// non lo seleziona, il tipo di ritorno non lo possiede e un test lo scopre prima della CI.
/// Quattro strati che coprono guasti diversi: la proiezione protegge dal database, i DTO
/// <c>record</c> dal serializzatore, i test strutturali dal futuro,
/// <c>ActionResult&lt;TDto&gt;</c> dal compilatore — il quale rifiuta <c>return Ok(entità)</c>
/// prima ancora che lo faccia un test.</para>
///
/// <para><c>[AllowAnonymous]</c> è oggi ridondante: non esiste alcun filtro di autorizzazione
/// globale né alcuna <c>FallbackPolicy</c>. Si scrive comunque perché <b>dichiara
/// l'intenzione</b> — il fratello <see cref="MediaController"/> porta <c>[Authorize]</c> sulla
/// stessa riga, e il contrasto è l'informazione — e perché sopravvive al giorno in cui una
/// policy di fallback chiuderà il resto dell'applicazione.</para>
///
/// <para>⚠️ <b>Nessuna action accetta parametri.</b> Niente filtri liberi, niente paginazione,
/// niente limiti suggeriti dal chiamante: il costo di ogni risposta è <b>fisso e indipendente
/// dall'input</b>, ed è questa proprietà — non un contatore di richieste — la vera protezione di
/// una rotta anonima. Il <c>CancellationToken</c> non è un parametro di query: lo lega la
/// piattaforma al ciclo di vita della richiesta.</para>
///
/// <para>⚠️ <b>Tre action e nient'altro.</b> Nessuno stub per eventi, promozioni, contenuti o
/// prenotazioni: una rotta che risponde <c>[]</c> è indistinguibile da una rotta rotta, e il
/// consumatore della fase successiva la troverebbe già "esistente".</para>
///
/// <para>🔴 <b><c>[EnableCors]</c> con la policy dedicata, e il motivo non è l'accesso.</b>
/// L'origine di sviluppo della vetrina è <b>già</b> ammessa dalla policy globale
/// (<c>CorsOriginPolicy</c> confronta l'host ignorando la porta). Qui si sceglie
/// <c>PubblicaSenzaCredenziali</c> perché emette un <c>Access-Control-Allow-Origin</c>
/// <b>costante</b> — quindi nessun <c>Vary: Origin</c> su una risposta dichiarata cacheabile — e
/// perché senza <c>AllowCredentials</c> questa famiglia di rotte non può diventare un vettore
/// credenziale nemmeno per un errore di configurazione futuro. ⚠️ L'attributo dipende
/// dall'ordine dei middleware: vedi il commento accanto ad <c>app.UseCors</c> in
/// <c>Program.cs</c>.</para>
/// </summary>
[AllowAnonymous]
[EnableCors("PubblicaSenzaCredenziali")]
[Route("api/public")]
[ApiController]
public class PublicController(
    AppDbContext dbContext,
    ILogger<PublicController> logger) : ControllerBase
{
    /// <summary>
    /// Il gruppo che raccoglie i prodotti pubblicati senza categoria di vetrina. Un prodotto
    /// <b>non sparisce</b> per il fatto di non essere stato categorizzato: una sparizione
    /// silenziosa è la stessa classe di guasto del troncamento muto, e chi guarda il sito non ha
    /// modo di sapere che manca qualcosa.
    /// </summary>
    private const string CategoriaDiRaccolta = "Altro";

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  GET /api/public/menu
    // ─────────────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Il menu pubblico. Si legge nei passi in cui è scritto:
    /// <list type="number">
    /// <item>il filtro è <see cref="RegoleVetrina.Pubblicato"/>, la regola condivisa, mai una
    /// congiunzione riscritta qui;</item>
    /// <item>l'ordinamento è <b>totale</b> (ordinamento di vetrina, nome mostrato,
    /// identificativo): senza il terzo criterio due prodotti omonimi si scambierebbero di posto
    /// fra due richieste, e una risposta cacheata servirebbe pagine diverse a visitatori
    /// diversi;</item>
    /// <item>il troncamento cade sulla query ordinata, <b>prima</b> del raggruppamento: con 301
    /// prodotti si perde l'ultimo per ordinamento, non un'intera categoria a caso;</item>
    /// <item>il conteggio reale è una <c>CountAsync</c> separata sullo <b>stesso</b> predicato,
    /// non la lunghezza della lista — che coinciderebbe sempre e non direbbe nulla;</item>
    /// <item>il prezzo lo risolve <see cref="RegoleVetrina.PrezzoEffettivo(decimal?, decimal)"/>
    /// dopo la proiezione, che è la ragione per cui quella firma a due valori esiste;</item>
    /// <item>al superamento del limite si registra un avviso con il totale.</item>
    /// </list>
    ///
    /// <para><b>60 secondi</b>, e non 300 come le altre due: il listino cambia <i>durante</i> la
    /// giornata. È lo <b>stesso numero</b> del <c>proxy_cache_valid 200 60s</c> previsto per il
    /// reverse proxy: sono la stessa decisione, scritta due volte di proposito, e nginx onora il
    /// <c>Cache-Control</c> dell'upstream — quindi non potranno divergere.</para>
    /// </summary>
    [HttpGet("menu")]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any)]
    public async Task<ActionResult<MenuPubblicoDto>> Menu(CancellationToken cancellationToken)
    {
        // Il totale REALE, sullo stesso predicato: è una seconda query indicizzata, non una
        // scansione dei risultati, ed è l'unico modo perché la risposta possa dichiarare di
        // essere incompleta.
        int totale = await dbContext.Prodotti
            .Where(RegoleVetrina.Pubblicato)
            .CountAsync(cancellationToken);

        List<RigaMenu> righe = await RigheDelMenu(dbContext).ToListAsync(cancellationToken);

        bool troncato = totale > MenuLimiti.MaxItem;
        if (troncato)
        {
            // Chi guarda il sito vede meno piatti; chi guarda i log sa perché.
            logger.LogWarning(
                "Menu pubblico troncato: {Totale} prodotti pubblicati, ne vengono restituiti {Limite}. "
                + "Il sito mostra un menu incompleto.",
                totale, MenuLimiti.MaxItem);
        }

        // La lavagna: una query a sé, con il suo tetto. Vuota è lo stato normale — significa che
        // stamattina non ci ha messo niente nessuno — e il consumatore non rende la sezione.
        List<RigaMenu> lavagna = await RigheDellaLavagna(dbContext, await OggiNelLocaleAsync(cancellationToken))
            .ToListAsync(cancellationToken);

        return Ok(new MenuPubblicoDto(
            Raggruppa(righe),
            totale,
            MenuLimiti.MaxItem,
            troncato,
            lavagna.Select(ProdottoDa).ToList()));
    }

    /// <summary>
    /// Che giorno è <b>al locale</b>.
    ///
    /// <para>🔴 Non <c>DateTime.Today</c>: quello è il giorno del <b>processo</b>, e il processo
    /// gira in un container il cui fuso non è una garanzia — l'immagine base è UTC salvo che
    /// qualcuno imposti <c>TZ</c>, e nessuno se ne accorge finché una notte d'estate la lavagna
    /// cambia due ore prima di mezzanotte. Il fuso vero sta in <c>BusinessSettings.Timezone</c>,
    /// che è già la sorgente unica degli orari.</para>
    ///
    /// <para>⚠️ Il ripiego su UTC quando il fuso è illeggibile è deliberato e coerente con il resto
    /// della rotta: <b>questa rotta non fallisce mai per lo stato dei dati</b>. Un identificativo
    /// di fuso sbagliato a database non deve poter far rispondere 500 a un visitatore — al peggio
    /// la lavagna cambia a un'ora sbagliata, il che è visibile e circoscritto.</para>
    /// </summary>
    private async Task<DateOnly> OggiNelLocaleAsync(CancellationToken cancellationToken)
    {
        string? fuso = await dbContext.BusinessSettings
            .OrderBy(impostazioni => impostazioni.SettingsId)
            .Select(impostazioni => impostazioni.Timezone)
            .FirstOrDefaultAsync(cancellationToken);

        try
        {
            TimeZoneInfo zona = TimeZoneInfo.FindSystemTimeZoneById(
                string.IsNullOrWhiteSpace(fuso) ? "Europe/Rome" : fuso);
            return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zona));
        }
        catch (Exception errore) when (errore is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            logger.LogWarning(
                errore,
                "Fuso orario \"{Fuso}\" non riconosciuto: la lavagna del giorno usa UTC. "
                + "Il valore arriva da BusinessSettings.Timezone.",
                fuso);
            return DateOnly.FromDateTime(DateTime.UtcNow);
        }
    }

    /// <summary>
    /// La query del menu, isolata perché i test possano ispezionare l'<b>SQL generato</b>: la
    /// garanzia «la proiezione non legge le colonne riservate» si verifica sull'istruzione, non
    /// sul risultato. Il tipo di ritorno è il non generico <see cref="IQueryable"/> perché
    /// <c>RigaMenu</c> resta privata: non è un DTO e non deve poter uscire di qui.
    /// </summary>
    internal static IQueryable QueryDelMenu(AppDbContext dbContext) => RigheDelMenu(dbContext);

    private static IQueryable<RigaMenu> RigheDelMenu(AppDbContext dbContext) =>
        dbContext.Prodotti
            // 🔴 La regola condivisa, tradotta in SQL: il filtro gira nel database e una
            //    richiesta anonima non materializza l'intero listino per scartarne la maggior
            //    parte. È invisibile finché il listino resta piccolo, e per questo va scritta
            //    così adesso.
            .Where(RegoleVetrina.Pubblicato)
            // ⚠️ L'ordine del TRONCAMENTO, che è cosa diversa dall'ordine di presentazione.
            //    Deve essere totale — e questa coppia lo è — perché con 301 prodotti si perda
            //    sempre lo stesso, l'ultimo per ordinamento, e non uno a caso fra due letture.
            //    L'ordine con cui il menu si legge (che interpone il nome mostrato) si applica
            //    in memoria su queste 300 righe: EF Core non sa tradurre un OrderBy che segue
            //    una proiezione costruita, e il nome mostrato nasce nella proiezione.
            .OrderBy(prodotto => prodotto.OrdinamentoVetrina)
            .ThenBy(prodotto => prodotto.ProdottoId)
            .Take(MenuLimiti.MaxItem)
            .Select(Proiezione);

    /// <summary>
    /// I piatti che stanno sulla lavagna <b>oggi</b>.
    ///
    /// <para>🔴 È una query a sé e non un filtro sulle righe già lette, e la ragione è il
    /// troncamento: con il listino oltre il limite, la lavagna del giorno potrebbe stare tutta
    /// fuori dalle prime trecento righe e sparire dalla home senza che nulla lo segnali. Una
    /// query propria la trova sempre.</para>
    ///
    /// <para>⚠️ Il tetto non è <c>MenuLimiti.MaxItem</c>: una lavagna è di tre o quattro piatti, e
    /// una da trecento sarebbe un errore di compilazione da parte dell'amministratore — meglio che
    /// si veda subito troncata in pagina che servita per intero.</para>
    /// </summary>
    private static IQueryable<RigaMenu> RigheDellaLavagna(AppDbContext dbContext, DateOnly oggi) =>
        dbContext.Prodotti
            .Where(RegoleVetrina.Pubblicato)
            .Where(prodotto => prodotto.InLavagnaDal == oggi)
            .OrderBy(prodotto => prodotto.OrdinamentoVetrina)
            .ThenBy(prodotto => prodotto.ProdottoId)
            .Take(MenuLimiti.MaxLavagna)
            .Select(Proiezione);

    /// <summary>
    /// La proiezione, <b>una sola</b>, condivisa dal listino e dalla lavagna.
    ///
    /// <para>🔴 Non è deduplicazione per gusto: è ciò che impedisce alle due letture di divergere
    /// nel punto che conta. Se la lavagna avesse una <c>SELECT</c> propria, sarebbe la seconda
    /// occasione perché una colonna riservata — il codice di listino, l'aliquota — finisca in una
    /// risposta anonima, e il test che ispeziona l'SQL ne guarda una sola.</para>
    ///
    /// <para>⚠️ Il nome mostrato si calcola UNA VOLTA SOLA, qui: la riga lo porta a casa già
    /// risolto e sia l'ordinamento di presentazione sia il DTO leggono lo stesso valore. Scriverlo
    /// due volte significherebbe poterlo far divergere fra l'ordine in cui i piatti compaiono e il
    /// nome con cui si leggono.</para>
    /// </summary>
    private static readonly Expression<Func<Prodotto, RigaMenu>> Proiezione =
        prodotto => new RigaMenu(
            prodotto.ProdottoId,
            prodotto.NomeVetrina ?? prodotto.Nome,
            prodotto.DescrizioneVetrina,
            prodotto.CategoriaVetrina,
            prodotto.PrezzoVetrina,
            prodotto.Prezzo,
            prodotto.OrdinamentoVetrina,
            prodotto.Allergeni,
            prodotto.Novita,
            prodotto.Consigliato,
            // Nessun Include serve: la proiezione attraversa la navigazione e EF genera da
            // sola il LEFT JOIN, portando a casa i soli campi nominati qui.
            prodotto.Immagine == null
                ? null
                : new RigaImmagine(
                    prodotto.Immagine.Chiave,
                    prodotto.Immagine.LarghezzeDisponibili,
                    prodotto.Immagine.Larghezza,
                    prodotto.Immagine.Altezza,
                    prodotto.Immagine.TestoAlternativo,
                    prodotto.Immagine.Didascalia,
                    prodotto.Immagine.Focale,
                    prodotto.Immagine.Placeholder));

    /// <summary>
    /// Il raggruppamento, in memoria su un risultato già limitato e già ordinato.
    ///
    /// <para>🔴 Si raggruppa per categoria <b>di vetrina</b> e non si ricade <b>mai</b> su quella
    /// contabile: sarebbe la strada più breve per far comparire "BEVANDE" come intestazione sul
    /// sito, ed è la ragione per cui quel nome è nell'elenco dei campi vietati.</para>
    ///
    /// <para>L'ordine delle categorie deriva dal <b>minimo</b> ordinamento dei prodotti che
    /// contengono, con il nome come criterio di parità: non esiste un'entità categoria con un
    /// ordine proprio, e questa regola dà all'amministratore una leva reale — abbassare
    /// l'ordinamento di un prodotto fa salire la sua categoria — senza introdurne una.</para>
    /// </summary>
    private static IReadOnlyList<CategoriaMenuDto> Raggruppa(IReadOnlyList<RigaMenu> righe) =>
        righe
            // L'ordine di PRESENTAZIONE, totale: ordinamento di vetrina, nome mostrato,
            // identificativo. Senza il terzo criterio due prodotti con lo stesso ordinamento e
            // lo stesso nome si scambierebbero di posto fra due richieste, e una risposta
            // cacheata servirebbe pagine diverse a visitatori diversi.
            .OrderBy(riga => riga.Ordinamento)
            .ThenBy(riga => riga.NomeMostrato, StringComparer.Ordinal)
            .ThenBy(riga => riga.ProdottoId)
            .GroupBy(riga => NomeCategoria(riga.CategoriaVetrina), StringComparer.Ordinal)
            .OrderBy(gruppo => gruppo.Min(riga => riga.Ordinamento))
            .ThenBy(gruppo => gruppo.Key, StringComparer.Ordinal)
            .Select(gruppo => new CategoriaMenuDto(
                gruppo.Key,
                // GroupBy conserva l'ordine di prima comparsa, e la lista arriva già ordinata:
                // l'ordine totale della query si propaga dentro ogni categoria.
                gruppo.Select(ProdottoDa).ToList()))
            .ToList();

    private static string NomeCategoria(string? categoriaVetrina) =>
        string.IsNullOrWhiteSpace(categoriaVetrina)
            ? CategoriaDiRaccolta
            : categoriaVetrina.Trim();

    private static ProdottoPubblicoDto ProdottoDa(RigaMenu riga) => new(
        riga.ProdottoId,
        riga.NomeMostrato,
        // ⚠️ La descrizione pubblica è quella di vetrina e basta: nessun fallback sulla
        //    descrizione contabile, che è una nota interna scritta per la cassa.
        riga.DescrizioneVetrina,
        // 🔴 La regola condivisa, non una riscrittura: 0 è un omaggio e solo l'assenza di valore
        //    ricade sul listino. È la ragione per cui PrezzoEffettivo ha una firma a due valori,
        //    utilizzabile dopo una proiezione dove l'entità non esiste più.
        RegoleVetrina.PrezzoEffettivo(riga.PrezzoVetrina, riga.Prezzo),
        riga.Allergeni,
        riga.Novita,
        riga.Consigliato,
        ImmagineOpzionale(riga.Immagine));

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  GET /api/public/site
    // ─────────────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// L'identità del locale, composta da due sorgenti.
    ///
    /// <para>🔴 <b>Questa rotta non fallisce mai per lo stato dei dati.</b> Un <c>404</c>
    /// sull'identità farebbe fallire l'intera pagina iniziale del sito e un <c>500</c> anche di
    /// peggio; un corpo con i default produce un sito incompleto, che è un guasto <b>visibile e
    /// circoscritto</b>. Tre modi di non fallire: riga assente → <c>200</c> con i default del
    /// modello e un avviso; giorni operativi illeggibili → campo <c>null</c> e un avviso;
    /// coordinate non impostate → oggetto <c>null</c>, mai una coppia di zeri.</para>
    ///
    /// <para><b>300 secondi</b>: l'identità del locale cambia quando l'amministratore la
    /// modifica, cioè quasi mai. Il numero è il <b>ritardo massimo</b> fra "salvo l'indirizzo" e
    /// "lo vedo sul sito", ed è esattamente ciò che il criterio di successo misura.</para>
    /// </summary>
    [HttpGet("site")]
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any)]
    public async Task<ActionResult<SitoPubblicoDto>> Site(CancellationToken cancellationToken)
    {
        // ⚠️ Si legge la riga per identificativo, mai con un FirstOrDefault senza criterio: c'è
        //    una riga sola e il database lo impone con un CHECK, quindi chiederla per nome è
        //    anche il modo di dire al lettore che il singleton è un valore di dominio.
        RigaSito? sito = await dbContext.ImpostazioniVetrina
            .Where(impostazioni =>
                impostazioni.ImpostazioniVetrinaId == ImpostazioniVetrina.IdSingleton)
            .Select(impostazioni => new RigaSito(
                impostazioni.InsegnaPubblica,
                impostazioni.Via,
                impostazioni.Cap,
                impostazioni.Citta,
                impostazioni.Provincia,
                impostazioni.Paese,
                impostazioni.Latitudine,
                impostazioni.Longitudine,
                impostazioni.Telefono,
                impostazioni.Email,
                impostazioni.UrlInstagram,
                impostazioni.UrlFacebook,
                impostazioni.MetaTitoloDefault,
                impostazioni.MetaDescrizioneDefault,
                impostazioni.OraInizioTemaSera,
                impostazioni.ClaimVetrina,
                impostazioni.StoriaTitolo,
                impostazioni.StoriaTesto,
                impostazioni.AperitivoTitolo,
                impostazioni.AperitivoTesto,
                impostazioni.AperitivoPunti,
                impostazioni.AperitivoCategorie,
                impostazioni.PunteggioGoogle,
                impostazioni.NumeroRecensioniGoogle,
                impostazioni.UrlProfiloGoogle,
                impostazioni.ImmagineOg == null
                    ? null
                    : new RigaImmagine(
                        impostazioni.ImmagineOg.Chiave,
                        impostazioni.ImmagineOg.LarghezzeDisponibili,
                        impostazioni.ImmagineOg.Larghezza,
                        impostazioni.ImmagineOg.Altezza,
                        impostazioni.ImmagineOg.TestoAlternativo,
                        impostazioni.ImmagineOg.Didascalia,
                        impostazioni.ImmagineOg.Focale,
                        impostazioni.ImmagineOg.Placeholder)))
            .FirstOrDefaultAsync(cancellationToken);

        if (sito is null)
        {
            logger.LogWarning(
                "Impostazioni della vetrina assenti: /api/public/site risponde con i valori di "
                + "default del modello. Il sito è incompleto finché un amministratore non le "
                + "compila (o finché il seed non gira su un database vuoto).");
            sito = DefaultDelSito();
        }

        // Gli orari hanno UNA sola sorgente, e non è la vetrina: è ciò che rende impossibile per
        // costruzione «il sito dice aperto fino alle 21, la cassa alle 19».
        // L'ordinamento per identificativo non irrigidisce il singleton di BusinessSettings (è un
        // change dedicato, vedi AppDbContext), ma rende deterministica una risposta cacheabile.
        RigaOperativa? operative = await dbContext.BusinessSettings
            .OrderBy(impostazioni => impostazioni.SettingsId)
            .Select(impostazioni => new RigaOperativa(
                impostazioni.OpeningTime,
                impostazioni.ClosingTime,
                impostazioni.OperatingDays,
                impostazioni.Timezone))
            .FirstOrDefaultAsync(cancellationToken);

        if (operative is null)
        {
            logger.LogWarning(
                "Impostazioni operative assenti: /api/public/site espone gli orari di default. "
                + "Non è uno stato atteso — il seed dell'applicazione crea quella riga all'avvio.");
            operative = DefaultOperativo();
        }

        return Ok(new SitoPubblicoDto(
            sito.Insegna,
            new IndirizzoPubblicoDto(sito.Via, sito.Cap, sito.Citta, sito.Provincia, sito.Paese),
            // 🔴 O entrambe o niente: mezza coordinata è un punto sull'equatore, cioè una mappa
            //    che indica con sicurezza il posto sbagliato.
            sito is { Latitudine: { } latitudine, Longitudine: { } longitudine }
                ? new GeoPubblicaDto(latitudine, longitudine)
                : null,
            new ContattiPubbliciDto(sito.Telefono, sito.Email),
            new SocialPubbliciDto(sito.UrlInstagram, sito.UrlFacebook),
            new OrariPubbliciDto(
                operative.Apertura,
                operative.Chiusura,
                LeggiGiorniOperativi(operative.GiorniOperativi),
                operative.Timezone),
            new SeoPubblicaDto(
                sito.MetaTitoloDefault,
                sito.MetaDescrizioneDefault,
                ImmagineOpzionale(sito.ImmagineOg)),
            sito.OraInizioTemaSera,
            TestiDa(sito),
            // 🔴 O entrambi i numeri o niente, come per le coordinate: presi da soli non sono un
            //    dato incompleto, sono un dato fuorviante.
            sito is { PunteggioGoogle: { } punteggio, NumeroRecensioniGoogle: { } numero }
                ? new ReputazionePubblicaDto(punteggio, numero, sito.UrlProfiloGoogle)
                : null,
            // ⚠️ SOLE le pubblicate — e l'ordine viene da `OrdineRecensioni`, lo stesso che usa
            //    il ramo amministrativo: l'anteprima con cui l'amministratore le riordina non
            //    serve a niente se qui l'ordine è un altro.
            await OrdineRecensioni
                .Applica(dbContext.RecensioniVetrina.Where(recensione => recensione.Pubblicata))
                .Select(recensione => new RecensionePubblicaDto(
                    recensione.RecensioneVetrinaId,
                    recensione.Autore,
                    recensione.Testo,
                    recensione.Fonte,
                    recensione.Punteggio))
                .ToListAsync(cancellationToken)));
    }

    /// <summary>
    /// I testi editoriali, con la regola che li rende onesti: <b>una sezione esiste solo se ha il
    /// suo testo</b>. Un titolo senza corpo non è una storia, ed è precisamente lo stato in cui si
    /// finisce compilando un modulo a metà.
    /// </summary>
    private static TestiPubbliciDto TestiDa(RigaSito sito) => new(
        NullSeVuoto(sito.ClaimVetrina),
        NullSeVuoto(sito.StoriaTesto) is { } storia
            ? new StoriaPubblicaDto(NullSeVuoto(sito.StoriaTitolo), storia)
            : null,
        NullSeVuoto(sito.AperitivoTesto) is { } aperitivo
            ? new AperitivoPubblicoDto(
                NullSeVuoto(sito.AperitivoTitolo),
                aperitivo,
                PuntiDa(sito.AperitivoPunti),
                RigheDa(sito.AperitivoCategorie))
            : null);

    /// <summary>
    /// Le voci dell'aperitivo, da un campo di testo con <b>una voce per riga</b>.
    ///
    /// <para>⚠️ La difesa sta qui perché la sorgente è una stringa scritta a mano in un modulo:
    /// righe vuote, spazi in coda e fine riga di Windows sono tutte forme legittime di ciò che
    /// l'amministratore digita. Il consumatore riceve una lista pulita e non deve sapere che
    /// dall'altra parte c'era del testo libero.</para>
    ///
    /// <para>Il tetto a sei non è arbitrario: è il numero oltre il quale l'elenco smette di essere
    /// «cosa è compreso» e diventa un secondo menu. Chi ne scrive dieci ne vede sei, e se ne
    /// accorge subito guardando la pagina.</para>
    /// </summary>
    private static IReadOnlyList<string> PuntiDa(string? testo) => RigheDa(testo, tetto: 6);

    /// <summary>
    /// Un campo di testo «una voce per riga», normalizzato.
    ///
    /// <para>⚠️ <c>Split('\n')</c> più <c>Trim()</c>, e non <c>Split(Environment.NewLine)</c>: la
    /// stringa arriva da un <c>textarea</c> di un browser, che manda <c>\r\n</c>, mentre
    /// <c>Environment.NewLine</c> è <c>\n</c> su Linux — cioè in produzione. Con quello, ogni riga
    /// terminerebbe con un <c>\r</c> invisibile, e il confronto fra un nome di categoria e
    /// l'omonimo del listino fallirebbe <b>solo in produzione</b>, mostrando una pagina vuota che
    /// in sviluppo funziona.</para>
    /// </summary>
    private static IReadOnlyList<string> RigheDa(string? testo, int tetto = 20) =>
        string.IsNullOrWhiteSpace(testo)
            ? []
            : testo
                .Split('\n')
                .Select(riga => riga.Trim())
                .Where(riga => riga.Length > 0)
                .Take(tetto)
                .ToList();

    private static string? NullSeVuoto(string? valore) =>
        string.IsNullOrWhiteSpace(valore) ? null : valore.Trim();

    /// <summary>
    /// I giorni operativi, letti da un JSON persistito in stringa.
    ///
    /// <para>🔴 Parse <b>tollerante</b>, e deliberatamente diverso da quello della cassa, che
    /// deserializza con un <c>!</c>: là un valore malformato è un errore che vede un operatore
    /// autenticato, qui sarebbe un <b>500 servito a un visitatore</b> per colpa di una riga
    /// sporca. <b>Omettere gli orari settimanali è meglio che dichiararne di sbagliati</b>: il
    /// campo diventa <c>null</c>, il server registra un avviso, e il consumatore che genera i
    /// dati strutturati omette la sezione degli orari.</para>
    /// </summary>
    private IReadOnlyList<bool>? LeggiGiorniOperativi(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            logger.LogWarning("Giorni operativi non valorizzati: il campo viene esposto come null.");
            return null;
        }

        bool[]? giorni;
        try
        {
            giorni = JsonSerializer.Deserialize<bool[]>(json);
        }
        catch (Exception eccezione) when (eccezione is JsonException or NotSupportedException)
        {
            logger.LogWarning(eccezione,
                "Giorni operativi illeggibili ({Valore}): il campo viene esposto come null invece "
                + "di dichiarare orari settimanali sbagliati.", json);
            return null;
        }

        if (giorni is not { Length: 7 })
        {
            logger.LogWarning(
                "Giorni operativi non sono una sequenza di sette booleani ({Valore}): il campo "
                + "viene esposto come null.", json);
            return null;
        }

        return giorni;
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  GET /api/public/galleria
    // ─────────────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// La galleria: i media della cartella dedicata <b>e</b> pubblicati.
    ///
    /// <para>⚠️ Il confronto sulla cartella è un'<b>uguaglianza secca</b> sul valore persistito,
    /// senza alcuna funzione applicata: la normalizzazione è avvenuta in scrittura, quindi il
    /// valore a database è canonico e non soltanto equivalente. Normalizzare qui produrrebbe
    /// <c>LOWER(Cartella) = …</c>, non sargabile, e l'indice <c>(Cartella, Ordinamento)</c>
    /// smetterebbe di essere utilizzabile per la selezione ordinata.</para>
    ///
    /// <para>Una galleria vuota è uno <b>stato legittimo</b> — nessuno ha ancora etichettato
    /// immagini — e risponde <c>200</c> con un elenco vuoto. ⚠️ In quel caso <c>ruoli</c>
    /// <b>c'è comunque</b>, con i tre ruoli singoli a <c>null</c> e le tre griglie vuote: un
    /// campo che a volte manca costringerebbe il consumatore a un controllo per pagina.</para>
    ///
    /// <para>🔴 <b>L'elenco e i ruoli escono dalla stessa lettura</b>, non da due. Se fossero due
    /// query, una foto caricata fra l'una e l'altra produrrebbe una risposta in cui i ruoli
    /// nominano un'immagine che <c>immagini</c> non contiene — e il sito renderebbe una foto che
    /// dichiara di non avere.</para>
    ///
    /// <para><b>300 secondi</b>, come <c>site</c>: contenuto editoriale, cambia a mano. I ruoli
    /// non cambiano quella politica — cambiano con gli stessi dati e alla stessa frequenza.</para>
    /// </summary>
    [HttpGet("galleria")]
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any)]
    public async Task<ActionResult<GalleriaPubblicaDto>> Galleria(CancellationToken cancellationToken)
    {
        List<MediaAsset> galleria =
            await RigheDellaGalleria(dbContext).ToListAsync(cancellationToken);

        // ⚠️ Si legge la riga per identificativo, come in `Site`: c'è una riga sola e il database
        //    lo impone con un CHECK. Assente — installazione con SEED_ON_STARTUP=false, prima
        //    del primo salvataggio — significa «nessuno slot scelto», che è esattamente lo stato
        //    iniziale e NON un guasto: nessun avviso, i ruoli ricadono sulla posizione. La rotta
        //    `site` avvisa già per la stessa riga, e ripeterlo qui sarebbe rumore raddoppiato.
        SlotImmagini slot = await dbContext.ImpostazioniVetrina
            .Where(impostazioni =>
                impostazioni.ImpostazioniVetrinaId == ImpostazioniVetrina.IdSingleton)
            .Select(impostazioni => new SlotImmagini(
                impostazioni.ImmagineEroeHomeId,
                impostazioni.ImmagineRitrattoLocaleId,
                impostazioni.ImmagineEroeAperitivoId))
            .FirstOrDefaultAsync(cancellationToken)
            ?? new SlotImmagini(null, null, null);

        // 🔴 La regola NON è qui: è in RuoliImmaginiVetrina, sede unica, e questo è uno dei suoi
        //    due chiamanti (l'altro è il ramo GraphQL di amministrazione). Il giorno in cui una
        //    finestra passa da tre a quattro foto si cambia lì, e il pannello e il sito cambiano
        //    insieme — che è la proprietà per cui la funzione esiste.
        PianoImmagini piano = RuoliImmaginiVetrina.Risolvi(
            slot.EroeHomeId, slot.RitrattoLocaleId, slot.EroeAperitivoId, galleria);

        return Ok(new GalleriaPubblicaDto(
            galleria.Select(Immagine).ToList(),
            new RuoliImmaginiDto(
                ImmagineOpzionale(piano.EroeHome),
                piano.GrigliaHome.Select(Immagine).ToList(),
                piano.FotoMenu.Select(Immagine).ToList(),
                ImmagineOpzionale(piano.RitrattoLocale),
                piano.QuadrateLocale.Select(Immagine).ToList(),
                ImmagineOpzionale(piano.EroeAperitivo))));
    }

    /// <summary>
    /// La query della galleria, isolata per la stessa ragione di <see cref="QueryDelMenu"/>: la
    /// garanzia «la lettura non normalizza» si verifica sull'istruzione generata, dove non deve
    /// comparire alcuna funzione applicata alla colonna.
    /// </summary>
    internal static IQueryable QueryDellaGalleria(AppDbContext dbContext) =>
        RigheDellaGalleria(dbContext);

    /// <summary>
    /// 🔴 <b>L'unica lettura pubblica che porta a casa l'entità invece di una proiezione, e la
    /// ragione va scritta perché è una deroga.</b> La regola dei ruoli vive in
    /// <see cref="RuoliImmaginiVetrina"/> e parla di <see cref="MediaAsset"/>: proiettare qui una
    /// forma più stretta significherebbe o una seconda mappatura verso l'entità (cioè un secondo
    /// posto in cui la galleria è descritta) o una firma generica che nessun altro chiamante
    /// vuole. La deroga costa <b>otto colonne su una manciata di righe</b>, dietro una risposta
    /// cacheata 300 s.
    ///
    /// <para>⚠️ Ciò che la deroga <b>non</b> costa: <c>MediaAssets</c> non possiede alcuna colonna
    /// contabile né alcun segreto, e la superficie che esce resta decisa dai <c>record</c> di
    /// <c>Public.Dto</c> — leggere una colonna e non serializzarla non è esporla. Il giorno in cui
    /// alla tabella dei media si aggiungesse un campo interno, il DTO continuerebbe a non
    /// possederlo e <c>SuperficiePubblicaTests</c> lo direbbe comunque.</para>
    /// </summary>
    private static IQueryable<MediaAsset> RigheDellaGalleria(AppDbContext dbContext) =>
        dbContext.MediaAssets
            .Where(media => media.Cartella == CartelleVetrina.Galleria && media.Pubblicato)
            .OrderBy(media => media.Ordinamento)
            .ThenBy(media => media.MediaAssetId);

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  Mappatura condivisa e forme intermedie
    // ─────────────────────────────────────────────────────────────────────────────────────

    private static ImmaginePubblicaDto Immagine(RigaImmagine riga) => new(
        riga.Chiave,
        // La sede unica della conversione, con semantica tollerante: una riga con il CSV sporco
        // produce una variante in meno nel srcset, non un 500 servito a un visitatore.
        LarghezzeCsv.Leggi(riga.LarghezzeDisponibili),
        riga.Larghezza,
        riga.Altezza,
        riga.TestoAlternativo,
        riga.Didascalia,
        riga.Focale,
        riga.Placeholder);

    private static ImmaginePubblicaDto? ImmagineOpzionale(RigaImmagine? riga) =>
        riga is null ? null : Immagine(riga);

    /// <summary>
    /// La stessa mappatura, a partire dall'entità: <b>delega</b> alla forma intermedia invece di
    /// riscrivere gli otto campi, così che <see cref="LarghezzeCsv.Leggi"/> e la sua semantica
    /// tollerante restino in un posto solo. Un secondo <c>new ImmaginePubblicaDto(…)</c> sarebbe
    /// quello destinato a dimenticare un campo il giorno in cui il DTO ne guadagna uno.
    /// </summary>
    private static ImmaginePubblicaDto Immagine(MediaAsset media) => Immagine(new RigaImmagine(
        media.Chiave,
        media.LarghezzeDisponibili,
        media.Larghezza,
        media.Altezza,
        media.TestoAlternativo,
        media.Didascalia,
        media.Focale,
        media.Placeholder));

    private static ImmaginePubblicaDto? ImmagineOpzionale(MediaAsset? media) =>
        media is null ? null : Immagine(media);

    /// <summary>
    /// I default della riga assente arrivano dal <b>modello</b> e non da valori scritti qui: è la
    /// stessa ragione per cui non li ripete nemmeno il seed. Una seconda scrittura degli stessi
    /// default sarebbe quella destinata a divergere.
    /// </summary>
    private static RigaSito DefaultDelSito()
    {
        var vuote = new ImpostazioniVetrina();
        return new RigaSito(
            vuote.InsegnaPubblica, vuote.Via, vuote.Cap, vuote.Citta, vuote.Provincia, vuote.Paese,
            vuote.Latitudine, vuote.Longitudine, vuote.Telefono, vuote.Email,
            vuote.UrlInstagram, vuote.UrlFacebook,
            vuote.MetaTitoloDefault, vuote.MetaDescrizioneDefault, vuote.OraInizioTemaSera,
            vuote.ClaimVetrina, vuote.StoriaTitolo, vuote.StoriaTesto,
            vuote.AperitivoTitolo, vuote.AperitivoTesto, vuote.AperitivoPunti, vuote.AperitivoCategorie,
            vuote.PunteggioGoogle, vuote.NumeroRecensioniGoogle, vuote.UrlProfiloGoogle,
            null);
    }

    private static RigaOperativa DefaultOperativo()
    {
        var vuote = new BusinessSettings();
        return new RigaOperativa(
            vuote.OpeningTime, vuote.ClosingTime, vuote.OperatingDays, vuote.Timezone);
    }

    /// <summary>
    /// La forma intermedia della sola query del menu. <b>Non è un DTO</b> e non esce da questa
    /// classe: esiste perché il fallback del prezzo è una funzione C# e non un'espressione
    /// traducibile, quindi la <c>SELECT</c> porta a casa i due prezzi grezzi e la regola si
    /// applica in memoria, una volta, su un risultato già limitato.
    ///
    /// <para>🔴 Non seleziona — e quindi il database non legge nemmeno — codice di listino,
    /// aliquota IVA, categoria contabile, unità di misura, stato di attività e marche temporali.
    /// Non "li legge e non li serializza": <b>non li chiede</b>.</para>
    /// </summary>
    private sealed record RigaMenu(
        int ProdottoId,
        string NomeMostrato,
        string? DescrizioneVetrina,
        string? CategoriaVetrina,
        decimal? PrezzoVetrina,
        decimal Prezzo,
        int Ordinamento,
        string? Allergeni,
        bool Novita,
        bool Consigliato,
        RigaImmagine? Immagine);

    /// <summary>
    /// I tre slot immagine delle pagine, letti dal singleton della vetrina con una proiezione a
    /// tre colonne.
    ///
    /// <para>🔴 <b>Tre <c>int?</c> e non l'entità</b>: è precisamente la forma per cui
    /// <see cref="RuoliImmaginiVetrina.Risolvi(int?, int?, int?, IReadOnlyList{MediaAsset})"/>
    /// esiste con quella firma. Leggere l'<c>ImpostazioniVetrina</c> intera per prenderne tre
    /// colonne porterebbe in memoria, su una rotta anonima, anche i ganci spenti — fra cui la
    /// chiave del servizio antispam, che sta nell'elenco dei nomi vietati in pubblico.</para>
    /// </summary>
    private sealed record SlotImmagini(int? EroeHomeId, int? RitrattoLocaleId, int? EroeAperitivoId);

    /// <summary>Forma intermedia dell'immagine, condivisa dalle tre query.</summary>
    private sealed record RigaImmagine(
        string Chiave,
        string? LarghezzeDisponibili,
        int Larghezza,
        int Altezza,
        string? TestoAlternativo,
        string? Didascalia,
        string? Focale,
        string? Placeholder);

    /// <summary>
    /// Forma intermedia delle impostazioni del sito: porta i soli campi che il contratto
    /// pubblico espone. I ganci spenti delle fasi successive e le marche temporali non entrano
    /// nella <c>SELECT</c>.
    /// </summary>
    private sealed record RigaSito(
        string Insegna,
        string Via,
        string Cap,
        string Citta,
        string Provincia,
        string Paese,
        decimal? Latitudine,
        decimal? Longitudine,
        string? Telefono,
        string? Email,
        string? UrlInstagram,
        string? UrlFacebook,
        string? MetaTitoloDefault,
        string? MetaDescrizioneDefault,
        string OraInizioTemaSera,
        string? ClaimVetrina,
        string? StoriaTitolo,
        string? StoriaTesto,
        string? AperitivoTitolo,
        string? AperitivoTesto,
        string? AperitivoPunti,
        string? AperitivoCategorie,
        decimal? PunteggioGoogle,
        int? NumeroRecensioniGoogle,
        string? UrlProfiloGoogle,
        RigaImmagine? ImmagineOg);

    /// <summary>
    /// Forma intermedia delle impostazioni operative: <b>quattro campi soltanto</b>. È il punto
    /// di composizione fra le due entità, cioè esattamente il punto in cui l'aliquota IVA e il
    /// costo del giornale salirebbero a bordo senza che nessuno lo scriva — e non possono,
    /// perché la query non li chiede.
    /// </summary>
    private sealed record RigaOperativa(
        string Apertura,
        string Chiusura,
        string? GiorniOperativi,
        string Timezone);
}
