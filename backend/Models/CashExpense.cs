namespace duedgusto.Models;

public class CashExpense
{
    public int ExpenseId { get; set; }
    public int RegisterId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }

    // Navigation properties
    public CashRegister CashRegister { get; set; } = null!;
}
