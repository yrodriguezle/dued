using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.SeedData;

/// <summary>
/// Porta in <b>vetrina</b> il listino caricato da <see cref="SeedProdottiListino"/>: senza questo
/// passaggio i 122 prodotti restano invisibili sul sito, perché <c>VisibileSulSito</c> nasce
/// <c>false</c> per costruzione — un prodotto non finisce online per il solo fatto di esistere.
///
/// <para>🔴 <b>OFF per default</b>, si abilita con <c>SEED_VETRINA_LISTINO=dryrun|1</c>. Scrive
/// su campi che hanno normalmente <b>un solo scrittore</b>, <c>mutateProdottoVetrina</c>: qui è
/// legittimo perché è un bootstrap una-tantum, ma proprio per questo tocca **solo** i prodotti
/// mai curati a mano — quelli con <c>CategoriaVetrina</c> nulla e <c>VisibileSulSito</c> falso.
/// Un prodotto già sistemato dall'amministratore non viene sfiorato, nemmeno per «migliorarlo».</para>
///
/// <para><b>L'ordinamento non è un vezzo.</b> Le categorie del menu pubblico non hanno un ordine
/// proprio: il sito le dispone per il <b>minimo</b> <c>OrdinamentoVetrina</c> dei prodotti che
/// contengono. Senza numeri espliciti escono in ordine alfabetico — «Aperitivo, Bibite,
/// Caffetteria…», cioè la giornata al contrario. Le basi qui sotto sono distanziate di 100 per
/// lasciare spazio a categorie future senza rinumerare tutto.</para>
///
/// <para>⚠️ I nomi di vetrina sono <b>case-sensitive</b> per il raggruppamento del sito
/// (<c>StringComparer.Ordinal</c>), al contrario del confronto di MySQL che è
/// case-insensitive: «Cucina» e «CUCINA» sarebbero <b>due intestazioni distinte</b> online pur
/// sembrando la stessa cosa in una query. Per questo qui la forma è una sola, decisa in un
/// posto solo.</para>
/// </summary>
public static class SeedVetrinaListino
{
    private readonly record struct Vetrina(string Nome, int Base);

    /// <summary>
    /// Categoria di cassa → categoria di vetrina e base di ordinamento. La categoria contabile
    /// serve ai raggruppamenti di cassa, questa è come il prodotto viene presentato al cliente:
    /// sono due domini, e il sito non ricade <b>mai</b> sulla prima.
    /// </summary>
    private static readonly Dictionary<string, Vetrina> PerCategoria = new(StringComparer.OrdinalIgnoreCase)
    {
        ["BRIOCHES"] = new("Colazione", 100),
        ["CAFFETTERIA"] = new("Caffetteria", 200),
        ["CUCINA"] = new("Cucina", 300),
        ["APERITIVO"] = new("Aperitivo", 400),
        ["COCKTAIL"] = new("Cocktail", 500),
        ["BIRRA"] = new("Birre", 600),
        ["VINO"] = new("Vini", 700),
        ["PROSECCO"] = new("Bollicine", 800),
        ["BIBITE"] = new("Bibite", 900),
        ["LIQUORI"] = new("Amari e liquori", 1000),
    };

    /// <summary>
    /// Non sono piatti, sono <b>modificatori</b> di un piatto: un menu che elencasse «Aggiunta
    /// verdure € 0,50» fra le portate direbbe al cliente una cosa che non può ordinare da sola.
    /// Restano in anagrafica — si vendono in cassa — ma fuori dalla vetrina.
    /// </summary>
    private static readonly HashSet<string> FuoriVetrina = new(StringComparer.OrdinalIgnoreCase)
    {
        "CUC-AGGIUNTA-PROTEINE",
        "CUC-AGGIUNTA-VERDURE",
    };

    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        string? modalita = Environment.GetEnvironmentVariable("SEED_VETRINA_LISTINO")?.ToLowerInvariant();
        if (modalita != "dryrun" && modalita != "1")
        {
            return;
        }

        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        ILogger logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
            .CreateLogger(typeof(SeedVetrinaListino));

        // Solo i mai curati: CategoriaVetrina nulla E non già pubblicati. È la condizione che
        // rende questo seeder ripetibile senza calpestare il lavoro editoriale di nessuno.
        List<Prodotto> candidati = await dbContext.Prodotti
            .Where(p => p.CategoriaVetrina == null && !p.VisibileSulSito)
            .OrderBy(p => p.ProdottoId)
            .ToListAsync();

        var daPubblicare = candidati
            .Where(p => p.Categoria != null
                && PerCategoria.ContainsKey(p.Categoria)
                && !FuoriVetrina.Contains(p.Codice))
            .GroupBy(p => p.Categoria!)
            .SelectMany(gruppo => gruppo.Select((p, indice) => (Prodotto: p, Vetrina: PerCategoria[gruppo.Key], Indice: indice)))
            .ToList();

        int esclusi = candidati.Count - daPubblicare.Count;
        logger.LogInformation(
            "Vetrina listino [{Modalita}]: {Candidati} prodotti mai curati, {DaPubblicare} da pubblicare, {Esclusi} lasciati fuori (modificatori o categoria non mappata).",
            modalita, candidati.Count, daPubblicare.Count, esclusi);

        if (daPubblicare.Count == 0)
        {
            return;
        }

        if (modalita == "dryrun")
        {
            daPubblicare
                .GroupBy(x => x.Vetrina.Nome)
                .OrderBy(g => g.Min(x => x.Vetrina.Base))
                .ToList()
                .ForEach(g => logger.LogInformation(
                    "  [dryrun] {Categoria} (da {Base}): {Quanti} prodotti",
                    g.Key, g.Min(x => x.Vetrina.Base), g.Count()));
            return;
        }

        DateTime adesso = DateTime.UtcNow;
        daPubblicare.ForEach(x =>
        {
            x.Prodotto.VisibileSulSito = true;
            x.Prodotto.CategoriaVetrina = x.Vetrina.Nome;
            x.Prodotto.OrdinamentoVetrina = x.Vetrina.Base + x.Indice;
            // ⚠️ NomeVetrina e PrezzoVetrina restano nulli di proposito: il sito ricade da sé su
            //    Nome e Prezzo di cassa, e il fallback è dinamico — un ritocco di listino si
            //    riflette online senza che nessuno riscriva niente in vetrina. Copiarli qui
            //    creerebbe una seconda verità destinata a divergere al primo cambio di prezzo.
            //    DescrizioneVetrina resta nulla perché NON ha fallback: va scritta a mano, ed è
            //    lavoro editoriale, non configurazione.
            x.Prodotto.UpdatedAt = adesso;
        });

        await dbContext.SaveChangesAsync();
        logger.LogInformation("Vetrina listino: {Quanti} prodotti pubblicati in {Categorie} categorie.",
            daPubblicare.Count, daPubblicare.Select(x => x.Vetrina.Nome).Distinct().Count());
    }
}
