namespace duedgusto.Services.Media;

/// <summary>
/// Una variante già codificata, pronta per essere persistita: il nome del file relativo alla
/// cartella della chiave (es. <c>"800.webp"</c>) e i suoi byte.
/// </summary>
public sealed record VarianteMedia(string NomeFile, byte[] Contenuto);

/// <summary>
/// Astrazione dello storage dei binari. Esiste perché <see cref="ImmagineProcessor"/> non deve
/// conoscere il filesystem: la pipeline produce byte, lo storage decide dove finiscono.
/// Il giorno in cui i media passano su S3 si scrive una seconda implementazione e il
/// processor resta intatto.
/// </summary>
public interface IMediaStorage
{
    /// <summary>
    /// Persiste <b>tutte</b> le varianti di una chiave in modo atomico: o ci sono tutte, o non
    /// c'è la cartella. Restituisce il totale dei byte scritti.
    ///
    /// 🔴 L'atomicità non è un di più: una cartella con 3 varianti su 8 è il fallimento
    /// peggiore dei tre possibili, perché è <i>presente</i> e <i>incompleta</i> — il record
    /// dichiarerebbe larghezze che rispondono 404, e un <c>srcset</c> con URL rotte degrada
    /// in modo silenzioso e diverso da browser a browser.
    /// </summary>
    Task<long> ScriviVariantiAsync(string chiave, IReadOnlyList<VarianteMedia> varianti, CancellationToken cancellationToken = default);

    /// <summary>
    /// Rimuove ricorsivamente tutti i file della chiave. Idempotente: eliminare una chiave
    /// che non esiste non è un errore, perché è lo stato desiderato.
    /// </summary>
    Task EliminaAsync(string chiave, CancellationToken cancellationToken = default);
}
