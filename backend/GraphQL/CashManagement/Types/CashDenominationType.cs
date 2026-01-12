using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.CashManagement.Types;

public class CashDenominationType : ObjectGraphType<CashDenomination>
{
    public CashDenominationType()
    {
        Field(x => x.DenominationId);
        Field(x => x.Value);
        Field(x => x.Type);
        Field(x => x.DisplayOrder);
    }
}
