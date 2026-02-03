using Microsoft.EntityFrameworkCore;
using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.Services.ChiusureMensili;

/// <summary>
/// Service per migrare i dati dal vecchio modello denormalizzato al nuovo modello referenziale puro.
/// Esegue la conversione di SpeseMensili in SpeseMensiliLibere + PagamentiMensiliFornitori.
/// </summary>
public class MigrazioneChiusureMensiliService
{
    private readonly AppDbContext _dbContext;

    public MigrazioneChiusureMensiliService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Migrazione non più disponibile: i campi del vecchio modello sono stati rimossi.
    /// Questa funzionalità era disponibile solo durante la fase di transizione.
    /// </summary>
    /// <returns>Risultato indicante che la migrazione non è più disponibile</returns>
    public async Task<MigrazioneResult> MigraDatiAsync()
    {
        await Task.CompletedTask; // Per mantenere la signature async

        var result = new MigrazioneResult
        {
            DataInizio = DateTime.UtcNow,
            DataFine = DateTime.UtcNow,
            DurataTotale = TimeSpan.Zero,
            ErroreGlobale = "Migrazione non più disponibile: il vecchio modello denormalizzato è stato completamente rimosso. " +
                           "La migrazione doveva essere eseguita prima di rimuovere i campi obsoleti dal modello. " +
                           "Se hai dati da migrare, ripristina una versione precedente del codice che conteneva ancora i campi obsoleti."
        };

        return result;
    }

    // NOTA: I metodi di migrazione sono stati rimossi poiché i campi del vecchio modello
    // non esistono più. La migrazione doveva essere eseguita PRIMA di rimuovere i campi obsoleti.

    /// <summary>
    /// Genera un report testuale del risultato della migrazione
    /// </summary>
    public string GeneraReportMigrazione(MigrazioneResult result)
    {
        var report = new System.Text.StringBuilder();
        report.AppendLine("========================================");
        report.AppendLine("REPORT MIGRAZIONE CHIUSURE MENSILI");
        report.AppendLine("========================================");
        report.AppendLine();
        report.AppendLine($"Data inizio: {result.DataInizio:dd/MM/yyyy HH:mm:ss}");
        report.AppendLine($"Data fine: {result.DataFine:dd/MM/yyyy HH:mm:ss}");
        report.AppendLine($"Durata totale: {result.DurataTotale.TotalSeconds:F2} secondi");
        report.AppendLine();
        report.AppendLine($"Totale chiusure da migrare: {result.TotaleChiusureDaMigrare}");
        report.AppendLine($"✅ Chiusure migrate con successo: {result.ChiusureMigrateConSuccesso}");
        report.AppendLine($"⚠️  Chiusure con errori: {result.ChiusureConErrori.Count}");
        report.AppendLine($"❌ Errori totali rilevati: {result.ErroriTotali}");
        report.AppendLine();
        report.AppendLine($"Registri cassa associati: {result.RegistriCassaAssociati}");
        report.AppendLine($"Spese libere migrate: {result.SpeseLibereMigrate}");
        report.AppendLine($"Pagamenti fornitori migrati: {result.PagamentiFornitoriMigrati}");
        report.AppendLine();

        if (!string.IsNullOrEmpty(result.ErroreGlobale))
        {
            report.AppendLine("❌ ERRORE GLOBALE:");
            report.AppendLine(result.ErroreGlobale);
            report.AppendLine();
        }

        if (result.ChiusureConErrori.Any())
        {
            report.AppendLine("========================================");
            report.AppendLine("DETTAGLIO ERRORI PER CHIUSURA");
            report.AppendLine("========================================");

            foreach (var (chiusuraId, errori) in result.ChiusureConErrori)
            {
                report.AppendLine();
                report.AppendLine($"Chiusura ID {chiusuraId}:");
                foreach (var errore in errori)
                {
                    report.AppendLine($"  - {errore}");
                }
            }
        }

        return report.ToString();
    }
}

/// <summary>
/// Risultato della migrazione con statistiche ed eventuali errori
/// </summary>
public class MigrazioneResult
{
    public DateTime DataInizio { get; set; }
    public DateTime DataFine { get; set; }
    public TimeSpan DurataTotale { get; set; }

    public int TotaleChiusureDaMigrare { get; set; }
    public int ChiusureMigrateConSuccesso { get; set; }
    public Dictionary<int, List<string>> ChiusureConErrori { get; set; } = new();
    public int ErroriTotali { get; set; }

    public int RegistriCassaAssociati { get; set; }
    public int SpeseLibereMigrate { get; set; }
    public int PagamentiFornitoriMigrati { get; set; }

    public string? ErroreGlobale { get; set; }

    public bool Successo => string.IsNullOrEmpty(ErroreGlobale) && ChiusureConErrori.Count == 0;
}
