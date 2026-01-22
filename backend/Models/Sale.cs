namespace duedgusto.Models;

public class Sale
{
    public int SaleId { get; set; }
    public int RegistroCassaId { get; set; } // Foreign key a RegistroCassa
    public int ProductId { get; set; } // Foreign key a Product
    public decimal Quantity { get; set; } // Quantità venduta
    public decimal UnitPrice { get; set; } // Prezzo unitario al momento della vendita
    public decimal TotalPrice { get; set; } // Totale (Quantity * UnitPrice)
    public string? Notes { get; set; } // Note sulla vendita
    public DateTime Timestamp { get; set; } = DateTime.UtcNow; // Timestamp della vendita

    // Metadati
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public RegistroCassa RegistroCassa { get; set; } = null!;
    public Product Product { get; set; } = null!;
}
