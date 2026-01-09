using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.CashManagement;

public class CashIncomeType : ObjectGraphType<CashIncome>
{
    public CashIncomeType()
    {
        Field(x => x.IncomeId);
        Field(x => x.RegisterId);
        Field(x => x.Type);
        Field(x => x.Amount, type: typeof(DecimalGraphType));
    }
}

public class CashIncomeInput
{
    public string Type { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}

public class CashIncomeInputType : InputObjectGraphType<CashIncomeInput>
{
    public CashIncomeInputType()
    {
        Field(x => x.Type);
        Field(x => x.Amount);
    }
}
