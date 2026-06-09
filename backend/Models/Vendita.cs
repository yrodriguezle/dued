namespace duedgusto.Models;

public class Vendita
{
    public int VenditaId { get; set; }
    public int RegistroCassaId { get; set; } // Foreign key a RegistroCassa
    public int ProdottoId { get; set; } // Foreign key a Prodotto
    public decimal Quantita { get; set; } // Quantità venduta
    public decimal PrezzoUnitario { get; set; } // Prezzo unitario al momento della vendita
    public decimal PrezzoTotale { get; set; } // Totale (Quantita * PrezzoUnitario)
    public string? Note { get; set; } // Note sulla vendita
    public DateTime DataOra { get; set; } = DateTime.UtcNow; // Timestamp della vendita

    /// <summary>
    /// Snapshot IVA al momento della vendita: aliquota in PERCENTUALE (es. 22.00),
    /// copiata dal prodotto alla creazione (immutabile salvo cambio prodotto).
    /// </summary>
    public decimal AliquotaIva { get; set; } = 22m;

    /// <summary>
    /// Imponibile scorporato da PrezzoTotale via IvaCalculator.ScorporaDaLordo.
    /// Invariante: Imponibile + ImportoIva == PrezzoTotale al centesimo.
    /// </summary>
    public decimal Imponibile { get; set; }

    /// <summary>IVA di riga (PrezzoTotale − Imponibile), parte dello snapshot.</summary>
    public decimal ImportoIva { get; set; }

    // Metadati
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public RegistroCassa RegistroCassa { get; set; } = null!;
    public Prodotto Prodotto { get; set; } = null!;
}
