using System.Text.Json;
using Microsoft.EntityFrameworkCore;

using GraphQL;

using duedgusto.DataAccess;
using duedgusto.Services.ChiusureMensili;

namespace duedgusto.GraphQL.GestioneCassa;

/// <summary>
/// Validazioni condivise per le mutation di GestioneCassa.
/// Classe statica pura — nessuna dipendenza, nessuna registrazione DI.
/// </summary>
public static class GestioneCassaGuards
{
    /// <summary>
    /// Verifica che la data non appartenga a un mese chiuso.
    /// </summary>
    public static async Task GuardMeseChiuso(ChiusuraMensileService chiusuraService, DateTime data)
    {
        if (await chiusuraService.DataAppartieneAMeseChiusoAsync(data))
        {
            throw new ExecutionError(
                $"Impossibile modificare il registro: il mese {data:MM/yyyy} è chiuso.");
        }
    }

    /// <summary>
    /// Verifica che la data non appartenga a un mese chiuso (variante per eliminazione).
    /// </summary>
    public static async Task GuardMeseChiusoPerEliminazione(ChiusuraMensileService chiusuraService, DateTime data)
    {
        if (await chiusuraService.DataAppartieneAMeseChiusoAsync(data))
        {
            throw new ExecutionError(
                $"Impossibile eliminare il registro: il mese {data:MM/yyyy} è chiuso.");
        }
    }

    /// <summary>
    /// Verifica che la data sia un giorno operativo usando i periodi di programmazione
    /// con fallback alle impostazioni globali (usata da mutateRegistroCassa).
    /// </summary>
    public static async Task GuardGiornoOperativoConPeriodi(AppDbContext dbContext, DateTime data)
    {
        var settings = await dbContext.BusinessSettings.FirstAsync();
        int operatingDayIndex = ((int)data.DayOfWeek + 6) % 7;
        var dataOnly = DateOnly.FromDateTime(data);

        var periodi = await dbContext.PeriodiProgrammazione.ToListAsync();
        bool isOperatingDay;

        if (periodi.Count > 0)
        {
            var periodo = periodi.FirstOrDefault(p =>
                p.DataInizio <= dataOnly && (p.DataFine == null || p.DataFine >= dataOnly));

            if (periodo == null)
            {
                var nomeGiorno = data.ToString("dddd", new System.Globalization.CultureInfo("it-IT"));
                throw new ExecutionError(
                    $"Impossibile creare un registro cassa: nessun periodo di programmazione copre la data ({nomeGiorno} {data:dd/MM/yyyy}).");
            }

            var giorniPeriodo = JsonSerializer.Deserialize<bool[]>(periodo.GiorniOperativi)!;
            isOperatingDay = giorniPeriodo[operatingDayIndex];
        }
        else
        {
            var operatingDays = JsonSerializer.Deserialize<bool[]>(settings.OperatingDays)!;
            isOperatingDay = operatingDays[operatingDayIndex];
        }

        if (!isOperatingDay)
        {
            var nomeGiorno = data.ToString("dddd", new System.Globalization.CultureInfo("it-IT"));
            throw new ExecutionError(
                $"Impossibile creare un registro cassa per un giorno di chiusura ({nomeGiorno} {data:dd/MM/yyyy}).");
        }
    }

    /// <summary>
    /// Verifica che la data sia un giorno operativo usando solo BusinessSettings globali
    /// (usata da chiudiRegistroCassa — asimmetria intenzionale rispetto a mutate).
    /// </summary>
    public static async Task GuardGiornoOperativoSoloGlobale(AppDbContext dbContext, DateTime data)
    {
        var settings = await dbContext.BusinessSettings.FirstAsync();
        var operatingDays = JsonSerializer.Deserialize<bool[]>(settings.OperatingDays)!;
        int operatingDayIndex = ((int)data.DayOfWeek + 6) % 7;

        if (!operatingDays[operatingDayIndex])
        {
            var nomeGiorno = data.ToString("dddd", new System.Globalization.CultureInfo("it-IT"));
            throw new ExecutionError(
                $"Impossibile chiudere un registro cassa per un giorno di chiusura ({nomeGiorno} {data:dd/MM/yyyy}).");
        }
    }
}
