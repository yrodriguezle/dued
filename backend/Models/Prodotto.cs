namespace duedgusto.Models;

public class Prodotto
{
    public int ProdottoId { get; set; }
    public string Codice { get; set; } = string.Empty; // Codice prodotto (da Listino)
    public string Nome { get; set; } = string.Empty; // Descrizione prodotto
    public string? Descrizione { get; set; } // Descrizione estesa opzionale
    public decimal Prezzo { get; set; } // Prezzo unitario
    public string? Categoria { get; set; } // Categoria prodotto
    public string? UnitaDiMisura { get; set; } = "pz"; // Unità di misura (pz, kg, l, etc.)
    public bool Attivo { get; set; } = true; // Prodotto attivo/disattivato

    /// <summary>
    /// Aliquota IVA del prodotto in PERCENTUALE (es. 22.00 = 22%), come Fornitore.AliquotaIva.
    /// La conversione a frazione per i calcoli avviene SOLO via IvaCalculator.AliquotaDaPercentuale.
    /// </summary>
    public decimal AliquotaIva { get; set; } = 22m;

    // Metadati
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<Vendita> Vendite { get; set; } = new List<Vendita>();
}
