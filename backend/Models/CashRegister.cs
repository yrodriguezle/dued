namespace duedgusto.Models;

public class CashRegister
{
    public int RegisterId { get; set; }
    public DateTime Date { get; set; }
    public int UserId { get; set; }

    // Totali contante
    public decimal OpeningTotal { get; set; }
    public decimal ClosingTotal { get; set; }

    // Vendite e incassi (calcolati o inseriti)
    public decimal CashSales { get; set; }
    public decimal ElectronicPayments { get; set; }
    public decimal TotalSales { get; set; }

    // Spese
    public decimal SupplierExpenses { get; set; }
    public decimal DailyExpenses { get; set; }

    // Calcoli quadratura
    public decimal ExpectedCash { get; set; }
    public decimal Difference { get; set; }
    public decimal NetCash { get; set; }

    // IVA
    public decimal VatAmount { get; set; }

    // Metadati
    public string? Notes { get; set; }
    public string Status { get; set; } = "DRAFT"; // "DRAFT", "CLOSED", "RECONCILED"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User User { get; set; } = null!;
    public ICollection<CashCount> CashCounts { get; set; } = new List<CashCount>();
}
