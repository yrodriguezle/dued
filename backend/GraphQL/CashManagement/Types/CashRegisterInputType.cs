using duedgusto.GraphQL.CashManagement.Types;
using GraphQL.Types;

namespace duedgusto.GraphQL.CashManagement.Types;

public class CashRegisterInput
{
    public int? RegisterId { get; set; }
    public DateTime Date { get; set; }
    public int UserId { get; set; }
    public List<CashCountInput> OpeningCounts { get; set; } = new();
    public List<CashCountInput> ClosingCounts { get; set; } = new();
    public List<CashIncomeInput> Incomes { get; set; } = new();
    public List<CashExpenseInput> Expenses { get; set; } = new();
    public decimal CashInWhite { get; set; }
    public decimal ElectronicPayments { get; set; }
    public decimal InvoicePayments { get; set; }
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
        Field<ListGraphType<CashIncomeInputType>>("incomes");
        Field<ListGraphType<CashExpenseInputType>>("expenses");
        Field(x => x.CashInWhite);
        Field(x => x.ElectronicPayments);
        Field(x => x.InvoicePayments);
        Field(x => x.SupplierExpenses);
        Field(x => x.DailyExpenses);
        Field(x => x.Notes, nullable: true);
        Field(x => x.Status);
    }
}
