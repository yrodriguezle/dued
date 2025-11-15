namespace duedgusto.Models;

public class CashDenomination
{
    public int DenominationId { get; set; }
    public decimal Value { get; set; }
    public string Type { get; set; } = string.Empty; // "COIN" or "BANKNOTE"
    public int DisplayOrder { get; set; }

    // Navigation property
    public ICollection<CashCount> CashCounts { get; set; } = new List<CashCount>();
}
