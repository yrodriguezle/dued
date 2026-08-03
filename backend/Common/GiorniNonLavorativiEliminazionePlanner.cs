namespace duedgusto.Common;

/// <summary>
/// Pianifica l'eliminazione massiva di giorni non lavorativi a partire da una lista di ID.
/// Gli ID non più presenti a database non sono un errore: l'eliminazione è idempotente
/// (un altro utente può aver già rimosso il giorno) e vengono riportati a parte.
/// </summary>
public static class GiorniNonLavorativiEliminazionePlanner
{
    /// <summary>
    /// Numero massimo di ID ammessi in una singola eliminazione, allineato al limite
    /// dell'intervallo di creazione.
    /// </summary>
    public const int MaxGiorni = GiorniNonLavorativiRangePlanner.MaxGiorni;

    public record Piano(IReadOnlyList<int> DaEliminare, IReadOnlyList<int> NonTrovati);

    /// <summary>
    /// Rimuove ID duplicati e non validi (&lt;= 0), restituendoli ordinati.
    /// </summary>
    public static IReadOnlyList<int> Normalizza(IEnumerable<int> giorniIds) =>
        giorniIds
            .Where(id => id > 0)
            .Distinct()
            .OrderBy(id => id)
            .ToList();

    /// <summary>
    /// Divide gli ID richiesti fra quelli effettivamente presenti a database e quelli non trovati.
    /// Gli ID richiesti vengono normalizzati prima del confronto.
    /// </summary>
    public static Piano Pianifica(IEnumerable<int> giorniIdsRichiesti, IEnumerable<int> giorniIdsEsistenti)
    {
        IReadOnlyList<int> richiesti = Normalizza(giorniIdsRichiesti);
        var esistenti = giorniIdsEsistenti.ToHashSet();

        return new Piano(
            richiesti.Where(esistenti.Contains).ToList(),
            richiesti.Where(id => !esistenti.Contains(id)).ToList()
        );
    }
}
