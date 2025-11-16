using GraphQL.Types;

namespace duedgusto.GraphQL.Sales;

public class UpdateSaleInputType : InputObjectGraphType
{
    public UpdateSaleInputType()
    {
        Field<IntGraphType>("productId");
        Field<DecimalGraphType>("quantity");
        Field<StringGraphType>("notes");
    }
}
