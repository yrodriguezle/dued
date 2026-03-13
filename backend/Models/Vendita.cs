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

    // Metadati
    public DateTime CreatoIl { get; set; } = DateTime.UtcNow;
    public DateTime AggiornatoIl { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public RegistroCassa RegistroCassa { get; set; } = null!;
    public Prodotto Prodotto { get; set; } = null!;
}
