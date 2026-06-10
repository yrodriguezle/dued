using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.Services.ChiusureMensili;

/// <summary>
/// Validator per la completezza dei registri cassa di una chiusura mensile.
/// Estratto da ChiusuraMensileService (spostamento letterale, comportamento invariato):
/// il service delega a questa classe mantenendo la propria API pubblica.
/// </summary>
public class ChiusuraMensileValidator
{
    private readonly AppDbContext _dbContext;

    public ChiusuraMensileValidator(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Valida la completezza dei registri cassa per un mese specifico.
    /// Utile per pre-validare prima di creare una chiusura.
    /// Utilizza i periodi di programmazione per determinare i giorni operativi
    /// di ciascun giorno del mese, gestendo anche mesi a cavallo tra due periodi.
    /// </summary>
    /// <param name="anno">Anno da validare</param>
    /// <param name="mese">Mese da validare (1-12)</param>
    /// <returns>Lista di date per cui mancano registri cassa chiusi</returns>
    public async Task<List<DateTime>> ValidaCompletezzaRegistriAsync(int anno, int mese)
    {
        var primoGiorno = new DateTime(anno, mese, 1);
        DateTime ultimoGiorno = primoGiorno.AddMonths(1).AddDays(-1);

        List<RegistroCassa> registriMese = await _dbContext.RegistriCassa
                .Where(r => r.Data >= primoGiorno && r.Data <= ultimoGiorno)
                .Where(r => r.Stato == "CLOSED" || r.Stato == "RECONCILED")
                .ToListAsync();

        // Carica i periodi di programmazione per determinare i giorni operativi per-periodo
        List<PeriodoProgrammazione> periodi = await _dbContext.PeriodiProgrammazione
                .OrderBy(p => p.DataInizio)
                .ToListAsync();

        List<DateTime> giorniMancanti;

        if (periodi.Count > 0)
        {
            // Usa i periodi di programmazione per determinare i giorni operativi per ogni giorno
            giorniMancanti = ElencoGiorniMancantiPerPeriodo(registriMese, primoGiorno, ultimoGiorno, periodi);
        }
        else
        {
            // Fallback: usa il campo globale OperatingDays di BusinessSettings
            BusinessSettings settings = await _dbContext.BusinessSettings.FirstAsync();
            var operatingDays = JsonSerializer.Deserialize<bool[]>(settings.OperatingDays)!;
            giorniMancanti = ElencoGiorniMancanti(registriMese, primoGiorno, ultimoGiorno, operatingDays);
        }

        // Escludi i giorni non lavorativi configurati
        List<GiornoNonLavorativo> giorniNonLavorativi = await _dbContext.GiorniNonLavorativi.ToListAsync();
        if (giorniNonLavorativi.Count > 0)
        {
            giorniMancanti = giorniMancanti.Where(data =>
            {
                var dataOnly = DateOnly.FromDateTime(data);
                return !giorniNonLavorativi.Any(gnl =>
                {
                    if (gnl.Ricorrente)
                    {
                        // Per i ricorrenti, confronta solo mese e giorno
                        return gnl.Data.Month == dataOnly.Month && gnl.Data.Day == dataOnly.Day;
                    }
                    else
                    {
                        // Per i non ricorrenti, confronta la data esatta
                        return gnl.Data == dataOnly;
                    }
                });
            }).ToList();
        }

        return giorniMancanti;
    }

    /// <summary>
    /// Calcola l'elenco dei giorni mancanti confrontando i registri presenti con i giorni operativi del mese.
    /// Rispetta le impostazioni di OperatingDays: solo i giorni in cui l'attività è aperta vengono considerati.
    /// </summary>
    private List<DateTime> ElencoGiorniMancanti(
        List<RegistroCassa> registri,
        DateTime primoGiorno,
        DateTime ultimoGiorno,
        bool[] operatingDays)
    {
        var giorniPresenti = registri.Select(r => r.Data.Date).ToHashSet();
        var giorniMancanti = new List<DateTime>();

        for (DateTime data = primoGiorno; data <= ultimoGiorno; data = data.AddDays(1))
        {
            // Mappa DayOfWeek (.NET: 0=Sunday) a indice array operatingDays (0=Monday)
            int operatingDayIndex = ((int)data.DayOfWeek + 6) % 7;

            // Salta i giorni non operativi (es. sabato/domenica se chiusi)
            if (!operatingDays[operatingDayIndex])
                continue;

            if (!giorniPresenti.Contains(data.Date))
            {
                giorniMancanti.Add(data);
            }
        }

        return giorniMancanti;
    }

    /// <summary>
    /// Calcola l'elenco dei giorni mancanti usando i periodi di programmazione.
    /// Per ogni giorno del mese, trova quale periodo lo copre (DataInizio &lt;= giorno
    /// AND (DataFine &gt;= giorno OR DataFine = null)) e usa i GiorniOperativi di quel periodo.
    /// Gestisce correttamente mesi a cavallo tra due periodi.
    /// </summary>
    private List<DateTime> ElencoGiorniMancantiPerPeriodo(
        List<RegistroCassa> registri,
        DateTime primoGiorno,
        DateTime ultimoGiorno,
        List<PeriodoProgrammazione> periodi)
    {
        var giorniPresenti = registri.Select(r => r.Data.Date).ToHashSet();
        var giorniMancanti = new List<DateTime>();

        for (DateTime data = primoGiorno; data <= ultimoGiorno; data = data.AddDays(1))
        {
            var dataOnly = DateOnly.FromDateTime(data);

            // Trova il periodo che copre questa data
            PeriodoProgrammazione? periodo = periodi.FirstOrDefault(p =>
                      p.DataInizio <= dataOnly &&
                      (p.DataFine == null || p.DataFine >= dataOnly));

            // Se nessun periodo copre questa data, la consideriamo non operativa
            if (periodo == null)
                continue;

            // Parse giorniOperativi del periodo
            bool[]? operatingDays;
            try
            {
                operatingDays = JsonSerializer.Deserialize<bool[]>(periodo.GiorniOperativi);
            }
            catch
            {
                continue; // Se il JSON non è valido, salta il giorno
            }

            if (operatingDays == null || operatingDays.Length != 7)
                continue;

            // Mappa DayOfWeek (.NET: 0=Sunday) a indice array operatingDays (0=Monday)
            int operatingDayIndex = ((int)data.DayOfWeek + 6) % 7;

            // Salta i giorni non operativi secondo questo periodo
            if (!operatingDays[operatingDayIndex])
                continue;

            if (!giorniPresenti.Contains(data.Date))
            {
                giorniMancanti.Add(data);
            }
        }

        return giorniMancanti;
    }
}
