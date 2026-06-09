namespace duedgusto.Models;

/// <summary>
/// Riga del breakdown IVA per aliquota di un registro cassa.
/// Righe esatte (Stimato = false): somma degli scorpori di riga delle Vendite del registro
/// raggruppate per aliquota snapshot. Riga stimata (Stimato = true): residuo non itemizzato
/// (canali dichiarati manualmente) scorporato all'aliquota di default.
/// Rigenerata integralmente (delete + reinsert) a ogni ricalcolo dei totali.
/// </summary>
public class RegistroCassaIva
{
    public int Id { get; set; }
    public int RegistroCassaId { get; set; } // FK a RegistroCassa (cascade)

    /// <summary>Aliquota in PERCENTUALE (es. 22.00), come Prodotto.AliquotaIva.</summary>
    public decimal Aliquota { get; set; }

    public decimal Imponibile { get; set; }
    public decimal Imposta { get; set; }

    /// <summary>true = residuo non itemizzato stimato all'aliquota di default.</summary>
    public bool Stimato { get; set; }

    // Navigation properties
    public RegistroCassa RegistroCassa { get; set; } = null!;
}
