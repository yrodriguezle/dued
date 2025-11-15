namespace duedgusto.Models;

public class CashCount
{
    public int CountId { get; set; }
    public int RegisterId { get; set; }
    public int DenominationId { get; set; }
    public int Quantity { get; set; }
    public decimal Total { get; set; }
    public bool IsOpening { get; set; } // true = apertura, false = chiusura

    // Navigation properties
    public CashRegister CashRegister { get; set; } = null!;
    public CashDenomination Denomination { get; set; } = null!;
}
