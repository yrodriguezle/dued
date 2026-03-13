namespace duedgusto.Models;

/// <summary>
/// Periodo di programmazione dei giorni operativi dell'attivita.
/// Ogni periodo definisce quali giorni della settimana sono operativi
/// in un intervallo di date specifico.
/// </summary>
public class PeriodoProgrammazione
{
    /// <summary>
    /// Identificativo univoco del periodo
    /// </summary>
    public int PeriodoId { get; set; }

    /// <summary>
    /// Data di inizio validita del periodo (inclusa)
    /// </summary>
    public DateOnly DataInizio { get; set; }

    /// <summary>
    /// Data di fine validita del periodo (inclusa). Null = periodo attivo corrente.
    /// </summary>
    public DateOnly? DataFine { get; set; }

    /// <summary>
    /// Array JSON di 7 boolean: [lun, mar, mer, gio, ven, sab, dom]
    /// </summary>
    public string GiorniOperativi { get; set; } = "[true,true,true,true,true,false,false]";

    /// <summary>
    /// Orario di apertura per questo periodo (es. 09:00)
    /// </summary>
    public TimeOnly OrarioApertura { get; set; } = new TimeOnly(9, 0);

    /// <summary>
    /// Orario di chiusura per questo periodo (es. 18:00)
    /// </summary>
    public TimeOnly OrarioChiusura { get; set; } = new TimeOnly(18, 0);

    /// <summary>
    /// FK alla configurazione dell'attivita
    /// </summary>
    public int SettingsId { get; set; }

    /// <summary>
    /// Proprieta di navigazione verso la configurazione dell'attivita
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
