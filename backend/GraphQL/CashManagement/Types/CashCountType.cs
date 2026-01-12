using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.CashManagement.Types;

public class CashCountType : ObjectGraphType<CashCount>
{
    public CashCountType()
    {
        Field(x => x.CountId);
        Field(x => x.RegisterId);
        Field(x => x.DenominationId);
        Field(x => x.Quantity);
        Field(x => x.Total);
        Field(x => x.IsOpening);
        Field<CashDenominationType, CashDenomination>("denomination")
            .Resolve(context => context.Source.Denomination);
    }
}
