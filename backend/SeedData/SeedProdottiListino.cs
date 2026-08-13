using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.SeedData;

/// <summary>
/// Caricamento una-tantum del listino 2026 dal foglio <c>docs/2026ListinoPrezzi.xlsx</c>
/// (foglio «Listino», righe 1–63): 122 prodotti in 10 categorie.
///
/// <para>🔴 <b>OFF per default</b>, si abilita con <c>SEED_LISTINO_2026=dryrun|1</c>. Non è
/// prudenza di rito: il <c>Codice</c> è univoco e <b>non esiste alcuna mutation che elimini un
/// prodotto</b> — le vendite lo referenziano con <c>DeleteBehavior.Restrict</c>. Un caricamento
/// partito per sbaglio su un database sbagliato non si annulla dall'applicazione, si annulla
/// con SQL diretto.</para>
///
/// <para><b>Idempotente e non distruttivo</b>: salta i codici già presenti e non tocca mai una
/// riga esistente. Se l'amministratore ha corretto un prezzo dalla pagina Prodotti, un riavvio
/// non glielo riscrive — che è la ragione per cui questo seeder aggiunge e basta.</para>
///
/// <para>Le categorie, con i conteggi attesi:</para>
/// <list type="bullet">
/// /// <item><description>BRIOCHES — 14</description></item>
/// /// <item><description>CAFFETTERIA — 30</description></item>
/// /// <item><description>BIRRA — 14</description></item>
/// /// <item><description>VINO — 9</description></item>
/// /// <item><description>PROSECCO — 9</description></item>
/// /// <item><description>APERITIVO — 12</description></item>
/// /// <item><description>BIBITE — 11</description></item>
/// /// <item><description>LIQUORI — 1</description></item>
/// /// <item><description>COCKTAIL — 7</description></item>
/// /// <item><description>CUCINA — 15</description></item>
/// </list>
///
/// <para>⚠️ Tre voci del foglio restano <b>fuori</b>, in attesa di decisione: <c>GRAPPA</c>, che
/// ha due importi in una cella sola («€ 3 / 4»), e le righe 49–50, che hanno un prezzo di 2,50
/// e nessun nome. Non sono state dimenticate: non sono caricabili senza inventarne il nome o
/// sceglierne il prezzo.</para>
///
/// <para>⚠️ I campi di <b>vetrina</b> restano tutti al loro default, e <c>VisibileSulSito</c>
/// quindi a <c>false</c>: caricare il listino <b>non pubblica niente</b> sul sito. La scelta di
/// che cosa va online, con quale categoria e quale foto, è lavoro editoriale e si fa dalla
/// pagina «Prodotti vetrina».</para>
/// </summary>
public static class SeedProdottiListino
{
    private readonly record struct Voce(string Codice, string Nome, decimal Prezzo, string Categoria);

    /// <summary>
    /// L'aliquota di <b>tutto</b> il listino del locale. Non è il default del modello (22%):
    /// è una decisione presa sul listino reale, e vale per tutte le 122 voci.
    /// </summary>
    private const decimal AliquotaListino = 10m;

    private static readonly Voce[] Listino =
    [
        new("BRI-BRIOCHE-VUOTA", "Brioche vuota", 1.40m, "BRIOCHES"),
        new("BRI-BRIOCHE-CREMA", "Brioche crema", 1.40m, "BRIOCHES"),
        new("BRI-BRIOCHE-ALBICOCCA", "Brioche albicocca", 1.40m, "BRIOCHES"),
        new("BRI-KRAPFEN", "Krapfen", 1.50m, "BRIOCHES"),
        new("BRI-STRUDEL", "Strudel", 1.50m, "BRIOCHES"),
        new("BRI-BRIOCHE-NUTELLA", "Brioche Nutella", 1.60m, "BRIOCHES"),
        new("BRI-BRIOCHE-PISTACCHIO", "Brioche pistacchio", 1.60m, "BRIOCHES"),
        new("BRI-BRIOCHE-FRUTTI-BOSCO", "Brioche frutti di bosco", 1.60m, "BRIOCHES"),
        new("BRI-FAGOTTINO-3-CIOCCOLATI", "Fagottino 3 cioccolati", 1.80m, "BRIOCHES"),
        new("BRI-BRIOCHE-VEGANA", "Brioche vegana", 1.80m, "BRIOCHES"),
        new("BRI-CONCHIGLIA-CREMA", "Conchiglia crema", 1.80m, "BRIOCHES"),
        new("BRI-TRECCIA-FRUTTI-ROSSI", "Treccia frutti rossi", 1.80m, "BRIOCHES"),
        new("BRI-MINI-FARCITE", "Mini farcite", 1.10m, "BRIOCHES"),
        new("BRI-MINI-PASTINE", "Mini pastine", 1.10m, "BRIOCHES"),
        new("CAF-ESPRESSO-DECAFFEINATO", "Espresso / decaffeinato", 1.30m, "CAFFETTERIA"),
        new("CAF-CAFFE-SHAKERATO", "Caffè shakerato", 2.00m, "CAFFETTERIA"),
        new("CAF-CAFFE-CORRETTO", "Caffè corretto", 1.80m, "CAFFETTERIA"),
        new("CAF-MOCCACINO", "Moccacino", 1.80m, "CAFFETTERIA"),
        new("CAF-AMERICANO", "Americano", 1.50m, "CAFFETTERIA"),
        new("CAF-ORZO-TUTTI", "Orzo (tutti)", 1.80m, "CAFFETTERIA"),
        new("CAF-ORZO-CORRETTO", "Orzo corretto", 2.00m, "CAFFETTERIA"),
        new("CAF-MACCHIATO", "Macchiato", 1.30m, "CAFFETTERIA"),
        new("CAF-MACCHIATO-DECA", "Macchiato deca", 1.50m, "CAFFETTERIA"),
        new("CAF-MACCHIATO-SOIA", "Macchiato soia", 1.50m, "CAFFETTERIA"),
        new("CAF-MACCHIATO-DECA-SOIA", "Macchiato deca soia", 1.60m, "CAFFETTERIA"),
        new("CAF-MACCHIATONE", "Macchiatone", 1.50m, "CAFFETTERIA"),
        new("CAF-MACCHIATONE-ORZO", "Macchiatone orzo", 1.80m, "CAFFETTERIA"),
        new("CAF-MACCHIATONE-DECA", "Macchiatone deca", 1.80m, "CAFFETTERIA"),
        new("CAF-MACCHIATONE-SOIA", "Macchiatone soia", 1.80m, "CAFFETTERIA"),
        new("CAF-GINSENG-LUNGO", "Ginseng / lungo", 1.80m, "CAFFETTERIA"),
        new("CAF-GINSENG-CORRETTO", "Ginseng corretto", 2.00m, "CAFFETTERIA"),
        new("CAF-CAPPUCCINO", "Cappuccino", 1.80m, "CAFFETTERIA"),
        new("CAF-CAPPUCCINO-LUNGO", "Cappuccino lungo", 2.00m, "CAFFETTERIA"),
        new("CAF-CAPPUCCINO-DECA", "Cappuccino deca", 2.00m, "CAFFETTERIA"),
        new("CAF-CAPPUCCINO-ORZO", "Cappuccino orzo", 2.00m, "CAFFETTERIA"),
        new("CAF-CAPPUCCINO-SOIA", "Cappuccino soia", 2.00m, "CAFFETTERIA"),
        new("CAF-CAPPUCCINO-GINSENG", "Cappuccino ginseng", 2.00m, "CAFFETTERIA"),
        new("CAF-LATTE-MACCHIATO-PICCOLO", "Latte macchiato piccolo", 1.50m, "CAFFETTERIA"),
        new("CAF-LATTE-MACCHIATO-GRANDE", "Latte macchiato grande", 2.00m, "CAFFETTERIA"),
        new("CAF-LATTE-BIANCO", "Latte bianco", 1.50m, "CAFFETTERIA"),
        new("CAF-CREMA-CAFFE-PICCOLA", "Crema caffè piccola", 1.50m, "CAFFETTERIA"),
        new("CAF-CREMA-CAFFE-GRANDE", "Crema caffè grande", 3.00m, "CAFFETTERIA"),
        new("CAF-CIOCCOLATA-CALDA", "Cioccolata calda", 3.00m, "CAFFETTERIA"),
        new("CAF-CIOCCOLATA-PANNA", "Cioccolata con panna", 3.50m, "CAFFETTERIA"),
        new("BIR-GANTER-02", "Ganter 0.2", 2.50m, "BIRRA"),
        new("BIR-GANTER-04", "Ganter 0.4", 4.50m, "BIRRA"),
        new("BIR-ENGEL-02", "Engel 0.2", 2.50m, "BIRRA"),
        new("BIR-ENGEL-04", "Engel 0.4", 4.50m, "BIRRA"),
        new("BIR-EDIT-03", "Edit 0.3", 4.00m, "BIRRA"),
        new("BIR-CORONA", "Corona", 3.50m, "BIRRA"),
        new("BIR-BECK-S", "Beck's", 3.00m, "BIRRA"),
        new("BIR-RADLER-03-BICCHIERE", "Radler 0.3 (bicchiere Edit)", 3.50m, "BIRRA"),
        new("BIR-BIRRA-CALICE-02", "Birra in calice 0.2", 2.50m, "BIRRA"),
        new("BIR-BIRRA-CALICE-04", "Birra in calice 0.4", 4.50m, "BIRRA"),
        new("BIR-FINGER-PILL", "Finger Pill", 4.00m, "BIRRA"),
        new("BIR-FINGER-ROSSA", "Finger Rossa", 5.00m, "BIRRA"),
        new("BIR-FINGER-IPA", "Finger IPA", 5.00m, "BIRRA"),
        new("BIR-FINGER-BELGA", "Finger Belga", 5.50m, "BIRRA"),
        new("VIN-CUSTOZA-DOC-CORNALE-CALICE", "Custoza DOC Cornalè calice", 2.50m, "VINO"),
        new("VIN-CUSTOZA-DOC-CORNALE-BOTTIGLIA", "Custoza DOC Cornalè bottiglia", 12.00m, "VINO"),
        new("VIN-SORAGHE-LUGANA-CALICE", "Soraghe Lugana calice", 3.00m, "VINO"),
        new("VIN-SORAGHE-LUGANA-BOTTIGLIA", "Soraghe Lugana bottiglia", 18.00m, "VINO"),
        new("VIN-MACULAN-CALICE", "Maculan calice", 4.00m, "VINO"),
        new("VIN-VINO-SPINA", "Vino alla spina", 1.50m, "VINO"),
        new("VIN-VINO-SPINA-MACCHIATO-SELTZ", "Vino spina macchiato seltz", 2.50m, "VINO"),
        new("VIN-VINO-SPINA-MACCHIATO-APEROL", "Vino spina macchiato Aperol/Campari", 3.00m, "VINO"),
        new("VIN-CUSTOZA-MACCHIATO-CAMPARI", "Custoza macchiato (Campari/Aperol)", 3.50m, "VINO"),
        new("PRO-BRUT-DOCG-CALICE", "Brut DOCG calice", 3.00m, "PROSECCO"),
        new("PRO-BRUT-DOCG-BOTTIGLIA", "Brut DOCG bottiglia", 18.00m, "PROSECCO"),
        new("PRO-EXTRA-DRY-DOC-CALICE", "Extra Dry DOC calice", 3.00m, "PROSECCO"),
        new("PRO-EXTRA-DRY-DOC-BOTTIGLIA", "Extra Dry DOC bottiglia", 18.00m, "PROSECCO"),
        new("PRO-SERENA-ALCOHOL-FREE-CALICE", "Serena alcohol free calice", 3.00m, "PROSECCO"),
        new("PRO-SERENA-ALCOHOL-FREE-BOTTIGLIA", "Serena alcohol free bottiglia", 18.00m, "PROSECCO"),
        new("PRO-ROSE-CALICE", "Rosè calice", 3.50m, "PROSECCO"),
        new("PRO-ROSE-BOTTIGLIA", "Rosè bottiglia", 21.00m, "PROSECCO"),
        new("PRO-PROSECCO-MACCHIATO", "Prosecco macchiato", 4.00m, "PROSECCO"),
        new("APE-ANALCOLICO-GINGERINO-CRODINO", "Analcolico (gingerino, crodino, acqua brillante)", 2.50m, "APERITIVO"),
        new("APE-SPRITZ-APEROL-HUGO-CYNAR", "Spritz Aperol / Hugo / Cynar", 3.50m, "APERITIVO"),
        new("APE-SPRITZ-APEROL-HUGO-CYNAR-PROSECCO", "Spritz Aperol / Hugo / Cynar con prosecco di bottiglia", 4.00m, "APERITIVO"),
        new("APE-SPRITZ-CAMPARI-MEZZO-MEZZO", "Spritz Campari / mezzo e mezzo", 4.00m, "APERITIVO"),
        new("APE-SPRITZ-CAMPARI-MEZZO-MEZZO-PROSECCO", "Spritz Campari / mezzo e mezzo con prosecco di bottiglia", 4.50m, "APERITIVO"),
        new("APE-SPRITZ-SERENA-ANALCOLICO", "Spritz Serena analcolico", 3.50m, "APERITIVO"),
        new("APE-SPRITZ-LISCIO-BIANCO", "Spritz liscio / bianco", 2.50m, "APERITIVO"),
        new("APE-SPRITZ-MACCHIATO", "Spritz macchiato", 3.50m, "APERITIVO"),
        new("APE-ACQUA-MENTA-50ML", "Acqua menta 50ml", 2.50m, "APERITIVO"),
        new("APE-ACQUA-POCO-SCIROPPO", "Acqua + poco sciroppo 10ml", 1.50m, "APERITIVO"),
        new("APE-ACQUA-SCIROPPO-MEDIO", "Acqua + sciroppo medio 30ml", 2.50m, "APERITIVO"),
        new("APE-ACQUA-SCIROPPO-GRANDE", "Acqua + sciroppo grande 50ml", 3.00m, "APERITIVO"),
        new("BIB-BIBITE-LATTINA", "Bibite in lattina", 3.00m, "BIBITE"),
        new("BIB-RED-BULL", "Red Bull", 3.50m, "BIBITE"),
        new("BIB-ACQUA-NATURALE-GASSATA", "Acqua naturale e gassata", 1.50m, "BIBITE"),
        new("BIB-COCA-COLA-FANTA", "Coca Cola / Fanta in vetro", 3.50m, "BIBITE"),
        new("BIB-CHINOTTO", "Chinotto", 3.50m, "BIBITE"),
        new("BIB-SUCCHI-FRUTTA", "Succhi di frutta", 3.00m, "BIBITE"),
        new("BIB-CAMPARI-SODA", "Campari Soda", 3.00m, "BIBITE"),
        new("BIB-CAMPARI-SODA-MACCHIATO", "Campari Soda macchiato", 4.00m, "BIBITE"),
        new("BIB-ACQUA-TONICA", "Acqua tonica", 3.00m, "BIBITE"),
        new("BIB-SPREMUTA-D-ARANCIA", "Spremuta d'arancia", 3.00m, "BIBITE"),
        new("BIB-INFUSI-TE", "Infusi / tè", 2.50m, "BIBITE"),
        new("LIQ-AMARO", "Amaro", 4.00m, "LIQUORI"),
        new("COC-COCKTAIL-ALCOLICO-MOJITO", "Cocktail alcolico (Mojito, Piña colada, Daiquiri, Cubalibre, Margarita)", 8.00m, "COCKTAIL"),
        new("COC-COCKTAIL-ALCOLICO-AMERICANO", "Cocktail alcolico (Americano, Negroni, Blue Lagoon)", 7.00m, "COCKTAIL"),
        new("COC-COCKTAIL-ANALCOLICO", "Cocktail analcolico", 7.00m, "COCKTAIL"),
        new("COC-GIN-TONIC", "Gin tonic", 7.00m, "COCKTAIL"),
        new("COC-GIN-TONIC-TANQUERAY", "Gin tonic Tanqueray", 8.00m, "COCKTAIL"),
        new("COC-JAGERBOMB", "Jägerbomb", 8.00m, "COCKTAIL"),
        new("COC-MOJITO-FIDEL", "Mojito Fidel", 9.00m, "COCKTAIL"),
        new("CUC-INSALATONA-BASE", "Insalatona base", 7.00m, "CUCINA"),
        new("CUC-AGGIUNTA-PROTEINE", "Aggiunta proteine", 1.00m, "CUCINA"),
        new("CUC-AGGIUNTA-VERDURE", "Aggiunta verdure", 0.50m, "CUCINA"),
        new("CUC-PANINI", "Panini", 5.00m, "CUCINA"),
        new("CUC-SCHIACCIATA-OLIO", "Schiacciata all'olio", 6.00m, "CUCINA"),
        new("CUC-PANINETTI", "Paninetti", 2.00m, "CUCINA"),
        new("CUC-PANINO-CUBANO", "Panino cubano", 8.00m, "CUCINA"),
        new("CUC-TRAMEZZINI", "Tramezzini", 2.00m, "CUCINA"),
        new("CUC-TOST", "Tost", 2.50m, "CUCINA"),
        new("CUC-TOSTONE", "Tostone", 5.50m, "CUCINA"),
        new("CUC-PIZZETTE", "Pizzette", 2.60m, "CUCINA"),
        new("CUC-PIADINE", "Piadine", 4.50m, "CUCINA"),
        new("CUC-BRESAOLA", "Bresaola", 8.00m, "CUCINA"),
        new("CUC-CAPRESSE", "Capresse", 7.00m, "CUCINA"),
        new("CUC-INSALATA-RISO", "Insalata di riso", 9.00m, "CUCINA"),
    ];

    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        string? modalita = Environment.GetEnvironmentVariable("SEED_LISTINO_2026")?.ToLowerInvariant();
        if (modalita != "dryrun" && modalita != "1")
        {
            return;
        }

        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        ILogger logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
            .CreateLogger(typeof(SeedProdottiListino));

        HashSet<string> codiciEsistenti = (await dbContext.Prodotti
                .Select(p => p.Codice)
                .ToListAsync())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        Voce[] daCreare = Listino.Where(v => !codiciEsistenti.Contains(v.Codice)).ToArray();

        logger.LogInformation(
            "Listino 2026 [{Modalita}]: {Totale} voci nel foglio, {Presenti} già in anagrafica, {DaCreare} da creare.",
            modalita, Listino.Length, Listino.Length - daCreare.Length, daCreare.Length);

        if (daCreare.Length == 0)
        {
            return;
        }

        if (modalita == "dryrun")
        {
            daCreare.ToList().ForEach(v =>
                logger.LogInformation("  [dryrun] {Codice} · {Nome} · {Prezzo:0.00} € · {Categoria}",
                    v.Codice, v.Nome, v.Prezzo, v.Categoria));
            return;
        }

        DateTime adesso = DateTime.UtcNow;
        dbContext.Prodotti.AddRange(daCreare.Select(v => new Prodotto
        {
            Codice = v.Codice,
            Nome = v.Nome,
            Prezzo = v.Prezzo,
            Categoria = v.Categoria,
            UnitaDiMisura = "pz",
            Attivo = true,
            AliquotaIva = AliquotaListino,
            CreatedAt = adesso,
            UpdatedAt = adesso,
        }));

        await dbContext.SaveChangesAsync();
        logger.LogInformation("Listino 2026: {DaCreare} prodotti creati.", daCreare.Length);
    }
}
