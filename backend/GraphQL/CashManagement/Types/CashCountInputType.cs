using GraphQL.Types;

namespace duedgusto.GraphQL.CashManagement.Types;

public class CashCountInput
{
    public int DenominationId { get; set; }
    public int Quantity { get; set; }
}

public class CashCountInputType : InputObjectGraphType<CashCountInput>
{
    public CashCountInputType()
    {
        Field(x => x.DenominationId);
        Field(x => x.Quantity);
    }
}
