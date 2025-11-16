namespace duedgusto.Models;

public class Product
{
    public int ProductId { get; set; }
    public string Code { get; set; } = string.Empty; // Codice prodotto (da Listino)
    public string Name { get; set; } = string.Empty; // Descrizione prodotto
    public string? Description { get; set; } // Descrizione estesa opzionale
    public decimal Price { get; set; } // Prezzo unitario
    public string? Category { get; set; } // Categoria prodotto
    public string? UnitOfMeasure { get; set; } = "pz"; // Unità di misura (pz, kg, l, etc.)
    public bool IsActive { get; set; } = true; // Prodotto attivo/disattivato

    // Metadati
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<Sale> Sales { get; set; } = new List<Sale>();
}
