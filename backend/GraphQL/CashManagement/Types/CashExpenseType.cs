using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.CashManagement.Types;

public class CashExpenseType : ObjectGraphType<CashExpense>
{
    public CashExpenseType()
    {
        Field(x => x.ExpenseId);
        Field(x => x.RegisterId);
        Field(x => x.Description);
        Field(x => x.Amount, type: typeof(DecimalGraphType));
    }
}

public class CashExpenseInput
{
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}

public class CashExpenseInputType : InputObjectGraphType<CashExpenseInput>
{
    public CashExpenseInputType()
    {
        Field(x => x.Description);
        Field(x => x.Amount);
    }
}
