namespace duedgusto.Models;

/// <summary>
/// Giorno non lavorativo (festività, chiusure straordinarie, ferie).
/// Permette di escludere automaticamente specifiche date dalla validazione
/// di completezza dei registri cassa nella chiusura mensile.
/// </summary>
public class GiornoNonLavorativo
{
    /// <summary>
    /// Identificativo univoco del giorno non lavorativo
    /// </summary>
    public int GiornoId { get; set; }

    /// <summary>
    /// Data del giorno non lavorativo
    /// </summary>
    public DateOnly Data { get; set; }

    /// <summary>
    /// Descrizione del giorno non lavorativo (es. "Natale", "Chiusura estiva")
    /// </summary>
    public string Descrizione { get; set; } = string.Empty;

    /// <summary>
    /// Codice motivo della chiusura: FESTIVITA_NAZIONALE, CHIUSURA_STRAORDINARIA, FERIE
    /// </summary>
    public string CodiceMotivo { get; set; } = "FESTIVITA_NAZIONALE";

    /// <summary>
    /// Se true, il giorno si ripete ogni anno (es. festività nazionali).
    /// Il matching avviene su mese+giorno ignorando l'anno.
    /// </summary>
    public bool Ricorrente { get; set; } = false;

    /// <summary>
    /// FK alla configurazione dell'attività
    /// </summary>
    public int SettingsId { get; set; }

    /// <summary>
    /// Proprietà di navigazione verso la configurazione dell'attività
    /// </summary>
    public BusinessSettings Settings { get; set; } = null!;

    /// <summary>
    /// Data di creazione del record
    /// </summary>
    public DateTime CreatoIl { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Data dell'ultimo aggiornamento
    /// </summary>
    public DateTime AggiornatoIl { get; set; } = DateTime.UtcNow;
}
