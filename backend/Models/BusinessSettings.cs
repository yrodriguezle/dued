namespace duedgusto.Models;

/// <summary>
/// Configurazione dell'attività commerciale (orari, fuso orario, valuta, IVA)
/// </summary>
public class BusinessSettings
{
    /// <summary>
    /// Identificativo univoco della configurazione (normalmente esisterà un solo record)
    /// </summary>
    public int SettingsId { get; set; }

    /// <summary>
    /// Nome dell'attività commerciale
    /// </summary>
    public string BusinessName { get; set; } = string.Empty;

    /// <summary>
    /// Orario di apertura in formato HH:mm (es. "09:00")
    /// </summary>
    public string OpeningTime { get; set; } = "09:00";

    /// <summary>
    /// Orario di chiusura in formato HH:mm (es. "18:00")
    /// </summary>
    public string ClosingTime { get; set; } = "18:00";

    /// <summary>
    /// Array di 7 boolean rappresentanti i giorni operativi
    /// Indice: 0=lunedì, 1=martedì, 2=mercoledì, 3=giovedì, 4=venerdì, 5=sabato, 6=domenica
    /// </summary>
    public string OperatingDays { get; set; } = "[true,true,true,true,true,false,false]"; // JSON array

    /// <summary>
    /// Fuso orario IANA (es. "Europe/Rome")
    /// </summary>
    public string Timezone { get; set; } = "Europe/Rome";

    /// <summary>
    /// Codice valuta ISO 4217 (es. "EUR", "USD")
    /// </summary>
    public string Currency { get; set; } = "EUR";

    /// <summary>
    /// Aliquota IVA come decimal (es. 0.22 per 22%)
    /// </summary>
    public decimal VatRate { get; set; } = 0.22m;

    /// <summary>
    /// Data di creazione della configurazione
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Data dell'ultimo aggiornamento
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
