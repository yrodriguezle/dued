using System.Globalization;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.Models;

namespace duedgusto.SeedData;

/// <summary>
/// Import una-tantum dello storico delle chiusure giornaliere 2026 dal foglio Excel
/// usato in negozio prima dell'app ("2026 Listino Prezzi.xlsx", fogli "01 2026".."08 2026").
///
/// <para>Come <see cref="SeedRicalcoloIvaVenditeStima"/>, è <b>disattivato per default</b> e va
/// abilitato esplicitamente via variabile d'ambiente <c>SEED_REGISTRI_STORICI</c>: caricare dati
/// storici è un'operazione deliberata, non qualcosa che deve ripartire ad ogni riavvio.</para>
///
/// <list type="bullet">
/// <item><c>SEED_REGISTRI_STORICI=dryrun</c> → logga cosa verrebbe inserito, senza salvare.</item>
/// <item><c>SEED_REGISTRI_STORICI=1</c> (o <c>apply</c>) → inserisce e persiste.</item>
/// <item>non impostata / altro valore → no-op.</item>
/// </list>
///
/// <para><b>Idempotente</b>: le date già presenti in <c>RegistriCassa</c> vengono saltate, mai
/// sovrascritte. Un giorno già inserito dall'app vince sempre sul dato del foglio.</para>
///
/// <para>I totali NON sono ricopiati dall'Excel ma ricalcolati con le stesse funzioni usate dal
/// salvataggio normale (<see cref="MutateRegistroCassaOrchestrator.CalcolaTotali"/> e
/// <see cref="BreakdownIvaApplier"/>), così i registri importati sono indistinguibili da quelli
/// creati dall'interfaccia.</para>
/// </summary>
public static class SeedRegistriCassaStorici
{
    private const string ResourceName = "duedgusto.SeedData.registri-cassa-storici.json";

    private sealed class GiornoStorico
    {
        [JsonPropertyName("data")] public string Data { get; set; } = string.Empty;
        [JsonPropertyName("apertura")] public Dictionary<string, int> Apertura { get; set; } = [];
        [JsonPropertyName("chiusura")] public Dictionary<string, int> Chiusura { get; set; } = [];
        [JsonPropertyName("tracciato")] public decimal Tracciato { get; set; }
        [JsonPropertyName("elettronici")] public decimal Elettronici { get; set; }
        [JsonPropertyName("fattura")] public decimal Fattura { get; set; }
        [JsonPropertyName("spese")] public decimal Spese { get; set; }
        [JsonPropertyName("descrizioneSpesa")] public string? DescrizioneSpesa { get; set; }
    }

    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        string? mode = Environment.GetEnvironmentVariable("SEED_REGISTRI_STORICI")?.ToLowerInvariant();
        bool apply = mode is "1" or "apply";
        bool dryRun = mode is "dryrun";
        if (!apply && !dryRun)
        {
            return; // default OFF
        }

        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        ILoggerFactory loggerFactory = scope.ServiceProvider.GetRequiredService<ILoggerFactory>();
        ILogger logger = loggerFactory.CreateLogger(nameof(SeedRegistriCassaStorici));

        List<GiornoStorico> giorni = LeggiDati();
        logger.LogInformation(
            "Import registri storici avviato in modalità {Modalita}. Giorni nel file: {Giorni}.",
            dryRun ? "DRY-RUN" : "APPLY", giorni.Count);

        // Denominazioni: mappa valore -> Id. Se ne manca una il seed si ferma:
        // meglio nessun dato che registri con conteggi monetari incompleti.
        Dictionary<decimal, int> denominazioni = await db.DenominazioniMoneta
            .ToDictionaryAsync(d => d.Valore, d => d.Id);

        List<decimal> tagliRichiesti = [.. giorni
            .SelectMany(g => g.Apertura.Keys.Concat(g.Chiusura.Keys))
            .Select(ParseTaglio)
            .Distinct()];
        List<decimal> tagliMancanti = [.. tagliRichiesti.Where(t => !denominazioni.ContainsKey(t)).Order()];
        if (tagliMancanti.Count > 0)
        {
            logger.LogError(
                "Import registri storici ANNULLATO: denominazioni assenti in DenominazioniMoneta: {Tagli}.",
                string.Join(", ", tagliMancanti));
            return;
        }

        Utente? utente = await db.Utenti.FirstOrDefaultAsync(u => u.NomeUtente == "superadmin")
                      ?? await db.Utenti.OrderBy(u => u.Id).FirstOrDefaultAsync();
        if (utente == null)
        {
            logger.LogError("Import registri storici ANNULLATO: nessun utente in anagrafica.");
            return;
        }

        BusinessSettings? settings = await db.BusinessSettings.FirstOrDefaultAsync();
        if (settings == null)
        {
            logger.LogError("Import registri storici ANNULLATO: nessun BusinessSettings configurato.");
            return;
        }

        // Le date già presenti non vengono mai toccate.
        HashSet<DateTime> dateEsistenti = [.. await db.RegistriCassa.Select(r => r.Data.Date).ToListAsync()];

        int inseriti = 0, saltati = 0;
        decimal totaleIncassi = 0, totaleSpese = 0;

        foreach (GiornoStorico giorno in giorni)
        {
            DateTime data = DateTime.ParseExact(giorno.Data, "yyyy-MM-dd", CultureInfo.InvariantCulture);
            if (dateEsistenti.Contains(data.Date))
            {
                saltati++;
                continue;
            }

            var registro = new RegistroCassa
            {
                Data = data,
                UtenteId = utente.Id,
                IncassoContanteTracciato = giorno.Tracciato,
                IncassiElettronici = giorno.Elettronici,
                IncassiFattura = giorno.Fattura,
                SpeseFornitori = 0m, // il foglio non distingue fornitori da spese generiche
                Stato = "CLOSED",
                Note = "Importato dal foglio di chiusura 2026",
            };

            registro.TotaleApertura = AggiungiConteggi(registro, denominazioni, giorno.Apertura, isApertura: true);
            registro.TotaleChiusura = AggiungiConteggi(registro, denominazioni, giorno.Chiusura, isApertura: false);

            if (giorno.Spese > 0)
            {
                registro.SpeseCassa.Add(new SpesaCassa
                {
                    Descrizione = string.IsNullOrWhiteSpace(giorno.DescrizioneSpesa)
                        ? "Fornitori / spese del giorno"
                        : giorno.DescrizioneSpesa.Trim(),
                    Importo = giorno.Spese,
                    Categoria = CategoriaSpesa.Altro,
                });
            }

            // Stesse formule del salvataggio normale, non i totali ricopiati dall'Excel.
            MutateRegistroCassaOrchestrator.CalcolaTotali(registro, giorno.Spese);

            totaleIncassi += giorno.Tracciato + giorno.Elettronici + giorno.Fattura;
            totaleSpese += giorno.Spese;
            inseriti++;

            if (dryRun)
            {
                continue;
            }

            db.RegistriCassa.Add(registro);
            await db.SaveChangesAsync(); // serve l'Id per il breakdown IVA

            await BreakdownIvaApplier.ApplicaAsync(db, registro, settings.VatRate, logger);
            await db.SaveChangesAsync();
        }

        logger.LogInformation(
            "Import registri storici {Esito}: {Inseriti} inseriti, {Saltati} saltati (data già presente). " +
            "Incassi {Incassi:F2}, spese {Spese:F2}.",
            dryRun ? "SIMULATO (nessuna scrittura)" : "COMPLETATO", inseriti, saltati, totaleIncassi, totaleSpese);
    }

    private static List<GiornoStorico> LeggiDati()
    {
        using Stream? stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException($"Risorsa embedded '{ResourceName}' non trovata.");
        return JsonSerializer.Deserialize<List<GiornoStorico>>(stream) ?? [];
    }

    private static decimal ParseTaglio(string valore) =>
        decimal.Parse(valore, NumberStyles.Number, CultureInfo.InvariantCulture);

    /// <summary>
    /// Crea le righe ConteggioMoneta e restituisce il totale contato, con la stessa
    /// aritmetica di MutateRegistroCassaOrchestrator.AggiungiConteggi.
    /// </summary>
    private static decimal AggiungiConteggi(
        RegistroCassa registro,
        Dictionary<decimal, int> denominazioni,
        Dictionary<string, int> conteggi,
        bool isApertura)
    {
        decimal totale = 0;
        foreach ((string taglioRaw, int quantita) in conteggi)
        {
            decimal taglio = ParseTaglio(taglioRaw);
            int denominazioneId = denominazioni[taglio]; // presenza già validata a monte
            decimal subtotale = quantita * taglio;
            totale += subtotale;

            registro.ConteggiMoneta.Add(new ConteggioMoneta
            {
                DenominazioneMonetaId = denominazioneId,
                Quantita = quantita,
                Totale = subtotale,
                IsApertura = isApertura,
            });
        }
        return totale;
    }
}
