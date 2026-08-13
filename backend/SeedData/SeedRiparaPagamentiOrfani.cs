using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services.Fornitori;

namespace duedgusto.SeedData;

/// <summary>
/// Data-fix: riaggancia i pagamenti fornitori orfani (<c>RegistroCassaId</c> NULL) al registro
/// cassa della loro data, creandolo in DRAFT se non esiste.
///
/// <para>
/// Un pagamento orfano è invisibile a QUALUNQUE chiusura: il totale mensile somma
/// <c>SpeseFornitori</c> dei registri inclusi, che vale <c>SUM(pagamenti) WHERE RegistroCassaId = X</c>.
/// Il legame è la foreign key, non la data — quindi finché la FK è NULL l'importo non esiste
/// per nessun mese. Li produceva <c>FatturaAcquistoOrchestrator</c> (fattura creata con i
/// pagamenti già compilati); il fix nel codice impedisce nuovi orfani, questo ripara gli esistenti.
/// </para>
///
/// <para>
/// La quadratura viene delegata a <see cref="RegistroCassaSyncService.RecalculateSpeseFornitoriAsync"/>,
/// cioè alla fonte unica: la migrazione <c>FixOrphanedPaymentsLinkToRegistroCassa</c> (2026-03) fece
/// lo stesso lavoro replicando la formula in SQL, ma quella copia è poi risultata divergente da
/// <c>CalcolaTotali</c>. Qui non si riscrive nessuna formula.
/// </para>
///
/// Idempotente: senza orfani non tocca nulla, quindi ai riavvii successivi è un no-op.
/// </summary>
public static class SeedRiparaPagamentiOrfani
{
    /// <summary>
    /// Gli orfani precedenti a questa data NON vengono riagganciati: si limitano a comparire nel
    /// log. I mesi 2026 fino a giugno hanno una discrepanza aperta fra le spese in produzione e
    /// il foglio di chiusura, mai chiarita; riagganciarli in blocco cambierebbe registri di mesi
    /// già chiusi prima che qualcuno li abbia verificati. Alzare la soglia è una modifica di una
    /// riga, da fare quando quella verifica è stata chiusa.
    /// </summary>
    private static readonly DateTime DataMinimaRiparazione = new(2026, 7, 1);

    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        RegistroCassaSyncService syncService = scope.ServiceProvider.GetRequiredService<RegistroCassaSyncService>();
        ILogger logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger(nameof(SeedRiparaPagamentiOrfani));

        List<PagamentoFornitore> tuttiGliOrfani = await dbContext.PagamentiFornitori
            .Where(p => p.RegistroCassaId == null)
            .OrderBy(p => p.DataPagamento)
            .ToListAsync();

        if (tuttiGliOrfani.Count == 0)
        {
            return;
        }

        List<PagamentoFornitore> esclusi = tuttiGliOrfani
            .Where(p => p.DataPagamento < DataMinimaRiparazione)
            .ToList();

        if (esclusi.Count > 0)
        {
            // Restano orfani per scelta, ma non in silenzio: senza questa riga sparirebbero
            // esattamente come il pagamento che ha fatto nascere tutta la vicenda.
            logger.LogWarning(
                "Pagamenti orfani anteriori al {Soglia:dd/MM/yyyy} NON riagganciati ({Count} per {Totale:N2} EUR): {Dettaglio}. "
                + "Restano invisibili alle chiusure finché non si chiarisce la discrepanza dei mesi pregressi.",
                DataMinimaRiparazione,
                esclusi.Count,
                esclusi.Sum(p => p.Importo),
                string.Join(", ", esclusi.Select(p => $"{p.DataPagamento:dd/MM/yyyy} {p.Importo:N2}")));
        }

        List<PagamentoFornitore> orfani = tuttiGliOrfani
            .Where(p => p.DataPagamento >= DataMinimaRiparazione)
            .ToList();

        if (orfani.Count == 0)
        {
            return;
        }

        // Il registro creato per una data scoperta ha bisogno di un intestatario: si usa l'utente
        // più vecchio (il superadmin del primo seed), non un ID cablato che potrebbe non esistere.
        Utente? utenteFallback = await dbContext.Utenti.OrderBy(u => u.Id).FirstOrDefaultAsync();
        if (utenteFallback is null)
        {
            logger.LogWarning(
                "Riparazione pagamenti orfani saltata: {Count} pagamenti da riagganciare ma nessun utente in anagrafica.",
                orfani.Count);
            return;
        }

        var registriToccati = new HashSet<int>();

        foreach (PagamentoFornitore pagamento in orfani)
        {
            RegistroCassa registro = await syncService.FindOrCreateRegistroCassaAsync(
                pagamento.DataPagamento, utenteFallback.Id);

            pagamento.RegistroCassaId = registro.Id;
            registriToccati.Add(registro.Id);
        }

        await dbContext.SaveChangesAsync();

        // Sequenziale: RecalculateSpeseFornitoriAsync salva sullo stesso DbContext, che non è
        // thread-safe. Parallelizzare qui romperebbe il tracking di EF.
        foreach (int registroId in registriToccati)
        {
            await syncService.RecalculateSpeseFornitoriAsync(registroId);
        }

        decimal totale = orfani.Sum(p => p.Importo);
        var giorni = string.Join(", ", orfani
            .Select(p => p.DataPagamento.ToString("dd/MM/yyyy"))
            .Distinct());

        // LogWarning e non LogInformation: in Production il livello di default è Warning, e una
        // riparazione di dati contabili deve restare visibile senza dover dichiarare la categoria.
        logger.LogWarning(
            "Riparazione pagamenti orfani: {Count} pagamenti per {Totale:N2} EUR riagganciati a {Registri} registri ({Giorni}). "
            + "Le chiusure mensili interessate vanno riverificate: se il mese è già CHIUSA lo snapshot resta congelato.",
            orfani.Count, totale, registriToccati.Count, giorni);
    }
}
