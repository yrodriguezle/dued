namespace duedgusto.Services.Media;

/// <summary>
/// L'UNICA conversione dell'elenco delle larghezze dal CSV persistito ai numeri che i
/// consumatori usano. Non è un helper di comodo: è il posto che esiste perché non ce ne sia
/// un secondo — e al momento della change ce n'erano <b>due, divergenti</b>.
///
/// <para>🔴 <b>La semantica è tollerante, e la variante che solleva non sopravvive.</b>
/// <c>MediaController.LeggiLarghezze</c> usava <c>int.Parse</c>: una riga con il CSV
/// malformato — un import a mano, un dump modificato, una riga scritta prima di un vincolo —
/// produceva un'eccezione. Finché quella conversione viveva dentro una rotta autenticata era
/// un errore che vedeva un amministratore; la stessa conversione viene ora eseguita anche
/// dalla rotta <b>anonima</b> del menu pubblico, dove diventa un <b>500 servito a un
/// visitatore</b> per colpa di una riga sporca che riguarda una sola immagine.</para>
///
/// <para>Vale il principio opposto a quello della validazione in scrittura: in ingresso si
/// rifiuta ciò che non si capisce, in lettura di un dato già persistito si mostra ciò che si
/// capisce e si scarta il resto. Un'immagine con una variante in meno nel <c>srcset</c> è una
/// pagina che funziona; un'eccezione è una pagina che non c'è.</para>
/// </summary>
public static class LarghezzeCsv
{
    /// <summary>
    /// Converte il CSV persistito (<c>"400,800,1200"</c>) nelle larghezze effettivamente
    /// presenti su disco.
    ///
    /// <para><c>null</c>, stringa vuota o soli spazi producono un elenco vuoto; i valori non
    /// numerici e quelli non positivi vengono <b>scartati</b>. Nessun input solleva.</para>
    /// </summary>
    public static int[] Leggi(string? csv) =>
        string.IsNullOrWhiteSpace(csv)
            ? []
            : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                 .Select(valore => int.TryParse(valore, out int larghezza) ? larghezza : 0)
                 .Where(larghezza => larghezza > 0)
                 .ToArray();
}
