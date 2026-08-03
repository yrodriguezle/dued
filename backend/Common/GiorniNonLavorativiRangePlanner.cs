namespace duedgusto.Common;

/// <summary>
/// Pianifica la creazione massiva di giorni non lavorativi su un intervallo di date.
/// Le date già configurate vengono escluse dalla creazione e riportate a parte,
/// così la creazione di un periodo di ferie non fallisce per una festività già inserita.
/// </summary>
public static class GiorniNonLavorativiRangePlanner
{
    /// <summary>
    /// Numero massimo di giorni ammessi in un singolo intervallo (un anno bisestile).
    /// </summary>
    public const int MaxGiorni = 366;

    public record Piano(IReadOnlyList<DateOnly> DaCreare, IReadOnlyList<DateOnly> Saltate)
    {
        public int GiorniTotali => DaCreare.Count + Saltate.Count;
    }

    /// <summary>
    /// Numero di giorni compresi nell'intervallo, estremi inclusi.
    /// </summary>
    public static int ContaGiorni(DateOnly dataInizio, DateOnly dataFine) =>
        dataFine.DayNumber - dataInizio.DayNumber + 1;

    /// <summary>
    /// Divide l'intervallo [dataInizio, dataFine] fra date da creare e date già presenti.
    /// </summary>
    /// <exception cref="ArgumentException">dataFine precedente a dataInizio</exception>
    public static Piano Pianifica(DateOnly dataInizio, DateOnly dataFine, IEnumerable<DateOnly> dateEsistenti)
    {
        if (dataFine < dataInizio)
            throw new ArgumentException("dataFine non può essere precedente a dataInizio", nameof(dataFine));

        var esistenti = dateEsistenti.ToHashSet();

        List<DateOnly> tutte = Enumerable
            .Range(0, ContaGiorni(dataInizio, dataFine))
            .Select(dataInizio.AddDays)
            .ToList();

        return new Piano(
            tutte.Where(data => !esistenti.Contains(data)).ToList(),
            tutte.Where(esistenti.Contains).ToList()
        );
    }
}
