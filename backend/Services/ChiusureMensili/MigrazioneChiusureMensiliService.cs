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
    /// Migra tutte le chiusure esistenti dal vecchio al nuovo modello.
    /// Crea le associazioni RegistroCassaMensile e separa SpeseMensili in due entità distinte.
    /// </summary>
    /// <returns>Risultato della migrazione con statistiche ed eventuali errori</returns>
    public async Task<MigrazioneResult> MigraDatiAsync()
    {
        var result = new MigrazioneResult
        {
            DataInizio = DateTime.UtcNow
        };

        try
        {
            var chiusureVecchie = await _dbContext.ChiusureMensili
                .Include(c => c.Spese)
                    .ThenInclude(s => s.Pagamento)
                .ToListAsync();

            result.TotaleChiusureDaMigrare = chiusureVecchie.Count;

            foreach (var chiusura in chiusureVecchie)
            {
                try
                {
                    await MigraSingolaChiusuraAsync(chiusura, result);
                    result.ChiusureMigrateConSuccesso++;
                }
                catch (Exception ex)
                {
                    result.ChiusureConErrori.Add(chiusura.ChiusuraId, new List<string> { ex.Message });
                    result.ErroriTotali++;
                }
            }

            result.DataFine = DateTime.UtcNow;
            result.DurataTotale = result.DataFine - result.DataInizio;
        }
        catch (Exception ex)
        {
            result.ErroreGlobale = ex.Message;
        }

        return result;
    }

    /// <summary>
    /// Migra una singola chiusura mensile dal vecchio al nuovo modello
    /// </summary>
    private async Task MigraSingolaChiusuraAsync(ChiusuraMensile chiusura, MigrazioneResult result)
    {
        var erroriValidazione = new List<string>();

        // 1. Trova registri cassa del mese
        var primoGiorno = new DateTime(chiusura.Anno, chiusura.Mese, 1);
        var ultimoGiorno = primoGiorno.AddMonths(1).AddDays(-1);

        var registriMese = await _dbContext.RegistriCassa
            .Where(r => r.Data >= primoGiorno && r.Data <= ultimoGiorno)
            .ToListAsync();

        result.RegistriCassaAssociati += registriMese.Count;

        // 2. Crea RegistroCassaMensile per ogni registro
        foreach (var registro in registriMese)
        {
            // Verifica se già esiste (in caso di ri-esecuzione)
            var esistente = await _dbContext.RegistriCassaMensili
                .FirstOrDefaultAsync(r => r.ChiusuraId == chiusura.ChiusuraId && r.RegistroId == registro.Id);

            if (esistente == null)
            {
                var link = new RegistroCassaMensile
                {
                    ChiusuraId = chiusura.ChiusuraId,
                    RegistroId = registro.Id,
                    Incluso = registro.Stato == "CLOSED" || registro.Stato == "RECONCILED"
                };
                _dbContext.RegistriCassaMensili.Add(link);
            }
        }

        // 3. Migra SpeseMensili → SpeseMensiliLibere + PagamentiMensiliFornitori
        foreach (var spesaVecchia in chiusura.Spese)
        {
            if (spesaVecchia.PagamentoId.HasValue)
            {
                // È un pagamento fornitore → PagamentoMensileFornitori
                var esistentePagamento = await _dbContext.PagamentiMensiliFornitori
                    .FirstOrDefaultAsync(pm => pm.ChiusuraId == chiusura.ChiusuraId && pm.PagamentoId == spesaVecchia.PagamentoId.Value);

                if (esistentePagamento == null)
                {
                    var pagamentoMensile = new PagamentoMensileFornitori
                    {
                        ChiusuraId = chiusura.ChiusuraId,
                        PagamentoId = spesaVecchia.PagamentoId.Value,
                        InclusoInChiusura = true
                    };
                    _dbContext.PagamentiMensiliFornitori.Add(pagamentoMensile);
                    result.PagamentiFornitoriMigrati++;

                    // Validazione: verifica che l'importo coincida
                    if (spesaVecchia.Pagamento != null)
                    {
                        var differenzaImporto = Math.Abs(spesaVecchia.Importo - spesaVecchia.Pagamento.Importo);
                        if (differenzaImporto > 0.01m)
                        {
                            erroriValidazione.Add(
                                $"SpesaMensile ID {spesaVecchia.SpesaId}: importo discrepante " +
                                $"(Spesa={spesaVecchia.Importo}, Pagamento={spesaVecchia.Pagamento.Importo})"
                            );
                        }
                    }
                }
            }
            else
            {
                // È una spesa libera → SpesaMensileLibera
                var categoria = MappaCategoria(spesaVecchia.Categoria);
                var spesaLibera = new SpesaMensileLibera
                {
                    ChiusuraId = chiusura.ChiusuraId,
                    Descrizione = spesaVecchia.Descrizione,
                    Importo = spesaVecchia.Importo,
                    Categoria = categoria,
                    CreatoIl = spesaVecchia.CreatoIl,
                    AggiornatoIl = spesaVecchia.AggiornatoIl
                };
                _dbContext.SpeseMensiliLibere.Add(spesaLibera);
                result.SpeseLibereMigrate++;
            }
        }

        await _dbContext.SaveChangesAsync();

        // 4. Validazione: confronta totali vecchi vs calcolati
        var chiusuraAggiornata = await _dbContext.ChiusureMensili
            .Include(c => c.RegistriInclusi).ThenInclude(r => r.Registro)
            .Include(c => c.SpeseLibere)
            .Include(c => c.PagamentiInclusi).ThenInclude(p => p.Pagamento)
            .FirstOrDefaultAsync(c => c.ChiusuraId == chiusura.ChiusuraId);

        if (chiusuraAggiornata != null)
        {
            var erroriValidazioneTotali = ValidaChiusuraMigrata(chiusura, chiusuraAggiornata);
            erroriValidazione.AddRange(erroriValidazioneTotali);
        }

        if (erroriValidazione.Any())
        {
            result.ChiusureConErrori.Add(chiusura.ChiusuraId, erroriValidazione);
            result.ErroriTotali += erroriValidazione.Count;
        }
    }

    /// <summary>
    /// Mappa le categorie stringa del vecchio modello all'enum type-safe
    /// </summary>
    private CategoriaSpesa MappaCategoria(string? categoriaStringa)
    {
        if (string.IsNullOrWhiteSpace(categoriaStringa))
            return CategoriaSpesa.Altro;

        return categoriaStringa.ToUpper() switch
        {
            "AFFITTO" => CategoriaSpesa.Affitto,
            "UTENZE" => CategoriaSpesa.Utenze,
            "STIPENDI" => CategoriaSpesa.Stipendi,
            "FORNITORE" => CategoriaSpesa.Altro, // I fornitori ora sono in PagamentiMensiliFornitori
            _ => CategoriaSpesa.Altro
        };
    }

    /// <summary>
    /// Valida che i totali del vecchio modello denormalizzato coincidano con quelli calcolati dal nuovo modello
    /// </summary>
    private List<string> ValidaChiusuraMigrata(ChiusuraMensile vecchia, ChiusuraMensile nuova)
    {
        var errori = new List<string>();
        const decimal tolleranza = 0.01m; // Tolleranza di 1 centesimo per arrotondamenti

        // Valida RicavoTotale
        if (vecchia.RicavoTotale.HasValue)
        {
            var differenza = Math.Abs(vecchia.RicavoTotale.Value - nuova.RicavoTotaleCalcolato);
            if (differenza > tolleranza)
            {
                errori.Add(
                    $"RicavoTotale: vecchio={vecchia.RicavoTotale:F2}, " +
                    $"calcolato={nuova.RicavoTotaleCalcolato:F2}, diff={differenza:F2}"
                );
            }
        }

        // Valida TotaleContanti
        if (vecchia.TotaleContanti.HasValue)
        {
            var differenza = Math.Abs(vecchia.TotaleContanti.Value - nuova.TotaleContantiCalcolato);
            if (differenza > tolleranza)
            {
                errori.Add(
                    $"TotaleContanti: vecchio={vecchia.TotaleContanti:F2}, " +
                    $"calcolato={nuova.TotaleContantiCalcolato:F2}, diff={differenza:F2}"
                );
            }
        }

        // Valida SpeseAggiuntive
        if (vecchia.SpeseAggiuntive.HasValue)
        {
            var differenza = Math.Abs(vecchia.SpeseAggiuntive.Value - nuova.SpeseAggiuntiveCalcolate);
            if (differenza > tolleranza)
            {
                errori.Add(
                    $"SpeseAggiuntive: vecchio={vecchia.SpeseAggiuntive:F2}, " +
                    $"calcolato={nuova.SpeseAggiuntiveCalcolate:F2}, diff={differenza:F2}"
                );
            }
        }

        // Valida RicavoNetto
        if (vecchia.RicavoNetto.HasValue)
        {
            var differenza = Math.Abs(vecchia.RicavoNetto.Value - nuova.RicavoNettoCalcolato);
            if (differenza > tolleranza)
            {
                errori.Add(
                    $"RicavoNetto: vecchio={vecchia.RicavoNetto:F2}, " +
                    $"calcolato={nuova.RicavoNettoCalcolato:F2}, diff={differenza:F2}"
                );
            }
        }

        return errori;
    }

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
