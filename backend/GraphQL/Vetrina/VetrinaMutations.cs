using System.Text.RegularExpressions;

using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

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

    private static int UtenteCorrenteId(IResolveFieldContext<object?> context)
    {
        JwtHelper jwtHelper = GraphQLService.GetService<JwtHelper>(context);
        GraphQLUserContext userContext = context.UserContext as GraphQLUserContext
            ?? throw new ExecutionError("Utente non autenticato");
        return jwtHelper.GetUserID(userContext.Principal!);
    }

    private static Task GuardAmministratore(IResolveFieldContext<object?> context, AppDbContext dbContext) =>
        GestioneCassaGuards.GuardUtenteAmministratore(dbContext, UtenteCorrenteId(context));

    public VetrinaMutations()
    {
        this.Authorize();

        Field<ProdottoType>("mutateProdottoVetrina")
            .Argument<NonNullGraphType<IntGraphType>>("prodottoId", "Prodotto ESISTENTE da arricchire")
            .Argument<NonNullGraphType<ProdottoVetrinaInputType>>("input", "I dieci campi vetrina")
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
    }

    /// <summary>
    /// Scrive i dieci campi vetrina di un prodotto <b>esistente</b>. Nessun ramo di creazione,
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

        if (input.ImmagineId is int immagineId)
        {
            // Errore applicativo leggibile, non il messaggio della foreign key MySQL: chi sta
            // compilando una scheda deve capire cosa fare, non leggere un vincolo di integrità.
            MediaAsset immagine = await dbContext.MediaAssets
                .FirstOrDefaultAsync(m => m.MediaAssetId == immagineId)
                ?? throw new ExecutionError($"L'immagine {immagineId} non esiste.");

            if (!immagine.Pubblicato)
            {
                throw new ExecutionError(
                    $"L'immagine \"{immagine.NomeOriginale}\" non è pubblicata e non può essere "
                    + "assegnata a un prodotto. Pubblicala dalla libreria media, oppure "
                    + "scegline un'altra.");
            }
        }

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
                .Where(p => p.ImmagineId == mediaAssetId && p.Attivo && p.VisibileSulSito)
                .OrderBy(p => p.Codice)
                .Select(p => p.Nome)
                .ToListAsync();
        }

        asset.TestoAlternativo = NullSeVuoto(input.TestoAlternativo);
        asset.Didascalia = NullSeVuoto(input.Didascalia);
        asset.Focale = focale;
        asset.Cartella = string.IsNullOrWhiteSpace(input.Cartella) ? "generale" : input.Cartella.Trim();
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
    /// che <b>nomina i prodotti</b>: "impossibile eliminare, è in uso" costringerebbe a
    /// cercarli a mano, e la ricerca è esattamente l'informazione che il server già possiede.
    /// </summary>
    public static async Task<bool> EliminaMediaAssetAsync(
        AppDbContext dbContext, IMediaStorage storage, int mediaAssetId)
    {
        MediaAsset asset = await dbContext.MediaAssets
            .FirstOrDefaultAsync(m => m.MediaAssetId == mediaAssetId)
            ?? throw new ExecutionError($"Media {mediaAssetId} non trovato.");

        List<string> inUso = await dbContext.Prodotti
            .Where(p => p.ImmagineId == mediaAssetId)
            .OrderBy(p => p.Codice)
            .Select(p => p.Nome)
            .ToListAsync();

        if (inUso.Count > 0)
        {
            throw new ExecutionError(
                $"L'immagine \"{asset.NomeOriginale}\" è usata da {inUso.Count} "
                + $"{(inUso.Count == 1 ? "prodotto" : "prodotti")}: {string.Join(", ", inUso)}. "
                + "Rimuovila prima da queste schede, poi riprova.");
        }

        // Record e file se ne vanno insieme. L'ordine è deliberato: se la cancellazione dei
        // file fallisce, la riga resta e l'operazione è ripetibile; cancellando prima la riga
        // resterebbero file che nessuno sa più a chi appartenevano.
        await storage.EliminaAsync(asset.Chiave);

        dbContext.MediaAssets.Remove(asset);
        await dbContext.SaveChangesAsync();
        return true;
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
}
