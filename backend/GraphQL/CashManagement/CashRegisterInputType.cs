using GraphQL.Types;

namespace duedgusto.GraphQL.CashManagement;

public class CashRegisterInput
{
    public int? RegisterId { get; set; }
    public DateTime Date { get; set; }
    public int UserId { get; set; }
    public List<CashCountInput> OpeningCounts { get; set; } = new();
    public List<CashCountInput> ClosingCounts { get; set; } = new();
    public decimal SupplierExpenses { get; set; }
    public decimal DailyExpenses { get; set; }
    public string? Notes { get; set; }
    public string Status { get; set; } = "DRAFT";
}

public class CashRegisterInputType : InputObjectGraphType<CashRegisterInput>
{
    public CashRegisterInputType()
    {
        Field(x => x.RegisterId, nullable: true);
        Field(x => x.Date, type: typeof(DateTimeGraphType));
        Field(x => x.UserId);
        Field<ListGraphType<CashCountInputType>>("openingCounts");
        Field<ListGraphType<CashCountInputType>>("closingCounts");
        Field(x => x.SupplierExpenses);
        Field(x => x.DailyExpenses);
        Field(x => x.Notes, nullable: true);
        Field(x => x.Status);
    }
}
