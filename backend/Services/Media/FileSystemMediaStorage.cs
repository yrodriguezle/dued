namespace duedgusto.Services.Media;

/// <summary>
/// Radice dei media sul filesystem. È un tipo e non una <c>string</c> registrata nel container
/// perché una stringa singleton è indistinguibile da qualunque altra stringa singleton.
/// </summary>
public sealed record MediaRoot(string Percorso);

/// <summary>
/// Storage su filesystem. Scrive sempre in <c>{chiave}.tmp/</c> e promuove la cartella con
/// <see cref="Directory.Move(string, string)"/> — che è atomico sullo stesso volume — così un
/// crash a metà scrittura lascia al più una <c>.tmp</c> orfana, mai una chiave incompleta.
/// </summary>
public class FileSystemMediaStorage(MediaRoot mediaRoot, ILogger<FileSystemMediaStorage> logger) : IMediaStorage
{
    private const string SuffissoTemporaneo = ".tmp";

    public async Task<long> ScriviVariantiAsync(
        string chiave,
        IReadOnlyList<VarianteMedia> varianti,
        CancellationToken cancellationToken = default)
    {
        string destinazione = RisolviSottoRadice(chiave);
        string temporanea = destinazione + SuffissoTemporaneo;

        if (Directory.Exists(destinazione))
        {
            // I file non si sovrascrivono MAI: è la regola su cui poggiano la cache
            // "immutable" di un anno e la correttezza banale del backup incrementale.
            throw new InvalidOperationException($"La chiave '{chiave}' esiste già sullo storage.");
        }

        try
        {
            // La .tmp di un tentativo precedente andato male non deve inquinare questo.
            if (Directory.Exists(temporanea)) Directory.Delete(temporanea, recursive: true);
            Directory.CreateDirectory(temporanea);

            long byteTotali = 0;
            foreach (VarianteMedia variante in varianti)
            {
                string percorso = Path.Combine(temporanea, variante.NomeFile);
                await File.WriteAllBytesAsync(percorso, variante.Contenuto, cancellationToken);
                byteTotali += variante.Contenuto.LongLength;
            }

            Directory.CreateDirectory(Path.GetDirectoryName(destinazione)!);
            Directory.Move(temporanea, destinazione);

            return byteTotali;
        }
        catch
        {
            // Nessun file parziale resta sotto la radice: la pulizia non deve però
            // mascherare l'errore vero, che è quello che il client deve leggere.
            PulisciSilenziosamente(temporanea);
            throw;
        }
    }

    public Task EliminaAsync(string chiave, CancellationToken cancellationToken = default)
    {
        string destinazione = RisolviSottoRadice(chiave);
        if (Directory.Exists(destinazione)) Directory.Delete(destinazione, recursive: true);

        // La .tmp di un upload fallito in passato, se esiste, se ne va con la chiave.
        PulisciSilenziosamente(destinazione + SuffissoTemporaneo);

        return Task.CompletedTask;
    }

    /// <summary>
    /// Risolve la chiave in un percorso assoluto e <b>verifica che resti sotto la radice</b>.
    /// 🔴 Difesa in profondità sul path traversal: <see cref="SlugGenerator"/> già neutralizza
    /// i separatori, ma la chiave attraversa il database e questo è l'ultimo punto prima di
    /// toccare il disco. Un controllo qui costa tre righe; scoprire che non c'era costa il server.
    /// </summary>
    private string RisolviSottoRadice(string chiave)
    {
        string radice = Path.GetFullPath(mediaRoot.Percorso);
        string candidato = Path.GetFullPath(Path.Combine(radice, chiave));

        string radiceConSeparatore = radice.EndsWith(Path.DirectorySeparatorChar)
            ? radice
            : radice + Path.DirectorySeparatorChar;

        if (!candidato.StartsWith(radiceConSeparatore, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                $"La chiave '{chiave}' risolve fuori dalla radice dei media.");
        }

        return candidato;
    }

    private void PulisciSilenziosamente(string percorso)
    {
        try
        {
            if (Directory.Exists(percorso)) Directory.Delete(percorso, recursive: true);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Impossibile rimuovere la cartella temporanea {Percorso}", percorso);
        }
    }
}
