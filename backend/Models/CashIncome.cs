namespace duedgusto.Models;

public class CashIncome
{
    public int IncomeId { get; set; }
    public int RegisterId { get; set; }
    public string Type { get; set; } = string.Empty; // "Pago in Bianco (Contante)", "Pagamenti Elettronici", "Pagamento con Fattura"
    public decimal Amount { get; set; }

    // Navigation properties
    public CashRegister CashRegister { get; set; } = null!;
}
