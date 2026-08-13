using System.Text.RegularExpressions;

using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Common;
using duedgusto.DataAccess;
using duedgusto.GraphQL.Authentication;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.GraphQL.Vendite.Types;
using duedgusto.GraphQL.Vetrina.Types;
using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.Services.Jwt;
using duedgusto.Services.Media;

namespace duedgusto.GraphQL.Vetrina;

/// <summary>
/// Scritture della vetrina: campi editoriali dei prodotti e metadati dei media.
///
/// 🔴 Il ramo è riservato agli amministratori su <b>due</b> livelli distinti e non
/// intercambiabili: <c>this.Authorize()</c> di tipo esclude l'anonimo, il guard dentro ogni
/// resolver esclude l'utente autenticato senza privilegi. Il primo non implica il secondo.
///
/// La logica vive in metodi statici accanto ai resolver, come <c>UpsertProdottoAsync</c> in
/// VenditeMutations: i test del confine devono poter esercitare la scrittura vera senza
/// passare dal motore GraphQL, altrimenti finirebbero per verificare il trasporto invece
/// della regola.
/// </summary>
public partial class VetrinaMutations : ObjectGraphType
{
    /// <summary>Formato del punto focale: "&lt;0-100&gt;% &lt;0-100&gt;%".</summary>
    [GeneratedRegex(@"^\s*(\d{1,3})%\s+(\d{1,3})%\s*$")]
    private static partial Regex FormatoFocale();

    /// <summary>
    /// Orario nella forma <c>HH:mm</c>, lo stesso di <c>OpeningTime</c>/<c>ClosingTime</c>.
    ///
    /// <para>⚠️ È <b>più stretto</b> del <c>/^\d{2}:\d{2}$/</c> con cui il frontend valida gli
    /// orari della cassa: qui "99:99" viene rifiutato. È voluto — la validazione del client non
    /// è l'unico controllo, e le stesse regole devono valere per una chiamata GraphQL diretta.
    /// Il backend più severo del client è la direzione giusta dell'asimmetria.</para>
    /// </summary>
    [GeneratedRegex(@"^([01][0-9]|2[0-3]):[0-5][0-9]$")]
    private static partial Regex FormatoOrario();

    private static int UtenteCorrenteId(IResolveFieldContext<object?> context)
    {
        JwtHelper jwtHelper = GraphQLService.GetService<JwtHelper>(context);
        GraphQLUserContext userContext = context.UserContext as GraphQLUserContext
            ?? throw new ExecutionError("Utente non autenticato");
        return jwtHelper.GetUserID(userContext.Principal!);
    }

    /// <summary>
    /// Il guard di privilegio del ramo vetrina. <c>internal</c> e non <c>private</c> perché
    /// <see cref="VetrinaQueries"/> deve usare <b>lo stesso</b>: due guard che verificano la
    /// stessa cosa sono due guard, e il giorno in cui uno dei due cambia — o smette di leggere il
    /// flag del ruolo per leggerne il nome — l'altro non lo sa.
    /// </summary>
    internal static Task GuardAmministratore(IResolveFieldContext<object?> context, AppDbContext dbContext) =>
        GestioneCassaGuards.GuardUtenteAmministratore(dbContext, UtenteCorrenteId(context));

    public VetrinaMutations()
    {
        this.Authorize();

        Field<ProdottoType>("mutateProdottoVetrina")
            .Argument<NonNullGraphType<IntGraphType>>("prodottoId", "Prodotto ESISTENTE da arricchire")
            .Argument<NonNullGraphType<ProdottoVetrinaInputType>>("input", "Gli undici campi vetrina")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                // Prima istruzione, prima di qualunque lettura: un rifiuto non deve poter
                // rivelare se un id esiste.
                await GuardAmministratore(context, dbContext);

                return await ApplicaCampiVetrinaAsync(
                    dbContext,
                    context.GetArgument<int>("prodottoId"),
                    context.GetArgument<ProdottoVetrinaInput>("input"));
            });

        Field<MediaAssetType>("mutateMediaAsset")
            .Argument<NonNullGraphType<IntGraphType>>("mediaAssetId")
            .Argument<NonNullGraphType<MediaAssetInputType>>("input", "Soli metadati editoriali")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                await GuardAmministratore(context, dbContext);

                return await AggiornaMediaAssetAsync(
                    dbContext,
                    context.GetArgument<int>("mediaAssetId"),
                    context.GetArgument<MediaAssetInput>("input"),
                    GraphQLService.GetService<ILogger<VetrinaMutations>>(context));
            });

        Field<BooleanGraphType>("eliminaMediaAsset")
            .Argument<NonNullGraphType<IntGraphType>>("mediaAssetId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                await GuardAmministratore(context, dbContext);

                return await EliminaMediaAssetAsync(
                    dbContext,
                    GraphQLService.GetService<IMediaStorage>(context),
                    context.GetArgument<int>("mediaAssetId"));
            });

        Field<ImpostazioniVetrinaType>("mutateImpostazioniVetrina")
            .Argument<NonNullGraphType<ImpostazioniVetrinaInputType>>(
                "input", "Tutti i campi scrivibili: l'assegnazione è totale")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                await GuardAmministratore(context, dbContext);

                return await ApplicaImpostazioniVetrinaAsync(
                    dbContext,
                    context.GetArgument<ImpostazioniVetrinaInput>("input"));
            });

        // ── Recensioni riportate ─────────────────────────────────────────────────────────
        // ⚠️ Qui esiste un ramo di CREAZIONE, al contrario di mutateProdottoVetrina. Non è
        //    un'incoerenza: i prodotti nascono in cassa dal listino, e una vetrina che sapesse
        //    crearli diventerebbe un secondo listino. Una recensione riportata non ha alcuna
        //    controparte in cassa — non nasce da nessun'altra parte, quindi deve nascere qui.
        Field<RecensioneVetrinaType>("mutateRecensioneVetrina")
            .Argument<IntGraphType>("recensioneVetrinaId",
                "Assente o null per crearne una nuova.")
            .Argument<NonNullGraphType<RecensioneVetrinaInputType>>(
                "input", "Tutti i campi scrivibili: l'assegnazione è totale")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                await GuardAmministratore(context, dbContext);

                return await ApplicaRecensioneAsync(
                    dbContext,
                    context.GetArgument<int?>("recensioneVetrinaId"),
                    context.GetArgument<RecensioneVetrinaInput>("input"));
            });

        Field<BooleanGraphType>("eliminaRecensioneVetrina")
            .Argument<NonNullGraphType<IntGraphType>>("recensioneVetrinaId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                await GuardAmministratore(context, dbContext);

                return await EliminaRecensioneAsync(
                    dbContext, context.GetArgument<int>("recensioneVetrinaId"));
            });
    }

    /// <summary>
    /// Crea o aggiorna una recensione riportata, con <b>assegnazione totale</b> — stesso stile e
    /// stessa ragione di <see cref="ApplicaImpostazioniVetrinaAsync"/>: l'input possiede
    /// esattamente i campi scrivibili, quindi non c'è nulla da preservare e nessuna ragione di
    /// assegnare sotto condizione. Un campo si può quindi <b>svuotare</b>, che è ciò che
    /// l'assegnazione condizionale rende impossibile.
    /// </summary>
    public static async Task<RecensioneVetrina> ApplicaRecensioneAsync(
        AppDbContext dbContext, int? recensioneId, RecensioneVetrinaInput input)
    {
        // ── Validazioni, tutte prima di toccare il change tracker ────────────────────────
        string autore = Obbligatorio(input.Autore);
        string testo = Obbligatorio(input.Testo);

        if (autore.Length == 0)
        {
            throw new ExecutionError(
                "La firma non può essere vuota: serve almeno una fonte generica, per esempio "
                + "\"Recensione Google\". Una citazione senza attribuzione in pagina sembra una "
                + "frase scritta dal locale su sé stesso.");
        }

        if (testo.Length == 0)
        {
            throw new ExecutionError("Il testo della recensione non può essere vuoto.");
        }

        if (input.Punteggio is < 1 or > 5)
        {
            throw new ExecutionError(
                $"Il punteggio {input.Punteggio} è fuori intervallo: deve stare fra 1 e 5. "
                + "Il vincolo è anche a database, perché queste righe si inseriscono anche a "
                + "mano quando si migra del contenuto.");
        }

        RecensioneVetrina recensione;
        if (recensioneId is int id)
        {
            recensione = await dbContext.RecensioniVetrina
                .FirstOrDefaultAsync(r => r.RecensioneVetrinaId == id)
                ?? throw new ExecutionError($"Recensione {id} non trovata.");
        }
        else
        {
            recensione = new RecensioneVetrina();
            dbContext.RecensioniVetrina.Add(recensione);
        }

        recensione.Autore = autore;
        recensione.Testo = testo;
        recensione.Fonte = NullSeVuoto(input.Fonte);
        recensione.Punteggio = input.Punteggio;
        recensione.Ordinamento = input.Ordinamento;
        recensione.Pubblicata = input.Pubblicata;
        recensione.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();
        return recensione;
    }

    /// <summary>
    /// Elimina una recensione riportata — e qui l'eliminazione <b>esiste davvero</b>, al
    /// contrario dei prodotti, che si possono solo disattivare.
    ///
    /// <para>La differenza ha una ragione: un prodotto è referenziato dalle vendite e dalla
    /// contabilità, quindi cancellarlo riscriverebbe la storia. Una citazione non è referenziata
    /// da nulla, e tenersi per sempre una recensione inserita per sbaglio — magari attribuita a
    /// una persona che ha chiesto di toglierla — sarebbe il difetto, non la prudenza.</para>
    /// </summary>
    public static async Task<bool> EliminaRecensioneAsync(AppDbContext dbContext, int recensioneId)
    {
        RecensioneVetrina recensione = await dbContext.RecensioniVetrina
            .FirstOrDefaultAsync(r => r.RecensioneVetrinaId == recensioneId)
            ?? throw new ExecutionError($"Recensione {recensioneId} non trovata.");

        dbContext.RecensioniVetrina.Remove(recensione);
        await dbContext.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Scrive gli undici campi vetrina di un prodotto <b>esistente</b>. Nessun ramo di creazione,
    /// e non è una dimenticanza: i prodotti nascono in cassa, dal listino. Una vetrina che sa
    /// creare prodotti diventa un secondo listino, e due listini divergono sempre.
    /// </summary>
    public static async Task<Prodotto> ApplicaCampiVetrinaAsync(
        AppDbContext dbContext, int prodottoId, ProdottoVetrinaInput input)
    {
        Prodotto prodotto = await dbContext.Prodotti
            .Include(p => p.Immagine)
            .FirstOrDefaultAsync(p => p.ProdottoId == prodottoId)
            ?? throw new ExecutionError(
                $"Prodotto {prodottoId} non trovato. La vetrina arricchisce prodotti "
                + "esistenti del listino e non può crearne di nuovi.");

        if (input.PrezzoVetrina is < 0)
        {
            throw new ExecutionError(
                $"Il prezzo di vetrina non può essere negativo (ricevuto {input.PrezzoVetrina}). "
                + "Per non mostrare alcun prezzo proprio lascia il campo vuoto; per un omaggio usa 0.");
        }

        await VerificaImmagineAssegnabileAsync(dbContext, input.ImmagineId);

        // Assegnazione totale dei dieci campi, e nient'altro. È sicura proprio perché l'input
        // non possiede i campi contabili: non c'è nulla da ricordarsi di preservare, perché
        // non c'è nulla che questo canale possa toccare.
        //
        // Nessun rifiuto di VisibileSulSito = true su prodotto non attivo: è uno stato
        // ammesso e innocuo — pubblicatoSulSito resta false, e la scheda si può preparare
        // prima che il prodotto torni in vendita.
        prodotto.VisibileSulSito = input.VisibileSulSito;
        prodotto.NomeVetrina = NullSeVuoto(input.NomeVetrina);
        prodotto.DescrizioneVetrina = NullSeVuoto(input.DescrizioneVetrina);
        prodotto.CategoriaVetrina = NullSeVuoto(input.CategoriaVetrina);
        prodotto.PrezzoVetrina = input.PrezzoVetrina;
        prodotto.ImmagineId = input.ImmagineId;
        prodotto.OrdinamentoVetrina = input.OrdinamentoVetrina;
        // Una sola rappresentazione del vuoto: stringa vuota e soli spazi diventano null,
        // così nessun consumatore deve distinguerne le forme.
        prodotto.Allergeni = NullSeVuoto(input.Allergeni);
        prodotto.Novita = input.Novita;
        prodotto.Consigliato = input.Consigliato;
        prodotto.InLavagnaDal = input.InLavagnaDal;
        prodotto.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        // Ricarica la navigazione: se l'immagine è cambiata, quella in memoria è la
        // precedente e la risposta mostrerebbe l'immagine sbagliata.
        await dbContext.Entry(prodotto).Reference(p => p.Immagine).LoadAsync();
        return prodotto;
    }

    /// <summary>
    /// Aggiorna i <b>soli metadati editoriali</b> di un media. Chiave, MIME, dimensioni,
    /// larghezze, placeholder, byte e i file su disco restano ciò che la pipeline ha misurato.
    /// </summary>
    public static async Task<MediaAsset> AggiornaMediaAssetAsync(
        AppDbContext dbContext, int mediaAssetId, MediaAssetInput input, ILogger? logger = null)
    {
        MediaAsset asset = await dbContext.MediaAssets
            .FirstOrDefaultAsync(m => m.MediaAssetId == mediaAssetId)
            ?? throw new ExecutionError($"Media {mediaAssetId} non trovato.");

        string? focale = NullSeVuoto(input.Focale);
        if (focale is not null && !FocaleValida(focale))
        {
            throw new ExecutionError(
                $"Punto focale \"{focale}\" non valido: serve la forma \"50% 40%\", due "
                + "percentuali fra 0 e 100 separate da uno spazio (prima l'orizzontale, poi la "
                + "verticale). Lascia vuoto per centrare.");
        }

        // Ritirare un'immagine che il sito sta mostrando è legittimo, ma chi lo fa deve
        // saperlo: si segnala e si procede, senza toccare i prodotti. Bloccare sarebbe
        // peggio — l'unico modo di ritirare una foto sbagliata sarebbe passare prima da
        // ogni scheda che la usa.
        List<string> prodottiPubblicati = [];
        if (asset.Pubblicato && !input.Pubblicato)
        {
            prodottiPubblicati = await dbContext.Prodotti
                .Where(p => p.ImmagineId == mediaAssetId)
                .Where(RegoleVetrina.Pubblicato)
                .OrderBy(p => p.Codice)
                .Select(p => p.Nome)
                .ToListAsync();
        }

        asset.TestoAlternativo = NullSeVuoto(input.TestoAlternativo);
        asset.Didascalia = NullSeVuoto(input.Didascalia);
        asset.Focale = focale;
        // Normalizzazione in SCRITTURA: la cartella ha una sola forma canonica. Senza questo,
        // "Galleria" e "galleria" sono due raggruppamenti distinti nella libreria — e sul sito
        // ne comparirebbe uno solo, senza alcun errore da nessuna parte.
        asset.Cartella = CartelleVetrina.Normalizza(input.Cartella);
        asset.Ordinamento = input.Ordinamento;
        asset.Pubblicato = input.Pubblicato;
        asset.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        if (prodottiPubblicati.Count > 0)
        {
            logger?.LogWarning(
                "Media {MediaAssetId} ritirato: resta assegnato a {Conteggio} prodotti "
                + "pubblicati sul sito ({Prodotti})",
                mediaAssetId, prodottiPubblicati.Count, string.Join(", ", prodottiPubblicati));
        }

        return asset;
    }

    /// <summary>
    /// Elimina record e file di un media non referenziato. Se è in uso, rifiuta con un errore
    /// che <b>nomina il referente</b>: "impossibile eliminare, è in uso" costringerebbe a
    /// cercarlo a mano, e la ricerca è esattamente l'informazione che il server già possiede.
    ///
    /// <para>🔴 <b>I referenti sono DUE, e la verifica di entrambi precede il disco.</b> Fino a
    /// questa change esisteva un solo referente — i prodotti — e l'ordine "① cancella i file, ②
    /// poi salva" era deliberato e giusto: se la cancellazione dei file fallisce, la riga resta e
    /// l'operazione è ripetibile. Con il secondo referente
    /// (<see cref="ImpostazioniVetrina.ImmagineOgId"/>, <c>DeleteBehavior.Restrict</c>) quello
    /// stesso ordine diventa un guasto: il ② solleverebbe un errore <b>grezzo di chiave
    /// esterna</b> dopo che il ① ha già cancellato gli otto file. Esito: riga presente, file
    /// spariti, immagine di anteprima rotta su ogni condivisione social, e un messaggio MySQL
    /// incomprensibile nell'interfaccia.</para>
    ///
    /// <para>⚠️ <b>L'ordine è la sostanza, non un dettaglio implementativo</b>, ed è ciò che il
    /// test pinna: un test che verificasse solo il rifiuto resterebbe verde <b>con i file già
    /// cancellati</b>, perché la foreign key rifiuta comunque — solo troppo tardi. L'asserzione
    /// che conta è quella sui file ancora sul filesystem.</para>
    /// </summary>
    public static async Task<bool> EliminaMediaAssetAsync(
        AppDbContext dbContext, IMediaStorage storage, int mediaAssetId)
    {
        MediaAsset asset = await dbContext.MediaAssets
            .FirstOrDefaultAsync(m => m.MediaAssetId == mediaAssetId)
            ?? throw new ExecutionError($"Media {mediaAssetId} non trovato.");

        // ── Referente 1: i prodotti (preesistente, invariato carattere per carattere) ─────
        List<string> inUso = await dbContext.Prodotti
            .Where(p => p.ImmagineId == mediaAssetId)
            .OrderBy(p => p.Codice)
            .Select(p => p.Nome)
            .ToListAsync();

        // ── Referente 2: l'immagine di anteprima social delle impostazioni del sito ──────
        // Nato con ImpostazioniVetrina. Si legge QUI, insieme all'altro e prima di qualunque
        // scrittura su disco, e non più in basso: fra questa riga e storage.EliminaAsync non
        // deve poter entrare nulla.
        bool usataComeOg = await dbContext.ImpostazioniVetrina
            .AnyAsync(impostazioni => impostazioni.ImmagineOgId == mediaAssetId);

        if (inUso.Count > 0)
        {
            throw new ExecutionError(
                $"L'immagine \"{asset.NomeOriginale}\" è usata da {inUso.Count} "
                + $"{(inUso.Count == 1 ? "prodotto" : "prodotti")}: {string.Join(", ", inUso)}. "
                + "Rimuovila prima da queste schede, poi riprova.");
        }

        if (usataComeOg)
        {
            // Stessa leggibilità del messaggio dei prodotti: nomina il media e dice cosa fare.
            throw new ExecutionError(
                $"L'immagine \"{asset.NomeOriginale}\" è l'immagine di anteprima social del "
                + "sito. Sostituiscila o rimuovila dalle impostazioni del sito, poi riprova.");
        }

        // Record e file se ne vanno insieme. L'ordine è deliberato: se la cancellazione dei
        // file fallisce, la riga resta e l'operazione è ripetibile; cancellando prima la riga
        // resterebbero file che nessuno sa più a chi appartenevano.
        await storage.EliminaAsync(asset.Chiave);

        dbContext.MediaAssets.Remove(asset);
        await dbContext.SaveChangesAsync();
        return true;
    }

    // ─────────────────────────────────────────────────────────────────────────────────────
    //  Impostazioni del sito
    // ─────────────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Scrive le impostazioni del sito con <b>assegnazione totale</b>, creando la riga se manca.
    ///
    /// <para>🔴 <b>Divergenza deliberata da <c>SettingsMutations.updateBusinessSettings</c></b>,
    /// che assegna sotto condizione (<c>if (!string.IsNullOrEmpty(input.X))</c>): il risultato
    /// di quello stile è che <b>un campo non si può svuotare</b> — si cancella il link Facebook,
    /// si salva, e il vecchio valore resta senza alcun errore. È un difetto reale del codice
    /// esistente e <b>non si importa qui</b>, dove i campi opzionali sono la maggioranza.</para>
    ///
    /// <para>L'assegnazione totale è sicura per la stessa ragione di
    /// <see cref="ApplicaCampiVetrinaAsync"/>: l'input possiede <b>esattamente</b> i campi
    /// scrivibili, quindi non c'è nulla da ricordarsi di preservare. E l'assenza ha <b>una sola
    /// rappresentazione</b> — stringa vuota e soli spazi diventano <c>null</c> — così nessun
    /// consumatore deve distinguerne le forme.</para>
    ///
    /// <para>⚠️ <b>Tutte le validazioni precedono qualunque tocco al change tracker</b>, non solo
    /// il <c>SaveChanges</c>: un rifiuto non deve lasciare né una scrittura parziale né
    /// un'entità agganciata al contesto in stato <c>Added</c>.</para>
    /// </summary>
    public static async Task<ImpostazioniVetrina> ApplicaImpostazioniVetrinaAsync(
        AppDbContext dbContext, ImpostazioniVetrinaInput input)
    {
        // ── Validazioni, tutte prima di leggere o creare la riga ─────────────────────────
        string oraTemaSera = Obbligatorio(input.OraInizioTemaSera);
        if (!FormatoOrario().IsMatch(oraTemaSera))
        {
            throw new ExecutionError(
                $"L'ora di inizio del tema serale \"{oraTemaSera}\" non è valida: serve la forma "
                + "\"HH:mm\" con i due punti, fra \"00:00\" e \"23:59\" — per esempio \"18:00\". "
                + "È lo stesso formato degli orari di apertura e chiusura.");
        }

        ValidaCoordinate(input.Latitudine, input.Longitudine);

        string? instagram = UrlSocialValidato(
            input.UrlInstagram, "Instagram", "https://www.instagram.com/2dgusto/");
        string? facebook = UrlSocialValidato(
            input.UrlFacebook, "Facebook", "https://www.facebook.com/2dgusto/");
        string? profiloGoogle = UrlSocialValidato(
            input.UrlProfiloGoogle, "Google", "https://maps.app.goo.gl/…");

        ValidaReputazione(input.PunteggioGoogle, input.NumeroRecensioniGoogle);

        await VerificaImmagineAssegnabileAsync(dbContext, input.ImmagineOgId);

        // ── Upsert sul singleton ─────────────────────────────────────────────────────────
        // Mai un FirstOrDefaultAsync() senza criterio: c'è una riga sola e il database lo impone
        // con un CHECK, quindi chiederla per identificativo è anche il modo di dire al lettore
        // che il singleton è un valore di dominio. La creazione serve all'installazione avviata
        // con SEED_ON_STARTUP=false, dove la tabella è vuota e il primo salvataggio è anche il
        // primo inserimento.
        ImpostazioniVetrina? impostazioni = await dbContext.ImpostazioniVetrina
            .FirstOrDefaultAsync(x => x.ImpostazioniVetrinaId == ImpostazioniVetrina.IdSingleton);

        if (impostazioni is null)
        {
            impostazioni = new ImpostazioniVetrina
            {
                ImpostazioniVetrinaId = ImpostazioniVetrina.IdSingleton,
            };
            dbContext.ImpostazioniVetrina.Add(impostazioni);
        }

        // ── ASSEGNAZIONE TOTALE ──────────────────────────────────────────────────────────
        // 🔴 Nessun `if (!string.IsNullOrEmpty(...))` qui dentro, oggi né mai: è la riga che
        //    renderebbe impossibile svuotare un campo, e la spec lo chiama per nome.
        impostazioni.InsegnaPubblica = Obbligatorio(input.InsegnaPubblica);
        impostazioni.Via = Obbligatorio(input.Via);
        impostazioni.Cap = Obbligatorio(input.Cap);
        impostazioni.Citta = Obbligatorio(input.Citta);
        impostazioni.Provincia = Obbligatorio(input.Provincia);
        impostazioni.Paese = Obbligatorio(input.Paese);

        impostazioni.Latitudine = input.Latitudine;
        impostazioni.Longitudine = input.Longitudine;

        impostazioni.Telefono = NullSeVuoto(input.Telefono);
        impostazioni.Email = NullSeVuoto(input.Email);
        impostazioni.UrlInstagram = instagram;
        impostazioni.UrlFacebook = facebook;

        impostazioni.MetaTitoloDefault = NullSeVuoto(input.MetaTitoloDefault);
        impostazioni.MetaDescrizioneDefault = NullSeVuoto(input.MetaDescrizioneDefault);
        impostazioni.ImmagineOgId = input.ImmagineOgId;

        impostazioni.OraInizioTemaSera = oraTemaSera;

        impostazioni.ClaimVetrina = NullSeVuoto(input.ClaimVetrina);
        impostazioni.StoriaTitolo = NullSeVuoto(input.StoriaTitolo);
        impostazioni.StoriaTesto = NullSeVuoto(input.StoriaTesto);
        impostazioni.AperitivoTitolo = NullSeVuoto(input.AperitivoTitolo);
        impostazioni.AperitivoTesto = NullSeVuoto(input.AperitivoTesto);
        impostazioni.AperitivoPunti = NullSeVuoto(input.AperitivoPunti);
        impostazioni.AperitivoCategorie = NullSeVuoto(input.AperitivoCategorie);

        impostazioni.PunteggioGoogle = input.PunteggioGoogle;
        impostazioni.NumeroRecensioniGoogle = input.NumeroRecensioniGoogle;
        impostazioni.UrlProfiloGoogle = profiloGoogle;

        impostazioni.PrenotazioniAttive = input.PrenotazioniAttive;
        impostazioni.PrenotazioniPreavvisoOre = input.PrenotazioniPreavvisoOre;
        impostazioni.PrenotazioniCopertiMax = input.PrenotazioniCopertiMax;
        impostazioni.TurnstileSiteKey = NullSeVuoto(input.TurnstileSiteKey);

        impostazioni.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        // Ricarica la navigazione: se l'immagine di anteprima è cambiata, quella in memoria è la
        // precedente e la risposta mostrerebbe l'immagine sbagliata.
        await dbContext.Entry(impostazioni).Reference(x => x.ImmagineOg).LoadAsync();
        return impostazioni;
    }

    /// <summary>
    /// 🔴 <b>O entrambe o nessuna delle due, e ciascuna nel proprio intervallo.</b> Mezza
    /// coordinata è un punto sull'equatore, cioè un dato <b>peggiore</b> di un dato mancante: una
    /// mappa che indica con sicurezza il posto sbagliato. L'appaiamento si verifica prima
    /// dell'intervallo perché su una coppia incompleta l'intervallo non ha nulla da dire.
    /// </summary>
    private static void ValidaCoordinate(decimal? latitudine, decimal? longitudine)
    {
        if (latitudine.HasValue != longitudine.HasValue)
        {
            throw new ExecutionError(
                "Latitudine e longitudine vanno inserite insieme, oppure lasciate entrambe "
                + "vuote: una sola delle due indica un punto sull'equatore, cioè un luogo "
                + "sbagliato mostrato con sicurezza. "
                + $"Ricevuta solo la {(latitudine.HasValue ? "latitudine" : "longitudine")}.");
        }

        if (latitudine is < -90 or > 90)
        {
            throw new ExecutionError(
                $"La latitudine {latitudine} è fuori intervallo: deve stare fra -90 e 90.");
        }

        if (longitudine is < -180 or > 180)
        {
            throw new ExecutionError(
                $"La longitudine {longitudine} è fuori intervallo: deve stare fra -180 e 180.");
        }
    }

    /// <summary>
    /// 🔴 <b>Punteggio e conteggio si valorizzano insieme o nessuno dei due</b>, per la stessa
    /// ragione delle coordinate: presi da soli non sono un dato incompleto, sono un dato
    /// <b>fuorviante</b>. «4,7» senza conteggio nasconde che le recensioni potrebbero essere tre;
    /// «180 recensioni» senza media nasconde che la media potrebbe essere 2,1. Il sito li mostra
    /// insieme, quindi è qui che l'appaiamento va imposto — non nel componente che li rende.
    /// </summary>
    private static void ValidaReputazione(decimal? punteggio, int? numero)
    {
        if (punteggio.HasValue != numero.HasValue)
        {
            throw new ExecutionError(
                "Il punteggio Google e il numero di recensioni vanno inseriti insieme, oppure "
                + "lasciati entrambi vuoti: una media senza conteggio, o un conteggio senza "
                + "media, dice al visitatore meno di quanto sembra. "
                + $"Ricevuto solo {(punteggio.HasValue ? "il punteggio" : "il numero")}.");
        }

        if (punteggio is < 1 or > 5)
        {
            throw new ExecutionError(
                $"Il punteggio Google {punteggio} è fuori intervallo: deve stare fra 1 e 5.");
        }

        if (numero is < 0)
        {
            throw new ExecutionError(
                $"Il numero di recensioni non può essere negativo (ricevuto {numero}).");
        }
    }

    /// <summary>
    /// Si persistono <b>URL completi e non identificativi utente</b>: così nessun consumatore
    /// deve sapere come si costruisce un indirizzo Instagram, e il <c>sameAs</c> dei dati
    /// strutturati del sito è una copia diretta invece di una ricomposizione.
    /// </summary>
    private static string? UrlSocialValidato(string? valore, string rete, string esempio)
    {
        string? url = NullSeVuoto(valore);
        if (url is null) return null;

        if (!Uri.TryCreate(url, UriKind.Absolute, out Uri? indirizzo)
            || (indirizzo.Scheme != Uri.UriSchemeHttp && indirizzo.Scheme != Uri.UriSchemeHttps))
        {
            throw new ExecutionError(
                $"Il link {rete} \"{url}\" non è un indirizzo completo: serve l'URL del profilo "
                + $"— per esempio \"{esempio}\" — e non il nome utente.");
        }

        return url;
    }

    /// <summary>
    /// Un'immagine assegnabile esiste ed è <b>pubblicata</b>. Sede <b>unica</b> della regola e
    /// del suo messaggio: la usano sia l'immagine di un prodotto sia l'immagine di anteprima
    /// social del sito.
    ///
    /// <para>⚠️ È il motivo per cui la formulazione non dice più "assegnata <i>a un prodotto</i>":
    /// due formulazioni diverse per la stessa regola sono <b>due regole</b>, agli occhi di chi
    /// legge il messaggio — e la variante specifica del prodotto sarebbe stata <b>falsa</b> nel
    /// caso dell'anteprima social. Si è tolta la clausola su entrambi i chiamanti insieme,
    /// invece di scriverne una seconda.</para>
    ///
    /// <para>L'errore è applicativo e leggibile, non il messaggio della foreign key MySQL: chi
    /// sta compilando una scheda deve capire cosa fare, non leggere un vincolo di
    /// integrità.</para>
    /// </summary>
    internal static async Task VerificaImmagineAssegnabileAsync(
        AppDbContext dbContext, int? immagineId)
    {
        if (immagineId is not int id) return;

        MediaAsset immagine = await dbContext.MediaAssets
            .FirstOrDefaultAsync(m => m.MediaAssetId == id)
            ?? throw new ExecutionError($"L'immagine {id} non esiste.");

        if (!immagine.Pubblicato)
        {
            throw new ExecutionError(
                $"L'immagine \"{immagine.NomeOriginale}\" non è pubblicata e non può essere "
                + "assegnata. Pubblicala dalla libreria media, oppure scegline un'altra.");
        }
    }

    internal static bool FocaleValida(string focale)
    {
        Match corrispondenza = FormatoFocale().Match(focale);
        return corrispondenza.Success
            && int.Parse(corrispondenza.Groups[1].Value) <= 100
            && int.Parse(corrispondenza.Groups[2].Value) <= 100;
    }

    private static string? NullSeVuoto(string? valore) =>
        string.IsNullOrWhiteSpace(valore) ? null : valore.Trim();

    /// <summary>
    /// Un campo obbligatorio non ha una forma "assente": lo schema GraphQL lo dichiara non
    /// nullable, quindi qui resta soltanto da normalizzare gli spazi. Stringa vuota e soli spazi
    /// collassano su <c>string.Empty</c> — <b>una</b> rappresentazione del vuoto anche qui.
    /// </summary>
    private static string Obbligatorio(string? valore) => NullSeVuoto(valore) ?? string.Empty;
}
