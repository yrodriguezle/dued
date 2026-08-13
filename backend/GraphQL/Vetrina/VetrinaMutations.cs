using System.Text.RegularExpressions;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

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

        // ── Le QUATTRO scritture della vetrina, una per scheda ────────────────────────────
        //
        // 🔴 Quattro mutation e non una, ognuna ad assegnazione totale sul PROPRIO sottoinsieme
        //    disgiunto. L'assegnazione totale — la riga che permette di svuotare un campo —
        //    sopravvive intatta dentro ognuna; ciò che sparisce è la SOVRAPPOSIZIONE fra scheda
        //    e scheda. Con una mutation sola, una scheda che mostra quattro campi su trenta ne
        //    azzererebbe ventisei a ogni salvataggio, senza errore e senza sintomo.
        //
        // ⚠️ Il tipo di ritorno è UNO SOLO, ImpostazioniVetrinaType: la divisione riguarda la
        //    scrittura, non la lettura. Quattro tipi di output vorrebbero dire quattro fragment,
        //    quattro refetch e quattro copie in cache della stessa riga singleton.
        //
        // ⚠️ Ogni resolver ha GuardAmministratore come PRIMA istruzione, prima di qualunque
        //    lettura: un rifiuto non deve poter rivelare nulla dello stato.

        Field<ImpostazioniVetrinaType>("mutateImpostazioniVetrina")
            .Argument<NonNullGraphType<ImpostazioniVetrinaInputType>>(
                "input", "I venti campi trasversali del sito: l'assegnazione è totale")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                await GuardAmministratore(context, dbContext);

                return await ApplicaImpostazioniVetrinaAsync(
                    dbContext,
                    context.GetArgument<ImpostazioniVetrinaInput>("input"));
            });

        Field<ImpostazioniVetrinaType>("mutatePaginaHome")
            .Argument<NonNullGraphType<PaginaHomeInputType>>(
                "input", "I campi della pagina Home: l'assegnazione è totale su questi e solo su questi")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                await GuardAmministratore(context, dbContext);

                return await ApplicaPaginaHomeAsync(
                    dbContext, context.GetArgument<PaginaHomeInput>("input"));
            });

        Field<ImpostazioniVetrinaType>("mutatePaginaLocale")
            .Argument<NonNullGraphType<PaginaLocaleInputType>>(
                "input", "I campi della pagina «Il locale»: l'assegnazione è totale su questi e solo su questi")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                await GuardAmministratore(context, dbContext);

                return await ApplicaPaginaLocaleAsync(
                    dbContext, context.GetArgument<PaginaLocaleInput>("input"));
            });

        Field<ImpostazioniVetrinaType>("mutatePaginaAperitivo")
            .Argument<NonNullGraphType<PaginaAperitivoInputType>>(
                "input", "I campi della pagina «Aperitivo»: l'assegnazione è totale su questi e solo su questi")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                await GuardAmministratore(context, dbContext);

                return await ApplicaPaginaAperitivoAsync(
                    dbContext, context.GetArgument<PaginaAperitivoInput>("input"));
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
    /// <para>🔴 <b>I referenti sono CINQUE, e la verifica di tutti precede il disco.</b> Il
    /// primo sono i <b>prodotti</b>; gli altri quattro sono gli <b>slot immagine delle
    /// impostazioni del sito</b> — l'anteprima social
    /// (<see cref="ImpostazioniVetrina.ImmagineOgId"/>) e i tre slot di pagina
    /// (<see cref="ImpostazioniVetrina.ImmagineEroeHomeId"/>,
    /// <see cref="ImpostazioniVetrina.ImmagineRitrattoLocaleId"/>,
    /// <see cref="ImpostazioniVetrina.ImmagineEroeAperitivoId"/>), tutti con
    /// <c>DeleteBehavior.Restrict</c>. Il conteggio è scritto qui perché questa docstring è la
    /// sola documentazione del metodo: quando diceva "DUE" e i referenti erano già quattro,
    /// sarebbe stata una descrizione <b>falsa</b> nel punto in cui si va a leggere per capire
    /// cosa proteggere.</para>
    ///
    /// <para>All'origine esisteva un solo referente — i prodotti — e l'ordine "① cancella i file,
    /// ② poi salva" era deliberato e giusto: se la cancellazione dei file fallisce, la riga resta
    /// e l'operazione è ripetibile. Con un referente in chiave esterna quello stesso ordine
    /// diventa un guasto: il ② solleverebbe un errore <b>grezzo di chiave esterna</b> dopo che il
    /// ① ha già cancellato gli otto file. Esito: riga presente, file spariti, immagine rotta su
    /// una pagina del sito, e un messaggio MySQL incomprensibile nell'interfaccia.</para>
    ///
    /// <para>⚠️ <b>L'ordine è la sostanza, non un dettaglio implementativo</b>, ed è ciò che il
    /// test pinna: un test che verificasse solo il rifiuto resterebbe verde <b>con i file già
    /// cancellati</b>, perché la foreign key rifiuta comunque — solo troppo tardi. L'asserzione
    /// che conta è quella sui file ancora sul filesystem. Fra la lettura dei referenti e
    /// <c>storage.EliminaAsync</c> non deve poter entrare nulla.</para>
    ///
    /// <para>🔴 <b>Il messaggio nomina il RUOLO, non la colonna.</b> "ImmagineRitrattoLocaleId"
    /// non dice a nessuno dove andare a togliere il riferimento; <i>«il ritratto della pagina Il
    /// locale»</i> sì. È la stessa ragione per cui l'errore dei prodotti li elenca per nome
    /// invece di dire "è in uso".</para>
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

        // ── Referenti 2-5: i quattro slot immagine delle impostazioni del sito ──────────
        // L'anteprima social (nata con ImpostazioniVetrina) e i tre slot di pagina. Si leggono
        // QUI, insieme all'altro e prima di qualunque scrittura su disco, e non più in basso:
        // fra questa riga e storage.EliminaAsync non deve poter entrare nulla.
        //
        // 🔴 UNA query sola, che restituisce già il RUOLO in prosa invece di quattro booleani da
        //    ricomporre in un messaggio: quattro AnyAsync sarebbero quattro giri sul database e,
        //    soprattutto, quattro occasioni di dimenticarne uno nel ramo che formatta l'errore.
        //    La riga è una sola (singleton), quindi l'ordine dei casi conta solo quando la stessa
        //    foto ricopre più ruoli: si nomina il primo, e chi lo toglie riesegue e trova il
        //    successivo.
        string? ruoloOccupato = await dbContext.ImpostazioniVetrina
            .Where(impostazioni => impostazioni.ImmagineOgId == mediaAssetId
                || impostazioni.ImmagineEroeHomeId == mediaAssetId
                || impostazioni.ImmagineRitrattoLocaleId == mediaAssetId
                || impostazioni.ImmagineEroeAperitivoId == mediaAssetId)
            .Select(impostazioni => impostazioni.ImmagineOgId == mediaAssetId
                ? "l'immagine di anteprima social del sito"
                : impostazioni.ImmagineEroeHomeId == mediaAssetId
                    ? "l'immagine grande della pagina Home"
                    : impostazioni.ImmagineRitrattoLocaleId == mediaAssetId
                        ? "il ritratto della pagina «Il locale»"
                        : "l'immagine grande della pagina «Aperitivo»")
            .FirstOrDefaultAsync();

        if (inUso.Count > 0)
        {
            throw new ExecutionError(
                $"L'immagine \"{asset.NomeOriginale}\" è usata da {inUso.Count} "
                + $"{(inUso.Count == 1 ? "prodotto" : "prodotti")}: {string.Join(", ", inUso)}. "
                + "Rimuovila prima da queste schede, poi riprova.");
        }

        if (ruoloOccupato is not null)
        {
            // Stessa leggibilità del messaggio dei prodotti: nomina il media, dice quale ruolo
            // ricopre e cosa fare.
            throw new ExecutionError(
                $"L'immagine \"{asset.NomeOriginale}\" è {ruoloOccupato}. "
                + "Sostituiscila o rimuovila dalle impostazioni del sito, poi riprova.");
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
    /// La riga, letta <b>per identificativo</b> e creata se manca.
    ///
    /// <para>🔴 <b>Sede UNICA dell'upsert</b>: le quattro scritture della vetrina la chiamano
    /// tutte, e nessuna ha un proprio <c>FirstOrDefaultAsync</c>. Quattro copie della stessa
    /// lettura sarebbero quattro posti in cui un giorno la costante di dominio viene sostituita
    /// da un <c>FirstOrDefault()</c> senza criterio — che funziona finché la tabella ha una riga
    /// sola, cioè finché non serve.</para>
    ///
    /// <para>Mai un <c>FirstOrDefaultAsync()</c> senza criterio: c'è una riga sola e il database
    /// lo impone con un <c>CHECK</c>, quindi chiederla per identificativo è anche il modo di dire
    /// al lettore che il singleton è un valore di dominio. La creazione serve all'installazione
    /// avviata con <c>SEED_ON_STARTUP=false</c>, dove la tabella è vuota e il primo salvataggio è
    /// anche il primo inserimento.</para>
    ///
    /// <para>⚠️ <b>Va chiamata DOPO le validazioni</b>, non prima: aggancia al change tracker
    /// un'entità in stato <c>Added</c>, e un rifiuto successivo la lascerebbe lì.</para>
    /// </summary>
    private static async Task<ImpostazioniVetrina> CaricaOCreaSingletonAsync(AppDbContext dbContext)
    {
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

        return impostazioni;
    }

    /// <summary>
    /// Ricarica le <b>quattro</b> navigazioni immagine dopo un salvataggio, e le ricarica tutte
    /// e quattro da <b>ognuna</b> delle quattro scritture.
    ///
    /// <para>⚠️ <b>Non è una comodità: il tipo di ritorno è uno solo.</b> Le quattro mutation
    /// rendono <c>ImpostazioniVetrina</c>, e il client legge lo stesso fragment da tutte e
    /// quattro — quindi una risposta che portasse a casa solo la navigazione del proprio slot
    /// scriverebbe <c>null</c> in cache sugli altri tre. Il lazy loading è disattivato in questo
    /// progetto, quindi una navigazione non caricata <b>non solleva alcun errore</b>: il campo
    /// risponde <c>null</c>, che è indistinguibile da «non ancora scelta».</para>
    /// </summary>
    private static async Task RicaricaImmaginiAsync(
        AppDbContext dbContext, ImpostazioniVetrina impostazioni)
    {
        EntityEntry<ImpostazioniVetrina> voce = dbContext.Entry(impostazioni);
        await voce.Reference(x => x.ImmagineOg).LoadAsync();
        await voce.Reference(x => x.ImmagineEroeHome).LoadAsync();
        await voce.Reference(x => x.ImmagineRitrattoLocale).LoadAsync();
        await voce.Reference(x => x.ImmagineEroeAperitivo).LoadAsync();
    }

    /// <summary>
    /// Scrive i <b>venti campi trasversali</b> del sito con <b>assegnazione totale</b>, creando la
    /// riga se manca: identità, indirizzo, coordinate, contatti, social, SEO di default, anteprima
    /// social, aspetto e ganci spenti.
    ///
    /// <para>🔴 <b>Divergenza deliberata da <c>SettingsMutations.updateBusinessSettings</c></b>,
    /// che assegna sotto condizione (<c>if (!string.IsNullOrEmpty(input.X))</c>): il risultato
    /// di quello stile è che <b>un campo non si può svuotare</b> — si cancella il link Facebook,
    /// si salva, e il vecchio valore resta senza alcun errore. È un difetto reale del codice
    /// esistente e <b>non si importa qui</b>, dove i campi opzionali sono la maggioranza.</para>
    ///
    /// <para>🔴 <b>Perché l'assegnazione totale resta sicura dopo la divisione in quattro.</b> La
    /// ragione non è più «l'input possiede tutti i campi scrivibili» — non è più vero — ma la sua
    /// forma <b>locale</b>: <i>l'input possiede esattamente i campi scrivibili di questa scheda,
    /// quindi non c'è nulla da preservare e quindi nessuna ragione di assegnare sotto
    /// condizione.</i> A garantirlo è la partizione totale e disgiunta, verificata per riflessione
    /// in <c>ImpostazioniVetrinaTests</c>: senza quella verifica questa docstring sarebbe una
    /// speranza. E l'assenza ha <b>una sola rappresentazione</b> — stringa vuota e soli spazi
    /// diventano <c>null</c> — così nessun consumatore deve distinguerne le forme.</para>
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

        // 🔴 Unico chiamante di ValidaCoordinate, e non per caso: le due coordinate sono un
        //    grappolo a validazione incrociata e stanno perciò nello STESSO input. I due membri
        //    su due schede diverse renderebbero la regola «insieme o nessuna delle due»
        //    impossibile da valutare al momento del salvataggio.
        ValidaCoordinate(input.Latitudine, input.Longitudine);

        string? instagram = UrlSocialValidato(
            input.UrlInstagram, "Instagram", "https://www.instagram.com/2dgusto/");
        string? facebook = UrlSocialValidato(
            input.UrlFacebook, "Facebook", "https://www.facebook.com/2dgusto/");

        await VerificaImmagineAssegnabileAsync(dbContext, input.ImmagineOgId);

        ImpostazioniVetrina impostazioni = await CaricaOCreaSingletonAsync(dbContext);

        // ── ASSEGNAZIONE TOTALE, sui venti campi di QUESTA scheda ────────────────────────
        // 🔴 Nessun `if (!string.IsNullOrEmpty(...))` qui dentro, oggi né mai: è la riga che
        //    renderebbe impossibile svuotare un campo, e la spec lo chiama per nome.
        //
        // 🔴 E nessuna assegnazione ai campi delle altre tre schede: non compaiono qui perché
        //    l'input non li possiede, quindi non c'è modo di scriverli nemmeno sbagliando. È la
        //    forma che rende la disgiunzione una proprietà del codice invece che una disciplina.
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

        impostazioni.PrenotazioniAttive = input.PrenotazioniAttive;
        impostazioni.PrenotazioniPreavvisoOre = input.PrenotazioniPreavvisoOre;
        impostazioni.PrenotazioniCopertiMax = input.PrenotazioniCopertiMax;
        impostazioni.TurnstileSiteKey = NullSeVuoto(input.TurnstileSiteKey);

        impostazioni.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        // Ricarica le navigazioni: se l'immagine di anteprima è cambiata, quella in memoria è la
        // precedente e la risposta mostrerebbe l'immagine sbagliata.
        await RicaricaImmaginiAsync(dbContext, impostazioni);
        return impostazioni;
    }

    /// <summary>
    /// Scrive i campi della pagina <b>Home</b> con assegnazione totale sul proprio sottoinsieme:
    /// il paragrafo sotto il titolo, il grappolo della reputazione e lo slot dell'immagine grande.
    ///
    /// <para>🔴 <b>Nessuna assegnazione condizionale</b>, per la stessa ragione delle altre tre
    /// scritture, riscritta perché qui è <b>locale</b>: l'input possiede esattamente i campi
    /// scrivibili di questa scheda, quindi non c'è nulla da preservare e quindi nessuna ragione di
    /// assegnare sotto condizione. Nessun <c>if (!string.IsNullOrEmpty(...))</c>, oggi né mai.
    /// Salvare questa scheda <b>non tocca</b> la storia del locale, i testi dell'aperitivo né la
    /// chiave del servizio antispam: non sono nominabili da qui.</para>
    ///
    /// <para>🔴 Unico chiamante di <see cref="ValidaReputazione"/>: punteggio e conteggio sono un
    /// grappolo a validazione incrociata e stanno perciò nello stesso input, insieme all'URL del
    /// profilo che li accompagna. Il blocco reputazione si rende solo sulla home.</para>
    /// </summary>
    public static async Task<ImpostazioniVetrina> ApplicaPaginaHomeAsync(
        AppDbContext dbContext, PaginaHomeInput input)
    {
        // ── Validazioni, tutte prima di leggere o creare la riga ─────────────────────────
        string? profiloGoogle = UrlSocialValidato(
            input.UrlProfiloGoogle, "Google", "https://maps.app.goo.gl/…");

        ValidaReputazione(input.PunteggioGoogle, input.NumeroRecensioniGoogle);

        // La stessa regola «esiste ed è pubblicata» dell'anteprima social e dell'immagine di un
        // prodotto: si chiama la sede unica, non si riscrive.
        await VerificaImmagineAssegnabileAsync(dbContext, input.ImmagineEroeHomeId);

        ImpostazioniVetrina impostazioni = await CaricaOCreaSingletonAsync(dbContext);

        // ── ASSEGNAZIONE TOTALE, sui cinque campi di QUESTA scheda ──────────────────────
        impostazioni.ClaimVetrina = NullSeVuoto(input.ClaimVetrina);

        impostazioni.PunteggioGoogle = input.PunteggioGoogle;
        impostazioni.NumeroRecensioniGoogle = input.NumeroRecensioniGoogle;
        impostazioni.UrlProfiloGoogle = profiloGoogle;

        impostazioni.ImmagineEroeHomeId = input.ImmagineEroeHomeId;

        impostazioni.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        await RicaricaImmaginiAsync(dbContext, impostazioni);
        return impostazioni;
    }

    /// <summary>
    /// Scrive i campi della pagina <b>«Il locale»</b> con assegnazione totale sul proprio
    /// sottoinsieme: titolo e testo della storia, e lo slot del ritratto.
    ///
    /// <para>🔴 <b>Nessuna assegnazione condizionale</b>, e qui la conseguenza è particolarmente
    /// visibile: svuotare <c>storiaTesto</c> <b>fa sparire una pagina dal sito</b> — 404,
    /// navigazione e sitemap — ed è un'operazione voluta, non un incidente da impedire. Una forma
    /// condizionata la renderebbe impossibile senza dirlo. L'input possiede esattamente i campi di
    /// questa scheda, quindi non c'è nulla da preservare.</para>
    /// </summary>
    public static async Task<ImpostazioniVetrina> ApplicaPaginaLocaleAsync(
        AppDbContext dbContext, PaginaLocaleInput input)
    {
        // ── Validazioni, tutte prima di leggere o creare la riga ─────────────────────────
        await VerificaImmagineAssegnabileAsync(dbContext, input.ImmagineRitrattoLocaleId);

        ImpostazioniVetrina impostazioni = await CaricaOCreaSingletonAsync(dbContext);

        // ── ASSEGNAZIONE TOTALE, sui tre campi di QUESTA scheda ─────────────────────────
        impostazioni.StoriaTitolo = NullSeVuoto(input.StoriaTitolo);
        impostazioni.StoriaTesto = NullSeVuoto(input.StoriaTesto);

        impostazioni.ImmagineRitrattoLocaleId = input.ImmagineRitrattoLocaleId;

        impostazioni.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        await RicaricaImmaginiAsync(dbContext, impostazioni);
        return impostazioni;
    }

    /// <summary>
    /// Scrive i campi della pagina <b>«Aperitivo»</b> con assegnazione totale sul proprio
    /// sottoinsieme: titolo, testo, punti, categorie e lo slot dell'immagine grande.
    ///
    /// <para>🔴 <b>Nessuna assegnazione condizionale</b>, stessa ragione locale delle altre tre.
    /// Questi quattro testi sono <b>letti dalla home</b> ma <b>posseduti qui</b>: è il caso che
    /// rende falsa la regola «un campo, una pagina» e vera quella «un campo, un proprietario». La
    /// scheda Home li mostra in sola lettura e non ha alcun modo di scriverli, perché
    /// <c>PaginaHomeInput</c> non li nomina.</para>
    /// </summary>
    public static async Task<ImpostazioniVetrina> ApplicaPaginaAperitivoAsync(
        AppDbContext dbContext, PaginaAperitivoInput input)
    {
        // ── Validazioni, tutte prima di leggere o creare la riga ─────────────────────────
        await VerificaImmagineAssegnabileAsync(dbContext, input.ImmagineEroeAperitivoId);

        ImpostazioniVetrina impostazioni = await CaricaOCreaSingletonAsync(dbContext);

        // ── ASSEGNAZIONE TOTALE, sui cinque campi di QUESTA scheda ──────────────────────
        impostazioni.AperitivoTitolo = NullSeVuoto(input.AperitivoTitolo);
        impostazioni.AperitivoTesto = NullSeVuoto(input.AperitivoTesto);
        // ⚠️ Le due aree «una voce per riga» NON si normalizzano qui: si persiste ciò che è
        //    stato scritto, e le righe vuote le toglie il DTO pubblico. Ripulirle in due posti
        //    significherebbe due regole di pulizia che un giorno divergono.
        impostazioni.AperitivoPunti = NullSeVuoto(input.AperitivoPunti);
        impostazioni.AperitivoCategorie = NullSeVuoto(input.AperitivoCategorie);

        impostazioni.ImmagineEroeAperitivoId = input.ImmagineEroeAperitivoId;

        impostazioni.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        await RicaricaImmaginiAsync(dbContext, impostazioni);
        return impostazioni;
    }

    /// <summary>
    /// 🔴 <b>O entrambe o nessuna delle due, e ciascuna nel proprio intervallo.</b> Mezza
    /// coordinata è un punto sull'equatore, cioè un dato <b>peggiore</b> di un dato mancante: una
    /// mappa che indica con sicurezza il posto sbagliato. L'appaiamento si verifica prima
    /// dell'intervallo perché su una coppia incompleta l'intervallo non ha nulla da dire.
    ///
    /// <para>🔴 <b>Ha un solo chiamante</b>, <see cref="ApplicaImpostazioniVetrinaAsync"/>, ed è
    /// una proprietà da conservare: latitudine e longitudine appartengono entrambe alla scheda
    /// «Impostazioni sito» proprio perché una regola incrociata i cui due membri stiano su due
    /// input diversi non è valutabile al momento del salvataggio — il canale che scrive l'una non
    /// vedrebbe l'altra. Se un giorno questa funzione avesse due chiamanti, la coppia sarebbe
    /// stata separata e la regola sarebbe già rotta.</para>
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
    ///
    /// <para>🔴 <b>Ha un solo chiamante</b>, <see cref="ApplicaPaginaHomeAsync"/>: con questa
    /// change è <b>cambiato di chiamante, non di forma</b>. I due numeri si rendono soltanto sulla
    /// home, quindi appartengono alla sua scheda — e ci appartengono <b>insieme</b>, per la stessa
    /// ragione delle coordinate: due membri di una coppia su due input diversi renderebbero la
    /// regola impossibile da valutare al salvataggio.</para>
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
    /// del suo messaggio, con <b>cinque</b> chiamanti: l'immagine di un prodotto, l'anteprima
    /// social del sito e i tre slot di pagina (eroe della home, ritratto del locale, eroe
    /// dell'aperitivo), uno per ciascuna delle tre mutation di pagina.
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
