namespace duedgusto.Models;

public class RegistroCassa
{
    public int Id { get; set; }
    public DateTime Data { get; set; }
    public int UtenteId { get; set; }

    // Totali contante
    public decimal TotaleApertura { get; set; }
    public decimal TotaleChiusura { get; set; }

    // Vendite e incassi (calcolati o inseriti)
    public decimal VenditeContanti { get; set; }
    public decimal IncassoContanteTracciato { get; set; }
    public decimal IncassiElettronici { get; set; }
    public decimal IncassiFattura { get; set; }
    public decimal TotaleVendite { get; set; }

    // Spese
    public decimal SpeseFornitori { get; set; }
    public decimal SpeseGiornaliere { get; set; }

    // Calcoli quadratura
    public decimal ContanteAtteso { get; set; }
    public decimal Differenza { get; set; }
    public decimal ContanteNetto { get; set; }

    // IVA
    public decimal ImportoIva { get; set; }

    // Metadati
    public string? Note { get; set; }
    public string Stato { get; set; } = "DRAFT"; // "DRAFT", "CLOSED", "RECONCILED"
    public DateTime CreatoIl { get; set; } = DateTime.UtcNow;
    public DateTime AggiornatoIl { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Utente Utente { get; set; } = null!;
    public ICollection<ConteggioMoneta> ConteggiMoneta { get; set; } = new List<ConteggioMoneta>();
    public ICollection<IncassoCassa> IncassiCassa { get; set; } = new List<IncassoCassa>();
    public ICollection<SpesaCassa> SpeseCassa { get; set; } = new List<SpesaCassa>();
}
