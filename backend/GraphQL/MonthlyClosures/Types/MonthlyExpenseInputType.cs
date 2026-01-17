using GraphQL.Types;

namespace duedgusto.GraphQL.MonthlyClosures.Types;

public class MonthlyExpenseInput
{
    public int? ExpenseId { get; set; }
    public int ClosureId { get; set; }
    public int? PaymentId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Category { get; set; }
}

public class MonthlyExpenseInputType : InputObjectGraphType<MonthlyExpenseInput>
{
    public MonthlyExpenseInputType()
    {
        Name = "MonthlyExpenseInput";

        Field(x => x.ExpenseId, nullable: true);
        Field(x => x.ClosureId);
        Field(x => x.PaymentId, nullable: true);
        Field(x => x.Description);
        Field(x => x.Amount);
        Field(x => x.Category, nullable: true);
    }
}
